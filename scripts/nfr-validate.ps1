<#
.SYNOPSIS
    Validate Lumina non-functional requirements on Windows.

.DESCRIPTION
    Runs automated checks for startup time, CSV import latency, localhost binding,
    and installer bundle size. Can optionally run a full Tauri build first.
#>

param(
    [switch]$SkipBuild,
    [int]$Port = 8089
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Net.Http

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $repoRoot "backend"
$pythonExe = Join-Path $backendRoot ".venv\Scripts\python.exe"
$buildTauriScript = Join-Path $PSScriptRoot "build-tauri.ps1"
$bundleRoot = Join-Path $repoRoot "src-tauri\target\release\bundle"

$healthThresholdMs = 8000
$csvThresholdMs = 3000
$installerThresholdBytes = 350MB
$healthUrl = "http://127.0.0.1:$Port/api/health"
$uploadUrl = "http://127.0.0.1:$Port/api/data/upload"

$results = New-Object System.Collections.Generic.List[object]
$backendProcess = $null
$tempCsvPath = $null

function Add-Result {
    param(
        [string]$Check,
        [ValidateSet("PASS", "FAIL", "SKIP")]
        [string]$Status,
        [string]$Metric,
        [string]$Threshold,
        [string]$Details
    )

    $results.Add([PSCustomObject]@{
        Check = $Check
        Status = $Status
        Metric = $Metric
        Threshold = $Threshold
        Details = $Details
    }) | Out-Null
}

function New-SyntheticCsv {
    param([string]$OutputPath)

    $writer = New-Object System.IO.StreamWriter($OutputPath, $false, [System.Text.Encoding]::UTF8)
    try {
        $writer.WriteLine("id,value1,value2,category")
        for ($i = 1; $i -le 100000; $i++) {
            $category = "cat{0}" -f ($i % 10)
            $value1 = $i % 1000
            $value2 = [math]::Round($i * 1.25, 4)
            $writer.WriteLine(("{0},{1},{2},{3}" -f $i, $value1, $value2, $category))
        }
    }
    finally {
        $writer.Dispose()
    }
}

function Measure-HealthStartup {
    param([string]$Url)

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt 20) {
        try {
            $response = Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec 2
            if ($response.status -eq "ok") {
                $stopwatch.Stop()
                return [PSCustomObject]@{
                    Ready = $true
                    ElapsedMs = [int][math]::Round($stopwatch.Elapsed.TotalMilliseconds, 0)
                }
            }
        }
        catch {
            Start-Sleep -Milliseconds 250
        }
    }

    $stopwatch.Stop()
    return [PSCustomObject]@{
        Ready = $false
        ElapsedMs = [int][math]::Round($stopwatch.Elapsed.TotalMilliseconds, 0)
    }
}

function Get-ListeningAddresses {
    param([int]$ListenPort)

    try {
        $connections = Get-NetTCPConnection -State Listen -LocalPort $ListenPort -ErrorAction Stop
        return @($connections | Select-Object -ExpandProperty LocalAddress -Unique)
    }
    catch {
        $addresses = @()
        $netstatLines = netstat -ano -p tcp | Select-String -Pattern (":{0}\s" -f $ListenPort)
        foreach ($line in $netstatLines) {
            $parts = ($line.Line -replace "\s+", " ").Trim().Split(" ")
            if ($parts.Length -ge 2) {
                $localAddress = $parts[1]
                if ($localAddress -match "^(?<addr>[^:]+):\d+$") {
                    $addresses += $Matches["addr"]
                }
            }
        }

        return @($addresses | Select-Object -Unique)
    }
}

