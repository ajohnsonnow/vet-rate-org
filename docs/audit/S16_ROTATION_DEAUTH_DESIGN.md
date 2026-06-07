# S16 — Key-Rotation & Device-Deauthorization: Design Proposal

> **STATUS: APPROVED 2026-06-06 — owner accepted all recommended (R) picks (§6). Implementing in commits E/F/G.**
> This is the PAUSE deliverable for the owner-gated half of S16
> ([SPRINT_PLAN_S9-S17.md](../SPRINT_PLAN_S9-S17.md), row S16). The piiScrubber +
> lhci half shipped as local commits `dcd2d5b`/`e21d876`/`d3f449b`/`d07a420`
> ([S16_WORKLIST.md](S16_WORKLIST.md)). Implementation (commits E/F/G) is gated on
> the **owner decisions** in §6 below — the design must not be guessed at a security
> boundary. Branch `audit/s9-mobile-safety-net`, local only.

Produced by a design-only multi-agent fan-out (Map → 3 design lenses → adversarial
red-team → synthesis). Every code claim below was independently verified against the
working tree.

---

## 1. Verified surface (the problem)

| Fact | Location | Verified |
|---|---|---|
| Random AES-256 backup key exported raw and stored **unwrapped in plaintext localStorage** under `vet_rate_backup_key_*` | [cloudEncryption.js:272-276](../../src/utils/cloudEncryption.js#L272-L276) (write), [:281-283](../../src/utils/cloudEncryption.js#L281-L283) (read) | ✅ read directly |
| cloudSync key = `password \|\| currentUser?.email \|\| "vet-rate-default-key"` — a **hardcoded low-entropy fallback**, on both save and restore | [cloudSync.js:430](../../src/utils/cloudSync.js#L430), [:501](../../src/utils/cloudSync.js#L501) | ✅ read directly |
| Only existing "deauth" is **OAuth-only** sign-out (revoke token + clear sessionStorage); crypto keys remain valid | [cloudSync.js:224-238](../../src/utils/cloudSync.js#L224-L238) | ✅ read directly |
| `debugDump` **one-click exports the entire localStorage** (every key/value) → wrapped keys + KDF salt would egress | [debugDump.js:60-64](../../src/utils/debugDump.js#L60-L64) | ✅ verified |
| `AtomicWipe` **deletes every IndexedDB database** via `indexedDB.databases()` | [AtomicWipe.jsx:54-62](../../src/components/AtomicWipe.jsx#L54-L62) | ✅ verified |
| **No `navigator.storage.persist()`** anywhere in `src` → any IndexedDB-held key is evictable | (grep: 0 matches) | ✅ verified |
| No KEK / `wrapKey`/`unwrapKey` / key-rotation / device-identity exists anywhere | cloudEncryption.js, cloudSync.js | ✅ verified |
| Third-party Gemini key + VA/Drive/Dropbox OAuth tokens also live in plaintext local/session storage | aiStatementHelper.js:27, VaAuthContext.jsx, cloudSync.js:166, multiCloudStorage.js:151 | ✅ (context, out of S16 scope) |

---

## 2. What "rotation" can honestly mean (no server)

Rotation **cannot** mean server-style "invalidate everywhere at once." It honestly means
one of two distinct things — the deliverable must not blur them:

1. **Local KEK rotation (re-wrap; cheap; recommended).** The per-backup DEK (the AES key
   that encrypts the cloud envelope) **never changes**. Rotation re-derives the
   passphrase-bound **KEK** under a fresh PBKDF2 salt and re-wraps every stored DEK via
   `wrapKey`/`unwrapKey` (AES-KW). Only ~40-byte wrapped blobs change; **no cloud
   ciphertext is re-encrypted, nothing re-uploaded.** Protects keys *at rest going
   forward*; does **not** un-leak a DEK already exfiltrated.
2. **DEK/content rotation (true re-encryption; expensive; only path for cloudSync).** The
   Drive layer stores no DEK (key derived per call), so its only "rotation" is
   decrypt-then-resave each file under a new passphrase.

**Bottom line:** rotation shrinks the *future* blast radius of an at-rest key exposure.
It is not retroactive. UI copy must say *"re-protect your saved keys / change your backup
passphrase,"* never *"make my old backups safe."*

---

## 3. What "device deauthorization" can honestly mean (no server)

No server = no remote kill. Deauth decomposes into three layers of decreasing strength;
UI copy must state which is which:

- **A — Local self-deauth (real, cryptographically enforced, this device only):** erase
  every `vet_rate_backup_key_*` + `vet_rate_wrapped_key_*` + KEK descriptor, then OAuth-
  revoke + clear session tokens. After this the browser holds zero key material. This is
  the crypto-key revocation today's OAuth-only sign-out never did.
- **B — Rotate-to-exclude (real for *future* writes only, run from a still-trusted
  browser):** rotate the KEK so future writes bind to a key the deauthorized browser never
  receives. Enforced by *absence*, not by a command reaching it.
- **C — Advisory revocation (honest clients only; NOT enforcement):** deferred — needs a
  signing key [CRYPTO_AUDIT.md:87](../CRYPTO_AUDIT.md) declined, and a forked client
  ignores it.

**Hard limits the UI must never paper over:** deauth cannot delete files already in the
user's own Drive/Dropbox; and for a **no-passphrase backup whose wrapped DEK exists only on
the wiped device**, self-deauth makes that cloud file unrecoverable *everywhere* → the wipe
confirm must warn per-backup.

---

## 4. Recommended approach

**Passphrase-anchored KEK that wraps DEKs at the `storeLocalKey`/`getLocalKey` layer** —
keeping the key store in **localStorage** (no IndexedDB relocation), **no device
identity**, AES-KW via existing Web Crypto (zero new deps), **no new envelope version**.

Why this and not the alternatives:

- It is the only lens that delivers real at-rest protection + real local rotation + real
  local self-deauth **without a new catastrophic failure mode**.
- Keeping the store in localStorage keeps `getLocalKey`/`storeLocalKey` **synchronous**,
  avoiding a sync→async rewrite of 6 call sites
  (multiCloudStorage.js:274/377/546/637, MultiCloudManager.jsx:210/273) — the red-team's
  top silent-restore-regression risk.
- Grafts the best of the rejected lenses: a **redaction allowlist** (so `debugDump` /
  backup sweepers never egress wrapped keys + salt) and the **three-tier deauth
  vocabulary** above (honesty instead of a false "remote kill").

Per-design verdicts: minimal-honest = **viable-with-changes** (basis); kek-wrapped-dek =
viable-with-changes (graft redaction); device-identity = viable-with-changes but
**rejected** (achieves_deauth=false + the AtomicWipe/eviction data-loss traps).

---

## 5. Backward-compat invariant (load-bearing)

DECRYPT of every existing envelope is preserved — the change touches key **custody**, not
wire format.

1. No new envelope version: `VR_ENC_V3` / `VS3\0` unchanged → `isEncryptedBackup`
   allowlist ([cloudEncryption.js:252-261](../../src/utils/cloudEncryption.js#L252-L261))
   and all 10 AAD test pins stay green.
2. `decryptFromCloud` raw-key branch unmodified — wrapped DEK is unwrapped then exported
   back to base64 for that one call (key transits JS heap during active decrypt anyway;
   wrapping protects *at rest*).
3. Legacy plaintext keys: `getLocalKey` stays sync; lazy idempotent migration writes
   `vet_rate_wrapped_key_*` → verifies unwrap → *then* deletes plaintext (crash-safe).
4. cloudSync fallback retired per Q-LEGACY-DRIVE (safe default: forbid new writes, keep
   last-resort decrypt).
5. Rotation keeps OLD+NEW wrapped blobs side-by-side, swaps KEK meta **last**, GCs old →
   all-or-nothing.
6. **Add the currently-missing** cloudSync V1 no-magic / fixed-salt / 100k regression test
   ([cloudSync.js:401-417](../../src/utils/cloudSync.js#L401-L417)) **before** refactoring
   near `_deriveKey`.

---

## 6. OPEN QUESTIONS — owner decision required before any crypto

**DECIDED 2026-06-06: the owner selected the (R) option for all seven.**
Recommended option marked **(R)**.

| # | Question | Options |
|---|---|---|
| **Q-THREAT-SCOPE** | Formally add the at-rest-localStorage-key exposure to the threat model, reversing [CRYPTO_AUDIT.md:142](../CRYPTO_AUDIT.md)'s "no transport surface" rationale? | **(R)** Yes — add both residuals to THREAT_MODEL §7 and proceed · Yes but scope to debugDump+shared-device only (live XSS owned by CSP residual #4) · No — ship only the cloudSync default-key fix |
| **Q-DEVICE-SCOPE** | Multi-device in this cut, or single-device + passphrase-for-portability? | **(R)** Single-device + passphrase portability only · Two-device one-time transfer code (no persistent identity) · Full device-identity keyring (rejected here) |
| **Q-PASSPHRASE-MANDATORY** | Device passphrase opt-in or mandatory for new key-storing writes? | **(R)** Opt-in first cut + one-time nudge · Mandatory for new writes, lazy-migrate (needs Q-RECOVERY first) · Opt-in now → mandatory later |
| **Q-RECOVERY** | Lost-passphrase policy (no escrow allowed)? | No recovery, blunt warning · **(R)** Optional user-held recovery export (download wrapped vault+salt; we never hold it) · Steer users to passphrase-mode backups (restore from passphrase alone) |
| **Q-LEGACY-DRIVE** | How aggressively retire `vet-rate-default-key`/email fallback? | **(R)** Forbid new writes, keep last-resort decrypt indefinitely · Forbid writes, decrypt for a deprecation window · Hard-kill both (strands existing default-key backups) |
| **Q-DEBUGDUMP** | Fix debugDump/AtomicWipe/sweeper allowlists in this change? | **(R)** In-scope, same change (redact wrapped keys + salt) · Separate immediate follow-up before release · Out of scope (leaves egress open) |
| **Q-DEAUTH-DESTRUCTIVENESS** | Confirmation strength for self-deauth/local-key-wipe? | **(R)** Typed-confirm + per-backup "only this device can open X" warning · Single confirm listing affected backups · Two-step requiring recovery export first |

---

## 7. Honest limits (will hold even after implementation)

- No server = no remote revocation, no recall of already-synced files, no revoking a
  memorized passphrase.
- Rotation is not retroactive — a DEK exfiltrated pre-rotation decrypts its cloud copy
  forever.
- Wrapping protects keys **at rest**, not against live in-session XSS (CSP residual #4 is
  the bigger, out-of-scope lever).
- Lost device passphrase = unrecoverable wrapped keys by design; for no-passphrase backups
  whose wrapped DEK is the only copy, that = permanent evidence loss.
- KEK strength bounded by passphrase entropy (PBKDF2-SHA256 600k; Argon2id declined for
  bundle cost per CRYPTO_AUDIT.md:141).
- cloudSync (Drive) gains no DEK-wrap (stores no DEK); its only fix here is killing the
  default-key fallback.
- Key-wipe is best-effort, not forensic erasure (SSD/swap remnants).
- **Design only — no code written, nothing exercised in a browser.** All flows + the new
  V1-cloudSync test must run against a real backup before any success claim.

---

## 8. Proposed commit breakdown (contingent on §6 answers)

- **E — foundation + safety net (no behavior change):** add the missing cloudSync V1
  decrypt regression test + wrapped-key roundtrip/rotation/interrupted-rotation scaffold;
  update THREAT_MODEL §7 residuals + amend CRYPTO_AUDIT:142. *Gated on Q-THREAT-SCOPE.*
- **F — at-rest key protection (KEK-wraps-DEK):** `deriveKEK`/`wrapDEK`/`unwrapDEKtoB64`/
  `rotateKEK` beside storeLocalKey/getLocalKey (sync legacy preserved, async wrapped
  additive); lazy crash-safe migration; side-by-side rotation; debugDump/AtomicWipe/
  sweeper redaction. *Gated on Q-PASSPHRASE-MANDATORY, Q-RECOVERY, Q-DEBUGDUMP.*
- **G — deauth + fallback kill + UI:** self-deauth orchestrator; retire cloudSync
  fallback; centralize "Change backup passphrase" + "Deauthorize this device" (typed
  confirm + per-backup warning); fix stale "100,000 iterations" copy. *Gated on
  Q-DEVICE-SCOPE, Q-DEAUTH-DESTRUCTIVENESS.*
