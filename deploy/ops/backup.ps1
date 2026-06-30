[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$EnvFile = '',
    [string]$ComposeFile = 'docker-compose.production.yml',
    [string]$BackupDir = '',
    [int]$RetentionDays = 14
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

$DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path
if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    if (Test-Path -LiteralPath (Join-Path $DeployDir 'windows-tunnel.env')) {
        $EnvFile = 'windows-tunnel.env'
    } else {
        $EnvFile = '.env'
    }
}
if ([string]::IsNullOrWhiteSpace($BackupDir)) {
    $BackupDir = Join-Path $DeployDir 'backups'
} elseif (-not [System.IO.Path]::IsPathRooted($BackupDir)) {
    $BackupDir = Join-Path $DeployDir $BackupDir
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
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$tmpDir = Join-Path $BackupDir "sub2api-backup-$timestamp.tmp"
$payloadDir = Join-Path $tmpDir 'payload'
$backupFile = Join-Path $BackupDir "sub2api-backup-$timestamp.zip"

New-Item -ItemType Directory -Force -Path $payloadDir | Out-Null

try {
    $postgresUser = if ([string]::IsNullOrWhiteSpace($env:POSTGRES_USER)) { 'sub2api' } else { $env:POSTGRES_USER }
    $postgresDb = if ([string]::IsNullOrWhiteSpace($env:POSTGRES_DB)) { 'sub2api' } else { $env:POSTGRES_DB }
    $dbDump = Join-Path $payloadDir 'postgres.sql'

    & docker compose --env-file $envPath -f $composePath exec -T postgres pg_dump -U $postgresUser $postgresDb |
        Set-Content -LiteralPath $dbDump -Encoding UTF8
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE"
    }

    Copy-Item -LiteralPath $envPath -Destination (Join-Path $payloadDir (Split-Path $envPath -Leaf)) -Force
    foreach ($name in @('data', 'postgres_data', 'redis_data')) {
        $source = Join-Path $DeployDir $name
        if (Test-Path -LiteralPath $source) {
            Copy-Item -LiteralPath $source -Destination (Join-Path $payloadDir $name) -Recurse -Force
        }
    }

    Compress-Archive -Path (Join-Path $payloadDir '*') -DestinationPath $backupFile -Force

    $cutoff = (Get-Date).ToUniversalTime().AddDays(-1 * $RetentionDays)
    Get-ChildItem -LiteralPath $BackupDir -Filter 'sub2api-backup-*.zip' -File |
        Where-Object { $_.LastWriteTimeUtc -lt $cutoff } |
        Remove-Item -Force

    Write-Output $backupFile
} finally {
    Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
