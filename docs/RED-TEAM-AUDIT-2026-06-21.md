# Red-Team Coverage-Ledger Audit — vet-rate.org

> **Mode:** `ultra` (paced multi-agent fan-out) · **Date:** 2026-06-21 · **Branch:** `audit/fable-master-plan`
> **Working tree:** `e:\VS_Studio\vet-rate-org-official` · **Method:** coverage-ledger red-team (red-team-audit-prompt.md) + red-team-sources.md crosswalk (changelog 2026-06-20, fresh)
> **Status:** 🟡 IN PROGRESS — Wave A complete (critical lanes); Waves B/C/D pending. This file is the durable per-wave checkpoint and is resumable.
> **Read-only audit.** No source modified, nothing pushed. Prior audit docs treated as untrusted hypotheses re-verified at HEAD.

## Executive summary

**Verdict: Ship-with-fixes — NO-GO for broader promotion until S0–S2 land.** The privacy _architecture_ is genuine and differentiated (local-first, no server, sound AES-256-GCM). The problem is a consistent pattern: **defenses are well-built, pass their isolated unit tests, and are marked DONE — but the gate never fires in the real path, and several shipped claims are false at HEAD.** Findings: **1 Critical · ~40 High · ~55 Medium · ~40 Low/Info** (post-verify; ~40 candidates killed by the 3-skeptic vote).

**Genuine blockers (fix before promotion):**

1. **Trust-critical falsehoods ship today** — README/FAQ deny analytics while GoatCounter runs ([A-H11]); the privacy policy renders 74 raw `{t()}` placeholders ([A-H10]); custom "Warrant Council" models are advertised but generic Qwen2.5-3B loads ([D-H01]); LICENSE=AGPL vs package.json=UNLICENSED ([B-H01]). Trust _is_ the product for this population.
2. **Crisis-safety i18n gaps (life-safety)** — the suicide-crisis modal message is hardcoded English ([C-C01], **Critical**); Dari/Pashto (priority Afghan-SIV languages) have **no crisis-detection keywords** ([C-H09]).
3. **PII/PHI exposure** — primary store is plaintext at rest ([A-H08]); the PII scrubber is mis-wired on all 3 egress paths ([A-H04]); cross-C-File data bleed between veterans in one session ([Ab-H01]).
4. **CI + cloud feature broken** — a lint error blocks the test + red-team jobs on every PR ([A-H09]); the Dropbox/OneDrive backup feature is **dead in prod** (CSP blocks the APIs) and **corrupts backups** (double-encryption) ([D-H10]/[D-H11]).
5. **Web perimeter** — no CSP HTTP header (static legal pages unprotected) + `unsafe-inline` + a prod `vision-test.html` pulling `@latest` from a CDN with no SRI ([D-H08]/[D-H14]); no HSTS.

**What this audit caught that ordinary passes miss:** it re-verified every prior "DONE" at HEAD (RT1-3/RT1-5 still broken — `FALSE-PRIOR-CLAIM`), traced primitives to production (dual-LLM defense, both AI validators, and the tamper-evident audit log are all **dead code despite green tests**), and the completeness critic forced examination of `multiCloudStorage.js`, the CSP-header layer, and the Python scrapers — surfaces **no dimension lane touched**, where the reconverge then found ~6 more High.

**Dimension scorecard** (/10; N/A = out of surface scope)

| Dim                      | Score | One-line reason                                                                              |
| ------------------------ | ----- | -------------------------------------------------------------------------------------------- |
| A Backend/state          | 5     | Core rating math correct, but §4.26 drift across screens + 2 forked engines                  |
| B Interface/XSS          | 4     | DOM sinks self-escape (good), but scrubPII mis-wired on egress + CSP unsafe-inline           |
| C Data-model             | 4     | Plaintext PHI at rest + cross-C-File bleed; AES-GCM primitive sound                          |
| D Reliability/AI-runtime | 4     | Gemini errors swallowed, audit log unwired, zero AI observability                            |
| E UX/Nielsen             | 6     | Solid flows; spinner-only 30–120s model load, window.confirm for PHI deletes                 |
| F A11y WCAG 2.2          | 5     | Strong base (axe gate, palettes), but core AI/search a11y breaks + no RTL CSS                |
| G Brand                  | 5     | Sophisticated palette system, but D3 tokens 0-usage, raw hex, theme-color mismatch           |
| H Content/SEO            | 3     | Broken privacy policy, false FAQ, OG image wrong dims, no JSON-LD/sitemap                    |
| I Performance            | 4     | ~1.7 MB JS/JSON static on first load; budget/LCP gates permanently informational             |
| J Legal/compliance       | 3     | False claims, broken policy, UPL + license risk, GDPR consent, TOS storage error             |
| K Ops/CI                 | 5     | Rich CI, but lint broken, no required-checks aggregator, several gates don't block           |
| L Business               | 6     | Genuine moat; GO-with-blockers; zero funnel analytics; trust contradictions                  |
| M Supply-chain           | 4     | Unpinned actions, vision-test.html, no SRI, curl\|bash; npm audit clean                      |
| N Licensing              | 3     | AGPL vs UNLICENSED contradiction in 3 places; no NOTICE/attribution                          |
| O Secrets                | 5     | BYOK-only + gitleaks good; VA-key bundle-bake risk + OAuth tokens in sessionStorage          |
| P IaC/headers            | 4     | render.yaml has COOP/COEP but no CSP/HSTS; static host so infra surface small                |
| Q Concurrency            | 6     | Mostly fine; auto-backup setItem monkeypatch + persistentStorage TOCTOU                      |
| R Observability/SLO      | 5     | Server SLO N/A (static); client error visibility + ETL dead-man weak                         |
| S i18n                   | 3     | **Critical** crisis-msg English-only; no RTL CSS; 50 advertised langs untranslated           |
| T SDK stability          | 6     | Most deps verified clean; pdfjs CDN v4/v5 drift; wllama allowOffline API misuse              |
| U Data/ETL               | 4     | Silent partial-corpus publish; no staleness/row-count gates; scaffolds in prod cron          |
| V AI safety              | 4     | Dual-LLM + both validators dead in prod; BlueButton bypasses hallucination check             |
| W Mobile                 | N/A   | Web PWA, not a native mobile client                                                          |
| X CLI                    | N/A   | Build/release scripts audited under K/U, not a user-facing CLI                               |
| Y Threat-model method    | 5     | Threat model exists but stale + omits live egress; security.txt missing, placeholder contact |
| Z Quality method         | 5     | Good test infra, but mutation testing always skipped, stress not in CI, low coverage floor   |

---

## Model routing (token-burn control)

| Stage                                                    | Model      |
| -------------------------------------------------------- | ---------- |
| Recon enumeration                                        | Haiku 4.5  |
| Gate-runner                                              | Sonnet 4.6 |
| Synthesis (ledger + threat model)                        | Opus 4.8   |
| Finder lanes V · M+O · B · A+C+Q · J+N (recall-critical) | Opus 4.8   |
| Finder lanes E+F · G+H · I · U · T · D+R · S · L · Y+Z   | Sonnet 4.6 |
| Verify skeptics (3× on Critical/High, 1× on Med/Low)     | Sonnet 4.6 |
| Completeness critic                                      | Opus 4.8   |

## Convergence / cost log

| Wave      | Lanes                                                             | Agents  | Subagent tokens | Tool calls | Status               |
| --------- | ----------------------------------------------------------------- | ------- | --------------- | ---------- | -------------------- |
| A         | recon×4 + gate + synth + V, M+O, B, A+C+Q                         | 59      | 2.30M           | 832        | ✅ done              |
| A-bis     | duplicate critical re-pass (args mis-routed; kept as 2nd opinion) | 47      | 1.91M           | 634        | ✅ harvested net-new |
| B         | J+N, E+F, G+H, I                                                  | 75      | 2.49M           | 967        | ✅ done              |
| C         | U, T, D+R, S                                                      | 70      | 2.37M           | 798        | ✅ done              |
| D         | L, Y+Z + completeness critic + 4 reconverge gap-finders           | 98      | 3.21M           | 1097       | ✅ done              |
| **TOTAL** | 5 wave-runs (incl. A-bis dup)                                     | **349** | **~12.3M**      | **4328**   | ✅ converged\*       |

\* Completeness critic returned **NOT-CONVERGED** after Wave C, naming `multiCloudStorage.js`, the CSP-header layer, the Python scrapers, and the `sanitize.js` blast radius as under-covered. The 4 reconverge gap-finders examined all of them. **Residual UNSEEN:** `public/service-worker.js` offline-navigation state (cache-poisoning of the user-data-bearing app shell) was named by the critic but not separately gap-audited — flagged in the attestation as the one open surface for a follow-up pass.

**Kill counts (Wave A):** V 8→7 · M+O 10→7 · B 6→3 · A+C+Q 7→6. Verify killed 8 candidate findings as false positives.

---

## CONTEXT (auto-filled, confirmed)

- **Project:** veteran-disability-search / vet-rate.org v1.23.1 — local-first, **no-backend** React 18 + Vite 8 SPA for US veterans (VA disability ratings + claim-evidence assembly). Audience is vulnerable; **trust is the product**.
- **Surface types:** Web app + in-browser AI/LLM + RAG/ETL pipeline + build/release CLI scripts. License: **UNLICENSED** (proprietary).
- **Data:** no payments; holds **PII/PHI locally** (C-files, DD214, SSN, diagnostic codes).
- **Primary trust boundary:** untrusted document/OCR/RAG content → in-browser LLM → DOM, **plus** no-server client→third-party egress (Gemini BYOK, GoatCounter, formsubmit.co, eCFR, cloud sync, VA sandbox, model CDNs).

---

## Threat model (Phase 1)

**Four questions.** (1) Local-first SPA helping veterans with VA ratings/claims, in-browser LLMs + OCR + RAG + optional BYOK Gemini. (2) Indirect prompt injection from untrusted docs/OCR/RAG steering the LLM; PII/PHI leak via client→third-party egress; false privacy marketing for a vulnerable population; broken privacy policy; XSS via dompurify-noop or `unsafe-inline` CSP; supply-chain compromise of unsigned model weights / pinned deps. (3) Dual-LLM RAG split, gov-only URL allow-list, escape-floor sanitizers, PII scrubbing before egress, BYOK-only Gemini, formsubmit off by default, AES-256-GCM before cloud upload, sanitize-at-ingestion, release-gate dist-secret scan + gitleaks. (4) Mostly sound on mechanics, but **trust-critical items still broken at HEAD** (RT1-3 broken privacy policy, RT1-5 false "no analytics") and **several marquee defenses are not wired into production**.

**Assets (C/I/A).** A1 Veteran PII/PHI in IndexedDB — **C=Critical** (crown jewel). A2 BYOK/VA keys. A3 Cloud-backup ciphertext. A4 RAG legal corpus — **I=Critical** (wrong citation → bad claim). A5 Trust/legal-disclosure surface — **I=Critical**. A6 LLM output → DOM.

**Trust boundaries (DFD).** B1 (primary) untrusted-content→OCR/RAG→LLM→DOM. B2 no-server client→third-party egress (the network boundary, since there is no backend). B3 build→dist `VITE_*` inlining. B4 ingestion→corpus. B5 local persistence (plaintext at rest).

**Lethal-trifecta verdict per LLM context.**

- RAG legal-answer (legalAnswerer.js): untrusted content YES, private data scrubbed, external comms NO → **SAFE** (2/3).
- **Cloud-AI → Gemini (unifiedAIService.js): private PHI + untrusted doc + external HTTP — ALL THREE → LETHAL TRIFECTA, partially mitigated** (scrubPII + BYOK consent + gov-URL strip). Residual: needs response-side egress filter + local-AI default.
- Local in-browser LLM (wllama/web-llm): no external comms → **SAFE by architecture**.
- Feature-request (formsubmit): opt-in + scrubbed → **SAFE**.

