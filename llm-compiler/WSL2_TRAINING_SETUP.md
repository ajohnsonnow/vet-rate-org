# 💎 WSL2 Training Setup Guide

## Quick Start (If WSL2 + CUDA Already Configured)

```bash
# Navigate to project in WSL2
cd /mnt/e/VS_Studio/vet-rate-org-official/llm-compiler

# Make script executable
chmod +x train_and_merge.sh

# Train + Merge Auditor (first, largest dataset)
./train_and_merge.sh full auditor

# Or train all three sequentially
./train_and_merge.sh all
```

---

## Full WSL2 Setup (If Not Already Configured)

### 1. Install WSL2 with Ubuntu (PowerShell Admin)

```powershell
# Install WSL2 with Ubuntu 24.04
wsl --install -d Ubuntu-24.04

# After reboot, set default
wsl --set-default Ubuntu-24.04
```

### 2. Install NVIDIA CUDA in WSL2

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install NVIDIA CUDA toolkit for WSL2
# Note: WSL2 uses Windows GPU drivers, only need toolkit
wget https://developer.download.nvidia.com/compute/cuda/repos/wsl-ubuntu/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt update
sudo apt install -y cuda-toolkit-12-4

# Verify GPU access
nvidia-smi
```

### 3. Install Python Environment

```bash
# Install Miniconda
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh -b
~/miniconda3/bin/conda init bash
source ~/.bashrc

# Create training environment
conda create -n axolotl python=3.11 -y
conda activate axolotl

# Install PyTorch with CUDA 12.4
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

# Install Axolotl with Flash Attention
pip install axolotl[flash-attn]

# Install additional dependencies
pip install bitsandbytes transformers accelerate peft
```

### 4. Verify Installation

```bash
# Check CUDA
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}, Device: {torch.cuda.get_device_name(0)}')"

# Check Axolotl
axolotl --help

# Check Flash Attention
python -c "import flash_attn; print(f'Flash Attention: {flash_attn.__version__}')"
```

---

## Training Commands

### Train Single Role

```bash
cd /mnt/e/VS_Studio/vet-rate-org-official/llm-compiler

# Train + Merge Auditor (~2-4 hours)
./train_and_merge.sh full auditor

# Train + Merge Writer (~1-2 hours)
./train_and_merge.sh full writer

# Train + Merge Rater (~1-2 hours)
./train_and_merge.sh full rater
```

### Train All Roles

```bash
# Sequential training of all three (~5-8 hours total)
./train_and_merge.sh all
```

### Individual Steps

```bash
# Train only (no merge)
./train_and_merge.sh train auditor

# Merge existing adapter
./train_and_merge.sh merge auditor

# Verify merged model
./train_and_merge.sh verify auditor
```

---

## Monitoring Training

### Terminal 1: Training Output

```bash
./train_and_merge.sh full auditor
```

### Terminal 2: GPU Monitoring

```bash
watch -n 1 nvidia-smi
```

### Terminal 3: Log Tailing

```bash
tail -f logs/vetrate-auditor_train_*.log
```

---

## Expected Output

### Successful Training

```
[INFO] Training completed for vetrate-auditor
[INFO] Final training loss: 0.45
```

### Successful Merge

```
[INFO] Verifying merged model...
[INFO] Model weights (safetensors): 5.6G
[INFO] Total merged model size: 6.1G
[SUCCESS] Merge verification passed ✓
```

### Merged Model Structure

```
models/merged/vetrate-auditor-merged/
├── config.json              # Model architecture config
├── generation_config.json   # Generation parameters
├── model-00001-of-00002.safetensors  # Weights part 1
├── model-00002-of-00002.safetensors  # Weights part 2
├── model.safetensors.index.json      # Weight index
├── special_tokens_map.json  # Special tokens
├── tokenizer.json           # Tokenizer
├── tokenizer_config.json    # Tokenizer config
└── tokenizer.model          # SentencePiece model
```

---

## How to Know if Merge Succeeded vs Failed

### ✅ Merge SUCCEEDED if

1. **Exit code is 0** - Script completes without error
2. **Model weights exist** - `model*.safetensors` files present
3. **Size is correct** - Merged 3B model should be ~5-6GB
4. **All config files present**:
   - `config.json`
   - `generation_config.json`
   - `tokenizer.json`
   - `tokenizer_config.json`

5. **Verification passes**:

   ```
   [SUCCESS] Merge verification passed ✓
   ```

### ❌ Merge FAILED if

1. **Error message** - "Merge command failed" or Python traceback
2. **Missing weights** - No `model*.safetensors` files
3. **Size too small** - Model directory < 5GB (likely missing weights)
4. **Missing configs** - `config.json` or tokenizer files absent
5. **CUDA OOM** - "CUDA out of memory" error (shouldn't happen with 16GB)

### Quick Verification Command

```bash
# Check if merge succeeded
./train_and_merge.sh verify auditor

# Manual check
ls -lh models/merged/vetrate-auditor-merged/
du -sh models/merged/vetrate-auditor-merged/
```

---

## Troubleshooting

### CUDA Out of Memory

```bash
# Reduce batch size in YAML config
micro_batch_size: 2  # Reduce from 4

# Clear GPU cache before merge
python -c "import torch; torch.cuda.empty_cache()"
```

### Flash Attention Not Found

```bash
# Reinstall with CUDA support
pip uninstall flash-attn -y
pip install flash-attn --no-build-isolation
```

### Permission Denied

```bash
chmod +x train_and_merge.sh
```

### WSL2 Can't See GPU

```powershell
# In Windows PowerShell (admin)
wsl --shutdown
# Restart WSL2
wsl
nvidia-smi
```

---

## Next Step After Training

Once all models are merged, proceed to MLC-LLM compilation:

```bash
# Compile for WebLLM (Step 5)
cd mlc-compile
./compile_to_webgpu.sh vetrate-auditor-merged
```

---

*💎 Diamond Standard: Production-Ready Training Pipeline*
