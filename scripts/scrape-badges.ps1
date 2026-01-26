# Military Badge Image Scraper - PowerShell Edition
# Downloads badge SVGs from Wikimedia Commons

$ErrorActionPreference = "Continue"

$BadgesDir = "E:\VS_Studio\vet-rate-org-official\public\images\badges"
$TabsDir = "E:\VS_Studio\vet-rate-org-official\public\images\tabs"

New-Item -ItemType Directory -Force -Path $BadgesDir | Out-Null
New-Item -ItemType Directory -Force -Path $TabsDir | Out-Null

Write-Host "================================================================"
Write-Host "       MILITARY BADGE IMAGE SCRAPER (PowerShell)                "
Write-Host "================================================================"

$Badges = @{
    "combat-infantryman-badge" = "Combat_Infantry_Badge.svg"
    "combat-action-badge" = "Combat_Action_Badge.svg"
    "combat-medical-badge" = "Combat_Medical_Badge.svg"
    "expert-infantryman-badge" = "Expert_Infantry_Badge.svg"
    "expert-field-medical-badge" = "Expert_Field_Medical_Badge.svg"
    "expert-soldier-badge" = "Expert_Soldier_Badge.svg"
    "master-parachutist-badge" = "Master_Parachutist_badge_(United_States).svg"
    "senior-parachutist-badge" = "Senior_Parachutist_badge_(United_States).svg"
    "parachutist-badge" = "Parachutist_badge_(United_States).svg"
    "air-assault-badge" = "Air_Assault_Badge.svg"
    "pathfinder-badge" = "Pathfinder_Badge.svg"
    "surface-warfare-officer" = "Surface_Warfare_Officer_Insignia.svg"
    "enlisted-surface-warfare" = "Enlisted_Surface_Warfare_Specialist_Insignia.svg"
    "submarine-warfare-officer" = "Submarine_Officer.svg"
    "submarine-warfare-enlisted" = "Submarine_Enlisted.svg"
    "naval-aviator" = "Naval_Aviator_Badge.svg"
    "navy-seal-trident" = "Naval_Special_Warfare_Trident_insignia.svg"
    "fleet-marine-force" = "Fleet_Marine_Force_Ribbon.svg"
    "command-pilot" = "Command_Pilot_Badge.svg"
    "senior-pilot" = "Senior_Pilot_Badge.svg"
    "pilot-wings" = "Pilot_badge.svg"
    "combat-control-team" = "USAF_Combat_Controller_Badge.svg"
    "pararescue" = "USAF_Pararescue_Badge.svg"
    "tactical-air-control" = "USAF_Tactical_Air_Control_Party_Badge.svg"
    "space-operations-badge" = "Space_Operations_Badge.svg"
    "master-space-badge" = "Master_Space_Badge.svg"
    "senior-space-badge" = "Senior_Space_Badge.svg"
    "cutterman-officer" = "USCG_Cutterman_pin.svg"
    "rescue-swimmer" = "USCG_Rescue_Swimmer.svg"
    "expert-marksmanship" = "US_Army_Marksmanship_Badge_-_Expert.svg"
    "sharpshooter-marksmanship" = "US_Army_Marksmanship_Badge_-_Sharpshooter.svg"
    "marksman-marksmanship" = "US_Army_Marksmanship_Badge_-_Marksman.svg"
    "driver-badge-w" = "Driver_and_Mechanic_Badge_(W_bar).svg"
    "driver-badge-t" = "Driver_and_Mechanic_Badge_(T_bar).svg"
    "mechanic-badge" = "Driver_and_Mechanic_Badge_(M_bar).svg"
}

$Tabs = @{
    "ranger-tab" = "Ranger_Tab.svg"
    "special-forces-tab" = "Special_Forces_Tab.svg"
    "sapper-tab" = "Sapper_tab.svg"
    "airborne-tab" = "Airborne_Tab.svg"
    "mountain-tab" = "Mountain_Tab.svg"
}

$Success = 0
$Failed = 0
$FailedList = @()

Write-Host ""
Write-Host "DOWNLOADING BADGE IMAGES..."
Write-Host ""

$i = 0
$total = $Badges.Count
foreach ($badge in $Badges.GetEnumerator()) {
    $i++
    $id = $badge.Key
    $filename = $badge.Value
    $outputPath = Join-Path $BadgesDir "$id.svg"
    
    Write-Host "[$i/$total] $id"
    
    if ((Test-Path $outputPath) -and (Get-Item $outputPath).Length -gt 100) {
        $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1024, 1)
        Write-Host "   [OK] Already exists - $sizeKB KB"
        $Success++
        continue
    }
    
    try {
        $url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + [Uri]::EscapeDataString($filename)
        Write-Host "   Downloading..."
        
        Invoke-WebRequest -Uri $url -OutFile $outputPath -UserAgent "VetRate.org/1.0 badge-scraper" -TimeoutSec 30 -ErrorAction Stop
        
        if (Test-Path $outputPath) {
            $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1024, 1)
            Write-Host "   [OK] Saved - $sizeKB KB"
            $Success++
        }
    }
    catch {
        Write-Host "   [FAIL] $($_.Exception.Message)"
        $Failed++
        $FailedList += $id
    }
    
    Start-Sleep -Milliseconds 1000
}

Write-Host ""
Write-Host "DOWNLOADING TAB IMAGES..."
Write-Host ""

$i = 0
$total = $Tabs.Count
foreach ($tab in $Tabs.GetEnumerator()) {
    $i++
    $id = $tab.Key
    $filename = $tab.Value
    $outputPath = Join-Path $TabsDir "$id.svg"
    
    Write-Host "[$i/$total] $id"
    
    if ((Test-Path $outputPath) -and (Get-Item $outputPath).Length -gt 100) {
        $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1024, 1)
        Write-Host "   [OK] Already exists - $sizeKB KB"
        $Success++
        continue
    }
    
    try {
        $url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + [Uri]::EscapeDataString($filename)
        Write-Host "   Downloading..."
        
        Invoke-WebRequest -Uri $url -OutFile $outputPath -UserAgent "VetRate.org/1.0 badge-scraper" -TimeoutSec 30 -ErrorAction Stop
        
        if (Test-Path $outputPath) {
            $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1024, 1)
            Write-Host "   [OK] Saved - $sizeKB KB"
            $Success++
        }
    }
    catch {
        Write-Host "   [FAIL] $($_.Exception.Message)"
        $Failed++
        $FailedList += $id
    }
    
    Start-Sleep -Milliseconds 1000
}

Write-Host ""
Write-Host "================================================================"
Write-Host "                    DOWNLOAD SUMMARY                            "
Write-Host "================================================================"
Write-Host ""
Write-Host "Successfully downloaded: $Success"
Write-Host "Failed: $Failed"

if ($FailedList.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed downloads:"
    $FailedList | ForEach-Object { Write-Host "   - $_" }
}

Write-Host ""
Write-Host "Downloaded badge files:"
Get-ChildItem $BadgesDir -Filter "*.svg" | ForEach-Object {
    $sizeKB = [math]::Round($_.Length / 1024, 1)
    Write-Host "   $($_.Name) - $sizeKB KB"
}

Write-Host ""
Write-Host "Downloaded tab files:"
Get-ChildItem $TabsDir -Filter "*.svg" | ForEach-Object {
    $sizeKB = [math]::Round($_.Length / 1024, 1)
    Write-Host "   $($_.Name) - $sizeKB KB"
}

Write-Host ""
Write-Host "Badge scraping complete!"
