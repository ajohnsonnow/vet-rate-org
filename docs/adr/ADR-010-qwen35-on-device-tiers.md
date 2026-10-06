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

Decision: while a small-class on-device model is the one that would answer, the Decision Decoder does not send it the letter. It shows the existing pattern-match reading, the review options built from 38 CFR 3.2500, 3.2601, 20.202 and 20.203, and a plain notice: this device's AI model is too small to read a decision letter reliably, so it was not used. "Small-class" is the same test the small-model note uses (`smallModelAnswering` in `src/utils/smallModelAnswering.js`: the swarm is ready and effective and the loaded model has `smallModel: true` in the per-model table); no model id is named in the decoder. The larger on-device model and every other path (no AI, off-device AI blocked under ADR-009) are unchanged. The small-model caveat still shows above the result, as on every result view of this tool; the new notice under it says the model was not used.

Reversal: the decision is one condition, `smallModelAnswering(getAIStatus())` in `readingWithoutModel` (`src/utils/decisionDecodeAsShown.js`), which `useDecisionDecode` in `src/components/DecisionDecoder.jsx` calls. Making it return null restores the model path. Reverse it when the 2B, or its successor, reads the test letter correctly in repeated runs, including on a real laptop.

Consequences: on those devices the decoder gives a keyword reading, which finds less than a correct model reading would and cannot quote the letter's reasons. The golden-set runner calls `decodeDecisionAsShown`, the function built on the same condition, so on a small-class model its t08 line records the rule-based reading the app shows (`modelCalled: false`, no engine request), and on a larger model what the model writes. Runs recorded before 2026-10-06 called `decodeDecision` directly and show the 2B's own reading.

This closes the Decision Decoder half of open decision 1 in section 8. The free-text tools on the small model remain an owner decision.

## 10. The contradiction block runs only on answers an on-device model produced

**Date:** 2026-10-06. **Status:** Accepted, reversible.

Context: after an answer on an advice route, the app can put a block above it ("Vet-Rate check: part of the answer below may not match the regulation ...") when a sentence matches one of the contradiction rules in `src/utils/contradictionCheck.js`. The rules are sentence patterns. They were written from, and measured against, the recorded answers of the small on-device models.

Evidence:

- On recorded on-device text QA replayed every model-written answer in the 37 transcripts through the rules: 569 answers on an advice route, 85 blocks, none judged false.
- On adversarial text QA wrote 90 true sentences in the forms a careful explainer uses ("Myth: ...", "A common mistake is ...", "Some say ..., in fact ..."); 72 drew a block. QA's judgement is that the recorded 2B and 4B models do not write these forms and a larger or cloud model in the assistant chat is more likely to.
- There are no recorded cloud runs. Nothing is known about how the rules behave on cloud answers.

Limits of that evidence: one desktop GPU, the golden questions only, sentences judged by one reader, and the adversarial sentences are QA's own, not model output.

Decision: the contradiction block is added only when the result says an on-device model produced the answer (`onDevice === true` on the result of `generateAI`, tested by `contradictionRulesApply` in `src/utils/answerCheckRoutes.js`). A cloud answer, including the cloud fallback after a context overflow, gets no block. A result that does not say who answered gets none. The citation notice and the form notice still run on every advice-route answer, cloud or not: they look a number up in a bundled list and do not read the sentence.

Reversal: one function, `contradictionRulesApply`. Widen it when there are recorded cloud answers on the golden questions and the rules have been measured on them with no false block.

Consequences: a cloud answer that states wrong law is shown with no correction. That was already true of every route outside the advice list. A false correction above a true answer was judged the worse failure, because it tells a veteran to distrust something true.

### Limits of the contradiction block, as checked by QA on 2026-10-06

QA's third check passed the block for on-device answers with these limits. They are stated here so nobody reads the block as more than it is.

