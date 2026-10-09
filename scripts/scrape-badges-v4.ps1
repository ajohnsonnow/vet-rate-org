# Military Badge Image Scraper v4 - Remaining Items with Longer Delays
# Downloads remaining badge SVGs from Wikimedia Commons

$ErrorActionPreference = "Continue"

$BadgesDir = "E:\VS_Studio\vet-rate-org-official\public\images\badges"
$TabsDir = "E:\VS_Studio\vet-rate-org-official\public\images\tabs"

Write-Host "================================================================"
Write-Host "       MILITARY BADGE SCRAPER v4 - Remaining Items              "
Write-Host "================================================================"

function Get-WikimediaFileUrl {
    param([string]$SearchTerm)
    
    $searchUrl = "https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=$([Uri]::EscapeDataString($SearchTerm))&srnamespace=6&srlimit=10&format=json"
    
    try {
        $searchResult = Invoke-RestMethod -Uri $searchUrl -UserAgent "VetRate.org/1.0 Educational"
        
        foreach ($file in $searchResult.query.search) {
            $title = $file.title
            
            if (-not ($title -match "\.svg$")) {
                continue
            }
            
            $fileUrl = "https://commons.wikimedia.org/w/api.php?action=query&titles=$([Uri]::EscapeDataString($title))&prop=imageinfo&iiprop=url&format=json"
            $fileResult = Invoke-RestMethod -Uri $fileUrl -UserAgent "VetRate.org/1.0 Educational"
            
            foreach ($page in $fileResult.query.pages.PSObject.Properties) {
                if ($page.Value.imageinfo) {
                    return @{
                        Title = $title
                        Url = $page.Value.imageinfo[0].url
                    }
                }
            }
        }
    }
    catch {
        Write-Host "      API Error: $($_.Exception.Message)"
    }
    
    return $null
}

function Download-Badge {
    param(
        [string]$LocalName,
        [string]$SearchTerm,
        [string]$OutputDir,
        [int]$Index,
        [int]$Total
    )
    
    Write-Host "[$Index/$Total] $LocalName"
    Write-Host "   Searching: $SearchTerm"
    
    $outputPath = Join-Path $OutputDir "$LocalName.svg"
    
    if ((Test-Path $outputPath) -and (Get-Item $outputPath).Length -gt 500) {
        $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1024, 1)
        Write-Host "   [SKIP] Already exists - $sizeKB KB"
        return "skip"
    }
    
    $fileInfo = Get-WikimediaFileUrl -SearchTerm $SearchTerm
    
    if ($fileInfo -eq $null) {
        Write-Host "   [FAIL] No SVG found on Wikimedia"
        return "fail"
    }
    
    Write-Host "   Found: $($fileInfo.Title)"
    Write-Host "   Downloading..."
    
    try {
        Invoke-WebRequest -Uri $fileInfo.Url -OutFile $outputPath -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) VetRate.org/1.0" -TimeoutSec 60 -ErrorAction Stop
        
        if ((Test-Path $outputPath) -and (Get-Item $outputPath).Length -gt 100) {
            $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1024, 1)
            Write-Host "   [OK] Saved - $sizeKB KB"
            return "ok"
        } else {
            Write-Host "   [FAIL] File too small or empty"
            Remove-Item $outputPath -ErrorAction SilentlyContinue
            return "fail"
        }
    }
    catch {
        Write-Host "   [FAIL] Download error: $($_.Exception.Message)"
        Remove-Item $outputPath -ErrorAction SilentlyContinue
        return "fail"
    }
}

# Remaining badges - only download if not already present
$RemainingBadges = @(
    @{ Name = "surface-warfare-officer"; Search = "Surface Warfare insignia US Navy svg" },
    @{ Name = "enlisted-surface-warfare"; Search = "Enlisted Surface Warfare svg" },
    @{ Name = "submarine-warfare"; Search = "Submarine Dolphin insignia US Navy svg" },
    @{ Name = "naval-aviator"; Search = "Navy Wings Aviator svg" },
    @{ Name = "navy-seal-trident"; Search = "US Navy SEAL Trident svg" },
    @{ Name = "senior-pilot"; Search = "Senior Pilot Wings Air Force svg" },
    @{ Name = "pilot-wings"; Search = "Pilot Wings Air Force svg" },
    @{ Name = "combat-controller"; Search = "Combat Control Team USAF badge svg" },
    @{ Name = "pararescue"; Search = "Pararescue PJ badge svg" },
    @{ Name = "space-operations"; Search = "Space Operations Badge USSF svg" },
    @{ Name = "cutterman"; Search = "Cutterman Coast Guard svg" },
    @{ Name = "rescue-swimmer"; Search = "Rescue Swimmer badge svg" },
    @{ Name = "expert-marksman"; Search = "Expert rifle qual badge US Army svg" },
    @{ Name = "sharpshooter"; Search = "Sharpshooter qual badge US Army svg" },
    @{ Name = "marksman"; Search = "Marksman qual badge Army svg" },
    @{ Name = "driver-mechanic"; Search = "Driver Mechanic Badge US Army svg" }
)

$RemainingTabs = @(
    @{ Name = "special-forces-tab"; Search = "Special Forces Tab US Army svg" },
    @{ Name = "sapper-tab"; Search = "Sapper Tab US Army svg" },
    @{ Name = "mountain-tab"; Search = "Mountain Tab 10th Mountain svg" }
)

$Success = 0
$Skipped = 0
$Failed = 0

Write-Host ""
Write-Host "DOWNLOADING REMAINING BADGES (3 second delay between requests)..."
Write-Host ""

$i = 0
$total = $RemainingBadges.Count
foreach ($badge in $RemainingBadges) {
    $i++
    $result = Download-Badge -LocalName $badge.Name -SearchTerm $badge.Search -OutputDir $BadgesDir -Index $i -Total $total
    
    switch ($result) {
        "ok" { $Success++ }
        "skip" { $Skipped++ }
        "fail" { $Failed++ }
    }
    
    # 3 second delay to avoid rate limiting
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "DOWNLOADING REMAINING TABS..."
Write-Host ""

$i = 0
$total = $RemainingTabs.Count
foreach ($tab in $RemainingTabs) {
    $i++
    $result = Download-Badge -LocalName $tab.Name -SearchTerm $tab.Search -OutputDir $TabsDir -Index $i -Total $total
    
    switch ($result) {
        "ok" { $Success++ }
        "skip" { $Skipped++ }
        "fail" { $Failed++ }
    }
    
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "================================================================"
Write-Host "                    SUMMARY                                     "
Write-Host "================================================================"
Write-Host ""
Write-Host "New downloads: $Success"
Write-Host "Skipped: $Skipped"
Write-Host "Failed: $Failed"

Write-Host ""
Write-Host "All badge files:"
Get-ChildItem $BadgesDir -Filter "*.svg" | ForEach-Object {
    $sizeKB = [math]::Round($_.Length / 1024, 1)
    Write-Host "   $($_.Name) - $sizeKB KB"
}

Write-Host ""
Write-Host "All tab files:"
Get-ChildItem $TabsDir -Filter "*.svg" | ForEach-Object {
    $sizeKB = [math]::Round($_.Length / 1024, 1)
    Write-Host "   $($_.Name) - $sizeKB KB"
}
