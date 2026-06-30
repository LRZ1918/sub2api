[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [int]$PostgresPort = 5432,
    [int]$RedisPort = 6379,
    [switch]$SkipPostgres,
    [switch]$SkipGarnet,
    [switch]$EnableGarnetAof
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

function Wait-TcpPort {
    param(
        [Parameter(Mandatory = $true)][string]$HostName,
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (Test-TcpPort -HostName $HostName -Port $Port) {
            return $true
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)

    return $false
}

function Invoke-RedisRaw {
    param(
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][string]$Payload
    )

    $client = [Net.Sockets.TcpClient]::new('127.0.0.1', $Port)
    try {
        $client.ReceiveTimeout = 3000
        $client.SendTimeout = 3000
        $stream = $client.GetStream()
        $bytes = [Text.Encoding]::ASCII.GetBytes($Payload)
        $stream.Write($bytes, 0, $bytes.Length)
        $buffer = New-Object byte[] 256
        $read = $stream.Read($buffer, 0, $buffer.Length)
        return [Text.Encoding]::ASCII.GetString($buffer, 0, $read)
    } finally {
        $client.Close()
    }
}

function Wait-RedisReady {
    param(
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutSeconds = 45
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $pong = Invoke-RedisRaw -Port $Port -Payload "*1`r`n`$4`r`nPING`r`n"
            if ($pong.StartsWith('+PONG')) {
                return $true
            }
        } catch {
            # Garnet may have opened the process but not accepted Redis commands yet.
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)

    return $false
}

function Find-FirstFile {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Filter
    )

    $candidates = @()
    if ($Filter -eq 'pg_ctl.exe') {
        $candidates += Get-ChildItem -LiteralPath $Root -Directory -Filter 'postgresql-*' -ErrorAction SilentlyContinue |
            ForEach-Object { Join-Path $_.FullName 'pgsql\bin\pg_ctl.exe' }
    } elseif ($Filter -eq 'GarnetServer.exe') {
        $candidates += Get-ChildItem -LiteralPath $Root -Directory -Filter 'garnet-*' -ErrorAction SilentlyContinue |
            ForEach-Object { Join-Path $_.FullName 'net8.0\GarnetServer.exe' }
    }

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    $skipDirs = @('postgres-data', 'garnet-data')
    $queue = [System.Collections.Generic.Queue[string]]::new()
    $queue.Enqueue($Root)

    while ($queue.Count -gt 0) {
        $dir = $queue.Dequeue()
        $file = Get-ChildItem -LiteralPath $dir -Filter $Filter -File -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($file) {
            return $file.FullName
        }

        Get-ChildItem -LiteralPath $dir -Directory -ErrorAction SilentlyContinue |
            Where-Object { $skipDirs -notcontains $_.Name } |
            ForEach-Object { $queue.Enqueue($_.FullName) }
    }

    if (-not $file) {
        throw "Cannot find $Filter under $Root"
    }
}

function Get-PostgresProcessesForDataDir {
    param([Parameter(Mandatory = $true)][string]$DataDir)

    $needleBackslash = (Resolve-Path -LiteralPath $DataDir).Path
    $needleSlash = $needleBackslash -replace '\\', '/'

    return @(Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" |
        Where-Object {
            $_.CommandLine -and (
                $_.CommandLine.Contains($needleBackslash) -or
                $_.CommandLine.Contains($needleSlash)
            )
        })
}

