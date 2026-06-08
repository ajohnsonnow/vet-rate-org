# S16 Worklist — local-first security residuals (piiScrubber + lhci portion)

> Cycle S9–S17, Sprint 16 ([SPRINT_PLAN_S9-S17.md](../SPRINT_PLAN_S9-S17.md), row S16).
> Status: **piiScrubber + lhci complete** (commits `dcd2d5b`, `e21d876`, `d3f449b`,
> `d07a420`). **Owner approved all design picks 2026-06-06** ([S16_ROTATION_DEAUTH_DESIGN.md](S16_ROTATION_DEAUTH_DESIGN.md) §6):
> commit **E** (`3038cf6`) shipped the crypto safety net; commit **F** ships the
> at-rest device-passphrase keystore (this section, *Commit F* below). **Commit G —
> deauth UI + cloudSync default-key retirement — remains** (see *Honest limits*).
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

## Commit F — at-rest device-passphrase keystore (2026-06-06)

Implements the **at-rest key-protection** half of the owner-approved design
([S16_ROTATION_DEAUTH_DESIGN.md](S16_ROTATION_DEAUTH_DESIGN.md) §4, commit F in §8).
Custody only — the `VR_ENC_V3`/`VS3` wire format and all 10 AAD test pins are untouched.

| File | Change | Why |
|---|---|---|
| [src/utils/cloudEncryption.js](../../src/utils/cloudEncryption.js) | New opt-in keystore: `deriveKEK` (PBKDF2-SHA256 600k → non-extractable **AES-KW** key), `enableDevicePassphrase`/`unlockDeviceKeystore`/`lockDeviceKeystore`/`rotateDevicePassphrase`/`wipeLocalKeystore`/`completePendingRotation` + `isDevicePassphraseEnabled`/`isKeystoreUnlocked`/`listBackupKeyIds`. `storeLocalKey`/`getLocalKey` wrap/unwrap the per-backup DEK under the session KEK (`vet_rate_wrapped_key_*`), with lazy crash-safe migration of legacy plaintext (wrap → verify → then delete). | Removes the raw DEK from plaintext `localStorage`. AES-KW's RFC 3394 integrity check makes a wrong-KEK unwrap throw — reused as the passphrase verifier (`vet_rate_kek_verifier`). Rotation is all-or-nothing via a temp-slot + commit-marker journal; `completePendingRotation` forward-recovers an interruption. |
| [src/components/MultiCloudManager.jsx](../../src/components/MultiCloudManager.jsx), [src/utils/multiCloudStorage.js](../../src/utils/multiCloudStorage.js) | `await` added to all 6 `storeLocalKey`/`getLocalKey` call sites. | `storeLocalKey`/`getLocalKey` are now async (see *correction* below); every call site was already inside an async function, so the change is mechanical. |
| [src/utils/debugDump.js](../../src/utils/debugDump.js) | `createDebugDump` redacts the value of `vet_rate_backup_key_*`, `vet_rate_wrapped_key_*`, `vet_rate_kek_*`, `vet_rate_rotating_key_*`, and `vetrate_gemini_key` to `"[REDACTED]"` (key name + real size still reported). | Closes the one-click full-localStorage egress for wrapped keys, KEK salt/verifier, and the third-party Gemini key. |
| [src/__tests__/utils/cloudKeystore.test.js](../../src/__tests__/utils/cloudKeystore.test.js), [src/__tests__/utils/debugDumpRedaction.test.js](../../src/__tests__/utils/debugDumpRedaction.test.js) | 10 new cases: KEK roundtrip, wrong-passphrase reject, enable-migrates-plaintext, legacy passthrough when disabled, lazy migrate (verify-then-delete), locked-store write refusal, rotation all-or-nothing, **interrupted-rotation forward recovery** (fault-injected phase-2 crash), `wipeLocalKeystore`, and debugDump redaction. | Proves the crash-safety and custody invariants end-to-end, not just that the functions exist. |
| [docs/CRYPTO_AUDIT.md](../CRYPTO_AUDIT.md) | New §2 inventory row for the AES-KW keystore; §7 AES-KW bullet marked **shipped (commit F)**; status + footer updated. | Re-audit trigger: a new `crypto.subtle.*` (AES-KW `deriveKey`/`wrapKey`/`unwrapKey`) call site must be catalogued. |

