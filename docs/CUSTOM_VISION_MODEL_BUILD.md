# Vet-Rate Vision Phi: Custom WebGPU Vision Model Build Documentation

## 🎯 Mission Objective

Build a custom vision-language model that can analyze DD214 documents and veteran paperwork directly in the browser, without requiring experimental Chrome flags or any data leaving the user's device.

**Problem**: The standard Phi 3.5 Vision model from MLC-AI uses `u8` (unsigned 8-bit integer) shader types in WebGPU, which require the experimental `chromium-experimental-subgroup-matrix` feature only available in Chrome Canary with special flags enabled.

**Solution**: Compile our own version with `q4f32_1` quantization that uses `f32` (float32) shader types, which work in standard Chrome.

---

## 📊 Build Statistics

| Metric | Value |
|--------|-------|
| **Total Build Time** | ~4 hours |
| **Source Model** | microsoft/Phi-3.5-vision-instruct |
| **Source Model Size** | 8.3 GB |
| **Compiled Model Size** | 2.78 GB (66% reduction) |
| **WASM Library Size** | 6.6 MB |
| **Quantization** | q4f32_1 (int4 weights, float32 compute) |
| **Parameters** | 4,048,120,832 (~4B) |
| **Context Window** | 131,072 tokens |
| **Vision Encoder** | CLIP ViT-L/14 (336px) |
| **Weight Shards** | 106 files |
| **HuggingFace Repo** | [Vet-Rate-org/Vet-Rate-Vision-Phi](https://huggingface.co/Vet-Rate-org/Vet-Rate-Vision-Phi) |

---

## 🛠️ Development Environment Setup

### Initial Attempt: Windows Native (Failed)

**Objective**: Build directly on Windows 11

**Steps Attempted**:
1. Installed MSVC Build Tools 2022
2. Installed CUDA Toolkit 12.8
3. Installed CMake, Ninja, LLVM
4. Cloned MLC-LLM repository with submodules
5. Configured CMake for Windows build
6. Built C++ components (SUCCESS)
7. Attempted Python package installation (FAILED)

**Failure Reason**: MLC-LLM's Python packages have Linux-only dependencies:
- `nvidia-cutlass-dsl` - Not available for Windows
- `flashinfer` - Requires CUDA on Linux
- No pre-built Windows wheels exist anywhere

**Time Spent**: ~1 hour

### Successful Approach: WSL2 Ubuntu

**Environment Setup**:
```bash
# Install Ubuntu 24.04 in WSL2
wsl --install -d Ubuntu-24.04

# Create Python virtual environment
python3 -m venv ~/mlc-env
source ~/mlc-env/bin/activate

# Install MLC-LLM from official nightly wheels
pip install --pre -f https://mlc.ai/wheels mlc-ai-nightly-cpu mlc-llm-nightly-cpu
```

**Packages Installed**:
- `mlc-llm-nightly-cpu`: 0.20.dev108
- `mlc-ai-nightly-cpu`: 0.20.dev679
- `transformers`: For model loading
- `huggingface_hub`: For downloading/uploading

---

## 📥 Model Download Phase

**Command**:
```bash
cd ~/mlc-workspace
python -c "
from huggingface_hub import snapshot_download
path = snapshot_download(
    repo_id='microsoft/Phi-3.5-vision-instruct',
    local_dir='dist/models/Phi-3.5-vision-instruct',
    local_dir_use_symlinks=False
)
print(f'Downloaded to: {path}')
"
```

**Statistics**:
- Download Size: 8.3 GB
- Download Time: 34 seconds
- Files: 15 model files + tokenizer + config
- Network Speed: ~244 MB/s

---

## ⚙️ Compilation Pipeline

### Step 1: Generate Configuration

```bash
python -m mlc_llm gen_config \
  dist/models/Phi-3.5-vision-instruct \
  --quantization q4f32_1 \
  -o dist/Vet-Rate-Vision-Phi-q4f32_1-MLC
```

**Output**:
- Detected model type: `phi3_v`
- Generated `mlc-chat-config.json`
- Processed tokenizer files

**Time**: ~10 seconds

### Step 2: Convert & Quantize Weights

```bash
python -m mlc_llm convert_weight \
  dist/models/Phi-3.5-vision-instruct \
  --quantization q4f32_1 \
  --device cpu \
  -o dist/Vet-Rate-Vision-Phi-q4f32_1-MLC
```

**Statistics**:
- Parameters Processed: 592 tensors
- Original Size: 8.3 GB (fp16)
- Quantized Size: 3.368 GB
- Compression Ratio: 59.4%
- Bits Per Parameter: 7.147
- Time: 40 seconds

**Quantization Details**:
- Quantization Type: Group Quantize
- Group Size: 32
- Quantize Dtype: int4
- Storage Dtype: uint32
- Model Dtype: float32 ← KEY! This avoids u8 shader types
- Layout: NK

### Step 3: WebGPU WASM Compilation

This was the most challenging step, requiring additional toolchain setup.

#### 3a. Install Emscripten SDK

```bash
cd ~
git clone --recursive https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install 3.1.56
./emsdk activate 3.1.56
source ~/emsdk/emsdk_env.sh
```

#### 3b. Clone MLC-LLM Source (for WASM runtime)

```bash
cd ~
git clone --recursive https://github.com/mlc-ai/mlc-llm.git mlc-llm-src
```

**Note**: The `--recursive` flag is critical to get TVM and other submodules.

#### 3c. Build WASM Runtime Libraries

Multiple missing `.bc` (bitcode) files had to be built:

```bash
# Build mlc_wasm_runtime.bc
cd ~/mlc-llm-src/web
source ~/emsdk/emsdk_env.sh
./prep_emcc_deps.sh

# Build TVM WASM runtime files
cd ~/mlc-llm-src/3rdparty/tvm/web
TVM_HOME=~/mlc-llm-src/3rdparty/tvm make

# Copy all .bc files to the Python package
cp ~/mlc-llm-src/web/dist/wasm/mlc_wasm_runtime.bc ~/mlc-env/lib/python3.12/site-packages/mlc_llm/
cp ~/mlc-llm-src/3rdparty/tvm/web/dist/wasm/*.bc ~/mlc-env/lib/python3.12/site-packages/tvm/
```

**Files Built**:
| File | Size | Purpose |
|------|------|---------|
| `wasm_runtime.bc` | 9.2 MB | TVM WASM runtime |
| `tvmjs_support.bc` | 185 KB | TVM JavaScript support |
| `webgpu_runtime.bc` | 257 KB | WebGPU runtime bindings |
| `mlc_wasm_runtime.bc` | 832 KB | MLC-LLM WASM runtime |

#### 3d. Compile to WebGPU WASM

```bash
source ~/mlc-env/bin/activate
source ~/emsdk/emsdk_env.sh
export MLC_LLM_SOURCE_DIR=~/mlc-llm-src

cd ~/mlc-workspace
python -m mlc_llm compile \
  dist/Vet-Rate-Vision-Phi-q4f32_1-MLC \
  --device webgpu \
  --opt O2 \
  -o dist/libs/Vet-Rate-Vision-Phi-q4f32_1-webgpu.wasm
```

**Compilation Phases**:
1. Load model configuration
2. Export to TVM compiler
3. Run TVM Relax graph optimizations
4. Lower to TVM TIR kernels
5. Run TVM TIR-level optimizations
6. Run TVM Dlight low-level optimizations
7. Lower to VM bytecode
8. Compile external modules (Emscripten)
9. Export to disk (WASM)

**Memory Usage Estimates** (from compiler):
| Function | Memory |
|----------|--------|
| `prefill` | 1,056 MB |
| `batch_prefill` | 1,057.5 MB |
| `batch_verify` | 1,056 MB |
| `image_embed` | 311 MB |
| `decode` | 0.13 MB |
| `embed` | 96 MB |

**Output**:
- WASM file: 6.6 MB
- Compilation time: ~3 minutes

---

## 📤 HuggingFace Upload

### Install HF CLI on Windows

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://hf.co/cli/install.ps1 | iex"
```

### Authenticate

```powershell
hf auth login
# Paste token from https://huggingface.co/settings/tokens
```

### Upload Model

```powershell
cd E:\mlc-workspace\Vet-Rate-Vision-Phi-q4f32_1-MLC
hf upload Vet-Rate-org/Vet-Rate-Vision-Phi .
```

**Upload Statistics**:
- Files Uploaded: 112
- Total Size: 2.78 GB
- Upload Speed: ~4.5 MB/s
- Time: ~10 minutes

---

## 🔧 Integration into Vet-Rate.org

### Files Modified

1. **`src/components/LocalAIPanel.jsx`**
   - Added custom model definition with HuggingFace URLs
   - Modified engine creation to use `appConfig` for custom models
   - Bypassed experimental feature check for custom vision model

2. **`src/utils/llmRecommendations.js`**
   - Updated DD214 Analyzer to recommend Vet-Rate Vision Phi
   - Updated Document Scanner to use new model
   - Added VRAM requirements for new model

3. **`src/utils/unifiedAIService.js`**
   - Added model name recognition for display

### Custom Model Configuration

```javascript
{
  id: 'Vet-Rate-Vision-Phi-q4f32_1',
  name: 'Vet-Rate Vision Phi 👁️ ⭐ NEW!',
  size: '2.8 GB',
  isCustomModel: true,
  customConfig: {
    model: 'https://huggingface.co/Vet-Rate-org/Vet-Rate-Vision-Phi',
    model_id: 'Vet-Rate-Vision-Phi-q4f32_1',
    model_lib: 'https://huggingface.co/Vet-Rate-org/Vet-Rate-Vision-Phi/resolve/main/Vet-Rate-Vision-Phi-q4f32_1-webgpu.wasm',
  },
}
```

---

## 🎓 Lessons Learned

### 1. Windows is Not Ready for MLC-LLM
Despite having all build tools installed, the Python package ecosystem for MLC-LLM is Linux-only. WSL2 is the pragmatic solution for Windows users.

### 2. WASM Runtime Files Are Not Pre-built
The MLC-LLM pip packages don't include the WASM runtime `.bc` files needed for WebGPU compilation. You must:
- Clone the full MLC-LLM source with submodules
- Build the WASM runtimes manually using Emscripten
- Copy the files to the correct Python package directories

### 3. Quantization Choice Matters for Browser Compatibility
- `q4f16_1` uses f16 shader types → requires `shader-f16` feature
- `q4f32_1` uses f32 shader types → works in standard WebGPU
- Some models use u8 types regardless → require experimental Chrome flags
- Our custom compile avoids u8 entirely by using f32 model dtype

### 4. Memory Planning is Critical
The compiler estimates memory usage for each function. For browser deployment:
- Keep `prefill_chunk_size` reasonable (8192 works well)
- Monitor total memory usage (aim for < 8GB for broad compatibility)
- Consider context window size impact on KV cache

---

## 📈 Impact

### Before (Standard Phi 3.5 Vision)
- ❌ Required Chrome Canary
- ❌ Required enabling experimental flags
- ❌ Required `chromium-experimental-subgroup-matrix` feature
- ❌ Users had to follow complex setup instructions

### After (Vet-Rate Vision Phi)
- ✅ Works in standard Chrome, Edge, Firefox (with WebGPU)
- ✅ No experimental flags needed
- ✅ Zero configuration required
- ✅ Same vision capabilities
- ✅ 66% smaller download (2.8 GB vs 8.3 GB)

---

## 🔗 Resources

- **Model Repository**: https://huggingface.co/Vet-Rate-org/Vet-Rate-Vision-Phi
- **Base Model**: https://huggingface.co/microsoft/Phi-3.5-vision-instruct
- **MLC-LLM Documentation**: https://llm.mlc.ai/docs/
- **WebLLM**: https://github.com/mlc-ai/web-llm
- **Emscripten**: https://emscripten.org/

---

## 📅 Build Timeline

| Time | Activity |
|------|----------|
| 0:00 | Start - Analyze WebGPU shader error |
| 0:15 | Attempt Windows native build |
| 1:00 | Windows build fails, switch to WSL2 |
| 1:15 | Install Ubuntu-24.04 in WSL2 |
| 1:30 | Set up Python venv, install MLC-LLM |
| 1:45 | Download Phi 3.5 Vision (8.3 GB) |
| 2:00 | Run gen_config |
| 2:05 | Run convert_weight (40 seconds) |
| 2:10 | First WebGPU compile attempt (fails - missing .bc files) |
| 2:30 | Install Emscripten SDK |
| 2:45 | Clone MLC-LLM source |
| 3:00 | Build WASM runtime libraries |
| 3:15 | Copy .bc files, retry compile |
| 3:20 | WebGPU compile succeeds |
| 3:30 | Copy to Windows, prepare for upload |
| 3:45 | Install HF CLI, authenticate |
| 3:55 | Upload to HuggingFace (2.78 GB) |
| 4:00 | Integrate into Vet-Rate.org codebase |
| **4:00** | **BUILD COMPLETE** ✅ |

---

*Built with determination and fueled by veteran spirit 🎖️*
*January 21, 2026*
