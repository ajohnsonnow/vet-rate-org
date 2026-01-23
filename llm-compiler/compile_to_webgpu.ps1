#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Compiles merged LoRA models to WebGPU format using MLC-LLM.

.DESCRIPTION
    Automates the MLC-LLM compilation pipeline:
    1. Validates merged models exist
    2. Converts weights to MLC format with q4f16_1 quantization
    3. Compiles to WebGPU using CUDA acceleration
    4. Verifies params_shard files
    5. Generates deployment-ready artifacts
    
    This creates browser-ready models for WebLLM integration.

.PARAMETER SwarmMember
    Which swarm model to compile: 'auditor', 'writer', or 'both'

.PARAMETER SkipValidation
    Skip prerequisite and merged model validation

.PARAMETER DryRun
    Show what would be executed without running commands

.PARAMETER CleanBuild
    Remove existing output before compilation

.EXAMPLE
    .\compile_to_webgpu.ps1 -SwarmMember auditor
    Compiles VetRate-Auditor to WebGPU format

.EXAMPLE
    .\compile_to_webgpu.ps1 -SwarmMember both -CleanBuild
    Compiles both models with fresh output directories

.NOTES
    Author: VetRate.org Development Team
    Version: 1.0.0
    Requires: MLC-LLM, CUDA Toolkit, Python 3.10+
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('auditor', 'writer', 'both')]
    [string]$SwarmMember,
    
    [switch]$SkipValidation,
    [switch]$DryRun,
    [switch]$CleanBuild
)

# ============================================================================
# GLOBAL CONFIGURATION
# ============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

$SCRIPT_ROOT = $PSScriptRoot
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_ROOT
$MERGED_MODELS_DIR = Join-Path $SCRIPT_ROOT "models\merged-models"
$DIST_DIR = Join-Path $SCRIPT_ROOT "dist"

# MLC-LLM Configuration
$MLC_QUANTIZATION = "q4f16_1"  # Optimal for browser (4-bit weights, FP16 activations)
$MLC_DEVICE = "cuda:0"          # Force RTX 4080 Super
$MLC_PARALLEL_COMPILE = 8       # Parallel compilation threads

# Swarm Configurations
$SWARM_CONFIGS = @{
    auditor = @{
        MergedDir = Join-Path $MERGED_MODELS_DIR "VetRate-Auditor-3B-v1"
        OutputDir = Join-Path $DIST_DIR "vetrate-auditor-web"
        ModelName = "VetRate-Auditor-3B"
        DisplayName = "VetRate Auditor (VA Regulations Expert)"
    }
    writer = @{
        MergedDir = Join-Path $MERGED_MODELS_DIR "VetRate-Writer-3B-v1"
        OutputDir = Join-Path $DIST_DIR "vetrate-writer-web"
        ModelName = "VetRate-Writer-3B"
        DisplayName = "VetRate Writer (Advocacy Specialist)"
    }
}

# ============================================================================
# LOGGING UTILITIES
# ============================================================================

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host " $Text" -ForegroundColor White
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Text)
    Write-Host "✓ $Text" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Text)
    Write-Host "⚠ $Text" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Text)
    Write-Host "→ $Text" -ForegroundColor Cyan
}

function Write-Error {
    param([string]$Text)
    Write-Host "✗ $Text" -ForegroundColor Red
}

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host "▶ $Text" -ForegroundColor Magenta -BackgroundColor Black
    Write-Host ""
}

# ============================================================================
# PREREQUISITE VALIDATION
# ============================================================================