**Correction to the approved design (§4/§5 "synchronous" claim).** The design doc
argued that keeping the keystore in `localStorage` lets `getLocalKey`/`storeLocalKey`
stay **synchronous**, avoiding a sync→async rewrite of the 6 call sites. That benefit
is **not achievable**: Web Crypto `unwrapKey` is inherently async, so the wrapped read
path forces `getLocalKey` async regardless of the storage backend. The functions are
now async and the 6 call sites take `await`. The *real* (still-valid) reason to stay in
`localStorage` over IndexedDB holds: no eviction risk, `AtomicWipe` already clears it,
and no `navigator.storage.persist()` is needed. The call sites were already inside async
functions, so the rewrite is mechanical and behavior-preserving. The design doc's §4/§5
carry an inline correction note pointing here.

## Verification

| Gate | Result |
|---|---|
| `npm run lint` | **0 errors / 2721 warnings** (exit 0) — unchanged from the S15 baseline; the 2 warnings of note remain the known `gc` `no-undef` worker false-positives (`florence-ocr-worker.js`, `smolvlm-worker.js`). |
| `npm run type-check` (`tsc --noEmit`) | **clean** (exit 0). |
| `npm run test` (vitest) | **813 passed / 47 files** (exit 0) — up from the S15 baseline of 809; the +4 are the new PII-trap assertions. |
| `npm run test:red-team` | **48 passed / 1 file** (exit 0) — includes the new "Red team — PII traps" cases: each payload sets `piiFound === true` and the `scrubbedText` matches neither `/\d{3}-\d{2}-\d{4}/` nor `/\d{9}/`. |

## Honest limits / out of scope

- **The at-rest wrap + local rotation are implemented (commit F); the deauth UI +
  cloudSync fallback retirement are NOT (commit G).** Owner decisions landed
  2026-06-06, unblocking the gate. Commit F adds the passphrase-anchored AES-KW
  keystore, `wrapKey`/`unwrapKey`, and `rotateDevicePassphrase`/`wipeLocalKeystore`
  primitives in [src/utils/cloudEncryption.js](../../src/utils/cloudEncryption.js)
  (see *Commit F* above). Still open for **commit G**: the user-facing "Change backup
  passphrase" / "Deauthorize this device" flow (typed-confirm + per-backup warning),
  the self-deauth orchestrator that calls `wipeLocalKeystore`, and retiring the
  `cloudSync` `vet-rate-default-key`/email fallback (Q-LEGACY-DRIVE: forbid new writes,
  keep last-resort decrypt). Rotation is also **not retroactive** and there is **no
  device identity / multi-device** in this cut (Q-DEVICE-SCOPE: single-device +
  passphrase portability) — both honest limits that hold by design.
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

## Commit F — adversarial review outcome + Commit G gate (2026-06-07)

A 28-agent adversarial crypto review of the commit E/F keystore
([cloudEncryption.js](../../src/utils/cloudEncryption.js)) returned **4 confirmed
findings + 3 completeness gaps** (3 candidate findings were refuted). Every
confirmed finding is **real but latent**: the keystore lifecycle
(`enableDevicePassphrase`/`unlockDeviceKeystore`/`rotateDevicePassphrase`/
`wipeLocalKeystore`) is **shipped in commit F but wired into no component yet**
(grep-verified: only referenced from `cloudEncryption.js`, its tests, and docs).
So these are *fix-before-G-wires-the-UI* hardenings, not live production bugs — the
data layer is hardened first so commit G's UI lands on a safe base.

A follow-up **residual-verification workflow** then re-audited the first-pass fixes
and found three were only *partially* closed: **C1**'s shape-only marker check was not
a cryptographic confirmation (a shape-valid-but-garbage marker still bricked the
keystore), the corrupt-meta guard did not validate `meta.iterations`, and the
plaintext sweep aborted on the first un-wrappable key. The table and gaps below
reflect the **hardened** state after that second pass (verify-before-commit unlock,
`validIterations`, per-key sweep isolation). The cross-tab *commit-window* and
*double-rotate* strands are confirmed genuinely deferred (need Web Locks).

