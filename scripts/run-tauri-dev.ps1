<#
.SYNOPSIS
    Launch Lumina Tauri development mode.
.DESCRIPTION
    Normalizes PATH so npm and nested Node-based shims resolve correctly in
    VS Code terminals, then starts `npm run tauri dev` from the repository root.
#>

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$NodeExe = (Get-Command node -ErrorAction Stop).Source
$NodeDir = Split-Path -Parent $NodeExe
$NpmCmd = Join-Path $NodeDir "npm.cmd"
$CleanPath = (($env:Path -split ';') | ForEach-Object { $_.Trim('"') } | Where-Object { $_ }) -join ';'

$env:Path = "$NodeDir;$CleanPath"

Write-Host "[lumina] Starting Tauri dev..." -ForegroundColor Yellow
Set-Location $Root
& $NpmCmd run tauri dev
