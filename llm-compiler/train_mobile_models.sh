#!/bin/bash
#╔══════════════════════════════════════════════════════════════════════════════╗
#║  📱 VetRate Mobile Model Training Pipeline                                   ║
#║══════════════════════════════════════════════════════════════════════════════║
#║  This script trains all 3 mobile models from the 7B teacher models          ║
#║  Run in WSL/Linux with CUDA environment active                               ║
#╚══════════════════════════════════════════════════════════════════════════════╝

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                    💎 VetRate Mobile Model Pipeline                       ║"
echo "║                    Building CWO Mobile Editions                            ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"

# Configuration
PROJECT_ROOT="/mnt/e/VS_Studio/vet-rate-org-official/llm-compiler"
MODELS_DIR="$PROJECT_ROOT/models"
GGUF_DIR="/home/antho/vet-rate-swarm/models/gguf"
TRAINING_DATA_DIR="$PROJECT_ROOT/training-data-v2"
AXOLOTL_CONFIGS="$PROJECT_ROOT/axolotl-configs"

# Ensure directories exist
mkdir -p "$TRAINING_DATA_DIR"
mkdir -p "$MODELS_DIR/mobile"

#───────────────────────────────────────────────────────────────────────────────
# PHASE 1: Generate Distillation Training Data
#───────────────────────────────────────────────────────────────────────────────
echo ""
echo "┌────────────────────────────────────────────────────────────────────────────┐"
echo "│ PHASE 1: Generating distillation data from 7B teacher models              │"
echo "└────────────────────────────────────────────────────────────────────────────┘"

cd "$PROJECT_ROOT"
python distill_to_mobile.py

echo "✓ Distillation scenarios created. Now running inference..."

# Run inference with each 7B model to generate training data
for MODEL in "auditor" "writer" "rater"; do
    echo ""
    echo "→ Generating training data for: $MODEL"
    
    GGUF_FILE="$GGUF_DIR/vetrate-${MODEL}-7b-v2-Q4_K_M.gguf"
    
    if [ -f "$GGUF_FILE" ]; then
        python inference_generate_distill.py \
            --model "$GGUF_FILE" \
            --input "$TRAINING_DATA_DIR/distill_${MODEL}_scenarios.jsonl" \
            --output "$TRAINING_DATA_DIR/distill_${MODEL}_7b_complete.jsonl"
        echo "  ✓ $MODEL distillation data generated"
    else
        echo "  ⚠ GGUF not found: $GGUF_FILE"
        echo "    Falling back to existing training data only"
    fi
done

#───────────────────────────────────────────────────────────────────────────────
# PHASE 2: Train Mobile Models with Axolotl
#───────────────────────────────────────────────────────────────────────────────
echo ""
echo "┌────────────────────────────────────────────────────────────────────────────┐"
echo "│ PHASE 2: Training mobile models with Axolotl + QLoRA                      │"
echo "└────────────────────────────────────────────────────────────────────────────┘"

cd "$AXOLOTL_CONFIGS"

# Train each model
for MODEL in "auditor" "writer" "rater"; do
    CONFIG="${MODEL}-1b-mobile-distill.yml"
    
    if [ -f "$CONFIG" ]; then
        echo ""
        echo "→ Training: VetRate-${MODEL^}-1.7B-Mobile"
        accelerate launch -m axolotl.cli.train "$CONFIG"
        echo "  ✓ Training complete for $MODEL"
    else
        echo "  ✗ Config not found: $CONFIG"
    fi
done

#───────────────────────────────────────────────────────────────────────────────
# PHASE 3: Convert to GGUF for llama.cpp / Ollama
#───────────────────────────────────────────────────────────────────────────────
echo ""
echo "┌────────────────────────────────────────────────────────────────────────────┐"
echo "│ PHASE 3: Converting to GGUF format (4-bit quantized)                      │"
echo "└────────────────────────────────────────────────────────────────────────────┘"

cd "$MODELS_DIR/mobile"

