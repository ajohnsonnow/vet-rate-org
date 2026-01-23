# 🚀 STEP 4: TRAINING & MERGING GUIDE

**Status:** Ready for Execution  
**Script:** `train_and_merge.ps1`  
**Duration:** 3.5-7 hours (sequential training)  
**Output:** Standalone merged models ready for MLC compilation

---

## 🎯 CRITICAL CONCEPT: WHY MERGING IS REQUIRED

### The WebLLM Problem
```
❌ WebLLM Cannot Use:
   Base Model (3B) + LoRA Adapter (separate files)
   
✅ WebLLM Requires:
   Merged Model (3B with adapter integrated)
```

### The Solution
```python
# Training produces:
models/lora-adapters/vetrate-auditor-3b/
├── adapter_config.json
├── adapter_model.safetensors   # ~30 MB
└── checkpoints/

# Merging creates:
models/merged-models/VetRate-Auditor-3B-v1/
├── config.json
├── pytorch_model.bin           # ~6 GB (merged)
├── tokenizer.json
└── ... (complete standalone model)

# MLC Compilation needs:
The merged model directory (single unified model)
```

---

## 📋 QUICK START

### Basic Usage
```powershell
# Train and merge Auditor (2-4 hours)
.\train_and_merge.ps1 -SwarmMember auditor

# Train and merge Writer (1.5-3 hours)
.\train_and_merge.ps1 -SwarmMember writer

# Train and merge both (3.5-7 hours)
.\train_and_merge.ps1 -SwarmMember both
```

### Advanced Options
```powershell
# Dry run (test without executing)
.\train_and_merge.ps1 -SwarmMember auditor -DryRun

# Skip validation (if already validated)
.\train_and_merge.ps1 -SwarmMember auditor -SkipValidation

# Skip merge (only train adapter)
.\train_and_merge.ps1 -SwarmMember auditor -SkipMerge
```

---

## 🔍 WHAT THE SCRIPT DOES

### Phase 1: Prerequisites Check (30 seconds)
```
✅ Python installed and accessible
✅ NVIDIA drivers working (nvidia-smi)
✅ Axolotl installed and in PATH
✅ PyTorch with CUDA support
✅ Disk space (10+ GB recommended)
✅ Config files exist and valid
```

### Phase 2: GPU Monitoring (Background)
```
Starts background job logging every 10 seconds:
- GPU utilization %
- VRAM usage (MB)
- Temperature (°C)
- Power draw (W)

Saved to: logs/gpu_monitor_YYYYMMDD_HHMMSS.csv
```

### Phase 3: LoRA Training (2-4 hours)
```powershell
# Sets environment
$env:CUDA_VISIBLE_DEVICES = "0"  # Force RTX 4080 Super

# Executes
cd axolotl-configs
axolotl train auditor-3b-qlora.yml

# Monitors
Watch for:
✅ Loss decreasing over epochs
✅ GPU utilization 90-100%
✅ VRAM 11-12 GB / 16 GB
✅ Eval loss ≈ Train loss
```

### Phase 4: Adapter Merging (5-10 minutes)
```powershell
# Executes
python -m axolotl.cli.merge_lora \
    auditor-3b-qlora.yml \
    --lora_model_dir ../models/lora-adapters/vetrate-auditor-3b \
    --output_dir ../models/merged-models/VetRate-Auditor-3B-v1

# Creates
Single unified model with adapter weights integrated
```

### Phase 5: Validation (1 minute)
```
Checks merged model:
✅ config.json exists
✅ tokenizer files present
✅ Model weights (.safetensors or .bin)
✅ Total size ~6-7 GB
```

---

## 📊 MONITORING TRAINING

### In Real-Time (Console Output)
```
Look for these patterns:

✅ GOOD:
{'loss': 2.5, 'learning_rate': 0.0002, 'epoch': 0.1}
{'loss': 1.8, 'learning_rate': 0.00019, 'epoch': 0.2}
{'loss': 1.2, 'learning_rate': 0.00018, 'epoch': 0.3}
→ Loss is decreasing steadily

{'eval_loss': 1.3, 'eval_runtime': 45.2}
→ Eval close to train (1.3 vs 1.2 = no overfit)

⚠️ WARNING:
{'loss': 1.5, 'learning_rate': 0.0002, 'epoch': 0.5}
{'loss': 1.4, 'learning_rate': 0.00019, 'epoch': 0.6}
{'loss': 1.4, 'learning_rate': 0.00018, 'epoch': 0.7}
→ Loss plateaued (may need more epochs or higher LR)

❌ BAD:
{'eval_loss': 2.5, 'eval_runtime': 45.2}  # Train was 1.2
→ Overfitting (eval >> train by 1.3)

{'loss': NaN, 'learning_rate': 0.0002, 'epoch': 0.1}
→ Training diverged (reduce learning rate)
```

