# Military Badge Image Scraper v2 - Corrected Filenames
# Downloads badge SVGs/PNGs from Wikimedia Commons with verified URLs

$ErrorActionPreference = "Continue"

$BadgesDir = "E:\VS_Studio\vet-rate-org-official\public\images\badges"
$TabsDir = "E:\VS_Studio\vet-rate-org-official\public\images\tabs"

New-Item -ItemType Directory -Force -Path $BadgesDir | Out-Null
New-Item -ItemType Directory -Force -Path $TabsDir | Out-Null

Write-Host "================================================================"
Write-Host "       MILITARY BADGE IMAGE SCRAPER v2 (Verified URLs)          "
Write-Host "================================================================"

# Format: localname = "WikimediaFilename.ext|output.ext"
# Using verified Wikimedia Commons filenames
$Badges = @{
    "combat-infantryman-badge" = "Combat_Infantry_Badge.svg|svg"
    "combat-action-badge" = "Combat_Action_Badge.svg|svg"
    "combat-medical-badge" = "Combat_Medical_Badge.svg|svg"
    "expert-infantryman-badge" = "Expert_Infantry_Badge.svg|svg"
    "expert-field-medical-badge" = "Expert_Field_Medical_Badge.svg|svg"
    "expert-soldier-badge" = "Expert_Soldier_Badge.svg|svg"
    
    # Parachutist badges
    "master-parachutist-badge" = "US_Army_Master_Parachutist_Badge.svg|svg"
    "senior-parachutist-badge" = "US_Army_Senior_Parachutist_Badge.svg|svg"
    "parachutist-badge" = "US_Army_Parachutist_Badge.svg|svg"
    
    # Other Army badges
    "air-assault-badge" = "US_Army_Air_Assault_Badge.svg|svg"
    "pathfinder-badge" = "US_Army_Pathfinder_Badge.svg|svg"
    
    # Navy insignia
    "surface-warfare-officer" = "Surface_Warfare_Officer_insignia.svg|svg"
    "enlisted-surface-warfare" = "ESWS.svg|svg"
    "submarine-warfare-officer" = "Submarine_Warfare_insignia.svg|svg"
    "submarine-warfare-enlisted" = "Submarine_Warfare_insignia.svg|svg"
    "naval-aviator" = "Naval_Aviator_Badge.svg|svg"
    "navy-seal-trident" = "United_States_Navy_SEALs_badge.svg|svg"
    "fleet-marine-force" = "Fleet_Marine_Force_Ribbon.svg|svg"
    
    # Air Force
    "command-pilot" = "USAF_Command_Pilot_Badge.svg|svg"
    "senior-pilot" = "USAF_Senior_Pilot_Badge.svg|svg"
    "pilot-wings" = "USAF_Pilot_Badge.svg|svg"
    "combat-control-team" = "USAF_Special_Tactics_Officer_Badge.svg|svg"
    "pararescue" = "USAF_Pararescue_Badge.svg|svg"
    "tactical-air-control" = "USAF_Tactical_Air_Control_Party_Badge.svg|svg"
    
    # Space Force  
    "space-operations-badge" = "Space_Operations_Badge.svg|svg"
    "master-space-badge" = "Space_Operations_Badge.svg|svg"
    "senior-space-badge" = "Space_Operations_Badge.svg|svg"
    
    # Coast Guard
    "cutterman-officer" = "USCG_Cutterman_Insignia.svg|svg"
    "rescue-swimmer" = "USCG_Rescue_Swimmer.svg|svg"
    
    # Marksmanship  
    "expert-marksmanship" = "Army_Marksmanship_Badge_Expert.svg|svg"
    "sharpshooter-marksmanship" = "Army_Marksmanship_Badge_Sharpshooter.svg|svg"
    "marksman-marksmanship" = "Army_Marksmanship_Badge_Marksman.svg|svg"
    
    # Driver/Mechanic
    "driver-badge-w" = "Driver_and_Mechanic_Badge.svg|svg"
    "driver-badge-t" = "Driver_and_Mechanic_Badge.svg|svg"
    "mechanic-badge" = "Driver_and_Mechanic_Badge.svg|svg"
}

$Tabs = @{
    "ranger-tab" = "Ranger_Tab.svg|svg"
    "special-forces-tab" = "Special_Forces_Tab.svg|svg"
    "sapper-tab" = "Sapper_Tab.svg|svg"
    "airborne-tab" = "Airborne_Tab.svg|svg"
    "mountain-tab" = "Mountain_Tab.svg|svg"
}

