# Risk Register

> Living register of operational, security, and product risks the project is carrying. Reviewed at each sprint close. Closes finding #40 in [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md).
>
> **Status:** non-binding. Authoritative legal / compliance posture is in [COMPLIANCE_STRATEGY.md](./COMPLIANCE_STRATEGY.md). Authoritative threat model is in [THREAT_MODEL.md](./THREAT_MODEL.md). This file lists the *open exposures we have decided to live with*, why we accept them, and what would force a re-evaluation.

**Last reviewed:** 2026-05-15

---

## How to read this register

Each row is an explicit risk we accept (or partially accept) — not a bug, not a TODO, not a missing feature. A row exists because someone could reasonably ask *"why haven't you done X?"* and the answer is a deliberate trade-off, not an oversight.

| Field | Meaning |
|---|---|
| **Likelihood** | low / med / high — how often the risk materializes under normal operation |
| **Impact** | low / med / high — blast radius if it does |
| **Posture** | `accept` / `mitigate` / `transfer` / `avoid` |
| **Owner** | who reviews this row each sprint close |
| **Trigger to re-open** | the condition that forces a fresh decision |

Severity is *not* the product of likelihood × impact — it's a judgement call that also considers reputational and legal blast radius.

---

## Open risks

### R-01 — User loses their decryption passphrase

| | |
|---|---|
| **Description** | Veteran sets a passphrase on an encrypted cloud backup, forgets it, has no recovery. Backup is unrecoverable. |
| **Likelihood** | med (passphrases are forgotten; we cannot recover them by design) |
| **Impact** | high (loss of case file → potentially loss of claim history, evidence, narrative work) |
| **Severity** | high |
| **Posture** | accept + mitigate |
| **Mitigation** | Random-key path (no passphrase) is the default; key is stored locally on-device via `storeLocalKey`. Passphrase is opt-in for users who want "encrypted even if my device is also stolen" semantics. UX warns explicitly that passphrase loss is unrecoverable. |
| **Owner** | engineering |
| **Trigger to re-open** | We see a non-trivial fraction of support requests asking for passphrase recovery. Today the volume is zero because adoption is small. |

### R-02 — Cloud provider account compromise reveals encrypted backups

| | |
|---|---|
| **Description** | An attacker compromises a veteran's Google Drive / Dropbox / OneDrive account and exfiltrates the encrypted `.enc.json` backups. |
| **Likelihood** | low per veteran, but **non-zero across the user base** |
| **Impact** | low → med — the data is AES-256-GCM encrypted at 600k PBKDF2 iterations. Plaintext recovery requires either the user's passphrase (passphrase backups) or the user's device (random-key backups). |
| **Severity** | med |
| **Posture** | accept |
| **Mitigation** | [CRYPTO_AUDIT.md](./CRYPTO_AUDIT.md). Random per-ciphertext salts; 600k PBKDF2-SHA256. Public crypto audit doc. |
| **Owner** | engineering |
| **Trigger to re-open** | OWASP raises the PBKDF2 floor above 600k, a practical attack against PBKDF2-SHA256 below 600k is published, or we add a server-side data plane. |

### R-03 — Prompt injection escapes the dual-LLM split

| | |
|---|---|
| **Description** | A malicious OCR'd document, pasted text, or fetched legal source contains instructions that the privileged controller LLM acts on (lethal-trifecta breach). |
| **Likelihood** | med — adversarial OCR/PDF content is a real attack surface |
| **Impact** | high — could exfiltrate user data, alter outputs, or instruct the user toward fraudulent claim behavior |
| **Severity** | high |
| **Posture** | mitigate |
| **Mitigation** | Dual-LLM ([src/utils/dualLLM.js](../src/utils/dualLLM.js)) splits controller / worker; spotlight delimiters on untrusted content; URL allow-list ([src/utils/sanitize.js](../src/utils/sanitize.js) `sanitizeUrl`); red-team suite of 44 cases ([src/__tests__/red-team/](../src/__tests__/red-team/)); OWASP LLM Top 10 mapping in [THREAT_MODEL.md §6](./THREAT_MODEL.md). |
| **Owner** | AI/security |
| **Trigger to re-open** | Any red-team case that the suite currently passes regresses; a published OWASP LLM advisory we haven't mapped; a partner audit finds a bypass. |

### R-04 — VA-API integration re-enables and ships private VHA data off-device