### Separate Terminal (GPU Monitor)
```powershell
# Watch GPU in real-time
nvidia-smi -l 5

Target Metrics:
✅ GPU Utilization:    90-100%
✅ Memory Used:        11000-12000 MiB / 16384 MiB
✅ Temperature:        70-80°C (under 85°C)
✅ Power Draw:         250-320W (RTX 4080 Super)
```

### Post-Training (Log Analysis)
```powershell
# GPU monitor log
Get-Content logs/gpu_monitor_*.csv | Select-Object -Last 20

# Training log (if using wandb)
# View at: https://wandb.ai/your-project
```

---

## 🛑 TROUBLESHOOTING

### Out of Memory (OOM)
```
Error: CUDA out of memory

Solution 1: Reduce batch size
Edit axolotl-configs/auditor-3b-qlora.yml:
  micro_batch_size: 2  # Was 4
  gradient_accumulation_steps: 8  # Was 4 (keeps effective=16)

Solution 2: Reduce sequence length
  sequence_len: 2048  # Was 4096

Solution 3: Kill other GPU processes
  taskkill /F /IM python.exe
  taskkill /F /IM node.exe
```

### Training Diverges (NaN Loss)
```
Error: loss = NaN after few steps

Solution: Reduce learning rate
Edit axolotl-configs/auditor-3b-qlora.yml:
  learning_rate: 0.0001  # Was 0.0002
  warmup_steps: 100  # Was 50
```

### Merge Fails
```
Error: Cannot find adapter_model.safetensors

Check: Training completed successfully?
  dir models\lora-adapters\vetrate-auditor-3b
  
Should see:
  adapter_config.json
  adapter_model.safetensors  (~30 MB)

If missing: Training didn't complete - check logs
```

### Slow Training
```
Issue: Steps taking 60+ seconds each

Check 1: Flash Attention enabled?
  grep "flash_attention" axolotl-configs/auditor-3b-qlora.yml
  # Should be: flash_attention: true

Check 2: GPU being used?
  nvidia-smi
  # Should show python process using GPU

Check 3: Other processes competing?
  taskkill /F /IM chrome.exe  # If running heavy browser tasks
```

---

## ⏱️ EXPECTED TIMELINE

### VetRate-Auditor
```
Phase                Duration      Output
─────────────────────────────────────────────────────────────
Prerequisites        30 sec        Validation passed
Training Start       1 min         Base model loaded (4-bit)
Epoch 1              45-75 min     Loss: 2.5 → 1.2
Epoch 2              45-75 min     Loss: 1.2 → 0.8
Epoch 3              45-75 min     Loss: 0.8 → 0.6
Training Complete    5 min         Adapter saved (~30 MB)
Merging              5-10 min      Merged model (~6 GB)
Validation           1 min         Files verified
─────────────────────────────────────────────────────────────
TOTAL                2-4 hours     VetRate-Auditor-3B-v1/
```

### VetRate-Writer
```
Phase                Duration      Output
─────────────────────────────────────────────────────────────
Prerequisites        30 sec        Validation passed
Training Start       1 min         Base model loaded (4-bit)
Epoch 1              20-40 min     Loss: 2.3 → 1.1
Epoch 2              20-40 min     Loss: 1.1 → 0.7
Epoch 3              20-40 min     Loss: 0.7 → 0.5
Epoch 4              20-40 min     Loss: 0.5 → 0.4
Training Complete    5 min         Adapter saved (~25 MB)
Merging              5-10 min      Merged model (~6 GB)
Validation           1 min         Files verified
─────────────────────────────────────────────────────────────
TOTAL                1.5-3 hours   VetRate-Writer-3B-v1/
```

### Both (Sequential)
```
Auditor:   2-4 hours
Writer:    1.5-3 hours
TOTAL:     3.5-7 hours
```

---

## ✅ SUCCESS CRITERIA

### After Training
```powershell
# Check adapter exists
dir models\lora-adapters\vetrate-auditor-3b\adapter_model.safetensors

# Should be 20-50 MB
# If 0 bytes or missing: training failed
```

