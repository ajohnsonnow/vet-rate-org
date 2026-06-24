# Vet-Rate.org — Research Synthesis
**Date:** 2026-06-11 | **Sources:** GoatCounter export + 2× deep-research workflows (219 agents, 1,688 tool uses)

---

## Part 1 — GoatCounter Analytics (Jan 16 – Jun 10, 2026)

**5,146 total pageviews · ~34/day · ~5 months live**

### Device & Browser Breakdown

| Platform | Count | % |
|---|---|---|
| iOS (Safari) | 2,663 | **51.7%** |
| Android (Chrome) | 983 | 19.1% |
| Windows | 960 | 18.6% |
| macOS | 422 | 8.2% |
| Linux | 102 | 2.0% |
| Chrome OS | 16 | 0.3% |

| Browser | Count | % |
|---|---|---|
| Safari | 2,824 | 54.9% |
| Chrome | 2,195 | 42.6% |
| Firefox | 67 | 1.3% |
| Edge | 2 | <0.1% |

**Mobile (iOS + Android): 70.9% · Desktop: 25.1% · Tablet: 4%**

Top screen widths (all phone-sized): 440, 393, 430, 402, 390, 412, 414 px — all iPhone/Android. First desktop width (1920px) is 4th overall.

> **Critical implication:** More than half of users are on iPhone. iOS Safari's WebGPU is too restricted for large LLMs. The Warrant Council (WebLLM) almost certainly does not load on iOS. The wllama WASM fallback is not optional — it is what the majority of users need.

### Traffic Sources

| Source | Visits | % |
|---|---|---|
| Direct / bookmarks / dark social | 4,111 | 79.9% |
| **Facebook** | **429** | **8.3%** |
| Reddit app (com.reddit.frontpage) | 198 | 3.8% |
| Google organic | 193 | 3.7% |
| vet-rate.org (internal navigation) | 137 | 2.7% |
| Reddit web | 14 | 0.3% |
| Email | 8 | — |
| GitHub | 8 | — |
| Menlo Security proxy (govt/military network) | 7 | — |
| **DoD Teams (statics.dod.teams.microsoft.us)** | **6** | — |
| Bing (combined) | 8 | — |
| BuyMeACoffee | 4 | — |
| LinkedIn | 3 | — |
| Instagram | 3 | — |
| DuckDuckGo | 3 | — |

**Notable signals:**
- `/?sfnsn=mo` (10 visits) — Facebook mobile in-app browser parameter, confirms FB mobile traffic is real
- `/?trk=feed-detail_comments-list_comment-text` — LinkedIn feed comment click
- **DoD Teams + Menlo Security** — active-duty military on government networks are using the site
- **BuyMeACoffee** — organic supporters finding and donating

> **Growth lever:** Facebook is the #2 channel at 8.3%. Veteran Facebook groups (PACT Act communities, VSO groups, DAV, VFW etc.) are the highest-ROI organic distribution channel.

### Geographic Distribution (all US)

| Rank | State | Visits | Notes |
|---|---|---|---|
| 1 | Texas | 566 | Ft. Cavazos, Ft. Sam Houston, Lackland AFB |
| 2 | Florida | 455 | MacDill AFB, Eglin AFB, NAS Jacksonville |
| 3 | California | 393 | Camp Pendleton, Ft. Irwin, NAS North Island |
| 4 | Virginia | 265 | Pentagon, Ft. Belvoir, Quantico, VA HQ |
| 5 | Georgia | 239 | Ft. Stewart, Ft. Gordon, Robins AFB |
| 6 | Oregon | 211 | — |
| 7 | Washington | 174 | JBLM, Whidbey Island NAS |
| 8 | Pennsylvania | 172 | — |
| 9 | Arizona | 165 | Luke AFB, Davis-Monthan |
| 10 | New York | 160 | — |

