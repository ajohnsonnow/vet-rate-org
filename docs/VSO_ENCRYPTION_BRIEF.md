# Brief B: per-veteran encryption for VSO mode

**Status:** Build-ready, 2026-09-24. Required before VSO mode can be turned on in production ([VSO_SILOS_SPEC.md](./VSO_SILOS_SPEC.md) §9 F1). Not done until Vera's V2 passes and Anth signs off.
**Applies only in VSO mode** (a registry exists). Single-user behaviour is unchanged.

## 1. Commander's intent

- **PURPOSE:** A lost laptop, or another veteran sitting at the VSO's device, must not expose any veteran's records. Deleting a veteran must make their data unrecoverable.
- **KEY TASKS:**
  - a per-veteran data key wrapped by the existing device keystore
  - parked data encrypted
  - IndexedDB records encrypted for every veteran, active or not
  - an unlock screen, idle and manual lock
  - deletion by destroying the key
  - migration of today's plaintext
  - all within the frozen S16 contract
- **END STATE:** Vera's V2 suite shows no veteran data readable from disk while locked, no other veteran's data readable while one is open, deleted veterans unrecoverable, S16 tests unchanged and green, and coverage of the new code at or above the floors.

## 2. What exists today

- **Device keystore:** a PBKDF2-SHA256 600k key-encryption key (KEK, derived from the device passphrase) wraps data keys with AES-KW. It lives in [cloudEncryption.js:270-1038](../src/utils/cloudEncryption.js#L270). Custody only; the wire format is untouched ([CRYPTO_AUDIT.md §7](./CRYPTO_AUDIT.md)).
- **The KEK lives only in tab memory:** `sessionKEK`, "for this tab session only - never persisted" ([cloudEncryption.js:308-309](../src/utils/cloudEncryption.js#L308)). **Every page reload re-locks.**
- **Public key-custody API:**
  - `storeLocalKey(id, base64)` wraps the key when a passphrase is enabled, but **stores it in plaintext when no passphrase is set** ([cloudEncryption.js:982-998](../src/utils/cloudEncryption.js#L982)).
  - `getLocalKey(id)` throws `KEYSTORE_LOCKED` when a wrapped key exists and the keystore is locked ([:1005-1023](../src/utils/cloudEncryption.js#L1005)).
  - Both are serialized under the web lock `vet_rate_keystore_rotation` ([:302-306](../src/utils/cloudEncryption.js#L302), [:1025-1038](../src/utils/cloudEncryption.js#L1025)).
- **Passphrase rotation** re-wraps **every** id under `vet_rate_wrapped_key_*`/`vet_rate_backup_key_*` ([:818-840](../src/utils/cloudEncryption.js#L818)). It uses a temporary-slot plus commit-marker journal, completed by `completePendingRotation` ([:526-575](../src/utils/cloudEncryption.js#L526)).
- **`wipeLocalKeystore`** erases all key material ([:872-892](../src/utils/cloudEncryption.js#L872)). It is exposed as Deauthorize in [DeviceKeystorePanel.jsx:212-230](../src/components/DeviceKeystorePanel.jsx#L212), and that panel is only rendered in [MultiCloudManager.jsx:1633](../src/components/MultiCloudManager.jsx#L1633).
- **Veteran data is plaintext:**
  - localStorage and the keyval copy ([storage.js:216-220](../src/utils/storage.js#L216))
  - auto-backups ([autoBackup.js:130-147](../src/utils/autoBackup.js#L130))
  - VKB, a single `"main"` record ([veteranKnowledgeBase.js:406-408](../src/utils/veteranKnowledgeBase.js#L406), [:490-510](../src/utils/veteranKnowledgeBase.js#L490))
  - MyPacket ([myPacketManager.js:275-298](../src/utils/myPacketManager.js#L275))
  - C-File batches ([pdfExtractor.js:168-183](../src/utils/pdfExtractor.js#L168))
  - vectors stored as `Int8Array` ([userDocSemanticIndex.js:332](../src/utils/userDocSemanticIndex.js#L332))
- **The debug dump fails closed.** Non-allowlisted keys, including all `vet_rate_wrapped_key_*`, are redacted ([debugDump.js:19-33](../src/utils/debugDump.js#L19)).

## 3. Design

### 3.1 Key hierarchy

- **KEK:** the existing device-passphrase KEK, unchanged. It sits in memory only between a typed-passphrase unlock and the moment B drops it (§3.5).
- **Per-veteran DEK:**
  - A random AES-256-GCM key, one per veteran, generated at creation or migration.
  - Stored through the existing `storeLocalKey("vso_" + siloId, base64)`, so at rest it is `vet_rate_wrapped_key_vso_<siloId>`, AES-KW-wrapped under the KEK. The `vso_` prefix cannot collide with backup ids (generated as `vetrate_backup_*`, [cloudEncryption.js:253-259](../src/utils/cloudEncryption.js#L253)).
  - Retrieved with `getLocalKey`, then immediately re-imported as a **non-extractable** `CryptoKey`. The base64 string is dropped. It cannot be zeroed, because JS strings are immutable; this is stated as a limit.
  - Only the **active** veteran's DEK is ever held in memory while a workspace is open.
- **Precondition:** VSO mode requires `isDevicePassphraseEnabled()` to be true before any DEK is stored. Otherwise `storeLocalKey` would store it in plaintext ([:995-997](../src/utils/cloudEncryption.js#L995)). The new module refuses and throws.

### 3.2 Record envelope, codec, AAD

- **Envelope:** stored as a property on the IDB record: `__vso: { v:1, kv:1, iv:Uint8Array(12), ct:ArrayBuffer }`.
  - `kv` is the DEK version, reserved for B5.
  - The envelope is binary (IDB structured clone), not base64.
- **Codec:**
  - JSON for structure. `ArrayBuffer` and typed arrays round-trip exactly, with no base64 inflation of binary fields.
  - `Blob` and `File` values **throw** and are never silently dropped. Cole confirms in B2 that no per-veteran store writes them; if one does, stop and escalate.
- **AAD:** `"vetrate.vso.v1\0" + siloId + "\0" + dbBaseName + "\0" + storeName + "\0" + JSON(primaryKey)`.
  - This binds each ciphertext to its veteran, store and record. The domain is distinct from `AAD_V3` ([cloudEncryption.js:30](../src/utils/cloudEncryption.js#L30)).
  - For auto-increment stores (`VetRateAutoBackup` `backups`, the audit stores) the primary key is unknown before `add`, so it is omitted. Swapping two records **within** such a store is not detected, and this is stated.
- **IDB transaction constraint:** IDB transactions auto-commit when control returns to the event loop, so `crypto.subtle` must never be awaited inside a transaction.
  - Writes: seal first, then open the transaction.
  - Reads: collect the ciphertexts (`getAll` or collected cursor values), end the transaction, then open them.
  - This changes the cursor-visitor scan in [userDocSemanticIndex.js:197-213](../src/utils/userDocSemanticIndex.js#L197) and the two-store put in [myPacketManager.js:275-298](../src/utils/myPacketManager.js#L275).

### 3.3 What is encrypted, and when

| Surface                                                                  | Parked veteran                                                                | Active veteran (workspace open)                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| localStorage veteran keys                                                | Encrypted (snapshot in `VetRate_SiloSnapshot`, sealed with the veteran's DEK) | **Plaintext while open** (§3.4)                            |
| The 9 per-veteran IDB databases (§2 of the spec plus the snapshot)       | Record contents encrypted                                                     | Record contents encrypted. Opened on read, in memory only. |
| Plaintext fields kept on records (needed for keyPath or queried indexes) | Visible                                                                       | Visible                                                    |
| sessionStorage                                                           | Cleared on lock and switch                                                    | Plaintext while open                                       |
| Registry (initials, case ref, dates, count of veterans)                  | Plaintext                                                                     | Plaintext                                                  |
| Downloads and user-chosen files                                          | Not covered (explicit exports warn, spec §3.8)                                | Same                                                       |

**Plaintext fields per store** (everything else moves into the envelope; Cole lists the final set in the B2 PR and Vera checks none is PII):

- `VetRateAutoBackup.backups`: `id`, `timestamp`, `type`, `sizeBytes` (indexes at [autoBackup.js:84-85](../src/utils/autoBackup.js#L84))
- `VetRateMyPacket.documents` and `document_index`: `id`, `classification`. Classification is queried at [myPacketManager.js:377](../src/utils/myPacketManager.js#L377). `fileName`, `uploadDate` and the rest move inside the envelope; those indexes ([:74-75](../src/utils/myPacketManager.js#L74)) are left sparse, with no schema bump.
- `VetRate_CFileStream.page_batches`: `batchKey`, `sessionKey`, `batchIndex` (random keys, [pdfExtractor.js:349](../src/utils/pdfExtractor.js#L349))
- `VetRate_UserDocVectors`: `id`, `sessionKey`
- `VetRateVKB.knowledge_base`: `id` (`"main"`)
- `keyval-store` (per veteran): the keys (localStorage key names, log ids)
- `VetRateBugSquasher` and `VetRateFeatureRequests`: keyPaths plus the indexed fields at [bugReportStorage.js:109-130](../src/utils/bugReportStorage.js#L109) and [featureRequestStorage.js:55-78](../src/utils/featureRequestStorage.js#L55) (dates, severity, status, category, module, action)
- `VetRate_SiloSnapshot`: the key (silo id)

### 3.4 Honest scope: the active veteran's localStorage

- **The active veteran's localStorage cannot be encrypted while their workspace is open.**
  - About 101 files read it synchronously, and Web Crypto is async-only.
  - The only transparent approach is the `Storage.prototype` proxy, which the spec rejects (§3.6).
- B limits the exposure window instead:
  - lock and switch park it (encrypt, then remove the plaintext)
  - idle auto-lock
  - a Lock button in the banner
  - a notice when the last session closed unlocked
- `removeItem` and IDB overwrites do **not** guarantee the old bytes are erased from the browser's on-disk files (LevelDB and SQLite free pages and logs). Previously written plaintext can linger until the browser compacts its storage. This is why the wizard and help page recommend OS full-disk encryption.

### 3.5 Lifecycle

- **Locked (resting state):**
  - There is no KEK and no DEK in memory.
  - Normally no veteran keys are in localStorage.
  - The app module graph is not loaded; main.jsx shows only the unlock screen (spec §3.4 step 7).
- **Unlock screen:**
  - A passphrase field plus static text: which veteran will open (label), "Forgot your passphrase? Without it or a recovery bundle, data on this device can't be recovered", and the Veterans Crisis Line (988, press 1) as static text.
  - No network requests.
  - Submitting calls `unlockDeviceKeystore(typed)`, then `getLocalKey("vso_"+active)`, imports the key non-extractable, and **calls `lockDeviceKeystore()` immediately** (least privilege: from here on only the active veteran's DEK is in memory). Then unpark, then load the app.
  - If the typed passphrase is shorter than 12 characters, a non-blocking notice recommends changing it.
- **Open:** the active DEK is held in the silo crypto module's memory. Other veterans' DEKs stay wrapped, and opening any of them needs the passphrase again.
- **Lock (Lock button, idle timeout, or the panel's Lock in VSO mode):**
  - Runs spec §3.4 with `to = from`: park, then `sessionStorage.clear()`, then reload to the unlock screen.
  - The default idle timeout is `vetrate_vso_idle_minutes = 15`, range 5–60, a device setting. Activity is keyboard, pointer or visibility in this tab.
  - A lock is broadcast on `vetrate-silo`, so every tab reloads to the unlock screen.
- **Switch:** park A with A's DEK, which is already in memory and needs no KEK. Reload, then the unlock screen (passphrase), then unwrap B. **Every switch requires the passphrase**, so a person left at an open session reaches only the open veteran.
- **Browser closed without locking:** the active veteran's localStorage stays plaintext on disk until the next unlock and lock. At the next unlock the live keys are kept (spec §3.4 step 8) and the notice is shown.
- **Multiple tabs:** each tab unlocks separately. The spec §3.5 guard still applies.

### 3.6 Behaviour when the keystore is locked

| Operation                                                           | Behaviour                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Boot in VSO mode                                                    | Unlock screen. No app module loads, and nothing reads veteran IDB.                                                                                                                                                                                                                    |
| Read a sealed record without a DEK                                  | Throws `VSO_LOCKED`. **Never** falls back to an empty or initial value and never writes. This fixes SPEC-DEFECT-2: the VKB fallbacks at [veteranKnowledgeBase.js:422-477](../src/utils/veteranKnowledgeBase.js#L422) must rethrow in VSO mode instead of returning `initializeVKB()`. |
| Decrypt failure (bad tag, wrong key, tampering)                     | Throws `VSO_DECRYPT_FAILED`, with the store name only and no record contents. No write follows. The UI shows "This record couldn't be opened."                                                                                                                                        |
| An unsealed record in a store whose migration is `complete`         | Rejected as `VSO_DECRYPT_FAILED` (prevents downgrade injection)                                                                                                                                                                                                                       |
| Add a veteran                                                       | Asks for the passphrase: unlock, `storeLocalKey`, lock                                                                                                                                                                                                                                |
| Delete a veteran                                                    | Asks for the passphrase (re-authentication), even though key removal doesn't need the KEK                                                                                                                                                                                             |
| Change passphrase or export a recovery bundle (DeviceKeystorePanel) | The existing panel flow (unlock first). In VSO mode the panel calls `lockDeviceKeystore()` when the action finishes.                                                                                                                                                                  |
| `storeLocalKey`/`getLocalKey` for cloud backups                     | Not reachable, because cloud backup is off (F2). Cole verifies by grep in B3 that no VSO-mode path calls them outside the silo key module.                                                                                                                                            |

### 3.7 Deletion by destroying the key

For veteran X (not active), after re-authentication:

1. Set the registry flag `deleting:true`.
2. Destroy X's key: remove `vet_rate_wrapped_key_vso_X`, **and** any `vet_rate_rotating_key_vso_X`, **and** any `vet_rate_backup_key_vso_X`, under the keystore lock (§4.3). From this point X's ciphertext is unrecoverable on this device.
3. `indexedDB.deleteDatabase` on every per-veteran base name for X: suffixed, or unsuffixed if X is legacy. Never touch shared names. Handle `onblocked` by broadcasting a close, retrying, and reporting if it is still blocked; the data is already unreadable.
4. Remove the registry entry.

Crash recovery: at boot, an entry with `deleting:true` resumes from step 2 (every step can be repeated safely).

Limits, stated in the delete dialog's help text:

- A **recovery bundle exported before the deletion** still contains X's wrapped key. With the passphrase and an earlier copy of X's ciphertext (e.g. a disk image), X could be recovered. Advise re-exporting the bundle and destroying old copies.
- Plaintext written **before migration** may linger in browser files (§3.4).

**Deauthorize in VSO mode** ([DeviceKeystorePanel.jsx:212-230](../src/components/DeviceKeystorePanel.jsx#L212)):

- The confirmation text must say "This permanently destroys every veteran workspace on this device (N veterans)."
- After `wipeLocalKeystore()`, delete every per-veteran database and the registry, then reload to non-VSO mode. Otherwise the app would boot into a registry pointing at unreadable data.

### 3.8 Key rotation

- **KEK rotation (passphrase change):** no new code. The existing `rotateDevicePassphrase` re-wraps every `vet_rate_wrapped_key_vso_*` along with backup keys ([cloudEncryption.js:818-840](../src/utils/cloudEncryption.js#L818)). Veteran data is not re-encrypted. Vera verifies that every veteran opens under the new passphrase and not the old one, including after the S16 crash scenarios.
- **Stale key copies:** the legacy veteran's keyval store may hold copies of `vet_rate_backup_key_*` or `vet_rate_wrapped_key_*` from the old one-time migration ([storage.js:178-203](../src/utils/storage.js#L178)). Rotation never re-wraps those copies. Migration (§3.9) deletes keystore-prefixed entries from that store.
- **DEK rotation (re-encrypting a veteran under a new key): deferred as B5.**
  - Passphrase rotation already covers a compromised passphrase for anyone who didn't also copy the ciphertext. DEK rotation only helps against someone who has already unwrapped a DEK and will get new ciphertext later.
  - The `kv` field is reserved now so B5 needs no format change.
  - B5 design, if Anth schedules it: generate `vso_<id>_k2`, re-seal every record lazily or in a batch (records carry `kv`), then destroy k1 once every store reports complete.

### 3.9 Migration from today's plaintext

This runs in the enable wizard for the legacy veteran:

1. Passphrase present and unlocked, with at least 12 characters for a newly set passphrase. Offer a recovery bundle.
2. Generate the DEK, `storeLocalKey("vso_"+id, …)`, read it back with `getLocalKey`, and check it matches before touching any data.
3. Set the registry `enc:"migrating"`.
   - For each per-veteran store, in batches: collect unsealed records, end the transaction, seal them, write them in a new transaction.
   - The process is idempotent (sealed records are skipped) and resumable (repeat after a crash).
   - Show progress, and check quota first with `ensureQuota` ([storage.js:356-387](../src/utils/storage.js#L356)).
   - While `migrating`, reads accept both forms.
4. Delete keystore-prefixed entries from the legacy veteran's keyval store (§3.8).
5. Set `enc:"complete"`. From then on, unsealed records are rejected (§3.6).
6. The first lock parks the legacy veteran's localStorage.

Turning VSO mode off (one veteran left) reverses steps 3–5 into plaintext, then removes the DEK.

### 3.10 Plaintext exits

In VSO mode, automatic plaintext file writes are off, and explicit exports warn (spec §3.8). B does **not** encrypt exported files; that is an open question in §9.

### 3.11 Performance

**Nothing here has been measured. These are proposed budgets for Vera to test**, run in Chromium with 4x CPU throttling through CDP, against fixtures. Exceeding a budget sends the result to Anth; it does not ship silently.

| Operation                                                                                                                         | Expected cost                          | Proposed budget                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unlock (PBKDF2 600k plus unwrap)                                                                                                  | Runs on every page load and switch     | ≤ 3 s to unlock screen dismissed                                                                                                                                  |
| Park/unpark (localStorage ≤ ~5–10 MB, one seal)                                                                                   | Small                                  | Switch ≤ +1 s over the S2 baseline                                                                                                                                |
| C-File ingest (text batches, per-batch seal)                                                                                      | Throughput-bound                       | 500-page fixture ≤ +25%                                                                                                                                           |
| Semantic search: every vector for the session is opened per search; with no cursor streaming, ciphertext is collected first       | Many small decrypts; peak memory rises | 5,000-vector fixture p95 ≤ +50%                                                                                                                                   |
| MyPacket save: the duplicate check reads **every full document** ([myPacketManager.js:249](../src/utils/myPacketManager.js#L249)) | O(n) full decrypts per save            | Cole switches the duplicate check to the sealed `document_index` store; 200-document fixture ≤ +25%                                                               |
| VKB save: the whole `"main"` record is re-sealed on every save and grows with each document                                       | Grows with VKB size                    | Largest fixture VKB ≤ +25%. The in-memory cache ([veteranKnowledgeBase.js:55-64](../src/utils/veteranKnowledgeBase.js#L55)) means reads are opened once per load. |
| Migration of a large legacy C-File                                                                                                | Proportional to data; may take minutes | Must be resumable and show progress. No budget, but the time is reported.                                                                                         |

## 4. The frozen S16 keystore contract

Sources: the code (above), [CRYPTO_AUDIT.md §2](./CRYPTO_AUDIT.md) and §7, and the S16 memory note. The design docs cited at [cloudEncryption.js:292](../src/utils/cloudEncryption.js#L292) (`docs/audit/S16_ROTATION_DEAUTH_DESIGN.md`, `S16_WORKLIST.md`) **are not on this branch**, so these rules come from code comments and the audit document.

### 4.1 Allowed calls (existing exports, unchanged)

- `isDevicePassphraseEnabled`, `isKeystoreUnlocked`, `isDeviceKeystoreLocked`
- `enableDevicePassphrase(typed)`: from the enable wizard only
- `unlockDeviceKeystore(typed)`: **only in direct response to a passphrase the user has just typed** (unlock screen, add, delete, panel)
- `lockDeviceKeystore()`
- `storeLocalKey("vso_"+id, …)`, `getLocalKey("vso_"+id)`
- `rotateDevicePassphrase`, `exportRecoveryBundle`, `wipeLocalKeystore`: only through the existing DeviceKeystorePanel flows

### 4.2 Forbidden

- Calling `completePendingRotation` anywhere, at boot or otherwise. It is passphrase-free and trusts the marker ([cloudEncryption.js:510-525](../src/utils/cloudEncryption.js#L510)); the verify-before-commit check lives in `unlockDeviceKeystore` ([:712-733](../src/utils/cloudEncryption.js#L712)).
- Calling `unlockDeviceKeystore` at boot, automatically, or with a stored or cached passphrase.
- Reading, writing or parsing `vet_rate_kek_*`, `vet_rate_kek_rotating`, or any wrapped blob directly.
- Changing envelope formats `VR_ENC_*`/`VS*`, the recovery-bundle format, iteration counts, or AES-KW usage.
- Storing the passphrase, the KEK, or any unwrapped DEK in any storage, including sessionStorage and IDB, even as a non-extractable key.

### 4.3 Deletion under the keystore lock: FROZEN-1 (Anth's call)

Key destruction must be serialized against rotation. Otherwise:

1. A rotation stages `vet_rate_rotating_key_vso_X`.
2. Deletion removes the live key.
3. Phase 2 promotes the temporary copy ([cloudEncryption.js:561-565](../src/utils/cloudEncryption.js#L561)), and **the deleted key comes back**.

The same happens after a crash: an interrupted rotation leaves the temporary slot, and the next unlock promotes it.

- **Recommended:** add one additive export, `deleteLocalKey(id)`, wrapped in `withKeystoreLock`, that removes the `KEY_STORAGE_PREFIX`, `WRAPPED_KEY_PREFIX` and `ROTATING_KEY_PREFIX` entries for `id`. No existing function, format or behaviour changes. It needs Anth's approval because the module is frozen. It also triggers a CRYPTO_AUDIT re-audit ([CRYPTO_AUDIT.md §8](./CRYPTO_AUDIT.md)).
- **Fallback if refused:** the silo key module calls `navigator.locks.request("vet_rate_keystore_rotation", …)` itself and removes the three entries. This works, but it depends on an internal constant ([cloudEncryption.js:302](../src/utils/cloudEncryption.js#L302)); a test must pin that string.

### 4.4 Side effects of reusing the keystore (all intended; each is tested)

- `listBackupKeyIds()` now includes `vso_*` ids ([cloudEncryption.js:461-472](../src/utils/cloudEncryption.js#L461)). DeviceKeystorePanel's key display ([DeviceKeystorePanel.jsx:55](../src/components/DeviceKeystorePanel.jsx#L55)) must count backup keys and veteran workspace keys separately. There are no other callers.
- Recovery bundles include veteran keys (good for VSO recovery; see the §3.7 limit).
- The debug dump already redacts them.
- `importRecoveryBundle` refuses to overwrite a live keystore ([:945-950](../src/utils/cloudEncryption.js#L945)). That behaviour is unchanged.

## 5. Threat model

| Threat                                                               | Protected                                                                                                                        | Not protected                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lost or stolen laptop, browser locked or closed after a lock**     | Every veteran's IDB record contents; every parked localStorage snapshot; key material (AES-KW under a 600k-iteration PBKDF2 KEK) | Metadata: the registry (initials, case refs, dates, number of veterans), DB names with silo ids, record counts and sizes, the plaintext index fields (§3.3). Plaintext written before migration and still left in browser files. Downloaded exports. **A weak passphrase:** offline guessing against PBKDF2 is the whole game, hence the 12-character minimum for VSO mode. |
| **Lost laptop while a workspace is open, or closed without locking** | Parked veterans (their DEKs are wrapped and the KEK was dropped at unlock)                                                       | The open veteran's localStorage (plaintext), and their IDB through the in-memory DEK in a live session. Idle lock bounds the window.                                                                                                                                                                                                                                        |
| **Another veteran using the same device**                            | Other veterans' data isn't in localStorage and is sealed under other DEKs. Switching, adding and deleting need the passphrase.   | The open veteran, if the VSO walks away without locking. Panic wipe can destroy all veterans without a passphrase (open question).                                                                                                                                                                                                                                          |
| **Tampering with data on disk**                                      | Modified or moved ciphertext fails the GCM tag or AAD check. A downgrade to plaintext after migration is rejected.               | Rolling a record back to an older sealed version of itself (no versioning). Swapping records within auto-increment stores (no primary key in AAD).                                                                                                                                                                                                                          |
| **Malicious browser extension with access to the site**              | Nothing beyond the locked-at-rest case                                                                                           | Everything the page can do: the open veteran's data, use of the in-memory DEK, and **capturing the passphrase at the unlock screen**, which then exposes every veteran. Mitigation is outside B: a dedicated browser profile with no extensions (help page).                                                                                                                |
| **XSS**                                                              | If it runs while locked and nobody types the passphrase, it gets only ciphertext and metadata                                    | Same as a malicious extension. The defences are CSP and output escaping (Commandment 3), not B.                                                                                                                                                                                                                                                                             |
| **Browser storage eviction or clearing**                             | n/a                                                                                                                              | Eviction deletes ciphertext and keys alike. The recovery bundle restores keys, not data.                                                                                                                                                                                                                                                                                    |

## 6. Acceptance criteria

- **EB-AC1:** A DEK is generated per veteran and stored only as `vet_rate_wrapped_key_vso_<id>`. `vet_rate_backup_key_vso_*` never exists, and creation throws if the device passphrase is not enabled.
- **EB-AC2:** The in-memory DEK is non-extractable (`exportKey` rejects), and only the active veteran's DEK is ever held.
- **EB-AC3:** Envelope round-trip is exact for JSON, `ArrayBuffer`, `Int8Array` and `Float32Array`. `Blob`/`File` throw. A changed IV, ciphertext or any AAD component fails. A record sealed for veteran A fails to open under B's DEK.
- **EB-AC4:** A fresh random 96-bit IV is used on every seal (unit test: 10,000 seals, no repeats).
- **EB-AC5:** Deleting a veteran removes the live, rotating and plaintext-prefix entries under the keystore lock (FROZEN-1 or its fallback). A rotation interrupted and resumed after deletion does not bring the key back.
- **EB-AC6:** In VSO mode, every per-veteran store writes sealed records. Only the §3.3 plaintext fields are visible to a raw IDB read (Playwright walks every store).
- **EB-AC7:** No `crypto.subtle` await happens inside an open IDB transaction (unit tests with fake-indexeddb show no `TransactionInactiveError`; code review checklist item).
- **EB-AC8:** A locked or failed decrypt never leads to a write. With a planted bad record the VKB load throws, and the stored ciphertext is byte-identical afterwards (SPEC-DEFECT-2).
- **EB-AC9:** After `enc:"complete"`, an injected plaintext record is rejected.
- **EB-AC10:** The MyPacket duplicate check reads only `document_index`. Performance budgets from §3.11 are met or escalated.
- **EB-AC11:** In VSO mode no app module is evaluated before unlock. Vera verifies with a module-evaluation marker, and no veteran IDB database is opened before unlock.
- **EB-AC12:** After unlock, `isKeystoreUnlocked()` is false (KEK dropped) and the active veteran works normally.
- **EB-AC13:** Every switch reaches the unlock screen and requires the passphrase. Lock (button, idle, panel) parks, clears sessionStorage and reloads every tab to the unlock screen.
- **EB-AC14:** After closing without locking, the live keys are kept and the notice is shown. An unpark interrupted at `unparking` recovers with no loss.
- **EB-AC15:** The unlock screen makes no network requests, passes axe, has no horizontal scroll at 390px and 3840px, and shows the crisis line text.
- **EB-AC16:** Adding and deleting a veteran require the passphrase. In VSO mode, DeviceKeystorePanel's Lock runs the VSO lock, and rotate/export re-lock the KEK when they finish.
- **EB-AC17:** Legacy migration is idempotent and resumable. Killing the page mid-migration and resuming ends with every record sealed and hash-equal plaintext content after opening.
- **EB-AC18:** Migration removes keystore-prefixed entries from the legacy keyval store and nothing else.
- **EB-AC19:** After deletion, no database with the veteran's suffix remains, the key is gone, other veterans' hashes are unchanged, and an interrupted delete resumes at boot.
- **EB-AC20:** Deauthorize in VSO mode shows the all-veterans warning, then removes every per-veteran database and the registry. The app returns to non-VSO mode.
- **EB-AC21:** S16 is untouched. [cloudKeystore.test.js](../src/__tests__/utils/cloudKeystore.test.js) passes **unmodified**. `git diff` of `cloudEncryption.js` is empty, or contains only the approved `deleteLocalKey` export. Grep finds no call to `completePendingRotation` outside `cloudEncryption.js`, and no `unlockDeviceKeystore` call outside a submit handler of a typed passphrase.
- **EB-AC22:** Documentation: `docs/adr/ADR-004-vso-per-veteran-encryption.md`; a [CRYPTO_AUDIT.md](./CRYPTO_AUDIT.md) §2 inventory row for the new module (AES-256-GCM with AAD, key custody through the keystore); new [THREAT_MODEL.md](./THREAT_MODEL.md) entries matching §5, residual risks included.

## 7. Test plan

**Unit (vitest, jsdom, fake IndexedDB):**

- `src/__tests__/utils/vsoCrypto.test.js`: EB-AC1–EB-AC5, including the rotation-resurrection scenario built on the S16 test helpers' pattern.
- `src/__tests__/utils/vsoSealedStore.test.js`: EB-AC6–EB-AC9 for each of the 9 stores, including the no-await-in-transaction test and the VKB failure path.
- `src/__tests__/utils/vsoMigration.test.js`: EB-AC17–EB-AC18, including kill-and-resume at every batch boundary.
- `src/__tests__/utils/vsoDelete.test.js`: EB-AC19–EB-AC20, and the pinned lock-name test if the fallback is used.
- `src/__tests__/utils/vsoLifecycle.test.js`: the idle timer, the lock broadcast, and the `unparking` recovery.
- **Coverage floors** added to [vitest.config.js](../vitest.config.js#L43) per file: the crypto and delete modules at statements, lines and functions ≥ 90% and branches ≥ 85%; the other new B modules at ≥ 80%/75%. The global floors are not lowered.

**Playwright** (Chromium and Firefox; performance tests Chromium only):

- `tests/e2e/vso-encryption-at-rest.spec.ts`: plant canaries for A and B, lock, then walk **every** IDB store and localStorage from a fresh context. No canary appears anywhere except as ciphertext. The registry holds only initials and case refs.
- `tests/e2e/vso-lock-lifecycle.spec.ts`: EB-AC11–EB-AC16, including two tabs and idle lock with `page.clock`.
- `tests/e2e/vso-crypto-shred.spec.ts`: delete, crash mid-delete, deauthorize in VSO mode.
- `tests/e2e/vso-migration.spec.ts`: seed legacy plaintext through the current build's storage shape, run the wizard, kill mid-way, resume, verify.
- `tests/e2e/vso-threats.spec.ts`: tamper with a ciphertext byte, move a record between veterans, inject plaintext after `complete`. Each shows the error UI and makes no write.
- `tests/e2e/vso-perf.spec.ts`: the §3.11 budgets with CDP 4x CPU throttling. Numbers go into Vera's V2 report.

**Regression:** the full existing unit and e2e suites; `cloudKeystore.test.js` unmodified; AC1 non-VSO baseline.

**Traceability:** Vera's V2 report maps every EB-AC to at least one passing test by file and name.

## 8. Do not

- Do not break §4.2 (S16). Do not change `cloudEncryption.js` beyond the FROZEN-1 export, and only if Anth approves it.
- Do not store the passphrase, the KEK or an unwrapped DEK anywhere persistent, including sessionStorage and IDB-stored `CryptoKey`s.
- Do not proxy `Storage.prototype` to encrypt localStorage in place.
- Do not await `crypto.subtle` inside an IDB transaction.
- Do not fall back to empty or initial data on a locked or failed decrypt, and never write after one.
- Do not keep PII in plaintext index fields. When in doubt, move the field into the envelope.
- Do not turn on B for non-VSO users (separate decision).
- Do not add a server, telemetry, key escrow or any network call.
- Do not use `Math.random` for keys or IVs; use `crypto.getRandomValues` or `generateKey` only.
- Do not add a new passphrase or key-derivation scheme. Reuse the device keystore.
- Do not build DEK rotation (B5) or encrypted exports unless Anth schedules them.
- Do not log record contents, labels or key ids in error messages.

## 9. Open questions and flags

- **FROZEN-1 (§4.3):** approve the additive `deleteLocalKey` export, or use the fallback?
- **B5:** schedule DEK rotation, or leave it deferred?
- **Encrypted exports:** should explicit exports in VSO mode be encrypted with a passphrase using the existing `encryptForCloud` `VR_ENC_V3` format? That would need an import-side change. For now they only warn.
- **Panic wipe** in VSO mode (spec §9).
- **Single-user encryption** (spec §9).
- **Unverified:**
  - The S16 design docs are missing from this branch.
  - Whether any per-veteran store writes `Blob`/`File` (Cole checks in B2).
  - Safari/WebKit behaviour of Web Locks, BroadcastChannel and IDB `deleteDatabase` blocking is untested.
  - The performance numbers are unmeasured.

## 10. Sprint mapping

| Sprint | Runs it                      | Files                                                                                                                                                                                                                                                                                                                                                                                        | Criteria                                |
| ------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **B1** | Cole, `claude-opus-5`, xhigh | New `src/utils/vsoCrypto.js` (DEK create/load/drop, seal/open, codec, AAD), `src/utils/vsoKeys.js` (keystore adapter, deletion); [cloudEncryption.js](../src/utils/cloudEncryption.js) `deleteLocalKey` **only if FROZEN-1 is approved**; vitest floors                                                                                                                                      | EB-AC1–EB-AC5, EB-AC21 (partial)        |
| **B2** | Cole, `claude-opus-5`, xhigh | New `src/utils/vsoSealedStore.js`; the 8 open sites and 3 keyval importers from spec §2 (seal and open around their transactions); [veteranKnowledgeBase.js:402-479](../src/utils/veteranKnowledgeBase.js#L402) fallbacks; [myPacketManager.js:249](../src/utils/myPacketManager.js#L249) duplicate check; [userDocSemanticIndex.js:197-213](../src/utils/userDocSemanticIndex.js#L197) scan | EB-AC6–EB-AC10                          |
| **B3** | Cole, `claude-opus-5`, high  | New `src/components/VsoUnlockGate.jsx`; `src/vsoPreboot.js` and [main.jsx](../src/main.jsx) gate hook; idle and lock in `siloSwitch.js`; [DeviceKeystorePanel.jsx](../src/components/DeviceKeystorePanel.jsx) VSO-mode lock, re-lock and key-count display; add/delete re-authentication                                                                                                     | EB-AC11–EB-AC16                         |
| **B4** | Cole, `claude-opus-5`, xhigh | New `src/utils/vsoMigration.js`; delete and deauthorize paths; `docs/adr/ADR-004-vso-per-veteran-encryption.md`; [CRYPTO_AUDIT.md](./CRYPTO_AUDIT.md); [THREAT_MODEL.md](./THREAT_MODEL.md)                                                                                                                                                                                                  | EB-AC17–EB-AC22                         |
| **V2** | Vera, `claude-opus-5`, high  | Every §7 Playwright file; independent reruns of the unit suites; performance report; traceability table                                                                                                                                                                                                                                                                                      | Every EB-AC, and evidence for spec AC17 |
