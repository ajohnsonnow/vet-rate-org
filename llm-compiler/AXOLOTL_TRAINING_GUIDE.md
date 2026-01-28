# 🚀 AXOLOTL TRAINING GUIDE - RTX 4080 SUPER

**Status:** ✅ CONFIGURATIONS VALIDATED  
**Date:** January 22, 2026  
**Phase:** Step 3 of 5 (Axolotl Configuration)  
**Next:** LoRA Training Execution

---

## 📋 VALIDATION RESULTS

```
✅ auditor-3b-qlora.yml - ALL CHECKS PASSED
   • VRAM: 11.2 GB / 16 GB (70% utilization)
   • Dataset: 1,338 train / 71 validation
   • Effective Batch: 16 (4 micro × 4 grad accum)

✅ writer-3b-qlora.yml - ALL CHECKS PASSED
   • VRAM: 11.2 GB / 16 GB (70% utilization)
   • Dataset: 588 train / 31 validation
   • Effective Batch: 16 (4 micro × 4 grad accum)
```

---

## 🎯 CRITICAL RTX 4080 SUPER OPTIMIZATIONS

### ✅ Hardware Acceleration

```yaml
flash_attention: true          # Native 40-series support
bf16: true                     # BFloat16 (superior to fp16 on Ada)
fp16: false                    # Disabled - bf16 is optimal
load_in_4bit: true            # QLoRA saves ~10GB VRAM
```

### ✅ Memory Management

```yaml
micro_batch_size: 4            # Conservative for 16GB
gradient_accumulation_steps: 4 # Effective batch = 16
gradient_checkpointing: true   # Trades compute for memory
sequence_len: 4096            # Full context in 4-bit mode
```

### ✅ LoRA Configuration

```yaml
lora_r: 32                    # Rank (quality vs size balance)
lora_alpha: 64                # 2x rank (standard scaling)
lora_dropout: 0.05            # Light regularization
lora_target_modules:          # 7 modules for comprehensive adaptation
  - q_proj, k_proj, v_proj, o_proj
  - gate_proj, up_proj, down_proj
```

---

## 🔧 INSTALLATION & SETUP

### Prerequisites

```powershell
# Install Axolotl (in WSL Ubuntu or Anaconda)
conda create -n axolotl python=3.10
conda activate axolotl

# Clone Axolotl
git clone https://github.com/OpenAccess-AI-Collective/axolotl
cd axolotl

# Install with Flash Attention 2
pip3 install packaging ninja
pip3 install -e '.[flash-attn,deepspeed]'

# Verify installation
axolotl version
```

### Verify CUDA & GPU

```powershell
# Check CUDA version (should be 12.x)
nvidia-smi

# Check PyTorch CUDA
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}, Version: {torch.version.cuda}')"

# Check Flash Attention 2
python -c "import flash_attn; print(f'Flash Attention: {flash_attn.__version__}')"
```

---

## 🏃 TRAINING EXECUTION

### Option 1: Train VetRate-Auditor

```bash
cd llm-compiler/axolotl-configs
axolotl train auditor-3b-qlora.yml

# Expected:
# - Training Time: 2-4 hours
# - Checkpoints: Every 100 steps (~10 min)
# - Final Adapter: ./models/lora-adapters/vetrate-auditor-3b/
# - Adapter Size: ~20-50 MB
```

### Option 2: Train VetRate-Writer

```bash
cd llm-compiler/axolotl-configs
axolotl train writer-3b-qlora.yml

# Expected:
# - Training Time: 1.5-3 hours (smaller dataset)
# - Checkpoints: Every 75 steps
# - Final Adapter: ./models/lora-adapters/vetrate-writer-3b/
# - Adapter Size: ~20-50 MB
```

### Option 3: Train Both (Sequential)

```bash
# Train Auditor first (longer training)
axolotl train auditor-3b-qlora.yml

# After completion, train Writer
axolotl train writer-3b-qlora.yml

# Total Time: 3.5-7 hours
```

---

## 📊 MONITORING TRAINING

### Real-Time Logs

```bash
# Axolotl logs to console automatically
# Watch for:
# - Loss decreasing over time
# - Eval loss lower than train loss (no overfitting)
# - GPU utilization ~90%+
# - VRAM usage ~11-12 GB
```

### NVIDIA System Monitor

```powershell
# Watch GPU in real-time (separate terminal)
nvidia-smi -l 5  # Update every 5 seconds

# Key Metrics:
# - GPU Utilization: Should be 90-100%
# - Memory Usage: 11-12 GB / 16 GB
# - Temperature: <85°C optimal
# - Power Draw: 250-320W (4080 Super OC)
```

### Weights & Biases (Optional)

```bash
# If using W&B for tracking
wandb login

# Dashboards will show:
# - Training/Validation loss curves
# - Learning rate schedule
# - Gradient norms
# - Sample outputs every eval_steps
```

---

## 🛑 TROUBLESHOOTING

### Out of Memory (OOM)

```yaml
# Reduce micro_batch_size in config
micro_batch_size: 2  # Was 4
gradient_accumulation_steps: 8  # Was 4 (keeps effective batch=16)

# Or reduce sequence length
sequence_len: 2048  # Was 4096
```

### Slow Training

