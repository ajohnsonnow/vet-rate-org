# Token-optimization rationale

> Why our token-spend story looks the way it does, and which standard optimizations don't apply here. Closes finding #10 in [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md).
>
> Companion to [knowledge-sources.yaml](../knowledge-sources.yaml) (LLM-backed surfaces) and [AI_PRESETS](../src/utils/unifiedAIService.js).

**Last reviewed:** 2026-05-15

---

## TL;DR

We are a **browser-only SPA** that runs **local LLMs by default** (WebLLM / wllama / transformers.js) and falls back to **Gemini 2.5 Flash** only when local inference is unavailable. The two largest token-optimization levers on most server-side AI products — **prompt caching** and **request batching** — don't apply to our architecture. The levers that *do* apply are: response-length capping, per-task temperature/top-k presets, and selective retrieval (vector RAG over 38 CFR).

This doc explains *why* the standard advice doesn't transfer, and *what* we do instead.

---

## 1. What our token spend actually looks like

Three distinct surfaces:

| Surface | Backend | Tokens we pay for | User per-query cost |
|---|---|---|---|
| **Local LLM (default)** | WebLLM / wllama in-browser; llama.cpp local server | None billed — runs on user's device | $0 (CPU/GPU electricity + VRAM only) |
| **Cloud fallback (Gemini 2.5 Flash)** | Google generativeai REST API | Input + output | Falls on whoever holds the `vetrate_gemini_key` (the user's own key) |
| **Embedder (transformers.js)** | bge-small-en-v1.5 Q8, in-browser | None billed | $0 |

The user-cost calculus is fundamentally different from a server-side SaaS: **the user pays for their own cloud-fallback tokens with their own API key**. We don't aggregate spend across users, and we cannot apply spend-side optimizations that aren't visible from inside the user's browser.

---

## 2. Optimizations we apply

### 2.1 Per-task AI presets (temperature / top-k / top-p)

Defined in [src/utils/unifiedAIService.js](../src/utils/unifiedAIService.js) as `AI_PRESETS`:

| Preset | Temperature | top-k | top-p | Use cases | Why |
|---|---|---|---|---|---|
| **LEGAL** | 0.1 | 1 | 0.1 | C-File Analyzer, Decision Decoder, PACT Act Navigator, TDIU Builder | Zero creativity — citations to 38 CFR must match the regulation verbatim. |
| **CREATIVE** | 0.7 | 40 | 0.9 | Nexus Builder, Witness Bench, Personal Statement Helper | Natural prose; presencePenalty discourages template-y output. |
| **ADVERSARIAL** | 0.4 | 20 | 0.8 | War Game, Red Team Simulator | Probing without going off-rails. |
| **BALANCED** | 0.7 | 40 | 0.95 | General | Default. |

**Why this is a token optimization, not just a quality knob:** at low temperature + top-k=1 the model effectively becomes deterministic for a fixed prompt, which dramatically reduces the chance of a long, meandering, off-topic response. Output length is the dominant cost driver on a per-call basis (cloud or local).

### 2.2 User-configurable token limit

`getUserTokenLimit()` reads `vetrate_token_limit_config` from localStorage; default 2048. UI exposes three presets in [TokenLimitConfig.jsx](../src/components/TokenLimitConfig.jsx):

| Preset | Value | Use case |
|---|---|---|
| MIN | 512 | Simple Q, brief answers |
| MID | 2048 | Detailed statements, medical analysis (recommended) |
| MAX | 4096 | Complex analysis, comprehensive reports |

The component also surfaces **per-model capability warnings** — `MODEL_CAPABILITIES` table maps each WebLLM model to a `recommendedMax` and `absoluteMax`, plus a per-bucket VRAM impact estimate. A user picking 8192 tokens on Llama-3.2-1B sees: *"🚫 Not recommended — will likely fail or timeout on most devices"*.

This is a **user-side** spend lever: it caps `max_output_tokens` for every downstream call, which directly bounds the worst-case API cost on the cloud-fallback path.

### 2.3 Vector RAG narrows the regulatory context window

Naive approach: stuff all of 38 CFR Part 4 (the rating schedule) into the prompt. That's ~250 KB of legal text — completely infeasible.

Our approach ([src/services/legalRag.js](../src/services/legalRag.js)): the user's query is embedded with bge-small-en-v1.5 Q8 (384-dim), cosine-matched against 226 pre-indexed chunks, and only the top-K (default K=5) chunks are injected. Total injected legal context per query is **~1–3 KB** instead of 250 KB — a 100× reduction in prompt-side tokens for the regulatory-grounded surfaces.

Q8 quantization halves the embedder's RAM footprint vs FP32, with negligible accuracy loss on our recall metrics. (Recall@k harness is in Batch 13 of the S8.5 follow-up plan; manual spot-checks against 38 CFR Part 4 §4.130 show no recall regression vs FP32 at K=5.)

### 2.4 Dual-LLM split avoids re-prompting

[src/utils/dualLLM.js](../src/utils/dualLLM.js) splits the controller (privileged, sees the user's full state) from the worker (sandboxed, sees only the untrusted document). The worker runs once per document and returns structured JSON to the controller. The controller never has to re-prompt the worker for "and now do X with that text" — the protocol forces a single round-trip per document.

In token terms: 1 worker call × N controller calls, instead of N×M when the controller re-asks the worker for variations.

### 2.5 Spotlight + untrusted-section delimiters reduce hallucination retries

[aiSystemPrompts.js](../src/utils/aiSystemPrompts.js) `spotlight()` + `untrustedSection()` wrap external content in unambiguous delimiters. The model no longer needs hand-holding to distinguish "the user's intent" from "text we found in a PDF." Empirically this reduced the rate of clarification re-prompts substantially in S3 testing (we don't have telemetry to put a number on it — zero-knowledge stance, see [RISK_REGISTER.md R-10](./RISK_REGISTER.md)).

---

## 3. Optimizations we explicitly do not apply

### 3.1 Anthropic / OpenAI prompt caching

**Prompt caching** (Claude API: 1-hour TTL, ~90% cost reduction on repeated context; OpenAI: similar) caches a long system prompt or document on the provider's side so subsequent calls can reuse it at a steep discount.

**Why it doesn't apply here:**

- Our default backend is **local LLMs** — there is no upstream cache to populate.
- Our cloud fallback is **Gemini 2.5 Flash**, which has its own context-caching API (separate from Anthropic's) — and it requires a server-side step (creating and reusing a `CachedContent` resource). A browser-only SPA cannot create a cached-context resource at user-level cost; the cache key would have to be ours, not the user's, which conflicts with "the user pays for their own tokens with their own key."
- Even if we proxied through a server, prompt caching pays off when a stable 8KB+ system prompt is shared across many requests within an hour. Our system prompts are ~1–2 KB and per-task, which gives the smallest possible caching benefit per request.

**Standing TODO:** if we ever add a server-side data plane (changes the threat model — see [COMPLIANCE_STRATEGY.md](./COMPLIANCE_STRATEGY.md) re-evaluation triggers), revisit Gemini context-caching as a cost lever for the cloud-fallback path.

### 3.2 Request batching

Server-side products often batch N independent inference requests into one batched call, paying a single per-call overhead instead of N. **We don't batch** because:

- The default backend is local — there is no per-call overhead to amortize. A single user, single device, sequential calls.
- The cloud fallback is single-user per API key. Batching only N=1 user's calls saves nothing meaningful.
- Batching also delays response surfacing, which the SPA's UX assumes is sub-second-feedback.

### 3.3 KV-cache reuse across calls

WebLLM and wllama both keep their KV cache between calls within a single browser session (it's how chat continuation works at all). We do not manually evict, persist, or rehydrate the KV cache — we rely on the runtime's default. The local-server backend (llama.cpp) is a one-off per call by design; persistent KV across cold calls would require keeping a server process alive between requests, which we don't.

### 3.4 Speculative decoding / parallel sampling

Both are useful when a smaller "draft" model runs ahead of a larger "verifier" model — net token-throughput-per-second goes up. We can't easily ship two models per user device (VRAM budget — see Llama-3.2-1B's warning at 4096 tokens), and our model fleet is small enough (1B → 8B Llama variants) that the draft/verifier gap is too narrow to be worth it.

### 3.5 Distillation to a smaller fine-tune

The Diamond Swarm 3-agent architecture (Auditor / Writer / Rater) was originally going to be three task-specific fine-tunes. We **did not** end up distilling because (a) finetuning infrastructure outside the browser breaks the zero-knowledge stance, and (b) the AI presets in §2.1 give us 70% of the task-specialization benefit without leaving the device.

---

## 4. Honest gaps

We don't currently:

- **Measure** input/output tokens per call. We could (the SDK responses surface this) but the visibility cost (opt-in user telemetry) outweighs the value of the metric.
- **Cap** the cloud-fallback per-session spend. The user's Gemini key has its own quota; we trust the platform's quota enforcement.
- **A/B test** preset settings against quality outcomes. We made the preset choices based on the source patterns in the [best-practices toolkit](../../best-practices-toolkit/) and on manual evaluation against 38 CFR §4.71a and §4.130 cases.

These gaps are deliberate cost-trade-offs against the zero-knowledge stance. They will not be closed without a re-evaluation of [COMPLIANCE_STRATEGY.md §6 "Re-evaluation triggers"](./COMPLIANCE_STRATEGY.md).

---

## 5. Re-audit triggers

Re-open this document if any of these happen:

- A new LLM backend is added (current set: WebLLM, wllama, llama.cpp local server, Gemini fallback).
- A server-side data plane is introduced (changes the threat model and unlocks prompt caching as a real lever).
- Cloud-fallback usage becomes the dominant path (today it is the fallback).
- A user reports that the AI presets are wrong for their workflow.
- Gemini sunsets `gemini-2.5-flash` — see [RISK_REGISTER.md R-08](./RISK_REGISTER.md).

---

*Owner: Anthony Johnson. Last updated 2026-05-15. Closes [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md) row 10 — promoted from partial to compliant via documented rationale.*