| | |
|---|---|
| **Description** | The VA-API surface is currently feature-flagged off ([src/config/vaAuth.js](../src/config/vaAuth.js)). If it re-enables in production without a fresh threat-model pass, veterans' VA data could leave the device. |
| **Likelihood** | low — flag has been off since project inception; flipping it is a deliberate, code-reviewed change |
| **Impact** | high — would change our compliance posture (HIPAA, VA data-handling guidance both in-scope) |
| **Severity** | high |
| **Posture** | avoid (today) → mitigate (if re-enabled) |
| **Mitigation** | Feature flag default-safe. [COMPLIANCE_STRATEGY.md](./COMPLIANCE_STRATEGY.md) explicitly lists VA-API re-enablement as a re-evaluation trigger. |
| **Owner** | product + legal |
| **Trigger to re-open** | Anyone proposes flipping `VITE_VA_API_ENABLED` or similar to true in a production deploy. |

### R-05 — Browser extension with full IDB access rewrites the AI audit log

| | |
|---|---|
| **Description** | A malicious browser extension installed in the veteran's profile has full read/write access to IndexedDB. It can rewrite the entire hash-chained audit log end-to-end (no signing key, so chain self-consistency is reproducible by anyone). |
| **Likelihood** | low (deliberate extension install with that permission scope) |
| **Impact** | med — undermines the audit log's tamper-evidence guarantee for the affected user only |
| **Severity** | low |
| **Posture** | accept |
| **Mitigation** | Documented explicitly in [src/utils/aiAuditLog.js](../src/utils/aiAuditLog.js) header. Audit log is "tamper-*evident*", not "tamper-*proof*". |
| **Owner** | engineering |
| **Trigger to re-open** | A path to a per-user signing key without losing zero-knowledge becomes available (WebAuthn-derived? hardware-attested?). |

### R-06 — Static admin-PIN hash is brute-forceable

| | |
|---|---|
| **Description** | Admin PIN hashes are bundled into the JS at build time, hashed with a single SHA-256 pass and a static text salt. 6-digit PINs are exhaustively brute-forceable in milliseconds against the bundled hash. |
| **Likelihood** | high (anyone with the bundle can do this) |
| **Impact** | low — admin surface gates UI, not data. Veteran data is protected by the per-user crypto layer, not by the admin gate. |
| **Severity** | low |
| **Posture** | accept |
| **Mitigation** | [CRYPTO_AUDIT.md §5](./CRYPTO_AUDIT.md). Explicit comment in the source code clarifies this is a UX gate, not a credential boundary. |
| **Owner** | engineering |
| **Trigger to re-open** | The admin surface gains real authentication semantics (server-side auth, multi-admin, audit trails). |

### R-07 — Supply-chain advisory lands between Dependabot runs

| | |
|---|---|
| **Description** | A critical CVE in a transitive dependency is published mid-week. Dependabot runs weekly; we could be exposed for up to 7 days. |
| **Likelihood** | med (CVEs happen) |
| **Impact** | varies (low → critical depending on the package and our exposure) |
| **Severity** | med |
| **Posture** | mitigate |
| **Mitigation** | CI `npm audit --omit=dev --audit-level=high` runs on every PR ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) — a fresh CVE on `main` shows up in the next PR. Preflight gate at [scripts/preflight.js](../scripts/preflight.js) `STRICT_AUDIT=true` (default). `overrides` mechanism in [package.json](../package.json) lets us pin a transitive subdependency without waiting for the parent upgrade. |
| **Owner** | engineering |
| **Trigger to re-open** | A CVE goes >24 hours unpatched on `main`, or a CVE breaks production. |

### R-08 — LLM provider deprecates the model behind a feature

| | |
|---|---|
| **Description** | Gemini / Anthropic / OpenAI sunsets a model we depend on (e.g., the Gemini 2.5 Flash usage for the dual-LLM worker). |
| **Likelihood** | high on a 12-month horizon (model sunsets are routine) |
| **Impact** | med — temporary degradation while we cut over |
| **Severity** | med |
| **Posture** | mitigate |
| **Mitigation** | Model IDs are centralized at [src/utils/unifiedAIService.js](../src/utils/unifiedAIService.js) (single point of change). Knowledge-sources registry at [knowledge-sources.yaml](../knowledge-sources.yaml) tracks the LLM-backed surfaces. Standing TODO on each Anthropic/Google sunset cycle is "re-test cost projections + cut model IDs". |
| **Owner** | AI/eng |
| **Trigger to re-open** | A sunset notice for a model currently in use. |

### R-09 — Legal-ingestion pipeline produces stale or wrong citations

| | |
|---|---|
| **Description** | The eCFR / M21-1 / CAVC fetchers go stale (source changes URL structure, or the cron silently fails) and the SPA serves citations that are out of date. |
| **Likelihood** | med — government endpoints have changed before (eCFR did during S6) |
| **Impact** | med — outdated citations are an accuracy regression; could mislead a user in an active claim |
| **Severity** | med |
| **Posture** | mitigate |
| **Mitigation** | Weekly cron at [.github/workflows/legal-ingestion.yml](../.github/workflows/legal-ingestion.yml) opens a PR on a diff, files a `legal-ingestion-stale` issue on failure. Each ingested source carries `fetched_at` in the manifest and surfaces it on every citation badge ([src/components/LegalCitation.jsx](../src/components/LegalCitation.jsx)). |
| **Owner** | AI/eng |
| **Trigger to re-open** | Two consecutive cron failures, or a user reports a citation that's stale relative to the published source. |

