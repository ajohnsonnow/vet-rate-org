# ADR-008: Data minimisation for AI - no direct veteran identifier ever enters an AI context

**Status:** Accepted.
**Date:** 2026-09-28.
**Decided under:** the owner's standing direction, "best practice for every decision; protect veteran data always" (decision D, final14 QA pass).
**Amends:** ADR-002 (generateLLMContext remains the one flattener for shape 2, but its output is no longer identity-bearing), ADR-007 §7 (`serviceEntryConsistency.integration.test.jsx`'s AI-context assertions still hold; they never asserted on personal identifiers).

## 1. Context

`veteranKnowledgeBase.js`'s `buildPersonalContext` printed the veteran's full name, date of birth, SSN (even truncated to last 4), and home address directly into `generateLLMContext`'s output - the string every AI-powered tool in the app injects into its system prompt via `getVeteranAIContext`. `myPacketManager.js`'s `_formatServiceRecordBasics` separately printed a DD-214/NGB-22's own extracted `fullName`. Both `_formatServiceRecordDoc`/`_formatOtherDocsSection` (My Packet's document summaries) and `veteranKnowledgeBase.js`'s evidence-timeline/key-facts sections embedded the veteran's own uploaded document **filenames** verbatim - a real VA-exported document commonly carries the veteran's surname/first name and the last four of their VA file number in the filename itself, independent of anything inside the document. `buildClaimsHistoryContext` printed a claim's `claimNumber` directly, producing the literal string `"Claim #null"` whenever a denial had none (D14-2). None of this was caught by `piiScrubber.js`'s existing pattern-based scrubber, because a bare name, an ISO-format date of birth, a claim number, or a non-standard address line have no detectable regex shape - only a known **value**, which a general-purpose pattern scanner can never carry.