A **second re-verification** (re-attacking the residual fixes themselves) confirmed
`validIterations` and the per-key sweep are fully closed, but surfaced two more C1-area
residuals, now also fixed: (1) a **false-success unlock** — after a phase-2 crash (key
already promoted under the new KEK, marker present, old descriptor intact), unlocking
with the *old* passphrase verified the intact old descriptor and returned success even
though the live key was unreadable under the old KEK. `unlockDeviceKeystore` now probes
`wrappedKeysReadableUnder` when a confirmable marker is present and **rejects with "a
device passphrase change is in progress — unlock with your new passphrase"** instead of a
misleading success (a phase-1 interruption with keys still readable under the old KEK is
unaffected). (2) the exported **`completePendingRotation` docstring** falsely advertised
itself as "safe to run at boot before any passphrase is known"; because it is
passphrase-free it cannot verify the marker, so a direct boot-time call on a
shape-valid-garbage marker would re-introduce the C1 brick. The docstring now states the
gating contract (callers must confirm the new KEK first, as `unlockDeviceKeystore` and
`rotateDevicePassphrase` do) — verify-before-commit lives in the caller by design.

### Confirmed findings + fixes applied (data layer, this commit)

| # | Severity | Finding | Fix |
|---|---|---|---|
| **C1** | HIGH | A rotation **commit marker** (`vet_rate_kek_rotating`) could brick every future unlock. The first-pass fix guarded the `JSON.parse` and checked marker *shape* (`meta.salt`/`verifier` are strings) — but a **shape-valid yet cryptographically garbage** marker (16-byte salt + 40-byte junk verifier) still passed, and `completePendingRotation` committed it over the only intact old META/VERIFIER → a permanent brick even for the *correct* old passphrase (empirically reproduced by the residual-verification workflow). | **Verify-before-commit.** `unlockDeviceKeystore` now reads the marker via `readPendingRotation` (shape-validate only) and **commits a pending rotation only after the new KEK is confirmed** — the marker's verifier must `unwrapsUnder` the KEK derived from the typed passphrase. An unconfirmed marker is left untouched and unlock falls back to the still-intact old META/VERIFIER (old passphrase keeps working); a structurally **broken** marker is discarded only *after* the old passphrase is confirmed. The old material is never overwritten by an unconfirmed KEK. `completePendingRotation` keeps its own corrupt-marker rollback for the rotate phase-2 / exported-API path. |
| **C2** | MED | **Cross-tab rotation strand.** (a) Phase-1 snapshotted `listBackupKeyIds()` once, so a key stored by a sibling tab mid-rotation was left wrapped under the *old* KEK and became unreadable after the swap. (b) A sibling-tab unlock calling `completePendingRotation` with no marker **purged the in-flight rotation's temp slots**. | (a) **In-loop race closed:** phase-1 re-scans and folds (`staged` Set + `stageId` closure + `while (staged.size !== lastCount)`) until the id set stops growing. **Residual (open):** a key stored in the *commit window* — after the final re-scan but before the marker is written — is still left under the old KEK; closing it needs true cross-tab serialization (Web Locks), deferred (G gate #3). (b) The no-marker branch **no longer purges** temp slots; genuine orphans are cleared by `rotateDevicePassphrase`'s own pre-rotation `purgeRotatingTemp()`. |
| **C3** | LOW | **Concurrent-store strand** — the same snapshot race as C2a for a `storeLocalKey` that lands during phase 1. | **In-loop store closed** by the same re-scan-fold loop; regression-pinned by a test that injects `storeLocalKey` on the 2nd `wrapKey` call (the 1st is `makeVerifier`, before the snapshot). A store in the **commit window** shares C2a's open residual (Web Locks, G gate #3). |
| **C4** | HIGH | **Restore-locked-state** — restoring a wrapped backup while the keystore is locked surfaced a raw `"Device keystore is locked…"` string as a generic `Restore failed:` error, with no path to unlock. | Data layer: `getLocalKey` now throws the bare sentinel `KEYSTORE_LOCKED`. UI: `MultiCloudManager` `handleRestore` branches on it and shows *"This backup's key is locked by your device passphrase. Unlock the keystore to restore it."* The **unlock modal itself is deferred to commit G** (there is no enable/lock UI to reach it from yet — see gate). |

