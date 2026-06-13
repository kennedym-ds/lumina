<#
.SYNOPSIS
    Build the Lumina FastAPI backend sidecar using PyInstaller.

.DESCRIPTION
    Creates a clean build-only Python virtual environment in backend/.venv-build,
    installs runtime dependencies + PyInstaller, builds via lumina-backend.spec,
    and stages the output in src-tauri/binaries for Tauri sidecar packaging.
#>

param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $repoRoot "backend"
$buildVenvPath = Join-Path $backendRoot ".venv-build"
$specPath = Join-Path $backendRoot "lumina-backend.spec"
$requirementsPath = Join-Path $backendRoot "requirements.txt"

$pyInstallerBuildPath = Join-Path $backendRoot "build"
$pyInstallerDistPath = Join-Path $backendRoot "dist"

# --onedir output: backend/dist/lumina-backend/ (lumina-backend.exe + _internal/).
# Staged as a Tauri resource folder, not an externalBin single file.
$distBackendDir = Join-Path $pyInstallerDistPath "lumina-backend"
$distExePath = Join-Path $distBackendDir "lumina-backend.exe"
$sidecarStageRoot = Join-Path $repoRoot "src-tauri\sidecar"
$finalBackendDir = Join-Path $sidecarStageRoot "lumina-backend"

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[OK]   $Message" -ForegroundColor Green
}

function Remove-PathIfExists {
    param([string]$Path)

    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

if (-not (Test-Path -LiteralPath $specPath)) {
    throw "PyInstaller spec file not found: $specPath"
}

if ($Clean) {
    Write-Info "-Clean enabled: removing previous PyInstaller artifacts and staged binaries"
    Remove-PathIfExists -Path $pyInstallerBuildPath
    Remove-PathIfExists -Path $pyInstallerDistPath
    Remove-PathIfExists -Path $finalBackendDir
}

Write-Info "Recreating clean build virtual environment at $buildVenvPath"
Remove-PathIfExists -Path $buildVenvPath

if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3.11 -m venv $buildVenvPath
}
else {
    & python -m venv $buildVenvPath
}

$pythonExe = Join-Path $buildVenvPath "Scripts\python.exe"
if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw "Build venv python executable not found: $pythonExe"
}

Write-Info "Installing backend dependencies and PyInstaller"
& $pythonExe -m pip install --upgrade pip
& $pythonExe -m pip install -r $requirementsPath
& $pythonExe -m pip install "pyinstaller>=6,<7"

Write-Info "Running PyInstaller spec build"
Push-Location $backendRoot
try {
    & $pythonExe -m PyInstaller --noconfirm --clean $specPath
}
finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $distExePath)) {
    throw "Expected PyInstaller output not found: $distExePath"
}

Write-Info "Staging onedir sidecar to Tauri resource directory"
if (-not (Test-Path -LiteralPath $sidecarStageRoot)) {
    New-Item -ItemType Directory -Path $sidecarStageRoot | Out-Null
}

Remove-PathIfExists -Path $finalBackendDir
Copy-Item -Path $distBackendDir -Destination $finalBackendDir -Recurse

$sizeMiB = [math]::Round(
    ((Get-ChildItem -LiteralPath $finalBackendDir -Recurse -File |
        Measure-Object -Property Length -Sum).Sum) / 1MB, 2)
Write-Ok "Sidecar staged at: $finalBackendDir ($sizeMiB MiB)"
