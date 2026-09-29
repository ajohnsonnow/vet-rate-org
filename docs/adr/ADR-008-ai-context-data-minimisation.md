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

A feature that must write the veteran's name into generated prose (a buddy/lay statement, written from a witness's perspective) instructs the model to emit `[Veteran]`, `[Veteran Name]`, or the possessive `[Veteran's Name]` (all three wordings are matched) instead of a real name. After the response returns, `aiStatementHelper.js`'s `substituteVeteranNamePlaceholder(text, veteranName)` swaps the placeholder for the veteran's real name before the statement is shown to the veteran or saved to My Packet. A missing/unknown name leaves the placeholder untouched rather than fabricating one.

The real name comes from `aiStatementHelper.js`'s `resolveVeteranDisplayName()`, shared by both places a buddy statement's AI response reaches the veteran (`WitnessBench.jsx`'s `compileStatementWithAI`/`compileStatementWithoutAI` path and `FormsHelper.jsx`'s `handleAIConsent`). It checks the flat legacy profile's `firstName`/`lastName`/`suffix` FIRST, falling back to VKB's `personal.fullName` only if the profile has none - a DD-214 merge stores `personal.fullName` in the printed Box 1 "LAST, FIRST MIDDLE" order (comma-inverted, all caps), which reads unnaturally spliced into first-person prose, and is also the ONLY populated source for a veteran ingested through Muster Call (which never writes `vkb.personal` at all - see §2.4).

### 2.4 The enforcement points

`piiScrubber.js` gains `redactKnownValues(text, knownValues)` (Unicode-boundary-aware - `\p{L}`/`\p{N}` lookarounds, not JS's ASCII-only `\b` - case-insensitive, exact-value redaction with apostrophe/hyphen-variant matching for names and digit-grouping tolerance for numeric IDs; the known-value counterpart to the existing pattern-based `scrubPII`), `collectKnownIdentifierValues(personal, claimNumbers)` (reads VKB's `.personal` shape, the flat legacy profile shape, or - since callers now pass a merge of both, see below - either at once: `fullName`/`name` OR `firstName`+`lastName`+`suffix`, `ssn`/`ssnLast4` including a full SSN's own last-4, `veteranFileNumber`/`vaFileNumber`, `serviceNumber`, `email`/`phone`/`alternatePhone`/`intlPhone`, `address.{street,city,zip}`/`street`/`city`/`zip`/`mailingStreet`/`mailingCity`/`mailingZip`, and `dateOfBirth`/`dob` in ISO or US form, expanded into common alternate/military formats), and `redactVeteranIdentifiers(text, personal, claimNumbers)` combining both.

**The five builder-level passes** each apply it as the LAST step before returning, and each now merges `getVeteranProfile()` (the flat legacy profile) with VKB's `.personal` block before collecting identifiers - a Muster Call ingest never writes `vkb.personal` at all (the veteran's name/service number land ONLY on the legacy profile store; `applyServiceRecordToProfileUpdates` writes there, never to VKB), so a VKB-only identifier source left every Muster-Call-ingested veteran with zero redaction:

- `veteranKnowledgeBase.js`'s `generateLLMContext` - final pass over the whole assembled string.
- `myPacketManager.js`'s `generatePacketContext` - self-applies, since it is called both directly and as half of `getVeteranAIContext`; redaction now runs BEFORE the `maxChars` truncation, not after (truncating first could cut a name mid-token - "Faketo" surviving immediately before "[... TRUNCATED ...]" - so it no longer matched a whole known value).
- `veteranContextProvider.js`'s `getVeteranAIContext` - a second pass at the outermost boundary over the already-redacted, concatenated VKB + packet context.
- `aiSystemPrompts.js`'s `buildSystemPrompt` - final pass using the auto-loaded flat profile's identifiers (this builder has no VKB-sourced content to protect in the first place, so it only ever needed the legacy-profile source).
- `aiStatementHelper.js`'s `callGeminiAPI` - the one call site every prompt built ENTIRELY WITHIN `aiStatementHelper.js` funnels through. This is NOT the provider boundary - see §2.4.1.

#### 2.4.1 The real provider boundary: `unifiedAIService.js`

QA review (final14) found that the five passes above only cover the free text those SPECIFIC builders assemble. Any caller that builds its own prompt and calls `generateAI` directly - `WitnessBench.jsx`'s `compileStatementWithAI` (a witness's typed interview answers, which routinely name the veteran), `aiStatementHelper.js`'s own `decodeDecision`/`stressTestStatement`/`generateFieldSuggestion` (none of which call `callGeminiAPI`, despite a comment claiming every statement-helper prompt "funnels through" it), `musterCallProcessor.js`'s Muster Call batch report, `DenialDecoder.jsx`, `StatementAnalyzer.jsx`, `cfileAnalyzer.js`, and `MyPacket.jsx`'s pasted-DD-214 extraction - bypassed every one of them, cloud or on-device, and sent identifiers straight through.

