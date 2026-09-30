# ADR-009: raw documents stay on the device - a fail-closed provider-routing boundary

**Status:** Accepted.
**Date:** 2026-09-29/30.
**Decided under:** owner decision E, 2026-09-29 ("RAW DOCUMENTS STAY ON THE DEVICE").
**Amends:** ADR-008 §4's first open issue (BlueButtonXRay/cfileAnalyzer/MyPacket's pasted-DD214 first-mention identifier gap) - see §5 below. Does not change ADR-008's own redaction mechanism (`_redactPiecesForSend`/`redactKnownValues`), which still runs on every `"context"`-classed call, on every backend.

## 1. Context

ADR-008 closed the identifier-leak gap for veteran data the app already knows (§2.4.1's provider boundary, `_redactPiecesForSend`). Its own §4 flagged what known-value redaction structurally cannot do: protect an identifier a document mentions for the _first time_ - before the app has ever seen it, and therefore has nothing to compare it against. `BlueButtonXRay.jsx`'s health-record chunking, `cfileAnalyzer.js`'s C-File OCR/page analysis, and `MyPacket.jsx`'s pasted-DD-214 extraction all sent a just-uploaded document's own raw text to `generateAI` for content analysis, on whichever backend (cloud or on-device) the veteran had configured. A veteran using only Cloud AI had every uploaded document - DD-214, C-File, Blue Button export, VA decision letter - sent off-device on first mention, identifiers included, with no redaction possible.

Decision E closes this a different way than more redaction: instead of trying to detect and strip an unknown identifier from free-form document text (unbounded, layout-dependent, never fully solvable - ADR-008 §4's own conclusion), raw document text is now categorically barred from ever reaching an off-device provider at all. The provider boundary in `unifiedAIService.js` enforces this for every backend, not per-tool discipline.

## 2. Decision

Every call into the provider boundary (`generateAI`/`generateAIWithImage` in `src/utils/unifiedAIService.js`) declares a **data class**:

- **`"document"`** - text derived from a document: an uploaded/dropped file, OCR output, a C-File page/segment, a DD-214/NGB-22, a VA decision letter, a Blue Button export, or letter/decision text the veteran pastes in. May reach an on-device engine only.
- **`"context"`** - the ADR-008 allow-listed structured veteran context (already identifier-redacted) plus the veteran's own typed question/statement. May reach any configured backend, on-device or off-device.

A call that omits `dataClass`, or supplies anything other than the exact string literal `"context"`, is treated as `"document"` - **fail closed, not fail open**. This is enforced in `src/utils/aiDataClassPolicy.js`'s `resolveDataClass`.

### 2.1 On-device definition

"On-device" means:

- The two in-browser engines - Warrant Council/WebLLM (`AI_MODES.SWARM`) and Wllama/WASM (`AI_MODES.WLLAMA`) - unconditionally (nothing they run ever leaves the process).
- Legacy local (`AI_MODES.LOCAL`) - unconditionally, same reasoning.
- A local llama.cpp server (`AI_MODES.LOCAL_SERVER`) - **only** when its _currently configured_ host resolves to loopback: `localhost`, the `127.0.0.0/8` IPv4 range, or `::1` (bracketed or bare). Everything else - `AI_MODES.CLOUD` (Gemini), and a `LOCAL_SERVER` pointed at any non-loopback host - is off-device.

`aiDataClassPolicy.js`'s `isLoopbackHost(hostOrUrl)` implements this by parsing the value as a real URL/hostname (`new URL(...)`), never by substring/prefix/suffix matching. This specifically rejects the lookalikes a naive check would accept:

- `localhost.evil.com` (a subdomain of an attacker's own domain, not `localhost` itself)
- `127.0.0.1.nip.io` (a wildcard-DNS service that resolves to `127.0.0.1` but is a five-label hostname, not a loopback address)
- `evil-localhost` / `notlocalhost` (substring hits with no host-boundary)
- Non-loopback private ranges (`192.168.x.x`, `10.x.x.x`) and non-loopback IPv6 (`fe80::1`)

The local-server check re-reads `localServerClient.getServerConfig().host` **live, on every call** - never a cached flag - since the veteran can repoint it to a different host at any time.

### 2.2 The fail-closed enforcement points

1. **Primary gate** (`generateAIInternal`, before any prompt assembly, DKB lookup, or ADR-008 redaction work runs): a `"document"`-classed call is refused immediately if no on-device engine is currently ready, via a typed `DocumentOffDeviceBlockedError` (`aiDataClassPolicy.js`). This is the fast, no-network path most callers hit.
2. **Per-backend defense in depth**: `generateWithCloudAI` and `generateWithLocalServer` each independently call `assertDocumentCallAllowed` before doing anything else (before scrubbing, serializing, or sending). This is the actual choke point every dispatch path - the primary attempt, the context-overflow fallback, and the general (mode-failed) fallback - converges on for these two backends, so none of them can reach an off-device transport by a different route. `generateWithWarrantCouncil`/`generateWithWllama`/`generateWithLocalAI` need no such check: they are unconditionally on-device.
3. **Fallback-chain gating**: `_handleContextOverflowFallback` never auto-escalates a `"document"` call to Cloud on a context-window overflow (previously the large-document behavior for every class). `_handleGeneralFallback` never retries a `"document"` call against an off-device fallback mode either - both return/rethrow the original error (already the typed `DocumentOffDeviceBlockedError` when that's what actually happened) rather than attempting an off-device backend and wrapping its own refusal into an opaque `"All AI modes failed"` message that would defeat the caller's `instanceof` check.

A `"context"`-classed call is never blocked by any of the above; it reaches whatever backend the veteran has configured, exactly as before this ADR, with ADR-008's redaction still applied.

### 2.3 The `onDevice` response contract

Every `generateAI` response - success, validation-failed, or a fallback result - carries `onDevice: true | false`, computed from the engine/host that actually generated the response (`_isModeOnDevice(usedMode)`; for `LOCAL_SERVER` this re-checks the live host, same as §2.1). Consumers must treat anything other than a strict `true` as off-device (fail closed) - this is the contract the parser-side work (DD214Analyzer's regex safety net) reads to decide whether it's safe to trust an on-device response for identifier fields.

### 2.4 UX: the fallback a document feature shows

`getDocumentAIRouting()` lets a document-classed feature check, before calling `generateAI`, whether an on-device engine is ready and what off-device provider would otherwise have been used (for the notice below). This is an optimization over catching the typed error (skips a doomed attempt's setup work); the typed error thrown inside `generateAI` itself remains the authoritative enforcement point - both read the same live state.

When no on-device engine is available, a document feature:

1. Runs its existing local parser/pattern-matcher (the same one already used when no AI at all is configured) and shows whatever it finds.
2. Shows a short, plain-language notice (`aiDataClassPolicy.buildDocumentOffDeviceNotice`): _"Your documents are only read by the on-device AI, so this file was not sent to \<provider\>. Showing what the app's built-in reader found."_
3. Never shows a dead end or a silent failure - the veteran always gets a result (even if the local parser finds nothing) and an accurate explanation.

When an on-device engine **is** available, the feature works exactly as before - the document is sent to the on-device engine and the AI-derived result is shown.

## 3. Identifier fields inside a document call

Decision E allows an on-device `"document"` call's prompt to request identifier fields again (name, DOB, SSN last 4, home of record, mailing address) - nothing leaves the device, so ADR-008's "no direct identifier in an AI context" rule doesn't apply to this specific, on-device-only case. **This ADR does not change DD214Analyzer.jsx's prompt schema or `_applyRegexSafetyNet`'s merge behavior** (still identifier-free, still local-regex-only per D15-1d) - that change is scoped to the parser track, which owns `_applyRegexSafetyNet` and will consume the `onDevice` contract from §2.3 when it lands. See openIssues.

An off-device prompt for a document never exists at all under this ADR - there is no code path where a `"document"`-classed call's prompt reaches an off-device backend, so the question of what that prompt may ask for is moot.

## 4. Inventory: every `generateAI`/`generateAIWithImage` call site in `src/`

A static source scan (`src/__tests__/aiCallSiteDataClass.sourceScan.test.js`) fails if any call site in `src/` omits a `dataClass:` key, so this table cannot silently drift from the code.

| Call site                                                                                    | Class                          | Why                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DD214Analyzer.jsx` `_runTextAnalysis`                                                       | document                       | pasted/OCR'd DD-214 text                                                                                                                                            |
| `MyPacket.jsx` `_processDD214Text`                                                           | document                       | pasted DD-214 text (My Packet's own paste path)                                                                                                                     |
| `BlueButtonXRay.jsx` `_attemptChunkExtraction`                                               | document                       | Blue Button health-record chunk text                                                                                                                                |
| `BlueButtonXRay.jsx` `analyzeWithAI`                                                         | document                       | Blue Button health-record text                                                                                                                                      |
| `cfileAnalyzer.js` `_requestChunkAnalysis`                                                   | document                       | C-File chunk text                                                                                                                                                   |
| `cfileAnalyzer.js` `_requestPageAnalysis`                                                    | document                       | C-File page text                                                                                                                                                    |
| `musterCallProcessor.js` `analyzeCFileWithAI` (via `buildSegmentedCFileResult`, import-time) | document                       | consolidated C-File excerpt                                                                                                                                         |
| `musterCallProcessor.js` `generateMusterCallReport`                                          | document                       | aggregated service/rating/medical document content                                                                                                                  |
| `aiStatementHelper.js` `decodeDecision`                                                      | document                       | Decision Decoder's pasted/OCR'd VA decision letter                                                                                                                  |
| `DenialDecoder.jsx` `analyzeWithAI`                                                          | document                       | Denial Decoder's pasted/OCR'd denial letter                                                                                                                         |
| `sharkRadar.js` `analyzeContract`                                                            | document                       | pasted contract/email text the veteran received                                                                                                                     |
| `pathfinderEngine.js` `analyzeStrategy`                                                      | document (fail-closed)         | `additionalContext` can carry OCR'd document text (Pathfinder.jsx's upload feature); treated conservatively since the call site can't distinguish                   |
| `dualLLM.js` `_extractFields` / `_synthesizeAnswer`                                          | document (fail-closed default) | shared factory with future document-analysis callers in its own design intent; a caller with a genuinely context-eligible payload overrides via `options.dataClass` |
| `AIConsistencyAnalyzer.jsx` `performConsistencyCheck` ("compare" mode)                       | document                       | pasted reference/evidence text                                                                                                                                      |
| `AIConsistencyAnalyzer.jsx` `performConsistencyCheck` ("solo" mode)                          | context                        | the veteran's own drafted statement only                                                                                                                            |
| `aiStatementHelper.js` `callGeminiAPI`                                                       | context                        | personal/buddy/PTSD/form-statement enhancement - the veteran's or witness's own typed interview answers                                                             |
| `aiStatementHelper.js` `generateFieldSuggestion`                                             | context                        | condition name + the veteran's own in-progress field text                                                                                                           |
| `aiStatementHelper.js` `searchVSOs`                                                          | context                        | a ZIP code only                                                                                                                                                     |
| `aiStatementHelper.js` `stressTestStatement`                                                 | context                        | the veteran's own draft statement                                                                                                                                   |
| `AIAssistant.jsx` `sendMessage`                                                              | context                        | the veteran's own question + allow-listed context                                                                                                                   |
| `AskTheRegs.jsx` `generateAIText` (dualLLM wrapper)                                          | context                        | public eCFR regulation text + the veteran's own question - explicitly overrides `dualLLM.js`'s document-by-default                                                  |
| `TheTribunal.jsx` (mock-hearing Q&A, session summary)                                        | context                        | the veteran's own typed answers + allow-listed VKB context                                                                                                          |
| `WitnessBench.jsx` (interview questions, statement compilation)                              | context                        | the witness's own typed interview answers                                                                                                                           |
| `RetroPayHunter.jsx`                                                                         | context                        | structured rating history + allow-listed veteran context                                                                                                            |
| `StateBenefitHunter.jsx` `fetchAIAdvice`                                                     | context                        | the veteran's question + state/rating selection                                                                                                                     |
| `StatementAnalyzer.jsx` `fetchToneSuggestions`                                               | context                        | the veteran's own statement draft                                                                                                                                   |
| `SymptomLogger.jsx` `_runAISuggestion`                                                       | context                        | the veteran's own symptom log entries                                                                                                                               |
| `TDIUBuilder.jsx`                                                                            | context                        | structured disability/symptom list + allow-listed context                                                                                                           |
| `VSOFinder.jsx` `useVSOAIConsultation`                                                       | context                        | the veteran's own question                                                                                                                                          |
| `LegislativeWatchdog.jsx` `runLegislativeAIAnalysis`                                         | context                        | a public Federal Register record this app fetched itself                                                                                                            |
| `nexusLogicGenerator.js`                                                                     | context                        | condition names only                                                                                                                                                |
| `useAIRiskAnalysis.js`                                                                       | context                        | structured rating/condition data + allow-listed context                                                                                                             |
| `redditSummarizer.js` `autoSummarizeIfLong`                                                  | context                        | summarizes a prior AI response, never a document                                                                                                                    |

Not in this table: DD214Analyzer's SmolVLM vision path (`_runVisionAnalysis`) calls `smolVLMService` (transformers.js, in-browser) directly - it never goes through `generateAI`/`unifiedAIService.js` at all, so it has no data class to declare and is unconditionally on-device by construction.

## 5. ADR-008 §4 cross-reference: first-mention limitation resolved for off-device providers

ADR-008 §4's first open issue is now resolved **for off-device providers specifically**: `BlueButtonXRay.jsx`, `cfileAnalyzer.js`, and `MyPacket.jsx`'s pasted-DD214 path are all `"document"`-classed under this ADR, so none of them can reach Cloud AI (or a non-loopback local server) regardless of whether an identifier inside the document has ever been seen before. The underlying redaction problem ADR-008 §4 described - detecting an unknown identifier in free text - is not solved (there is still no such detector), but it no longer matters for the off-device leak it was flagging, because the text carrying it never leaves the device. A shared-device risk (multiple veterans using the same on-device install) is a different, out-of-scope threat model, unaffected by this ADR either way.

## 6. Consequences

Positive:

- A veteran with only Cloud AI configured can no longer have a document's content - or a first-mention identifier inside it - sent off-device, regardless of which of the ~15 document-analysis call sites they use.
- Every document feature degrades to its existing local parser plus a plain-language notice instead of silently failing or leaking, when only an off-device AI is configured.
- The fail-closed default (`resolveDataClass`) means a _new_ call site added later without a `dataClass` declaration is safe by default (treated as document) - and the source-scan test makes forgetting the declaration entirely a build-time-visible failure rather than a silent gap.

Costs / visible behavior changes:

- A large document that overflows a small on-device model's context window (e.g. legacy Local's 4096-token limit) no longer auto-falls-back to Cloud, even if Cloud is configured - `_handleContextOverflowFallback` now returns null for `"document"` calls before ever considering it. The veteran sees the original overflow error (truncation guidance) rather than a cloud-assisted result. This is a deliberate consequence of the new boundary, not a defect - the alternative is exactly the leak this ADR closes.
- Pathfinder's strategy analysis (`pathfinderEngine.js`) is fail-closed to `"document"` unconditionally, even for a veteran who only ever types free-text symptoms and never uploads anything - because the call site cannot distinguish the two cases with the `additionalContext` field as currently structured. A veteran with only Cloud AI configured and no on-device engine loaded will see Pathfinder's typed-error message instead of a result, even with no document involved. Flagged in openIssues.

## 7. Verification

`src/utils/aiDataClassPolicy.test.js` (loopback host parsing including both adversarial lookalikes named in the brief, the fail-closed data-class default, the typed error and its `.code`/`.providerLabel`, and the notice builder), `src/utils/unifiedAIService.documentRouting.test.js` (the real `generateAI` against every backend in turn: Cloud and a non-loopback Local Server both refuse a document call and make zero network/`chatCompletion` calls even with no `dataClass` declared at all; a genuinely loopback Local Server, Warrant Council, and legacy Local all accept one and mark the response `onDevice: true`; a context call still reaches Cloud with `onDevice: false`; a general-fallback scenario where an on-device backend fails for a reason unrelated to routing never crosses to an off-device fallback), `src/__tests__/aiCallSiteDataClass.sourceScan.test.js` (every `generateAI(` call site in `src/` declares a `dataClass`, including self-checks on the scanner's own regex/paren-balancing/comment-skipping logic), and `src/components/DD214Analyzer.visionResponseContent.test.js` (the unrelated pre-existing vision-path bug fixed alongside this work - see §8).

End-to-end (`tests/e2e/adr009-document-routing.spec.ts`, `vite --mode e2e`'s fake on-device engine plus a `page.route()`-stubbed cloud endpoint, never a real provider): DD-214 Analyzer, Blue Button X-Ray, C-File Analyzer, Decision Decoder, and Muster Call's import-time C-File analysis each prove, in a real browser, that a cloud-only configuration never sends a fixture document's unique marker to the stubbed cloud (zero matching requests) while the local parser's result and the plain-language notice both show, and that an on-device configuration's fake engine actually receives the document and the feature completes. A shared test proves a genuinely context-classed call (the AI Assistant) still reaches the stubbed cloud with the veteran's own question. Muster Call's case drives `buildSegmentedCFileResult` directly (real module, real fake-engine/network harness) rather than through the full drag-and-drop classification UI - see the spec file's own header comment for why.

## 8. Open issues (not built in this pass, flagged for the owner)

- **DD214Analyzer's on-device prompt still excludes identifier fields.** Decision E permits requesting them again on an on-device call (§3), but `_applyRegexSafetyNet` (owned by the parser track, not touched here) still unconditionally overwrites any AI-supplied identifier field with the local regex parser's value regardless of `onDevice` - so adding identifiers back to the prompt today would be pure wasted work with zero observable effect until the parser track's merge logic becomes `onDevice`-aware. Do this together once that lands.
- **Pathfinder's fail-closed-to-document default blocks a text-only veteran.** See §6 - `pathfinderEngine.js` cannot currently distinguish "additionalContext is free-typed notes" from "additionalContext is OCR'd document text" at the call site. A real fix (e.g. a separate flag `Pathfinder.jsx` sets when `additionalContext` actually came from `analyzeDocument`) is a product/UX call, not made unilaterally here.
- **`dualLLM.js`'s document-by-default has exactly one live caller today** (`legalAnswerer.js`'s eCFR RAG path, via `AskTheRegs.jsx`'s override to `"context"`). Its conservative default is intentional (see its own header comment on future document-analysis use), but is untested against a _second_ real document-classed caller, since none exists yet.
- **The e2e suite's Muster Call coverage is boundary-level, not UI-level** (see §7) - a regression in `quickScanCFile`'s classification heuristic that stopped a genuine consolidated C-File from ever reaching `buildSegmentedCFileResult` in the first place would not be caught by this suite. That heuristic (and its 50-page/multi-type threshold) predates this ADR and is unrelated to data-class routing.
