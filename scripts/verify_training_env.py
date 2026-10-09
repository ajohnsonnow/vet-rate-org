#!/usr/bin/env python3
"""Verify training environment"""
import torch
print(f'PyTorch: {torch.__version__}')
print(f'CUDA: {torch.cuda.is_available()}')
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
print()
print('✅ All dependencies installed!')
