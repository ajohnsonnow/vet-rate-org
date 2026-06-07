# S16 Worklist — local-first security residuals (piiScrubber + lhci portion)

> Cycle S9–S17, Sprint 16 ([SPRINT_PLAN_S9-S17.md](../SPRINT_PLAN_S9-S17.md), row S16).
> Status: **partial — piiScrubber + lhci complete** (commits `dcd2d5b`, `e21d876`,
> `d3f449b`, plus this docs commit). **Key-rotation + device-deauthorization remain
> owner-gated** and are intentionally not started (see *Honest limits*).
> Branch `audit/s9-mobile-safety-net`, local commits only — no push/PR until the
> owner authorizes (standing instruction).

## Goal (S16 Definition of Done)

> Implement **key-rotation + device-deauthorization** on local-first storage;
> resolve the `piiScrubber` "3 TODOs" with red-team cases; formalize lhci sign-off.
> **DoD:** rotation + deauth implemented + tested; piiScrubber TODOs closed;
> scoreboard updated.

This commit closes the **piiScrubber** and **lhci** portions of the DoD. The
rotation/deauth portion is deliberately paused at a design gate — writing
zero-knowledge crypto without the owner's threat-model and device-identity
decisions would be guessing at a security boundary, which the standing
zero-knowledge constraints forbid. See *Honest limits*.

## Baseline (before S16)

- **The "piiScrubber 3 TODOs" were never literal `// TODO` comments.** Git history
  carries no such markers in [src/utils/piiScrubber.js](../../src/utils/piiScrubber.js).
  They were three audit-noted **obfuscation edge cases** — ways an adversarial input
  could carry PII past a pure-regex firewall:
  1. **zero-width / soft-hyphen splice** — `1​2​3-45-6789` defeats `\d{3}-\d{2}-\d{4}`;
  2. **full-width / fancy-unicode digits** — `１２３…` are not matched by JS `\d` (ASCII-only);
  3. **NBSP / non-standard separators** — a non-breaking space inside `VA file C 12345678`.
- **`piiScrubber` scanned the raw string** — `scrubPII` ran its regexes directly on
  input, so any of the three vectors above slipped through unchanged.
- **`legalAnswerer` had a leaky scrub path** — the RAG query was scrubbed for
  retrieval but the **unscrubbed** question was still interpolated into the
  synthesizer prompt, so PII the user typed could reach the LLM egress boundary.
- **lhci had no strict SEO floor** — [lighthouserc.json](../../lighthouserc.json)
  asserted `categories:seo` only at **warn**, even though S15 proved the SEO score
  deterministic (1.00 over 3 runs, server-state independent). The gate could not
  fail CI on an SEO regression.
- **No red-team coverage for the obfuscation vectors** — the red-team harness
  ([src/__tests__/red-team/](../../src/__tests__/red-team/)) tested injection/refusal
  but had no PII-trap cases exercising zero-width-spliced, full-width, or NBSP PII.

## What changed

### 1. NFKC-normalize before the PII scan + fix the leaky `legalAnswerer` scrub (commit `dcd2d5b`)

| File | Change | Why |
|---|---|---|
| [src/utils/piiScrubber.js](../../src/utils/piiScrubber.js) | New `INVISIBLE_CHARS` (strips zero-width U+200B–U+200D, word-joiner U+2060, BOM/ZWNBSP U+FEFF, and soft-hyphen U+00AD) and `normalizeForScan(text)` — strip invisible separators, then `.normalize("NFKC")`; applied at the top of `scrubPII` (`let scrubbed = normalizeForScan(text)`) before any regex runs | Folds all three obfuscation vectors to ASCII **before** the patterns see the text: zero-width/soft-hyphen splices are removed, full-width digits NFKC-fold to `[0-9]`, NBSP folds to a normal space. Two O(n) passes; NFKC is identity on plain ASCII, so existing matches are unaffected. |
| [src/services/legalAnswerer.js](../../src/services/legalAnswerer.js) | Scrub the question once into `cleanQuery` (`scrubPII(question ?? "", { aggressive: true }).scrubbedText`) and use it for **both** `retrieve(cleanQuery, …)` and the synthesizer `user_question` | Closes the egress leak — the synthesizer prompt no longer interpolates the raw, unscrubbed question, so user-typed PII can't reach the LLM boundary. |

### 2. Harden the red-team PII traps (commit `e21d876`)

| File | Change | Why |
|---|---|---|
| [src/__tests__/red-team/injectionPayloads.js](../../src/__tests__/red-team/injectionPayloads.js) | `PII_TRAPS` array of 5 adversarial inputs: zero-width-obfuscated `SSN` label, bare 9-digit form, NBSP-separated `VA file C 12345678`, zero-width-spliced digits `1​2​3-45-6789`, and full-width digits `１…９` | Concrete regression fixtures, one per obfuscation vector, plus the bare-9-digit aggressive case. |
| [src/__tests__/red-team/redTeam.test.js](../../src/__tests__/red-team/redTeam.test.js) | New "Red team — PII traps" block: for each payload, assert `scrubPII(payload, { aggressive: true })` sets `piiFound === true` and the `scrubbedText` matches neither `/\d{3}-\d{2}-\d{4}/` nor `/\d{9}/` | Proves the normalization actually neutralizes each vector end-to-end, not just that `normalizeForScan` exists. |

