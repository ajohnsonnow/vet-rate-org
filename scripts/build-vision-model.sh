#!/bin/bash
# =============================================================================
# Vet-Rate Vision Model Build Script (WSL2)
# =============================================================================
# This script builds a custom WebGPU-compatible vision model for Vet-Rate.org
# 
# Prerequisites:
#   - WSL2 with Ubuntu 22.04 or 24.04
#   - Python 3.10+ with venv support
#   - ~15GB free disk space
#   - Internet connection for downloading model weights
#
# Usage:
#   chmod +x build-vision-model.sh
#   ./build-vision-model.sh
#
# The script will:
#   1. Set up a Python virtual environment
#   2. Install MLC-LLM and TVM from source (for latest fixes)
#   3. Download Phi-3.5-vision-instruct from HuggingFace
#   4. Convert and quantize weights (q4f32_1)
#   5. Compile to WebGPU WASM
#   6. Output files ready for upload to HuggingFace
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKSPACE_DIR="$HOME/mlc-vision-build"
MODEL_NAME="Vet-Rate-Vision-Phi"
MODEL_ID="${MODEL_NAME}-q4f32_1"
SOURCE_MODEL="microsoft/Phi-3.5-vision-instruct"
QUANTIZATION="q4f32_1"  # float32 compute to avoid u8 shaders (hopefully!)
CONTEXT_WINDOW=8192
PREFILL_CHUNK=4096

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Vet-Rate Vision Model Builder for WebGPU                   ║${NC}"
echo -e "${BLUE}║     Building: ${MODEL_ID}                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# =============================================================================
# Step 0: Check prerequisites
# =============================================================================
echo -e "${YELLOW}[Step 0/7]${NC} Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}ERROR: Python3 not found. Install with: sudo apt install python3 python3-venv python3-pip${NC}"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo -e "${RED}ERROR: Git not found. Install with: sudo apt install git${NC}"
    exit 1
fi

# Check for git-lfs
if ! command -v git-lfs &> /dev/null; then
    echo -e "${YELLOW}Installing git-lfs...${NC}"
    sudo apt-get update && sudo apt-get install -y git-lfs
    git lfs install
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"

# =============================================================================
# Step 1: Create workspace and virtual environment
# =============================================================================
echo -e "${YELLOW}[Step 1/7]${NC} Setting up workspace at ${WORKSPACE_DIR}..."

mkdir -p "$WORKSPACE_DIR"
cd "$WORKSPACE_DIR"

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo -e "${GREEN}✓ Virtual environment exists${NC}"
fi

source venv/bin/activate

# Upgrade pip
pip install --upgrade pip wheel setuptools

echo -e "${GREEN}✓ Workspace ready${NC}"

# =============================================================================
# Step 2: Install Emscripten SDK (for WASM compilation)
# =============================================================================
echo -e "${YELLOW}[Step 2/7]${NC} Setting up Emscripten SDK..."

if [ ! -d "$HOME/emsdk" ]; then
    cd "$HOME"
    git clone --depth 1 https://github.com/emscripten-core/emsdk.git
    cd emsdk
    ./emsdk install 3.1.56
    ./emsdk activate 3.1.56
    echo -e "${GREEN}✓ Emscripten SDK installed${NC}"
else
    echo -e "${GREEN}✓ Emscripten SDK exists${NC}"
fi

source "$HOME/emsdk/emsdk_env.sh"

cd "$WORKSPACE_DIR"

# =============================================================================
# Step 3: Clone and build TVM from source
# =============================================================================
echo -e "${YELLOW}[Step 3/7]${NC} Building TVM from source..."

if [ ! -d "tvm" ]; then
    git clone --recursive https://github.com/apache/tvm.git
    cd tvm
    
    # Install tvm-ffi first
    pip install Cython
    pip install 3rdparty/tvm-ffi -v
    
    # Create build directory
    mkdir -p build
    cd build
    
    # Configure cmake
    cat > config.cmake << EOF
set(USE_LLVM ON)
set(USE_RELAY_DEBUG OFF)
set(USE_SORT ON)
set(USE_PROFILER ON)
EOF
    
    cmake .. -G Ninja
    ninja
    cd ../..
    
    echo -e "${GREEN}✓ TVM built from source${NC}"
else
    echo -e "${GREEN}✓ TVM directory exists${NC}"
fi

# Set TVM environment
export TVM_HOME="$WORKSPACE_DIR/tvm"
export PYTHONPATH="$TVM_HOME/python:$PYTHONPATH"

# Verify TVM
python -c "import tvm; print(f'TVM version: {tvm.__version__}')"

# =============================================================================
# Step 4: Clone and build MLC-LLM from source
# =============================================================================
echo -e "${YELLOW}[Step 4/7]${NC} Building MLC-LLM from source..."