Military-installation-dense states dominate. Virginia (#4) reflects the Pentagon/VA headquarters corridor.

### Language
97.7% English · Spanish (7) · Korean (5) · Chinese (3) · German, French, Polish, Russian, Czech (2 each)

---

## Part 2 — WebLLM / MLC-AI Landscape (Deep Research #1)

*110 agents · 863 tool uses · 25 claims verified → 10 confirmed, 15 killed*

### Verified Findings (high confidence)

**1. GGUF is architecturally incompatible with WebLLM/MLC (3-0)**
Confirmed by project maintainer (issue #2227): "GGUF is not supported with MLC-LLM." All 157+ models in the registry use MLC's own compiled format exclusively. No GGUF path exists or is planned.

**2. Official WebLLM registry has zero 7B+ mainstream models (2-1)**
As of 2026-06-09 (commit SHA 21314560), the registry contains only:
- `gemma3-1b-it-q4f16_1-MLC` (the only Gemma 3 entry)
- `DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC` (5,106 MB VRAM)
- `DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC` (6,101 MB VRAM)
- No Llama 3.1 8B, no Mistral 7B, no Gemma 3 12B/27B in config.ts

**3. Both R1 reasoning models are hardcoded to 4,096-token context (3-0)**
The prebuilt WASM artifacts have `overrides.context_window_size = 4096`. The described pipeline requires ~5,000 input tokens per chunk. These models are blocked without custom MLC recompilation.

**4. mlc-ai HuggingFace org HAS compiled Gemma 3 12B/27B artifacts (not in config.ts)**
`mlc-ai/gemma-3-27b-it-q4f16_1-MLC` (updated Sep 2025) exists and is WebLLM-compatible. It is reachable today via WebLLM's custom model config API — it just requires writing the model_list entry manually rather than using the registry name.

**5. The Ayodele01 model is Gemma 4, not Gemma 3 (3-0)**
`Ayodele01/Gemma-4-12B-Gemini-3.5-flash-Reasoning-Distill-GGUF` wraps `unsloth/gemma-4-12b-it-GGUF`, which is based on `google/gemma-4-12B-it`:
- 11.95B parameters, 48 transformer layers
- 256K context window
- Gemma 4th-generation multimodal architecture
- The "Gemini 3.5 flash reasoning distillation" label has **no primary-source backing** — treat as unverified community marketing

**6. Gemma 4 12B GGUF sizes and VRAM (3-0)**
- Q4_K_M: 7.12 GB → fits on 8 GB GPU
- UD-Q8_K_XL: 13.6 GB → fits on 16 GB (2.4 GB headroom, tight for long KV cache)
- Standard Q8_0: ~12.7 GB → ~3.3 GB headroom on 16 GB
- Requires wllama or llama.cpp WASM — not loadable by WebLLM

**7. Transformers.js v4 (Feb 9, 2026) supports 8B+ via ONNX contrib ops (2-1)**
New operators: `com.microsoft.MatMulNBits`, `com.microsoft.GroupQueryAttention`, `com.microsoft.QMoE`. Vendor benchmark: 60 tok/s for GPT-OSS 20B on Apple M4 Max. **Not independently reproduced on RTX 4080 SUPER.** Officially demonstrated models top out at Phi-3.5-mini (3.8B) — 8B+ is technically possible but uncharted on Windows/Chrome.

### Refuted Claims (killed at adversarial review)
- "LlamaWeb achieves 54% higher decode throughput than WebLLM" — 1-2, refuted
- "wllama has no WebGPU support (as of Dec 2025 issue)" — 0-3, refuted (outdated — v3.x added it)
- "Reasoning capability predicts structured extraction accuracy" — 0-3, refuted
- "Grammar-constrained decoding meaningfully improves value accuracy" — 0-3, refuted

### Open Questions from Research #1
1. Does `DeepSeek-R1-Distill-Qwen-7B` with custom MLC recompile at `context_window_size=8192` produce meaningfully better JSON extraction than Qwen2.5-3B on VA documents?
2. What is actual tok/s for any 7-12B model on RTX 4080 SUPER via any in-browser runtime?
3. Production path to load `mlc-ai/gemma-3-12b-it-q4f16_1-MLC` via custom model config with 8192 context — wasm compile requirements and download size?

---

## Part 3 — GGUF Conversion & LLM Training (Deep Research #2)

*109 agents · 825 tool uses*

### GGUF → Browser: Three Paths

**Path A — wllama v3.4.1 + WebGPU (PRODUCTION-READY as of May 2026)**

wllama v3.4.1 added WebGPU support via LlamaWeb (PR #215, Microsoft Research, arxiv 2605.20706). This reverses the December 2025 "CPU-only WASM" status. GGUF models now run with GPU acceleration in-browser.

- Load any GGUF file directly from a URL
- GPU-accelerated decode on Chrome/Edge (WebGPU)
- CPU WASM fallback for iOS Safari and older browsers
- Add as a second inference backend alongside WebLLM in `diamondSwarm.js`

**Path B — MLC-LLM compile (for WebLLM integration)**

Full pipeline on Midnight:
```
# Step 0: GGUF → HF safetensors (GGUF is not valid input for MLC)
python -m llama_cpp.convert gguf-model.gguf hf-model/

# Step 1: Convert weights
mlc_llm convert_weight ./hf-model/ \
  --quantization q4f16_1 \
  -o ./dist/gemma-3-12b/

# Step 2: Generate config
mlc_llm gen_config ./hf-model/ \
  --quantization q4f16_1 \
  --context-window-size 8192 \
  -o ./dist/gemma-3-12b/

# Step 3: Compile (WebGPU target, runs on Midnight's 4080 SUPER)
mlc_llm compile ./dist/gemma-3-12b/mlc-chat-config.json \
  --device webgpu \
  -o ./dist/gemma-3-12b/model.wasm

# Step 4: Host dist/ on Cloudflare R2 with CORS, update DIAMOND_MODELS_DEFAULT
```

Compilation time for 12B model: estimated 1–4 hours on Midnight. RAM requirement: 64–128 GB (Midnight's 128 GB is sufficient).

**Path C — transformers.js v4 ONNX (experimental)**
No direct GGUF→ONNX pipeline. Source must be HF safetensors. Only demonstrated up to 3.8B on Windows/Chrome. Skip for now.

### Model Hosting

| Option | Verdict |
|---|---|
| GitHub Pages | **Dead end** — 1 GB site hard limit, models are 7–13 GB |
| Cloudflare Pages | **Dead end for large files** — 25 MiB per-asset limit |
| **Cloudflare Pages + R2** | **Correct path** — R2 handles multi-GB objects, requires public bucket + CORS policy |
| Self-hosted CDN | Valid but adds ops burden |

Cloudflare R2 CORS config required for cross-origin browser fetches. Without it, browser `fetch()` to R2 bucket fails even with valid presigned URLs.

### Fine-Tuning on Midnight (2026 Best Practices)

**Framework recommendation: Unsloth**
- Fastest QLoRA implementation in 2026 (2–4× faster than HuggingFace TRL alone)
- Lowest VRAM overhead — 7B model fine-tune fits on single 4080 SUPER 16 GB
- Built-in LoRA → GGUF export
- Active development, best for solo developer

**Training approach for VA extraction task (<10K examples):**
1. **QLoRA** (4-bit quantized LoRA) — consensus choice for small datasets on constrained VRAM
2. **Synthetic data generation**: Use Claude Opus 4 or GPT-4 to generate labeled (document chunk → JSON extraction) pairs from redacted VA documents. Target 2,000–5,000 examples.
3. **Eval metrics**: Field-level precision/recall on held-out chunks, hallucinated DC rate (must be 0), valid JSON rate

**Publicly available extraction-specialized base models:**

| Model | Size | HuggingFace ID | Notes |
|---|---|---|---|
| **ReaderLM-v2** | 1.5B | `jina-ai/ReaderLM-v2` | Structured extraction from documents; tiny, fast, deployable on all devices |
| **NuExtract-2.0** | 8B | `numind/NuExtract-2.0-8B` | Purpose-built JSON extraction from text; has GGUF quantizations; best starting point for VA task |
| NuExtract-2.0 small | 3.8B | `numind/NuExtract-2.0-3.8B` | Lighter version; deployable via WebLLM after MLC compile |

**Midnight's training capacity:**

| Task | Setup |
|---|---|
| QLoRA 7B (single GPU) | 4080 SUPER 16 GB alone, ~2–4 h/epoch |
| QLoRA 13B | 4080 SUPER + 4070 Ti SUPER (FSDP), ~3–6 h/epoch |
| QLoRA 70B | All 4 GPUs + DeepSpeed ZeRO-3, ~8–16 h/epoch |
| Full fine-tune 7B | 4080 SUPER + 4070 Ti SUPER (32 GB combined) |
| MLC compile 12B | 4080 SUPER alone + 128 GB RAM |

### End-to-End Path: GGUF → Fine-Tuned → Browser-Deployed

```
1. Download base model HF safetensors (e.g. numind/NuExtract-2.0-8B)
2. Generate 2,000–5,000 synthetic VA extraction examples via Claude API
3. Fine-tune with Unsloth QLoRA on Midnight (8–12 hours, single 4080 SUPER)
4. Export fine-tuned LoRA adapter → merged model → HF safetensors
5. Compile with MLC-LLM on Midnight (1–4 hours, 4080 SUPER + 128 GB RAM)
   OR export to GGUF and host for wllama
6. Upload to Cloudflare R2 (10 Gbps NIC makes this fast)
7. Add model entry to DIAMOND_MODELS_DEFAULT in diamondSwarm.js
8. Gate behind "High-performance analysis" toggle (requires WebGPU + 8 GB+ VRAM)
```

---

## Part 4 — Action Items

### Immediate (no compilation, low risk)

| # | Action | Impact |
|---|---|---|
| 1 | Add **wllama v3.4.1** as a second inference backend | Unlocks iOS + all-GGUF-compatible devices; fixes 51% of users who can't use WebLLM |
| 2 | Point to `mlc-ai/gemma-3-12b-it-q4f16_1-MLC` via WebLLM custom model config | 12B model available today, no compilation needed |
| 3 | Set up **Cloudflare R2** bucket with CORS for model hosting | Required before any self-hosted model ships |

### On Midnight this week

| # | Action | Time |
|---|---|---|
| 4 | Recompile `DeepSeek-R1-Distill-Qwen-7B` with `context_window_size=8192` | ~2–4 hours |
| 5 | Test NuExtract-2.0-8B GGUF via wllama on a sample chunk | 1 hour |
| 6 | Generate synthetic VA extraction training dataset (2K examples via Claude API) | 2–4 hours |

### Medium-term (1–2 weeks)

| # | Action | Time |
|---|---|---|
| 7 | QLoRA fine-tune NuExtract-2.0-8B on VA extraction data (Unsloth on Midnight) | 1–2 days |
| 8 | MLC compile fine-tuned model, host on Cloudflare R2 | 1 day |
| 9 | A/B test fine-tuned model vs Qwen2.5-3B on real extraction quality | ongoing |

### Product (based on analytics)

| # | Action | Rationale |
|---|---|---|
| 10 | Prioritize **Facebook sharing flow** (share button, OG meta tags, group-post templates) | 8.3% of traffic, #2 channel |
| 11 | Ensure every feature is **fully functional on iPhone Safari** | 51.7% of users |
| 12 | Add **Spanish-language support** for at least key UI strings | 7 Spanish visits already; Latino veteran population is large |
| 13 | Consider a **DoD/active-duty CTA** — 6 DoD Teams visits means word is spreading on base | |

---

## Midnight System Specs (reference)

| Component | Spec |
|---|---|
| CPU | AMD Ryzen 9 7950X3D — 16c/32t, 4.2 GHz, **128 MB 3D V-Cache** |
| RAM | **128 GB DDR5-4800** (4× Corsair 32 GB) |
| GPU 1 | RTX 4080 SUPER 16 GB — Ada (SM 8.9), primary display/WebGPU target |
| GPU 2 | RTX 4070 Ti SUPER 16 GB — Ada, free for training |
| GPU 3 | RTX 5060 Ti 16 GB — Blackwell (SM 12.0), eGPU via USB4 |
| GPU 4 | RTX 4060 Ti 8 GB — Ada, available |
| Total VRAM | **~56 GB** |
| Storage | ~10 TB NVMe (4 TB + 2 TB + 4 TB SSDs) |
| Network | **10 Gbps Ethernet** (Marvell AQtion) + Tailscale |
| OS | Windows 11 Pro + WSL2 |
| Motherboard | ASUS ProArt X670E-CREATOR WIFI (AM5/X670E) |
