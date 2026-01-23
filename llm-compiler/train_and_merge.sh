#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  💎 DIAMOND STANDARD: LoRA Training & Merge Pipeline                        ║
# ╠══════════════════════════════════════════════════════════════════════════════╣
# ║  Hardware: NVIDIA RTX 4080 Super OC (16GB VRAM)                             ║
# ║  Environment: WSL2 Ubuntu 22.04/24.04                                       ║
# ║  Purpose: Train LoRA adapters and merge into standalone models              ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# ==============================================================================
# CONFIGURATION
# ==============================================================================

# Force single GPU (RTX 4080 Super)
export CUDA_VISIBLE_DEVICES=0

# Disable W&B if not configured (prevents prompts)
export WANDB_DISABLED="${WANDB_DISABLED:-true}"

# HuggingFace cache (uses Windows drive space)
export HF_HOME="${HF_HOME:-$HOME/.cache/huggingface}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/axolotl-configs"
MODELS_DIR="${SCRIPT_DIR}/models"
LOGS_DIR="${SCRIPT_DIR}/logs"

# Create directories
mkdir -p "${MODELS_DIR}/lora-adapters"
mkdir -p "${MODELS_DIR}/merged"
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

check_gpu() {
    log_info "Checking GPU availability..."
    
    if ! command -v nvidia-smi &> /dev/null; then
        log_error "nvidia-smi not found. Is CUDA installed in WSL2?"
        exit 1
    fi
    
    GPU_INFO=$(nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader)
    log_info "GPU: ${GPU_INFO}"
    
    # Check VRAM (expect 16GB for 4080 Super)
    VRAM_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
    if [ "${VRAM_MB}" -lt 15000 ]; then
        log_warn "VRAM ${VRAM_MB}MB may be insufficient. Expected 16GB for RTX 4080 Super."
    else
        log_success "VRAM: ${VRAM_MB}MB (sufficient)"
    fi
}

check_axolotl() {
    log_info "Checking Axolotl installation..."
    
    if ! command -v axolotl &> /dev/null; then
        log_error "Axolotl not found. Install with: pip install axolotl[flash-attn]"
        exit 1
    fi
    
    AXOLOTL_VERSION=$(pip show axolotl 2>/dev/null | grep Version | cut -d' ' -f2)
    log_success "Axolotl version: ${AXOLOTL_VERSION}"
}

# ==============================================================================
# TRAINING FUNCTION
# ==============================================================================

train_adapter() {
    local CONFIG_FILE="$1"
    local ADAPTER_NAME="$2"
    local LOG_FILE="${LOGS_DIR}/${ADAPTER_NAME}_train_$(date '+%Y%m%d_%H%M%S').log"
    
    print_banner "TRAINING: ${ADAPTER_NAME}"
    
    log_info "Config: ${CONFIG_FILE}"
    log_info "Log file: ${LOG_FILE}"
    
    # Validate config exists
    if [ ! -f "${CONFIG_FILE}" ]; then
        log_error "Config file not found: ${CONFIG_FILE}"
        return 1
    fi
    
    # Start training
    log_info "Starting Axolotl training..."
    log_info "Monitor GPU: watch -n 1 nvidia-smi"
    log_info "Tail logs: tail -f ${LOG_FILE}"
    echo ""
    
    # Run training with logging
    if axolotl train "${CONFIG_FILE}" 2>&1 | tee "${LOG_FILE}"; then
        log_success "Training completed for ${ADAPTER_NAME}"
        
        # Extract final loss from log
        FINAL_LOSS=$(grep -oP "loss['\"]?: [\d.]+" "${LOG_FILE}" | tail -1 | grep -oP "[\d.]+$" || echo "N/A")
        log_info "Final training loss: ${FINAL_LOSS}"
        
        return 0
    else
        log_error "Training failed for ${ADAPTER_NAME}"
        log_error "Check log: ${LOG_FILE}"
        return 1
    fi
}

# ==============================================================================
# MERGE FUNCTION (CRITICAL FOR WEBLLM)
# ==============================================================================