1. **It is a short list of known mistakes, not a check of the answer.** It looks for about twenty-five specific wrong statements, in the wording the small on-device models were recorded using. No block does not mean the answer is right. A wrong statement put in other words was missed almost every time in QA's tests (0 of 45 caught in the first review; 14 of 15 missed in the third).
2. **It can be wrong in both directions.** It can still mark a correct sentence, most likely one that names a wrong form or rule in order to warn against it without a word such as Myth, False or mistake, or a true sentence about an appeal that needs new evidence. The block says it can be wrong and tells the veteran not to act on the sentence until it is checked, which is the right instruction in both cases.
3. **A sentence is skipped when** it sits under a heading containing mistake, error, myth, pitfall or avoid (until a blank line or the next line ending in a colon); when the next sentence opens "Actually" or "In fact" or says "the correct ... is"; when it contains a word such as mistake, wrongly, typo, excludes, skips or unavailable; when it reads as someone else's words, as a dated history or as a request ("Please provide ..."); and, for the appeal rule, when it contains any word of time. A real error written in one of those forms is not caught.
4. **It runs only where the model ran on the device.** That includes a local server on the same machine with any model loaded, which may be larger than the models the rules were measured on. It does not run on cloud answers or on a server on another machine; those get only the citation and form notices.
5. **It runs only on prose shown as advice:** the assistant chat and Ask the Regs. It never runs on the statement tools or on text placed in a field, and it does nothing on screens that parse JSON (Denial Decoder, Red Team, Pathfinder).
6. **The evidence is narrow.** 575 recorded answers from 1.5B to 9B models, on the thirty golden questions, on one machine: 86 blocks, none judged false, three judged questionable (requests, since exempted). Real veterans' questions, and how those models answer them, are not in it.

## 11. Open-advice chat does not use a small-class model

**Date:** 2026-10-06. **Status:** Accepted, reversible. Decided by the owner.

Evidence: four graded runs of the laptop model (Qwen3.5-2B) on the thirty golden questions, temperature 0.3, frequency penalty 0, transcripts in `llm-compiler/logs/golden-set-results/` (`run_2026-10-06_032917`, `034657`, `045832`, `071544`; L1 to L4 in the graders' notes).

| Run | Passing of 30 | Of those, app text | Correct substantive answers the model wrote | Answers with invented or changed case facts | Answers with wrong law, uncorrected and material |
| --- | ------------- | ------------------ | ------------------------------------------- | ------------------------------------------- | ------------------------------------------------ |
| L1  | 23            | 6                  | 0                                           | 0                                           | 4                                                |
| L2  | 23            | 6                  | 2                                           | 2                                           | 6                                                |
| L3  | 24            | 7                  | 2                                           | 1                                           | 2                                                |
| L4  | 24            | 7                  | 2                                           | 2                                           | 3                                                |

Every run has at least two answers with invented facts or wrong law. Most of the passes are the app's own text, a request for input, or a refusal; the model wrote at most two correct substantive answers a run. Examples the graders recorded: an Iraq veteran told he must have served on or after August 10, 2022 to be covered by the PACT Act; a list of thirteen invented presumptive conditions for a Vietnam veteran; tinnitus said to need a 40 percent rating; "you must wait to receive the application form before filing". A correction block (section 10) stood above none of the wrong answers in L1 and L2, one in L3 and two in L4. Section 7 already recorded that these routes "remained unsafe at every setting".

Limits of that evidence: one desktop GPU, the golden questions only, one reader's advisory grades, one run per transcript, and nothing measured on a laptop or tablet.

Why a guard is not the answer: the corrections are a short list of known wrong sentences (section 10, limits 1 and 2). A wrong statement in other words passes, and an invented fact about the veteran's own case contradicts no regulation at all.

Decision: while a small-class on-device model is the one that would answer, the assistant chat does not send it an open question about VA law or claims. The test is the one sections 8 and 9 use, `smallModelAnswering` in `src/utils/smallModelAnswering.js`. What the veteran gets instead:

1. A rating question (combined rating, bilateral factor, TDIU percentage thresholds) is answered from the calculator, as on every device.
2. Any other question gets a fixed message (`OPEN_ADVICE_HELD_MESSAGE` in `src/utils/openAdviceHold.js`): that this device's model is too small to answer open questions reliably and was not used; what the device can still do (the calculator, the form and statement tools, the Decision Decoder's rule-based reading, searching the regulations); that a document goes to the document tools, named as the app names them; that an AI answer needs a device that can run the larger on-device model, or the cloud option if one is set up; and how to reach a Veterans Service Officer.
3. Nothing is shown under that message. An earlier version showed regulation text from a search of the bundled regulations under it; section 13 records why that was removed. The message points to Ask the Regs.
4. Ask the Regs does the same on such a device: it runs its search and shows the passages found with their citations, with a note that the model was not used, in place of a synthesised answer.

What does not change: the larger on-device model, cloud answers, the wllama and local-server paths, and every tool that is not open advice. The writing tools and the Decision Decoder keep their own small-model handling (section 9 and `aiStatementHelper.js`). The Pathfinder and Red Team screens still call the small model, with the caveat of section 8; they and the other free-text tools were not part of this decision.

