[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [switch]$SkipTunnel,
    [string]$PublicHealthUrl = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-TcpPort {
    param(
        [Parameter(Mandatory = $true)][string]$HostName,
        [Parameter(Mandatory = $true)][int]$Port
    )

    $client = [Net.Sockets.TcpClient]::new()
    try {
        $async = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(1000)) {
            return $false
        }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-HealthUrl {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                return $true
            }
        } catch {
            # The process may be started but not listening yet.
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)

    return $false
}

function Get-EnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$Default
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $Default
    }
    $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^$([regex]::Escape($Key))=" } | Select-Object -First 1
    if (-not $line) {
        return $Default
    }
    return $line.Substring($line.IndexOf('=') + 1).Trim()
}

$DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path

& (Join-Path $DeployDir 'ops\start-source-windows-deps.ps1') -DeployDir $DeployDir

$envFile = Join-Path $DeployDir 'source-windows.env'
$serverPortRaw = Get-EnvValue -Path $envFile -Key 'SERVER_PORT' -Default '8080'
$serverPort = 8080
if (-not [int]::TryParse($serverPortRaw, [ref]$serverPort)) {
    $serverPort = 8080
}
$localHealthUrl = "http://127.0.0.1:$serverPort/health"

if (Test-TcpPort -HostName '127.0.0.1' -Port $serverPort) {
    Write-Output "Sub2API already listening on 127.0.0.1:$serverPort"
} else {
    & (Join-Path $DeployDir 'ops\run-source-windows.ps1') -DeployDir $DeployDir -Detached
}

if (-not (Wait-HealthUrl -Url $localHealthUrl -TimeoutSeconds 90)) {
    throw "Sub2API did not become healthy at $localHealthUrl"
}

$publicUrl = ''
if (-not $SkipTunnel) {
    $tunnel = & (Join-Path $DeployDir 'ops\start-source-windows-tunnel.ps1') -DeployDir $DeployDir
    $publicUrl = $tunnel.PublicUrl
    if ($publicUrl) {
        Set-Content -LiteralPath (Join-Path $DeployDir 'runtime\current-public-url.txt') -Value $publicUrl -Encoding UTF8
        Write-Output "Public URL: $publicUrl"
    }
}

if ($PublicHealthUrl -ne '') {
    Wait-HealthUrl -Url $PublicHealthUrl -TimeoutSeconds 120 | Out-Null
    & (Join-Path $DeployDir 'ops\healthcheck-source-windows.ps1') -DeployDir $DeployDir -PublicUrl $PublicHealthUrl
} elseif ($publicUrl -ne '') {
    Wait-HealthUrl -Url "$publicUrl/health" -TimeoutSeconds 120 | Out-Null
    & (Join-Path $DeployDir 'ops\healthcheck-source-windows.ps1') -DeployDir $DeployDir -PublicUrl "$publicUrl/health"
} else {
    & (Join-Path $DeployDir 'ops\healthcheck-source-windows.ps1') -DeployDir $DeployDir
}
