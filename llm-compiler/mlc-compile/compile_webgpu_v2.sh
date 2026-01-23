#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  💎 DIAMOND STANDARD: MLC-LLM WebGPU Compilation                            ║
# ╠══════════════════════════════════════════════════════════════════════════════╣
# ║  Purpose: Compile merged LoRA models to WebGPU format for browser inference ║
# ║  Hardware: RTX 4080 Super (CUDA acceleration for fast compilation)          ║
# ║  Target: WebLLM client-side inference                                       ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

set -euo pipefail

# ==============================================================================
# CONFIGURATION
# ==============================================================================

# Force RTX 4080 for compilation acceleration
export CUDA_VISIBLE_DEVICES=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "${SCRIPT_DIR}")"
MODELS_DIR="${PROJECT_DIR}/models/merged"
DIST_DIR="${PROJECT_DIR}/dist"
LOGS_DIR="${PROJECT_DIR}/logs"

mkdir -p "${DIST_DIR}"
mkdir -p "${LOGS_DIR}"

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

print_banner() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  $1"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# ==============================================================================
# PRE-FLIGHT CHECKS
# ==============================================================================

check_mlc_llm() {
    log_info "Checking MLC-LLM installation..."
    
    if ! python3 -c "import mlc_llm" 2>/dev/null; then
        log_warn "MLC-LLM not found. Installing..."
        pip install --pre -U -f https://mlc.ai/wheels mlc-llm-nightly mlc-ai-nightly
    fi
    
    MLC_VERSION=$(python3 -c "import mlc_llm; print(mlc_llm.__version__)" 2>/dev/null || echo "unknown")
    log_success "MLC-LLM version: ${MLC_VERSION}"
}

check_gpu() {
    log_info "Checking GPU for compilation acceleration..."
    
    if nvidia-smi &>/dev/null; then
        GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
        log_success "GPU: ${GPU_NAME} (CUDA acceleration enabled)"
    else
        log_warn "No GPU detected. Compilation will use CPU (slower)."
    fi
}

check_source_model() {
    local MODEL_PATH="$1"
    
    log_info "Checking source model: ${MODEL_PATH}"
    
    if [ ! -d "${MODEL_PATH}" ]; then
        log_error "Model directory not found: ${MODEL_PATH}"
        return 1
    fi
    
    # Check for required files
    local REQUIRED_FILES=("config.json" "tokenizer.json")
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "${MODEL_PATH}/${file}" ]; then
            log_error "Missing required file: ${file}"
            return 1
        fi
    done
    
    # Check for model weights
    if ls "${MODEL_PATH}"/model*.safetensors 1>/dev/null 2>&1; then
        log_success "Model weights found (safetensors)"
    elif ls "${MODEL_PATH}"/pytorch_model*.bin 1>/dev/null 2>&1; then
        log_success "Model weights found (pytorch)"
    else
        log_error "No model weights found"
        return 1
    fi
    
    return 0
}

# ==============================================================================
# MLC-LLM COMPILATION
# ==============================================================================

