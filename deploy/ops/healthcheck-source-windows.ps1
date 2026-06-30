[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$EnvFile = 'source-windows.env',
    [string]$LocalUrl = '',
    [string]$PublicUrl = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-DeployPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }
    return (Join-Path $DeployDir $Path)
}

function Import-EnvFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#')) {
            continue
        }

        $separator = $trimmed.IndexOf('=')
        if ($separator -le 0) {
            continue
        }

        $key = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

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

function Invoke-DependencyPortCheck {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$HostName,
        [Parameter(Mandatory = $true)][int]$Port
    )

    Write-Host "==> $Name"
    if (-not (Test-TcpPort -HostName $HostName -Port $Port)) {
        throw "$Name is not listening on ${HostName}:$Port"
    }
    Write-Host "${HostName}:$Port -> listening"
}

function Invoke-HealthUrl {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Url
    )

    Write-Host "==> $Name"
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 15
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
        throw "$Name returned HTTP $($response.StatusCode)"
    }
    Write-Host "$Url -> HTTP $($response.StatusCode)"
}

function Convert-HealthUrlToSettingsUrl {
    param([Parameter(Mandatory = $true)][string]$Url)

    if ($Url -match '/health/?$') {
        return ($Url -replace '/health/?$', '/api/v1/settings/public')
    }
    return ''
}

function Invoke-PublicSettingsCheck {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Url
    )

    Write-Host "==> $Name"
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 15
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
        throw "$Name returned HTTP $($response.StatusCode)"
    }

    try {
        $json = $response.Content | ConvertFrom-Json
    } catch {
        throw "$Name did not return valid JSON"
    }

    if ($null -eq $json.code -or [int]$json.code -ne 0) {
        throw "$Name returned code=$($json.code)"
    }

    Write-Host "$Url -> HTTP $($response.StatusCode), code=$($json.code)"
}

$DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path
$envPath = Resolve-DeployPath $EnvFile
if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Environment file not found: $envPath"
}

Import-EnvFile $envPath
if ([string]::IsNullOrWhiteSpace($LocalUrl)) {
    $port = if ([string]::IsNullOrWhiteSpace($env:SERVER_PORT)) { '8080' } else { $env:SERVER_PORT }
    $LocalUrl = "http://127.0.0.1:$port/health"
}

$postgresHost = if ([string]::IsNullOrWhiteSpace($env:DATABASE_HOST)) { '127.0.0.1' } else { $env:DATABASE_HOST }
$postgresPort = if ([string]::IsNullOrWhiteSpace($env:DATABASE_PORT)) { 5432 } else { [int]$env:DATABASE_PORT }
$redisHost = if ([string]::IsNullOrWhiteSpace($env:REDIS_HOST)) { '127.0.0.1' } else { $env:REDIS_HOST }
$redisPort = if ([string]::IsNullOrWhiteSpace($env:REDIS_PORT)) { 6379 } else { [int]$env:REDIS_PORT }

Invoke-DependencyPortCheck 'PostgreSQL' $postgresHost $postgresPort
Invoke-DependencyPortCheck 'Redis-compatible service' $redisHost $redisPort

Write-Host '==> sub2api process'
$processes = Get-Process -Name 'sub2api' -ErrorAction SilentlyContinue
if (-not $processes) {
    throw 'sub2api process is not running'
}
$processes | Select-Object Id,ProcessName,StartTime,Path | Format-Table -AutoSize

Invoke-HealthUrl 'local /health' $LocalUrl
$localSettingsUrl = Convert-HealthUrlToSettingsUrl $LocalUrl
if (-not [string]::IsNullOrWhiteSpace($localSettingsUrl)) {
    Invoke-PublicSettingsCheck 'local public settings' $localSettingsUrl
}

if (-not [string]::IsNullOrWhiteSpace($PublicUrl)) {
    Invoke-HealthUrl 'public /health' $PublicUrl
    $publicSettingsUrl = Convert-HealthUrlToSettingsUrl $PublicUrl
    if (-not [string]::IsNullOrWhiteSpace($publicSettingsUrl)) {
        Invoke-PublicSettingsCheck 'public public settings' $publicSettingsUrl
    }
}
