[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [int]$IntervalSeconds = 60,
    [int]$CycleTimeoutSeconds = 300,
    [string]$PublicHealthUrl = '',
    [switch]$SkipTunnel,
    [switch]$Once
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($IntervalSeconds -lt 15) {
    $IntervalSeconds = 15
}
if ($CycleTimeoutSeconds -lt 60) {
    $CycleTimeoutSeconds = 60
}

$DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path
$logDir = Join-Path $DeployDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logPath = Join-Path $logDir 'source-windows-watchdog.log'
$cycleOutPath = Join-Path $logDir 'source-windows-watchdog-cycle.log'
$cycleErrPath = Join-Path $logDir 'source-windows-watchdog-cycle.err.log'
$startScript = Join-Path $DeployDir 'ops\start-source-windows-all.ps1'
$mutexName = 'Local\Sub2APISourceWindowsWatchdog'

function Write-WatchdogLog {
    param([Parameter(Mandatory = $true)][string]$Message)

    $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
}

function Invoke-StartCycle {
    $args = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', "`"$startScript`"",
        '-DeployDir', "`"$DeployDir`""
    )
    if ($SkipTunnel) {
        $args += '-SkipTunnel'
    }
    if (-not [string]::IsNullOrWhiteSpace($PublicHealthUrl)) {
        $args += @('-PublicHealthUrl', "`"$PublicHealthUrl`"")
    }

    Remove-Item -LiteralPath $cycleOutPath, $cycleErrPath -Force -ErrorAction SilentlyContinue
    $process = Start-Process -FilePath 'powershell.exe' `
        -ArgumentList ($args -join ' ') `
        -RedirectStandardOutput $cycleOutPath `
        -RedirectStandardError $cycleErrPath `
        -PassThru `
        -WindowStyle Hidden

    if (-not $process.WaitForExit($CycleTimeoutSeconds * 1000)) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        throw "Health cycle timed out after $CycleTimeoutSeconds seconds. Check $cycleOutPath and $cycleErrPath"
    }
    $process.Refresh()

    if ($null -ne $process.ExitCode -and $process.ExitCode -ne 0) {
        $errTail = ''
        if (Test-Path -LiteralPath $cycleErrPath) {
            $errTail = (Get-Content -LiteralPath $cycleErrPath -Tail 8 -ErrorAction SilentlyContinue) -join ' '
        }
        throw "Health cycle failed with exit code $($process.ExitCode). $errTail"
    }
}

if (-not (Test-Path -LiteralPath $startScript)) {
    throw "Start script not found: $startScript"
}

$mutex = [Threading.Mutex]::new($false, $mutexName)
$hasMutex = $false

try {
    $hasMutex = $mutex.WaitOne(0, $false)
    if (-not $hasMutex) {
        Write-WatchdogLog 'Another watchdog instance is already running.'
        return
    }

    Write-WatchdogLog "Watchdog started. DeployDir=$DeployDir IntervalSeconds=$IntervalSeconds CycleTimeoutSeconds=$CycleTimeoutSeconds PublicHealthUrl=$PublicHealthUrl SkipTunnel=$SkipTunnel"

    do {
        try {
            Write-WatchdogLog 'Health cycle started.'
            Invoke-StartCycle
            Write-WatchdogLog 'Health cycle completed.'
        } catch {
            Write-WatchdogLog ("ERROR: " + $_.Exception.Message)
        }

        if ($Once) {
            break
        }

        Start-Sleep -Seconds $IntervalSeconds
    } while ($true)
} finally {
    if ($hasMutex) {
        $mutex.ReleaseMutex() | Out-Null
    }
    $mutex.Dispose()
}
