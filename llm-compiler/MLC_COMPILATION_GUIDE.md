# 🚀 STEP 5: MLC-LLM WEBGPU COMPILATION

**Status:** Ready for Execution  
**Prerequisites:** Merged models from Step 4  
**Duration:** 7-20 minutes per model  
**Output:** Browser-ready WebGPU binaries

---

## 🎯 THE CRITICAL CONVERSION

### What This Step Does

Transforms your trained merged models into browser-compatible format:

```
INPUT:  VetRate-Auditor-3B-v1/  (6 GB FP16 PyTorch)
        ↓
QUANTIZE: Compress to 4-bit weights + FP16 activations
        ↓
COMPILE:  Generate WebGPU compute shaders
        ↓
OUTPUT: vetrate-auditor-web/  (2 GB + WASM library)
        ↓
DEPLOY:  100% client-side browser inference
```

### Why q4f16_1?

**The Sweet Spot:**

- **q4:** 4-bit quantization (75% size reduction)
- **f16:** FP16 activations (maintains quality)
- **_1:** Group size 128 (balance speed/accuracy)

**Alternatives:**

- `q4f16_0`: Faster but less accurate (group size 32)
- `q4f32_1`: Higher quality but larger & slower
- `q0f16`: No quantization (6 GB, too large for browser)

**Benchmark (3B model):**

| Quantization | Size | Speed | Quality | Browser? |
|--------------|------|-------|---------|----------|
| q0f16 | 6 GB | Baseline | 100% | ❌ Too large |
| q4f32_1 | 3.5 GB | 0.9x | 98% | ⚠️ Marginal |
| **q4f16_1** | **2 GB** | **1.0x** | **96%** | **✅ Optimal** |
| q4f16_0 | 2 GB | 1.2x | 92% | ✅ Fast |

---

## 📋 QUICK START

### Basic Usage

```powershell
# Compile Auditor (7-15 minutes)
.\compile_to_webgpu.ps1 -SwarmMember auditor

# Compile Writer (7-15 minutes)
.\compile_to_webgpu.ps1 -SwarmMember writer

# Compile both (14-30 minutes)
.\compile_to_webgpu.ps1 -SwarmMember both
```

### Advanced Options

```powershell
# Fresh compilation (remove existing output)
.\compile_to_webgpu.ps1 -SwarmMember auditor -CleanBuild

# Test without executing
.\compile_to_webgpu.ps1 -SwarmMember auditor -DryRun

# Skip validation (if already checked)
.\compile_to_webgpu.ps1 -SwarmMember auditor -SkipValidation
```

---

## 🔧 MANUAL COMMANDS (Reference)

If you prefer to run commands manually or the script fails:

### Step 1: Convert Weights

```bash
python -m mlc_llm convert_weight \
    "./models/merged-models/VetRate-Auditor-3B-v1" \
    --quantization q4f16_1 \
    --output "./dist/vetrate-auditor-web" \
    --device cuda:0
```

**What this does:**

- Loads 6 GB FP16 PyTorch weights
- Quantizes to 4-bit using group quantization
- Stores as MLC params format (params_shard_*.bin)
- Uses RTX 4080 Super CUDA cores (10x faster than CPU)

**Output:**

```
dist/vetrate-auditor-web/
└── params/
    ├── params_shard_0.bin    (~500 MB)
    ├── params_shard_1.bin    (~500 MB)
    ├── params_shard_2.bin    (~500 MB)
    ├── params_shard_3.bin    (~500 MB)
    └── ndarray-cache.json    (metadata)
```

### Step 2: Compile to WebGPU

```bash
python -m mlc_llm compile \
    "./dist/vetrate-auditor-web/params" \
    --target webgpu \
    --opt O3 \
    --system-lib-prefix "VetRate-Auditor-3B" \
    --output "./dist/vetrate-auditor-web" \
    --device cuda:0 \
    -j 8
```

**What this does:**

- Generates WebGPU compute shaders (WGSL)
- Compiles to WebAssembly (WASM)
- Optimizes for browser execution
- Parallel compilation (8 threads)

**Output:**

```
dist/vetrate-auditor-web/
├── VetRate-Auditor-3B-webgpu.wasm      (Model library ~50MB)
├── VetRate-Auditor-3B-webgpu.js        (JavaScript wrapper)
└── mlc-chat-config.json                (Model config)
```

---

## 🔍 VERIFICATION GUIDE

### Check Params Shards

