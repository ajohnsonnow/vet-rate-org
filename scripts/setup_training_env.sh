#!/bin/bash
# VetRate Training Environment Setup
# Run this ONCE to set up the training environment

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║      🎖️  VETRATE TRAINING ENVIRONMENT SETUP  🎖️               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"

cd ~/vet-rate-swarm

# Create conda environment if it doesn't exist
if ! conda env list | grep -q "vetrate-train"; then
    echo "Creating conda environment: vetrate-train..."
    conda create -n vetrate-train python=3.11 -y
fi

# Activate environment
source ~/miniforge3/etc/profile.d/conda.sh 2>/dev/null || source ~/miniconda3/etc/profile.d/conda.sh 2>/dev/null || source ~/anaconda3/etc/profile.d/conda.sh 2>/dev/null
conda activate vetrate-train

# Install PyTorch with CUDA
echo "Installing PyTorch with CUDA 12.4..."
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124

# Install training dependencies
echo "Installing training dependencies..."
pip install transformers>=4.40.0
pip install datasets>=2.18.0
pip install accelerate>=0.29.0
pip install bitsandbytes>=0.43.0
pip install peft>=0.10.0
pip install trl>=0.8.0
pip install scipy
pip install sentencepiece

# Verify installation
echo ""
echo "Verifying installation..."
python -c "
import torch
print(f'PyTorch: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'GPU: {torch.cuda.get_device_name(0)}')
    print(f'VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB')

import transformers
print(f'Transformers: {transformers.__version__}')

import peft
print(f'PEFT: {peft.__version__}')

import trl
print(f'TRL: {trl.__version__}')

import bitsandbytes
print(f'BitsAndBytes: {bitsandbytes.__version__}')
"

echo ""
echo "✅ Setup complete!"
echo ""
echo "To train models, run:"
echo "  conda activate vetrate-train"
echo "  python ~/vet-rate-swarm/src/train_qwen_v2.py --model auditor"
echo ""