for MODEL in "auditor" "writer" "rater"; do
    HF_MODEL="vetrate-${MODEL}-1.7b-mobile-v1"
    
    if [ -d "$HF_MODEL" ]; then
        echo ""
        echo "→ Converting: $HF_MODEL to GGUF"
        
        # Convert to GGUF with Q4_K_M quantization
        python -m llama_cpp.convert \
            --outfile "${HF_MODEL}-Q4_K_M.gguf" \
            --outtype q4_k_m \
            "$HF_MODEL"
            
        # Also create Q8 for higher quality option
        python -m llama_cpp.convert \
            --outfile "${HF_MODEL}-Q8_0.gguf" \
            --outtype q8_0 \
            "$HF_MODEL"
            
        echo "  ✓ GGUF created: ${HF_MODEL}-Q4_K_M.gguf (~450MB)"
        echo "  ✓ GGUF created: ${HF_MODEL}-Q8_0.gguf (~800MB)"
    else
        echo "  ⚠ Model not found: $HF_MODEL"
    fi
done

#───────────────────────────────────────────────────────────────────────────────
# PHASE 4: Compile for WebGPU with MLC-LLM
#───────────────────────────────────────────────────────────────────────────────
echo ""
echo "┌────────────────────────────────────────────────────────────────────────────┐"
echo "│ PHASE 4: Compiling for WebGPU (in-browser AI)                             │"
echo "└────────────────────────────────────────────────────────────────────────────┘"

# This uses the compile_webgpu.sh script
cd "$PROJECT_ROOT"

for MODEL in "auditor" "writer" "rater"; do
    HF_MODEL="VetRate/vetrate-${MODEL}-1.7b-mobile-v1"
    
    echo ""
    echo "→ Compiling: $HF_MODEL for WebGPU"
    
    ./compile_webgpu.sh "$HF_MODEL"
done

#───────────────────────────────────────────────────────────────────────────────
# PHASE 5: Upload to HuggingFace
#───────────────────────────────────────────────────────────────────────────────
echo ""
echo "┌────────────────────────────────────────────────────────────────────────────┐"
echo "│ PHASE 5: Uploading to HuggingFace Hub                                     │"
echo "└────────────────────────────────────────────────────────────────────────────┘"

cd "$MODELS_DIR/mobile"

for MODEL in "auditor" "writer" "rater"; do
    HF_REPO="VetRate/vetrate-${MODEL}-1.7b-mobile-v1"
    LOCAL_DIR="vetrate-${MODEL}-1.7b-mobile-v1"
    
    if [ -d "$LOCAL_DIR" ]; then
        echo ""
        echo "→ Uploading: $HF_REPO"
        
        # Upload model
        huggingface-cli upload "$HF_REPO" "$LOCAL_DIR" . --repo-type=model
        
        # Upload GGUF files if they exist
        if [ -f "${LOCAL_DIR}-Q4_K_M.gguf" ]; then
            huggingface-cli upload "$HF_REPO-GGUF" "${LOCAL_DIR}-Q4_K_M.gguf" . --repo-type=model
            huggingface-cli upload "$HF_REPO-GGUF" "${LOCAL_DIR}-Q8_0.gguf" . --repo-type=model
        fi
        
        echo "  ✓ Uploaded to HuggingFace"
    fi
done

#───────────────────────────────────────────────────────────────────────────────
# COMPLETE
#───────────────────────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ MOBILE MODEL TRAINING COMPLETE                       ║"
echo "╠════════════════════════════════════════════════════════════════════════════╣"
echo "║  Models Created:                                                           ║"
echo "║    📱 vetrate-auditor-1.7b-mobile-v1  (~800MB, 2GB VRAM)                  ║"
echo "║    📱 vetrate-writer-1.7b-mobile-v1   (~800MB, 2GB VRAM)                  ║"
echo "║    📱 vetrate-rater-1.7b-mobile-v1    (~800MB, 2GB VRAM)                  ║"
echo "║                                                                            ║"
echo "║  Formats:                                                                  ║"
echo "║    • HuggingFace (safetensors)                                            ║"
echo "║    • GGUF Q4_K_M (~450MB each)                                            ║"
echo "║    • WebGPU (for browsers)                                                ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