function Test-Prerequisites {
    Write-Header "VALIDATING PREREQUISITES"
    
    $allValid = $true
    
    # Check Python
    Write-Info "Checking Python installation..."
    try {
        $pythonVersion = python --version 2>&1
        if ($pythonVersion -match "Python (\d+)\.(\d+)") {
            $major = [int]$Matches[1]
            $minor = [int]$Matches[2]
            if ($major -ge 3 -and $minor -ge 10) {
                Write-Success "Python $major.$minor detected"
            } else {
                Write-Error "Python 3.10+ required (found $major.$minor)"
                $allValid = $false
            }
        }
    } catch {
        Write-Error "Python not found in PATH"
        $allValid = $false
    }
    
    # Check CUDA
    Write-Info "Checking CUDA toolkit..."
    try {
        $nvccVersion = nvcc --version 2>&1
        if ($nvccVersion -match "release (\d+\.\d+)") {
            Write-Success "CUDA $($Matches[1]) detected"
        }
    } catch {
        Write-Warning "CUDA toolkit not found (compilation will be slow)"
    }
    
    # Check GPU
    Write-Info "Checking NVIDIA GPU..."
    try {
        $gpuInfo = nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>&1
        if ($gpuInfo -match "RTX 4080") {
            Write-Success "GPU: $gpuInfo"
        } else {
            Write-Warning "GPU detected but not RTX 4080: $gpuInfo"
        }
    } catch {
        Write-Error "nvidia-smi failed - NVIDIA drivers not installed?"
        $allValid = $false
    }
    
    # Check MLC-LLM
    Write-Info "Checking MLC-LLM installation..."
    try {
        $mlcVersion = python -c "import mlc_llm; print(mlc_llm.__version__)" 2>&1
        if ($mlcVersion -and $mlcVersion -notmatch "ModuleNotFoundError") {
            Write-Success "MLC-LLM $mlcVersion detected"
        } else {
            throw "MLC-LLM not installed"
        }
    } catch {
        Write-Error "MLC-LLM not found. Install: pip install mlc-llm mlc-ai-nightly"
        $allValid = $false
    }
    
    # Check disk space
    Write-Info "Checking disk space..."
    $drive = (Get-Item $SCRIPT_ROOT).PSDrive.Name
    $freeSpace = (Get-PSDrive $drive).Free / 1GB
    if ($freeSpace -gt 20) {
        Write-Success "Free space: $([math]::Round($freeSpace, 1)) GB"
    } else {
        Write-Warning "Low disk space: $([math]::Round($freeSpace, 1)) GB (20+ GB recommended)"
    }
    
    if (-not $allValid) {
        throw "Prerequisites validation failed. Fix errors above and retry."
    }
    
    Write-Success "All prerequisites validated"
}

# ============================================================================
# MODEL VALIDATION
# ============================================================================

function Test-MergedModel {
    param(
        [string]$ModelPath,
        [string]$ModelName
    )
    
    Write-Info "Validating merged model: $ModelName"
    
    if (-not (Test-Path $ModelPath)) {
        Write-Error "Merged model not found: $ModelPath"
        Write-Info "Run train_and_merge.ps1 first to create merged models"
        return $false
    }
    
    # Check required files
    $requiredFiles = @(
        "config.json",
        "tokenizer.json",
        "tokenizer_config.json"
    )
    
    foreach ($file in $requiredFiles) {
        $filePath = Join-Path $ModelPath $file
        if (-not (Test-Path $filePath)) {
            Write-Error "Missing required file: $file"
            return $false
        }
    }
    
    # Check for model weights (safetensors or pytorch_model.bin)
    $safetensors = Get-ChildItem -Path $ModelPath -Filter "*.safetensors" -ErrorAction SilentlyContinue
    $pytorchBin = Join-Path $ModelPath "pytorch_model.bin"
    
    if ($safetensors.Count -gt 0) {
        Write-Success "Found model weights: $($safetensors.Count) .safetensors file(s)"
        $totalSize = ($safetensors | Measure-Object -Property Length -Sum).Sum / 1GB
    } elseif (Test-Path $pytorchBin) {
        Write-Success "Found model weights: pytorch_model.bin"
        $totalSize = (Get-Item $pytorchBin).Length / 1GB
    } else {
        Write-Error "No model weights found (.safetensors or pytorch_model.bin)"
        return $false
    }
    
    Write-Info "Model size: $([math]::Round($totalSize, 2)) GB"
    
    if ($totalSize -lt 2 -or $totalSize -gt 10) {
        Write-Warning "Unexpected model size (expected 5-7 GB for 3B model)"
    }
    
    return $true
}

# ============================================================================
# MLC COMPILATION FUNCTIONS
# ============================================================================

function New-MLCConfig {
    param(
        [string]$ModelPath,
        [string]$OutputDir,
        [string]$ModelName
    )
    
    Write-Info "Generating MLC configuration for $ModelName"
    
    # Create mlc-chat-config.json
    $mlcConfig = @{
        model_type = "llama"
        quantization = $MLC_QUANTIZATION
        model_name = $ModelName
        conv_template = "llama-3"
        context_window_size = 4096
        prefill_chunk_size = 2048
        tensor_parallel_shards = 1
    } | ConvertTo-Json -Depth 10
    
    $configPath = Join-Path $ModelPath "mlc-chat-config.json"
    $mlcConfig | Set-Content -Path $configPath -Encoding UTF8
    
    Write-Success "MLC config created: mlc-chat-config.json"
}

