[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$EnvFile = 'source-windows.env',
    [string]$ExePath = '',
    [switch]$Detached
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
$envPath = Resolve-DeployPath $EnvFile
if ([string]::IsNullOrWhiteSpace($ExePath)) {
    $ExePath = Join-Path $DeployDir 'source-windows\sub2api.exe'
} else {
    $ExePath = Resolve-DeployPath $ExePath
}

if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Environment file not found: $envPath"
}
if (-not (Test-Path -LiteralPath $ExePath)) {
    throw "Sub2API binary not found: $ExePath. Run .\ops\build-source-windows.ps1 first."
}

Import-EnvFile $envPath

if ([string]::IsNullOrWhiteSpace($env:DATA_DIR)) {
    $env:DATA_DIR = Join-Path $DeployDir 'source-windows\data'
} elseif (-not [System.IO.Path]::IsPathRooted($env:DATA_DIR)) {
    $env:DATA_DIR = Join-Path $DeployDir $env:DATA_DIR
}

New-Item -ItemType Directory -Force -Path $env:DATA_DIR | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DeployDir 'logs') | Out-Null

if ($Detached) {
    $logPath = Join-Path $DeployDir 'logs\sub2api.log'
    $errPath = Join-Path $DeployDir 'logs\sub2api.err.log'
    $process = Start-Process -FilePath $ExePath -WorkingDirectory $DeployDir -RedirectStandardOutput $logPath -RedirectStandardError $errPath -PassThru -WindowStyle Hidden
    Write-Output "Started Sub2API PID=$($process.Id)"
    Write-Output "stdout=$logPath"
    Write-Output "stderr=$errPath"
    return
}

& $ExePath
exit $LASTEXITCODE