merge_adapter() {
    local CONFIG_FILE="$1"
    local ADAPTER_DIR="$2"
    local OUTPUT_DIR="$3"
    local ADAPTER_NAME="$4"
    local LOG_FILE="${LOGS_DIR}/${ADAPTER_NAME}_merge_$(date '+%Y%m%d_%H%M%S').log"
    
    print_banner "MERGING: ${ADAPTER_NAME}"
    
    log_info "Adapter: ${ADAPTER_DIR}"
    log_info "Output: ${OUTPUT_DIR}"
    log_info "Log file: ${LOG_FILE}"
    
    # Validate adapter directory exists and has checkpoint
    if [ ! -d "${ADAPTER_DIR}" ]; then
        log_error "Adapter directory not found: ${ADAPTER_DIR}"
        return 1
    fi
    
    # Find the best checkpoint or final adapter
    local CHECKPOINT_DIR=""
    if [ -f "${ADAPTER_DIR}/adapter_model.safetensors" ]; then
        CHECKPOINT_DIR="${ADAPTER_DIR}"
        log_info "Using final adapter"
    elif ls "${ADAPTER_DIR}"/checkpoint-*/adapter_model.safetensors 1> /dev/null 2>&1; then
        # Get latest checkpoint
        CHECKPOINT_DIR=$(ls -td "${ADAPTER_DIR}"/checkpoint-*/ | head -1)
        log_info "Using checkpoint: ${CHECKPOINT_DIR}"
    else
        log_error "No adapter_model.safetensors found in ${ADAPTER_DIR}"
        log_error "Training may have failed or not saved checkpoints"
        return 1
    fi
    
    # Create output directory
    mkdir -p "${OUTPUT_DIR}"
    
    # Run merge command
    log_info "Starting LoRA merge into base model..."
    log_info "This may take 5-10 minutes and use significant VRAM..."
    echo ""
    
    if python -m axolotl.cli.merge_lora "${CONFIG_FILE}" \
        --lora_model_dir "${CHECKPOINT_DIR}" \
        --output_dir "${OUTPUT_DIR}" 2>&1 | tee "${LOG_FILE}"; then
        
        # Verify merge succeeded
        if verify_merge "${OUTPUT_DIR}"; then
            log_success "Merge completed successfully for ${ADAPTER_NAME}"
            return 0
        else
            log_error "Merge verification failed for ${ADAPTER_NAME}"
            return 1
        fi
    else
        log_error "Merge command failed for ${ADAPTER_NAME}"
        log_error "Check log: ${LOG_FILE}"
        return 1
    fi
}

# ==============================================================================
# MERGE VERIFICATION (How to know if merge succeeded)
# ==============================================================================