function Invoke-MLCConversion {
    param(
        [string]$ModelPath,
        [string]$OutputDir,
        [string]$ModelName
    )
    
    Write-Step "PHASE 1: Weight Conversion to MLC Format"
    
    # Create output directory
    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }
    
    # MLC weight conversion command
    $convertCmd = "python -m mlc_llm convert_weight " +
                  """$ModelPath"" " +
                  "--quantization $MLC_QUANTIZATION " +
                  "--output ""$OutputDir"" " +
                  "--device $MLC_DEVICE"
    
    Write-Info "Command: $convertCmd"
    Write-Info "This will quantize 3B parameters to 4-bit (6GB → 2GB)"
    Write-Info "Estimated time: 2-5 minutes on RTX 4080 Super"
    Write-Host ""
    
    if ($DryRun) {
        Write-Warning "[DRY RUN] Skipping weight conversion"
        return $true
    }
    
    try {
        $startTime = Get-Date
        Invoke-Expression $convertCmd
        $duration = (Get-Date) - $startTime
        
        Write-Success "Weight conversion completed in $($duration.TotalMinutes.ToString('0.0')) minutes"
        return $true
    } catch {
        Write-Error "Weight conversion failed: $_"
        return $false
    }
}

function Invoke-MLCCompilation {
    param(
        [string]$OutputDir,
        [string]$ModelName
    )
    
    Write-Step "PHASE 2: Model Compilation to WebGPU"
    
    # MLC compilation command for WebGPU target
    $compileCmd = "python -m mlc_llm compile " +
                  """$OutputDir/params"" " +
                  "--target webgpu " +
                  "--opt O3 " +
                  "--system-lib-prefix ""$ModelName"" " +
                  "--output ""$OutputDir"" " +
                  "--device $MLC_DEVICE " +
                  "-j $MLC_PARALLEL_COMPILE"
    
    Write-Info "Command: $compileCmd"
    Write-Info "This generates WebGPU-compatible model library"
    Write-Info "Estimated time: 5-15 minutes on RTX 4080 Super"
    Write-Host ""
    
    if ($DryRun) {
        Write-Warning "[DRY RUN] Skipping model compilation"
        return $true
    }
    
    try {
        $startTime = Get-Date
        Invoke-Expression $compileCmd
        $duration = (Get-Date) - $startTime
        
        Write-Success "Model compilation completed in $($duration.TotalMinutes.ToString('0.0')) minutes"
        return $true
    } catch {
        Write-Error "Model compilation failed: $_"
        return $false
    }
}

# ============================================================================
# VERIFICATION FUNCTIONS
# ============================================================================

function Test-MLCOutput {
    param(
        [string]$OutputDir,
        [string]$ModelName
    )
    
    Write-Step "PHASE 3: Output Verification"
    
    Write-Info "Checking compiled artifacts in: $OutputDir"
    
    $allValid = $true
    
    # Check params directory
    $paramsDir = Join-Path $OutputDir "params"
    if (Test-Path $paramsDir) {
        Write-Success "Params directory exists"
        
        # Check for params_shard files
        $shards = Get-ChildItem -Path $paramsDir -Filter "params_shard_*.bin" -ErrorAction SilentlyContinue
        if ($shards.Count -gt 0) {
            Write-Success "Found $($shards.Count) params_shard file(s)"
            
            $totalSize = ($shards | Measure-Object -Property Length -Sum).Sum / 1MB
            Write-Info "Total params size: $([math]::Round($totalSize, 1)) MB"
            
            # Expected size for q4f16_1 quantized 3B model: ~1.5-2.5 GB
            if ($totalSize -lt 1000 -or $totalSize -gt 3000) {
                Write-Warning "Unexpected params size (expected 1.5-2.5 GB for q4f16_1 3B model)"
            }
            
            # Verify each shard
            Write-Info "Verifying shard integrity..."
            foreach ($shard in $shards) {
                $size = $shard.Length / 1MB
                if ($size -eq 0) {
                    Write-Error "Empty shard: $($shard.Name)"
                    $allValid = $false
                } else {
                    Write-Info "  $($shard.Name): $([math]::Round($size, 1)) MB"
                }
            }
        } else {
            Write-Error "No params_shard files found in $paramsDir"
            $allValid = $false
        }
        
        # Check for ndarray-cache.json
        $ndArrayCache = Join-Path $paramsDir "ndarray-cache.json"
        if (Test-Path $ndArrayCache) {
            Write-Success "Found ndarray-cache.json (metadata)"
        } else {
            Write-Warning "Missing ndarray-cache.json (may cause loading issues)"
        }
    } else {
        Write-Error "Params directory not found: $paramsDir"
        $allValid = $false
    }
    
    # Check for model library (WASM/JavaScript)
    $libFiles = Get-ChildItem -Path $OutputDir -Filter "$ModelName*.wasm" -ErrorAction SilentlyContinue
    if ($libFiles.Count -gt 0) {
        Write-Success "Found $($libFiles.Count) WASM library file(s)"
        foreach ($lib in $libFiles) {
            $size = $lib.Length / 1MB
            Write-Info "  $($lib.Name): $([math]::Round($size, 2)) MB"
        }
    } else {
        Write-Warning "No WASM library found (may be generated separately)"
    }
    
    # Check for model config
    $modelConfig = Join-Path $OutputDir "mlc-chat-config.json"
    if (Test-Path $modelConfig) {
        Write-Success "Found mlc-chat-config.json"
    } else {
        Write-Warning "Missing mlc-chat-config.json"
    }
    
    if ($allValid) {
        Write-Success "All critical artifacts verified"
    } else {
        Write-Error "Output verification failed - some artifacts missing or invalid"
    }
    
    return $allValid
}