### Completeness gaps closed

- **Corrupt `vet_rate_kek_verifier`** was misreported as *"Incorrect device passphrase"* (telling a user their correct passphrase is wrong). New `readWrappedBlob` rejects a missing / non-base64 / wrong-length (≠ 40-byte AES-KW) verifier as **corruption** before the unwrap attempt.
- **Corrupt `vet_rate_kek_meta`** hit an unguarded `JSON.parse` at unlock. New `readKeystoreMeta` parses + validates the descriptor and throws a clear corruption error instead of a raw `SyntaxError`. It also runs `meta.iterations` through `validIterations` (positive 32-bit integer, else fall back to the 600k default), so a truthy-but-**invalid** count (negative / non-numeric / out-of-range) self-heals instead of throwing a raw `TypeError` out of `deriveKey`. A *valid* tampered count is still honored — it derives a wrong KEK and yields an honest "Incorrect device passphrase," not a corruption error.
- **`enableDevicePassphrase` / `unlockDeviceKeystore` plaintext sweep.** Plaintext migration is centralized in `migrateAllPlaintextKeys`; `unlockDeviceKeystore` runs it best-effort after a successful unlock, so a crash-left or pre-keystore plaintext DEK is healed on unlock rather than only lazily on the next `getLocalKey` read. `migrateAllPlaintextKeys` wraps **each** key in its own `try/catch`, so one un-wrappable plaintext blob (e.g. a truncated crash-left key) is skipped rather than aborting the whole sweep and stranding every later key.

### Refuted (no change)

The review's 3 refuted candidates (re-verified against the working tree): AES-KW
non-extractability bypass, IV/AAD reuse across the keystore boundary, and a
double-wrap key-confusion path — all held; the wire format and AAD pins are
untouched.

### New regression tests

11 cases added to [cloudKeystore.test.js](../../src/__tests__/utils/cloudKeystore.test.js):
corrupt-verifier → `/corrupt/i` (not wrong-passphrase), corrupt-meta → `/corrupt/i`
(not raw `SyntaxError`), corrupt (non-JSON) marker → `unlock("old")` still resolves +
marker cleared + key readable, `meta.iterations` honored (a *valid* tampered count
rejects the right passphrase), `getLocalKey` locked → `/KEYSTORE_LOCKED/`,
sweep-on-unlock heals injected plaintext without a `getLocalKey` read, and
concurrent-store-during-rotation folded in. The residual-hardening pass adds three
more: a **shape-valid but garbage marker** leaves the old META/VERIFIER untouched and
the old passphrase still unlocks (verify-before-commit), an **invalid `meta.iterations`**
(`-5`) self-heals to the default, and a **corrupt sibling plaintext blob** does not
stop a good plaintext key from healing during the unlock sweep. The second
re-verification pass adds one more: after a **phase-2 crash**, unlocking with the
**old** passphrase rejects with "a passphrase change is in progress" (no false success)
and the **new** passphrase still recovers the key.

### Deferred items — AES-KW verifier tag + Web Locks (2026-06-07)

Owner-approved deferred items from the adversarial-review gap list, implemented after
the commit-F adversarial review, before commit G wires the UI:

**AES-KW verifier integrity tag (`vet_rate_kek_verifier_tag`)**

The adversarial review flagged an honesty gap: a verifier blob whose bytes are a valid
40-byte AES-KW length but are internally corrupt (e.g. a partial write overwriting
bytes 0–15 of the 40-byte blob) would still pass `readWrappedBlob` (length check) and
fail only at `unwrapsUnder`, which is indistinguishable from a wrong passphrase. The
user's correct passphrase is reported as wrong even though the root cause is storage
corruption.

