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

## 7. Repetition loops on the 2B: frequency penalty

On the final build the 2B ran 5 of 38 answers (a04, a06, a18, and the drafts of a12 and a13) in a loop to the output limit, about 30 seconds each, and the answers were trimmed afterwards. The 4B had none. A frequency penalty of 0.3 was tried to stop this, then graded against 0.15 and 0.

Six graded runs of Qwen3.5-2B at temperature 0.3, two per setting (transcripts in `llm-compiler/logs/golden-set-results/`: run_2026-10-06_012539, 013549, 014319, 015232, 021103, 022302). Each cell gives the two runs.

| Setting | Passing of 30 | Cases with wrong legal statements shown | Invented form numbers | Trimmed loops that help nobody | Length stops |
| ------- | ------------- | --------------------------------------- | --------------------- | ------------------------------ | ------------ |
| 0       | 24, 24        | 4, 2                                    | 0, 0                  | 2, 3                           | 6, 7         |
| 0.15    | 23, 21        | 5, 5                                    | 0, 1                  | 0, 0                           | 1, 3         |
| 0.3     | 22, 21        | 7, 6                                    | 1, 1                  | 0, 0                           | 1, 1         |

**Decision: the 2B's production frequency penalty is 0.** Wrong legal statements and invented form numbers rise with the penalty at each step while pass counts fall. The cost of 0 is two or three answers per run that loop, are cut, and are shown with a note saying the answer started repeating and suggesting a rephrase. A dead answer that is labelled is a safer failure than confident wrong content. At penalty 0 and temperature 0.3 the 2B scored 24 and 24 of 30.

**Dissent:** the grader recommended 0.15, with low to moderate confidence, because verdicts at 0 and 0.15 were indistinguishable and 0.15 removes the dead answers.

Limits: two runs per setting; one desktop GPU; model-graded, advisory scores. The writing-tool cases were not part of the comparison: they always sent the per-model production value because the override did not reach them. That is fixed (the runner now sets an evaluation-only override for every request, so `--frequency-penalty` reaches the tool cases and they send the production value, 0, otherwise). The evaluation ran at temperature 0.3, which matches the general assistant (0.3) and the writing tools' rewording step (0.3); the other call sites use 0.1 to 0.7.

The open-advice routes remained unsafe at every setting: one case failed in all six runs. This bears on the open owner decision in §8 about limiting those routes on small models.

What stays: `getModelFrequencyPenalty` and the per-model table (no row sets a penalty now), the runner's `--frequency-penalty` override and the recording of the penalty sent, and the "started repeating" note, which matters more at 0. Structured (JSON) requests keep their existing 1.15.

## 8. Laptop model on the final build, the small-model caveat, and open owner decisions

The laptop model was graded on the final build: Qwen3.5-2B 22 of 30, against 6 of 30 for the Qwen2.5-1.5B it replaces, with invented case facts down from 14 cases to 2. QA recommends the replacement "because it does far less damage, not because it helps more", with conditions.

What this change does: devices whose loaded model is 2B or smaller (the `smallModel` rows of the per-model table in `deviceCapabilityDetector.js`) show a plain, always-visible note on the result views of the Decision Decoder, Pathfinder, Red Team and the general assistant: this device runs a smaller AI model; check every statement against your own documents, and confirm filing steps with an accredited VSO or on VA.gov before acting. No tool is disabled. The PACT Act Navigator is rule-based and makes no model call, so it has no note. The note shows only while a small-class model is the one loaded and answering (swarm ready and effective, loaded model in the small class); with cloud AI answering, or no AI, it does not show.

Open owner decisions and conditions, not decided here:

1. QA's stricter recommendation: turn the Decision Decoder off on the 2B until its document case repeats clean (on the 2B it misread the fictional test letter and said no money for a condition the letter granted), and turn the free-text tools (War Room, PACT Navigator, Pathfinder, the general assistant) off, or show them with corrections firing; their long answers were usually wrong. Removing a tool from laptops is the owner's decision.
2. A real laptop run before release: nothing has been measured on a laptop or tablet.
3. The comparison model (Qwen2.5-1.5B) was never run on the final build, so the 6 of 30 and 14-case figures come from an earlier build.

## 9. Decision Decoder does not use a small-class model

**Date:** 2026-10-06. **Status:** Accepted, reversible.

Evidence: QA graded the fictional mixed-decision letter (golden-set case t08) on six laptop-model (Qwen3.5-2B) runs and failed all six. In the two closing runs (`run_2026-10-06_032917` and `run_2026-10-06_034657`) the model listed the denial under favourable findings in both, said a current diagnosis was missing where the letter gives one, said the knee pain "happened after your service" where the letter records the visit in service, and gave the Board appeal form for a Supplemental Claim. The same limits as section 2 apply: one desktop GPU, one fictional letter, advisory grades, nothing measured on a laptop.

Why a guard is not the answer: the app's corrections quote a regulation against a sentence that contradicts it. A misread letter contradicts the letter, not a regulation, and the app has no second reading of the letter to check against. The one check of that kind that exists (`decoderLetterCheck.js`) covers a single pattern.

Decision: while a small-class on-device model is the one that would answer, the Decision Decoder does not send it the letter. It shows the existing pattern-match reading, the review options built from 38 CFR 3.2500, 3.2601, 20.202 and 20.203, and a plain notice: this device's AI model is too small to read a decision letter reliably, so it was not used. "Small-class" is the same test the small-model note uses (`smallModelAnswering` in `src/components/SmallModelCaveat.jsx`: the swarm is ready and effective and the loaded model has `smallModel: true` in the per-model table); no model id is named in the decoder. The larger on-device model and every other path (no AI, off-device AI blocked under ADR-009) are unchanged. The small-model caveat is not shown on this path because no model answered.

Reversal: the decision is one condition in `useDecisionDecode` (`src/components/DecisionDecoder.jsx`), `if (smallModelAnswering(getAIStatus()))`. Removing it restores the model path. Reverse it when the 2B, or its successor, reads the test letter correctly in repeated runs, including on a real laptop.

Consequences: on those devices the decoder gives a keyword reading, which finds less than a correct model reading would and cannot quote the letter's reasons. The golden-set runner calls `decodeDecision` directly, so its t08 line still records what the 2B writes, not what the app shows on such a device.

This closes the Decision Decoder half of open decision 1 in section 8. The free-text tools on the small model remain an owner decision.
