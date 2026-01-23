# 💎 MLC-LLM WebGPU Compilation Guide

## Quick Command (Single Line)

```bash
# Compile VetRate-Auditor to WebGPU format
python3 -m mlc_llm compile ./models/merged/vetrate-auditor-merged \
    --quantization q4f16_1 \
    --device cuda:0 \
    --output ./dist/vetrate-auditor-web
```

---

## Full 3-Step Compilation Process

MLC-LLM compilation has three phases:

### Step 1: Convert Weights (Quantization)

```bash
python3 -m mlc_llm convert_weight \
    ./models/merged/vetrate-auditor-merged \
    --quantization q4f16_1 \
    --output ./dist/vetrate-auditor-web
```

**What this does:**
- Reads the full-precision merged model weights
- Quantizes to 4-bit (q4f16_1 format)
- Outputs `params_shard_*.bin` files (quantized weight chunks)
- Creates `ndarray-cache.json` (index of all weight shards)

### Step 2: Generate Config

```bash
python3 -m mlc_llm gen_config \
    ./models/merged/vetrate-auditor-merged \
    --quantization q4f16_1 \
    --conv-template llama-3 \
    --output ./dist/vetrate-auditor-web
```

**What this does:**
- Generates `mlc-chat-config.json` with model architecture
- Copies tokenizer files
- Sets conversation template for Llama-3 format

### Step 3: Compile Library (WebGPU)

```bash
python3 -m mlc_llm compile \
    ./dist/vetrate-auditor-web/mlc-chat-config.json \
    --device cuda:0 \
    --target webgpu \
    --output ./dist/vetrate-auditor-web/vetrate-auditor-web.wasm
```

**What this does:**
- Compiles model operations to WebAssembly
- Uses RTX 4080 (cuda:0) for fast TVM compilation
- Outputs `.wasm` file for browser execution

---

## Why q4f16_1?

| Quantization | Weights | Activations | Size (3B) | Quality | Use Case |
|--------------|---------|-------------|-----------|---------|----------|
| **q4f16_1** | 4-bit | fp16 | ~1.8 GB | ★★★★☆ | **Best balance** |
| q4f32_1 | 4-bit | fp32 | ~2.2 GB | ★★★★★ | High accuracy |
| q3f16_1 | 3-bit | fp16 | ~1.4 GB | ★★★☆☆ | Minimum size |
| q8f16_1 | 8-bit | fp16 | ~3.5 GB | ★★★★★ | Best quality |

**q4f16_1** is optimal because:
- **Small download**: ~1.8 GB for a 3B model (fits in browser cache)
- **Fast inference**: fp16 activations are GPU-optimized
- **Good accuracy**: 4-bit preserves most model quality
- **WebGPU compatible**: Standard format for WebLLM

---

## Verifying Successful Compilation

### Required Files Checklist

After compilation, `./dist/vetrate-auditor-web/` must contain:

| File | Purpose | Critical? |
|------|---------|-----------|
| `ndarray-cache.json` | Index of weight shards | **YES** |
| `params_shard_0.bin` | Quantized weights part 1 | **YES** |
| `params_shard_*.bin` | Additional weight shards | **YES** |
| `mlc-chat-config.json` | Model architecture config | **YES** |
| `tokenizer.json` | Text tokenization | **YES** |
| `tokenizer_config.json` | Tokenizer settings | Recommended |
| `*.wasm` | Compiled model library | Optional |

### Verification Commands

```bash
# Check all required files exist
ls -la ./dist/vetrate-auditor-web/

# Verify ndarray-cache.json has shards
cat ./dist/vetrate-auditor-web/ndarray-cache.json | head -20

# Check total size (should be ~1.8 GB for q4f16_1)
du -sh ./dist/vetrate-auditor-web/

# Count weight shards
ls ./dist/vetrate-auditor-web/params_shard_*.bin | wc -l
```

### Expected Output Structure

```
dist/vetrate-auditor-web/
├── mlc-chat-config.json          # Model config (~2 KB)
├── ndarray-cache.json            # Shard index (~50 KB)
├── params_shard_0.bin            # Weights (~500 MB)
├── params_shard_1.bin            # Weights (~500 MB)
├── params_shard_2.bin            # Weights (~500 MB)
├── params_shard_3.bin            # Weights (~300 MB)
├── tokenizer.json                # Tokenizer (~2 MB)
├── tokenizer_config.json         # Tokenizer config (~1 KB)
└── vetrate-auditor-web.wasm      # WASM library (~20 MB)

Total: ~1.8 GB
```

---

## How to Know if Compilation Succeeded vs Failed

### ✅ COMPILATION SUCCEEDED if:

1. **Exit code is 0** — No Python errors
2. **ndarray-cache.json exists** — WebLLM needs this to find weights
3. **params_shard_*.bin files exist** — Actual quantized model weights
4. **Total size ~1.5-2 GB** — Correct for q4f16_1 3B model
5. **mlc-chat-config.json exists** — Model architecture for WebLLM

### ❌ COMPILATION FAILED if:

1. **Python traceback** — Compilation error (check logs)
2. **No params_shard_*.bin** — Weight conversion failed
3. **Missing ndarray-cache.json** — Index generation failed
4. **Size < 1 GB** — Incomplete weight conversion
5. **"CUDA out of memory"** — Shouldn't happen for compilation
6. **"Model not found"** — Source path incorrect

### Quick Test: Load in Python

```python
# Test if model can be loaded
from mlc_llm import MLCEngine

engine = MLCEngine("./dist/vetrate-auditor-web")
response = engine.chat.completions.create(
    messages=[{"role": "user", "content": "What is 38 CFR?"}],
    max_tokens=100
)
print(response.choices[0].message.content)
```

---

## Compile All Three Swarm Members

```bash
# Use the script
./mlc-compile/compile_webgpu_v2.sh all

# Or manually
for role in auditor writer rater; do
    python3 -m mlc_llm compile \
        ./models/merged/vetrate-${role}-merged \
        --quantization q4f16_1 \
        --device cuda:0 \
        --output ./dist/vetrate-${role}-web
done
```

---

## Troubleshooting

### "Model config not found"
```bash
# Ensure merged model has config.json
ls ./models/merged/vetrate-auditor-merged/config.json
```

### "TVM compilation error"
```bash
# Try without CUDA acceleration
python3 -m mlc_llm compile ... --device cpu
```

### "Tokenizer not found"
```bash
# Copy tokenizer manually
cp ./models/merged/vetrate-auditor-merged/tokenizer*.json ./dist/vetrate-auditor-web/
```

### Slow compilation
```bash
# Ensure CUDA is being used
nvidia-smi  # Should show GPU activity during compilation
```

---

## Next Step: WebLLM Integration

After successful compilation, integrate into your web app:

```javascript
import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("vetrate-auditor-web", {
    modelLibraryUrlPrefix: "/dist/",
});
```

See `webllm-integration/` for full browser integration code.

---

*💎 Diamond Standard: Production-Ready WebGPU Compilation*