### R-10 — Zero-knowledge stance prevents server-side debugging

| | |
|---|---|
| **Description** | We have ~1,215 `console.log` calls in `src/` but no centralized telemetry, no Sentry, no structured logs. By design — adding server-side telemetry would conflict with the zero-knowledge stance. When a bug surfaces in production, we have no way to reproduce it without the user's cooperation. |
| **Likelihood** | high (some fraction of bugs will go this way) |
| **Impact** | low — slows triage; doesn't break the product |
| **Severity** | low |
| **Posture** | accept |
| **Mitigation** | Tracked as finding #38. The deferred-Batch-18 wrapped-logger work will at least normalize the log format so an opt-in local export can be useful. We will **not** add server-side telemetry without an explicit re-evaluation of the zero-knowledge posture. |
| **Owner** | engineering |
| **Trigger to re-open** | We receive an external grant or partner contract that obligates production observability. |

### R-11 — App.jsx monolith creates regression risk on any change

| | |
|---|---|
| **Description** | [src/App.jsx](../src/App.jsx) is 3,913 lines, 181 KB, 93 useState hooks. Any change to global routing, modals, or top-level state risks unintended interaction with unrelated features. |
| **Likelihood** | high on any non-trivial change |
| **Impact** | med — bugs surface in code review or QA, but the surface area to review is large |
| **Severity** | med |
| **Posture** | mitigate → resolving in Batch 21 |
| **Mitigation** | Vitest coverage on the components App.jsx renders; e2e Playwright suite. **Active work:** Batch 21 in the S8 follow-up plan splits App.jsx into feature regions. |
| **Owner** | engineering |
| **Trigger to re-open** | A regression ships to production that a sharper boundary would have caught. |

---

## Closed risks (kept for institutional memory)

| ID | Description | Closed | Closing event |
|---|---|---|---|
| R-C1 | Unfixed npm audit advisories (1 critical RCE + 5 high) | 2026-05-15 | npm `overrides` pinned `protobufjs ^7.5.6` and `@xmldom/xmldom ^0.8.13`. `npm audit --omit=dev` clean. (S8) |
| R-C2 | No SBOM on releases | 2026-05-15 | Release workflow generates CycloneDX + SPDX SBOMs on every tag. (S8) |
| R-C3 | SAST runs but doesn't block | 2026-05-15 | CI flipped to `node scripts/sast-check.mjs --strict`. (S8) |
| R-C4 | No threat model | 2026-04 | [THREAT_MODEL.md](./THREAT_MODEL.md) shipped in S3. |
| R-C5 | DOMPurify noop shim shipped without safe-html alternative on every sink | 2026-04 | Per-site `safeHtml` defenses; 4 `dangerouslySetInnerHTML` sites reviewed. (S3) |
| R-C6 | PBKDF2 at 100k iterations | 2026-05-15 | Bumped to 600k in both crypto layers with versioned envelopes. (S8 / [CRYPTO_AUDIT.md](./CRYPTO_AUDIT.md)) |
| R-C7 | cloudSync.js used a static project-wide salt | 2026-05-15 | Replaced with magic-byte envelope carrying per-encryption random salt + IV. (S8 / [CRYPTO_AUDIT.md](./CRYPTO_AUDIT.md)) |

---

## Sprint-close review checklist

At each sprint close, for every open row:

1. Has likelihood, impact, or severity changed?
2. Has the trigger to re-open fired?
3. Is the mitigation still in place (run the linked code / config / workflow to verify)?
4. Is there a new closed-risk row to file?

If a row is unchanged for 3 consecutive sprint reviews, consider whether it's still genuinely a risk or whether it's become a known operating characteristic (move to a separate "accepted operating characteristics" list).

---

## Adding a new risk

A new row belongs here when **all of these** are true:

- It's a deliberate trade-off, not a bug.
- It has measurable likelihood and non-zero impact.
- A reasonable outside reviewer might ask "why haven't you addressed this?".
- The answer doesn't fit in a code comment.

If the issue is a bug or unimplemented feature, file it in the issue tracker, not here. If it's a compliance posture, put it in [COMPLIANCE_STRATEGY.md](./COMPLIANCE_STRATEGY.md). If it's a threat-model element, put it in [THREAT_MODEL.md](./THREAT_MODEL.md).

---

*Owner: Anthony Johnson. Last reviewed 2026-05-15. Sprint cadence: review at each sprint close (currently end-of-S8).*