compile_model() {
    local MODEL_PATH="$1"
    local OUTPUT_NAME="$2"
    local QUANTIZATION="${3:-q4f16_1}"
    local OUTPUT_DIR="${DIST_DIR}/${OUTPUT_NAME}"
    local LOG_FILE="${LOGS_DIR}/${OUTPUT_NAME}_compile_$(date '+%Y%m%d_%H%M%S').log"
    
    print_banner "COMPILING: ${OUTPUT_NAME}"
    
    log_info "Source: ${MODEL_PATH}"
    log_info "Output: ${OUTPUT_DIR}"
    log_info "Quantization: ${QUANTIZATION}"
    log_info "Log: ${LOG_FILE}"
    echo ""
    
    # Validate source
    if ! check_source_model "${MODEL_PATH}"; then
        return 1
    fi
    
    # Create output directory
    mkdir -p "${OUTPUT_DIR}"
    
    local START_TIME=$(date +%s)
    
    # =========================================================================
    # STEP 1: Convert model to MLC format
    # =========================================================================
    log_info "Step 1/3: Converting model to MLC format..."
    
    if python3 -m mlc_llm convert_weight \
        "${MODEL_PATH}" \
        --quantization "${QUANTIZATION}" \
        --output "${OUTPUT_DIR}" \
        2>&1 | tee -a "${LOG_FILE}"; then
        log_success "Weight conversion complete"
    else
        log_error "Weight conversion failed"
        return 1
    fi
    
    # =========================================================================
    # STEP 2: Generate MLC config
    # =========================================================================
    log_info "Step 2/3: Generating MLC configuration..."
    
    if python3 -m mlc_llm gen_config \
        "${MODEL_PATH}" \
        --quantization "${QUANTIZATION}" \
        --conv-template llama-3 \
        --output "${OUTPUT_DIR}" \
        2>&1 | tee -a "${LOG_FILE}"; then
        log_success "Config generation complete"
    else
        log_error "Config generation failed"
        return 1
    fi
    
    # =========================================================================
    # STEP 3: Compile model library for WebGPU
    # =========================================================================
    log_info "Step 3/3: Compiling model library for WebGPU..."
    log_info "Using CUDA:0 (RTX 4080) for acceleration..."
    
    if python3 -m mlc_llm compile \
        "${OUTPUT_DIR}/mlc-chat-config.json" \
        --device cuda:0 \
        --target webgpu \
        --output "${OUTPUT_DIR}/${OUTPUT_NAME}.wasm" \
        2>&1 | tee -a "${LOG_FILE}"; then
        log_success "WebGPU compilation complete"
    else
        log_error "WebGPU compilation failed"
        return 1
    fi
    
    local END_TIME=$(date +%s)
    local DURATION=$((END_TIME - START_TIME))
    local MINUTES=$((DURATION / 60))
    local SECONDS=$((DURATION % 60))
    
    log_info "Compilation time: ${MINUTES}m ${SECONDS}s"
    
    # Verify output
    if verify_compilation "${OUTPUT_DIR}" "${OUTPUT_NAME}"; then
        log_success "Compilation verified successfully"
        return 0
    else
        log_error "Compilation verification failed"
        return 1
    fi
}

# ==============================================================================
# VERIFICATION (Critical for WebLLM loading)
# ==============================================================================

verify_compilation() {
    local OUTPUT_DIR="$1"
    local MODEL_NAME="$2"
    
    print_banner "VERIFYING: ${MODEL_NAME}"
    
    local ALL_PRESENT=true
    
    # =========================================================================
    # REQUIRED FILES for WebLLM to load successfully
    # =========================================================================
    
    echo -e "${CYAN}Checking required files...${NC}"
    echo ""
    
    # 1. ndarray-cache.json - Index of all weight shards
    if [ -f "${OUTPUT_DIR}/ndarray-cache.json" ]; then
        local SHARD_COUNT=$(grep -c "params_shard" "${OUTPUT_DIR}/ndarray-cache.json" 2>/dev/null || echo "0")
        echo -e "  ${GREEN}✓${NC} ndarray-cache.json (${SHARD_COUNT} shards indexed)"
    else
        echo -e "  ${RED}✗${NC} ndarray-cache.json - MISSING (WebLLM cannot find weights)"
        ALL_PRESENT=false
    fi
    
    # 2. params_shard_*.bin - Quantized weight shards
    if ls "${OUTPUT_DIR}"/params_shard_*.bin 1>/dev/null 2>&1; then
        local SHARD_FILES=$(ls -1 "${OUTPUT_DIR}"/params_shard_*.bin | wc -l)
        local TOTAL_SIZE=$(du -sh "${OUTPUT_DIR}"/params_shard_*.bin 2>/dev/null | tail -1 | cut -f1)
        echo -e "  ${GREEN}✓${NC} params_shard_*.bin (${SHARD_FILES} files, ${TOTAL_SIZE} total)"
    else
        echo -e "  ${RED}✗${NC} params_shard_*.bin - MISSING (No quantized weights)"
        ALL_PRESENT=false
    fi
    
    # 3. mlc-chat-config.json - Model configuration for WebLLM
    if [ -f "${OUTPUT_DIR}/mlc-chat-config.json" ]; then
        echo -e "  ${GREEN}✓${NC} mlc-chat-config.json"
    else
        echo -e "  ${RED}✗${NC} mlc-chat-config.json - MISSING (WebLLM cannot configure model)"
        ALL_PRESENT=false
    fi
    
    # 4. tokenizer.json - Tokenizer for text processing
    if [ -f "${OUTPUT_DIR}/tokenizer.json" ]; then
        echo -e "  ${GREEN}✓${NC} tokenizer.json"
    else
        echo -e "  ${RED}✗${NC} tokenizer.json - MISSING (Cannot tokenize input)"
        ALL_PRESENT=false
    fi
    
    # 5. tokenizer_config.json - Tokenizer settings
    if [ -f "${OUTPUT_DIR}/tokenizer_config.json" ]; then
        echo -e "  ${GREEN}✓${NC} tokenizer_config.json"
    else
        echo -e "  ${YELLOW}⚠${NC} tokenizer_config.json - Missing (may work without)"
    fi
    
    # 6. WASM library (optional but recommended)
    if [ -f "${OUTPUT_DIR}/${MODEL_NAME}.wasm" ]; then
        local WASM_SIZE=$(du -h "${OUTPUT_DIR}/${MODEL_NAME}.wasm" | cut -f1)
        echo -e "  ${GREEN}✓${NC} ${MODEL_NAME}.wasm (${WASM_SIZE})"
    else
        echo -e "  ${YELLOW}⚠${NC} ${MODEL_NAME}.wasm - Missing (WebLLM uses default library)"
    fi
    
    echo ""
    
    # =========================================================================
    # SUMMARY
    # =========================================================================
    
    echo -e "${CYAN}Output directory contents:${NC}"
    ls -lh "${OUTPUT_DIR}" | head -20
    echo ""
    
    local TOTAL_DIR_SIZE=$(du -sh "${OUTPUT_DIR}" | cut -f1)
    echo -e "Total size: ${TOTAL_DIR_SIZE}"
    echo ""
    
    if [ "${ALL_PRESENT}" = true ]; then
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✅ VERIFICATION PASSED - Model ready for WebLLM                ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
        return 0
    else
        echo -e "${RED}╔══════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ❌ VERIFICATION FAILED - Missing critical files                 ║${NC}"
        echo -e "${RED}╚══════════════════════════════════════════════════════════════════╝${NC}"
        return 1
    fi
}