Reversal: one condition, in `generateAIInternal` (`src/utils/unifiedAIService.js`): `if (options.openAdvice && smallModelAnswering(getAIStatus()))`. The assistant sets `openAdvice`. Ask the Regs has the matching condition in `handleAsk` (`src/components/AskTheRegs.jsx`). **Reverse it when a small-class model, on the golden questions, goes two consecutive graded runs with no answer that states wrong law or invents a fact, on a real laptop.** Nothing else reverses it.

Consequences: on those devices the assistant answers rating questions and nothing else, which is less than the model's best answers offered (up to two a run). In the evaluation, a run on a small-class model records the fixed message for every a-case with a question (`modelCalled: false`, `openAdviceHeld: true`), which is also exactly what the assistant shows.

This closes the general-assistant part of open decision 1 in section 8.

## 12. A fallback model is announced, and the Qwen2.5-3B is held back like the small models

**Date:** 2026-10-06. **Status:** Accepted, reversible.

When the first model in a tier's list fails to load (a browser cache error, GPU memory) and a later one loads, the swarm loads it without a word. The AI Command Center said "Your device will load Qwen 3.5 4B" while Qwen 2.5 3B was answering. Two changes:

1. **The fallback is announced.** `describeModelFallback` (`src/utils/modelFallback.js`) compares the model actually loaded (the swarm status) with the first model of the device profile's list. If they differ it returns the words shown by `FallbackModelNotice` in the AI Command Center: which model was meant, that it could not be loaded, which is loaded instead, and that the loaded one is an older model. The "weaker in our tests" clause is shown only for models marked `gradedWeaker` in the per-model table (the Qwen2.5 rows); any other fallback says it has not been tested.
2. **The Qwen2.5-3B is in the held-back class.** `isSmallModel` now returns true for both Qwen2.5-3B rows, so the small-model caveat (section 8), the Decision Decoder's rule-based path (section 9), the writing tools' rewording switch-off and the open-advice hold (section 11) all apply when it is the loaded model. Evidence: section 2's desktop run, 7 of 30 passing with invented case facts in 15 cases, worse on both counts than the Qwen3.5-2B that section 11 holds back. The flag name `smallModel` now means "held back from open advice", not "2B or under"; the Qwen2.5-1.5B (6 of 30, invented facts in 14 cases) was already in it. The Llama-3.2-3B is not graded and is not in the class.

Every one of those consumers reads the loaded model through `smallModelAnswering(getAIStatus())`, never the profile's first choice, so a fallback triggers them. `src/__tests__/utils/unifiedAIService.openAdviceHold.test.js` holds an open question when the 4B failed and the Qwen2.5-3B loaded; `src/utils/smallModelAnswering.test.js` covers the status cases.

Reversal: remove `smallModel: true` from the two Qwen2.5-3B rows in `MODEL_FOOTPRINT`.

## 13. Regulation passages are not shown under the held-question message

**Date:** 2026-10-06. **Status:** Accepted, reversible.

Under the fixed open-advice message (section 11) the assistant showed regulation text from a search of the bundled eCFR index. For a question about service connection for sleep apnea it showed 38 CFR 3.309 (tropical diseases), under a label that reads as official.

**What the search returns.** `retrieveRegulationText` calls `legalRag.query` (hybrid dense and BM25 ranking, then diversity re-ranking). Each passage carries `score`, the dense cosine similarity between the question and the passage. The search already used a threshold of 0.35, but hybrid ranking lets lexical matches in below it, and 0.35 passes nearly everything: the bge-small similarities of a question and a regulation fall between about 0.54 and 0.75 whether or not they are related.

**Measured.** The 29 golden `a` questions that have text (a22 is empty) and four sleep apnea questions (x1 to x4), run through the real search offline on 2026-10-06, top passage each. "On the question" is one reader's judgement of the section against the question. Data: `src/__tests__/utils/fixtures/regulationSearchRelevance.json`.

