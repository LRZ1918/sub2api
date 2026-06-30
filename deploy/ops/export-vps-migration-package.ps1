[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$EnvFile = 'source-windows.env',
    [string]$OutputDir = '',
    [string]$Domain = '',
    [string[]]$ExtraDomains = @(),
    [string]$Image = 'weishaw/sub2api:latest',
    [int]$RetentionDays = 7,
    [switch]$SkipDatabaseDump,
    [switch]$FinalCutover
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

function Resolve-RepoPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }
    return (Join-Path (Split-Path -Parent $DeployDir) $Path)
}

function Resolve-DataDir {
    param([Parameter(Mandatory = $true)][string]$Path)
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    $deployRelative = Resolve-DeployPath $Path
    if (Test-Path -LiteralPath $deployRelative) {
        return $deployRelative
    }

    return (Resolve-RepoPath $Path)
}

function Import-EnvFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    $result = [ordered]@{}
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
        $result[$key] = $value
    }
    return $result
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

    throw "$ToolName is required. Add PostgreSQL bin to PATH or place portable PostgreSQL under deploy/runtime."
}

function Get-EnvValue {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Env,
        [Parameter(Mandatory = $true)][string]$Key,
        [string]$Default = ''
    )
    if ($Env.Contains($Key) -and -not [string]::IsNullOrWhiteSpace([string]$Env[$Key])) {
        return [string]$Env[$Key]
    }
    return $Default
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function ConvertTo-EnvLine {
    param([string]$Key, [string]$Value)
    $safeValue = ($Value -replace "`r", '' -replace "`n", '')
    return "$Key=$safeValue"
}

function Resolve-Domain {
    param([hashtable]$Env)
    if (-not [string]::IsNullOrWhiteSpace($Domain)) {
        return $Domain.Trim()
    }
    $frontend = Get-EnvValue $Env 'SERVER_FRONTEND_URL' 'https://wawazz.xyz'
    try {
        $uri = [Uri]$frontend
        if (-not [string]::IsNullOrWhiteSpace($uri.Host)) {
            return $uri.Host
        }
    } catch {
        # Fall through to default.
    }
    return 'wawazz.xyz'
}

function Get-TableCounts {
    param(
        [Parameter(Mandatory = $true)][string]$Psql,
        [Parameter(Mandatory = $true)][hashtable]$Env,
        [Parameter(Mandatory = $true)][string[]]$Tables
    )
    $counts = [ordered]@{}
    $postgresHost = Get-EnvValue $Env 'DATABASE_HOST' '127.0.0.1'
    $postgresPort = Get-EnvValue $Env 'DATABASE_PORT' '5432'
    $postgresUser = Get-EnvValue $Env 'DATABASE_USER' 'postgres'
    $postgresDb = Get-EnvValue $Env 'DATABASE_DBNAME' 'sub2api'
    $env:PGPASSWORD = Get-EnvValue $Env 'DATABASE_PASSWORD'
    try {
        foreach ($table in $Tables) {
            $exists = & $Psql -h $postgresHost -p $postgresPort -U $postgresUser -d $postgresDb -t -A -c "select to_regclass('public.$table') is not null;"
            if ($LASTEXITCODE -ne 0) {
                throw "psql table existence check failed for $table"
            }
            if (($exists -join '').Trim() -eq 't') {
                $count = & $Psql -h $postgresHost -p $postgresPort -U $postgresUser -d $postgresDb -t -A -c "select count(*) from public.$table;"
                if ($LASTEXITCODE -ne 0) {
                    throw "psql count failed for $table"
                }
                $counts[$table] = [int64](($count -join '').Trim())
            } else {
                $counts[$table] = $null
            }
        }
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
    return $counts
}

function New-Caddyfile {
    param(
        [Parameter(Mandatory = $true)][string[]]$Hostnames,
        [Parameter(Mandatory = $true)][int]$ServerPort
    )
    $siteLabel = ($Hostnames | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique) -join ', '
    return @"
$siteLabel {
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
	}

	request_body {
		max_size 100MB
	}

	reverse_proxy 127.0.0.1:$ServerPort {
		health_uri /health
		health_interval 30s
		health_timeout 10s
		health_status 200

		header_up Host {host}
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-For {remote_host}
		header_up X-Forwarded-Proto {scheme}
		header_up X-Forwarded-Host {host}
		header_up CF-Connecting-IP {http.request.header.CF-Connecting-IP}
	}

	log {
		output file /var/log/caddy/sub2api.log {
			roll_size 50mb
			roll_keep 10
			roll_keep_for 720h
		}
		format json
		level INFO
	}
}
"@
}

$DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path
$envPath = Resolve-DeployPath $EnvFile
if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Environment file not found: $envPath"
}
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $DeployDir 'migration-packages'
} elseif (-not [System.IO.Path]::IsPathRooted($OutputDir)) {
    $OutputDir = Join-Path $DeployDir $OutputDir
}

$envMap = Import-EnvFile $envPath
$pgDump = $null
$psql = $null
if (-not $SkipDatabaseDump) {
    $pgDump = Resolve-RequiredTool 'pg_dump.exe'
    $psql = Resolve-RequiredTool 'psql.exe'
}
$domainName = Resolve-Domain $envMap
if ($ExtraDomains.Count -eq 0) {
    $ExtraDomains = @("www.$domainName", "api.$domainName")
}

$serverPort = 8080
$frontendUrl = "https://$domainName"
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$packageName = "sub2api-vps-migration-$timestamp"
$tmpRoot = Join-Path $OutputDir "$packageName.tmp"
$packageRoot = Join-Path $tmpRoot $packageName
$packageFile = Join-Path $OutputDir "$packageName.zip"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
if (Test-Path -LiteralPath $tmpRoot) {
    Remove-Item -LiteralPath $tmpRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null

try {
    $postgresDumpPath = Join-Path $packageRoot 'postgres.dump'
    if (-not $SkipDatabaseDump) {
        $postgresHost = Get-EnvValue $envMap 'DATABASE_HOST' '127.0.0.1'
        $postgresPort = Get-EnvValue $envMap 'DATABASE_PORT' '5432'
        $postgresUser = Get-EnvValue $envMap 'DATABASE_USER' 'postgres'
        $postgresDb = Get-EnvValue $envMap 'DATABASE_DBNAME' 'sub2api'
        $env:PGPASSWORD = Get-EnvValue $envMap 'DATABASE_PASSWORD'
        & $pgDump -h $postgresHost -p $postgresPort -U $postgresUser -d $postgresDb --format=custom --no-owner --no-privileges --file $postgresDumpPath
        if ($LASTEXITCODE -ne 0) {
            throw "pg_dump failed with exit code $LASTEXITCODE"
        }
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    } else {
        New-Item -ItemType File -Path $postgresDumpPath -Force | Out-Null
    }

    Copy-Item -LiteralPath $envPath -Destination (Join-Path $packageRoot 'source-windows.env') -Force
    Copy-Item -LiteralPath (Join-Path $DeployDir 'docker-compose.production.yml') -Destination (Join-Path $packageRoot 'docker-compose.production.yml') -Force
    Copy-Item -LiteralPath (Join-Path $DeployDir 'README_CLAUDE_DEPLOY_CN.md') -Destination (Join-Path $packageRoot 'README_CLAUDE_DEPLOY_CN.md') -Force
    Copy-Item -LiteralPath (Join-Path $DeployDir 'VPS_MIGRATION_CN.md') -Destination (Join-Path $packageRoot 'VPS_MIGRATION_CN.md') -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'install-vps.sh') -Destination (Join-Path $packageRoot 'install-vps.sh') -Force

    $dataDirValue = Get-EnvValue $envMap 'DATA_DIR' '.\source-windows\data'
    $dataDir = Resolve-DataDir $dataDirValue
    if (Test-Path -LiteralPath $dataDir) {
        Copy-Item -LiteralPath $dataDir -Destination (Join-Path $packageRoot 'data') -Recurse -Force
    } else {
        New-Item -ItemType Directory -Force -Path (Join-Path $packageRoot 'data') | Out-Null
    }

    $postgresPassword = Get-EnvValue $envMap 'DATABASE_PASSWORD'
    $jwtSecret = Get-EnvValue $envMap 'JWT_SECRET'
    $totpKey = Get-EnvValue $envMap 'TOTP_ENCRYPTION_KEY'
    if ([string]::IsNullOrWhiteSpace($postgresPassword)) {
        throw "DATABASE_PASSWORD is required in $envPath"
    }
    if ([string]::IsNullOrWhiteSpace($jwtSecret) -or [string]::IsNullOrWhiteSpace($totpKey)) {
        throw "JWT_SECRET and TOTP_ENCRYPTION_KEY must be present to migrate without breaking sessions/TOTP."
    }

    $linuxEnvLines = @(
        ConvertTo-EnvLine 'SUB2API_IMAGE' $Image
        ConvertTo-EnvLine 'BIND_HOST' '127.0.0.1'
        ConvertTo-EnvLine 'SERVER_PORT' ([string]$serverPort)
        ConvertTo-EnvLine 'SERVER_FRONTEND_URL' $frontendUrl
        ConvertTo-EnvLine 'SERVER_TRUSTED_PROXIES' '127.0.0.1/32,::1/128'
        ConvertTo-EnvLine 'RUN_MODE' (Get-EnvValue $envMap 'RUN_MODE' 'standard')
        ConvertTo-EnvLine 'TZ' (Get-EnvValue $envMap 'TZ' 'Asia/Shanghai')
        ConvertTo-EnvLine 'POSTGRES_USER' 'postgres'
        ConvertTo-EnvLine 'POSTGRES_PASSWORD' $postgresPassword
        ConvertTo-EnvLine 'POSTGRES_DB' (Get-EnvValue $envMap 'DATABASE_DBNAME' 'sub2api')
        ConvertTo-EnvLine 'DATABASE_MAX_OPEN_CONNS' (Get-EnvValue $envMap 'DATABASE_MAX_OPEN_CONNS' '50')
        ConvertTo-EnvLine 'DATABASE_MAX_IDLE_CONNS' (Get-EnvValue $envMap 'DATABASE_MAX_IDLE_CONNS' '10')
        ConvertTo-EnvLine 'REDIS_PASSWORD' (Get-EnvValue $envMap 'REDIS_PASSWORD' '')
        ConvertTo-EnvLine 'REDIS_DB' (Get-EnvValue $envMap 'REDIS_DB' '0')
        ConvertTo-EnvLine 'REDIS_POOL_SIZE' (Get-EnvValue $envMap 'REDIS_POOL_SIZE' '1024')
        ConvertTo-EnvLine 'REDIS_MIN_IDLE_CONNS' (Get-EnvValue $envMap 'REDIS_MIN_IDLE_CONNS' '10')
        ConvertTo-EnvLine 'ADMIN_EMAIL' (Get-EnvValue $envMap 'ADMIN_EMAIL' "admin@$domainName")
        ConvertTo-EnvLine 'ADMIN_PASSWORD' ''
        ConvertTo-EnvLine 'JWT_SECRET' $jwtSecret
        ConvertTo-EnvLine 'JWT_EXPIRE_HOUR' (Get-EnvValue $envMap 'JWT_EXPIRE_HOUR' '24')
        ConvertTo-EnvLine 'TOTP_ENCRYPTION_KEY' $totpKey
        ConvertTo-EnvLine 'SECURITY_URL_ALLOWLIST_ENABLED' 'false'
        ConvertTo-EnvLine 'SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP' (Get-EnvValue $envMap 'SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP' 'true')
        ConvertTo-EnvLine 'SECURITY_URL_ALLOWLIST_ALLOW_PRIVATE_HOSTS' (Get-EnvValue $envMap 'SECURITY_URL_ALLOWLIST_ALLOW_PRIVATE_HOSTS' 'true')
        ConvertTo-EnvLine 'SECURITY_URL_ALLOWLIST_UPSTREAM_HOSTS' (Get-EnvValue $envMap 'SECURITY_URL_ALLOWLIST_UPSTREAM_HOSTS' '')
        ConvertTo-EnvLine 'UPDATE_PROXY_URL' (Get-EnvValue $envMap 'UPDATE_PROXY_URL' '')
        ConvertTo-EnvLine 'GEMINI_OAUTH_CLIENT_ID' (Get-EnvValue $envMap 'GEMINI_OAUTH_CLIENT_ID' '')
        ConvertTo-EnvLine 'GEMINI_OAUTH_CLIENT_SECRET' (Get-EnvValue $envMap 'GEMINI_OAUTH_CLIENT_SECRET' '')
        ConvertTo-EnvLine 'GEMINI_OAUTH_SCOPES' (Get-EnvValue $envMap 'GEMINI_OAUTH_SCOPES' '')
        ConvertTo-EnvLine 'GEMINI_QUOTA_POLICY' (Get-EnvValue $envMap 'GEMINI_QUOTA_POLICY' '')
        ConvertTo-EnvLine 'GEMINI_CLI_OAUTH_CLIENT_SECRET' (Get-EnvValue $envMap 'GEMINI_CLI_OAUTH_CLIENT_SECRET' '')
        ConvertTo-EnvLine 'ANTIGRAVITY_OAUTH_CLIENT_SECRET' (Get-EnvValue $envMap 'ANTIGRAVITY_OAUTH_CLIENT_SECRET' '')
    )
    Write-Utf8NoBom -Path (Join-Path $packageRoot '.env') -Content (($linuxEnvLines -join "`n") + "`n")

    $hostnames = @($domainName) + $ExtraDomains
    Write-Utf8NoBom -Path (Join-Path $packageRoot 'Caddyfile') -Content (New-Caddyfile -Hostnames $hostnames -ServerPort $serverPort)

    $tableCounts = if (-not $SkipDatabaseDump) {
        Get-TableCounts -Psql $psql -Env $envMap -Tables @('users', 'api_keys', 'accounts', 'groups', 'usage_logs', 'payment_orders')
    } else {
        [ordered]@{}
    }
    $manifest = [ordered]@{
        package_name = $packageName
        created_at_utc = (Get-Date).ToUniversalTime().ToString('o')
        final_cutover = [bool]$FinalCutover
        source_deploy_dir = $DeployDir
        source_data_dir = $dataDir
        domain = $domainName
        extra_domains = $ExtraDomains
        target = 'Ubuntu 22.04/24.04 + Docker Compose + Caddy'
        table_counts = $tableCounts
        notes = @(
            'Plaintext package: contains production secrets, database content, upstream credentials, and user data.',
            'Do not commit, upload to public web directories, or share this package.',
            'Redis/Garnet cache data is intentionally not included; PostgreSQL is the source of truth.'
        )
    }
    Write-Utf8NoBom -Path (Join-Path $packageRoot 'manifest.json') -Content (($manifest | ConvertTo-Json -Depth 8) + "`n")

    $shaLines = @()
    Get-ChildItem -LiteralPath $packageRoot -File -Recurse |
        Where-Object { $_.Name -ne 'SHA256SUMS' } |
        ForEach-Object {
            $relative = $_.FullName.Substring($packageRoot.Length + 1).Replace('\', '/')
            $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            $shaLines += "$hash  $relative"
        }
    Write-Utf8NoBom -Path (Join-Path $packageRoot 'SHA256SUMS') -Content (($shaLines -join "`n") + "`n")

    Compress-Archive -Path $packageRoot -DestinationPath $packageFile -Force

    $cutoff = (Get-Date).ToUniversalTime().AddDays(-1 * $RetentionDays)
    Get-ChildItem -LiteralPath $OutputDir -Filter 'sub2api-vps-migration-*.zip' -File |
        Where-Object { $_.LastWriteTimeUtc -lt $cutoff } |
        Remove-Item -Force

    Write-Output $packageFile
    Write-Warning 'The migration package is plaintext and contains production secrets and database data. Keep it private.'
} finally {
    Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
