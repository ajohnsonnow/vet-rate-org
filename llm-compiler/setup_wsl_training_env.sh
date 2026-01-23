#!/bin/bash
# ============================================================
# VET-RATE SWARM TRAINING ENVIRONMENT SETUP
# For WSL2 Ubuntu-24.04 with RTX 4080 Super
# ============================================================

set -e  # Exit on error

echo "💎 Vet-Rate Diamond Standard - Environment Setup"
echo "=================================================="

# Step 1: Install Miniconda
echo ""
echo "📦 Step 1/6: Installing Miniconda..."
if [ -d "$HOME/miniconda3" ]; then
    echo "   Miniconda already installed, skipping..."
else
    mkdir -p ~/miniconda3
    wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda3/miniconda.sh
    bash ~/miniconda3/miniconda.sh -b -u -p ~/miniconda3
    rm ~/miniconda3/miniconda.sh
    ~/miniconda3/bin/conda init bash
    echo "   ✅ Miniconda installed"
fi

# Source conda for this session
export PATH="$HOME/miniconda3/bin:$PATH"
source ~/miniconda3/etc/profile.d/conda.sh

# Step 2: Create vetrate-swarm environment
echo ""
echo "🐍 Step 2/6: Creating vetrate-swarm environment (Python 3.10)..."
if conda env list | grep -q "vetrate-swarm"; then
    echo "   Environment exists, activating..."
else
    conda create -n vetrate-swarm python=3.10 -y
    echo "   ✅ Environment created"
fi
conda activate vetrate-swarm

# Step 3: Install PyTorch with CUDA 12.1
echo ""
echo "🔥 Step 3/6: Installing PyTorch with CUDA 12.1..."
pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Step 4: Install Axolotl from source
echo ""
echo "🦎 Step 4/6: Installing Axolotl (LoRA training framework)..."
cd ~
if [ -d "axolotl" ]; then
    echo "   Axolotl directory exists, updating..."
    cd axolotl
    git pull
else
    git clone https://github.com/OpenAccess-AI-Collective/axolotl
    cd axolotl
fi

pip3 install packaging wheel
pip3 install -e '.[flash-attn,deepspeed]'

# Step 5: Install additional dependencies
echo ""
echo "📚 Step 5/6: Installing additional packages..."
pip3 install pandas scikit-learn transformers datasets accelerate bitsandbytes peft

# Step 6: Verify installation
echo ""
echo "✅ Step 6/6: Verifying installation..."
python3 << 'EOF'
import sys
print(f"Python: {sys.version}")

import torch
print(f"PyTorch: {torch.__version__}")
print(f"CUDA Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

try:
    import flash_attn
    print(f"Flash Attention: {flash_attn.__version__}")
except ImportError:
    print("Flash Attention: NOT INSTALLED (may need manual compile)")

import transformers
print(f"Transformers: {transformers.__version__}")

print("\n✅ Environment ready for training!")
EOF

# Step 7: Create project structure
echo ""
echo "📁 Creating project structure..."
mkdir -p ~/vet-rate-swarm/{data,configs,scripts,models,dist}

# Link to Windows training data
WINDOWS_DATA="/mnt/e/VS_Studio/vet-rate-org-official/llm-compiler/training-data-v2"
if [ -d "$WINDOWS_DATA" ]; then
    echo "   Linking training data from Windows..."
    ln -sf "$WINDOWS_DATA"/*.jsonl ~/vet-rate-swarm/data/ 2>/dev/null || cp "$WINDOWS_DATA"/*.jsonl ~/vet-rate-swarm/data/
    echo "   ✅ Training data linked"
fi

# Link configs
WINDOWS_CONFIGS="/mnt/e/VS_Studio/vet-rate-org-official/llm-compiler/axolotl-configs"
if [ -d "$WINDOWS_CONFIGS" ]; then
    echo "   Linking config files from Windows..."
    ln -sf "$WINDOWS_CONFIGS"/*.yml ~/vet-rate-swarm/configs/ 2>/dev/null || cp "$WINDOWS_CONFIGS"/*.yml ~/vet-rate-swarm/configs/
    echo "   ✅ Config files linked"
fi

echo ""
echo "=================================================="
echo "💎 SETUP COMPLETE!"
echo "=================================================="
echo ""
echo "To start training:"
echo "  1. Open a new terminal (to reload conda)"
echo "  2. Run: conda activate vetrate-swarm"
echo "  3. Run: cd ~/vet-rate-swarm"
echo "  4. Run: accelerate launch -m axolotl.cli.train configs/auditor-3b-qlora.yml"
echo ""
echo "Training data location: ~/vet-rate-swarm/data/"
echo "Config location: ~/vet-rate-swarm/configs/"
echo ""