### After Merging
```powershell
# Check merged model
dir models\merged-models\VetRate-Auditor-3B-v1\

Should contain:
  config.json                    (model architecture)
  tokenizer.json                 (tokenization rules)
  tokenizer_config.json          (tokenizer settings)
  pytorch_model.bin              (~6 GB, merged weights)
  OR
  model.safetensors              (~6 GB, safer format)

Total size: 6-7 GB
```

### Final Validation
```powershell
# Test merged model loads
python -c "
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained('models/merged-models/VetRate-Auditor-3B-v1')
tokenizer = AutoTokenizer.from_pretrained('models/merged-models/VetRate-Auditor-3B-v1')
print('✅ Model loads successfully')
"
```

---

## 📁 OUTPUT STRUCTURE

```
llm-compiler/
├── models/
│   ├── lora-adapters/
│   │   ├── vetrate-auditor-3b/
│   │   │   ├── adapter_config.json
│   │   │   ├── adapter_model.safetensors  (~30 MB)
│   │   │   └── checkpoint-XXX/  (can delete)
│   │   └── vetrate-writer-3b/
│   │       ├── adapter_config.json
│   │       └── adapter_model.safetensors  (~25 MB)
│   └── merged-models/  (READY FOR MLC)
│       ├── VetRate-Auditor-3B-v1/  (~6 GB)
│       │   ├── config.json
│       │   ├── pytorch_model.bin
│       │   ├── tokenizer.json
│       │   └── tokenizer_config.json
│       └── VetRate-Writer-3B-v1/  (~6 GB)
│           ├── config.json
│           ├── pytorch_model.bin
│           ├── tokenizer.json
│           └── tokenizer_config.json
└── logs/
    └── gpu_monitor_YYYYMMDD_HHMMSS.csv
```

---

## 🎯 WHAT HAPPENS NEXT (STEP 5)

After successful merge, you'll have standalone models ready for:

### MLC-LLM Compilation
```bash
# Convert to MLC format
mlc_llm convert_weight \
    models/merged-models/VetRate-Auditor-3B-v1/ \
    --quantization q4f16 \
    --output mlc-models/vetrate-auditor-q4f16

# Compile to WebGPU
mlc_llm compile \
    mlc-models/vetrate-auditor-q4f16/params \
    --target webgpu \
    --output mlc-dist/vetrate-auditor-webgpu
```

### WebLLM Deployment
```javascript
// Browser-side inference
import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine(
  "VetRate-Auditor-3B",
  { 
    modelUrl: "./mlc-dist/vetrate-auditor-webgpu"
  }
);

// Hot-swap adapters
await engine.unload();
await engine.reload("VetRate-Writer-3B");
```

---

## 🔍 SCRIPT PARAMETERS REFERENCE

| Parameter | Values | Description |
|-----------|--------|-------------|
| `-SwarmMember` | `auditor`, `writer`, `both` | Which swarm to train |
| `-SkipValidation` | Switch | Skip prerequisite checks |
| `-SkipMerge` | Switch | Only train, don't merge |
| `-DryRun` | Switch | Test without executing |

### Examples
```powershell
# Standard execution
.\train_and_merge.ps1 -SwarmMember auditor

# Quick test
.\train_and_merge.ps1 -SwarmMember auditor -DryRun

# Training only (no merge)
.\train_and_merge.ps1 -SwarmMember auditor -SkipMerge

# Both swarms, skip prereq check
.\train_and_merge.ps1 -SwarmMember both -SkipValidation
```

---

## 💎 DIAMOND QUALITY CHECKLIST

Before you start:
- [ ] RTX 4080 Super visible (`nvidia-smi`)
- [ ] Axolotl installed (`axolotl version`)
- [ ] 10+ GB disk space available
- [ ] No other GPU processes running
- [ ] Config files validated (`python validate_configs.py`)
- [ ] Training data present (`dir training-data\*.jsonl`)

During training:
- [ ] GPU utilization 90-100%
- [ ] VRAM usage 11-12 GB
- [ ] Loss decreasing
- [ ] No NaN values
- [ ] Temperature <85°C

After completion:
- [ ] Adapter files exist (20-50 MB)
- [ ] Merged model created (6-7 GB)
- [ ] Validation passed
- [ ] Model loads in transformers

---

**Ready to execute:** `.\train_and_merge.ps1 -SwarmMember auditor`

*"Training creates adapters. Merging creates magic."*
