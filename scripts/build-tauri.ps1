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
$sidecarExe = Join-Path $repoRoot "src-tauri\sidecar\lumina-backend\lumina-backend.exe"
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

function Initialize-BuildPath {
    # Two PATH hazards on Windows break `tauri build`:
    #   1. npm bin-shims (e.g. node_modules\.bin\tauri.cmd) fall back to invoking a
    #      bare `node`, which npm's script shell cannot always resolve.
    #   2. A malformed PATH entry containing a stray double-quote breaks Rust's
    #      program lookup, so `cargo metadata` reports "program not found".
    # Strip quote-bearing entries and guarantee node + cargo dirs are present.
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) {
        throw "node was not found on PATH. Install Node.js or add it to PATH."
    }
    $nodeDir = Split-Path -Parent $nodeCommand.Source

    $cargoCommand = Get-Command cargo -ErrorAction SilentlyContinue
    $cargoDir = if ($cargoCommand) {
        Split-Path -Parent $cargoCommand.Source
    }
    else {
        Join-Path $env:USERPROFILE ".cargo\bin"
    }

    $existing = $env:PATH -split ';' | Where-Object { $_ -and ($_ -notmatch '"') }
    $env:PATH = (@($nodeDir, $cargoDir) + $existing | Select-Object -Unique) -join ';'

    Write-Info "Build PATH prepared (node: $nodeDir; cargo: $cargoDir)"
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
    Initialize-BuildPath

    Write-Info "Installing frontend dependencies"
    & npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE"
    }

    $tauriCli = Join-Path $repoRoot "node_modules\@tauri-apps\cli\tauri.js"
    if (-not (Test-Path -LiteralPath $tauriCli)) {
        throw "Tauri CLI not found: $tauriCli. Did 'npm install' succeed?"
    }

    # Invoke the Tauri CLI through node directly rather than `npm run tauri`, whose
    # cmd bin-shim cannot reliably resolve node in npm's script shell on Windows.
    Write-Info "Running Tauri production build"
    & node $tauriCli build
    if ($LASTEXITCODE -ne 0) {
        throw "tauri build failed with exit code $LASTEXITCODE"
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
