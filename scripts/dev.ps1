<#
.SYNOPSIS
    Start the Lumina development environment.
.DESCRIPTION
    Starts the FastAPI backend and then launches Tauri in dev mode.
    The backend runs on port 8089 with a dev token for local development.
#>

param(
    [int]$Port = 8089,
    [string]$Token = "dev-token"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$BackendPython = Join-Path $Root "backend\.venv\Scripts\python.exe"
$NodeExe = (Get-Command node -ErrorAction Stop).Source
$NodeDir = Split-Path -Parent $NodeExe
$NpmCmd = Join-Path $NodeDir "npm.cmd"
$CleanPath = (($env:Path -split ';') | ForEach-Object { $_.Trim('"') } | Where-Object { $_ }) -join ';'
$env:Path = "$NodeDir;$CleanPath"

if (-not (Test-Path -LiteralPath $BackendPython)) {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $BackendPython = "python"
    }
    else {
        throw "Backend Python was not found. Create backend/.venv or install Python on PATH."
    }
}

Write-Host "[lumina] Starting development environment..." -ForegroundColor Cyan

# Start backend in background
Write-Host "[lumina] Starting backend on 127.0.0.1:$Port" -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($root, $pythonExe, $port, $token)
    Set-Location (Join-Path $root "backend")
    & $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port $port --reload
} -ArgumentList $Root, $BackendPython, $Port, $Token

Write-Host "[lumina] Backend PID: $($backendJob.Id)" -ForegroundColor Gray

# Wait for backend to start
Start-Sleep -Seconds 3

# Start Tauri dev
Write-Host "[lumina] Starting Tauri dev..." -ForegroundColor Yellow
Set-Location $Root
& $NpmCmd run tauri dev

# Cleanup on exit
Write-Host "[lumina] Shutting down backend..." -ForegroundColor Yellow
Stop-Job $backendJob -ErrorAction SilentlyContinue
Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
Write-Host "[lumina] Done." -ForegroundColor Green