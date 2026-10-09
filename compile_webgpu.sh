#!/bin/bash
# Diamond Swarm WebGPU Compilation Script

# Activate venv
source /home/antho/vet-rate-swarm/venv/bin/activate

# Set library paths
export TVM_HOME=/home/antho/mlc-llm/3rdparty/tvm
export LD_LIBRARY_PATH=/home/antho/mlc-llm/build/tvm:/home/antho/mlc-llm/build:$LD_LIBRARY_PATH
export PYTHONPATH=/home/antho/mlc-llm/python:/home/antho/mlc-llm/3rdparty/tvm/python:$PYTHONPATH
export PATH=/usr/local/cuda/bin:/usr/bin:$PATH

cd /home/antho/vet-rate-swarm

echo "Testing MLC-LLM import..."
python -c "import mlc_llm; print('MLC-LLM version:', mlc_llm.__version__)"

if [ $? -eq 0 ]; then
    echo ""
    echo "=== Converting VetRate Auditor to WebGPU ==="
    python -m mlc_llm convert_weight \
        models/merged/vetrate-auditor-7b-v2-merged \
        --quantization q4f16_1 \
        --output dist/vetrate-auditor-web \
        --device cuda
    
    echo ""
    echo "=== Converting VetRate Writer to WebGPU ==="
    python -m mlc_llm convert_weight \
        models/merged/vetrate-writer-7b-v2-merged \
        --quantization q4f16_1 \
        --output dist/vetrate-writer-web \
        --device cuda
    
    echo ""
    echo "=== Converting VetRate Rater to WebGPU ==="
    python -m mlc_llm convert_weight \
        models/merged/vetrate-rater-7b-v2-merged \
        --quantization q4f16_1 \
        --output dist/vetrate-rater-web \
        --device cuda
    
    echo ""
    echo "=== All conversions complete! ==="
    ls -la dist/
else
    echo "MLC-LLM import failed. Check installation."
    exit 1
fi