if [ ! -d "mlc-llm" ]; then
    git clone --recursive https://github.com/mlc-ai/mlc-llm.git
    cd mlc-llm
    
    # Install dependencies
    pip install numpy psutil typing_extensions pydantic shortuuid fastapi requests tqdm prompt_toolkit
    pip install transformers huggingface_hub safetensors
    
    # Build WASM runtime
    cd web
    ./prep_emcc_deps.sh
    cd ..
    
    # Install MLC-LLM Python package
    pip install -e "python/." -v
    
    cd ..
    echo -e "${GREEN}✓ MLC-LLM built from source${NC}"
else
    echo -e "${GREEN}✓ MLC-LLM directory exists${NC}"
    cd mlc-llm
    git pull
    pip install -e "python/." -v
    cd ..
fi

export MLC_LLM_SOURCE_DIR="$WORKSPACE_DIR/mlc-llm"

# Verify MLC-LLM
python -m mlc_llm --help > /dev/null 2>&1 && echo -e "${GREEN}✓ MLC-LLM installed${NC}"

# =============================================================================
# Step 5: Download source model from HuggingFace
# =============================================================================
echo -e "${YELLOW}[Step 5/7]${NC} Downloading ${SOURCE_MODEL}..."

mkdir -p dist/models

if [ ! -d "dist/models/Phi-3.5-vision-instruct" ]; then
    python << EOF
from huggingface_hub import snapshot_download
path = snapshot_download(
    repo_id='${SOURCE_MODEL}',
    local_dir='dist/models/Phi-3.5-vision-instruct',
    local_dir_use_symlinks=False
)
print(f'Downloaded to: {path}')
EOF
    echo -e "${GREEN}✓ Model downloaded${NC}"
else
    echo -e "${GREEN}✓ Model already downloaded${NC}"
fi

# =============================================================================
# Step 6: Convert and quantize weights
# =============================================================================
echo -e "${YELLOW}[Step 6/7]${NC} Converting and quantizing weights..."

mkdir -p "dist/${MODEL_ID}-MLC"

# Generate config
python -m mlc_llm gen_config \
    dist/models/Phi-3.5-vision-instruct \
    --quantization ${QUANTIZATION} \
    --context-window-size ${CONTEXT_WINDOW} \
    --prefill-chunk-size ${PREFILL_CHUNK} \
    -o "dist/${MODEL_ID}-MLC"

# Convert weights
python -m mlc_llm convert_weight \
    dist/models/Phi-3.5-vision-instruct \
    --quantization ${QUANTIZATION} \
    --device cpu \
    -o "dist/${MODEL_ID}-MLC"

echo -e "${GREEN}✓ Weights converted and quantized${NC}"

# =============================================================================
# Step 7: Compile to WebGPU WASM
# =============================================================================
echo -e "${YELLOW}[Step 7/7]${NC} Compiling to WebGPU WASM..."

mkdir -p dist/libs

python -m mlc_llm compile \
    "dist/${MODEL_ID}-MLC" \
    --device webgpu \
    --opt O2 \
    -o "dist/libs/${MODEL_ID}-webgpu.wasm"

echo -e "${GREEN}✓ WASM compiled${NC}"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    BUILD COMPLETE!                             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Output files:"
echo -e "  ${BLUE}Model weights:${NC} $WORKSPACE_DIR/dist/${MODEL_ID}-MLC/"
echo -e "  ${BLUE}WASM library:${NC}  $WORKSPACE_DIR/dist/libs/${MODEL_ID}-webgpu.wasm"
echo ""
echo -e "Next steps:"
echo -e "  1. Test the model locally"
echo -e "  2. Upload to HuggingFace:"
echo -e "     ${YELLOW}huggingface-cli login${NC}"
echo -e "     ${YELLOW}huggingface-cli upload Vet-Rate-org/${MODEL_NAME} dist/${MODEL_ID}-MLC/${NC}"
echo -e "     ${YELLOW}huggingface-cli upload Vet-Rate-org/${MODEL_NAME} dist/libs/${MODEL_ID}-webgpu.wasm${NC}"
echo ""
echo -e "  3. Update LocalAIPanel.jsx with new model_lib URL"
echo ""

# Check for u8 shader types in WASM (basic check)
echo -e "${YELLOW}Checking WASM for potential u8 shader issues...${NC}"
if strings "dist/libs/${MODEL_ID}-webgpu.wasm" 2>/dev/null | grep -q "array<u8>"; then
    echo -e "${RED}⚠️  WARNING: WASM may still contain u8 shader types!${NC}"
    echo -e "${RED}   The model may require Chrome Canary with experimental flags.${NC}"
else
    echo -e "${GREEN}✓ No obvious u8 shader types detected (good sign!)${NC}"
fi

echo ""
echo -e "${BLUE}Built by veterans, for veterans 🎖️${NC}"
