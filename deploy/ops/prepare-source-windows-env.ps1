[CmdletBinding()]
param(
    [string]$DeployDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$ExampleFile = 'source-windows.env.example',
    [string]$EnvFile = 'source-windows.env',
    [string]$FrontendUrl = '',
    [string]$AdminEmail = '',
    [string]$PostgresPassword = '',
    [switch]$Force
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

function New-Sub2ApiSecret {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return (-join ($bytes | ForEach-Object { $_.ToString('x2') }))
}

$DeployDir = (Resolve-Path -LiteralPath $DeployDir).Path
$examplePath = Resolve-DeployPath $ExampleFile
$envPath = Resolve-DeployPath $EnvFile

if (-not (Test-Path -LiteralPath $examplePath)) {
    throw "Example file not found: $examplePath"
}
if ((Test-Path -LiteralPath $envPath) -and -not $Force) {
    throw "Environment file already exists: $envPath. Re-run with -Force to overwrite it."
}

if ([string]::IsNullOrWhiteSpace($PostgresPassword)) {
    $PostgresPassword = New-Sub2ApiSecret
}

$content = Get-Content -LiteralPath $examplePath -Raw
$content = $content -replace 'DATABASE_PASSWORD=CHANGE_ME_POSTGRES_PASSWORD', "DATABASE_PASSWORD=$PostgresPassword"
$content = $content -replace 'JWT_SECRET=CHANGE_ME_GENERATE_RANDOM_32_BYTES', "JWT_SECRET=$(New-Sub2ApiSecret)"
$content = $content -replace 'TOTP_ENCRYPTION_KEY=CHANGE_ME_GENERATE_RANDOM_32_BYTES', "TOTP_ENCRYPTION_KEY=$(New-Sub2ApiSecret)"

if (-not [string]::IsNullOrWhiteSpace($FrontendUrl)) {
    $content = $content -replace 'SERVER_FRONTEND_URL=https://your-public-domain.example', "SERVER_FRONTEND_URL=$FrontendUrl"
}
if (-not [string]::IsNullOrWhiteSpace($AdminEmail)) {
    $content = $content -replace 'ADMIN_EMAIL=admin@example.com', "ADMIN_EMAIL=$AdminEmail"
}

Set-Content -LiteralPath $envPath -Value $content -Encoding UTF8
Write-Output "Created $envPath"
Write-Output 'Review DATABASE_PASSWORD, SERVER_FRONTEND_URL, ADMIN_EMAIL, and ADMIN_PASSWORD before starting Sub2API.'