**Crown-jewel attack trees.** AT1 exfil PII (mitigated except local-malware reads plaintext IndexedDB — accepted debt). AT2 **false-trust over-disclosure** (RT1-5 README + RT1-3 broken policy — LIVE). AT3 corrupt legal answer (dual-LLM + hallucinationTrap — verify trap blocks). AT4 XSS (dompurify-noop unreached; CSP unsafe-inline removes backstop). AT5 steal keys/backups (BYOK-only + AES-256-GCM hold; VA-key bundle-baking is the open gap).

---

## Gate audit (Phase 0.5 — gates actually run)

| Gate                                                                            | Layer   | Runs?                     | Blocks?                          | Result              | Evidence                                                                        |
| ------------------------------------------------------------------------------- | ------- | ------------------------- | -------------------------------- | ------------------- | ------------------------------------------------------------------------------- |
| ESLint (`npm run lint`)                                                         | static  | yes (quality job)         | yes — gates test+red-team        | **FAIL**            | exit 1; 1 error UserManual.jsx:6 unused `PROJECT_STATS` import (+1876 warnings) |
| tsc `--noEmit`                                                                  | static  | yes                       | yes (if in branch protection)    | PASS                | exit 0; checkJs:false so JS bodies unchecked                                    |
| `npm audit` high+ prod                                                          | dep-sec | yes (security job)        | yes                              | PASS                | 0 vulnerabilities                                                               |
| Gitleaks full-history                                                           | secret  | yes                       | yes                              | PASS                | 615 commits, no leaks                                                           |
| License audit                                                                   | supply  | local-only (not in CI)    | N/A                              | PASS                | no disallowed licenses                                                          |
| SAST semgrep (sast-check.mjs)                                                   | static  | yes in CI (pip installs)  | yes                              | TOOL ABSENT locally | local semgrep missing; CI installs it                                           |
| OSV-Scanner                                                                     | dep-sec | **not in ci.yml**         | N/A                              | TOOL ABSENT         | only `npm run audit:deps` local; binary not installed                           |
| Build / test+cov / e2e / mobile / axe / cwv / pwa / lighthouse / red-team / dkb | various | yes (needs build/quality) | yes (CLS+SEO hard; LCP/TBT warn) | NOT RUN (slow)      | statically confirmed wired; lighthouse LCP/TBT/perf **warn-only**               |

**Gate findings:** ESLint breaks CI (High); no aggregating required-checks job (Med); floating action tags @v4/@v2 not SHA-pinned (Med); lighthouse LCP/TBT/perf warn-only (Med); OSV-Scanner absent from CI (Med); global coverage thresholds low lines:38/branches:24 (Low); semgrep absent locally (Info). **Tool availability:** gitleaks ✓, license-checker ✓, eslint/tsc/vitest/playwright ✓; osv-scanner ✗, semgrep ✗ (local), lhci ✗ (local).

---

## Coverage Ledger (Phase 0 — Wave A)

`SELF-CHECK (synth): ~33 representative rows over 85 recon-critical surfaces (rollups for the 215 UI / 63 data / ops bulk). CLEAN 16 · FINDING 4 · UNSEEN 13 at end of Wave A. Wave B/C/D expand the UNSEEN rollups.`

**CLEAN/verified-as-designed (do-not-regress):** dompurify-noop unreached (no jspdf.html sink); sanitize.js escape-floor; 4 dangerouslySetInnerHTML sinks self-escape; BYOK-only Gemini (RT1-1); formsubmit opt-in (RT1-2); AES-256-GCM cloud encryption + verify-before-commit keystore (s16); dual-LLM RAG primitive exists; eCFR sanitize-at-ingestion; stripUntrustedUrls + validateAIResponse now wired (PI-01/AIS-01 fixed).

**UNSEEN → carried into later waves:** AIAssistant.jsx, ClaimEvidenceUpload + florence-ocr-worker, legalRag.js retrieval, piiScrubber regex coverage, hallucinationTrap (blocks or flags?), VA OAuth/PHI path, multiCloudStorage plaintext-path check, BlueButtonXRay XXE (@xmldom/xmldom), wllama/localServer/diamondSwarm, pdf/dossier export PII, bulk 215 UI a11y/i18n, 63 data files provenance.

---

## Findings — Wave A (verified survivors)

> Severity tally Wave A: **~11 High · ~12 Medium · ~8 Low/Info.** Status `FALSE-PRIOR-CLAIM` = a prior doc marked it done; FALSE at HEAD.

### [A-H01] Dual-LLM injection defense is dead code in production

Lens: Security · **Severity: High** · Dimension: V · Status: NEW (refutes prior "dual-LLM defends untrusted docs") · Verify 2/3
Standard: LLM01 · ASI01 · NIST AI RMF MAP-2.3
Surface: `src/utils/dualLLM.js`, `src/services/legalAnswerer.js`, `src/utils/unifiedAIService.js`
Evidence: grep for `createDualLLM/runDualLLM/dualLLMExtract` across `src/**` matches only the export + tests; `legalAnswerer.answer()` referenced only in a JSDoc comment (LegalCitation.jsx:77) + tests. Real document→LLM paths (cfileAnalyzer.analyzeChunk L1664-1745, musterCallProcessor L158/L3214, DD214Analyzer L889) call `generateAI()` single-LLM.
Impact: The headline lethal-trifecta mitigation protects nothing the veteran uses. Every C-file/DD214/muster analysis is a single LLM call seeing raw untrusted document text in the same context as system prompt + DKB data + (Gemini path) network egress.
Fix: Route C-file + muster paths through `runDualLLM`, OR delete the unused exports and document single-LLM+spotlight+URL-strip as the accepted defense; add a production-wiring test. Effort: L

### [A-H02] Spotlight delimiters are not escaped — embedded closing tag breaks the untrusted-content fence

Lens: Security · **Severity: High** · Dimension: V · Status: NEW · Verify 3/3
Standard: ASI01 · LLM01 · AML.T0051
Surface: `src/utils/piiScrubber.js:340-341`, `src/utils/aiSystemPrompts.js:40-45`, `src/utils/cfileAnalyzer.js:1691`
Evidence: `spotlight(text) = \`${OPEN}\n${text}\n${CLOSE}\``does no escaping of a literal`</untrusted_content>`inside`text`. C-file path wraps raw OCR text. The red-team fixture itself contains the break-out payload (`injectionPayloads.js:28`).
Impact: An attacker controlling one page of an uploaded/altered document emits a closing delimiter, escapes the DATA fence, and issues instructions the single-LLM path reads as trusted commands. No dual-LLM backstop (see A-H01).
Fix: In`spotlight()`, neutralize the delimiter inside the payload before wrapping; unit-test that an embedded closing tag cannot terminate the fence. Effort: S

### [A-H03] Muster-call report injects untrusted filenames/extracted fields un-spotlighted, then renders as Markdown

Lens: Security · **Severity: High** · Dimension: V · Status: NEW · Verify 3/3
Standard: LLM01 · LLM05 · ASI01
Surface: `src/utils/musterCallProcessor.js:3214-3242`, `src/components/MusterCall.jsx:1276`
Evidence: comprehensive-report prompt interpolates `${r.filename}` + `${summarizeData(r.extractedData)}` (untrusted, user-uploaded) with NO `untrustedSection()` wrapper (unlike the per-chunk path L158). Output rendered `<ReactMarkdown>{report}</ReactMarkdown>`.
Impact: A crafted filename/field ("Note to AI: …") is read as instruction in the final synthesis; Markdown render can coerce link/image markup. URL exfil partially mitigated by stripUntrustedUrls; the injection-into-trusted-context is unmitigated.
Fix: Wrap interpolated fields in `untrustedSection()` (after the A-H02 escape fix); keep the response on the URL-strip path. Effort: M

### [A-H04] PII scrubber returns an object but is used as a string — privacy firewall broken on all 3 egress paths

Lens: Security/Data · **Severity: High** · Dimension: B · Status: NEW (refutes "PII scrubbed before egress") · Verify 3/3
Standard: A04:2025 (Insecure Design) · CWE-201 · LLM06
Surface: `src/components/FeatureRequest.jsx`, `BugSquasher.jsx`, `CommunityRoadmap.jsx`
Evidence: `scrubPII` returns `{ scrubbedText, piiFound, details, originalLength, … }` (piiScrubber.js:158-263) but all three components assign its return value directly to payload fields, e.g. `description: scrubPII(formData.description || "")` (FeatureRequest.jsx:262). grep for `scrubbedText` in all three = zero hits. `JSON.stringify(payload)` then ships the whole scrub-result object; `_subject` interpolates `[object Object]`.
Impact: The privacy firewall guarding formsubmit.co is wired wrong. Outbound JSON now carries scrub metadata incl. `originalLength` (leaks exact length of original PII text); also non-aggressive mode means bare SSN / VA-file / DOB / address are never redacted; `diagnostic_code` ships fully raw. Core promise "PII scrubbed before leaving device" operates on luck.
Fix: `.scrubbedText` on every egress call site + `{ aggressive: true }`, or add a `scrubText` helper. Effort: S

### [A-H05] VA API keys inline into the public client bundle via render.yaml; the dist-secret gate is blind to them

Lens: Security · **Severity: High** · Dimension: O · Status: NEW (prior CICD-10 variant) · Verify 3/3
Standard: ASVS V14.3.2 · CWE-200 · A02:2021
Surface: `render.yaml:8-26`, `src/api/vaSandbox.js:27-29`, `src/config/vaAuth.js:105-108`, `scripts/check-dist-secrets.mjs:14-18`
Evidence: render.yaml declares `VITE_VA_API_KEY` / `VITE_VA_FORMS_API_KEY` / `VITE_VA_BENEFITS_REF_API_KEY` as `sync:false` build env; Vite inlines every `import.meta.env.VITE_*`; both files read them → baked into public dist. The dist scanner only matches `AIza`/`[sr]k_`/`xox` — VA tokens match none, so the gate is fail-open for exactly these keys.
Impact: If the owner ever populates those Render dashboard values, the VA keys ship to every visitor and RT1-1 still passes green.
Fix: Add a VA-key/opaque-token heuristic to check-dist-secrets.mjs; better, do not expose VA keys client-side (proxy or keep out of the static build). Effort: M

### [A-H06] Production deploy path (Render) never runs the dist-secret leak gate

Lens: SRE/Security · **Severity: High** · Dimension: O · Status: NEW · Verify 3/3
Standard: NIST SSDF PW.7/PO.3 · A05:2021
Surface: `render.yaml:6`, `package.json:13`, `.github/workflows/release-gates.yml:87-89`
Evidence: `check-dist-secrets.mjs` runs only on tag in release-gates.yml:89; absent from `build`, `pre-deploy-check.js`, `push-prep.js`, `preflight.js`, and Render's `buildCommand`. The live deploy (Render builds from source) runs no secret-leak check.
Fix: append `&& npm run check:dist-secrets` to the `build` script or Render buildCommand. Effort: S

### [A-H07] Combined-rating drift — Secondary Scout drops the §4.26 bilateral factor on the same saved profile the Dashboard applies it to

Lens: Engineer/Data · **Severity: High** · Dimension: A · Status: NEW · Verify 3/3
Standard: CWE-682 · ASVS V11.1.1 · 38 CFR §4.26
Surface: `src/components/SecondaryScoutLauncher.jsx:1174-1180` vs `src/components/MillionDollarDashboard.jsx:229-239`
Evidence: Scout's `calculateCombinedRating` calls side-blind `combineMultipleRatings`, with a stale comment "no side metadata for saved ratings" — but `getMyRatings()`/`saveMyRatings` persist `side` (veteranProfile.js:579). Dashboard feeds the identical data into `calculateVARating`, which applies §4.26.
Impact: Same saved data shows different combined ratings on two screens (e.g. 40L+40R → Scout 60 vs Dashboard 70). A 10% tier swing moves projected monthly compensation by hundreds of dollars on a tool veterans trust to plan claims.
Fix: Scout should call `calculateVARating(savedRatings).combinedRating`. Effort: S