Separately, a handful of AI-assisted statement features (Witness Bench's buddy/lay statement, and the same buddy-statement path through `enhanceFormStatement`) already instructed the model to write a placeholder - `"[Veteran]"` - instead of the veteran's real name in its output, but nothing ever substituted the real name back in afterward; the veteran-visible statement showed the literal placeholder text.

## 2. Decision

No AI context, system prompt, or AI request payload may contain the veteran's direct identifiers: full or partial name, date of birth, SSN or any part of it, home address, phone, email, VA file number, claim numbers, service number, or a document file name that carries any of these - regardless of AI provider (on-device or cloud). If a consumer genuinely needs age, it gets a whole-year age computed from date of birth, never the DOB itself (no current consumer does, so none was added). Where a feature must produce text containing the veteran's name, the model writes a placeholder (`[Veteran]` / `[Veteran Name]`, the app's existing convention) and the app substitutes the real value locally, after the response - the model never sees it.

### 2.1 What is sent

- Service history facts (branch, component, dates with their derived/corrected provenance, rank, MOS, awards, deployments, combat status), medical conditions, medications, exposures, claims/ratings (labelled by condition/claim type and decision date, never a claim number), evidence-timeline facts (labelled by document TYPE and date, never a filename), and document-derived free text (evidenceNeeded, diagnosis, rationale, opinion, provider, examiner) after known-value redaction.
- Examiner/provider names are kept - they are not the veteran's own identifier, and redacting them would remove real medical content a claims tool needs (e.g. "Dr. Example Physician" in a C&P exam summary).

### 2.2 What is never sent

- The veteran's full or partial name, DOB, SSN (any part, including a last-4 form), home address, phone, email, VA file number, claim numbers, or a document filename that carries any of the above.

### 2.3 The placeholder pattern

A feature that must write the veteran's name into generated prose (a buddy/lay statement, written from a witness's perspective) instructs the model to emit `[Veteran]` (or the equivalent `[Veteran Name]` wording already used elsewhere in this codebase) instead of a real name. After the response returns, `aiStatementHelper.js`'s `substituteVeteranNamePlaceholder(text, veteranName)` swaps the placeholder for the veteran's real name (looked up locally from the VKB, never sent to the model) before the statement is shown to the veteran or saved to My Packet. A missing/unknown name leaves the placeholder untouched rather than fabricating one. Wired at both places a buddy statement's AI response reaches the veteran: `WitnessBench.jsx`'s own `compileStatementWithAI`/`compileStatementWithoutAI` path, and `FormsHelper.jsx`'s `handleAIConsent` (the `enhanceFormStatement("buddy-statement", …)` path).

### 2.4 The single enforcement point

`piiScrubber.js` gains `redactKnownValues(text, knownValues)` (word-bounded, case-insensitive, exact-value redaction - the known-value counterpart to the existing pattern-based `scrubPII`), `collectKnownIdentifierValues(personal, claimNumbers)` (reads either VKB's `.personal` shape or the flat legacy profile shape), and `redactVeteranIdentifiers(text, personal, claimNumbers)` combining both. Every AI-context builder in this codebase applies it as the LAST step before returning:

- `veteranKnowledgeBase.js`'s `generateLLMContext` - final pass over the whole assembled string.
- `myPacketManager.js`'s `generatePacketContext` - self-applies, since it is called both directly and as half of `getVeteranAIContext`.
- `veteranContextProvider.js`'s `getVeteranAIContext` - a second pass at the outermost boundary over the already-redacted, concatenated VKB + packet context, so a future piece concatenated onto it without its own redaction still can't leak an identifier past this function.
- `aiSystemPrompts.js`'s `buildSystemPrompt` - final pass using the auto-loaded flat profile's identifiers; `buildSystemPromptWithDKB` inherits it (DKB/regulation content is never veteran-specific).
- `aiStatementHelper.js`'s `callGeminiAPI` - the one call site every statement-helper prompt funnels through, regardless of which builder constructed it.

A future AI-context builder that forgets to scrub its own free text still can't leak a direct identifier past whichever of these it returns through.

### 2.5 Free text and known-value redaction

`myPacketManager.js`'s `PACKET_CONTEXT_SAFE_FIELDS`/`FREE_TEXT_SAFE_FIELDS` allowlist (D13-4) already scrubs pattern-detectable PII (SSN/VA file number/phone/email/DOB/address) from evidenceNeeded/diagnosis/rationale/opinion/provider/examiner via `scrubText`. The known-value pass above is additional, not a replacement: it catches what pattern matching structurally cannot - a bare name, an ISO-format DOB, a claim/file number in unlabeled prose - by redacting the veteran's OWN identifier values, taken from their profile/VKB, from every string before it enters any AI context.

### 2.6 Document labels, not filenames

`myPacketManager.js`'s `_formatServiceRecordDoc`/`_formatCFileDoc`/`_formatOtherDocsSection` replace a document's raw `fileName` with a neutral structural label - document type + upload date + index (e.g. `"DD-214 (Service Record) 2026-02-01 (#1)"`) - in every AI context. The real filename is unchanged in the veteran-facing My Packet document list. `veteranKnowledgeBase.js`'s evidence-timeline/key-facts sections apply the same neutralisation to the `source` field, which is routinely a real uploaded filename used internally for provenance matching (`_upsertServiceEntryTimelineEvent`, `_projectTimeline`'s `knownSources`) - that internal value is unchanged; only the AI-context rendering neutralises it (`_looksLikeFileName` detects anything ending in a file extension; a safe label like `"DD-214"` or a tool name passes through unchanged).

### 2.7 Claim numbers

`buildClaimsHistoryContext` labels a claim by its condition(s)/claim type and decision (or filed) date - never a claim number, and never the literal string "null"/"undefined" for a missing one (D14-2).

## 3. Consequences

Positive:

- Every AI-powered tool that reads veteran context through `getVeteranAIContext`/`generateLLMContext`/`buildSystemPrompt` (the shared pipeline `WitnessBench.jsx`, `TheTribunal.jsx`, `TDIUBuilder.jsx`, `StatementAnalyzer.jsx`, `SymptomLogger.jsx`, `RetroPayHunter.jsx`, `DenialDecoder.jsx`, `AIConsistencyAnalyzer.jsx`, and `AIAssistant.jsx` all use) is protected by construction, not per-tool discipline.
- The VKB viewer's own "Show LLM Context" now shows exactly what a veteran's data minimisation guarantee promises - no direct identifier, ever.
- A buddy/lay statement's veteran-visible text now shows the veteran's real name instead of a literal `"[Veteran]"` placeholder, without the model ever having seen it.

Visible behavior changes:

- `generateLLMContext`'s output no longer has a "PERSONAL" section at all (no consumer needed age, so nothing replaced it - see §2 above).
- A service-record document's AI-context entry no longer has a "Name:" line.
- My Packet document summaries and the evidence timeline show a neutral label instead of the real filename, in AI context only - unchanged in the veteran-facing UI.
- Claims history entries read `"<condition>: <status> (decided <date>)"` instead of `"Claim #<number>: <status>"`.
- A buddy statement's AI-enhanced text shows the veteran's real name where it used to show `"[Veteran]"`.

Costs:

- Two more IndexedDB round-trips (`loadVKB`) per statement-helper AI call and per `getVeteranAIContext`/`generatePacketContext` invocation, to gather identifiers for the final redaction pass. Best-effort: an identifier-load failure never blocks the AI call itself, it just means nothing to redact against for that one call.
- `aiSystemPrompts.js`'s dead `myPacketData`/`MY_PACKET_CONTEXT_PROMPT` path (zero live callers, confirmed by grep, owner-approved for deletion) is removed along with its dead default export.

Risks:

- `redactKnownValues`' word-boundary matching can still redact a short name token that happens to be a real word in unrelated content (e.g. a veteran whose surname is a common English word) - accepted, consistent with decision D's "each name token of reasonable length, word-bounded" wording; a false positive here is a display nit, not a privacy failure.
- `_looksLikeFileName`'s extension heuristic assumes an uploaded document's filename ends in a recognizable extension; a filename with no extension at all would pass through unlabeled-as-a-filename. Every real upload path in this app (`saveDocumentToPacket`, `mergeDD214IntoVKB`, musterCallProcessor's parsers) always carries a real filename with an extension, so this is a theoretical, not observed, gap.

## 4. Open issues (not built in this pass, flagged for the owner)

- `aiStatementHelper.js`'s `enhanceAppealStatement` and `generateNexusLetterRequest` have zero live callers (confirmed by grep) - the same dead-code shape the owner explicitly authorized deleting for `MY_PACKET_CONTEXT_PROMPT`/`myPacketData`, but deleting them was not explicitly authorized for this pass, so they were left in place.
- `DD214Analyzer.jsx`/`BlueButtonXRay.jsx` send a just-uploaded document's own raw OCR text to `generateAI` for structured-data extraction - by design, since extracting a DD-214's fields requires showing the DD-214 to the model. This is a different category from the shared veteran-context pipeline this ADR closes (that pipeline injects STORED veteran data into an unrelated request; these tools' whole job is processing the freshly-uploaded document itself) and was out of this pass's file ownership. Flagged for a product decision on whether upload-time OCR content should also route through a known-value/pattern redaction pass before reaching the model.
- `NexusBuilder.jsx`'s personal-statement and PTSD-stressor prompts are first-person ("I…") and have no name placeholder to substitute - confirmed by reading `buildStatementPrompt`/`buildPTSDStressorPrompt`; no fix needed, noted so a future reviewer doesn't wonder why they were skipped.

## 5. Verification

`piiScrubber.knownValueRedaction.test.js` (unit tests for `redactKnownValues`/`collectKnownIdentifierValues`/`redactVeteranIdentifiers`), `veteranKnowledgeBase.aiContextObjectLeaks.test.js` (D14-2 claim-number/null rejection), `veteranContextProvider.piiRedaction.test.js` (a fixture veteran with a fake name/DOB/SSN/address/phone/email/VA file number/claim number, seeded into the VKB personal block, a claim, and a service-record document's fileName AND extractedData, rendered through the real, unmocked `generateLLMContext`/`getVeteranAIContext`/`generatePacketContext`/`buildSystemPrompt` at every budget from 100 to 1,000,000 tokens), and `aiStatementHelper.placeholderRoundTrip.test.js` (proves the AI provider call never receives the real name, and that the local substitution restores it for the veteran-visible result only).