function Remove-StalePostmasterPid {
    param(
        [Parameter(Mandatory = $true)][string]$DataDir,
        [AllowNull()][AllowEmptyCollection()][object[]]$PostgresProcesses = @()
    )

    if ($null -eq $PostgresProcesses) {
        $PostgresProcesses = @()
    }

    $pidFile = Join-Path $DataDir 'postmaster.pid'
    if (-not (Test-Path -LiteralPath $pidFile)) {
        return $false
    }
    if ($PostgresProcesses.Count -gt 0) {
        return $false
    }

    $backup = Join-Path $DataDir ("postmaster.pid.stale.{0}" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Copy-Item -LiteralPath $pidFile -Destination $backup -Force
    Remove-Item -LiteralPath $pidFile -Force
    Write-Output "Removed stale PostgreSQL pid file: $pidFile (backup: $backup)"
    return $true
}

function Wait-PostgresReady {
    param(
        [Parameter(Mandatory = $true)][string]$PgBin,
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutSeconds = 60
    )

    $pgIsReady = Join-Path $PgBin 'pg_isready.exe'
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (Test-Path -LiteralPath $pgIsReady) {
            & $pgIsReady -h 127.0.0.1 -p $Port *> $null
            if ($LASTEXITCODE -eq 0) {
                return $true
            }
        } elseif (Test-TcpPort -HostName '127.0.0.1' -Port $Port) {
            return $true
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)

    return $false
}

$DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path
$runtimeDir = Join-Path $DeployDir 'runtime'
$logDir = Join-Path $DeployDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (-not $SkipPostgres) {
    $pgCtl = Find-FirstFile -Root $runtimeDir -Filter 'pg_ctl.exe'
    $pgBin = Split-Path -Parent $pgCtl
    $dataDir = Join-Path $runtimeDir 'postgres-data'
    if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION'))) {
        throw "PostgreSQL data directory is not initialized: $dataDir"
    }

    $postgresListening = Test-TcpPort -HostName '127.0.0.1' -Port $PostgresPort
    $postgresStatusOk = $false
    try {
        & $pgCtl -D $dataDir status *> $null
        $postgresStatusOk = ($LASTEXITCODE -eq 0)
    } catch {
        $postgresStatusOk = $false
    }

    if ($postgresListening -and $postgresStatusOk) {
        if (-not (Wait-PostgresReady -PgBin $pgBin -Port $PostgresPort -TimeoutSeconds 60)) {
            throw "PostgreSQL is listening but not ready on 127.0.0.1:$PostgresPort"
        }
        Write-Output "PostgreSQL already listening on 127.0.0.1:$PostgresPort"
    } else {
        $postgresProcesses = Get-PostgresProcessesForDataDir -DataDir $dataDir
        if (-not $postgresStatusOk) {
            Remove-StalePostmasterPid -DataDir $dataDir -PostgresProcesses $postgresProcesses | Out-Null
        }

        if ($postgresListening -and -not $postgresStatusOk) {
            $runtimeDirPattern = ($runtimeDir -replace '\\', '/')
            Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" |
                Where-Object { $_.CommandLine -like '*--forkchild*' -and $_.CommandLine -like "*$runtimeDirPattern*" } |
                ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
            Start-Sleep -Seconds 2
        }

        $postgresLog = Join-Path $logDir ("postgres.{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
        $pgOptions = '"-h" "127.0.0.1" "-p" "' + $PostgresPort + '"'
        & $pgCtl -D $dataDir -l $postgresLog -o $pgOptions -w -t 60 start
        if ($LASTEXITCODE -ne 0) {
            throw "PostgreSQL failed to start on 127.0.0.1:$PostgresPort. Check $postgresLog"
        }
        if (-not (Wait-TcpPort -HostName '127.0.0.1' -Port $PostgresPort -TimeoutSeconds 15)) {
            throw "PostgreSQL did not start on 127.0.0.1:$PostgresPort. Check $postgresLog"
        }
        & $pgCtl -D $dataDir status *> $null
        if ($LASTEXITCODE -ne 0) {
            throw "PostgreSQL port is open but pg_ctl status failed. Check $postgresLog"
        }
        if (-not (Wait-PostgresReady -PgBin $pgBin -Port $PostgresPort -TimeoutSeconds 60)) {
            throw "PostgreSQL did not become ready on 127.0.0.1:$PostgresPort. Check $postgresLog"
        }
        Write-Output "Started PostgreSQL on 127.0.0.1:$PostgresPort"
    }
}

if (-not $SkipGarnet) {
    if (Test-TcpPort -HostName '127.0.0.1' -Port $RedisPort) {
        Write-Output "Redis-compatible service already listening on 127.0.0.1:$RedisPort"
    } else {
        $dotnetRoot = Join-Path $runtimeDir 'dotnet'
        $dotnetExe = Join-Path $dotnetRoot 'dotnet.exe'
        if (-not (Test-Path -LiteralPath $dotnetExe)) {
            throw "Local .NET runtime not found: $dotnetExe"
        }

        $garnetExe = Find-FirstFile -Root $runtimeDir -Filter 'GarnetServer.exe'
        $garnetData = Join-Path $runtimeDir 'garnet-data'
        New-Item -ItemType Directory -Force -Path $garnetData | Out-Null

        $stdout = Join-Path $logDir 'garnet.log'
        $stderr = Join-Path $logDir 'garnet.err.log'
        $garnetArgs = @(
            '--bind', '127.0.0.1',
            '--port', $RedisPort,
            '--memory', '256m',
            '--index', '16m',
            '--obj-log-memory', '32m',
            '--checkpointdir', $garnetData,
            '--lua'
        )
        if ($EnableGarnetAof) {
            $garnetArgs += @('--aof', '--recover')
        }
        $garnetArgLine = ($garnetArgs | ForEach-Object {
            if ($_ -match '\s') { "'$($_ -replace "'", "''")'" } else { $_ }
        }) -join ' '

        $command = @"
`$env:DOTNET_ROOT = '$dotnetRoot'
`$env:PATH = '$dotnetRoot;' + `$env:PATH
& '$garnetExe' $garnetArgLine
"@
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
        $garnetProcess = Start-Process -FilePath powershell.exe `
            -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded) `
            -RedirectStandardOutput $stdout `
            -RedirectStandardError $stderr `
            -PassThru `
            -WindowStyle Hidden
        if (-not (Wait-TcpPort -HostName '127.0.0.1' -Port $RedisPort -TimeoutSeconds 120)) {
            if ($garnetProcess.HasExited) {
                throw "Garnet process exited before opening 127.0.0.1:$RedisPort. ExitCode=$($garnetProcess.ExitCode). Check $stdout and $stderr"
            }
            throw "Garnet did not start on 127.0.0.1:$RedisPort. Check $stdout and $stderr"
        }
        if (-not (Wait-RedisReady -Port $RedisPort -TimeoutSeconds 120)) {
            throw "Garnet opened 127.0.0.1:$RedisPort but Redis PING did not become ready. Check $stdout and $stderr"
        }
        Write-Output "Started Garnet on 127.0.0.1:$RedisPort"
    }

    $pong = Invoke-RedisRaw -Port $RedisPort -Payload "*1`r`n`$4`r`nPING`r`n"
    if (-not $pong.StartsWith('+PONG')) {
        throw "Redis PING failed: $pong"
    }
    $eval = Invoke-RedisRaw -Port $RedisPort -Payload "*3`r`n`$4`r`nEVAL`r`n`$8`r`nreturn 1`r`n`$1`r`n0`r`n"
    if (-not $eval.StartsWith(':1')) {
        throw "Redis Lua EVAL failed: $eval"
    }
    Write-Output "Redis protocol and Lua scripting verified"
}