| Question | Score | Top passage                                       | On the question |
| -------- | ----- | ------------------------------------------------- | --------------- |
| a01      | 0.606 | § 3.203 Service records as evidence of service a  | yes             |
| a02      | 0.666 | § 3.304 Direct service connection; wartime and p  | yes             |
| a03      | 0.696 | § 3.159 Department of Veterans Affairs assistanc  | yes             |
| a04      | 0.605 | § 4.87 Schedule of ratings—ear.                   | yes             |
| a05      | 0.651 | § 20.1000 Rule 1000. Vacating a decision.         | no              |
| a06      | 0.586 | § 3.309 Disease subject to presumptive service c  | yes             |
| a07      | 0.572 | § 4.130 Schedule of ratings—Mental disorders.     | yes             |
| a08      | 0.621 | § 19.26 Action by agency of original jurisdictio  | no              |
| a09      | 0.647 | § 3.304 Direct service connection; wartime and p  | yes             |
| a10      | 0.617 | § 3.103 Procedural due process and other rights.  | no              |
| a11      | 0.641 | § 4.68 Amputation rule.                           | no              |
| a12      | 0.754 | § 4.26 Bilateral factor.                          | yes             |
| a13      | 0.630 | § 4.16 Total disability ratings for compensatio   | yes             |
| a14      | 0.605 | § 4.25 Combined ratings table.                    | yes             |
| a15      | 0.612 | § 3.105 Revision of decisions.                    | no              |
| a16      | 0.671 | § 3.13 Discharge to change status.                | no              |
| a17      | 0.648 | § 3.155 How to file a claim.                      | no              |
| a18      | 0.638 | § 3.103 Procedural due process and other rights.  | no              |
| a19      | 0.568 | § 4.47-4.54 §§ 4.47-4.54 [Reserved]               | no              |
| a20      | 0.620 | § 4.25 Combined ratings table.                    | yes             |
| a21      | 0.577 | § 3.213 Change of status affecting entitlement.   | no              |
| a23      | 0.575 | § 3.7 Individuals and groups considered to hav    | no              |
| a24      | 0.613 | § 4.28 Prestabilization rating from date of dis   | no              |
| a25      | 0.662 | § 4.16 Total disability ratings for compensatio   | yes             |
| a26      | 0.615 | § 3.1010 Substitution under 38 U.S.C. 5121A follo | no              |
| a27      | 0.702 | § 3.317 Compensation for certain disabilities oc  | yes             |
| a28      | 0.663 | § 20.1000 Rule 1000. Vacating a decision.         | no              |
| a29      | 0.563 | § 3.310 Disabilities that are proximately due to  | yes             |
| a30      | 0.601 | § 3.155 How to file a claim.                      | yes             |
| x1       | 0.625 | § 4.87a Schedule of ratings—other sense organs.   | no              |
| x2       | 0.540 | § 3.309 Disease subject to presumptive service c  | no              |
| x3       | 0.543 | § 4.97 Schedule of ratings—respiratory system.    | yes             |
| x4       | 0.570 | § 4.97 Schedule of ratings—respiratory system.    | yes             |

**Finding.** No score cutoff separates the passages that were on the question from those that were not. Passages not on the question score from 0.540 to 0.671; passages on it from 0.543 to 0.754. The lexical (BM25) score does not separate them either. A score is a weak guard here.

**Decision: no passages are shown under the held message.** A score floor of 0.58 was tried first (`PASSAGE_RELEVANCE_FLOOR`): it dropped 8 of the 33 top hits, 4 not on the question (a19, a reserved placeholder; a21; a23; x2, the sleep apnea passage that prompted this) and 4 that were (a07, a29, x3, x4), and a higher floor would lose most good passages while a05, a16 and a28 (above 0.65) stayed. 16 of the 33 top passages are not on the question and no score separates them, so regulation text under an official-looking message is not shown automatically. The floor, its "No closely matching regulation text" line and the assistant's search call were removed. The fixed message already points to Ask the Regs, where the veteran asks for a search and sees the results labelled as search results (section 14).

**Not solved.** A better signal (a cross-encoder, or a rule on whether the question's own terms appear in the passage title) would be needed to show passages unasked; neither was tried.

**What the search sends.** The question is scrubbed of identifiers (`scrubPII`), embedded in the page by the bge-small model (`@huggingface/transformers`, `pipeline("feature-extraction", "Xenova/bge-small-en-v1.5")`) and compared with the index vectors in the page. The page fetches only same-origin `/legal-index/...` files and, on first use, the model files from the Hugging Face hub (huggingface.co), a third-party host. The question is not in any request; `src/services/legalRag.privacy.test.js` records every fetch and the text the embedder receives. The search now runs only from Ask the Regs, where the first-use download is disclosed beside the results: "about 34 MB", the size of the quantized model file in the Hugging Face repository listing (`onnx/model_quantized.onnx`, 34,014,426 bytes). That the browser fetches that file, not the full-precision one (133 MB), follows the library's documented default for the WebAssembly backend and was not observed in a browser here.

Reversal: none needed; showing passages again would need a relevance signal that separates them, which this table says the score is not.