verify_merge() {
    local OUTPUT_DIR="$1"
    local REQUIRED_FILES=(
        "config.json"
        "generation_config.json"
        "tokenizer.json"
        "tokenizer_config.json"
    )
    
    log_info "Verifying merged model..."
    
    # Check for required files
    local MISSING_FILES=()
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "${OUTPUT_DIR}/${file}" ]; then
            MISSING_FILES+=("${file}")
        fi
    done
    
    # Check for model weights (safetensors preferred, pytorch fallback)
    local HAS_WEIGHTS=false
    if ls "${OUTPUT_DIR}"/model*.safetensors 1> /dev/null 2>&1; then
        HAS_WEIGHTS=true
        WEIGHT_SIZE=$(du -sh "${OUTPUT_DIR}"/model*.safetensors 2>/dev/null | head -1 | cut -f1)
        log_info "Model weights (safetensors): ${WEIGHT_SIZE}"
    elif ls "${OUTPUT_DIR}"/pytorch_model*.bin 1> /dev/null 2>&1; then
        HAS_WEIGHTS=true
        WEIGHT_SIZE=$(du -sh "${OUTPUT_DIR}"/pytorch_model*.bin 2>/dev/null | head -1 | cut -f1)
        log_info "Model weights (pytorch): ${WEIGHT_SIZE}"
    fi
    
    # Report results
    if [ ${#MISSING_FILES[@]} -gt 0 ]; then
        log_error "Missing required files: ${MISSING_FILES[*]}"
        return 1
    fi
    
    if [ "${HAS_WEIGHTS}" = false ]; then
        log_error "No model weights found (model*.safetensors or pytorch_model*.bin)"
        return 1
    fi
    
    # Check model size (3B should be ~5-6GB)
    TOTAL_SIZE=$(du -sh "${OUTPUT_DIR}" | cut -f1)
    log_info "Total merged model size: ${TOTAL_SIZE}"
    
    # List all files
    log_info "Merged model contents:"
    ls -lh "${OUTPUT_DIR}" | head -15
    
    log_success "Merge verification passed ✓"
    return 0
}

# ==============================================================================
# FULL PIPELINE: TRAIN + MERGE
# ==============================================================================

run_full_pipeline() {
    local ROLE="$1"  # auditor, writer, or rater
    local CONFIG_FILE="${CONFIG_DIR}/${ROLE}-3b-qlora-v2.yml"
    local ADAPTER_DIR="${MODELS_DIR}/lora-adapters/vetrate-${ROLE}-3b-v2"
    local MERGED_DIR="${MODELS_DIR}/merged/vetrate-${ROLE}-merged"
    
    print_banner "FULL PIPELINE: ${ROLE^^}"
    
    local START_TIME=$(date +%s)
    
    # Step 1: Train
    if ! train_adapter "${CONFIG_FILE}" "vetrate-${ROLE}"; then
        log_error "Pipeline failed at training step for ${ROLE}"
        return 1
    fi
    
    # Step 2: Merge
    if ! merge_adapter "${CONFIG_FILE}" "${ADAPTER_DIR}" "${MERGED_DIR}" "vetrate-${ROLE}"; then
        log_error "Pipeline failed at merge step for ${ROLE}"
        return 1
    fi
    
    local END_TIME=$(date +%s)
    local DURATION=$((END_TIME - START_TIME))
    local HOURS=$((DURATION / 3600))
    local MINUTES=$(((DURATION % 3600) / 60))
    
    log_success "Pipeline completed for ${ROLE} in ${HOURS}h ${MINUTES}m"
    log_info "Merged model: ${MERGED_DIR}"
    
    return 0
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

main() {
    print_banner "💎 DIAMOND STANDARD: LoRA Training & Merge Pipeline"
    
    # Parse arguments
    local ACTION="${1:-all}"
    local ROLE="${2:-auditor}"
    
    # Pre-flight checks
    check_gpu
    check_axolotl
    
    case "${ACTION}" in
        train)
            train_adapter "${CONFIG_DIR}/${ROLE}-3b-qlora-v2.yml" "vetrate-${ROLE}"
            ;;
        merge)
            local ADAPTER_DIR="${MODELS_DIR}/lora-adapters/vetrate-${ROLE}-3b-v2"
            local MERGED_DIR="${MODELS_DIR}/merged/vetrate-${ROLE}-merged"
            merge_adapter "${CONFIG_DIR}/${ROLE}-3b-qlora-v2.yml" "${ADAPTER_DIR}" "${MERGED_DIR}" "vetrate-${ROLE}"
            ;;
        verify)
            local MERGED_DIR="${MODELS_DIR}/merged/vetrate-${ROLE}-merged"
            verify_merge "${MERGED_DIR}"
            ;;
        full|pipeline)
            run_full_pipeline "${ROLE}"
            ;;
        all)
            # Train and merge all three swarm members
            log_info "Training all swarm members: auditor, writer, rater"
            for role in auditor writer rater; do
                if ! run_full_pipeline "${role}"; then
                    log_error "Failed at ${role}. Stopping pipeline."
                    exit 1
                fi
            done
            print_banner "🎉 ALL SWARM MEMBERS TRAINED & MERGED"
            log_success "Models ready for MLC-LLM compilation"
            ;;
        *)
            echo "Usage: $0 [action] [role]"
            echo ""
            echo "Actions:"
            echo "  train   - Train LoRA adapter only"
            echo "  merge   - Merge existing adapter into base model"
            echo "  verify  - Verify a merged model"
            echo "  full    - Train + Merge for one role"
            echo "  all     - Train + Merge all roles (auditor, writer, rater)"
            echo ""
            echo "Roles: auditor, writer, rater"
            echo ""
            echo "Examples:"
            echo "  $0 full auditor     # Train and merge Auditor"
            echo "  $0 train writer     # Train Writer only"
            echo "  $0 merge rater      # Merge existing Rater adapter"
            echo "  $0 all              # Full pipeline for all roles"
            exit 1
            ;;
    esac
}

# Run main with all arguments
main "$@"
