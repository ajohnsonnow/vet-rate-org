# 🚀 QUICK START - SWARM TRAINING

## ⚡ ONE-COMMAND TRAINING

```bash
# Install Axolotl (one-time setup)
conda create -n axolotl python=3.10 && conda activate axolotl
git clone https://github.com/OpenAccess-AI-Collective/axolotl
cd axolotl && pip3 install -e '.[flash-attn,deepspeed]'

# Navigate to configs
cd /path/to/vet-rate-org-official/llm-compiler/axolotl-configs

# Train Auditor (2-4 hours)
axolotl train auditor-3b-qlora.yml

# Train Writer (1.5-3 hours)
axolotl train writer-3b-qlora.yml
```

---

## 📋 PRE-FLIGHT CHECKLIST

- ✅ Data prepared: `training-data/*.jsonl` exist
- ✅ Configs validated: `python validate_configs.py`
- ✅ CUDA available: `nvidia-smi` shows RTX 4080
- ✅ Axolotl installed: `axolotl version` works
- ✅ Disk space: 5+ GB free for checkpoints
- ✅ No other GPU processes running

---

## 🎛️ CRITICAL SETTINGS (DO NOT CHANGE)

```yaml
load_in_4bit: true        # QLoRA - Required for 16GB
flash_attention: true     # 40-series optimization
bf16: true                # Ada architecture optimal
fp16: false               # DO NOT enable
```

---

## 🔧 SAFE TUNING KNOBS

### If OOM (Out of Memory):
```yaml
micro_batch_size: 2       # Was 4
gradient_accumulation_steps: 8  # Was 4 (keeps effective=16)
```

### If Underfitting (Loss not decreasing):
```yaml
num_epochs: 5             # Was 3
learning_rate: 0.0003     # Was 0.0002
```

### If Overfitting (Eval loss >> Train loss):
```yaml
num_epochs: 2             # Was 3
lora_dropout: 0.1         # Was 0.05
```

---

## 📊 WHAT TO WATCH

### GPU Monitor (separate terminal)
```bash
nvidia-smi -l 5  # Update every 5 seconds

Target Metrics:
✅ GPU Utilization: 90-100%
✅ VRAM: 11-12 GB / 16 GB
✅ Temperature: <85°C
✅ Power: 250-320W
```

### Training Logs
```
Look for:
✅ Loss decreasing over time
✅ Eval loss ≈ Train loss (no overfit)
✅ "steps/s" between 0.3-0.5 (30-50s per step)
```

---

## ⏱️ TIME ESTIMATES

| Swarm Member | Examples | Epochs | Time | Adapter Size |
|--------------|----------|--------|------|--------------|
| **Auditor**  | 1,338    | 3      | 2-4h | ~30 MB       |
| **Writer**   | 588      | 4      | 1.5-3h | ~25 MB     |

**Total Sequential:** 3.5-7 hours  
**Can be parallelized:** No (single GPU)

---

## ✅ SUCCESS INDICATORS

After training completes:

1. **Files exist:**
   ```bash
   ls models/lora-adapters/vetrate-auditor-3b/
   # adapter_config.json
   # adapter_model.safetensors
   ```

2. **Size is reasonable:**
   ```bash
   du -sh models/lora-adapters/vetrate-auditor-3b/
   # 20-50 MB (NOT gigabytes!)
   ```

3. **Final loss is low:**
   ```
   Train loss: <1.0
   Eval loss: <1.2
   ```

4. **Quick inference test:**
   ```bash
   axolotl inference auditor-3b-qlora.yml \
     --lora_model_dir ./models/lora-adapters/vetrate-auditor-3b
   
   Prompt: "What is Diagnostic Code 5000?"
   Expected: Cites 38 CFR accurately
   ```

---

## 🆘 EMERGENCY COMMANDS

### Training Stuck / Frozen
```bash
# Check if process alive
nvidia-smi

# Kill if needed
pkill -9 python

# Restart from checkpoint
axolotl train auditor-3b-qlora.yml  # Auto-resumes
```

### CUDA Out of Memory
```bash
# Free GPU memory
pkill -9 python
nvidia-smi --gpu-reset

# Reduce batch size in config
micro_batch_size: 2  # Edit YAML, then retry
```

### Disk Full
```bash
# Clean old checkpoints
rm -rf models/lora-adapters/*/checkpoint-*

# Keep only final adapter
```

---

## 📁 OUTPUT STRUCTURE

```
llm-compiler/
├── models/
│   └── lora-adapters/
│       ├── vetrate-auditor-3b/
│       │   ├── adapter_config.json
│       │   ├── adapter_model.safetensors
│       │   └── checkpoint-XXX/  (temp, delete after)
│       └── vetrate-writer-3b/
│           ├── adapter_config.json
│           └── adapter_model.safetensors
```

---

## ⏭️ AFTER TRAINING

1. ✅ Validate adapter quality (inference test)
2. 🔄 Convert to MLC format (WebGPU)
3. 📦 Quantize for browser (q4f16)
4. 🌐 Deploy to WebLLM (client-side)
5. 🚀 Integrate into Vet-Rate.org

See: `MLC_COMPILATION_GUIDE.md` (Step 4)

---

## 🔗 DOCUMENTATION REFERENCE

| Document | Purpose |
|----------|---------|
| `SWARM_DATA_PREP_COMPLETE.md` | Data pipeline summary |
| `AXOLOTL_TRAINING_GUIDE.md` | Full training guide |
| `RTX_4080_SUPER_SPECS.md` | Technical deep-dive |
| **This file** | Quick reference card |

---

## 💎 DIAMOND QUALITY CHECKLIST

Before you start training:

- [ ] Configs validated (`python validate_configs.py`)
- [ ] Dataset files present and correct size
- [ ] GPU not running other processes
- [ ] 5+ GB disk space available
- [ ] Terminal/log window ready for monitoring
- [ ] Coffee/snacks for 2-4 hour wait ☕

**Ready?** Run: `axolotl train auditor-3b-qlora.yml`

---

*"Simple commands, complex engineering underneath"*
