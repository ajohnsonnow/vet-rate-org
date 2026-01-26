# Military Badge Image Scraper v5 - Direct Wikimedia URLs
# Uses verified direct upload.wikimedia.org paths

$ErrorActionPreference = "Continue"

$BadgesDir = "E:\VS_Studio\vet-rate-org-official\public\images\badges"
$TabsDir = "E:\VS_Studio\vet-rate-org-official\public\images\tabs"

New-Item -ItemType Directory -Force -Path $BadgesDir | Out-Null
New-Item -ItemType Directory -Force -Path $TabsDir | Out-Null

Write-Host "================================================================"
Write-Host "       MILITARY BADGE IMAGE SCRAPER v5                          "
Write-Host "       Direct Wikimedia URLs with Thumbnails                    "
Write-Host "================================================================"

# Using Wikimedia Commons thumbnail API for reliable downloads
# Format: https://upload.wikimedia.org/wikipedia/commons/thumb/[path]/[width]px-[filename]

function Download-WikimediaThumbnail {
    param(
        [string]$LocalName,
        [string]$WikiTitle,
        [string]$OutputDir,
        [int]$Width = 500
    )
    
    Write-Host ""
    Write-Host "Downloading: $LocalName"
    Write-Host "   Wiki: $WikiTitle"
    
    $outputPath = Join-Path $OutputDir "$LocalName.png"
    
    if ((Test-Path $outputPath) -and (Get-Item $outputPath).Length -gt 1000) {
        $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1024, 1)
        Write-Host "   [SKIP] Already exists - $sizeKB KB"
        return "skip"
    }
    
    try {
        # Use Wikimedia Commons API to get thumbnail URL
        $encodedTitle = [Uri]::EscapeDataString("File:$WikiTitle")
        $apiUrl = "https://commons.wikimedia.org/w/api.php?action=query&titles=$encodedTitle&prop=imageinfo&iiprop=url&iiurlwidth=$Width&format=json"
        
        Write-Host "   Querying API..."
        $response = Invoke-RestMethod -Uri $apiUrl -UserAgent "VetRate.org/1.0 (educational; veteran-support)"
        
        $thumbUrl = $null
        foreach ($page in $response.query.pages.PSObject.Properties) {
            if ($page.Value.imageinfo) {
                $thumbUrl = $page.Value.imageinfo[0].thumburl
                break
            }
        }
        
        if (-not $thumbUrl) {
            Write-Host "   [FAIL] No thumbnail URL found"
            return "fail"
        }
        
        Write-Host "   URL: $thumbUrl"
        Write-Host "   Downloading..."
        
        Invoke-WebRequest -Uri $thumbUrl -OutFile $outputPath -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) VetRate.org/1.0" -TimeoutSec 30 -ErrorAction Stop
        
        if ((Test-Path $outputPath) -and (Get-Item $outputPath).Length -gt 500) {
            $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1024, 1)
            Write-Host "   [OK] Saved - $sizeKB KB"
            return "ok"
        } else {
            Write-Host "   [FAIL] File too small"
            Remove-Item $outputPath -ErrorAction SilentlyContinue
            return "fail"
        }
    }
    catch {
        Write-Host "   [FAIL] Error: $($_.Exception.Message)"
        Remove-Item $outputPath -ErrorAction SilentlyContinue
        return "fail"
    }
}

