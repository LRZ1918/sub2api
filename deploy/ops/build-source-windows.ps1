[CmdletBinding()]
param(
    [string]$RepoDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$OutputDir = '',
    [string]$GoBin = 'go',
    [switch]$SkipFrontend
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoDir = (Resolve-Path -LiteralPath $RepoDir).Path
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $RepoDir 'deploy\source-windows'
} elseif (-not [System.IO.Path]::IsPathRooted($OutputDir)) {
    $OutputDir = Join-Path $RepoDir $OutputDir
}

$frontendDir = Join-Path $RepoDir 'frontend'
$backendDir = Join-Path $RepoDir 'backend'
$outputExe = Join-Path $OutputDir 'sub2api.exe'

if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
    throw 'corepack is required to build the frontend. Install Node.js with Corepack enabled.'
}
if (-not (Get-Command $GoBin -ErrorAction SilentlyContinue)) {
    throw "Go command not found: $GoBin"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

if (-not $SkipFrontend) {
    Push-Location $frontendDir
    try {
        & corepack pnpm install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) {
            throw "pnpm install failed with exit code $LASTEXITCODE"
        }
        & corepack pnpm run build
        if ($LASTEXITCODE -ne 0) {
            throw "frontend build failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

Push-Location $backendDir
try {
    & $GoBin build -tags embed -o $outputExe .\cmd\server
    if ($LASTEXITCODE -ne 0) {
        throw "go build failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

Write-Output $outputExe
