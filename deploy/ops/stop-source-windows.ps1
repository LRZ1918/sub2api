[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [switch]$KeepPostgres,
    [switch]$KeepGarnet,
    [switch]$KeepTunnel
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path
$runtimeDir = Join-Path $DeployDir 'runtime'

function Stop-ProcessesByPathPrefix {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$PathPrefix
    )

    Get-Process -Name $Name -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and $_.Path.StartsWith($PathPrefix, [System.StringComparison]::OrdinalIgnoreCase) } |
        ForEach-Object {
            Stop-Process -Id $_.Id -Force
            Write-Output "Stopped $Name PID=$($_.Id)"
        }
}

Stop-ProcessesByPathPrefix -Name 'sub2api' -PathPrefix $DeployDir

if (-not $KeepTunnel) {
    Stop-ProcessesByPathPrefix -Name 'cloudflared' -PathPrefix $DeployDir
}

if (-not $KeepGarnet) {
    Stop-ProcessesByPathPrefix -Name 'GarnetServer' -PathPrefix $runtimeDir
}

if (-not $KeepPostgres) {
    $pgCtl = Get-ChildItem -LiteralPath $runtimeDir -Recurse -Filter 'pg_ctl.exe' -File -ErrorAction SilentlyContinue |
        Select-Object -First 1
    $dataDir = Join-Path $runtimeDir 'postgres-data'
    if ($pgCtl -and (Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION'))) {
        & $pgCtl.FullName -D $dataDir stop -m fast
    } else {
        Stop-ProcessesByPathPrefix -Name 'postgres' -PathPrefix $runtimeDir
    }
}