### [A-H08] Primary PII/PHI store (IndexedDB + localStorage) is plaintext at rest; AES-256-GCM protects only cloud-backup DEKs

Lens: Security/Data · **Severity: High** · Dimension: C · Status: RECURRING (RT6-3 disclosed, not remediated) · Verify 3/3
Standard: CWE-312 · ASVS V6.1/V8.1 · A02:2021
Surface: `src/utils/storage.js:216-224`, `src/utils/veteranProfile.js:587,620`, `src/utils/autoBackup.js:108-117`
Evidence: in-code disclosure "SECURITY DEBT: both stores are plaintext." Profile/ratings (incl. `ssn`, `vaFileNumber`) written as plain JSON; cloudEncryption wraps only the per-backup DEK + envelope — the primary store never calls encrypt/decrypt.
Impact: Any same-origin XSS, malicious extension, shared/kiosk device, or forensic image reads SSN/VA-file/DD214/diagnostics/C-file analysis in cleartext. Marketing frames the app as "armored"; the primary store has no at-rest encryption. (See A-M05 — auto-backup multiplies the footprint.)
Fix: Route profile/ratings/claims through the existing passphrase keystore (KEK machinery already exists); surface the disclosure at data-entry time. Effort: L

### [A-H09] ESLint error currently breaks CI — `quality` job fails, blocking `test` and `red-team` on every PR

