[CmdletBinding()]
param(
    [string]$DeployDir = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($DeployDir)) {
    $DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
} else {
    $DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path
}

function Assert-FileContains {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string[]]$Patterns
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Expected file missing: $Path"
    }

    $content = Get-Content -LiteralPath $Path -Raw
    foreach ($pattern in $Patterns) {
        if ($content -notmatch [regex]::Escape($pattern)) {
            throw "Expected pattern missing in ${Path}: $pattern"
        }
    }
}

function Assert-FileNotContains {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string[]]$Patterns
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Expected file missing: $Path"
    }

    $content = Get-Content -LiteralPath $Path -Raw
    foreach ($pattern in $Patterns) {
        if ($content -match [regex]::Escape($pattern)) {
            throw "Unexpected pattern present in ${Path}: $pattern"
        }
    }
}

$exportScript = Join-Path $DeployDir 'ops/export-vps-migration-package.ps1'
$installScript = Join-Path $DeployDir 'ops/install-vps.sh'
$doc = Join-Path $DeployDir 'VPS_MIGRATION_CN.md'
$claudeDoc = Join-Path $DeployDir 'README_CLAUDE_DEPLOY_CN.md'
$readme = Join-Path $DeployDir 'README.md'
$gitignore = Join-Path $DeployDir '.gitignore'

Assert-FileContains $exportScript @(
    'postgres.dump',
    '--format=custom',
    'manifest.json',
    'SHA256SUMS',
    'install-vps.sh',
    'README_CLAUDE_DEPLOY_CN.md',
    'SECURITY_URL_ALLOWLIST_ENABLED'
)

Assert-FileContains $installScript @(
    'sha256sum -c SHA256SUMS',
    'pg_restore',
    'docker compose',
    'Caddyfile',
    '/api/v1/settings/public',
    'table_counts'
)

Assert-FileContains $doc @(
    'Ubuntu VPS',
    'postgres.dump',
    'FinalCutover',
    'pg_restore',
    'Cloudflare Tunnel'
)

Assert-FileContains $claudeDoc @(
    'CLAUDE_DEPLOY_PROMPT_START',
    'CLAUDE_DEPLOY_PROMPT_END',
    'mapfile -t packages',
    'ZIP_PATH="${packages[0]}"',
    'sudo bash install-vps.sh --force',
    'docker compose --env-file /opt/sub2api-deploy/.env -f /opt/sub2api-deploy/docker-compose.production.yml ps',
    'curl -fsS http://127.0.0.1:8080/health',
    'curl -fsS http://127.0.0.1:8080/api/v1/settings/public',
    'Do not print .env, API Key, Cookie, OAuth Token, database password, upstream credentials, or any secret value.'
)

Assert-FileNotContains $claudeDoc @(
    'YYYYMMDDTHHMMSSZ',
    'sub2api-vps-migration-YYYY'
)

Assert-FileContains $readme @(
    'ops/export-vps-migration-package.ps1',
    'ops/install-vps.sh',
    'VPS_MIGRATION_CN.md',
    'README_CLAUDE_DEPLOY_CN.md'
)

Assert-FileContains $gitignore @(
    'migration-packages/',
    'sub2api-vps-migration-*.zip'
)

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "sub2api-vps-migration-test-$([guid]::NewGuid().ToString('N'))"
$fixtureDeploy = Join-Path $tempRoot 'deploy'
$fixtureData = Join-Path $fixtureDeploy 'source-windows/data'
$packageOutput = Join-Path $tempRoot 'packages'
$extractDir = Join-Path $tempRoot 'extract'

