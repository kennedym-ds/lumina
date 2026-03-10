<#
.SYNOPSIS
    Build Lumina desktop installers with the Tauri bundler.

.DESCRIPTION
    Optionally builds the backend sidecar, installs frontend dependencies,
    runs `npm run tauri build`, and reports produced installer paths and sizes.
#>

param(
    [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$buildBackendScript = Join-Path $PSScriptRoot "build-backend.ps1"
$sidecarDir = Join-Path $repoRoot "src-tauri\binaries\lumina-backend-x86_64-pc-windows-msvc"
$sidecarExe = Join-Path $sidecarDir "lumina-backend-x86_64-pc-windows-msvc.exe"
$bundleRoot = Join-Path $repoRoot "src-tauri\target\release\bundle"

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[OK]   $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

if (-not $SkipBackend) {
    if (-not (Test-Path -LiteralPath $buildBackendScript)) {
        throw "Backend build script not found: $buildBackendScript"
    }

    Write-Info "Building backend sidecar with scripts/build-backend.ps1"
    & $buildBackendScript
}
else {
    Write-Info "-SkipBackend enabled; skipping backend sidecar build"
}

if (-not (Test-Path -LiteralPath $sidecarExe)) {
    throw "Sidecar executable not found: $sidecarExe. Build the backend sidecar first."
}

Write-Ok "Verified sidecar executable: $sidecarExe"

Push-Location $repoRoot
try {
    Write-Info "Installing frontend dependencies"
    & npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE"
    }

    Write-Info "Running Tauri production build"
    & npm run tauri build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run tauri build failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $bundleRoot)) {
    throw "Bundle output directory not found: $bundleRoot"
}

$installers = Get-ChildItem -Path $bundleRoot -Recurse -File |
    Where-Object { $_.Extension -in @(".msi", ".exe") } |
    Sort-Object -Property FullName

if (-not $installers -or $installers.Count -eq 0) {
    Write-Warn "No installer artifacts found under $bundleRoot"
    return
}

Write-Ok "Installer artifacts"
foreach ($artifact in $installers) {
    $sizeMiB = [math]::Round($artifact.Length / 1MB, 2)
    Write-Host ("[OK]   {0} ({1} MiB)" -f $artifact.FullName, $sizeMiB) -ForegroundColor Green
}