Fix: `enableDevicePassphrase` now writes a SHA-256 digest of the verifier bytes into
`vet_rate_kek_verifier_tag` alongside the verifier. `unlockDeviceKeystore` reads the
tag and, if present, computes `SHA-256(verifierBytes)` and rejects with
`KEYSTORE_CORRUPT_MESSAGE` if they disagree — the error is reported as corruption, not
wrong passphrase, before `deriveKEK` is even called. Legacy keystores (no tag) are
healed on first successful unlock (lazy write). `rotateDevicePassphrase` includes the
tag in the commit marker so `completePendingRotation` can swap both verifier and tag
atomically (stays sync; no new async path). `wipeLocalKeystore` removes the tag key.

| Key | Role |
|---|---|
| `vet_rate_kek_verifier_tag` | SHA-256(verifier bytes), base64 — written by `enableDevicePassphrase` and `rotateDevicePassphrase`; healed by `unlockDeviceKeystore`; erased by `wipeLocalKeystore` |

New tests (2): mismatched-tag → `/corrupt/i` (not wrong-passphrase); no-tag → tag
healed on first unlock. Wipe count updated from 4 → 5.

**Web Locks rotation serialization**

The commit-window and double-rotate strands (C2a/C3 residuals) require true cross-tab
serialization. `withKeystoreLock` wraps every async exported mutator
(`enableDevicePassphrase`, `unlockDeviceKeystore`, `storeLocalKey`, `getLocalKey`,
`rotateDevicePassphrase`) with `navigator.locks.request(KEYSTORE_LOCK_NAME, fn)` —
serializing concurrent tab operations at the browser Web Locks API level. Falls back
to a direct `fn()` call when `navigator.locks` is absent (jsdom, old browsers), so all
existing tests are unaffected. `wipeLocalKeystore` stays sync and is not locked (no
callers hold the lock; adding it would change its sync signature). Internal helpers
(`completePendingRotation`, `migratePlaintextKey`, etc.) are not locked — they are
only called from within already-locked exported functions, and Web Locks are not
reentrant.

The five exported async functions are implemented as `const _name = async (...) => {
... }` internally and re-exported as locked wrappers at the bottom of the module. This
avoids indenting ~200 lines of function body and keeps the diff reviewable.

New tests (2): `navigator.locks.request` is called with the correct lock name when
`navigator.locks` is available (mock injection via `Object.defineProperty`); two
consecutive rotations chain correctly (second reads the first's updated `sessionKEK`).

### Low residuals (harmless, documented)

- **Orphan temp slots + lingering marker.** A rotation whose new KEK is never confirmed
  — the user forgot the new passphrase, or an injected/garbage marker — leaves its
  `vet_rate_rotating_key_*` temp slots and the `vet_rate_kek_rotating` marker in place.
  Verify-before-commit refuses to commit them, so they do **no harm** (the old material
  stays authoritative); they are reclaimed by the next `rotateDevicePassphrase`
  pre-purge or by `wipeLocalKeystore`. Not worth eager GC on the unlock path, which
  must stay forward-only and must not delete a sibling tab's in-flight staging.

### Commit G gate (must clear before G ships the keystore UI)

1. **Ship the `KEYSTORE_LOCKED` unlock modal** alongside the enable/lock UI. C4's
   data layer + restore message land now, but the modal that lets a user unlock
   mid-restore cannot exist until there is an enable/unlock surface — wire both
   together in G.
2. **Harden every UI read path** that calls `getLocalKey`/`storeLocalKey` to branch
   on `KEYSTORE_LOCKED` / the locked-store message, not just `handleRestore`.
3. ~~**Rotation cross-tab serialization residual.**~~ **CLOSED (2026-06-07).** Web Locks
   implemented: `withKeystoreLock` wraps all 5 async exported mutators; the commit-window
   strand and double-rotate strand are now serialized at the `navigator.locks` level.
   No multi-tab rotate UI restriction remains — the lock gates it.
4. **Retire the `cloudSync` `vet-rate-default-key` / email fallback** (Q-LEGACY-DRIVE:
   forbid new writes, keep last-resort decrypt) — unchanged from the existing G scope.
5. **Self-deauth orchestrator** calling `wipeLocalKeystore` with typed-confirm +
   per-backup warning — unchanged from the existing G scope.
