[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$Url = 'http://127.0.0.1:8080',
    [string]$ConfigPath = '',
    [string]$PublicUrl = '',
    [ValidateSet('auto', 'quic', 'http2')]
    [string]$Protocol = 'quic',
    [switch]$ForceNew
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Find-Cloudflared {
    param([Parameter(Mandatory = $true)][string]$DeployDir)

    $local = Join-Path $DeployDir 'runtime\cloudflared.exe'
    if (Test-Path -LiteralPath $local) {
        return (Resolve-Path -LiteralPath $local).Path
    }

    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    throw "cloudflared.exe not found. Place it at $local or install cloudflared in PATH."
}

function Get-QuickTunnelUrl {
    param([Parameter(Mandatory = $true)][string]$LogPath)

    if (-not (Test-Path -LiteralPath $LogPath)) {
        return ''
    }

    $content = Get-Content -LiteralPath $LogPath -Raw
    $match = [regex]::Match($content, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($match.Success) {
        return $match.Value
    }
    return ''
}

function Get-NamedTunnelUrl {
    param([Parameter(Mandatory = $true)][string]$ConfigPath)

    if (-not (Test-Path -LiteralPath $ConfigPath)) {
        return ''
    }

    $hostnames = @(Get-Content -LiteralPath $ConfigPath |
        ForEach-Object { [regex]::Match($_, '^\s*-\s*hostname:\s*(\S+)\s*$|^\s*hostname:\s*(\S+)\s*$') } |
        Where-Object { $_.Success } |
        ForEach-Object {
            if ($_.Groups[1].Value) { $_.Groups[1].Value } else { $_.Groups[2].Value }
        })

    $hostname = $hostnames | Where-Object { $_ -eq 'wawazz.xyz' } | Select-Object -First 1
    if (-not $hostname) {
        $hostname = $hostnames | Where-Object { $_ -notmatch '^(www|api)\.' } | Select-Object -First 1
    }
    if (-not $hostname) {
        $hostname = $hostnames | Select-Object -First 1
    }

    if ($hostname) {
        return "https://$hostname"
    }
    return ''
}

function Get-CloudflaredProcessByConfig {
    param(
        [Parameter(Mandatory = $true)][string]$Cloudflared,
        [Parameter(Mandatory = $true)][string]$ConfigPath
    )

    $resolvedConfigPath = (Resolve-Path -LiteralPath $ConfigPath).Path
    Get-CimInstance Win32_Process -Filter "name = 'cloudflared.exe'" |
        Where-Object {
            $_.ExecutablePath -and
            $_.ExecutablePath.Equals($Cloudflared, [System.StringComparison]::OrdinalIgnoreCase) -and
            $_.CommandLine -and
            $_.CommandLine.Contains($resolvedConfigPath)
        } |
        Select-Object -First 1
}

$DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path
$cloudflared = Find-Cloudflared -DeployDir $DeployDir
$logDir = Join-Path $DeployDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $namedConfigs = @(Get-ChildItem -LiteralPath (Join-Path $DeployDir 'runtime') -Filter '*-cloudflared.yml' -File -ErrorAction SilentlyContinue)
    if ($namedConfigs.Count -eq 1) {
        $ConfigPath = $namedConfigs[0].FullName
    }
}

if (-not [string]::IsNullOrWhiteSpace($ConfigPath)) {
    $ConfigPath = (Resolve-Path -LiteralPath $ConfigPath).Path
    if ([string]::IsNullOrWhiteSpace($PublicUrl)) {
        $PublicUrl = Get-NamedTunnelUrl -ConfigPath $ConfigPath
    }

    $stdout = Join-Path $logDir 'cloudflared-named.log'
    $stderr = Join-Path $logDir 'cloudflared-named.err.log'
    $existing = Get-CloudflaredProcessByConfig -Cloudflared $cloudflared -ConfigPath $ConfigPath

    if ($existing -and -not $ForceNew) {
        [PSCustomObject]@{
            PID       = $existing.ProcessId
            PublicUrl = $PublicUrl
            Protocol  = $Protocol
            Log       = $stderr
            Reused    = $true
        }
        return
    }

    if ($existing -and $ForceNew) {
        Stop-Process -Id $existing.ProcessId -Force
        Start-Sleep -Seconds 2
    }

    Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue
    $process = Start-Process -FilePath $cloudflared `
        -ArgumentList @('tunnel', '--config', $ConfigPath, '--protocol', $Protocol, '--no-autoupdate', 'run') `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru `
        -WindowStyle Hidden

    Start-Sleep -Seconds 2
    if ($process.HasExited) {
        throw "Cloudflare named tunnel exited immediately. Check $stderr"
    }

    [PSCustomObject]@{
        PID       = $process.Id
        PublicUrl = $PublicUrl
        Protocol  = $Protocol
        Log       = $stderr
        Reused    = $false
    }
    return
}

$stdout = Join-Path $logDir 'cloudflared.log'
$stderr = Join-Path $logDir 'cloudflared.err.log'

$existing = Get-Process -Name cloudflared -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.Path.Equals($cloudflared, [System.StringComparison]::OrdinalIgnoreCase) } |
    Select-Object -First 1

if ($existing -and -not $ForceNew) {
    $quickUrl = Get-QuickTunnelUrl -LogPath $stderr
    [PSCustomObject]@{
        PID       = $existing.Id
        PublicUrl = $quickUrl
        Log       = $stderr
        Reused    = $true
    }
    return
}

if ($existing -and $ForceNew) {
    $existing | Stop-Process -Force
    Start-Sleep -Seconds 2
}

Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue
$process = Start-Process -FilePath $cloudflared `
    -ArgumentList @('tunnel', '--url', $Url, '--no-autoupdate') `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru `
    -WindowStyle Hidden

$quickUrl = ''
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if ($process.HasExited) {
        break
    }
    $quickUrl = Get-QuickTunnelUrl -LogPath $stderr
    if ($quickUrl -ne '') {
        break
    }
}

if ($quickUrl -eq '') {
    throw "Cloudflare quick tunnel URL was not created. Check $stderr"
}

[PSCustomObject]@{
    PID       = $process.Id
    PublicUrl = $quickUrl
    Log       = $stderr
    Reused    = $false
}