```yaml
# Increase batch size if VRAM allows
micro_batch_size: 6  # Was 4

# Check Flash Attention is enabled
flash_attention: true  # Should be true

# Verify no CPU offloading
load_in_4bit: true  # Should stay on GPU
```

### Loss Not Decreasing

```yaml
# Increase learning rate
learning_rate: 0.0003  # Was 0.0002

# Or train longer
num_epochs: 5  # Was 3

# Or increase LoRA rank
lora_r: 64  # Was 32
lora_alpha: 128  # Was 64
```

### NaN Loss / Training Divergence

```yaml
# Reduce learning rate
learning_rate: 0.0001  # Was 0.0002

# Increase warmup
warmup_steps: 100  # Was 50

# Check gradient clipping
max_grad_norm: 0.5  # Was 1.0
```

---

## 🔄 RESUMING TRAINING

### From Last Checkpoint

```bash
# Axolotl auto-resumes if training interrupted
axolotl train auditor-3b-qlora.yml

# Or specify checkpoint explicitly
axolotl train auditor-3b-qlora.yml \
  --resume_from_checkpoint ./models/lora-adapters/vetrate-auditor-3b/checkpoint-300
```

---

## ✅ TRAINING COMPLETION CHECKLIST

After training completes, verify:

1. **Adapter Files Created**

   ```bash
   ls -lh models/lora-adapters/vetrate-auditor-3b/
   # Should see: adapter_config.json, adapter_model.safetensors
   ```

2. **Adapter Size Reasonable**

   ```bash
   # Should be 20-100 MB (not GB!)
   du -sh models/lora-adapters/vetrate-auditor-3b/
   ```

3. **Training Logs Show Convergence**

   ```
   # Final loss should be < 1.0 for good training
   # Eval loss should be close to train loss (no overfit)
   ```

4. **Test Inference (Quick Check)**

   ```bash
   # Use Axolotl inference mode
   axolotl inference auditor-3b-qlora.yml \
     --lora_model_dir ./models/lora-adapters/vetrate-auditor-3b
   
   # Try prompt: "What is Diagnostic Code 5000?"
   # Should cite 38 CFR regulations accurately
   ```

---

## 📈 EXPECTED TRAINING CURVES

### Healthy Training

```
Epoch 1:
  Train Loss: 2.5 → 1.2
  Eval Loss:  2.4 → 1.3
  
Epoch 2:
  Train Loss: 1.2 → 0.8
  Eval Loss:  1.3 → 0.9
  
Epoch 3:
  Train Loss: 0.8 → 0.6
  Eval Loss:  0.9 → 0.7

✅ Converging, no overfit (eval close to train)
```

### Overfitting (Bad)

```
Epoch 3:
  Train Loss: 0.3  ← Very low
  Eval Loss:  1.5  ← Much higher

❌ Model memorizing training data
→ Solution: Reduce epochs or increase dropout
```

### Underfitting (Bad)

```
Epoch 3:
  Train Loss: 2.0  ← Still high
  Eval Loss:  2.1  ← Still high

❌ Model not learning enough
→ Solution: Train longer or increase LoRA rank
```

---

## ⏭️ NEXT STEPS (After Training)

1. **Verify Adapter Quality** (Quick inference test)
2. **Convert to MLC Format** (WebGPU compilation)
3. **Quantize for Browser** (q4f16 or q4f32)
4. **Package for WebLLM** (Hot-swappable adapters)
5. **Deploy to Vet-Rate.org** (Client-side inference)

See: `MLC_COMPILATION_GUIDE.md` (Step 4)

---

## 📝 CONFIGURATION FILES

| File | Purpose | Status |
|------|---------|--------|
| `auditor-3b-qlora.yml` | Auditor LoRA training | ✅ Validated |
| `writer-3b-qlora.yml` | Writer LoRA training | ✅ Validated |
| `validate_configs.py` | Config validation script | ✅ Working |
| `prep_swarm_data.py` | Data preparation | ✅ Complete |

---

## 🔍 QUICK REFERENCE

```bash
# Validate configs
python validate_configs.py

# Train Auditor
axolotl train auditor-3b-qlora.yml

# Train Writer
axolotl train writer-3b-qlora.yml

# Resume training
axolotl train <config>.yml --resume_from_checkpoint <path>

# Test adapter
axolotl inference <config>.yml --lora_model_dir <adapter-path>

# Monitor GPU
nvidia-smi -l 5
```

---

## 💎 DIAMOND QUALITY ASSURANCE

- ✅ Flash Attention 2 enabled (40-series native)
- ✅ BFloat16 precision (optimal for Ada architecture)
- ✅ QLoRA 4-bit quantization (VRAM efficiency)
- ✅ Gradient checkpointing (memory optimization)
- ✅ Dataset paths validated
- ✅ VRAM usage under 75% (safe margin)
- ✅ Effective batch size: 16 (good for convergence)
- ✅ Learning rate: 2e-4 (LoRA standard)
- ✅ LoRA rank/alpha: 32/64 (quality/size balance)

---

**Hardware Target:** NVIDIA RTX 4080 Super OC (16GB VRAM)  
**Base Model:** meta-llama/Llama-3.2-3B-Instruct  
**Framework:** Axolotl + QLoRA  
**Deployment:** WebLLM (Client-Side Browser Inference)

*"From Diamond Data to Diamond Adapters - Zero Compromises"*
