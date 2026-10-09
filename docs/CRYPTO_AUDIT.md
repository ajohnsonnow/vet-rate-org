# Web Crypto Audit

> Engineering-team audit of every Web Crypto API call site in the SPA. Living document — re-run when a `crypto.subtle` call site is added or modified.
>
> Companion to [COMPLIANCE_STRATEGY.md](./COMPLIANCE_STRATEGY.md) (PW.4 — reuse well-secured crypto) and [THREAT_MODEL.md](./THREAT_MODEL.md). Closes finding #13 in [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md).

**Audit date:** 2026-05-15 (re-audited 2026-06-06, S16)
**Auditor:** Anthony Johnson (engineering)
**Status:** Two real flaws fixed (PBKDF2 iterations + static-salt regression). **S16 re-audit (2026-06-06):** an at-rest key-custody scope was added — the AES-KW decision in §7 is reversed and the at-rest DEK wrap is now **implemented in commit F** (device-passphrase keystore; see §2 inventory, §7, THREAT_MODEL §7 #8–#10, and [audit/S16_ROTATION_DEAUTH_DESIGN.md](./audit/S16_ROTATION_DEAUTH_DESIGN.md)). The deauth UI + cloudSync default-key retirement remain for commit G. Residual items documented below.

---

## 1. Threat model for the crypto surface

vet-rate-org is a browser-only SPA. The crypto surface is:

1. **Local-first encrypted backups** (cloudEncryption.js, cloudSync.js, multiCloudStorage.js) — protect the veteran's case file at rest in third-party cloud storage (Drive, Dropbox, OneDrive). Threat: the cloud provider, an account compromise, or a stolen device.
2. **OAuth PKCE** (pkce.js, useVaAuth.js, multiCloudStorage.js's Dropbox flow) — protect the authorization-code exchange against interception. Threat: a malicious redirect handler or network observer.
3. **Tamper-evident AI audit log** (aiAuditLog.js) — give the veteran a hash chain that detects silent tampering of LLM call history. Threat: malicious browser extension or post-incident modification.
4. **Admin-PIN gate** (AdminAuthContext.jsx) — soft access gate on admin-only views; **not** a credential boundary (PIN hashes are bundled into the SPA at build time).

We are **not** defending against:

- A nation-state with custody of the user's device — the device is the trust root.
- A user who pastes their decryption key into a phishing page — the UX teaches them not to, but cryptography can't help here.
- Browser zero-days — every crypto call goes through `crypto.subtle` and inherits the browser's QA.

---

## 2. Inventory — every Web Crypto call site

| File | Operation | Algorithm | Status |
|---|---|---|---|
| [src/utils/cloudEncryption.js](../src/utils/cloudEncryption.js) | Passphrase backups | PBKDF2-SHA256 → AES-256-GCM | **Hardened S8** — 100k → 600k iterations, versioned envelope `VR_ENC_V2`; AAD-bound `VR_ENC_V3` (B24) |
| [src/utils/cloudEncryption.js](../src/utils/cloudEncryption.js) | Device keystore — at-rest DEK wrapping | PBKDF2-SHA256 600k → **AES-KW** `deriveKey`/`wrapKey`/`unwrapKey`; AES-KW unwrap doubles as the passphrase verifier | **Added S16 (commit F)** — `deriveKEK`/`enableDevicePassphrase`/`unlock`/`rotate`/`wipeLocalKeystore` wrap per-backup DEKs under a passphrase-anchored KEK so the raw key no longer sits in plaintext `localStorage`. Enables local rotation (re-wrap) + self-deauth (wipe). Custody only — wire format untouched. See §7. |
| [src/utils/cloudSync.js](../src/utils/cloudSync.js) | Sync-layer encryption | PBKDF2-SHA256 → AES-256-GCM | **Hardened S8** — was static-salt + 100k; now magic-byte envelope `VS2\0` with per-encryption random 16-byte salt + 12-byte IV + 600k iterations. V1 fallback preserves backward-compat on legacy ciphertexts. |
| [src/utils/multiCloudStorage.js](../src/utils/multiCloudStorage.js):122-138 | Dropbox OAuth PKCE | SHA-256 digest + `getRandomValues(32)` | Compliant — PKCE S256 challenge per [RFC 7636 §4.2](https://www.rfc-editor.org/rfc/rfc7636#section-4.2). |
| [src/utils/pkce.js](../src/utils/pkce.js) | Generic PKCE helper | SHA-256 digest + `getRandomValues(32)` | Compliant — same. |
| [src/auth/useVaAuth.js](../src/auth/useVaAuth.js) | VA-API PKCE | SHA-256 digest + `getRandomValues(32)` | Compliant — same. Note: VA-API surface is feature-flagged off in production. |
| [src/utils/aiAuditLog.js](../src/utils/aiAuditLog.js):38-55 | Hash-chained audit log | SHA-256 digest, hex-encoded | Compliant — see threat-model caveats in the file header (no signing key; detects tampering, can't prevent end-to-end rewrite). |
| [src/contexts/AdminAuthContext.jsx](../src/contexts/AdminAuthContext.jsx):79-85 | Admin-PIN hash | SHA-256 with static text salt | **Known weakness** (see §5). Not a credential boundary — see threat model. |
| [src/utils/systemCapabilityCheck.js](../src/utils/systemCapabilityCheck.js):44-50 | Capability probe | none (existence check only) | n/a — read-only feature probe. |

No `crypto-js`, no `bcryptjs`, no `node-forge`. No hand-rolled crypto primitives anywhere in `src/`.

---

## 3. The two real flaws fixed in S8 (2026-05-15)

### 3.1 PBKDF2 iteration count

**Before:** `cloudEncryption.js` and `cloudSync.js` both used **100,000 SHA-256 iterations**.

**Why this was a problem:** [OWASP's 2023 password-storage cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2) raised the recommended floor for PBKDF2-SHA256 to **600,000 iterations**. 100k was the 2017 minimum and is now ~2 GPU-hours per derivation at ~$30/h spot.

**After:** Both files set `PBKDF2_ITERATIONS = 600_000` and tag new ciphertexts with a version marker (`VR_ENC_V2` in cloudEncryption.js, the `VS2\0` magic bytes in cloudSync.js). The decrypt path branches on the version marker so existing user backups (`VR_ENC_V1` / no magic bytes) continue to decrypt at 100k.

**Code:** [cloudEncryption.js:24-30](../src/utils/cloudEncryption.js#L24-L30), [cloudSync.js](../src/utils/cloudSync.js).

### 3.2 Static salt in cloudSync.js

**Before:** `cloudSync.js`'s `encryptData` derived its key with a hardcoded text salt: `"vet-rate-salt-v1"`. The same salt was used for every veteran, every device, every encryption.

**Why this was a problem:** PBKDF2's salt parameter exists specifically to **prevent rainbow-table attacks** and to **decorrelate the keys derived from the same password across users**. A single project-wide static salt defeats both. An attacker who builds a rainbow table once can attack every backup any veteran ever made. Worse, two veterans who happened to choose the same passphrase produce the same ciphertext for the same plaintext — a privacy regression.

**After:** The V2 envelope carries a random 16-byte salt + 12-byte IV inline with the ciphertext, prefixed by the 4-byte `VS2\0` magic:

```
base64( "VS2\0" || salt[16] || iv[12] || ciphertext )
```

The decrypt path sniffs the magic bytes:

- **Magic present** → V2 path: extract salt from offset 4, IV from offset 20, ciphertext from offset 32. PBKDF2 at 600k.
- **Magic absent** → V1 fallback: legacy fixed-salt path at 100k iterations. This preserves backward-compat for any data already at rest in user cloud storage when the upgrade ships.

**Code:** [cloudSync.js](../src/utils/cloudSync.js).

`cloudEncryption.js` was **not** affected by the static-salt flaw — it already generated a random 16-byte salt per encryption. Only the iteration count was upgraded there.

---

## 4. Compliant call sites — no changes required

The five compliant sites all use Web Crypto correctly for their purpose:

- **PKCE flows (`multiCloudStorage.js`, `pkce.js`, `useVaAuth.js`).** SHA-256 over a 32-byte CSPRNG verifier, base64url-encoded. Matches RFC 7636 S256 challenge method. The verifier never leaves the client, the challenge is sent in the authorization request, and the verifier is revealed only during the token-exchange step. Replay is bounded by the authorization-code lifetime (typically ≤10 minutes).
- **AI audit log (`aiAuditLog.js`).** SHA-256 hex chain. Genesis hash is 64 zero bytes. Each entry is `sha256(prevHash || JSON.stringify(entry minus hash))`. The header in the file is explicit about what this design does and doesn't defend against — read it before extending. We do **not** add a signing key because there is no key-management story available to a client-side SPA without losing zero-knowledge (a signing key derived from a user secret defeats key rotation; a signing key in the SPA bundle defeats the threat model).
- **systemCapabilityCheck.js.** Just probes for the existence of `crypto.subtle.encrypt`. Read-only.

---

## 5. Known weakness — admin PIN hash

The admin-PIN gate ([AdminAuthContext.jsx:79-85](../src/contexts/AdminAuthContext.jsx#L79-L85)) hashes the PIN with a **single SHA-256 pass** and a **hardcoded text salt** (`"vetrate_salt_2024"`).

**Why we are not "fixing" this:**

- This is a **soft gate on a client-side SPA**, not a credential boundary. The PIN hash is in the JS bundle. Anyone with the bundle can brute-force a 6-digit PIN against the bundled hash in milliseconds, regardless of how many PBKDF2 iterations we use. The hash exists to keep curious co-workers off the admin view; it has never been advertised as cryptographically meaningful.
- The threat model is explicit: this is **not protecting veteran data**. Veteran data is protected by the cloud-encryption layer in §3.

**What we did do:** documented this in the file's own comment block, and in this audit. If/when the admin surface becomes a real authentication boundary (server-side auth, multi-admin, audit trails) we'll move it to a real password-hash primitive (Argon2id via a service-worker WASM, or migrate to server-side bcrypt). Tracked in [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md) under finding #18 (api-security).

---

## 6. Backward-compat strategy

Both upgraded layers ship a **versioned envelope** so existing user data continues to decrypt without forced re-encryption.

### cloudEncryption.js

```text
encryptedPackage = {
  version: "VR_ENC_V2",   // or "VR_ENC_V1" for legacy
  salt: base64(16 bytes),
  iv: base64(12 bytes),
  data: base64(ciphertext),
  hasPassphrase: bool,
  ...
}
```

Decrypt path calls `iterationsForVersion(encryptedPackage.version)` → 100k for V1, 600k for V2.

### cloudSync.js

```text
ciphertext_blob = base64( magic[4] || salt[16] || iv[12] || ciphertext )

V2 (current): magic = "VS2\0" (0x56 0x53 0x32 0x00),  iters = 600,000, random salt
V1 (legacy):  no magic prefix,                         iters = 100,000, fixed salt "vet-rate-salt-v1"
```

The sniffer `_hasMagic(bytes)` reads the first 4 bytes. If they match `VS2\0`, V2 path runs. Otherwise V1 fallback.

**Re-encryption on next write:** any time a V1 ciphertext is decrypted by the app and then re-saved through `encryptData`, it is re-emitted as V2. Steady-state, V1 ciphertexts disappear within one save cycle per user. We chose **not** to add a one-time migration sweep because (a) it would touch every cloud backup, and (b) lazy upgrade-on-write is observably safe under the existing test suite.

---

## 7. What we explicitly chose not to add

- **Argon2id / scrypt.** Argon2id is the modern recommendation, but the only browser-side path is a WASM bundle (≥250 KB) loaded into a service worker. The cost-benefit didn't justify the bundle hit at our scale; PBKDF2-SHA256 at 600k iterations matches OWASP 2023's accepted alternative for PBKDF2. Revisit if a future ASVS L2 push requires Argon2id.
- **Key wrapping (RFC 3394, AES-KW). (Rationale REVERSED S16; at-rest wrap SHIPPED in commit F, 2026-06-06.)** The S8 stance was: the generated key is stored on-device only, so there is no *transport* surface for AES-KW to protect. The S16 re-audit corrected the framing — the real threat is **at rest**: the raw AES key sat **unwrapped** in plaintext `localStorage` (`storeLocalKey`), readable by any XSS, a shared-device user, or the one-click full-localStorage export in [`debugDump.js`](../src/utils/debugDump.js). Commit F adds an **opt-in device-passphrase keystore**: `deriveKEK` (PBKDF2-SHA256 600k → a non-extractable AES-KW key) wraps each per-backup DEK (`vet_rate_wrapped_key_*`); `storeLocalKey`/`getLocalKey` became async and wrap/unwrap through the session KEK; legacy plaintext keys are lazily migrated (wrap → verify → then delete). AES-KW's RFC 3394 integrity check makes a wrong-KEK unwrap throw, which is reused as the passphrase verifier (`vet_rate_kek_verifier`). Unlike a transport wrap this also enables **rotation** (`rotateDevicePassphrase` re-wraps every DEK all-or-nothing via a temp-slot + commit-marker journal, with forward-recovery `completePendingRotation`) and **local self-deauth** (`wipeLocalKeystore`). `debugDump` now redacts the wrapped keys, KEK descriptor/salt, and the Gemini key. Design: [audit/S16_ROTATION_DEAUTH_DESIGN.md](./audit/S16_ROTATION_DEAUTH_DESIGN.md). Tests: [cloudKeystore.test.js](../src/__tests__/utils/cloudKeystore.test.js), [debugDumpRedaction.test.js](../src/__tests__/utils/debugDumpRedaction.test.js). The **deauth UI + cloudSync default-key retirement** remain for commit G. See THREAT_MODEL §7 residuals #8–#10.
- **Authenticated additional data (AAD) on AES-GCM. (Shipped B24, 2026-05-15.)** New writes bind AAD per-envelope so a ciphertext from one envelope cannot be decrypted as if it came from another, even with the same key. Two new envelope versions: [cloudEncryption.js](../src/utils/cloudEncryption.js) `VR_ENC_V3` — AAD = UTF-8 `"vetrate.cloud-encryption.v3"`; [cloudSync.js](../src/utils/cloudSync.js) `VS3\0` magic — AAD = UTF-8 `"vetrate.cloud-sync.v3"`. Decrypt paths still accept V1 + V2 envelopes without AAD so existing user backups keep working. A V3 ciphertext relabeled as V2 fails the GCM tag check; a tampered ciphertext fails; a cross-context paste (cloud-encryption ciphertext fed to cloud-sync or vice versa) fails. Tests: [cloudEncryptionAAD.test.js](../src/__tests__/utils/cloudEncryptionAAD.test.js) + [cloudSyncAAD.test.js](../src/__tests__/utils/cloudSyncAAD.test.js) (10 cases covering roundtrip, downgrade, tamper, legacy regression).
- **HKDF.** We derive directly from passphrase via PBKDF2 to a single AES-GCM key. We don't derive sub-keys via HKDF because we only need one symmetric key per ciphertext.

---

## 8. Re-audit triggers

Re-open this document if any of these happen:

- A new `crypto.subtle.*` call site is added (search this file's table to confirm it's catalogued).
- OWASP raises the PBKDF2-SHA256 floor above 600k iterations.
- A WebAuthn / passkeys integration lands (introduces a new key-management surface).
- A server-side data plane is introduced (changes the threat model substantially — see [COMPLIANCE_STRATEGY.md](./COMPLIANCE_STRATEGY.md) re-evaluation triggers).
- A practical attack against PBKDF2-SHA256 below 600k iterations is published.
- The at-rest key-custody surface changes (e.g. key wrapping, rotation, or device-deauth lands or is revised) — track via [audit/S16_ROTATION_DEAUTH_DESIGN.md](./audit/S16_ROTATION_DEAUTH_DESIGN.md).

---

*Owner: Anthony Johnson. Last updated 2026-06-06 (S16 commit F: at-rest DEK wrapping shipped — new AES-KW keystore catalogued in §2, §7 AES-KW marked shipped). Closes [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md) row 13 — moved to compliant in B24 after shipping AAD-bound AES-GCM on both cloud-encryption (`VR_ENC_V3`) and cloud-sync (`VS3\0` magic) envelopes.*