**Critical Files:**

```powershell
# List all params shards
Get-ChildItem "dist\vetrate-auditor-web\params\params_shard_*.bin"
```

**Expected Output:**

```
params_shard_0.bin    500-600 MB
params_shard_1.bin    500-600 MB
params_shard_2.bin    500-600 MB
params_shard_3.bin    500-600 MB
```

**Total Size:** 1.5-2.5 GB for q4f16_1 quantized 3B model

### Verification Checklist

✅ **Params Directory:**

```powershell
Test-Path "dist\vetrate-auditor-web\params"
# Should return: True
```

✅ **Shard Count:**

```powershell
(Get-ChildItem "dist\vetrate-auditor-web\params\params_shard_*.bin").Count
# Should return: 3-5 shards
```

✅ **Shard Sizes:**

```powershell
Get-ChildItem "dist\vetrate-auditor-web\params\params_shard_*.bin" | ForEach-Object {
    $size = $_.Length / 1MB
    Write-Host "$($_.Name): $([math]::Round($size, 1)) MB"
}
# Each shard should be 300-700 MB (non-zero)
```

✅ **Metadata File:**

```powershell
Test-Path "dist\vetrate-auditor-web\params\ndarray-cache.json"
# Should return: True
```

✅ **WASM Library:**

```powershell
Get-ChildItem "dist\vetrate-auditor-web\*.wasm"
# Should find: VetRate-Auditor-3B-webgpu.wasm (~30-70 MB)
```

### Validation Script

```powershell
# Comprehensive verification
function Test-MLCOutput {
    param([string]$OutputDir)
    
    $errors = @()
    
    # Check params directory
    if (-not (Test-Path "$OutputDir\params")) {
        $errors += "Missing params directory"
    }
    
    # Check shards
    $shards = Get-ChildItem "$OutputDir\params\params_shard_*.bin" -ErrorAction SilentlyContinue
    if ($shards.Count -eq 0) {
        $errors += "No params_shard files found"
    } else {
        $totalSize = ($shards | Measure-Object -Property Length -Sum).Sum / 1GB
        if ($totalSize -lt 1.5 -or $totalSize -gt 3) {
            $errors += "Unexpected total params size: $([math]::Round($totalSize, 2)) GB (expected 1.5-2.5 GB)"
        }
        
        foreach ($shard in $shards) {
            if ($shard.Length -eq 0) {
                $errors += "Empty shard: $($shard.Name)"
            }
        }
    }
    
    # Check metadata
    if (-not (Test-Path "$OutputDir\params\ndarray-cache.json")) {
        $errors += "Missing ndarray-cache.json"
    }
    
    # Check WASM
    $wasm = Get-ChildItem "$OutputDir\*.wasm" -ErrorAction SilentlyContinue
    if ($wasm.Count -eq 0) {
        $errors += "No WASM library found"
    }
    
    # Report
    if ($errors.Count -eq 0) {
        Write-Host "✅ All verification checks passed" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Verification failed:" -ForegroundColor Red
        foreach ($error in $errors) {
            Write-Host "  - $error" -ForegroundColor Red
        }
        return $false
    }
}

# Run verification
Test-MLCOutput -OutputDir "dist\vetrate-auditor-web"
```

---

## ⏱️ EXPECTED TIMELINE

### VetRate-Auditor Compilation

```
Phase                    Duration      Output
─────────────────────────────────────────────────────────────────
Prerequisites            30 sec        Validation passed
Weight Conversion        2-5 min       params_shard_*.bin (2 GB)
Model Compilation        5-15 min      .wasm library (50 MB)
Verification             30 sec        All checks passed
─────────────────────────────────────────────────────────────────
TOTAL                    7-20 min      vetrate-auditor-web/
```

### VetRate-Writer Compilation

```
Similar timeline: 7-20 minutes
```

### Performance Factors

**Fast (7-10 min):**

- RTX 4080 Super with CUDA
- NVMe SSD storage
- 32+ GB RAM
- No background GPU tasks

**Slow (15-20 min):**

- CPU fallback (if CUDA fails)
- HDD storage
- 16 GB RAM (swapping)
- Other GPU processes running

---

## 🚨 TROUBLESHOOTING

### "ModuleNotFoundError: No module named 'mlc_llm'"

**Solution:**

```bash
pip install mlc-llm mlc-ai-nightly
```

### "CUDA out of memory" During Conversion