$Success = 0
$Failed = 0
$Skipped = 0
$FailedList = @()

Write-Host ""
Write-Host "DOWNLOADING BADGE IMAGES (Skipping existing files)..."
Write-Host ""

$i = 0
$total = $Badges.Count
foreach ($badge in $Badges.GetEnumerator()) {
    $i++
    $id = $badge.Key
    $parts = $badge.Value -split "\|"
    $filename = $parts[0]
    $ext = $parts[1]
    $outputPath = Join-Path $BadgesDir "$id.$ext"
    
    Write-Host "[$i/$total] $id"
    
    # Skip if already exists and has content
    if ((Test-Path $outputPath) -and (Get-Item $outputPath).Length -gt 100) {
        $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1024, 1)
        Write-Host "   [SKIP] Already exists - $sizeKB KB"
        $Skipped++
        continue
    }
    
    try {
        $url = "https://commons.wikimedia.org/wiki/Special:FilePath/$filename"
        Write-Host "   URL: $url"
        
        $response = Invoke-WebRequest -Uri $url -OutFile $outputPath -UserAgent "Mozilla/5.0 VetRate.org/1.0 Educational" -TimeoutSec 30 -ErrorAction Stop
        
        if (Test-Path $outputPath) {
            $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1024, 1)
            if ($sizeKB -lt 0.1) {
                Write-Host "   [FAIL] File too small, likely error page"
                Remove-Item $outputPath -ErrorAction SilentlyContinue
                $Failed++
                $FailedList += $id
            } else {
                Write-Host "   [OK] Saved - $sizeKB KB"
                $Success++
            }
        }
    }
    catch {
        Write-Host "   [FAIL] $($_.Exception.Message)"
        $Failed++
        $FailedList += $id
        Remove-Item $outputPath -ErrorAction SilentlyContinue
    }
    
    Start-Sleep -Milliseconds 800
}

Write-Host ""
Write-Host "DOWNLOADING TAB IMAGES..."
Write-Host ""

$i = 0
$total = $Tabs.Count
foreach ($tab in $Tabs.GetEnumerator()) {
    $i++
    $id = $tab.Key
    $parts = $tab.Value -split "\|"
    $filename = $parts[0]
    $ext = $parts[1]
    $outputPath = Join-Path $TabsDir "$id.$ext"
    
    Write-Host "[$i/$total] $id"
    
    if ((Test-Path $outputPath) -and (Get-Item $outputPath).Length -gt 100) {
        $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1024, 1)
        Write-Host "   [SKIP] Already exists - $sizeKB KB"
        $Skipped++
        continue
    }
    
    try {
        $url = "https://commons.wikimedia.org/wiki/Special:FilePath/$filename"
        Write-Host "   URL: $url"
        
        Invoke-WebRequest -Uri $url -OutFile $outputPath -UserAgent "Mozilla/5.0 VetRate.org/1.0 Educational" -TimeoutSec 30 -ErrorAction Stop
        
        if (Test-Path $outputPath) {
            $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1024, 1)
            if ($sizeKB -lt 0.1) {
                Write-Host "   [FAIL] File too small"
                Remove-Item $outputPath -ErrorAction SilentlyContinue
                $Failed++
                $FailedList += $id
            } else {
                Write-Host "   [OK] Saved - $sizeKB KB"
                $Success++
            }
        }
    }
    catch {
        Write-Host "   [FAIL] $($_.Exception.Message)"
        $Failed++
        $FailedList += $id
        Remove-Item $outputPath -ErrorAction SilentlyContinue
    }
    
    Start-Sleep -Milliseconds 800
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
    Write-Host "Failed downloads:"
    $FailedList | ForEach-Object { Write-Host "   - $_" }
}

Write-Host ""
Write-Host "Badge files in folder:"
Get-ChildItem $BadgesDir -Filter "*.svg" | ForEach-Object {
    $sizeKB = [math]::Round($_.Length / 1024, 1)
    Write-Host "   $($_.Name) - $sizeKB KB"
}

Write-Host ""
Write-Host "Tab files in folder:"
Get-ChildItem $TabsDir -Filter "*.svg" | ForEach-Object {
    $sizeKB = [math]::Round($_.Length / 1024, 1)
    Write-Host "   $($_.Name) - $sizeKB KB"
}

Write-Host ""
Write-Host "Scraping complete!"
