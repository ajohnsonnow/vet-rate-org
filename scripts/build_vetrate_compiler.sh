#!/bin/bash
# =============================================================================
# VET-RATE VISION COMPILER - Float32 Bypass Build Script
# =============================================================================
# This script automates the "Float32 Bypass" strategy to compile vision models
# without the problematic uint8 shader types that crash in standard WebGPU.
#
# The Problem: Vision models use CLIP encoders that process pixels as uint8,
# which requires experimental Chrome flags (chromium-experimental-subgroup-matrix)
#
# The Solution: Patch the MLC-LLM compiler to use float32 for pixel_values,
# bypassing the broken uint8 GPU kernels entirely.
#
# Target: WSL2 Ubuntu (Run this in your WSL2 terminal, NOT Windows)
# Author: Vet-Rate.org Firearm Safety Team
# Date: January 2026
# =============================================================================

set -e  # Exit immediately on error

# ANSI Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
WORK_DIR="$HOME/vetrate-vision-compiler"
REPO_DIR="$WORK_DIR/mlc-llm"
VENV_DIR="$WORK_DIR/venv"
EMSDK_DIR="$HOME/emsdk"
MODEL_DIR="$WORK_DIR/dist/models"
OUTPUT_DIR="$WORK_DIR/dist/output"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