### 3. Promote the lhci SEO budget warn → error (commit `d3f449b`)

| File | Change | Why |
|---|---|---|
| [lighthouserc.json](../../lighthouserc.json) | `categories:seo` → `["error", { "minScore": 0.9 }]`; LCP / TBT / `categories:performance` held at **warn** | Follows the established informational → strict ratchet. SEO is server-state-independent and proved stable (S15: 1.00 ×3), so it can gate hard now. The perf metrics stay informational because **no real CI throttled-mobile baseline exists yet** — this branch is local-only and the CI Lighthouse job has never run (see *Honest limits*). |

### 4. Documentation + scoreboard (this commit)

| File | Change | Why |
|---|---|---|
| [docs/AUDIT_FINDINGS.md](../AUDIT_FINDINGS.md) | Mark the piiScrubber edge cases closed (normalizeForScan + 5 `PII_TRAPS`); record lhci residual (SEO error, LCP/TBT/perf warn); note rotation/deauth + Web-Crypto audit still open (owner-gated) | Keep the findings ledger truthful about what S16 closed vs. what remains. |
| [docs/THREAT_MODEL.md](../THREAT_MODEL.md) | §7 issue #6 rewritten to "Hardened (S16)" with the normalization detail and the explicit caveat that it stays regex-based/best-effort (dual-LLM isolation §5 is the backstop); "Last review" bumped to 2026-06-06 | The model must reflect the new control and its honest limit. |
| [docs/SPRINT_PLAN_S9-S17.md](../SPRINT_PLAN_S9-S17.md) | Progress Log entry dated 2026-06-06 for the S16 piiScrubber + lhci portion, noting rotation/deauth paused at the owner gate | Sprint-plan ledger of record. |
| [docs/audit/S16_WORKLIST.md](S16_WORKLIST.md) | This file | Evidence doc for the sprint. |

## Verification

| Gate | Result |
|---|---|
| `npm run lint` | **0 errors / 2721 warnings** (exit 0) — unchanged from the S15 baseline; the 2 warnings of note remain the known `gc` `no-undef` worker false-positives (`florence-ocr-worker.js`, `smolvlm-worker.js`). |
| `npm run type-check` (`tsc --noEmit`) | **clean** (exit 0). |
| `npm run test` (vitest) | **813 passed / 47 files** (exit 0) — up from the S15 baseline of 809; the +4 are the new PII-trap assertions. |
| `npm run test:red-team` | **48 passed / 1 file** (exit 0) — includes the new "Red team — PII traps" cases: each payload sets `piiFound === true` and the `scrubbedText` matches neither `/\d{3}-\d{2}-\d{4}/` nor `/\d{9}/`. |

## Honest limits / out of scope

- **Key-rotation + device-deauthorization are NOT implemented in this commit.** They
  are the larger half of the S16 DoD and are deliberately **paused at a design gate**.
  The local-first crypto surface has two divergent stacks
  ([src/utils/cloudEncryption.js](../../src/utils/cloudEncryption.js) AAD
  `vetrate.cloud-encryption.v3`, [src/services/cloudSync.js](../../src/services/cloudSync.js)
  AAD `vetrate.cloud-sync.v3` with a hardcoded-key fallback), backup keys sit
  **unwrapped** in plaintext `localStorage`, and there is **no device identity, KEK,
  or `wrapKey`/`unwrapKey`** anywhere. Designing rotation/deauth on top of that
  requires owner decisions on the threat model and device-identity scope; writing the
  crypto first would be guessing at a security boundary, which the zero-knowledge
  constraints forbid. Deferred to owner-gated follow-up commits.
- **lhci LCP / TBT / `categories:performance` stay at `warn`, not `error`.** Promotion
  needs a trustworthy CI throttled-mobile baseline, and one does not exist: this
  branch is local-only / never pushed, so the CI Lighthouse job has **never run**, and
  the local lhci perf numbers are unreliable (S15 documented a ~30s LCP artifact from
  a `startServerReadyPattern` timeout on an alternate port). Only **SEO** — which is
  deterministic and server-state-independent — is promoted to a hard gate. The perf
  budgets ratchet to `error` only once a real CI baseline lands.
- **`piiScrubber` remains regex-based and best-effort by design.** `normalizeForScan`
  closes the three known obfuscation vectors, but novel obfuscation outside the
  normalization set (new unicode separators, homoglyph digits, semantic leaks) can
  still slip past. The **dual-LLM extractor/synthesizer isolation** in `legalAnswerer`
  (THREAT_MODEL §5) stays the backstop — the scrubber is a firewall, not a proof.
- **The red-team PII traps are unit-level**, exercising `scrubPII` directly. They do
  not run a live LLM; full adversarial coverage (Promptfoo / PyRIT against a real
  model) stays in the S9–S17 backlog as out-of-scope.