try {
    New-Item -ItemType Directory -Force -Path $fixtureData, $packageOutput, $extractDir | Out-Null
    Set-Content -LiteralPath (Join-Path $fixtureData 'sentinel.txt') -Value 'fixture-data' -Encoding utf8
    Copy-Item -LiteralPath (Join-Path $DeployDir 'docker-compose.production.yml') -Destination (Join-Path $fixtureDeploy 'docker-compose.production.yml') -Force
    Copy-Item -LiteralPath $claudeDoc -Destination (Join-Path $fixtureDeploy 'README_CLAUDE_DEPLOY_CN.md') -Force
    Copy-Item -LiteralPath $doc -Destination (Join-Path $fixtureDeploy 'VPS_MIGRATION_CN.md') -Force

    @'
DATA_DIR=deploy/source-windows/data
RUN_MODE=standard
TZ=Asia/Shanghai
SERVER_FRONTEND_URL=https://old.example.test
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=fake-postgres-password
DATABASE_DBNAME=sub2api
REDIS_PASSWORD=
REDIS_DB=0
ADMIN_EMAIL=admin@example.test
JWT_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
JWT_EXPIRE_HOUR=24
TOTP_ENCRYPTION_KEY=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789
SECURITY_URL_ALLOWLIST_ENABLED=true
SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP=true
SECURITY_URL_ALLOWLIST_ALLOW_PRIVATE_HOSTS=true
SECURITY_URL_ALLOWLIST_UPSTREAM_HOSTS=api.openai.com
'@ | Set-Content -LiteralPath (Join-Path $fixtureDeploy 'source-windows.env') -Encoding utf8

    $packagePath = & $exportScript `
        -DeployDir $fixtureDeploy `
        -EnvFile 'source-windows.env' `
        -OutputDir $packageOutput `
        -Domain 'wawazz.xyz' `
        -ExtraDomains @('api.wawazz.xyz') `
        -Image 'example/sub2api:test' `
        -SkipDatabaseDump

    if (-not (Test-Path -LiteralPath $packagePath)) {
        throw "Expected package missing: $packagePath"
    }

    Expand-Archive -LiteralPath $packagePath -DestinationPath $extractDir -Force
    $packageRoot = Get-ChildItem -LiteralPath $extractDir -Directory | Select-Object -First 1
    if ($null -eq $packageRoot) {
        throw 'Expanded migration package root directory was not found.'
    }

    foreach ($required in @('README_CLAUDE_DEPLOY_CN.md', 'VPS_MIGRATION_CN.md', 'postgres.dump', 'source-windows.env', '.env', 'data', 'docker-compose.production.yml', 'Caddyfile', 'install-vps.sh', 'manifest.json', 'SHA256SUMS')) {
        $requiredPath = Join-Path $packageRoot.FullName $required
        if (-not (Test-Path -LiteralPath $requiredPath)) {
            throw "Package missing required item: $required"
        }
    }

    Assert-FileContains (Join-Path $packageRoot.FullName '.env') @(
        'SUB2API_IMAGE=example/sub2api:test',
        'SERVER_FRONTEND_URL=https://wawazz.xyz',
        'POSTGRES_USER=postgres',
        'POSTGRES_PASSWORD=fake-postgres-password',
        'JWT_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        'TOTP_ENCRYPTION_KEY=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        'SECURITY_URL_ALLOWLIST_ENABLED=false'
    )
    Assert-FileContains (Join-Path $packageRoot.FullName 'Caddyfile') @(
        'wawazz.xyz, api.wawazz.xyz',
        'reverse_proxy 127.0.0.1:8080'
    )
    Assert-FileContains (Join-Path $packageRoot.FullName 'SHA256SUMS') @(
        'postgres.dump',
        'README_CLAUDE_DEPLOY_CN.md',
        'VPS_MIGRATION_CN.md',
        'source-windows.env',
        'data/sentinel.txt',
        'install-vps.sh'
    )

    $manifest = Get-Content -LiteralPath (Join-Path $packageRoot.FullName 'manifest.json') -Raw | ConvertFrom-Json
    if ($manifest.domain -ne 'wawazz.xyz') {
        throw "Unexpected manifest domain: $($manifest.domain)"
    }
    if ($manifest.target -ne 'Ubuntu 22.04/24.04 + Docker Compose + Caddy') {
        throw "Unexpected manifest target: $($manifest.target)"
    }
} finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Output 'VPS migration package checks passed.'
