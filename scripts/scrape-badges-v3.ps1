# Military Badge Image Scraper v3 - Using Wikimedia API
# Downloads badge SVGs from Wikimedia Commons using API for correct URLs

$ErrorActionPreference = "Continue"

$BadgesDir = "E:\VS_Studio\vet-rate-org-official\public\images\badges"
$TabsDir = "E:\VS_Studio\vet-rate-org-official\public\images\tabs"

New-Item -ItemType Directory -Force -Path $BadgesDir | Out-Null
New-Item -ItemType Directory -Force -Path $TabsDir | Out-Null

Write-Host "================================================================"
Write-Host "       MILITARY BADGE IMAGE SCRAPER v3 (API-based)              "
Write-Host "================================================================"

function Get-WikimediaFileUrl {
    param([string]$SearchTerm, [string]$PreferSvg = $true)
    
    # Search for files matching the term
    $searchUrl = "https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=$([Uri]::EscapeDataString($SearchTerm))&srnamespace=6&srlimit=10&format=json"
    
    try {
        $searchResult = Invoke-RestMethod -Uri $searchUrl -UserAgent "VetRate.org/1.0 Educational"
        
        foreach ($file in $searchResult.query.search) {
            $title = $file.title
            
            # Skip if looking for SVG but this isn't one
            if ($PreferSvg -and -not ($title -match "\.svg$")) {
                continue
            }
            
            # Get the actual file URL
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
    
    # Skip if already exists
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
    Write-Host "   URL: $($fileInfo.Url)"
    
    try {
        Invoke-WebRequest -Uri $fileInfo.Url -OutFile $outputPath -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) VetRate.org/1.0" -TimeoutSec 30 -ErrorAction Stop
        
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

# Badge search terms - designed to find the right SVG on Wikimedia
$Badges = @(
    @{ Name = "combat-infantryman-badge"; Search = "Combat Infantry Badge svg" },
    @{ Name = "combat-action-badge"; Search = "Combat Action Badge svg" },
    @{ Name = "combat-medical-badge"; Search = "Combat Medical Badge 1st award svg" },
    @{ Name = "expert-infantryman-badge"; Search = "Expert Infantry Badge svg" },
    @{ Name = "expert-field-medical-badge"; Search = "Expert Field Medical Badge svg" },
    @{ Name = "expert-soldier-badge"; Search = "Expert Soldier Badge svg" },
    @{ Name = "master-parachutist-badge"; Search = "Master Parachutist badge svg" },
    @{ Name = "senior-parachutist-badge"; Search = "Senior Parachutist badge svg" },
    @{ Name = "parachutist-badge"; Search = "Parachutist badge United States svg" },
    @{ Name = "air-assault-badge"; Search = "Air Assault Badge svg" },
    @{ Name = "pathfinder-badge"; Search = "Pathfinder Badge Army svg" },
    @{ Name = "surface-warfare-officer"; Search = "Surface Warfare Officer insignia svg" },
    @{ Name = "enlisted-surface-warfare"; Search = "Enlisted Surface Warfare Specialist insignia svg" },
    @{ Name = "submarine-warfare-officer"; Search = "Submarine Officer insignia svg" },
    @{ Name = "submarine-warfare-enlisted"; Search = "Submarine Enlisted insignia svg" },
    @{ Name = "naval-aviator"; Search = "Naval Aviator Badge svg" },
    @{ Name = "navy-seal-trident"; Search = "Navy SEAL Trident insignia svg" },
    @{ Name = "fleet-marine-force"; Search = "Fleet Marine Force Warfare svg" },
    @{ Name = "command-pilot"; Search = "Command Pilot Badge USAF svg" },
    @{ Name = "senior-pilot"; Search = "Senior Pilot Badge USAF svg" },
    @{ Name = "pilot-wings"; Search = "Pilot Badge USAF svg" },
    @{ Name = "combat-control-team"; Search = "Combat Controller Badge USAF svg" },
    @{ Name = "pararescue"; Search = "Pararescue Badge USAF svg" },
    @{ Name = "tactical-air-control"; Search = "Tactical Air Control Party Badge svg" },
    @{ Name = "space-operations-badge"; Search = "Space Operations Badge svg" },
    @{ Name = "cutterman-officer"; Search = "Cutterman insignia Coast Guard svg" },
    @{ Name = "rescue-swimmer"; Search = "Rescue Swimmer Coast Guard svg" },
    @{ Name = "expert-marksmanship"; Search = "Expert Marksmanship Badge Army svg" },
    @{ Name = "sharpshooter-marksmanship"; Search = "Sharpshooter Marksmanship Badge svg" },
    @{ Name = "marksman-badge"; Search = "Marksman Badge Army svg" },
    @{ Name = "driver-mechanic-badge"; Search = "Driver Mechanic Badge svg" }
)

$Tabs = @(
    @{ Name = "ranger-tab"; Search = "Ranger Tab svg" },
    @{ Name = "special-forces-tab"; Search = "Special Forces Tab svg" },
    @{ Name = "sapper-tab"; Search = "Sapper Tab svg" },
    @{ Name = "airborne-tab"; Search = "Airborne Tab svg" },
    @{ Name = "mountain-tab"; Search = "Mountain Tab svg" }
)

$Success = 0
$Skipped = 0
$Failed = 0
$FailedList = @()

Write-Host ""
Write-Host "DOWNLOADING BADGES..."
Write-Host ""

$i = 0
$total = $Badges.Count
foreach ($badge in $Badges) {
    $i++
    $result = Download-Badge -LocalName $badge.Name -SearchTerm $badge.Search -OutputDir $BadgesDir -Index $i -Total $total
    
    switch ($result) {
        "ok" { $Success++ }
        "skip" { $Skipped++ }
        "fail" { $Failed++; $FailedList += $badge.Name }
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "DOWNLOADING TABS..."
Write-Host ""

$i = 0
$total = $Tabs.Count
foreach ($tab in $Tabs) {
    $i++
    $result = Download-Badge -LocalName $tab.Name -SearchTerm $tab.Search -OutputDir $TabsDir -Index $i -Total $total
    
    switch ($result) {
        "ok" { $Success++ }
        "skip" { $Skipped++ }
        "fail" { $Failed++; $FailedList += $tab.Name }
    }
    
    Start-Sleep -Milliseconds 500
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
Write-Host "Badge files:"
Get-ChildItem $BadgesDir -Filter "*.svg" | ForEach-Object {
    $sizeKB = [math]::Round($_.Length / 1024, 1)
    Write-Host "   $($_.Name) - $sizeKB KB"
}

Write-Host ""
Write-Host "Tab files:"
Get-ChildItem $TabsDir -Filter "*.svg" | ForEach-Object {
    $sizeKB = [math]::Round($_.Length / 1024, 1)
    Write-Host "   $($_.Name) - $sizeKB KB"
}

Write-Host ""
Write-Host "Scraping complete!"