Lens: SRE · **Severity: High** · Dimension: K · Status: NEW (regression on current branch) · Verify n/a (gate run)
Standard: NIST SSDF PW.7.2
Surface: `src/components/UserManual.jsx:6`
Evidence: `import { PROJECT_STATS } from '../data/projectStats';` — never used; `sonarjs/unused-import` fires as an **error**; `npm run lint` exits 1. `test` and `red-team` jobs `needs:[quality]` so they cannot start.
Impact: Every PR is blocked from running unit tests + the AI red-team suite while this persists (introduced by the current branch's projectStats change).
Fix: delete line 6 of UserManual.jsx. Effort: S

### [A-H10] FALSE-PRIOR-CLAIM — published privacy policy ships literal `{t()}` placeholders (RT1-3 not fixed)

Lens: Brand/Legal · **Severity: High** · Dimension: J · Status: FALSE-PRIOR-CLAIM (EGRESS_INVENTORY reconciliation #2) · Verify (synth, re-read at HEAD)
Standard: trust/broken-core-promise · privacy-disclosure liability · CWE-1059
Surface: `public/privacy-policy.html:445-457` (65 `{t(` placeholders total; generated today 2026-06-21)
Evidence: `<h3>{t("privacyPolicy","section1Title")}</h3>` etc render as visible body text. Root cause: `scripts/sync-legal-pages.js extractJSXContent` resolves `{"…"}` literals + className but has no `t(ns,key)` resolver, so calls pass through verbatim. terms-of-service.html has 0.
Impact: A veteran loading /privacy-policy.html sees broken template strings instead of the policy — and (cross-ref RT6-3) the plaintext-storage disclosure that's supposed to live there is therefore not visible.
Fix: add a `t()` resolver to `extractJSXContent` (resolve against translations.js); regenerate. Effort: M

### [A-H11] FALSE-PRIOR-CLAIM — README claims "no analytics" while GoatCounter ships on every page (RT1-5 not fixed)

Lens: Brand/Legal · **Severity: High** · Dimension: J · Status: FALSE-PRIOR-CLAIM (EGRESS_INVENTORY reconciliation #1) · Verify (synth)
Standard: FTC deceptive-claim · trust-erosion
Surface: `README.md:12,122,600` vs `index.html:93-94`
Evidence: README "Zero Data Collection … no analytics", "No analytics or telemetry"; index.html ships the GoatCounter `count.js` on every load; vite.config.js:19 injects the endpoint; privacy-policy DISCLOSES it. The tool is honest; the README is false.
Impact: False privacy claim to a vulnerable population; the contradiction is self-flagged in EGRESS_INVENTORY as open.
Fix: correct README to "privacy-respecting analytics (GoatCounter, no PII)"; reconcile all "never leaves device" bullets with EGRESS_INVENTORY qualifiers. Effort: S

### Medium (Wave A)

- **[A-M01]** Red-team test suite asserts isolated primitives (vi.fn mocks), not production pipeline wiring → green tests despite A-H01/A-H02. Dim V · NIST AI RMF MEASURE-2.7. Fix: add per-path integration tests spying on `generateAI`. Effort M. (3/3-adjacent, 1/1)
- **[A-M02]** BYOK Gemini has no aggregate token/cost ceiling on multi-chunk C-file cloud runs (only per-request timeout) → denial-of-wallet against the veteran's own key. Dim V · LLM10/ASI02. Fix: aggregate cloud-call/token cap + cost estimate. Effort M.
- **[A-M03]** CSP `script-src 'unsafe-inline'` — the documented "SHIELD" is not an XSS backstop; every dangerouslySetInnerHTML must self-escape (they do, but zero safety net). Dim B · A05:2025/CWE-79/ASVS V14.4.3. Fix: nonce/hash CSP, drop unsafe-inline. Effort M.
- **[A-M04]** Render builds with `npm install` not `npm ci` — lockfile integrity ignored at the actual deploy site (CI uses `npm ci`). Dim M · SLSA Build L2. Fix: `npm ci`. Effort S.
- **[A-M05]** Auto-backup monkeypatches `localStorage.setItem`, copies PII into a 3rd plaintext IndexedDB (`VetRateAutoBackup`, 10 deep) + plaintext Downloads file; setter patch un-guarded against double-wrap. Dim Q/C · CWE-696/CWE-312. Fix: encrypt backups (crypto exists) + idempotency guard. Effort M.
- **[A-M06]** Legacy combined-rating engine pairs the two HIGHEST ratings for §4.26 instead of the actually-paired extremities (latent — only tests reach it today). Dim A · CWE-682. Fix: delete branch or pass paired set. Effort M.
- **[A-M07]** Two forked compensation-rate engines (hardcoded `VA_PAY_RATES_2026` vs dynamic `getCurrentYearRates`) + three forked bilateral detectors can drift. Dim A/C · CWE-1041. Fix: collapse to one source. Effort M.
- **[A-M08]** `# pinact` comments falsely imply SHA-pinning; most third-party actions still floating (pr-checks/release-gates/monthly). Dim M · OpenSSF Pinned-Dependencies. Fix: `pinact run`. Effort M.
- **[A-M09]** Primary ci.yml pins NO actions to SHAs (all @v4/@v5/@v2), inc. the always-on gitleaks/semgrep/npm-audit security job. Dim M · zizmor. Fix: SHA-pin. Effort M. _(overlaps gate finding + A-M08 — dedupe in final synthesis)_
- **[A-M10]** No aggregating required-checks job in ci.yml → individual gates may not be in branch protection (config-time gap, unverifiable without admin). Dim K · SLSA Build L2. Fix: add aggregator + require it.
- **[A-M11]** Lighthouse LCP/TBT/perf-score are warn-only (only CLS+SEO hard-block) → perf regressions can't block merge. Dim I. Fix: promote to error once baseline stable.
- **[A-M12]** OSV-Scanner absent from CI (only `npm audit`) → OSV/GHSA-only CVEs uncaught. Dim M. Fix: add `google/osv-scanner-action`.

### Low / Info (Wave A)

- **[A-L01]** Crisis interceptor multilingual coverage is finite keyword-match; non-English hits capped at severity 'high' not 'critical'. Dim V · safety-critical. _(AIS-04 mostly fixed — now wired to text/cloud path, refuting prior "voice-only".)_ Fix: expand keywords + allow 'critical' escalation. Effort M.
- **[A-L02]** connect-src allows unused `api.anthropic.com` (BYOK is Gemini). Dim B · CWE-942. Fix: remove. Effort S.
- **[A-L03]** Node version drift (ci.yml 20 / pr-checks 22 / engines ≥18 / Render unset). Dim M. Fix: `.nvmrc` + `node-version-file`. Effort S.
- **[A-L04]** Global coverage thresholds low (lines:38/branches:24); per-file security floors are fine (dualLLM/piiScrubber/smcDetector 95%). Dim Z. Fix: raise floors incrementally.
- **[A-I01]** gitleaks allowlist permits broad `test[_-]?(key|token)` value-regex repo-wide (not path-scoped). Dim O. Fix: path-scope only. Info.
- **[A-I02]** semgrep absent locally (CI installs via pip) — local SAST can't run. Dim K. Info.
- **[A-I03]** "Data never leaves your device" README bullets are PARTIALLY-REFUTED (GoatCounter + opt-in flows egress per EGRESS_INVENTORY's 12+ destinations). Dim J. Fix: add qualifiers. _(rolls up with A-H11)_

### Findings — Wave A-bis (net-new from the duplicate critical re-pass; different adversarial seed)

### [Ab-H01] Cross-C-File PII bleed — shared `EMPTY_CHUNK_RESULT` singleton mutated in place

Lens: Data/Security · **Severity: High** · Dimension: C/Q · Status: NEW · Verify 3/3
Standard: CWE-1058 · CWE-488 (exposure to wrong session) · ASVS V8.3.4
Surface: `src/utils/cfileAnalyzer.js:1483-1493, 676, 698-712, 1803`
Evidence: `EMPTY_CHUNK_RESULT` is a module-scoped singleton pushed BY REFERENCE on skip gates (L1273/1286/1300/1309). `mergeChunkResults` L676 takes `chunkResults[0].servicePeriod` by reference then mutates it in place (L698-712). When chunk[0] is a skipped cover/admin page (common in a VA C-file), `merged.servicePeriod === EMPTY_CHUNK_RESULT.servicePeriod`, so the veteran's branch/entry/separation/MOS are written into the persistent singleton. The "copy" at L1803 is a shallow spread — `.servicePeriod` still aliases the singleton.
Impact: Veteran A's service history persists in the singleton; the next C-file analyzed in the same browser session (Veteran B, e.g. a VSO/advocate reviewing multiple files) seeds `merged.servicePeriod` from the polluted singleton → prior subject's military service data surfaces in a different document's results. Silent corruption of a core legal-evidence artifact.
Fix: spread-clone at L676 (`{ ...(chunkResults[0].servicePeriod || {}) }`) and replace raw-singleton pushes with a fresh-object factory. Effort: S

### [Ab-H02] CFR-grounding half of the AI validator is dead — no caller passes `loadedRegulations`

Lens: Security/Data · **Severity: High** · Dimension: V · Status: NEW (partial-fix of prior AIS-01) · Verify 3/3
Standard: LLM09 (Misinformation) · LLM05 · ASI04
Surface: `src/utils/aiSystemPrompts.js:1209-1221`, `src/utils/unifiedAIService.js:2026-2047`
Evidence: `validateAIResponse` only checks CFR grounding `if (context.loadedRegulations)`; the sole production call passes `loadedRegulations: options.loadedRegulations`, and a repo-wide grep shows NO production caller ever sets it. The forbidden-phrase half (AIS-01) is live; the citation-grounding half never runs.
Impact: A model that hallucinates or is injected into emitting a fabricated `38 CFR § 4.999` passes validation and is shown to a veteran assembling a real claim. Reading the AIS-01 "DONE" marker hides that only half the validator is live.
Fix: have C-file/legal callers pass the loaded CFR set, OR validate every emitted `38 CFR §` against the bundled regulation index. Effort: M

### [Ab-H03] Legal-answer citations mapped by filtered index into the unfiltered chunk array — wrong CFR attributed

Lens: Engineer/Data · **Severity: High** · Dimension: V/A · Status: NEW · Verify 3/3
Standard: LLM09 · CWE-345
Surface: `src/services/legalAnswerer.js:147-168`
Evidence: `applicable = facts.filter(f => f.applicable)` then `applicable.map((f,i) => ({ citation: chunks[i]?.citation }))` uses the FILTERED index `i` to index the UNFILTERED `chunks`; final list is `chunks.slice(0, applicable.length)`. If chunk #0 is non-applicable but #1 is, the first applicable fact gets chunk[0]'s citation.
Impact: A veteran is shown a legal answer attributed to a CFR section that did not ground it — silent mis-citation in a legal-research tool (drives bad claims).
Fix: carry the original chunk index through the extractor output so each fact + citation reference the same source chunk. Effort: M

### Medium / Low / Info (Wave A-bis)

- **[Ab-M01]** Supply-chain CI job runs `bash <(curl -sSfL …/actionlint/main/scripts/download-actionlint.bash)` — fetches code from a moving `main` branch, no checksum, piped to bash inside the _supply-chain_ job. Dim M · CWE-494. Fix: pin to a tagged release URL + verify sha256. Effort S. (pr-checks.yml:214-216)
- **[Ab-M02]** `persistentStorage` TOCTOU: `saveInProgress` guard set only on the file path, never the IndexedDB (mobile) path; `hasUnsavedChanges` never cleared there → perpetual 30s full-packet re-save + spurious unload prompt + interleaved last-write-wins. Dim Q · CWE-367. Fix: set/clear guard + reset flag around the IndexedDB branch. Effort S.
- **[Ab-L01]** `generateAIWithImage` bypasses the entire safety pipeline (crisis, hallucination trap, validateAIResponse, URL strip) — currently no production caller (latent). Dim V · LLM05. Fix: route vision output through the post-gen filters before any caller is added. Effort S.
- **[Ab-I01]** `expectJSON` opt-out disables URL stripping on untrusted-OCR-derived JSON fields (C-file/muster). Low now (rendered as escaped React text, not markdown); flag for any future markdown render of those fields. Dim V · LLM05.
- **[Ab-I02]** 1876 ESLint warnings (complexity/cognitive-complexity in core utils) — quality debt beneath the one blocking error (A-H09). Dim Z.

> **Note on crypto-at-rest nuance:** the A-bis ACQ pass confirms cloud-backup encryption (AES-256-GCM) AND that the _key custody_ (DEK/KEK) is AES-KW-wrapped under a passphrase KEK with verify-before-commit. This does **not** contradict [A-H08] — the _profile/ratings/C-file data store itself_ (storage.js/veteranProfile localStorage+IndexedDB) remains plaintext at rest, per the in-code "SECURITY DEBT: both stores are plaintext" disclosure. Cloud backups encrypted; primary local data store not.

### Verified CLEAN (do-not-regress — reported so not silently dropped)

- PI-01 `stripUntrustedUrls` + AIS-01 `validateAIResponse` now wired on every non-JSON response (prior "dead code" claims do not reproduce at HEAD).
- dompurify-noop unreachable (no `jspdf.html()` sink); all 4 dangerouslySetInnerHTML sinks self-escape.
- BYOK-only Gemini (no baked key); formsubmit opt-in + scrubbed; AES-256-GCM cloud encryption; keystore verify-before-commit invariant (s16) intact.

---

## Findings — Wave B (J+N · E+F · G+H · I)

> Severity tally Wave B: **9 new High · ~14 Medium · ~10 Low/Info.** Kill counts: JN 7→5 · EF 16→10 · GH 14→12 · I 12→11. Wave B independently re-confirmed [A-H10] (broken privacy policy, 3/3 in BOTH the J and H lanes). Prior **TOOL-01** (CMD+K dead no-op) and **TOOL-02** (diag search index bug) are **VERIFIED FIXED at HEAD**.

### Legal / Licensing (J+N)

### [B-H01] LICENSE file is verbatim AGPL-3.0 while package.json declares UNLICENSED — network-copyleft contradiction

Lens: Legal · **Severity: High** · Dimension: N · Status: NEEDS-DECISION/COUNSEL · Verify 3/3
Standard: SPDX consistency · AGPL-3.0 §13 (network-use source obligation) · CWE-1104
Surface: `LICENSE` vs `package.json:5`
Evidence: LICENSE is 661 lines of unmodified AGPL-3.0 FSF boilerplate with the generic `Copyright (C) <year> <name of author>` template (no "vet-rate"/proprietary text); package.json declares `"license": "UNLICENSED"` on a proprietary commercial product.
Impact: Two authoritative, mutually exclusive license grants ship together. If the LICENSE file controls (OSS/legal norm), the operator has inadvertently AGPL-licensed a proprietary VA-claims product — §13 obligates offering complete corresponding source to every network user. If package.json controls, LICENSE is a false grant. Unresolved IP governance either way.
Fix: owner/counsel decides; make the two agree (proprietary text + remove AGPL, or set package.json to `AGPL-3.0-only`). Do not auto-pick. Effort: S
_(license-checker dependency scan is CLEAN — only permissive licenses in the prod tree.)_

### Medium / Low (J+N)

- **[B-M01]** GoatCounter loads unconditionally with **no DNT/GPC honor and no opt-out** (0 grep hits for `globalPrivacyControl`/`doNotTrack`). Dim J · CCPA/CPRA 1798.135 (must honor GPC). Fix: gate the loader on `!navigator.globalPrivacyControl && navigator.doNotTrack !== '1'`. Effort S.
- **[B-M02]** Legal-page sync gate (`check-legal-pages`) validates **mtime only**, never reads content — it green-lit the broken privacy policy. Dim J · gate-efficacy. Fix: fail if generated HTML still contains `{t(`. Effort S.
- **[B-L01]** Privacy-policy effective-date drift: generated HTML says Jan 18 2026, source says Jan 23 2026 (regex falls back to a hardcoded default). Dim J. Fix S.
- **[B-L02]** No `NOTICE` file — 9 Apache-2.0 prod deps + runtime HF/MLC model weights unattributed. Dim N. Fix S.

### Accessibility / UX (E+F)

### [B-H02] AI chat message area has no live region — screen readers never announce AI responses

Lens: A11y · **Severity: High** · Dimension: F · Status: NEW · Verify 3/3
Standard: WCAG 4.1.3 (Status Messages) · 1.3.1
Surface: `src/components/AIAssistant.jsx:950` (compact) + `:614` (expanded)
Evidence: message container `<div className="flex-1 overflow-y-auto …">` has no `role="log"`/`aria-live`; grep for `aria-live|role="log"` = 0. New AI responses append to DOM silently.
Impact: NVDA/VoiceOver/TalkBack users of the **primary AI claims assistant never hear AI responses** — a core-function failure for the SR population. Fix: `role="log" aria-live="polite"` on both containers. Effort: S

### [B-H03] AI Navigator compact send button has no accessible name

Lens: A11y · **Severity: High** · Dimension: F · Status: NEW · Verify 3/3 · Standard: WCAG 4.1.2
Surface: `src/components/AIAssistant.jsx:1228-1246`
Evidence: icon-only `<button>` with an `<svg>`, no `aria-label`, SVG not `aria-hidden` → SR reads garbled path data. (axe gate intentionally skips AIAssistant, so it never catches this.)
Impact: the primary AI submit control is unnamed for SR users. Fix: `aria-label` on the button + `aria-hidden` on the SVG. Effort: S

### [B-H04] SearchBar combobox: `role="option"` on `<button>` with hardcoded `aria-selected={false}` — breaks the #1 journey for keyboard/SR

Lens: A11y · **Severity: High** · Dimension: F · Status: NEW · Verify 3/3 · Standard: WCAG 4.1.2 · ARIA 1.2 combobox
Surface: `src/components/SearchBar.jsx:124-132` (input :87)
Evidence: all 8 suggestions are `button[role="option"]` hardcoded `aria-selected={false}`; the combobox input has no `aria-activedescendant`. `role="option"` on an interactive `button` is invalid ARIA; no item is ever announced as selected.
Impact: a veteran typing a condition and arrowing the dropdown gets no SR announcement and can't reliably pick via keyboard — the core search flow is broken for SR/keyboard users. Fix: proper listbox + `aria-activedescendant`, or native `<datalist>`. Effort: M

### [B-H05] Header Tools/Resources menus close on Tab-out via `onBlur` setTimeout — keyboard navigation race

Lens: A11y · **Severity: High** · Dimension: E/F · Status: NEW · Verify 3/3 · Standard: WCAG 2.1.2 · 2.4.3
Surface: `src/components/Header.jsx:330, 1090-1091`
Evidence: `onBlur={() => setTimeout(() => setShowToolsMenu(false), 200)}` — the menu is scheduled to close when the trigger blurs; on slow/stressed devices it can vanish before keyboard focus lands inside.
Impact: the primary nav for 40+ tools can close as a keyboard user enters it — disproportionately harms users with tremor/TBI/switch access (the target population). Fix: `focusout` with `relatedTarget` containment check. Effort: S

### Medium / Low (E+F)

- **[B-M03]** `AffiliationPickerPrompt` (new first-visit onboarding, shown to every new user) is **absent from `axe.spec.ts` MODAL_SURFACES** → never CI-gated. Dim F. Fix S.
- **[B-M04]** `AccessibilityMenu` `<section>` has both `aria-label` and `aria-labelledby` pointing at a button id (double-label + invalid owner). Dim F. Fix S.
- **[B-M05]** `GlobalCommandSearch` (Ctrl+K) lacks `role="combobox"`/`aria-activedescendant`/`aria-selected` → keyboard selection invisible to AT across 40+ tools. Dim F. Fix M.
- **[B-M06]** Heavy local-LLM load (30–120s) shows spinner/bounce only — **no progress, no cancel, no time estimate**; violates Nielsen #1 + agent-UX checklist + EU-AI-Act human-oversight. Dim E. Fix: elapsed timer + cancel + `aria-busy`. Effort M.
- **[B-M07]** `window.confirm()` used for **PHI-destructive** ops in 11+ sites (MyPacket delete pain map / clear all claims, + BugLookup/ClaimNavigator/EvidenceTimeline/etc.) — inaccessible, broken in PWA standalone, no undo. Dim E/F · WCAG 3.3.4. Fix: reuse the accessible `AtomicWipe` ConfirmModal. Effort M.
- **[B-L03]** `aria-haspopup="true"` (deprecated, implies `role=menu`) on Tools/Resources triggers. Dim F. Fix S.
- **A11Y note:** `palette-contrast.test.js` runs in jsdom (can't check computed contrast — the correct workaround) but **omits `text-va-gold` on white**: 6 palettes (army/coast-guard/flag/women-veterans/juneteenth/native-code-talker) have a va-gold that **fails AA 4.5:1 as normal text on white**. See [B-M11]/contrast. `pa11y` does not run (axe-core/playwright is the gate — informational).

### Brand / SEO (G+H)

### [B-H06] OG share-image is 1644×1645 (square) but declared 1200×630 — wrong dimensions + aspect ratio

Lens: Brand · **Severity: High** · Dimension: H · Status: NEW · Verify 3/3
Standard: Open Graph §image · Twitter `summary_large_image` (~1.91:1)
Surface: `index.html:44-47`, `public/images/Vet-Rate-org-logo-official.png` (measured 1644×1645)
Evidence: `og:image:width 1200` / `og:image:height 630` contradict the actual square file. Impact: every veteran sharing the app (Facebook groups/Reddit are heavily used) gets a cropped/distorted preview, reducing trust + clicks. Fix: build a purpose-made 1200×630 landscape share image; correct the metas. Effort: S

### Medium / Low (G+H)

- **[B-M08]** Meta description + manifest + faq all claim **"39 tools"; actual is 44** (`getTotalToolCount()`/projectStats). Dim H. Fix: derive at build. Effort S.
- **[B-M09]** **`faq.html` states "No analytics"/"No tracking pixels"** while GoatCounter loads — a second false-claim surface beyond README [A-H11]. Dim H · FTC. Fix S.
- **[B-M10]** `manifest.json`/light `theme-color` = `#003f87` (old federal **blue**) but the brand token `va-blue` is `#2d5016` (forest **green**) — Android/PWA chrome shows a different brand than the app. Dim G. Fix S.
- **[B-M11]** **D3 regression confirmed at HEAD:** the `medal-green`/`service-blue`/`tactical-grey`/`warning-gold` design tokens have **0 component usages** (pipeline runs, output dead); components use ~1000 raw Tailwind ramp classes. Dim G. Fix: adopt or delete. Effort L.
- **[B-M12]** `BootCampTour` injects **15 raw hex colors** via a runtime CSS string (incl. a third brand-gold `#c8a961`) — the first-impression tour ignores the user's palette/theme. Dim G. Fix M.
- **[B-M13]** `AffiliationPickerPrompt` header gradient pins `to-green-800` (Tailwind literal) → the picker that _introduces_ the palette feature renders in the wrong palette colors (e.g. Marines red→green). Dim G. Fix S.
- **6-palette contrast FINDING:** `tokens/source/palettes.json` — army/coast-guard/flag/women-veterans/juneteenth/native-code-talker va-gold fails AA 4.5:1 as normal text on white (the palette-axe baseline-relative gate may mask it). Dim F/G. Fix: darken those golds or restrict to large-text/non-text use.
- **SEO FINDING:** `robots.txt`, `sitemap.xml`, `llms.txt` all **absent**; a `test-dd214.pdf` sits in `public/` and may be indexed (verify it's a synthetic fixture, not real PHI). Dim H.
- **[B-L04]** `WebOfConditions`/`PainPainter` use 13+5 raw SVG hex colors, not theme/colorblind-aware. Dim G. Fix M.
- **[B-L05]** No JSON-LD structured data on any route (FAQPage/WebApplication rich-result eligibility missed). Dim H. Fix S.
- **[B-L06]** Copyright `2024-2026` hardcoded in 3 files (stale on 2027-01-01). Dim H. Fix S.
- **[B-I01]** Visual maturity **5/10** — "functional but pre-design-system" (raw Tailwind dominates, emoji as hierarchy, 3 disconnected brand golds). Top-3 file-tied upgrades named. Dim G. Info.

### Performance (I)

### [B-H07] 940 KB `disabilityData.json` statically bundled into the entry chunk (breaks 300 KB gz initial budget)

Lens: SRE/Perf · **Severity: High** · Dimension: I · Status: NEW · Verify 3/3 · Standard: CWE-400 · ASVS V14.1
Surface: `src/features/search/useDisabilitySearch.js:6` → App.jsx static-import chain (no manualChunks rule covers it)
Evidence: 940 KB raw JSON (~300-400 KB gz) parsed before first render on every visit. Impact: multi-second blank screen on slow mobile. Fix: move to `public/` + one-shot `fetch` on first search (or SW precache). Effort: M

### [B-H08] 694 KB `translations.js` statically bundled for every user regardless of locale

Lens: SRE/Perf · **Severity: High** · Dimension: I · Status: NEW · Verify 3/3 · Standard: CWE-400
Surface: `src/contexts/LanguageContext.jsx:633` → `src/i18n/translations.js` (the file's own comment acknowledges the un-done per-locale split)
Evidence: ~685 KB of translations 95%+ (English) users never use, parsed every load. Fix: per-locale split (`en.js` inline, dynamic-import others on switch). Effort: M

### [B-H09] Entire AI orchestration layer (~127 KB) statically imported on every page

Lens: SRE/Perf · **Severity: High** · Dimension: I · Status: NEW · Verify 3/3 · Standard: CWE-400
Surface: `AppProviders.jsx:3` → `LocalAIPanel.jsx:18` → `unifiedAIService.js` (+ `diamondSwarm.js`, `wllamaService.js`); `AIAssistantBubble.jsx:1` imports `AIAssistant` non-lazily.
Evidence: the `ai-utils` chunk is statically reachable from the entry module (the chunk label doesn't make it lazy) → loads even when the veteran only searches. Fix: `lazy()` `AIAssistant` in the bubble; defer the LocalAIProvider import. Effort: S (high leverage).

### Medium / Low (I)

- **[B-M14]** Bundle-budget gate is **permanently informational** — `STRICT_BUNDLE=true` is never set in any CI job + `continue-on-error: true`; the 300 KB ceiling can never block. Dim I. Fix: enable after B-H07/08/09. Effort S.
- **[B-M15]** CI `lhci autorun` loads `lighthouserc.json` (LCP/TBT **warn-only**); the stricter `lighthouserc.mjs` (LCP/TBT as **error**) is never loaded. Dim I. Fix: `--config=lighthouserc.mjs` or consolidate. Effort S.
- **[B-M16]** 4.4 GB WebLLM model download starts with **no `navigator.storage.estimate()` pre-check** (the pattern is used elsewhere) → silent mid-download failure on low-quota devices. Dim I. Fix S.
- **[B-M17]** `flag-icons.min.css` from jsDelivr is render-blocking in `<head>` with **no preconnect** (only used in the language dropdown). Dim I. Fix: preconnect/defer or self-host the 22 flags used. Effort S.
- **[B-M18]** LCP hero logo is a **2.37 MB PNG rendered at 80×80** (no WebP/AVIF/srcset) and the same file is the og:image. Dim I. Fix: 80px WebP + `<picture>`. Effort S.
- **[B-L07]** 20+ AppModals cluster wrappers statically imported (their `useEffect`/listeners run on every load though no modal is open). Dim I. Fix M.
- **[B-L08]** `vite.config.js` declares a `ui-libs` chunk for `framer-motion`/`@headlessui` — **neither is installed** (dead config). Dim I. Fix S.
- **[B-L09]** `cwv.spec.ts` INP gate ceiling is **1000 ms** (5× the 200 ms "good" CWV threshold) → 200-999 ms INP regressions pass. Plus `AIStatusBadge` 1000 ms `setInterval` re-renders the always-mounted Header. Dim I. Fix S.

## Findings — Wave C (U · T · D+R · S)

> Severity tally Wave C: **1 Critical · ~9 High · ~13 Medium · ~6 Low/Info.** Kill counts: U 14→9 · T 5→4 · D+R 14→8 · S 11→9.

### [C-C01] Crisis-intervention modal's primary message is hardcoded English regardless of locale

Lens: A11y/Safety · **Severity: CRITICAL** · Dimension: S · Status: NEW · Verify 3/3
Standard: AIS-04 (crisis safety must work in user's language) · WCAG 3.1.1
Surface: `src/utils/crisisInterceptor.js:258-268` → `src/components/CrisisModal.jsx:36/89-96`
Evidence: `getCrisisMessage(severity)` returns hardcoded English strings ("We detected language that suggests you may be in immediate crisis…"), rendered as `{message}` between two _translated_ fields. A veteran who typed in Spanish/Arabic/Korean sees the crisis body in English only.
Impact: the single most safety-critical user-facing string — telling a veteran in crisis they've been detected and help is available — is never translated, at the worst possible moment for a language barrier. Fix: move the 3 severity messages into `APP_TRANSLATIONS.crisisModal` (es/tl/vi/ko min) and have CrisisModal call `t()`. Effort: S

### eCFR / RAG / DKB pipeline (U)

### [C-H01] `fetch-ecfr.mjs` silently drops per-section HTTP failures with no minimum-coverage floor

Lens: Data · **Severity: High** · Dimension: U · Status: NEW · Verify 3/3 · Standard: NIST SSDF PW.7.1
Surface: `scripts/legal-ingestion/fetch-ecfr.mjs:196-212`
Evidence: `catch(e){ console.error(...) }` swallows every per-section error with no counter; the only guard is "zero records." If eCFR errors on 40% of sections, the other 60% is embedded and published as the new canonical index; run-all exits 2 → auto-PR fires.
Impact: a transient eCFR outage silently produces an index missing large chunks of Part 4 rating criteria → veterans get no/wrong RAG answers on the missing sections. Fix: track failCount/total, throw if >5%. Effort: S

### [C-H02] RAG eval gate never runs in the main CI pipeline — retrieval regressions don't block PRs

Lens: Data/SRE · **Severity: High** · Dimension: U · Status: NEW · Verify 3/3 · Standard: NIST SSDF PW.7.1
Surface: `.github/workflows/ci.yml` (no `eval:rag` step) vs `legal-ingestion.yml:69-75` (weekly cron only, only on diff)
Evidence: a code change that degrades the RAG retrieval path merges to main without ever running the baseline check (the eval exists but only gates the weekly index rebuild). Fix: add a read-only `run-eval.mjs --check-baseline` job to ci.yml against the committed baseline. Effort: S

### [C-H03] `validate-dkb` enforces no staleness ceiling on `lastVerifiedDate` — years-stale legal data passes CI

Lens: Data · **Severity: High** · Dimension: U · Status: NEW · Verify 2/3 · Standard: NIST SSDF PW.7.1
Surface: `scripts/validate-dkb.mjs:103-164`
Evidence: the field is parsed and the date range logged as a pass, but nothing asserts the oldest date is within any window; an entry dated 2020 passes on 2026-06-21. Impact: rating data drifted from the current 38 CFR schedule serves veterans; the "verified against 38 CFR" core promise is unenforceable. Fix: fail if `daysOld > MAX_STALENESS_DAYS` (suggest 365, env-tunable). Effort: S

### Medium / Low (U)

- **[C-M01]** `run-all.mjs` rebuilds + publishes the index when only 1 of 4 sources fetched (no `MIN_SOURCES`) → M21-1/CAVC/FedCir silently missing. Dim U. Fix S.
- **[C-M02]** `validate-dkb` asserts no minimum row count (a truncated `disabilityData.json` passes if `WEB_DATABASE_COUNT` is decremented to match). Dim U. Fix S.
- **[C-M03]** RAG `baseline.json` pinned to v0.1.0, never auto-updated on new index → numerical comparison biased. Dim U. Fix M.
- **[C-M04]** `fetch-dbqs.js` caches PDFs with a **size-only** check (no hash/ETag) → stale/corrupt VA forms served indefinitely (veterans may file outdated form revisions). Dim U. Fix M.
- **[C-M05]** Scaffold fetchers (`fetch-m21-1/cavc/fedcir.mjs`, "THIS IS A SCAFFOLD … verify selectors") are **registered in the production weekly cron** → weekly false-alarm noise + risk of scraping unintended content into the corpus. Dim U. Fix: gate behind a default-off flag. Effort S.
- **[C-L01]** `update-stats.js` bakes the developer hourly rate ($420) + `actual_cost`/`cost_savings` into `projectStats.json`, which **ships in the public bundle** (internal pricing leak). Dim U. Fix S.

### SDK / library stability (T)

### [C-H04] `pdfjs-dist` CDN font/cmap URLs pinned to abandoned v4.0.379 while v5.5.207 is installed

Lens: Engineer · **Severity: High** · Dimension: T · Status: NEW · Verify 3/3
Surface: `advancedOCR.js:32`, `pdfSearchEngine.js:23`, `florencePdfUtils.js:25,75`, `documentAnalyzer.js:405`, `pdfExtractor.js:43`
Evidence: 5 files hardcode `pdfjs-dist@4.0.379/standard_fonts/` (and `/cmaps/`) for `standardFontDataUrl`/`cMapUrl` while the installed worker is v5.5.207. v5 restructured the font/cmap corpus; mismatched v4 assets corrupt text extraction on Type1/CIDFont PDFs (common in scanned VA docs).
Impact: silent OCR degradation on DD214s / rating-decision letters — garbled extraction with no error surfaced, on the document-ingestion hot path. Fix: derive the URL from the installed version (or pin to 5.5.207). Effort: S
_(Many SDK surfaces confirmed CLEAN at HEAD: transformers v3 vision/generate API, pdf-lib, react-markdown v10 (no rehype-raw), tesseract v7, docx v9, mammoth v1.)_

### Medium / Low (T)

- **[C-M06]** `wllamaService.js` passes `allowOffline` to `loadModelFromUrl()` but that prop is only valid on the `WllamaConfig` constructor → offline-first preference silently ignored; cached model load fails in low-connectivity (VA waiting rooms). Dim T. Fix S.
- **[C-L02]** `@mlc-ai/web-llm` `interruptGenerate()` (returns Promise) called without `await` in `diamondSwarm.js:730,747` — unhandled-rejection risk on a pre-1.0 dep. Dim T. Fix S.
- **[C-I02]** Mixed jsPDF import style (named vs default) across files; undocumented `protobufjs` override. Dim T. Info.

### Reliability / observability / AI runtime (D+R)

### [C-H05] Gemini safety-block & MAX_TOKENS truncation silently swallowed — veteran gets "No response generated", not "blocked/truncated"

Lens: SRE/Security · **Severity: High** · Dimension: D · Status: NEW · Verify 3/3
Standard: LLM06:2025 · A10:2025 (mishandling exceptional conditions)
Surface: `src/utils/unifiedAIService.js:952-959`
Evidence: the parser checks only `data.candidates?.[0]?.content?.parts?.[0]?.text`; a SAFETY block has no `content` (→ generic throw) and MAX_TOKENS returns partial text that looks complete. No `finishReason`/`blockReason` inspection exists (grep-confirmed).
Impact: veterans asking about PTSD/MST/trauma — the population most likely to trip Gemini safety filters — get the least informative error and a broken trust invariant. Fix: inspect `promptFeedback.blockReason`/`finishReason`; map SAFETY → "rephrase or call a VSO", MAX_TOKENS → "response may be incomplete". Effort: S

### [C-H06] The tamper-evident AI audit log is fully built and tested but never wired into the production generation path

Lens: SRE · **Severity: High** · Dimension: D · Status: NEW · Verify 3/3
Standard: LLM06:2025 · A09:2025
Surface: `src/utils/aiAuditLog.js` (exports `logModelCall*`) vs `unifiedAIService.js` (no import)
Evidence: grep finds zero imports of `aiAuditLog` in `unifiedAIService.js`/`diamondSwarm.js`/components — the only caller is an internal sentinel. Every production AI call is invisible to the hash-chained log.
Impact: the "replay/audit/prove-no-tampering" trust feature is a dead letter — veterans cannot verify what was sent to Gemini. Fix: `void logModelCallWithDigests({...})` at the top of `generateAIInternal`. Effort: S

### Medium / Low (D+R)

- **[C-M07]/[C-M08]** No `AbortController`/cancel on the **4 GB** wllama (`wllamaService.js:160`) and WebLLM (`diamondSwarm.js:458`) model downloads → can't cancel; OOM/hang on low-memory devices. Dim D. Fix M each.
- **[C-M09]** No OTel GenAI spans / no AI metrics anywhere → production AI failures (timeout, 429, safety block) invisible to operator and user. Dim D · A09:2025. Fix: wire the audit log + a `window.__VETRATE_AI_METRICS__`. Effort M.
- **[C-M10]** ETL cron dead-man: `legal-ingestion.yml`/`dkb-freshness.yml` only `gh issue create` on failure (deduped, no Slack/email/push) → persistent stale-data failures produce one silent issue. Dim R. Fix M.
- **[C-L03]** Double `console.error` override (`main.jsx:38` + `bugReportUtils.js:657`) creates a broken chain + an extension-suppression filter that can drop real errors → misattributed production bugs. Dim D. Fix S. _(single logging sink otherwise confirmed clean; server SLO/SRE correctly N/A — static SPA.)_
- **Watch (WARN, not findings):** AI kill-switch is a static committed `status.json` that **fails open** on network error; `isFeatureEnabled` sync-vs-async race lets the first call bypass the kill switch; `AIAssistantBubble`/`FloatingBugButton` render outside any ErrorBoundary.

### i18n / localization (S)

### [C-H07] RTL layout entirely absent — Arabic/Farsi/Dari/Pashto are selectable, `dir=rtl` is set, but there are zero RTL CSS rules

Lens: A11y · **Severity: High** · Dimension: S · Status: NEW · Verify 3/3 · Standard: WCAG 1.3.4/1.3.2
Surface: `LanguageContext.jsx:676` (sets `dir`) + `tailwind.config.js:214` (no RTL plugin) + `src/index.css` (0 `[dir=rtl]` selectors)
Evidence: `dir=rtl` is applied but every layout uses hardcoded `ml-/pl-/left-` classes; no `rtl:` variant, no logical properties. Impact: Afghan-SIV + Arabic-speaking veterans (named as priority in code comments) get mirrored-broken layouts. Fix: add a Tailwind RTL plugin + logical utilities. Effort: L (but scope to nav/modal first).

### [C-H08] 50+ advertised languages have zero UI translations; fallback silently serves English key/phrases

Lens: Product/A11y · **Severity: High** · Dimension: S · Status: NEW · Verify 3/3
Surface: `LanguageContext.jsx:24-625` (55 codes declared) + `translations.js` (only en/es/tl/vi/ko)
Evidence: the language picker offers 55 languages; `t()` falls back to `keyData.en` on miss, so selecting Chinese/German/Arabic shows 100% English (and for RTL, English mirrored-broken). Impact: a deceptive feature promise to non-English veterans. Fix: restrict the selector to the 5 shipped locales ("coming soon" for the rest) OR ship ar/fa/zh. Effort: M.

### [C-H09] Dari (prs) and Pashto (ps) have NO crisis-detection keywords despite being priority Afghan-SIV languages

Lens: Safety · **Severity: High** · Dimension: S · Status: NEW · Verify 3/3 · Standard: AIS-04 · ASVS V14.2.1
Surface: `src/config/multilingualTone.json:957-1004` (crisis_keywords) vs `:650-698` (crisis_message)
Evidence: `crisis_keywords['prs']`/`['ps']` are `undefined`; `detectMultilingualCrisis()` only iterates `crisis_keywords`. The Dari/Pashto crisis _messages_ exist (developer intent) but are orphaned — keyword detection never fires. 34 other declared languages also lack keywords.
Impact: a Pashto/Dari-speaking veteran expressing self-harm in their native language does **not** trip the crisis interceptor — the exact population the code calls out as priority. Fix: add Dari/Pashto crisis keyword arrays (derive from the existing crisis_message strings). Effort: S (safety-critical → prioritize).

### Medium / Low (S)

- **[C-M11]** PrivacyPolicy §7 BYOK **critical warning** ("sends your data to Google…") + 3 labels are hardcoded English → non-English veterans can't make an informed BYOK consent decision. Dim S. Fix M.
- **[C-M12]** `analyticsIntro` rendered via `.split('GoatCounter')` and `.split('.')` — brittle locale-fragile parsing that silently drops text for future locales. Dim S. Fix: ICU placeholder interpolation. Effort S.
- **[C-M13]** `toLocaleDateString()`/`toLocaleString()` called without a locale arg in 15+ components → dates render in OS locale, not the selected language. Dim S. Fix S.
- **[C-I03]** AffiliationPicker group names + PrivacyPolicy date are hardcoded English literals. Dim S. Info. Plus `type=number` inputs without `inputMode=numeric` (non-Latin IME).

## Findings — Wave D (L · Y+Z · completeness critic · reconverge)

> Tally Wave D: **~16 High · ~22 Medium · ~12 Low/Info** (several High dedup prior RT1-3/RT1-5/license/CSP). Kill counts: L 13→9 · YZ 12→11 · reconverge lanes 10+8+7+6 verified. The critic returned **NOT-CONVERGED**; the 4 gap-finders closed the named gaps.

### Business / brand / legal (L)

### [D-H01] Custom "Warrant Council" fine-tuned models advertised — but the app loads generic Qwen2.5-3B

Lens: Brand/Legal · **Severity: High** · Dimension: L · Status: NEW · Verify 3/3
Standard: FTC Act §5 (deceptive product claims) · EU-AI-Act Art.13
Surface: `README.md:449-451`, `AICommandCenter.jsx:43-121`, `diamondSwarm.js:183-196` vs `:450-474`
Evidence: README links `Diamond-Swarm-Auditor/Writer/Rater-7B` on HuggingFace and `diamondSwarm.js` defines `vetrate-*-7b-v2.gguf` paths, but `initializeSwarm()` calls `CreateMLCEngine('Qwen2.5-3B-Instruct-q4f16_1-MLC')` — generic catalog models; the `.gguf` paths are never loaded. The HF links likely 404.
Impact: veterans pick "Local AI" trusting "No Hallucination of Regulations / Trained on 38 CFR / 100% Veteran-Specific" and get a generic 3B model — material misrepresentation; a reporter/competitor exposing this collapses the trust-is-the-product foundation. Fix: publish the real models OR correct all marketing to "generic Qwen2.5-3B + VA system prompt". Effort: L (needs owner decision).

### [D-H02] Terms of Service says storage is "localStorage" — it's IndexedDB (inaccurate data-loss warning)

Lens: Legal · **Severity: High** · Dimension: L · Status: NEW · Verify 3/3 · Standard: FTC §5 · ASVS V8.3.3
Surface: `TermsOfServicePage.jsx:451-454`, `public/terms-of-service.html:773-776` (17 files use idb-keyval)
Evidence: TOS says "All data is stored in your browser's `localStorage`" + "clear cache = data gone"; the primary store is IndexedDB (survives most cache clears, lost on "Clear site data"). Veterans make backup/panic decisions on a wrong mental model. Fix: correct the mechanism + erasure conditions. Effort: S.

### Confirmed FALSE-PRIOR-CLAIMs (re-verified 3/3 in the L lane)

- **[D-H03] = [A-H11]/RT1-5** README + index.html: "no analytics" vs shipped GoatCounter. FTC §5.
- **[D-H04] = [A-H10]/RT1-3** privacy-policy.html ships 74+ raw `{t()}` JSX strings. CalOPPA/FTC.
- **[D-H05] = [B-H01]** package.json `UNLICENSED` vs LICENSE = AGPL-3.0 (+ `branding.js:55 license:"AGPL-3.0"` + main.jsx header → 3 places say AGPL).

### Medium / Low (L)

- **[D-M01]** GoatCounter has no opt-out + no documented GDPR Art.7 legal basis. Dim L. Fix S.
- **[D-M02]** Zero funnel instrumentation — `grep` finds no `goatcounter.count()` calls; the product is blind to drop-off across the land→search→upload→analyze→export journey. Dim L. Fix S.
- **[D-L01]** Inconsistent dev stats across README/AGENTIC_VALUE_PROPOSITION/projectStats (20 vs 45 vs 156 days; 55 vs 591 commits) — undermines credibility for outreach. Fix S.
- **Watch (ledger):** `geminiTip` encourages 2000-page uploads with no free-tier-quota warning (denial-of-wallet on the veteran's key); `OnboardingGate` hardcodes a `vetrate_` storage prefix bypassing brand-aware `getStorageKey()` (multi-brand bleed); `NexusBuilder.generateStatement()` emits ready-to-file claim language → **verify `DraftWatermark` is unconditional (UPL risk)**; `PROVIDERS.DROPBOX.hipaaCompliant:true` is unconditional though personal Dropbox lacks a BAA; single-founder bus factor.

### Methodology / disclosure readiness (Y+Z)

### [D-H06] SECURITY.md has a placeholder `security@example.com` + stale deps + AGPL-vs-UNLICENSED claim

Lens: Security · **Severity: High** · Dimension: Y · Status: NEW · Verify 3/3 · Standard: RFC 9116
Surface: `SECURITY.md:10,230,289`
Evidence: vuln-disclosure contact is `security@example.com` (a researcher can't reach anyone); lists stale dep versions; claims AGPLv3 while package.json is UNLICENSED. Fix: real contact, drop the stale dep list, align license. Effort: S.

### [D-H07] `security.txt` (RFC 9116) absent from `public/` — only an unfilled template exists

Lens: Security · **Severity: High** · Dimension: Y · Status: NEW · Verify 3/3
Surface: `public/.well-known/` (missing) vs `docs/public/.well-known/security.txt` (placeholders)
Evidence: `/.well-known/security.txt` 404s; no build step copies/fills the template. Researchers/scanners can't find the disclosure channel. Fix: fill placeholders, deploy to `public/.well-known/`, add an expiry check. Effort: S.

### Medium / Low (Y+Z)

- **[D-M03]** `THREAT_MODEL.md` STRIDE omits the live egress surfaces (GoatCounter, FormSubmit, model-CDNs); last review 2026-06-06 with no cadence trigger. Dim Y. Fix M.
- **[D-M04]** The `red-team` CI job is **not a required merge gate** (no job `needs:[red-team]`; branch protection unverifiable from code) — "blocking" is aspirational. Dim Y. Fix: require it. Effort S.
- **[D-M05]** Red-team suite's `EXFILTRATION` + `SCHEMA_HIJACK` payload categories have **no category-specific assertions** (only spotlight-wrap checked). Dim Y. Fix S.
- **[D-M06]** = [B-L04] global coverage thresholds (branches 24) below realistic regression detection. Dim Z.
- **[D-M07]** Mutation testing **always skips** — the monthly job no-ops because no `stryker.config.*` exists. Dim Z. Fix: add a stryker config scoped to the 4 security utils. Effort M.
- **[D-M08]** GoatCounter script loaded from `gc.zgo.at` with **no SRI integrity hash** — a CDN compromise gets arbitrary JS over the PII-bearing SPA. Dim Y/M · CWE-829. Fix: add `integrity`+`crossorigin` or self-host. Effort S.
- **[D-L02]** `tests/stress/` (313 MB C-file load test) exists but no CI workflow runs it. Dim Z. Fix S.
- **[D-L03]** Threat-model review date stale vs added egress; no scheduled review trigger. Dim Y. Fix S.
- **[D-Info]** `THREAT_MODEL §7.2` overstates Diamond-Swarm agent-isolation risk — code shows stateless per-inference calls at HEAD (model-vs-code drift). Fix: correct the doc.

### Completeness-critic NEW findings (gaps Waves A–C missed)

### [D-H08] CSP ships only as a `<meta>` tag — `render.yaml` sets COOP/COEP/X-Frame but **no CSP HTTP header**

Lens: Security · **Severity: High** · Dimension: F · Status: NEW · Verify 3/3 (reconverge confirmed)
Standard: A05:2021 · ASVS V14.4.3 · CWE-693
Surface: `index.html:10-26` (meta CSP) vs `render.yaml:27-64` (no CSP entry)
Evidence: the 5 static `public/*.html` pages (privacy policy, terms, faq, support, offline) get **zero CSP**; a meta CSP can't set `frame-ancestors`/`sandbox`, can't `report-uri`, and is skipped if HTML is served from the SW cache before parse. Fix: add a `Content-Security-Policy` header to both render.yaml service blocks (+ `frame-ancestors 'self'`). Effort: S (single highest-leverage header fix).

### [D-H09] BlueButton X-Ray extracts diagnoses from PHI with `skipHallucinationCheck:true` — the advertised CFR validator is bypassed

Lens: AI-safety · **Severity: High** · Dimension: J/V · Status: NEW · Verify 3/3
Standard: LLM09:2025 · EU-AI-Act Art.13 · ASVS V1.14 (controls not bypassable)
Surface: `BlueButtonXRay.jsx:683-687, 737-740`
Evidence: the tool that mines a veteran's medical record calls `generateAI` with `skipHallucinationCheck:true, skipCrisisCheck:true, useDKB:false`; conditions labeled `isClaimable:true` are shown to the veteran without ever passing `validateConditions`. JSON-repair logic can fabricate structure from truncated output.
Impact: a hallucinated/mis-categorized condition can be presented as VA-claimable evidence on the exact PHI path the product promises to validate. Fix: run conditions through `validateConditions`, or flag every BlueButton condition "AI-extracted, unverified". Effort: M.

### Critic Medium / Low

- **[D-M09]** `scrubPII` default (non-aggressive) mode does **not** redact a **bare 9-digit SSN or VA file number** (only the dashed SSN) — and OCR/BlueButton text routinely has bare digits. Compounds [A-H04]. Dim V. Fix: make `ssnBare`/`vaFileStandalone` always-on at the egress boundary. Effort S.
- **[D-M10]** Cloud OAuth bearer tokens persisted in `sessionStorage` (Dropbox/OneDrive) — XSS-readable; reachability raised by unsafe-inline + no-op DOMPurify. Dim O. Fix: keep tokens in memory only. Effort M.
- **[D-L04]** Python ETL `va_data_pipeline.py:425` bare `except: pass` silently drops corrupt/malicious analysis JSON. Dim V. Fix S.

### Reconverge — cloud backup (`multiCloudStorage.js`)

### [D-H10] Double-encryption corrupts every UI-created Dropbox/OneDrive backup → permanently unrestorable

Lens: Engineer · **Severity: High** · Dimension: A(correctness) · Status: NEW · Verify 3/3
Standard: CWE-20
Surface: `MultiCloudManager.jsx:207-227` → `multiCloudStorage.js:281-313` (`saveToDropbox`)
Evidence: the UI pre-encrypts (`encryptForCloud`) then `saveToDropbox` unconditionally encrypts **again**; the outer/inner keys are stored under different filenames, so restore decrypts to an still-encrypted blob `importAllData` can't consume.
Impact: every "Encrypt backup" Dropbox/OneDrive backup is silently unrestorable — the core promise of the feature. Fix: pass raw data + passphrase to `saveBackup` for non-Drive providers (don't pre-encrypt). Effort: S.

### [D-H11] CSP `connect-src` blocks all Dropbox/OneDrive API calls → the cloud integration is dead in production

Lens: Security/Engineer · **Severity: High** · Dimension: B/correctness · Status: NEW · Verify 2/3
Surface: `index.html:18`
Evidence: `connect-src` omits `api.dropboxapi.com`, `content.dropboxapi.com`, `login.microsoftonline.com`, `graph.microsoft.com` — every token exchange/upload/list fetch is browser-blocked in prod. Fix: add the 5 origins (paired with the CSP-header fix [D-H08]). Effort: S.

### [D-H12] OAuth popup `window.open()` returns null when blocked → `null.closed` TypeError bricks Connect

Lens: Engineer · **Severity: High** · Dimension: correctness · Status: NEW · Verify 3/3
Surface: `multiCloudStorage.js:168-177, 463-472`
Evidence: no null guard after `window.open`; the `setInterval` reads `popup.closed` → unhandled TypeError on any browser with default popup blocking (common on shared VA workstations). Fix: `if (!popup) throw new Error('Pop-up blocked…')`. Effort: S.

### Reconverge cloud Medium / Low

- **[D-M11]** Dropbox `refresh_token` discarded (despite `token_access_type:offline`) → silent 401 after ~4h while UI shows "Connected". Fix M.
- **[D-M12]** User-info fetch after token exchange not `.ok`-checked → `user.name.display_name` TypeError orphans the token. Fix S.
- **[D-M13]** No SPA fallback route for `/auth/dropbox|onedrive/callback` (no `_redirects`/`vercel.json`) → 404 on static hosts → "authentication cancelled". Fix S.
- **[D-M14]** PKCE verifier not cleared on popup-cancel (state is) — credential-hygiene debt. Fix S.
- **[D-L05]** Backup passphrase min length 8 (< ASVS 12 for PHI). Fix S. · **[D-L06]** `PROVIDERS.DROPBOX.hipaaCompliant:true` unconditional (no BAA on personal accounts). Fix S.

### Reconverge — security headers / static pages / supply chain

### [D-H13] No CSP HTTP response header on either Render service (static legal pages unprotected) — see [D-H08]. Verify 3/3.

### [D-H14] `public/vision-test.html` ships to prod loading `@latest` from jsDelivr + `esm.run` with no SRI, referencing the non-existent npm package `@anthropic-ai/claude-instant`

Lens: Supply-chain · **Severity: High** · Dimension: M · Status: NEW · Verify 3/3
Standard: A08:2025 · CWE-830 · SLSA Build L2
Surface: `public/vision-test.html:7,158`
Evidence: mutable `@latest` tag + dynamic CDN import, no `integrity`, no CSP; `npm view @anthropic-ai/claude-instant` → does not exist. Fix: delete this debug page from `public/` (or pin+SRI+CSP-gate). Effort: S.

### Reconverge headers Medium / Low

- **[D-M15]** No `Strict-Transport-Security` header on either service (MITM/downgrade on shared VA/public WiFi — the target population). Fix S.
- **[D-M16]** `X-XSS-Protection: 1; mode=block` is deprecated (set `0`/omit; side-channel on legacy IE). Fix S.
- **[D-M17]** = [B-L02] `connect-src` lists unused `api.anthropic.com` (pre-cleared exfil channel under unsafe-inline). Fix S.
- **[D-L07]** `Permissions-Policy` omits `payment/usb/serial/bluetooth/document-domain`. Fix S.

### Reconverge — Python scrapers (`scripts/scrapers/`)

- **[D-M18]** Bare `except: pass` in `va_data_pipeline.py:425` + `va_workload_scraper.py:243` silently drop corrupt/failed parses (no counter, no floor). Dim U/correctness. Fix S.
- **[D-M19]** No request timeout on any `session.get()` (BVA/workload scrapers) → indefinite hang / pipeline DoS. Fix S.
- **[D-M20]** `pipeline_results.json` (error traces + scraped BVA decision text, potential veteran-name PII) written into `src/data/` → risk of committing into the Vite bundle; no `.gitignore` entry. Dim O/J. Fix S.
- **[D-L08]** No content-hash/provenance on downloaded VA Excel/PDF (`hashlib` imported, never used). · **[D-L09]** `p/python` semgrep pack missing → Python SAST gap. · **[D-Info]** report-link href not pre-validated (downstream SSRF guard holds). _(SSRF guards, filename sanitization, traversal guards, rate limiting all verified PASS.)_

### Reconverge — `sanitize.js` blast radius (DOMPurify-noop **cleared**)

> The "41 dangerouslySetInnerHTML callers" brief over-counted — **actual = 8 files, all examined, all injection-safe.** The hand-rolled escape-first allow-list replacing the no-op'd DOMPurify is architecturally sound. Residual bugs are correctness, not XSS:

- **[D-M21]** `highlightSearchTerm` double-escapes when called via `RecordSearch.jsx:421-423` (pre-escaped input re-escaped) → search hits with `&`/`<` silently fail to highlight and render `&amp;amp;`. Dim correctness · CWE-116. Fix S.
- **[D-M22]** `scrubSvg` does not strip `<style>` blocks or `url()` → CSS-based tracking/data-URI in a future contributed SVG survives (current badges clean; the BadgeDisplay comment overstates the guarantee). Dim security · CWE-79. Fix S.
- **[D-L10]** `dossierExport.js` interpolates user-typed numeric `rating` fields raw (self-XSS only — local IndexedDB origin). Fix S. · **[D-L11]** `safeHtml` entity-encodes `&` inside link URLs → broken query-string hrefs; also `safeHtml` is dead code (0 live callers). Fix S.

---

## Business audit (Phase L)

**SWOT.** **Strengths:** genuine local-first privacy (IndexedDB + WebCrypto, no server to breach) is a real moat vs claim-sharks / claim-mills / even va.gov (which needs ID.me); 44 tools at zero cost; AES-256-GCM cloud backup crypto is sound. **Weaknesses:** no account/retention (clear-browser = total data loss; returning-user rate unknowable since GoatCounter is page-load only); BYOK pushes AI cost to the veteran but adds onboarding friction; **the trust foundation is undermined by shipped contradictions** — false "no analytics", broken privacy policy, fake custom-model claims, AGPL/UNLICENSED ambiguity; single-founder bus factor. **Opportunities:** PACT Act created millions of newly-eligible veterans actively searching; VSO partnerships; (if AGPL is intended) community contributions. **Threats:** va.gov self-service expansion; a single trust incident — even fabricated by a competitor or predatory claim service — could collapse a privacy-promise product irreparably.

**Conversion funnel (instrumented?).** Land → Disclaimer → Search → C-file upload → AI analysis → Export. **Drop-off is unmeasured** — zero GoatCounter event calls exist, so the operator cannot see where veterans abandon. Highest-leverage fix: instrument the 5 funnel gates (privacy-preserving, no PII) **before** building more tools.

**Unit economics.** BYOK ≈ zero operator AI cost but onboarding friction; denial-of-wallet risk falls on the **veteran's own** Gemini key (no cap — [A-M02]/[D-M02 watch]). No payments → no PSP/refund exposure.

**Risk register (top 8):** (1) trust-breach via shipped false claims — _existential_; (2) fake custom-model exposure — _existential/legal_; (3) crisis-safety i18n gaps (English-only message + Dari/Pashto undetected) — _life-safety_; (4) PII/PHI plaintext at rest + scrubber mis-wired — _privacy/legal_; (5) AGPL/UNLICENSED IP ambiguity — _legal_; (6) UPL exposure (claim-language generation) — _legal_, needs counsel; (7) supply-chain (unpinned actions, vision-test.html, no SRI) — _security_; (8) key-person/bus-factor — _operational_.

**GO / NO-GO:** **GO with blockers.** The privacy architecture is genuine and differentiated. Blocking conditions before broader promotion: fix the trust-critical falsehoods (analytics, privacy policy, custom-model claims, license), the crisis-safety i18n gaps, and the plaintext-PHI/scrubber issues. These are reputational landmines that, if detonated, destroy the entire value proposition.

---

## Self-critique (Phase 7)

Three things this audit changed on its own review:

1. **Killed false positives via the verify pass.** Across waves the 3-skeptic vote dropped ~40 candidate findings (e.g. B lane 6→3; the "DOMPurify-noop = live XSS" thesis was _refuted_ — all 8 sinks self-escape; PI-01/AIS-01 prior "dead code" claims were refuted as **fixed at HEAD**). Reported kill counts per wave so shallowness is visible.
2. **The completeness critic caught real gaps the dimension lanes missed** — `multiCloudStorage.js` (double-encryption + dead-in-prod CSP), the CSP-header layer (no HTTP header), and the Python scrapers were never touched by Waves A–C; the reconverge round found ~6 new High there. This is the single biggest argument for not stopping at Wave C.
3. **Honest limits:** no browser/Lighthouse/live-DB/real-OAuth run — all visual/CWV/contrast/runtime-egress claims are code-inferred and labelled estimative. The one residual UNSEEN surface (`public/service-worker.js` offline-navigation cache-poisoning) is declared, not silently skipped. A duplicate Wave-A re-run (args mis-routing) was kept as a second adversarial pass rather than discarded.

---

## Remediation sprint plan (gated: gates green AND committed = done)

> Per-task done-gate: `npm run preflight` + the relevant CI gate green, machine-checkable acceptance verified, a regression test added, **and the change committed**. Model routing: **H**=Haiku (mechanical), **S**=Sonnet (most logic/refactor), **O**=Opus (architecture/security judgment). Human-only sprint for legal/asset/account decisions.

**S0 — Unblock CI + stop active leaks (do first).**

- `[A-H09]` delete the unused `PROJECT_STATS` import in `UserManual.jsx:6` → lint green, `test`+`red-team` jobs run again. Acceptance: `npm run lint` exit 0. Model H.
- `[A-H04]+[D-M09]` fix `scrubPII` egress: `.scrubbedText` + `{aggressive:true}` (or a `scrubText` helper) at all 3 FormSubmit call sites; make bare-SSN/VA-file always-on. Acceptance: a test asserting a bare 9-digit SSN is redacted in the outbound payload. Model S.
- `[A-H05]+[A-H06]` add VA-key/opaque-token heuristic to `check-dist-secrets.mjs` + append `&& npm run check:dist-secrets` to the `build` script. Acceptance: build fails on a planted VA-shaped token in dist. Model S.

**S1 — Trust-critical truth + crisis safety (existential / life-safety).**

- `[A-H10]/[D-H04]` add a `t()` resolver to `sync-legal-pages.js` + CI assert no `{t(` in generated HTML; regenerate. Model S.
- `[A-H11]/[D-H03]` correct README + `faq.html` "no analytics" → accurate GoatCounter language. Model H.
- `[C-C01]` move crisis-modal severity messages into `t()` (es/tl/vi/ko). · `[C-H09]` add Dari/Pashto `crisis_keywords`. Acceptance: a Spanish + a Pashto crisis string trigger the interceptor with a localized message. Model S (safety → review).
- `[D-H09]` route BlueButton conditions through `validateConditions` or flag "unverified". Model S.

**S2 — Security headers + cloud backup correctness.**

- `[D-H08]/[D-H13]` add CSP (+`frame-ancestors`) + `[D-M15]` HSTS to both `render.yaml` blocks; `[D-M16]` drop `X-XSS-Protection`; `[D-H14]` delete `vision-test.html`. Acceptance: Playwright header test asserts CSP+HSTS on `/` and `/privacy-policy.html`. Model S.
- `[D-H10]+[D-H11]+[D-H12]` fix double-encryption, add the 4 cloud origins to `connect-src`, add the popup null-guard. Acceptance: a round-trip backup/restore test + a CSP-vs-fetch-URL audit test. Model S.

**S3 — PHI-at-rest + AI-pipeline wiring.**

- `[A-H08]+[A-M05]+[Ab-H01]` encrypt the primary profile/ratings store + auto-backup via the existing passphrase keystore; fix the `EMPTY_CHUNK_RESULT` singleton (spread-clone). Model O (crypto/state) → S impl.
- `[A-H01]/[A-H02]/[A-H03]` route C-file + muster paths through `runDualLLM` (or delete the unused exports + document) and escape the spotlight delimiter. · `[Ab-H02]` pass `loadedRegulations` (or validate against the bundled CFR index). · `[Ab-H03]` fix the legal-citation index mapping. · `[C-H05]` surface Gemini `finishReason`/`blockReason`. · `[C-H06]` wire `aiAuditLog`. Acceptance: production-wiring integration tests per path. Model S.

**S4 — Rating correctness + perf + a11y.**

- `[A-H07]+[A-M06]+[A-M07]` single-source the §4.26 combined-rating path (Scout→`calculateVARating`); retire the divergent engines. Acceptance: parity test incl. bilateral. Model S.
- `[B-H07]/[B-H08]/[B-H09]` lazy-load AIAssistant; per-locale translations; fetch `disabilityData.json`. Then `[B-M14]/[B-M15]` enable `STRICT_BUNDLE` + `lighthouserc.mjs`. Model S.
- `[B-H02]/[B-H03]/[B-H04]/[B-H05]` AI live-region + send-button label + SearchBar listbox + Header focusout. · `[C-H07]` RTL plugin for nav/modal. Acceptance: axe gate + a keyboard E2E. Model S.

**S5 — Supply chain + gates + ETL integrity.**

- `[A-M08]/[A-M09]/[D-M08]` SHA-pin all actions (`pinact`) + GoatCounter SRI. · `[A-M12]/[C-H02]` add osv-scanner + RAG-eval to ci.yml. · `[D-M04]` make `red-team` a required check. · `[C-H01]/[C-H03]/[C-M02]` add coverage-floor/staleness/row-count gates to the ETL. · `[C-H04]` fix pdfjs CDN version. · `[D-M18..D-M20]` Python scraper hardening. Model S (mostly mechanical → some H).

**Human-only sprint (owner / counsel — `needs-decision`).**

- `[B-H01]/[D-H05]` decide license (proprietary vs AGPL) and align all 4 declarations. · `[D-H01]` decide: publish real models or correct marketing. · `[D-H06]/[D-H07]` real security contact + deploy `security.txt`. · `[L-watch]` UPL review of claim-language generation + confirm `DraftWatermark` is unconditional. · `[D-M01]` GDPR legal-basis record. · rotate the local-dev `.env`/`.env.local` keys as hygiene.

---

## Lessons-learned log (appended to toolkit guides)

For every Critical/High + FALSE-PRIOR-CLAIM, the distilled lesson (symptom → why it recurred → the check that catches it next time) is appended to `E:\VS_Studio\best-practices-toolkit\docs\best-practices\*-lessons-learned.md` (VETRATE- cohort). Headline recurring pattern: **"the primitive exists, passes its isolated unit test, and is marked DONE — but the gate never fires in the real path."** Catch-next-time checks: production-wiring integration tests (not primitive-only); generated-artifact content assertions (not mtime); `needs:`-chained required CI gates (not "blocking" comments); marketing-claim-to-code 1:1 audits in CI.

---

## Master Check Registry status (summary)

Every dimension A–Z accounted (Covered / Finding / N-A). **N/A (out of surface scope, justified):** server-side authz/role-matrix, payments/PCI, server SLO burn-rate, health-endpoint probes, native-mobile W (web PWA only), CLI X (build scripts audited under K/U), DORA/A-B/chaos (single-dev, documented). **Heaviest coverage:** V (AI-safety), M/O (supply-chain/secrets), J/N (legal/license), B (XSS/egress), C/Q (crypto/concurrency), F (a11y), S (i18n). **Every gate** (preflight/push-prep/CI/release/periodic) exercised in Phase 0.5 + the YZ/U lanes.

## Coverage attestation

- **Surfaces:** ~85 recon-critical (rolled into ~33 ledger rows + per-lane expansions); **all dimension lanes A–Z run**, plus 4 reconverge gap-finders.
- **Findings (post-verify, deduped):** **1 Critical · ~40 High · ~55 Medium · ~40 Low/Info.** ~40 candidates killed by the 3-skeptic vote.
- **Passes to convergence:** 4 waves + 1 critic + 1 reconverge round; critic returned NOT-CONVERGED→ reconverge closed the named gaps.
- **Could NOT be verified (next auditor starts here):** (1) `public/service-worker.js` offline-navigation cache-poisoning of the app shell (critic-named, not gap-audited); (2) anything needing a live browser/Lighthouse/NVDA/throttled-mobile run — all CWV/contrast/visual/runtime-egress claims are code-inferred/estimative; (3) live OAuth round-trips (Dropbox/OneDrive); (4) whether the Render dashboard `VITE_VA_*` values are currently populated (the bundle-bake fires only if they are); (5) branch-protection required-checks config (GitHub UI, not in repo).
- **Wave B:** J+N (legal/marketing-truth + licensing) · E+F (UX + WCAG 2.2) · G+H (brand/affiliation-palettes + SEO) · I (bundle/CWV perf).
- **Wave C:** U (RAG/ETL pipeline) · T (transformers/web-llm/jspdf/pdfjs SDK stability) · D+R (reliability/observability) · S (i18n).
- **Wave D:** L (business/SWOT/funnel) · Y+Z (methodology) + completeness critic + loop-until-dry + final synthesis (exec summary, scorecard, sprint plan, attestation, lessons log).