function Write-DeploymentGuide {
    param(
        [string]$OutputDir,
        [string]$ModelName
    )
    
    $guidePath = Join-Path $OutputDir "DEPLOYMENT.md"
    
    $guideContent = @"
# 🚀 WebLLM Deployment Guide: $ModelName

**Compiled:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")  
**Quantization:** $MLC_QUANTIZATION (4-bit weights, FP16 activations)  
**Target:** WebGPU (browser-based inference)

---

## 📦 Deployment Artifacts

``````
$OutputDir/
├── params/
│   ├── params_shard_*.bin       (Quantized model weights)
│   └── ndarray-cache.json       (Metadata)
├── $ModelName*.wasm             (WebAssembly model library)
└── mlc-chat-config.json         (Model configuration)
``````

---

## 🌐 WebLLM Integration

### Step 1: Install WebLLM

``````bash
npm install @mlc-ai/web-llm
``````

### Step 2: Configure Model

``````javascript
// src/config/mlc-models.js
export const VETRATE_MODELS = {
  auditor: {
    model_url: "/models/vetrate-auditor-web/",
    model_id: "VetRate-Auditor-3B-q4f16_1",
    model_lib_url: "/models/vetrate-auditor-web/$ModelName-webgpu.wasm"
  }
};
``````

### Step 3: Initialize Engine

``````javascript
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { VETRATE_MODELS } from "./config/mlc-models";

// Initialize engine
const engine = await CreateMLCEngine(
  VETRATE_MODELS.auditor.model_id,
  { 
    initProgressCallback: (progress) => {
      console.log("Loading:", progress.text);
    }
  }
);

// Generate response
const response = await engine.chat.completions.create({
  messages: [
    {
      role: "system",
      content: "You are a VA disability rating expert."
    },
    {
      role: "user", 
      content: "What's the bilateral factor for 70% + 50%?"
    }
  ]
});

console.log(response.choices[0].message.content);
``````

### Step 4: Hot-Swap Models

``````javascript
// Switch from Auditor to Writer
await engine.unload();
await engine.reload(VETRATE_MODELS.writer.model_id);
``````

---

## 📊 Performance Characteristics

### Model Size
- **Original (FP16):** ~6 GB
- **Quantized (q4f16_1):** ~2 GB
- **Compression Ratio:** 3:1

### Browser Requirements
- **WebGPU:** Required (Chrome 113+, Edge 113+)
- **RAM:** 4 GB minimum recommended
- **VRAM:** 2.5 GB (for model + activations)

### Inference Speed (Typical)
- **Prefill:** 50-100 tokens/sec
- **Decode:** 20-40 tokens/sec
- **Latency:** ~200ms for short responses

---

## 🔍 Verification

### Test Model Loading

``````javascript
// Quick verification script
import { CreateMLCEngine } from "@mlc-ai/web-llm";

async function testModel() {
  try {
    const engine = await CreateMLCEngine("$ModelName");
    console.log("✅ Model loaded successfully");
    
    const response = await engine.chat.completions.create({
      messages: [{ role: "user", content: "Test" }],
      max_tokens: 10
    });
    
    console.log("✅ Inference working:", response.choices[0].message.content);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testModel();
``````

### Check Params Shards

``````powershell
# Verify shard files
Get-ChildItem "$OutputDir\params\params_shard_*.bin" | ForEach-Object {
  `$size = `$_.Length / 1MB
  Write-Host "`$(`$_.Name): `$([math]::Round(`$size, 1)) MB"
}
``````

---

## 🚨 Troubleshooting

### Model Won't Load

**Check browser compatibility:**
``````javascript
if (!navigator.gpu) {
  console.error("WebGPU not supported");
}
``````

**Verify CORS headers:**
``````javascript
// vite.config.js
export default {
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin"
    }
  }
}
``````

### Slow Inference

- Reduce context window (2048 instead of 4096)
- Lower max_tokens in generation config
- Check GPU acceleration is active (chrome://gpu)

### Out of Memory

- Close other tabs/applications
- Reduce prefill_chunk_size in config
- Use smaller quantization (q4f16_0 instead of q4f16_1)

---

## 📚 Resources

- [WebLLM Documentation](https://mlc.ai/web-llm/)
- [MLC-LLM GitHub](https://github.com/mlc-ai/mlc-llm)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)

---

**Next Steps:** Integrate into Vet-Rate.org production environment
"@

    $guideContent | Set-Content -Path $guidePath -Encoding UTF8
    Write-Success "Deployment guide created: DEPLOYMENT.md"
}

# ============================================================================
# MAIN PIPELINE
# ============================================================================

function Invoke-CompilationPipeline {
    param([string]$SwarmName)
    
    $config = $SWARM_CONFIGS[$SwarmName]
    
    Write-Header "COMPILING $($config.DisplayName)"
    Write-Info "Merged Model: $($config.MergedDir)"
    Write-Info "Output: $($config.OutputDir)"
    Write-Info "Quantization: $MLC_QUANTIZATION"
    Write-Info "Device: $MLC_DEVICE"
    Write-Host ""
    
    # Validate merged model
    if (-not (Test-MergedModel -ModelPath $config.MergedDir -ModelName $config.ModelName)) {
        throw "Merged model validation failed for $SwarmName"
    }
    
    # Clean build if requested
    if ($CleanBuild -and (Test-Path $config.OutputDir)) {
        Write-Warning "Removing existing output: $($config.OutputDir)"
        Remove-Item -Path $config.OutputDir -Recurse -Force
    }
    
    # Generate MLC config
    New-MLCConfig -ModelPath $config.MergedDir -OutputDir $config.OutputDir -ModelName $config.ModelName
    
    # Phase 1: Weight Conversion
    if (-not (Invoke-MLCConversion -ModelPath $config.MergedDir -OutputDir $config.OutputDir -ModelName $config.ModelName)) {
        throw "Weight conversion failed for $SwarmName"
    }
    
    # Phase 2: Model Compilation
    if (-not (Invoke-MLCCompilation -OutputDir $config.OutputDir -ModelName $config.ModelName)) {
        throw "Model compilation failed for $SwarmName"
    }
    
    # Phase 3: Verification
    if (-not (Test-MLCOutput -OutputDir $config.OutputDir -ModelName $config.ModelName)) {
        throw "Output verification failed for $SwarmName"
    }
    
    # Generate deployment guide
    Write-DeploymentGuide -OutputDir $config.OutputDir -ModelName $config.ModelName
    
    Write-Success "Compilation pipeline completed for $SwarmName"
}

# ============================================================================
# ENTRY POINT
# ============================================================================

function Main {
    try {
        Write-Header "MLC-LLM WebGPU Compilation Pipeline"
        
        Write-Info "Swarm Member: $SwarmMember"
        Write-Info "Quantization: $MLC_QUANTIZATION"
        Write-Info "Device: $MLC_DEVICE"
        Write-Info "Dry Run: $DryRun"
        Write-Info "Clean Build: $CleanBuild"
        Write-Host ""
        
        # Prerequisites
        if (-not $SkipValidation) {
            Test-Prerequisites
        } else {
            Write-Warning "Skipping prerequisite validation"
        }
        
        # Compile swarm(s)
        if ($SwarmMember -eq 'both') {
            Invoke-CompilationPipeline -SwarmName 'auditor'
            Write-Host ""
            Invoke-CompilationPipeline -SwarmName 'writer'
        } else {
            Invoke-CompilationPipeline -SwarmName $SwarmMember
        }
        
        # Final summary
        Write-Header "COMPILATION COMPLETE"
        
        Write-Success "WebGPU models ready for deployment"
        Write-Info "Output location: $DIST_DIR"
        Write-Host ""
        Write-Info "Next steps:"
        Write-Host "  1. Copy compiled models to web server"
        Write-Host "  2. Configure WebLLM with model URLs"
        Write-Host "  3. Test browser inference"
        Write-Host ""
        Write-Info "See DEPLOYMENT.md in each output directory for integration guide"
        
    } catch {
        Write-Host ""
        Write-Error "Pipeline failed: $_"
        Write-Host ""
        exit 1
    }
}

# Run main pipeline
Main
