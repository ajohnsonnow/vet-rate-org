#!/bin/bash
# VetRate Swarm Training Script
# Run with: bash start_training.sh

# Initialize conda
source ~/miniconda3/etc/profile.d/conda.sh
conda activate vetrate-swarm

# Navigate to project
cd ~/vet-rate-swarm

# Force GPU 0 (RTX 4080 Super)
export CUDA_VISIBLE_DEVICES=0

# Log start time
echo "=== VetRate-Auditor Training Started ==="
date

# Run training
accelerate launch -m axolotl.cli.train configs/auditor-3b-qlora-v2.yml

# Log completion
echo "=== Training Completed ==="
date
