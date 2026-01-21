# WebGPU Experimental Features Setup Guide

This guide helps you enable experimental WebGPU features in Chrome, including `chromium-experimental-subgroup-matrix` which is required for advanced Local AI model optimizations.

## 🎯 Quick Start (Recommended)

### Method 1: Use the Launch Script
The easiest way is to use our PowerShell script that automatically launches Chrome with all required flags:

```powershell
.\scripts\launch-chrome-dev.ps1
```

This script will:
- Close any existing Chrome instances
- Launch Chrome with experimental WebGPU flags enabled
- Open the dev server at http://localhost:5173

### Method 2: Manual Chrome Flags Setup

If you prefer to enable flags in your regular Chrome browser:

1. **Open Chrome Flags**
   - Navigate to: `chrome://flags`

2. **Enable These Flags**
   
   Search for and set to **"Enabled"**:
   
   - **`#enable-unsafe-webgpu`**
     - Enables experimental WebGPU features
     - Required for advanced GPU operations
   
   - **`#enable-webgpu-developer-features`**
     - Enables developer-level WebGPU features
     - Includes subgroup operations and experimental extensions
   
   - **`#enable-experimental-webgpu-features`** (if available)
     - Enables cutting-edge WebGPU features
     - Includes chromium-experimental-subgroup-matrix
   
   - **`#enable-vulkan`** (recommended)
     - Uses Vulkan backend for better performance
     - Especially beneficial for NVIDIA GPUs

3. **Relaunch Chrome**
   - Click the "Relaunch" button at the bottom of the flags page
   - Or manually close all Chrome windows and restart

4. **Verify Setup**
   - Go to Vet-Rate.org
   - Open AI Settings
   - Check the GPU info - it should now list more experimental features
   - Try enabling "Experimental Mode"

## 🔍 Verifying Experimental Features

After enabling the flags, you can verify which features are available:

1. Open the browser console (F12)
2. Run this code:
```javascript
const adapter = await navigator.gpu.requestAdapter();
console.log('Available features:', Array.from(adapter.features).join(', '));
```

3. Look for these in the output:
   - ✅ `subgroups` - Basic subgroup operations
   - ✅ `chromium-experimental-subgroups` - Experimental subgroup features
   - ✅ `chromium-experimental-subgroup-matrix` - Matrix operations (required for u8 types)

## 🚀 Alternative: Chrome Canary/Dev

If the flags don't enable `chromium-experimental-subgroup-matrix`, try using a development version of Chrome:

- **Chrome Canary** (most cutting-edge): https://www.google.com/chrome/canary/
- **Chrome Dev**: https://www.google.com/chrome/dev/

These versions have newer WebGPU implementations with more experimental features enabled by default.

## 🎮 GPU-Specific Notes

### NVIDIA GPUs (RTX 30/40 series)
- Excellent WebGPU support
- Vulkan backend recommended
- All experimental features should work with proper flags enabled
- Driver version 535+ recommended

### AMD GPUs (RX 6000/7000 series)
- Good WebGPU support
- Some experimental features may be limited
- Update to latest drivers for best compatibility

### Intel Arc GPUs
- Growing WebGPU support
- Experimental features availability varies
- Ensure you have the latest Intel graphics drivers

## ⚠️ Troubleshooting

### "u8 type used without chromium_experimental_subgroup_matrix"
This error means the experimental feature isn't enabled. Try:
1. Verify all flags are enabled in `chrome://flags`
2. Completely close Chrome (check Task Manager)
3. Relaunch using the script: `.\scripts\launch-chrome-dev.ps1`
4. If still not working, try Chrome Canary

### "Experimental mode was automatically disabled"
This means your GPU/browser combination doesn't support the required features yet. Options:
1. Use standard WebGPU mode (still very fast!)
2. Try Chrome Canary for newer features
3. Update GPU drivers
4. Wait for features to stabilize in stable Chrome

### Performance Issues
If you experience issues with experimental mode:
1. Disable experimental mode in AI Settings
2. Standard WebGPU mode is still very performant
3. The experimental features mainly help with larger models (7B+)

## 📊 Performance Comparison

| Mode | Supported Hardware | Speed | Stability |
|------|-------------------|-------|-----------|
| Standard WebGPU | All WebGPU-capable GPUs | Fast ⚡ | Very Stable ✅ |
| Experimental WebGPU | Modern GPUs + Dev Chrome | Faster ⚡⚡ | Experimental ⚠️ |

**Recommendation**: For most users, standard WebGPU mode provides excellent performance with better stability. Only enable experimental mode if you need the absolute maximum performance and are willing to troubleshoot issues.

## 🔗 Additional Resources

- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [Chrome WebGPU Status](https://chromestatus.com/feature/6213121689518080)
- [WebGPU Best Practices](https://toji.dev/webgpu-best-practices/)
- [MLC-AI WebLLM Documentation](https://github.com/mlc-ai/web-llm)

## 📝 Notes

- Experimental features may change or break between Chrome updates
- Always test after Chrome updates
- Report issues to: https://github.com/ajohnsonnow/vet-rate-org/issues
- Consider using the launch script for consistent development environment