# Verified Wikimedia Commons file names (from Wikipedia badge articles)
$Badges = @(
    @{ Name = "combat-infantryman-badge"; Wiki = "Combat_Infantry_Badge.svg" },
    @{ Name = "combat-action-badge"; Wiki = "Combat_Action_Badge.svg" },
    @{ Name = "combat-medical-badge"; Wiki = "Combat_Medical_Badge,_1st_award.svg" },
    @{ Name = "expert-infantryman-badge"; Wiki = "Expert_Infantry_Badge.svg" },
    @{ Name = "expert-field-medical-badge"; Wiki = "ExpertMedBadge.svg" },
    @{ Name = "expert-soldier-badge"; Wiki = "Expert_Soldier_Badge.svg" },
    @{ Name = "master-parachutist-badge"; Wiki = "Master_Parachutist_badge_(United_States).svg" },
    @{ Name = "senior-parachutist-badge"; Wiki = "Senior_Parachutist_badge_(United_States).svg" },
    @{ Name = "parachutist-badge"; Wiki = "Parachutist_badge_(United_States).svg" },
    @{ Name = "air-assault-badge"; Wiki = "Air_Assault_Badge.svg" },
    @{ Name = "pathfinder-badge"; Wiki = "Pathfinder_Badge.svg" },
    @{ Name = "navy-seal-trident"; Wiki = "United_States_Navy_SEALs_badge.svg" },
    @{ Name = "naval-aviator"; Wiki = "Naval_Aviator_Badge.svg" },
    @{ Name = "surface-warfare-officer"; Wiki = "Surface_Warfare_Officer_Insignia.svg" },
    @{ Name = "enlisted-surface-warfare"; Wiki = "Enlisted_Surface_Warfare_Specialist_Insignia.svg" },
    @{ Name = "submarine-warfare"; Wiki = "Submarine_Warfare_insignia.svg" },
    @{ Name = "fleet-marine-force"; Wiki = "Fleet_Marine_Force_Warfare_Insignia.svg" },
    @{ Name = "command-pilot"; Wiki = "USAF_Command_Pilot_Wings.svg" },
    @{ Name = "senior-pilot"; Wiki = "Senior_Pilot_USAF_Wings.svg" },
    @{ Name = "pilot-wings"; Wiki = "Pilot_badge_(United_States).svg" },
    @{ Name = "space-operations-badge"; Wiki = "USAF_-_Occupational_Badge_-_Space_and_Missile.svg" },
    @{ Name = "pararescue"; Wiki = "USAF_-_Occupational_Badge_-_Pararescue.svg" },
    @{ Name = "combat-control"; Wiki = "USAF_-_Occupational_Badge_-_Combat_Control.svg" },
    @{ Name = "driver-mechanic-badge"; Wiki = "Driver_and_Mechanic_Badge_vector.svg" },
    @{ Name = "expert-marksmanship"; Wiki = "US_Army_Marksmanship_Badges.png" },
    @{ Name = "cutterman"; Wiki = "USCG_Cutterman_Insignia.png" },
    @{ Name = "rescue-swimmer"; Wiki = "USCG_Rescue_Swimmer.png" }
)

$Tabs = @(
    @{ Name = "ranger-tab"; Wiki = "Ranger_Tab.svg" },
    @{ Name = "special-forces-tab"; Wiki = "Special_Forces_Tab.svg" },
    @{ Name = "sapper-tab"; Wiki = "Sapper_Tab.svg" },
    @{ Name = "airborne-tab"; Wiki = "Airborne_Tab.svg" },
    @{ Name = "mountain-tab"; Wiki = "Mountain_Tab.svg" }
)

$Success = 0
$Skipped = 0
$Failed = 0
$FailedList = @()

Write-Host ""
Write-Host "DOWNLOADING BADGES (5 second delay between requests)..."
Write-Host "================================================================"

foreach ($badge in $Badges) {
    $result = Download-WikimediaThumbnail -LocalName $badge.Name -WikiTitle $badge.Wiki -OutputDir $BadgesDir
    
    switch ($result) {
        "ok" { $Success++ }
        "skip" { $Skipped++ }
        "fail" { $Failed++; $FailedList += $badge.Name }
    }
    
    # 5 second delay to respect rate limits
    Start-Sleep -Seconds 5
}

Write-Host ""
Write-Host "DOWNLOADING TABS..."
Write-Host "================================================================"

foreach ($tab in $Tabs) {
    $result = Download-WikimediaThumbnail -LocalName $tab.Name -WikiTitle $tab.Wiki -OutputDir $TabsDir
    
    switch ($result) {
        "ok" { $Success++ }
        "skip" { $Skipped++ }
        "fail" { $Failed++; $FailedList += $tab.Name }
    }
    
    Start-Sleep -Seconds 5
}

Write-Host ""
Write-Host "================================================================"
Write-Host "                    DOWNLOAD SUMMARY                            "
Write-Host "================================================================"
Write-Host ""
Write-Host "New downloads: $Success"
Write-Host "Skipped (existing): $Skipped"
Write-Host "Failed: $Failed"

if ($FailedList.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed items:"
    $FailedList | ForEach-Object { Write-Host "   - $_" }
}

Write-Host ""
Write-Host "Badge files in folder:"
Get-ChildItem $BadgesDir -Filter "*.*" | Where-Object { $_.Extension -in @('.svg', '.png') } | ForEach-Object {
    $sizeKB = [math]::Round($_.Length / 1024, 1)
    Write-Host "   $($_.Name) - $sizeKB KB"
}

Write-Host ""
Write-Host "Tab files in folder:"
Get-ChildItem $TabsDir -Filter "*.*" | Where-Object { $_.Extension -in @('.svg', '.png') } | ForEach-Object {
    $sizeKB = [math]::Round($_.Length / 1024, 1)
    Write-Host "   $($_.Name) - $sizeKB KB"
}

Write-Host ""
Write-Host "Scraping complete!"
