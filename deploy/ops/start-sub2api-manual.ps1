[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$PublicHealthUrl = 'https://wawazz.xyz/health',
    [int]$IntervalSeconds = 60,
    [int]$CycleTimeoutSeconds = 300,
    [switch]$SkipTunnel,
    [switch]$NoPause
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ''
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-WatchdogProcess {
    param([Parameter(Mandatory = $true)][string]$WatchScript)

    $resolvedWatchScript = (Resolve-Path -LiteralPath $WatchScript).Path
    @(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
        Where-Object {
            $_.CommandLine -and $_.CommandLine.Contains($resolvedWatchScript)
        })
}

function Start-Watchdog {
    param(
        [Parameter(Mandatory = $true)][string]$DeployDir,
        [Parameter(Mandatory = $true)][string]$PublicHealthUrl,
        [int]$IntervalSeconds = 60,
        [int]$CycleTimeoutSeconds = 300,
        [switch]$SkipTunnel
    )

    $watchScript = Join-Path $DeployDir 'ops\watch-source-windows.ps1'
    if (-not (Test-Path -LiteralPath $watchScript)) {
        throw "Watchdog script not found: $watchScript"
    }

    $existing = @(Get-WatchdogProcess -WatchScript $watchScript)
    if ($existing.Count -gt 0) {
        Write-Host "Watchdog already running. PID(s): $($existing.ProcessId -join ', ')"
        return
    }

    $taskName = 'Sub2API Windows Source Watchdog'
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($task) {
        try {
            Start-ScheduledTask -TaskName $taskName
            Start-Sleep -Seconds 3
            $existing = @(Get-WatchdogProcess -WatchScript $watchScript)
            if ($existing.Count -gt 0) {
                Write-Host "Started watchdog by scheduled task. PID(s): $($existing.ProcessId -join ', ')"
                return
            }
        } catch {
            Write-Warning "Scheduled task start failed: $($_.Exception.Message)"
        }
    }

    $args = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-WindowStyle', 'Hidden',
        '-File', "`"$watchScript`"",
        '-DeployDir', "`"$DeployDir`"",
        '-IntervalSeconds', $IntervalSeconds.ToString(),
        '-CycleTimeoutSeconds', $CycleTimeoutSeconds.ToString(),
        '-PublicHealthUrl', "`"$PublicHealthUrl`""
    )
    if ($SkipTunnel) {
        $args += '-SkipTunnel'
    }

    $process = Start-Process -FilePath 'powershell.exe' `
        -ArgumentList ($args -join ' ') `
        -WindowStyle Hidden `
        -PassThru
    Write-Host "Started watchdog directly. PID=$($process.Id)"
}

try {
    $DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path
    $startScript = Join-Path $DeployDir 'ops\start-source-windows-all.ps1'
    if (-not (Test-Path -LiteralPath $startScript)) {
        throw "Start script not found: $startScript"
    }

    Write-Host 'Sub2API manual startup'
    Write-Host "DeployDir: $DeployDir"
    Write-Host "PublicHealthUrl: $PublicHealthUrl"

    Write-Step 'Starting dependency stack, Sub2API, and Cloudflare Tunnel'
    $startParams = @{
        DeployDir        = $DeployDir
        PublicHealthUrl  = $PublicHealthUrl
    }
    if ($SkipTunnel) {
        $startParams.SkipTunnel = $true
    }
    & $startScript @startParams

    Write-Step 'Starting watchdog keepalive'
    $watchParams = @{
        DeployDir            = $DeployDir
        PublicHealthUrl      = $PublicHealthUrl
        IntervalSeconds      = $IntervalSeconds
        CycleTimeoutSeconds  = $CycleTimeoutSeconds
    }
    if ($SkipTunnel) {
        $watchParams.SkipTunnel = $true
    }
    Start-Watchdog @watchParams

    Write-Step 'Final health check'
    & (Join-Path $DeployDir 'ops\healthcheck-source-windows.ps1') -DeployDir $DeployDir -PublicUrl $PublicHealthUrl

    Write-Host ''
    Write-Host 'Sub2API services are running.' -ForegroundColor Green
    Write-Host 'Web: https://wawazz.xyz'
    Write-Host 'API: https://wawazz.xyz/v1'
} catch {
    Write-Host ''
    Write-Host "Startup failed: $($_.Exception.Message)" -ForegroundColor Red
    $logDir = Join-Path $DeployDir 'logs'
    if (Test-Path -LiteralPath $logDir) {
        Write-Host ''
        Write-Host 'Recent watchdog log:'
        Get-Content -LiteralPath (Join-Path $logDir 'source-windows-watchdog.log') -Tail 30 -ErrorAction SilentlyContinue
        Write-Host ''
        Write-Host 'Recent Cloudflare log:'
        Get-Content -LiteralPath (Join-Path $logDir 'cloudflared-named.err.log') -Tail 20 -ErrorAction SilentlyContinue
    }
    exit 1
} finally {
    if (-not $NoPause) {
        Write-Host ''
        Read-Host 'Press Enter to close this window'
    }
}