try {
    if (-not (Test-Path -LiteralPath $pythonExe)) {
        throw "Backend venv python not found: $pythonExe"
    }

    if (-not $SkipBuild) {
        try {
            if (-not (Test-Path -LiteralPath $buildTauriScript)) {
                throw "Build script not found: $buildTauriScript"
            }

            & $buildTauriScript
            Add-Result -Check "Build" -Status "PASS" -Metric "Completed" -Threshold "Required" -Details "Tauri build completed before NFR checks."
        }
        catch {
            Add-Result -Check "Build" -Status "FAIL" -Metric "Failed" -Threshold "Required" -Details $_.Exception.Message
        }
    }
    else {
        Add-Result -Check "Build" -Status "SKIP" -Metric "Skipped" -Threshold "Required" -Details "-SkipBuild switch specified."
    }

    $backendProcess = Start-Process -FilePath $pythonExe -WorkingDirectory $backendRoot -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$Port") -PassThru -WindowStyle Hidden

    $healthProbe = Measure-HealthStartup -Url $healthUrl
    if ($healthProbe.Ready) {
        $healthStatus = if ($healthProbe.ElapsedMs -le $healthThresholdMs) { "PASS" } else { "FAIL" }
        Add-Result -Check "Health endpoint startup" -Status $healthStatus -Metric ("{0} ms" -f $healthProbe.ElapsedMs) -Threshold ("<= {0} ms" -f $healthThresholdMs) -Details "Time to first successful /api/health response."
    }
    else {
        Add-Result -Check "Health endpoint startup" -Status "FAIL" -Metric (">= {0} ms" -f $healthProbe.ElapsedMs) -Threshold ("<= {0} ms" -f $healthThresholdMs) -Details "Backend did not become healthy within startup timeout."
    }

    $addresses = @(Get-ListeningAddresses -ListenPort $Port)
    if ($addresses.Count -eq 0) {
        Add-Result -Check "Localhost binding" -Status "FAIL" -Metric "No listener detected" -Threshold "127.0.0.1 only" -Details "Could not detect active listener on backend port."
    }
    else {
        $hasWildcard = @("0.0.0.0", "::", "[::]") | Where-Object { $addresses -contains $_ }
        $hasLoopback = $addresses -contains "127.0.0.1"
        $bindingPass = $hasLoopback -and (-not $hasWildcard)
        $bindingStatus = if ($bindingPass) { "PASS" } else { "FAIL" }

        Add-Result -Check "Localhost binding" -Status $bindingStatus -Metric ($addresses -join ", ") -Threshold "127.0.0.1 only" -Details "Listener addresses detected for backend port."
    }

    $tempCsvPath = Join-Path $env:TEMP ("lumina-nfr-{0}.csv" -f ([guid]::NewGuid().ToString("N")))
    New-SyntheticCsv -OutputPath $tempCsvPath

    $httpClient = New-Object System.Net.Http.HttpClient
    $multipart = New-Object System.Net.Http.MultipartFormDataContent
    $fileStream = [System.IO.File]::OpenRead($tempCsvPath)
    $streamContent = New-Object System.Net.Http.StreamContent($fileStream)
    $streamContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("text/csv")
    $multipart.Add($streamContent, "file", "nfr-100k.csv")

    try {
        $uploadStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = $httpClient.PostAsync($uploadUrl, $multipart).GetAwaiter().GetResult()
        $uploadStopwatch.Stop()

        $uploadMs = [int][math]::Round($uploadStopwatch.Elapsed.TotalMilliseconds, 0)
        $uploadStatus = if ($response.IsSuccessStatusCode -and $uploadMs -le $csvThresholdMs) { "PASS" } else { "FAIL" }

        $responseBody = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $details = "HTTP {0}" -f [int]$response.StatusCode
        if ($response.IsSuccessStatusCode) {
            try {
                $payload = $responseBody | ConvertFrom-Json
                $details = "HTTP {0}; dataset_id={1}; rows={2}" -f [int]$response.StatusCode, $payload.dataset_id, $payload.row_count
            }
            catch {
                $details = "HTTP {0}; response parse warning" -f [int]$response.StatusCode
            }
        }

        Add-Result -Check "CSV import (100K rows)" -Status $uploadStatus -Metric ("{0} ms" -f $uploadMs) -Threshold ("<= {0} ms" -f $csvThresholdMs) -Details $details
    }
    finally {
        $streamContent.Dispose()
        $fileStream.Dispose()
        $multipart.Dispose()
        $httpClient.Dispose()
    }

    if (Test-Path -LiteralPath $bundleRoot) {
        $bundleSizeBytes = (Get-ChildItem -Path $bundleRoot -Recurse -File | Measure-Object -Property Length -Sum).Sum
        if ($null -eq $bundleSizeBytes) {
            $bundleSizeBytes = 0
        }

        $bundleSizeMiB = [math]::Round($bundleSizeBytes / 1MB, 2)
        $sizeStatus = if ($bundleSizeBytes -le $installerThresholdBytes) { "PASS" } else { "FAIL" }

        Add-Result -Check "Installer size" -Status $sizeStatus -Metric ("{0} MiB" -f $bundleSizeMiB) -Threshold "<= 350 MiB" -Details "Total size of src-tauri/target/release/bundle/."
    }
    else {
        Add-Result -Check "Installer size" -Status "SKIP" -Metric "Not built" -Threshold "<= 350 MiB" -Details "Bundle directory not found."
    }
}
finally {
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force
    }

    if ($tempCsvPath -and (Test-Path -LiteralPath $tempCsvPath)) {
        Remove-Item -LiteralPath $tempCsvPath -Force
    }
}

$results | Format-Table -AutoSize

$hasFailures = @($results | Where-Object { $_.Status -eq "FAIL" }).Count -gt 0
if ($hasFailures) {
    Write-Host "[FAIL] One or more NFR checks failed." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] All NFR checks passed or were explicitly skipped." -ForegroundColor Green
exit 0
