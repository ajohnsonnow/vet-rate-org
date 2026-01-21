# Chrome WebGPU Development Launcher

Launch Chrome with experimental WebGPU features enabled for Local AI development.

## Quick Start

### Windows (PowerShell)
```powershell
npm run dev:webgpu
# OR
.\scripts\launch-chrome-dev.ps1
```

### macOS/Linux (Bash)
```bash
npm run dev:webgpu
# OR
./scripts/launch-chrome-dev.sh
```

## What It Does

These scripts automatically:
1. ✅ Close all existing Chrome windows (safely)
2. ✅ Launch Chrome with experimental WebGPU flags
3. ✅ Enable Dawn unsafe APIs (`--enable-dawn-features=allow_unsafe_apis`)
4. ✅ Enable Vulkan backend for better GPU performance
5. ✅ Open your dev server (`http://localhost:5173`)

## Required Flags

The scripts launch Chrome with these critical flags for Local AI:

```bash
--enable-dawn-features=allow_unsafe_apis  # Required for u8 type in WGSL shaders
--enable-features=Vulkan                 # Better GPU backend
--enable-unsafe-webgpu                   # Experimental WebGPU features
--disable-web-security                   # For localhost development
--user-data-dir=/tmp/chrome-dev-webgpu   # Separate profile for dev
```

## Why Is This Needed?

WebLLM (the library powering Local AI) uses WGSL shaders that require the `u8` type, which is only available when Chrome is launched with the `allow_unsafe_apis` Dawn feature.

**Without these flags, you'll see:**
```
Error: 'u8' type used without 'chromium_experimental_subgroup_matrix' extension enabled
```

**With these flags:**
```
✅ WebGPU device reinitialized with experimental=true
✅ Model loading...
```

## Manual Launch (Without Scripts)

If you prefer to launch Chrome manually:

### Windows
```powershell
# Close Chrome first
taskkill /F /IM chrome.exe

# Launch with flags
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --enable-dawn-features=allow_unsafe_apis http://localhost:5173
```

### macOS
```bash
# Close Chrome first
killall "Google Chrome"

# Launch with flags
open -a "Google Chrome" --args --enable-dawn-features=allow_unsafe_apis http://localhost:5173
```

### Linux
```bash
# Close Chrome first
killall chrome

# Launch with flags
google-chrome --enable-dawn-features=allow_unsafe_apis http://localhost:5173
```

## Script Options

### PowerShell (Windows)

```powershell
# Default (opens localhost:5173)
.\scripts\launch-chrome-dev.ps1

# Custom URL
.\scripts\launch-chrome-dev.ps1 -Url "http://localhost:3000"

# Keep existing Chrome windows open (not recommended)
.\scripts\launch-chrome-dev.ps1 -KeepOpen

# Custom Chrome path
.\scripts\launch-chrome-dev.ps1 -ChromePath "C:\Custom\Path\chrome.exe"
```

### Bash (macOS/Linux)

```bash
# Default (opens localhost:5173)
./scripts/launch-chrome-dev.sh

# Custom URL
./scripts/launch-chrome-dev.sh http://localhost:3000
```

## Troubleshooting

### "Chrome not found"
The scripts auto-detect Chrome in standard locations:
- Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- macOS: `/Applications/Google Chrome.app`
- Linux: `google-chrome`, `google-chrome-stable`, `chromium`

If Chrome is installed elsewhere, use the `-ChromePath` parameter (PowerShell) or edit the script to add your path.

### "Permission Denied" (Linux/Mac)
Make the script executable:
```bash
chmod +x scripts/launch-chrome-dev.sh
```

### Warning Still Shows After Launch
1. Make sure you **closed ALL Chrome windows** before running the script
2. Check that the script actually launched (you should see a new Chrome window)
3. In the app, go to AI Settings and toggle experimental mode OFF then ON
4. Check the browser console - you should see: `⚡ Available adapter features:` with experimental features listed

### Models Still Won't Load
1. Verify experimental mode is enabled in AI Settings
2. Check "Enable Dawn Features" is toggled ON
3. Look for the green success message: `✅ WebGPU device reinitialized with experimental=true`
4. If you see the red warning banner, follow the instructions it provides

## UI Warning System

When experimental mode is enabled but Chrome flags are missing, you'll see:

```
⚠️ Experimental Mode Enabled - Chrome Flags Missing!

Chrome wasn't launched with the required experimental features flag

❌ No experimental features available - Chrome may not be launched with 
    --enable-dawn-features=allow_unsafe_apis

🔧 Quick Fix (Windows):
  1. Close ALL Chrome windows
  2. Open PowerShell or Command Prompt
  3. Run: cd scripts
  4. Run: .\launch-chrome-dev.ps1
```

**This warning will automatically disappear** once Chrome is properly launched with the flags.

## Development Workflow

Recommended daily workflow:

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Launch Chrome with WebGPU flags
npm run dev:webgpu
```

Or combine them (Windows):
```powershell
# Start dev server in background, then launch Chrome
Start-Job { npm run dev }; Start-Sleep 3; npm run dev:webgpu
```

## See Also

- [FAQ - Local AI Setup](../docs/support/faq.md)
- [WebGPU Feature Detector](../src/utils/webgpuFeatureDetector.js)
- [Experimental Mode Warning Component](../src/components/ExperimentalModeWarning.jsx)

## Notes

- The scripts use a temporary Chrome profile (`--user-data-dir`) so they won't affect your normal Chrome browsing
- You can still use your regular Chrome instance alongside the dev instance
- Closing the dev Chrome window won't affect other Chrome windows
- The flags are ONLY for development - users don't need these flags in production (unless they want Local AI features)

---

**Having issues?** Check the [FAQ](../docs/support/faq.md) or file an issue on GitHub.
