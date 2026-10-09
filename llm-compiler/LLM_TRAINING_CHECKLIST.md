# 💎 VET-RATE LLM SWARM TRAINING CHECKLIST

**Generated:** January 22, 2026  
**Plan Source:** [Gemini Diamond Implementation Plan](https://gemini.google.com/share/b0da14572725)  
**Hardware:** RTX 4080 Super OC (16GB VRAM)  
**Architecture:** LoRA Swarm (Unified Model Strategy)

---

## 🎯 PHASE STATUS OVERVIEW

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| **Phase 1** | Project Alignment & Architecture | ✅ COMPLETE | Diamond Standard defined |
| **Phase 2** | Data Engineering (Diamond KB → JSONL) | ✅ COMPLETE | 2,028 examples prepared |
| **Phase 3** | Axolotl Configuration (RTX 4080 Super) | ✅ COMPLETE | 3 configs validated |
| **Phase 4** | Training & Merge Execution | ⏳ **READY TO EXECUTE** | Scripts created |
| **Phase 5** | MLC/WebLLM Compilation | ⏳ PENDING | Waiting for Phase 4 |
| **Phase 6** | Frontend React Integration | ✅ CODE READY | Hook + components created |

---

## ✅ COMPLETED STEPS

### Step 1: Project Alignment ✅

- [x] Confirmed 16GB VRAM constraint
- [x] MLC-compatible binaries requirement
- [x] Diamond quality code (robust error handling)
- [x] Base model: `meta-llama/Llama-3.2-3B-Instruct`
- [x] Architecture: LoRA Swarm with hot-swapping

### Step 2: Data Engineering ✅

**File:** `prep_swarm_data_v2.py`  
**Output:** `training-data-v2/`

| Dataset | Train | Validation | Size |
|---------|-------|------------|------|
| **Auditor** | 1,338 examples | 71 examples | 1.15 MB |
| **Writer** | 588 examples | 31 examples | 0.99 MB |
| **Rater** | ~400 examples | ~20 examples | ~0.5 MB |

**System Prompts Embedded:**

- ✅ Auditor: "You are VetRate-Auditor. You strictly cite 38 CFR..."
- ✅ Writer: "You are VetRate-Writer. Write persuasive, empathetic..."
- ✅ Rater: "You are VetRate-Rater. Calculate ratings..."

**Quality Checks:**

- ✅ Placeholder removal
- ✅ Minimum length enforcement (instruction: 10, output: 50)
- ✅ Maximum output length (4,096 tokens)
- ✅ Unicode normalization
- ✅ 95%/5% train/validation split

### Step 3: Axolotl Configuration ✅

**Files Created:**

- `axolotl-configs/auditor-3b-qlora.yml` (262 lines)
- `axolotl-configs/writer-3b-qlora.yml` (262 lines)

**RTX 4080 Super Optimizations:**

- ✅ `load_in_4bit: true` (QLoRA)
- ✅ `flash_attention: true` (40-series acceleration)
- ✅ `bf16: true` (Ada Lovelace optimal)
- ✅ `micro_batch_size: 4`
- ✅ `gradient_accumulation_steps: 4`
- ✅ `sequence_len: 4096`
- ✅ LoRA: r=32, alpha=64

**VRAM Budget:**

```
Total Available:    16.0 GB
Estimated Usage:    11.2 GB (70%)
Safety Margin:       4.8 GB (30%)
```

### Step 4: Training Scripts ✅ (READY)

**Files:**

- `train_and_merge.ps1` (PowerShell, 600+ lines)
- `train_and_merge.sh` (Bash/WSL, backup)

**Features:**

- ✅ GPU forcing (CUDA_VISIBLE_DEVICES=0)
- ✅ Prerequisite validation
- ✅ Background GPU monitoring
- ✅ Axolotl training execution
- ✅ **CRITICAL:** LoRA adapter merging
- ✅ Merged model validation
- ✅ Comprehensive error handling

### Step 5: WebGPU Compilation ✅ (READY)

**File:** `compile_to_webgpu.ps1` (700+ lines)

**Planned:**

- ✅ Quantization: `q4f16_1` (browser optimal)
- ✅ Device: `cuda:0` (RTX 4080 Super acceleration)
- ✅ Output: `./dist/vetrate-{swarm}-web`

### Step 6: Frontend Integration ✅ (CODE READY)

**Files:**

- `webllm-integration/useVetRateSwarm.ts` (800+ lines)
- `webllm-integration/VetRateSwarmChat.tsx`
- `webllm-integration/WEBLLM_INTEGRATION_GUIDE.md`

**Features:**

- ✅ TypeScript types (zero `any`)
- ✅ WebGPU compatibility checking
- ✅ Progress callback with ETA
- ✅ Hot-swapping between swarm members
- ✅ Streaming and non-streaming modes
- ✅ Conversation history management
- ✅ Error handling and recovery

---

## 🚀 BONUS: VET-RATE VISION COMPLETE ✅

**Vision Models Uploaded to HuggingFace:**

- ✅ `Vet-Rate-org/Vet-Rate-Vision-Phi` (Primary)
- ✅ `Vet-Rate-org/Vet-Rate-Vision-Phi-Float32`
- ✅ `Vet-Rate-org/Vet-Rate-Vision-Phi-Small`
- ✅ `Vet-Rate-org/Vet-Rate-Vision-Phi-8K` (Extended context)
- ✅ `Vet-Rate-org/Vet-Rate-Vision-Phi-Fast` (Speed optimized)

**Use Case:** DD214 image parsing, medical document OCR

---

## ⏳ NEXT ACTION REQUIRED

### Execute Phase 4: Training

**✅ ENVIRONMENT READY** (as of Jan 22, 2026)

All dependencies installed in WSL:

- PyTorch 2.8.0 + CUDA 12.8 ✅
- Transformers 4.57.6 ✅
- PEFT 0.18.1 ✅
- BitsAndBytes 0.49.1 ✅
- Axolotl 0.14.0.dev0 ✅

**Training Data in place:**

- `~/vet-rate-swarm/data/train_auditor.jsonl` (3,058 examples)
- `~/vet-rate-swarm/data/train_writer.jsonl` (598 examples)
- `~/vet-rate-swarm/data/train_rater.jsonl` (555 examples)

---

### TO START TRAINING

**Open a WSL terminal directly** (not from PowerShell):

1. Open Windows Terminal
2. Click dropdown → Select "Ubuntu-24.04"
3. Run:

```bash
source ~/miniconda3/etc/profile.d/conda.sh
conda activate vetrate-swarm
cd ~/vet-rate-swarm
export CUDA_VISIBLE_DEVICES=0
export AXOLOTL_DO_NOT_TRACK=1

# Start Auditor training (~2-4 hours)
accelerate launch -m axolotl.cli.train configs/auditor-3b-qlora-v2.yml
```

**OR use the script:**

```bash
bash ~/vet-rate-swarm/start_training.sh
```

**Expected Timeline:**

| Model | Duration | VRAM | Output |
|-------|----------|------|--------|
| Auditor | 2-4 hours | ~11GB | 30MB adapter |
| Writer | 1.5-3 hours | ~11GB | 25MB adapter |
| Both | 3.5-7 hours | ~11GB | 55MB total |

**Success Indicators:**

- Loss decreasing: `2.5 → 1.2 → 0.8`
- Merged model size: ~6-7GB
- Files: `config.json`, `model.safetensors`, `tokenizer.json`

---

## 📋 REMAINING TASKS AFTER TRAINING

### After Phase 4 Completes

1. [ ] Verify merged model in `models/vetrate-auditor-merged/`
2. [ ] Verify merged model in `models/vetrate-writer-merged/`
3. [ ] Run MLC compilation: `.\compile_to_webgpu.ps1 -SwarmMember both`
4. [ ] Verify WebGPU artifacts in `dist/`
5. [ ] Upload to HuggingFace: `Vet-Rate-org/VetRate-Auditor-3B`
6. [ ] Upload to HuggingFace: `Vet-Rate-org/VetRate-Writer-3B`
7. [ ] Test local loading with `test_swarm.html`
8. [ ] Integrate into main Vet-Rate.org frontend

### Diamond Polish (Post-Deployment)

- [ ] Client-Side RAG with MiniSearch for 38 CFR lookup
- [ ] Clickable citation linking (`[[38 CFR 4.71a]]` → modal)
- [ ] Red Team adversarial testing
- [ ] VA Math guardrails (force JSON output → JavaScript calculation)
- [ ] Mobile Safari detection and graceful fallback

---

## 📁 KEY FILE LOCATIONS

```
llm-compiler/
├── training-data-v2/           # ✅ Training JSONL files
│   ├── train_auditor.jsonl
│   ├── train_writer.jsonl
│   └── train_rater.jsonl
├── axolotl-configs/            # ✅ Training configurations
│   ├── auditor-3b-qlora.yml
│   └── writer-3b-qlora.yml
├── train_and_merge.ps1         # ⏳ Execute this next
├── compile_to_webgpu.ps1       # After training
├── webllm-integration/         # ✅ Frontend code ready
│   ├── useVetRateSwarm.ts
│   └── VetRateSwarmChat.tsx
└── models/                     # Output after training
    └── lora-adapters/
```

---

## 🎯 DECISION RECAP (From Gemini Plan)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Model Size** | 3B | WebGPU browser compatibility |
| **Training** | LoRA Adapters | Hot-swap, small downloads |
| **Hosting** | HuggingFace Hub | Free, CDN, native WebLLM support |
| **Compile** | MLC (Primary) + GGUF (Testing) | WebLLM + Ollama debug |
| **Strategy** | Unified Model | Single 2.2GB download, persona via prompt |

---

## 💎 DIAMOND STANDARD SUMMARY

**What's Built:**

- 2,028 high-quality training examples from Diamond KB
- 3 specialized persona configurations
- Complete automation scripts (train → merge → compile)
- Production-ready React integration code
- 5 Vision models already deployed to HuggingFace

**What's Needed:**

- Execute training (~4-7 hours on RTX 4080 Super)
- Compile to WebGPU (~20-40 minutes)
- Upload to HuggingFace (~1-2 hours)
- Frontend integration testing

**Total Time to Completion:** ~6-10 hours of execution time

---

*Ready to execute? Run `.\train_and_merge.ps1 -SwarmMember auditor` to begin!*
