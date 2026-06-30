[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$EnvFile = '',
    [string]$ComposeFile = 'docker-compose.production.yml',
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

function Invoke-NativeStep {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Script
    )

    Write-Host "==> $Name"
    & $Script
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
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

$DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path
if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    if (Test-Path -LiteralPath (Join-Path $DeployDir 'windows-tunnel.env')) {
        $EnvFile = 'windows-tunnel.env'
    } else {
        $EnvFile = '.env'
    }
}

$envPath = Resolve-DeployPath $EnvFile
$composePath = Resolve-DeployPath $ComposeFile

if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Environment file not found: $envPath"
}
if (-not (Test-Path -LiteralPath $composePath)) {
    throw "Compose file not found: $composePath"
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'docker is required. Install Docker Desktop and make sure docker is available in PATH.'
}

Import-EnvFile $envPath
if ([string]::IsNullOrWhiteSpace($LocalUrl)) {
    $port = if ([string]::IsNullOrWhiteSpace($env:SERVER_PORT)) { '8080' } else { $env:SERVER_PORT }
    $LocalUrl = "http://127.0.0.1:$port/health"
}

$postgresUser = if ([string]::IsNullOrWhiteSpace($env:POSTGRES_USER)) { 'sub2api' } else { $env:POSTGRES_USER }
$postgresDb = if ([string]::IsNullOrWhiteSpace($env:POSTGRES_DB)) { 'sub2api' } else { $env:POSTGRES_DB }

Invoke-NativeStep 'docker compose ps' {
    & docker compose --env-file $envPath -f $composePath ps
}
Invoke-NativeStep 'postgres readiness' {
    & docker compose --env-file $envPath -f $composePath exec -T postgres pg_isready -U $postgresUser -d $postgresDb
}
Invoke-NativeStep 'redis readiness' {
    & docker compose --env-file $envPath -f $composePath exec -T redis redis-cli ping
}
Invoke-HealthUrl 'local /health' $LocalUrl

if (-not [string]::IsNullOrWhiteSpace($PublicUrl)) {
    Invoke-HealthUrl 'public /health' $PublicUrl
}