`unifiedAIService.js`'s `generateAIInternal` now redacts the fully-combined (system + user) prompt via `_redactPromptForSend` immediately after `_buildFullPrompt` and before `_dispatchAiGeneration` - the ONE point every backend (Warrant Council/swarm, Wllama, the local llama.cpp server, legacy local, cloud) and both fallback paths funnel through, regardless of which of the above callers constructed the prompt or whether it supplied its own `systemPrompt`. This is the actual "single enforcement point" - the five builder-level passes above are redundant-but-harmless defense in depth over the SAME merged identifier set, not the boundary itself.

This does not protect a value a document mentions for the FIRST time (before it is ever known to the app) - see §4's DD214Analyzer/BlueButtonXRay note, which still applies to fresh OCR content specifically. It does protect every subsequent AI call once an identifier is on file, regardless of which tool's prompt carries it.

### 2.5 Free text and known-value redaction

`myPacketManager.js`'s `PACKET_CONTEXT_SAFE_FIELDS`/`FREE_TEXT_SAFE_FIELDS` allowlist (D13-4) already scrubs pattern-detectable PII (SSN/VA file number/phone/email/DOB/address) from evidenceNeeded/diagnosis/rationale/opinion/provider/examiner via `scrubText`. The known-value pass above is additional, not a replacement: it catches what pattern matching structurally cannot - a bare name, an ISO-format DOB, a claim/file number in unlabeled prose - by redacting the veteran's OWN identifier values, taken from their profile/VKB, from every string before it enters any AI context.

### 2.6 Document labels, not filenames

`myPacketManager.js`'s `_formatServiceRecordDoc`/`_formatCFileDoc`/`_formatOtherDocsSection` replace a document's raw `fileName` with a neutral structural label - document type + upload date + index (e.g. `"DD-214 (Service Record) 2026-02-01 (#1)"`) - in every AI context. The real filename is unchanged in the veteran-facing My Packet document list. `veteranKnowledgeBase.js`'s evidence-timeline/key-facts sections apply the same neutralisation to the `source` field, which is routinely a real uploaded filename used internally for provenance matching (`_upsertServiceEntryTimelineEvent`, `_projectTimeline`'s `knownSources`) - that internal value is unchanged; only the AI-context rendering neutralises it (`_looksLikeFileName` detects anything ending in a file extension; a safe label like `"DD-214"` or a tool name passes through unchanged).

### 2.7 Claim numbers

`buildClaimsHistoryContext` labels a claim by its condition(s)/claim type and decision (or filed) date - never a claim number, and never the literal string "null"/"undefined" for a missing one (D14-2).

## 3. Consequences

Positive:

