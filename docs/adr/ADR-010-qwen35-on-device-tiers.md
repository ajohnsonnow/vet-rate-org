# ADR-010: adopt Qwen3.5 on the desktop and laptop on-device tiers

**Status:** Accepted.
**Date:** 2026-10-05.
**Decided under:** owner request to switch the on-device model from the Qwen2.5 family to Qwen3.5, keeping the current models as fallbacks.

## 1. Context

The app runs one WebLLM model in the browser, chosen per device tier in `src/utils/deviceCapabilityDetector.js` (`_configForTier`). `initializeSwarm` in `src/utils/diamondSwarm.js` tries `recommendedModels` in order; a model that fails to load moves to the next id (pinned by `src/utils/diamondSwarm.modelFallback.test.js`). Reasoning output is already switched off for ids matching `/^Qwen3/` and any reasoning block is stripped.

## 2. Evidence, and its limits

A graded evaluation on one desktop GPU, 30 cases, with model-graded scores that are advisory:

| Model                      | Passing (of 30)   | Invented case facts | Time per case |
| -------------------------- | ----------------- | ------------------- | ------------- |
| Qwen2.5-3B (desktop)       | 7                 | 15 cases            | about 56 s    |
| Qwen3.5-4B                 | 19 to 21 (5 runs) | 0                   | about 14 s    |
| Qwen2.5-1.5B (laptop)      | 6                 | 14 cases            | not recorded  |
| Qwen3.5-2B (earlier build) | 18                | 0                   | about 10 s    |
| Qwen3.5-9B                 | 18 to 20          | not recorded        | about 23 s    |

Limits: one desktop GPU; model-graded, advisory scores; run-to-run variation is large; nothing was measured on a laptop, tablet or phone; the 2B was graded on an earlier build and tends to ask for input rather than answer. This ADR makes no claim that the laptop tier works better, only that the 2B did well on the desktop test.

Memory figures (WebLLM prebuilt config, read 2026-10-05): Qwen3.5-4B-q4f16_1-MLC 3867.82 MB; Qwen3.5-2B-q4f16_1-MLC 2245.44 MB; for comparison Qwen2.5-3B-Instruct-q4f16_1-MLC 2504.76 MB and Qwen2.5-1.5B-Instruct-q4f16_1-MLC 1629.75 MB. The Qwen3.5 entries are not marked low-resource. The config states no download size; those come from the published file listings below.

## 3. Decision

| Tier         | Order after this change                                            | Context |
| ------------ | ------------------------------------------------------------------ | ------- |
| desktop-high | Qwen3.5-4B q4f16, then the three earlier models in their old order | 12288   |
| desktop-mid  | Qwen3.5-4B q4f16, then the three earlier models in their old order | 8192    |
| laptop       | Qwen3.5-2B q4f16, then the three earlier models in their old order | 8192    |
| tablet       | unchanged: Qwen2.5-1.5B q4f16, q4f32                               | 8192    |
| mobile       | unchanged: no on-device model                                      | n/a     |

- The laptop tier already lists a 2.5 GB model (Qwen2.5-3B) as its last try, so the 2B at 2.2 GB is inside what that list assumes; a failed load falls through to the old 1.5B.
- The tablet stays put: the 2B needs about 0.6 GB more than the 1.5B that tier plans for, and the tablet has no measurement.
- Context windows are unchanged; `promptBudget.js` sizes prompts to the loaded window.
- User-facing copy states the download size per model and that it is a one-time download kept on the device. "size varies" is shown only where the model is not known (before the device is probed).

Download sizes: sum of all file sizes in each Hugging Face repository `mlc-ai/<id>`, read 2026-10-05 through the Hugging Face API.

| Model id                          | Files | Size    | Shown as     |
| --------------------------------- | ----- | ------- | ------------ |
| Qwen3.5-4B-q4f16_1-MLC            | 86    | 2.39 GB | about 2.4 GB |
| Qwen3.5-2B-q4f16_1-MLC            | 39    | 1.08 GB | about 1.1 GB |
| Qwen2.5-3B-Instruct-q4f16_1-MLC   | 71    | 1.75 GB | about 1.8 GB |
| Qwen2.5-1.5B-Instruct-q4f16_1-MLC | 39    | 0.88 GB | about 0.9 GB |

The earlier "1.7 GB" label for the Qwen2.5-3B matched the published 1.75 GB; rounding to one decimal now shows it as 1.8 GB. The f32 and Llama entries keep their earlier estimates because no listing was read for them.

## 4. Alternatives rejected

- Fine-tuning a Qwen2.5 model: the stock Qwen3.5 models beat the current ones without it.
- Qwen3.5-9B: no better than the 4B in the evaluation and slower.
- Reasoning mode: timed out in the browser; stays off.
- Opening a phone tier: deferred. It cannot be tested here and the rating tools no longer need a model.

## 5. Consequences and rollback

First-load download is larger than before: about 2.4 GB against 1.8 GB on desktop, and about 1.1 GB against 0.9 GB on the laptop. Roll back by reordering the lists in `_configForTier` so the Qwen2.5 id comes first; the footprint table and labels need no change. The `describeDeviceModel` table keeps the Qwen2.5 entries.

## 6. Open items

Measure the 2B and 4B on a real laptop and tablet before trusting those tiers.
