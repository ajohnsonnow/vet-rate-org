#!/bin/bash
# MLC LLM WebGPU Compilation Script
# Run in WSL with: bash compile_webgpu.sh

set -e

echo "=== MLC LLM WebGPU Compilation ==="

# Install MLC LLM if needed
if ! python3 -c "import mlc_llm" 2>/dev/null; then
    echo "Installing MLC LLM..."
    pip install --pre -U -f https://mlc.ai/wheels mlc-llm-nightly mlc-ai-nightly
fi

# Model to compile (using small efficient model)
BASE_MODEL="TinyLlama/TinyLlama-1.1B-Chat-v1.0"
OUTPUT_DIR="./webgpu-models"

mkdir -p $OUTPUT_DIR

echo "Compiling $BASE_MODEL for WebGPU..."

# Compile for WebGPU (q4f16_1 quantization)
python3 -m mlc_llm compile $BASE_MODEL \
    --quantization q4f16_1 \
    --device webgpu \
    --output $OUTPUT_DIR/vet-rate-llm-q4f16 \
    2>&1 | tee compile.log

# Compile for mobile (q3f16_1 quantization)  
python3 -m mlc_llm compile $BASE_MODEL \
    --quantization q3f16_1 \
    --device webgpu \
    --output $OUTPUT_DIR/vet-rate-llm-q3f16 \
    2>&1 | tee -a compile.log

echo "=== Compilation Complete ==="
ls -la $OUTPUT_DIR/
