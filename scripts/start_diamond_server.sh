#!/bin/bash
# Diamond Swarm Local Server
# Serves VetRate fine-tuned models via llama.cpp API

MODEL_DIR="/home/antho/vet-rate-swarm/models/gguf"
LLAMA_SERVER="/home/antho/llama.cpp/build/bin/llama-server"

# Default to Auditor model
MODEL="${1:-auditor}"
PORT="${2:-8080}"

case $MODEL in
  auditor)
    MODEL_PATH="$MODEL_DIR/vetrate-auditor-7b-v2-Q4_K_M.gguf"
    ;;
  writer)
    MODEL_PATH="$MODEL_DIR/vetrate-writer-7b-v2-Q4_K_M.gguf"
    ;;
  rater)
    MODEL_PATH="$MODEL_DIR/vetrate-rater-7b-v2-Q4_K_M.gguf"
    ;;
  *)
    echo "Unknown model: $MODEL"
    echo "Usage: $0 [auditor|writer|rater] [port]"
    exit 1
    ;;
esac

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  💎 Diamond Swarm Local Server                              ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Model: VetRate-${MODEL^}-7B-v2                              ║"
echo "║  Port:  $PORT                                                 ║"
echo "║  GPU:   RTX 4080 Super (CUDA)                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

if [ ! -f "$MODEL_PATH" ]; then
    echo "ERROR: Model not found at $MODEL_PATH"
    exit 1
fi

# Start server with optimal settings for RTX 4080 Super
$LLAMA_SERVER \
    --model "$MODEL_PATH" \
    --port $PORT \
    --host 0.0.0.0 \
    --ctx-size 4096 \
    --n-gpu-layers 99 \
    --threads 8 \
    --parallel 4 \
    --cont-batching \
    --cors "*"