**Solution 1: Free GPU memory**

```powershell
# Kill other GPU processes
taskkill /F /IM python.exe
taskkill /F /IM chrome.exe  # If running GPU-accelerated browser
```

**Solution 2: Use CPU (slower)**

```bash
# Remove --device cuda:0 from command
python -m mlc_llm convert_weight ... --device cpu
```

### Empty or Missing Params Shards

**Check:**

```powershell
# Did weight conversion complete?
Get-Content logs\mlc_conversion_*.log | Select-String "error"
```

**Likely causes:**

- Conversion interrupted (Ctrl+C pressed)
- Out of disk space
- Merged model corrupted

**Solution: Re-run conversion**

```powershell
.\compile_to_webgpu.ps1 -SwarmMember auditor -CleanBuild
```

### WASM Library Not Generated

**Check compilation logs:**

```powershell
Get-Content logs\mlc_compile_*.log | Select-String "error"
```

**Common issues:**

- WebGPU target not supported (try `--target metal` on Mac)
- TVM compilation errors (update MLC-LLM: `pip install --upgrade mlc-llm`)

### Compilation Very Slow (>30 min)

**Check GPU is being used:**

```powershell
nvidia-smi
# Should show python process using GPU
```

**If GPU not used:**

```bash
# Force CUDA device
set CUDA_VISIBLE_DEVICES=0
.\compile_to_webgpu.ps1 -SwarmMember auditor
```

### Model Won't Load in Browser

**Check browser compatibility:**

```javascript
// Browser console
if (!navigator.gpu) {
    console.error("WebGPU not supported in this browser");
}
// Requires Chrome/Edge 113+
```

**Check CORS headers:**

```javascript
// vite.config.js or server config
headers: {
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Opener-Policy": "same-origin"
}
```

---

## 📊 OUTPUT STRUCTURE

```
llm-compiler/dist/
├── vetrate-auditor-web/
│   ├── params/
│   │   ├── params_shard_0.bin          (~500 MB)
│   │   ├── params_shard_1.bin          (~500 MB)
│   │   ├── params_shard_2.bin          (~500 MB)
│   │   ├── params_shard_3.bin          (~500 MB)
│   │   └── ndarray-cache.json          (Metadata)
│   ├── VetRate-Auditor-3B-webgpu.wasm  (~50 MB)
│   ├── VetRate-Auditor-3B-webgpu.js    (Wrapper)
│   ├── mlc-chat-config.json            (Config)
│   └── DEPLOYMENT.md                   (Integration guide)
└── vetrate-writer-web/
    ├── params/
    │   ├── params_shard_0.bin          (~500 MB)
    │   ├── params_shard_1.bin          (~500 MB)
    │   ├── params_shard_2.bin          (~500 MB)
    │   └── ndarray-cache.json
    ├── VetRate-Writer-3B-webgpu.wasm   (~50 MB)
    ├── VetRate-Writer-3B-webgpu.js
    ├── mlc-chat-config.json
    └── DEPLOYMENT.md
```

**Total Size:** ~4-5 GB (both models compiled)

---

## 🌐 WEBLLM INTEGRATION PREVIEW

After compilation completes, integrate into Vet-Rate.org:

### Install WebLLM

```bash
npm install @mlc-ai/web-llm
```

### Configure Models

```javascript
// src/config/llm-swarm.js
export const SWARM_MODELS = {
    auditor: {
        model_url: "/models/vetrate-auditor-web/",
        model_id: "VetRate-Auditor-3B-q4f16_1",
        model_lib_url: "/models/vetrate-auditor-web/VetRate-Auditor-3B-webgpu.wasm",
        vram_required_MB: 2500,
        context_window: 4096
    },
    writer: {
        model_url: "/models/vetrate-writer-web/",
        model_id: "VetRate-Writer-3B-q4f16_1",
        model_lib_url: "/models/vetrate-writer-web/VetRate-Writer-3B-webgpu.wasm",
        vram_required_MB: 2500,
        context_window: 4096
    }
};
```

### Basic Usage