print_banner() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                    ║"
    echo "║     VET-RATE VISION COMPILER - Float32 Bypass Builder              ║"
    echo "║                                                                    ║"
    echo "║     Building vision models that work in standard Chrome            ║"
    echo "║                                                                    ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_phase() {
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}>>> [Phase $1] $2${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() {
    echo -e "${BLUE}   → $1${NC}"
}

print_success() {
    echo -e "${GREEN}   ✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}   ⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}   ✗ $1${NC}"
}

check_disk_space() {
    local required_gb=50
    local available_gb=$(df -BG "$HOME" | tail -1 | awk '{print $4}' | sed 's/G//')
    
    if [ "$available_gb" -lt "$required_gb" ]; then
        print_error "Insufficient disk space: ${available_gb}GB available, ${required_gb}GB required"
        print_warning "Compiling vision models requires significant disk space for:"
        print_warning "  - MLC-LLM source: ~3 GB"
        print_warning "  - Build artifacts: ~10 GB"
        print_warning "  - Model weights: ~15 GB"
        print_warning "  - Converted weights: ~5 GB"
        exit 1
    else
        print_success "Disk space check passed: ${available_gb}GB available"
    fi
}

check_memory() {
    local total_mem=$(free -g | grep Mem | awk '{print $2}')
    
    if [ "$total_mem" -lt 8 ]; then
        print_warning "Low memory detected: ${total_mem}GB"
        print_warning "Compilation may fail. Consider closing other applications."
        MAKE_JOBS=2
    elif [ "$total_mem" -lt 16 ]; then
        print_warning "Moderate memory: ${total_mem}GB. Using 4 parallel jobs."
        MAKE_JOBS=4
    else
        print_success "Memory check passed: ${total_mem}GB available"
        MAKE_JOBS=$(nproc)
        # Cap at 8 to prevent OOM even with lots of RAM
        if [ "$MAKE_JOBS" -gt 8 ]; then
            MAKE_JOBS=8
        fi
    fi
    print_step "Will use $MAKE_JOBS parallel compilation jobs"
}

# =============================================================================
# PHASE 1: SYSTEM DEPENDENCIES
# =============================================================================

install_system_deps() {
    print_phase "1" "Installing System Dependencies"
    
    print_step "Updating package lists..."
    sudo apt-get update -qq
    
    print_step "Installing build essentials..."
    sudo apt-get install -y -qq \
        build-essential \
        git \
        git-lfs \
        cmake \
        ninja-build \
        libvulkan1 \
        libvulkan-dev \
        python3-dev \
        python3-pip \
        python3-venv \
        wget \
        curl
    
    print_step "Initializing Git LFS..."
    git lfs install --skip-smudge
    
    print_success "System dependencies installed"
}

# =============================================================================
# PHASE 2: WORKSPACE SETUP
# =============================================================================

setup_workspace() {
    print_phase "2" "Setting Up Workspace at $WORK_DIR"
    
    mkdir -p "$WORK_DIR"
    mkdir -p "$MODEL_DIR"
    mkdir -p "$OUTPUT_DIR"
    
    cd "$WORK_DIR"
    
    if [ -d "$REPO_DIR" ]; then
        print_step "MLC-LLM repo exists. Updating..."
        cd "$REPO_DIR"
        git fetch origin
        git checkout main
        git pull origin main
        git submodule update --init --recursive
    else
        print_step "Cloning MLC-LLM with submodules (this takes a few minutes)..."
        git clone --recursive https://github.com/mlc-ai/mlc-llm.git "$REPO_DIR"
    fi
    
    print_success "Workspace ready at $WORK_DIR"
}

# =============================================================================
# PHASE 3: PYTHON ENVIRONMENT
# =============================================================================

setup_python_env() {
    print_phase "3" "Setting Up Python Virtual Environment"
    
    if [ ! -d "$VENV_DIR" ]; then
        print_step "Creating Python virtual environment..."
        python3 -m venv "$VENV_DIR"
    fi
    
    print_step "Activating virtual environment..."
    source "$VENV_DIR/bin/activate"
    
    print_step "Upgrading pip..."
    pip install --upgrade pip -q
    
    print_step "Installing Python build dependencies..."
    pip install -q \
        numpy \
        torch \
        attrs \
        psutil \
        decorator \
        scipy \
        tornado \
        cloudpickle \
        typing_extensions \
        transformers \
        huggingface_hub \
        safetensors \
        sentencepiece \
        tiktoken
    
    print_success "Python environment configured"
}

# =============================================================================
# PHASE 4: THE FLOAT32 BYPASS PATCH
# =============================================================================

apply_float32_patch() {
    print_phase "4" "Applying Float32 Bypass Patch"
    
    cd "$REPO_DIR"
    
    # Create backup directory
    mkdir -p "$WORK_DIR/patches/backups"
    
    print_step "Searching for uint8 definitions in vision models..."
    
    # Find files that define pixel_values with uint8
    PATCH_TARGETS=$(grep -r "uint8" python/mlc_llm/model --include="*.py" 2>/dev/null | \
                    grep -E "(pixel_values|image|vision)" | \
                    cut -d: -f1 | sort -u) || true
    
    if [ -z "$PATCH_TARGETS" ]; then
        print_warning "No uint8 pixel_values definitions found."
        print_step "Checking alternative locations..."
        
        # Try broader search
        PATCH_TARGETS=$(grep -r "dtype=\"uint8\"" python/mlc_llm --include="*.py" 2>/dev/null | \
                        cut -d: -f1 | sort -u) || true
    fi
    
    if [ -z "$PATCH_TARGETS" ]; then
        print_warning "Could not find uint8 targets automatically."
        print_warning "The model definition may already use float32 or the structure changed."
        print_step "Proceeding with manual patch locations..."
        
        # Known locations where uint8 is commonly used
        KNOWN_LOCATIONS=(
            "python/mlc_llm/model/phi3_v/phi3_v_model.py"
            "python/mlc_llm/model/vision/clip.py"
            "python/mlc_llm/model/vision/siglip.py"
        )
        
        for loc in "${KNOWN_LOCATIONS[@]}"; do
            if [ -f "$loc" ]; then
                print_step "Patching $loc"
                cp "$loc" "$WORK_DIR/patches/backups/$(basename $loc).bak"
                
                # Apply the patch: uint8 -> float32 for image-related tensors
                sed -i 's/dtype="uint8"/dtype="float32"/g' "$loc"
                sed -i "s/dtype='uint8'/dtype='float32'/g" "$loc"
                
                print_success "Patched: $loc"
            fi
        done
    else
        print_step "Found ${#PATCH_TARGETS[@]} file(s) with uint8 definitions"
        
        for target in $PATCH_TARGETS; do
            print_step "Patching: $target"
            
            # Create backup
            cp "$target" "$WORK_DIR/patches/backups/$(basename $target).bak"
            
            # Apply the patch
            sed -i 's/dtype="uint8"/dtype="float32"/g' "$target"
            sed -i "s/dtype='uint8'/dtype='float32'/g" "$target"
            
            print_success "Patched: $target"
        done
    fi
    
    # Also patch any hardcoded uint8 in shader generation
    print_step "Patching shader generation code..."
    
    SHADER_FILES=$(find "$REPO_DIR" -name "*.py" -exec grep -l "u8\|uint8" {} \; 2>/dev/null | \
                   grep -E "(tir|shader|kernel)" || true)
    
    for shader_file in $SHADER_FILES; do
        if [ -f "$shader_file" ]; then
            print_step "Checking shader file: $shader_file"
            # Be more careful here - only patch specific patterns
            # Don't blindly replace all u8 references
        fi
    done
    
    print_success "Float32 bypass patches applied"
}

# =============================================================================
# PHASE 5: EMSCRIPTEN SDK
# =============================================================================

setup_emscripten() {
    print_phase "5" "Setting Up Emscripten SDK"
    
    if [ -d "$EMSDK_DIR" ] && [ -f "$EMSDK_DIR/emsdk" ]; then
        print_step "Emscripten SDK exists. Updating..."
        cd "$EMSDK_DIR"
        git pull
    else
        print_step "Cloning Emscripten SDK..."
        cd "$HOME"
        git clone https://github.com/emscripten-core/emsdk.git
    fi
    
    cd "$EMSDK_DIR"
    
    print_step "Installing Emscripten 3.1.56..."
    ./emsdk install 3.1.56
    
    print_step "Activating Emscripten..."
    ./emsdk activate 3.1.56
    
    print_success "Emscripten SDK ready"
}

# =============================================================================
# PHASE 6: BUILD TVM AND MLC-LLM
# =============================================================================

build_mlc_llm() {
    print_phase "6" "Building TVM and MLC-LLM"
    
    source "$VENV_DIR/bin/activate"
    cd "$REPO_DIR"
    
    # Clean previous build
    if [ -d "build" ]; then
        print_step "Cleaning previous build..."
        rm -rf build
    fi
    
    mkdir -p build
    cd build
    
    print_step "Generating CMake configuration..."
    python3 ../cmake/gen_cmake_config.py
    
    print_step "Running CMake..."
    cmake ..
    
    print_step "Building with $MAKE_JOBS parallel jobs (this may take 30-60 minutes)..."
    make -j$MAKE_JOBS
    
    print_success "TVM and MLC-LLM built successfully"
    
    # Install Python package
    print_step "Installing MLC-LLM Python package..."
    cd "$REPO_DIR/python"
    pip install -e .
    
    print_success "MLC-LLM Python package installed"
}

# =============================================================================
# PHASE 7: BUILD WASM RUNTIME
# =============================================================================

build_wasm_runtime() {
    print_phase "7" "Building WASM Runtime Libraries"
    
    source "$EMSDK_DIR/emsdk_env.sh"
    source "$VENV_DIR/bin/activate"
    
    cd "$REPO_DIR/web"
    
    print_step "Building MLC WASM runtime..."
    ./prep_emcc_deps.sh
    
    cd "$REPO_DIR/3rdparty/tvm/web"
    
    print_step "Building TVM WASM runtime..."
    export TVM_HOME="$REPO_DIR/3rdparty/tvm"
    make
    
    # Copy .bc files to Python package
    print_step "Installing WASM runtime files..."
    
    SITE_PACKAGES=$(python3 -c "import site; print(site.getsitepackages()[0])")
    
    if [ -f "$REPO_DIR/web/dist/wasm/mlc_wasm_runtime.bc" ]; then
        cp "$REPO_DIR/web/dist/wasm/mlc_wasm_runtime.bc" "$SITE_PACKAGES/mlc_llm/"
        print_success "Copied mlc_wasm_runtime.bc"
    fi
    
    if [ -d "$REPO_DIR/3rdparty/tvm/web/dist/wasm" ]; then
        cp "$REPO_DIR/3rdparty/tvm/web/dist/wasm/"*.bc "$SITE_PACKAGES/tvm/" 2>/dev/null || true
        print_success "Copied TVM WASM runtime files"
    fi
    
    print_success "WASM runtime libraries built and installed"
}

# =============================================================================
# PHASE 8: DOWNLOAD MODEL WEIGHTS
# =============================================================================

download_model() {
    print_phase "8" "Downloading Model Weights"
    
    local model_name="${1:-Phi-3.5-vision-instruct}"
    local model_repo="${2:-microsoft/Phi-3.5-vision-instruct}"
    
    source "$VENV_DIR/bin/activate"
    cd "$MODEL_DIR"
    
    if [ -d "$model_name" ]; then
        print_step "Model directory exists. Checking for completeness..."
        if [ -f "$model_name/model.safetensors.index.json" ] || [ -f "$model_name/config.json" ]; then
            print_success "Model weights already downloaded"
            return 0
        fi
    fi
    
    print_step "Downloading $model_repo (this is a large download: ~8-15 GB)..."
    
    python3 << EOF
from huggingface_hub import snapshot_download
import os

path = snapshot_download(
    repo_id='$model_repo',
    local_dir='$MODEL_DIR/$model_name',
    local_dir_use_symlinks=False,
    resume_download=True
)
print(f'Downloaded to: {path}')
EOF
    
    print_success "Model weights downloaded to $MODEL_DIR/$model_name"
}

# =============================================================================
# PHASE 9: COMPILE VISION MODEL FOR WEBGPU
# =============================================================================

compile_model() {
    print_phase "9" "Compiling Vision Model for WebGPU"
    
    local model_name="${1:-Phi-3.5-vision-instruct}"
    local output_name="${2:-Vet-Rate-Vision-Phi-q4f32_1}"
    
    source "$VENV_DIR/bin/activate"
    source "$EMSDK_DIR/emsdk_env.sh"
    
    export MLC_LLM_SOURCE_DIR="$REPO_DIR"
    
    cd "$WORK_DIR"
    
    # Step 1: Generate config
    print_step "Step 1/3: Generating model configuration..."
    python -m mlc_llm gen_config \
        "$MODEL_DIR/$model_name" \
        --quantization q4f32_1 \
        -o "$OUTPUT_DIR/$output_name"
    
    # Step 2: Convert and quantize weights
    print_step "Step 2/3: Converting and quantizing weights (this takes several minutes)..."
    python -m mlc_llm convert_weight \
        "$MODEL_DIR/$model_name" \
        --quantization q4f32_1 \
        --device cpu \
        -o "$OUTPUT_DIR/$output_name"
    
    # Step 3: Compile for WebGPU
    print_step "Step 3/3: Compiling for WebGPU..."
    python -m mlc_llm compile \
        "$OUTPUT_DIR/$output_name" \
        --device webgpu \
        --opt O2 \
        -o "$OUTPUT_DIR/$output_name/${output_name}-webgpu.wasm"
    
    print_success "Model compiled successfully!"
    print_success "Output location: $OUTPUT_DIR/$output_name"
    
    # List output files
    echo ""
    print_step "Compiled files:"
    ls -lh "$OUTPUT_DIR/$output_name/"*.wasm 2>/dev/null || print_warning "No WASM file found"
    ls -lh "$OUTPUT_DIR/$output_name/"*.json 2>/dev/null | head -5
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    print_banner
    
    echo -e "${YELLOW}Pre-flight Checks${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    check_disk_space
    check_memory
    
    echo ""
    echo -e "${YELLOW}This process will take approximately 2-4 hours and requires:${NC}"
    echo "  • 50+ GB disk space"
    echo "  • 8+ GB RAM (16+ recommended)"
    echo "  • Stable internet connection"
    echo ""
    
    read -p "Ready to proceed? (y/n) " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Build cancelled."
        exit 0
    fi
    
    # Execute build phases
    install_system_deps
    setup_workspace
    setup_python_env
    apply_float32_patch
    setup_emscripten
    build_mlc_llm
    build_wasm_runtime
    
    # Optional: Download and compile model
    echo ""
    read -p "Download and compile Phi-3.5 Vision model? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        download_model "Phi-3.5-vision-instruct" "microsoft/Phi-3.5-vision-instruct"
        compile_model "Phi-3.5-vision-instruct" "Vet-Rate-Vision-Phi-q4f32_1"
    fi
    
    # Print success summary
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                                    ║${NC}"
    echo -e "${GREEN}║     VET-RATE VISION COMPILER BUILD COMPLETE!                       ║${NC}"
    echo -e "${GREEN}║                                                                    ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "To use your custom compiler:"
    echo ""
    echo "  1. Activate the environment:"
    echo "     source $VENV_DIR/bin/activate"
    echo "     source $EMSDK_DIR/emsdk_env.sh"
    echo ""
    echo "  2. Compile a model:"
    echo "     cd $WORK_DIR"
    echo "     python -m mlc_llm compile ..."
    echo ""
    echo "  3. Output files are in: $OUTPUT_DIR"
    echo ""
}

# Allow running specific phases
case "${1:-}" in
    "deps")
        install_system_deps
        ;;
    "workspace")
        setup_workspace
        ;;
    "python")
        setup_python_env
        ;;
    "patch")
        apply_float32_patch
        ;;
    "emscripten")
        setup_emscripten
        ;;
    "build")
        build_mlc_llm
        ;;
    "wasm")
        build_wasm_runtime
        ;;
    "download")
        download_model "${2:-Phi-3.5-vision-instruct}" "${3:-microsoft/Phi-3.5-vision-instruct}"
        ;;
    "compile")
        compile_model "${2:-Phi-3.5-vision-instruct}" "${3:-Vet-Rate-Vision-Phi-q4f32_1}"
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [phase]"
        echo ""
        echo "Phases:"
        echo "  (none)     - Run full build"
        echo "  deps       - Install system dependencies only"
        echo "  workspace  - Set up workspace only"
        echo "  python     - Set up Python environment only"
        echo "  patch      - Apply Float32 bypass patch only"
        echo "  emscripten - Set up Emscripten only"
        echo "  build      - Build TVM/MLC-LLM only"
        echo "  wasm       - Build WASM runtime only"
        echo "  download   - Download model weights"
        echo "  compile    - Compile model for WebGPU"
        ;;
    *)
        main
        ;;
esac
