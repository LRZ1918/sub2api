[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$EnvFile = 'source-windows.env',
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

function Resolve-RequiredTool {
    param([Parameter(Mandatory = $true)][string]$ToolName)

    $command = Get-Command $ToolName -CommandType Application -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    $runtimeDir = Join-Path $DeployDir 'runtime'
    if (Test-Path -LiteralPath $runtimeDir) {
        $candidates = @(Get-ChildItem -LiteralPath $runtimeDir -Recurse -Filter $ToolName -File -ErrorAction SilentlyContinue)
        $preferred = @($candidates | Where-Object { $_.FullName -like "*\pgsql\bin\$ToolName" } | Select-Object -First 1)
        if ($preferred.Count -gt 0) {
            return $preferred[0].FullName
        }
        if ($candidates.Count -gt 0) {
            return $candidates[0].FullName
        }
    }

    throw "$ToolName is required. Add the PostgreSQL bin directory to PATH or place portable PostgreSQL under deploy/runtime."
}

$DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path
$envPath = Resolve-DeployPath $EnvFile
if ([string]::IsNullOrWhiteSpace($BackupDir)) {
    $BackupDir = Join-Path $DeployDir 'backups'
} elseif (-not [System.IO.Path]::IsPathRooted($BackupDir)) {
    $BackupDir = Join-Path $DeployDir $BackupDir
}

if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Environment file not found: $envPath"
}

Import-EnvFile $envPath
$pgDump = Resolve-RequiredTool 'pg_dump.exe'
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$tmpDir = Join-Path $BackupDir "sub2api-source-backup-$timestamp.tmp"
$payloadDir = Join-Path $tmpDir 'payload'
$backupFile = Join-Path $BackupDir "sub2api-source-backup-$timestamp.zip"

New-Item -ItemType Directory -Force -Path $payloadDir | Out-Null

try {
    $postgresHost = if ([string]::IsNullOrWhiteSpace($env:DATABASE_HOST)) { '127.0.0.1' } else { $env:DATABASE_HOST }
    $postgresPort = if ([string]::IsNullOrWhiteSpace($env:DATABASE_PORT)) { '5432' } else { $env:DATABASE_PORT }
    $postgresUser = if ([string]::IsNullOrWhiteSpace($env:DATABASE_USER)) { 'postgres' } else { $env:DATABASE_USER }
    $postgresDb = if ([string]::IsNullOrWhiteSpace($env:DATABASE_DBNAME)) { 'sub2api' } else { $env:DATABASE_DBNAME }
    $dbDump = Join-Path $payloadDir 'postgres.sql'

    $env:PGPASSWORD = $env:DATABASE_PASSWORD
    & $pgDump -h $postgresHost -p $postgresPort -U $postgresUser -d $postgresDb -f $dbDump
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE"
    }

    Copy-Item -LiteralPath $envPath -Destination (Join-Path $payloadDir (Split-Path $envPath -Leaf)) -Force
    if (-not [string]::IsNullOrWhiteSpace($env:DATA_DIR)) {
        $dataDir = if ([System.IO.Path]::IsPathRooted($env:DATA_DIR)) { $env:DATA_DIR } else { Join-Path $DeployDir $env:DATA_DIR }
        if (Test-Path -LiteralPath $dataDir) {
            Copy-Item -LiteralPath $dataDir -Destination (Join-Path $payloadDir 'data') -Recurse -Force
        }
    }

    Compress-Archive -Path (Join-Path $payloadDir '*') -DestinationPath $backupFile -Force

    $cutoff = (Get-Date).ToUniversalTime().AddDays(-1 * $RetentionDays)
    Get-ChildItem -LiteralPath $BackupDir -Filter 'sub2api-source-backup-*.zip' -File |
        Where-Object { $_.LastWriteTimeUtc -lt $cutoff } |
        Remove-Item -Force

    Write-Output $backupFile
} finally {
    Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