- Every AI-powered tool - whether it reads veteran context through `getVeteranAIContext`/`generateLLMContext`/`buildSystemPrompt`, or builds its own raw prompt and calls `generateAI` directly (`WitnessBench.jsx`, `DenialDecoder.jsx`, `StatementAnalyzer.jsx`, `cfileAnalyzer.js`, Muster Call's report, ...) - is protected by construction at the `unifiedAIService.js` provider boundary (§2.4.1), not per-tool discipline.
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

- `redactKnownValues`'s exact-value matching can still redact a name token that happens to be a real word or medical term in unrelated content (a veteran named Temple/Long/Parkinson/Grant, "X-Ray" for a veteran named Ray) - **this is a genuine over-redaction risk that can corrupt what the model reasons over, not merely a display nit** (an earlier draft of this ADR understated it as one; corrected per QA review). A bounded, low-risk slice of this was fixed directly: generational suffixes (`II`/`III`/`Jr`/`Sr`) and short compound-surname particles (`De`/`La`/`Von`/...) are stoplisted, plus a 3-character floor on bare name tokens, so a suffix/particle can no longer unconditionally corrupt "Stage III chronic kidney disease" or "de novo". The residual case - a given/surname that is ALSO a common English word or medical term - has no reliable fix that doesn't reintroduce leak risk (a dictionary of "common words to never redact" could just as easily exempt an actual identifier), so it is accepted as a tradeoff in favor of decision D's data-minimization priority over display/reasoning fidelity.
- Accent-insensitive cross-variant matching (an OCR'd "Jose" matching a stored "José", or vice versa) is NOT implemented - only exact-value matching with Unicode-aware word boundaries (so "José"/"Zoë"/"Ångström" redact correctly when the TEXT uses the same accented form the profile has stored). A stored name and its accent-stripped OCR variant are treated as different strings. Flagged, not fixed, in this pass - see §4.
- A VA file number directly preceded by its own "C" prefix with no separator ("C12345678") is not redacted - the word-boundary check treats the leading "C" as a legitimate word-continuation character, since most word-bounded false positives look exactly like this. Spaced-out digit groups ("28 345 671") ARE now matched.
- `_looksLikeFileName`'s extension heuristic assumes an uploaded document's filename ends in a recognizable extension; a filename with no extension at all would pass through unlabeled-as-a-filename. Every real upload path in this app (`saveDocumentToPacket`, `mergeDD214IntoVKB`, musterCallProcessor's parsers) always carries a real filename with an extension, so this is a theoretical, not observed, gap.

## 4. Open issues (not built in this pass, flagged for the owner)

- `aiStatementHelper.js`'s `enhanceAppealStatement` and `generateNexusLetterRequest` have zero live callers (confirmed by grep) - the same dead-code shape the owner explicitly authorized deleting for `MY_PACKET_CONTEXT_PROMPT`/`myPacketData`, but deleting them was not explicitly authorized for this pass, so they were left in place.
- `DD214Analyzer.jsx`/`BlueButtonXRay.jsx` (and, by the same reasoning, `cfileAnalyzer.js`'s C-File OCR extraction and `MyPacket.jsx`'s pasted-DD-214 text extraction) send a just-uploaded document's own raw OCR/pasted text to `generateAI` for structured-data extraction - by design, since extracting a DD-214's fields requires showing the DD-214 to the model. §2.4.1's provider-boundary pass DOES now run on these calls too, so any identifier ALREADY on file (from a prior document or the profile) gets redacted even here - but a document's FIRST-EVER mention of an identifier the app doesn't know about yet cannot be redacted (there is nothing to compare it against until after extraction). This is a structural limit of known-value redaction, not a gap in wiring; a product decision on whether to run a generic NER/heuristic pass on first-upload OCR text before extraction is unresolved.
- `NexusBuilder.jsx`'s personal-statement and PTSD-stressor prompts are first-person ("I…") and have no name placeholder to substitute - confirmed by reading `buildStatementPrompt`/`buildPTSDStressorPrompt`; no fix needed, noted so a future reviewer doesn't wonder why they were skipped.
- Accent-insensitive cross-variant name matching (§3's "Jose"/"José" case) is unresolved - would need either a fuzzy/diacritic-folded comparison (risks new false positives) or normalizing every identifier source to a canonical accented form at write time (a larger, cross-cutting change). Flagged for a dedicated pass rather than folded into this one.
- The general over-redaction case - a veteran's given/surname that is also a common English or medical word (Temple/Long/Parkinson/Grant/Ray/...) - has no fix in this pass beyond the generational-suffix/particle stoplist (§3). A dictionary-based exemption list was considered and rejected: it would need to be exhaustive to be safe, and an incomplete one creates a false sense of protection while still leaking on the very names it happens to list.
- A VA file number with no separator before a leading "C" prefix ("C12345678") is not redacted (§3) - the boundary check that protects against redacting the middle of an unrelated word also blocks this legitimate case. Unresolved; would need a numeric-identifier-specific boundary rule distinct from the name-token one.

## 5. Verification

`piiScrubber.knownValueRedaction.test.js` and `piiScrubber.unicodeAndOverRedaction.test.js` (unit tests for `redactKnownValues`/`collectKnownIdentifierValues`/`redactVeteranIdentifiers`, including Unicode name boundaries, the suffix/particle stoplist, hyphen/apostrophe variants, service numbers, and DOB/SSN/file-number format coverage), `veteranKnowledgeBase.aiContextObjectLeaks.test.js` (D14-2 claim-number/null rejection, plus empty-field dangling-connector fixtures), `veteranContextProvider.piiRedaction.test.js` (a fixture veteran with a fake name/DOB/SSN/address/phone/email/VA file number/claim number, seeded into the VKB personal block, a claim, and a service-record document's fileName AND extractedData, rendered through the real, unmocked `generateLLMContext`/`getVeteranAIContext`/`generatePacketContext`/`buildSystemPrompt` at every budget from 100 to 1,000,000 tokens, plus a second fixture with the SAME identifiers on the legacy profile only and VKB.personal left untouched), `aiStatementHelper.placeholderRoundTrip.test.js` (proves the AI provider call never receives the real name, that the local substitution restores it for the veteran-visible result only, all three placeholder wordings match, and `resolveVeteranDisplayName` prefers the legacy profile's natural name order), `unifiedAIService.adr008Redaction.test.js` (the §2.4.1 provider-boundary pass, exercised through the real `generateAI` against a mocked local-server backend), `WitnessBench.aiRedaction.test.js` (the same boundary, exercised through WitnessBench's own `_compileStatementWithAI` with a witness's raw typed answer naming the veteran), and `MyPacket.periodLabelProvenance.test.jsx` (the Service tab's Source-line/form-type-editor fixes).
