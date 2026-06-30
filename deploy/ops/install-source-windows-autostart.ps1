[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$TaskName = 'Sub2API Windows Source',
    [int]$IntervalSeconds = 60,
    [int]$CycleTimeoutSeconds = 300,
    [string]$PublicHealthUrl = '',
    [switch]$SkipTunnel,
    [switch]$SystemStartup,
    [int]$StartupDelaySeconds = 60,
    [switch]$StartupFolderOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path
$watchScript = Join-Path $DeployDir 'ops\watch-source-windows.ps1'
if (-not (Test-Path -LiteralPath $watchScript)) {
    throw "Watchdog script not found: $watchScript"
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

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ($args -join ' ')

if ($SystemStartup) {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principalCheck = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principalCheck.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'System startup task installation requires an elevated Administrator PowerShell session.'
    }

    $trigger = New-ScheduledTaskTrigger -AtStartup
    if ($StartupDelaySeconds -gt 0) {
        $trigger.Delay = "PT$($StartupDelaySeconds)S"
    }
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $description = 'Keep Sub2API Windows source deployment running at system startup, before user logon.'
} else {
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    if ($StartupDelaySeconds -gt 0) {
        $trigger.Delay = "PT$($StartupDelaySeconds)S"
    }
    $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
    $description = 'Keep Sub2API Windows source deployment running at user logon.'
}

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0)

function Install-StartupFolderCommand {
    param(
        [Parameter(Mandatory = $true)][string]$TaskName,
        [Parameter(Mandatory = $true)][string[]]$PowerShellArgs
    )

    $startupDir = [Environment]::GetFolderPath('Startup')
    if ([string]::IsNullOrWhiteSpace($startupDir)) {
        throw 'Cannot resolve current user Startup folder.'
    }
    New-Item -ItemType Directory -Force -Path $startupDir | Out-Null

    $safeName = ($TaskName -replace '[\\/:*?"<>|]', '-').Trim()
    if ([string]::IsNullOrWhiteSpace($safeName)) {
        $safeName = 'Sub2API Windows Source'
    }
    $cmdPath = Join-Path $startupDir "$safeName.cmd"
    $line = '@echo off' + [Environment]::NewLine +
        'start "" /min powershell.exe ' + ($PowerShellArgs -join ' ') + [Environment]::NewLine
    Set-Content -LiteralPath $cmdPath -Value $line -Encoding ASCII
    Write-Output "Created Startup folder launcher: $cmdPath"
}

if ($StartupFolderOnly) {
    if ($SystemStartup) {
        throw '-StartupFolderOnly cannot be combined with -SystemStartup.'
    }
    Install-StartupFolderCommand -TaskName $TaskName -PowerShellArgs $args
    return
}

try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description $description `
        -Force `
        -ErrorAction Stop | Out-Null

    Write-Output "Registered scheduled task: $TaskName"
} catch {
    if ($SystemStartup) {
        throw
    }
    Write-Warning "Scheduled task registration failed: $($_.Exception.Message)"
    Write-Warning 'Falling back to the current user Startup folder.'
    Install-StartupFolderCommand -TaskName $TaskName -PowerShellArgs $args
}
