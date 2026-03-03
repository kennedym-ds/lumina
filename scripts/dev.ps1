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
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host "[lumina] Starting development environment..." -ForegroundColor Cyan

# Start backend in background
Write-Host "[lumina] Starting backend on 127.0.0.1:$Port" -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($root, $port, $token)
    Set-Location "$root/backend"
    & python -m uvicorn app.main:app --host 127.0.0.1 --port $port --reload
} -ArgumentList $Root, $Port, $Token

Write-Host "[lumina] Backend PID: $($backendJob.Id)" -ForegroundColor Gray

# Wait for backend to start
Start-Sleep -Seconds 3

# Start Tauri dev
Write-Host "[lumina] Starting Tauri dev..." -ForegroundColor Yellow
Set-Location $Root
npm run tauri dev

# Cleanup on exit
Write-Host "[lumina] Shutting down backend..." -ForegroundColor Yellow
Stop-Job $backendJob -ErrorAction SilentlyContinue
Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
Write-Host "[lumina] Done." -ForegroundColor Green