# ==============================================================================
# MAIN
# ==============================================================================

main() {
    print_banner "💎 MLC-LLM WebGPU Compilation Pipeline"
    
    local ACTION="${1:-compile}"
    local ROLE="${2:-auditor}"
    local QUANTIZATION="${3:-q4f16_1}"
    
    # Pre-flight checks
    check_mlc_llm
    check_gpu
    
    case "${ACTION}" in
        compile)
            local MODEL_PATH="${MODELS_DIR}/vetrate-${ROLE}-merged"
            local OUTPUT_NAME="vetrate-${ROLE}-web"
            compile_model "${MODEL_PATH}" "${OUTPUT_NAME}" "${QUANTIZATION}"
            ;;
        verify)
            local OUTPUT_DIR="${DIST_DIR}/vetrate-${ROLE}-web"
            verify_compilation "${OUTPUT_DIR}" "vetrate-${ROLE}-web"
            ;;
        all)
            for role in auditor writer rater; do
                local MODEL_PATH="${MODELS_DIR}/vetrate-${role}-merged"
                local OUTPUT_NAME="vetrate-${role}-web"
                
                if [ -d "${MODEL_PATH}" ]; then
                    if ! compile_model "${MODEL_PATH}" "${OUTPUT_NAME}" "${QUANTIZATION}"; then
                        log_error "Failed to compile ${role}"
                        exit 1
                    fi
                else
                    log_warn "Skipping ${role} - merged model not found"
                fi
            done
            print_banner "🎉 ALL MODELS COMPILED FOR WEBGPU"
            ;;
        *)
            echo "Usage: $0 [action] [role] [quantization]"
            echo ""
            echo "Actions:"
            echo "  compile  - Compile a single model (default)"
            echo "  verify   - Verify a compiled model"
            echo "  all      - Compile all available models"
            echo ""
            echo "Roles: auditor, writer, rater"
            echo ""
            echo "Quantization options:"
            echo "  q4f16_1  - 4-bit weights, fp16 activations (RECOMMENDED)"
            echo "  q4f32_1  - 4-bit weights, fp32 activations (more accurate)"
            echo "  q3f16_1  - 3-bit weights (smaller, less accurate)"
            echo ""
            echo "Examples:"
            echo "  $0 compile auditor q4f16_1"
            echo "  $0 verify auditor"
            echo "  $0 all"
            exit 1
            ;;
    esac
}

main "$@"
