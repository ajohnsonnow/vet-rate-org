# CAVC Archive Mass Downloader - PowerShell Version
# Downloads ALL CAVC precedential opinions from 1989-2006

$ErrorActionPreference = "Continue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$downloadDir = "E:\VS_Studio\vet-rate-org-official\llm-compiler\knowledge-base\cavc\archives"
if (-not (Test-Path $downloadDir)) {
    New-Item -ItemType Directory -Path $downloadDir -Force | Out-Null
}

Write-Host "================================================================================"
Write-Host "CAVC ARCHIVE MASS DOWNLOADER"
Write-Host "================================================================================"
Write-Host "Download Directory: $downloadDir"
Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# Panel Decisions (PRECEDENTIAL - HIGHEST VALUE)
$panelArchives = @{
    "1989-2006" = "https://www.uscourts.cavc.gov/documents/panel_decisions_1989-2006.zip"
    "2006" = "https://www.uscourts.cavc.gov/documents/OpinionPanel2006.zip"
    "2005" = "https://www.uscourts.cavc.gov/documents/OpinionsPanel2005.zip"
    "2004" = "https://www.uscourts.cavc.gov/documents/OpinionsPanel2004.zip"
    "2003" = "https://www.uscourts.cavc.gov/documents/OpinionsPanel2003.zip"
    "2002" = "https://www.uscourts.cavc.gov/documents/OpinionsPanel2002.zip"
    "2001" = "https://www.uscourts.cavc.gov/documents/OpinionsPanel2001.zip"
    "2000" = "https://www.uscourts.cavc.gov/documents/OpinionPanel20001.zip"
    "1999" = "https://www.uscourts.cavc.gov/documents/OpinionsPanel19992.zip"
    "1998" = "https://www.uscourts.cavc.gov/documents/OpinionsPanel19982.zip"
    "1997" = "https://www.uscourts.cavc.gov/documents/OpninionPanel1997.zip"
    "1996" = "https://www.uscourts.cavc.gov/documents/Panl1996.zip"
    "1995" = "https://www.uscourts.cavc.gov/documents/OpinionPanel1995.zip"
    "1994" = "https://www.uscourts.cavc.gov/documents/OpinionPanel1994.zip"
    "1993" = "https://www.uscourts.cavc.gov/documents/93.zip"
    "1992" = "https://www.uscourts.cavc.gov/documents/OpinionPanel1992.zip"
    "1991" = "https://www.uscourts.cavc.gov/documents/OpinionPanel1991.zip"
    "1990" = "https://www.uscourts.cavc.gov/documents/OpinionPanel1990.zip"
    "1989" = "https://www.uscourts.cavc.gov/documents/89.zip"
}

# Single Judge Decisions
$singleArchives = @{
    "1989-2000" = "https://www.uscourts.cavc.gov/documents/single_all2.zip"
    "2000" = "https://www.uscourts.cavc.gov/documents/sngl20002.zip"
    "1999" = "https://www.uscourts.cavc.gov/documents/sngl19991.zip"
    "1998" = "https://www.uscourts.cavc.gov/documents/Sngl19981.zip"
    "1994" = "https://www.uscourts.cavc.gov/documents/Sngl1994.zip"
    "1993" = "https://www.uscourts.cavc.gov/documents/Sngl1993.zip"
    "1992" = "https://www.uscourts.cavc.gov/documents/Sngl1992.zip"
    "1991" = "https://www.uscourts.cavc.gov/documents/Sngl1991.zip"
    "1990" = "https://www.uscourts.cavc.gov/documents/Sngl1990.zip"
}

$stats = @{
    total = 0
    downloaded = 0
    skipped = 0
    failed = 0
    totalMB = 0
}

Write-Host "================================================================================"
Write-Host "DOWNLOADING PANEL DECISIONS (PRECEDENTIAL OPINIONS)"
Write-Host "================================================================================"
Write-Host ""

foreach ($year in ($panelArchives.Keys | Sort-Object)) {
    $url = $panelArchives[$year]
    $filename = "panel_$year.zip"
    $filepath = Join-Path $downloadDir $filename
    
    $stats.total++
    
    # Skip if exists
    if (Test-Path $filepath) {
        $sizeMB = [math]::Round((Get-Item $filepath).Length / 1MB, 2)
        Write-Host "SKIP: $filename already exists ($sizeMB MB)"
        $stats.skipped++
        $stats.totalMB += $sizeMB
        continue
    }
    
    Write-Host "Downloading: Panel Decisions $year"
    Write-Host "  URL: $url"
    Write-Host "  File: $filename"
    
    try {
        Invoke-WebRequest -Uri $url -OutFile $filepath -UseBasicParsing -TimeoutSec 300
        $sizeMB = [math]::Round((Get-Item $filepath).Length / 1MB, 2)
        Write-Host "  SUCCESS! Downloaded: $sizeMB MB" -ForegroundColor Green
        $stats.downloaded++
        $stats.totalMB += $sizeMB
    } catch {
        Write-Host "  FAILED: $_" -ForegroundColor Red
        $stats.failed++
    }
    
    Write-Host ""
    Start-Sleep -Seconds 1
}

Write-Host "================================================================================"
Write-Host "DOWNLOADING SINGLE JUDGE DECISIONS"
Write-Host "================================================================================"
Write-Host ""

foreach ($year in ($singleArchives.Keys | Sort-Object)) {
    $url = $singleArchives[$year]
    $filename = "single_$year.zip"
    $filepath = Join-Path $downloadDir $filename
    
    $stats.total++
    
    # Skip if exists
    if (Test-Path $filepath) {
        $sizeMB = [math]::Round((Get-Item $filepath).Length / 1MB, 2)
        Write-Host "SKIP: $filename already exists ($sizeMB MB)"
        $stats.skipped++
        $stats.totalMB += $sizeMB
        continue
    }
    
    Write-Host "Downloading: Single Judge Decisions $year"
    Write-Host "  URL: $url"
    Write-Host "  File: $filename"
    
    try {
        Invoke-WebRequest -Uri $url -OutFile $filepath -UseBasicParsing -TimeoutSec 300
        $sizeMB = [math]::Round((Get-Item $filepath).Length / 1MB, 2)
        Write-Host "  SUCCESS! Downloaded: $sizeMB MB" -ForegroundColor Green
        $stats.downloaded++
        $stats.totalMB += $sizeMB
    } catch {
        Write-Host "  FAILED: $_" -ForegroundColor Red
        $stats.failed++
    }
    
    Write-Host ""
    Start-Sleep -Seconds 1
}

Write-Host "================================================================================"
Write-Host "DOWNLOAD SUMMARY"
Write-Host "================================================================================"
Write-Host "Total Files: $($stats.total)"
Write-Host "Downloaded: $($stats.downloaded)"
Write-Host "Skipped: $($stats.skipped)"
Write-Host "Failed: $($stats.failed)"
Write-Host "Total Size: $([math]::Round($stats.totalMB, 2)) MB"
Write-Host ""
Write-Host "All files in: $downloadDir"
Write-Host "Completed: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "================================================================================"
