#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Launch Chrome with WebGPU experimental features enabled for Vet-Rate.org development

.DESCRIPTION
    This script closes all Chrome instances and launches a new Chrome window
    with the necessary flags to enable experimental WebGPU features required
    for Local AI (Faraday Cage) functionality.

.PARAMETER Url
    The URL to open (defaults to http://localhost:5173)

.PARAMETER ChromePath
    Custom path to Chrome executable (auto-detects if not provided)

.PARAMETER KeepOpen
    Keep existing Chrome windows open (not recommended)

.EXAMPLE
    .\launch-chrome-dev.ps1
    
.EXAMPLE
    .\launch-chrome-dev.ps1 -Url "http://localhost:3000"
    
.EXAMPLE
    .\launch-chrome-dev.ps1 -KeepOpen
#>

param(
    [string]$Url = "http://localhost:5173",
    [string]$ChromePath = "",
    [switch]$KeepOpen
)

# Colors for output
$Green = [ConsoleColor]::Green
$Yellow = [ConsoleColor]::Yellow
$Red = [ConsoleColor]::Red
$Cyan = [ConsoleColor]::Cyan

Write-Host "`n🚀 Vet-Rate.org - Chrome Dev Launcher" -ForegroundColor $Cyan
Write-Host "=" * 50 -ForegroundColor $Cyan
Write-Host ""

# Find Chrome executable
$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe"
)

if ($ChromePath) {
    if (Test-Path $ChromePath) {
        $chrome = $ChromePath
    } else {
        Write-Host "❌ Custom Chrome path not found: $ChromePath" -ForegroundColor $Red
        exit 1
    }
} else {
    $chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $chrome) {
    Write-Host "❌ Chrome not found in standard locations" -ForegroundColor $Red
    Write-Host "`nSearched:" -ForegroundColor $Yellow
    $chromePaths | ForEach-Object { Write-Host "  - $_" -ForegroundColor $Yellow }
    Write-Host "`nPlease specify Chrome path with -ChromePath parameter" -ForegroundColor $Yellow
    exit 1
}

Write-Host "✅ Found Chrome: $chrome" -ForegroundColor $Green
Write-Host ""

# Close existing Chrome instances (unless -KeepOpen specified)
if (-not $KeepOpen) {
    Write-Host "🔄 Closing existing Chrome instances..." -ForegroundColor $Yellow
    $chromeProcesses = Get-Process -Name "chrome" -ErrorAction SilentlyContinue
    
    if ($chromeProcesses) {
        Write-Host "   Found $($chromeProcesses.Count) Chrome process(es)" -ForegroundColor $Yellow
        try {
            Stop-Process -Name "chrome" -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            Write-Host "✅ Chrome closed" -ForegroundColor $Green
        } catch {
            Write-Host "⚠️  Could not close Chrome automatically" -ForegroundColor $Yellow
            Write-Host "   Please close Chrome manually and run this script again" -ForegroundColor $Yellow
            exit 1
        }
    } else {
        Write-Host "✅ No Chrome instances running" -ForegroundColor $Green
    }
    Write-Host ""
}

# Required Chrome flags for WebGPU experimental features
$flags = @(
    "--enable-dawn-features=allow_unsafe_apis",
    "--enable-features=Vulkan",
    "--enable-unsafe-webgpu",
    "--disable-web-security",
    "--user-data-dir=$env:TEMP\chrome-dev-webgpu"
)

Write-Host "🎮 Launching Chrome with WebGPU experimental features..." -ForegroundColor $Cyan
Write-Host ""
Write-Host "Flags enabled:" -ForegroundColor $Yellow
Write-Host "  ✓ allow_unsafe_apis (Dawn features)" -ForegroundColor $Green
Write-Host "  ✓ Vulkan backend" -ForegroundColor $Green
Write-Host "  ✓ Unsafe WebGPU (experimental)" -ForegroundColor $Green
Write-Host "  ✓ Web security disabled (localhost dev)" -ForegroundColor $Green
Write-Host ""
Write-Host "Opening: $Url" -ForegroundColor $Cyan
Write-Host ""

# Launch Chrome
try {
    $arguments = $flags + $Url
    Start-Process -FilePath $chrome -ArgumentList $arguments
    
    Write-Host "✅ Chrome launched successfully!" -ForegroundColor $Green
    Write-Host ""
    Write-Host "🎯 Next steps:" -ForegroundColor $Cyan
    Write-Host "   1. Navigate to AI Settings" -ForegroundColor $Yellow
    Write-Host "   2. Enable 'Experimental Mode'" -ForegroundColor $Yellow
    Write-Host "   3. Enable 'Dawn Features (unsafe APIs)'" -ForegroundColor $Yellow
    Write-Host "   4. Select a Local AI model and load" -ForegroundColor $Yellow
    Write-Host ""
    Write-Host "📚 If you encounter issues, see: docs/support/faq.md" -ForegroundColor $Cyan
    Write-Host ""
    
} catch {
    $errorMsg = $_.Exception.Message
    Write-Host "Failed to launch Chrome: $errorMsg" -ForegroundColor $Red
    exit 1
}