```javascript
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { SWARM_MODELS } from "./config/llm-swarm";

// Load Auditor
const engine = await CreateMLCEngine(
    SWARM_MODELS.auditor.model_id,
    {
        initProgressCallback: (progress) => {
            console.log(`Loading: ${progress.text} (${progress.progress}%)`);
        }
    }
);

// Chat
const response = await engine.chat.completions.create({
    messages: [
        {
            role: "system",
            content: "You are a VA disability rating expert specializing in 38 CFR regulations."
        },
        {
            role: "user",
            content: "How do I calculate bilateral factor for 70% and 50%?"
        }
    ],
    max_tokens: 500,
    temperature: 0.7
});

console.log(response.choices[0].message.content);

// Hot-swap to Writer
await engine.unload();
await engine.reload(SWARM_MODELS.writer.model_id);
```

---

## 💎 DIAMOND QUALITY CHECKLIST

Before you start:

- [ ] Step 4 training completed (merged models exist)
- [ ] MLC-LLM installed (`pip list | grep mlc`)
- [ ] CUDA available (`nvidia-smi`)
- [ ] 5+ GB disk space free
- [ ] No other GPU processes running

During compilation:

- [ ] GPU utilization 60-90% (watch nvidia-smi)
- [ ] No errors in console output
- [ ] Progress indicators advancing
- [ ] Temp files being created in dist/

After compilation:

- [ ] Params shards exist (3-5 files)
- [ ] Total params size 1.5-2.5 GB
- [ ] WASM library generated (~50 MB)
- [ ] ndarray-cache.json present
- [ ] Verification script passes

---

## 🎓 TECHNICAL DEEP-DIVE

### Quantization Mathematics

**q4f16_1 Encoding:**

```
Original Weight (FP16):     16 bits per parameter
Quantized Weight (4-bit):   4 bits per parameter
Group Size:                 128 parameters per scale factor

Compression:
  3B params × 16 bits = 48 Gb = 6 GB
  3B params × 4 bits  = 12 Gb = 1.5 GB
  + scales & zeros    = 0.3 GB
  Total quantized     = 1.8 GB

Savings: 70% size reduction
Quality loss: 3-5% accuracy degradation (acceptable)
```

### WebGPU Compute Shaders

MLC generates optimized WGSL (WebGPU Shading Language) code:

```wgsl
// Example: Matrix multiplication kernel
@group(0) @binding(0) var<storage, read> weights: array<u32>;  // 4-bit packed
@group(0) @binding(1) var<storage, read> scales: array<f16>;   // Dequant scales
@group(0) @binding(2) var<storage, read> input: array<f16>;
@group(0) @binding(3) var<storage, read_write> output: array<f16>;

@compute @workgroup_size(256)
fn matmul(@builtin(global_invocation_id) gid: vec3<u32>) {
    // Fused dequantization + matmul
    let w_packed = weights[gid.x / 8];
    let w_4bit = extract_4bit(w_packed, gid.x % 8);
    let w_fp16 = f16(w_4bit) * scales[gid.x / 128];
    
    output[gid.x] = dot(w_fp16, input[gid.x]);
}
```

### Why CUDA Acceleration Matters

**CPU Quantization:**

- Single-threaded weight processing
- ~30-60 minutes per model

**CUDA Quantization (RTX 4080 Super):**

- 10,240 CUDA cores parallel processing
- Tensor Core acceleration (FP16→INT4 conversion)
- ~2-5 minutes per model
- **12x speedup**

---

## 📚 RESOURCES

- [MLC-LLM Documentation](https://llm.mlc.ai/docs/)
- [WebLLM GitHub](https://github.com/mlc-ai/web-llm)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [TVM Deep Learning Compiler](https://tvm.apache.org/)
- [Quantization Guide](https://arxiv.org/abs/2106.08295) (QLoRA paper)

---

## ✅ SUCCESS CRITERIA

After running `.\compile_to_webgpu.ps1`, you should see:

```
═══════════════════════════════════════════════════════════════
 COMPILATION COMPLETE
═══════════════════════════════════════════════════════════════

✓ WebGPU models ready for deployment
→ Output location: E:\VS_Studio\vet-rate-org-official\llm-compiler\dist

→ Next steps:
  1. Copy compiled models to web server
  2. Configure WebLLM with model URLs
  3. Test browser inference

→ See DEPLOYMENT.md in each output directory for integration guide
```

**Verify with:**

```powershell
# Quick verification
Get-ChildItem dist\vetrate-auditor-web\params\params_shard_*.bin

# Should show 3-5 files totaling 1.5-2.5 GB
```

---

**Ready to execute:** `.\compile_to_webgpu.ps1 -SwarmMember auditor`

**Next:** WebLLM integration into Vet-Rate.org production

*"From PyTorch to WebGPU: The final transformation."*
