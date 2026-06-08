# Context Vault — Memory Architecture

Closes [AUDIT_FINDINGS](AUDIT_FINDINGS.md) **#6** (ai-memory-systems). The
original audit row claimed *"No CONTEXT_VAULT.md or session-log pattern;
`veteranProfile.js` is state store, not a durable memory layer."* That
framing was wrong about what existed — the durable layers shipped over
S1–S3, but were never named in one place. This file is that one place.

## What "memory" means in this app

A local-first, zero-knowledge SPA has no server-side database, no user
account, no remote vector store. "Memory" means: **what state survives
across browser sessions, on the veteran's own device, scoped to their
own data, and which AI calls are allowed to see what.**

This document inventories the four durable layers + one ephemeral layer,
their durability and scoping properties, and the API each exposes.

## The four durable layers

| # | Layer | Backend | Scope | Decay | Module |
|---|---|---|---|---|---|
| 1 | **Veteran profile** | `localStorage` | Per-browser | Manual clear only | [src/utils/veteranProfile.js](../src/utils/veteranProfile.js) |
| 2 | **My Packet (documents)** | IndexedDB (`VetRateMyPacket`) | Per-browser | Manual clear, per-doc delete | [src/utils/myPacketManager.js](../src/utils/myPacketManager.js) |
| 3 | **AI audit log** | IndexedDB via `idb-keyval` (`ailog:` keys) | Per-browser, append-only | Cleared explicitly (logged as audit event) | [src/utils/aiAuditLog.js](../src/utils/aiAuditLog.js) |
| 4 | **Cloud encrypted backup** | Google Drive / OneDrive (opt-in) | User-owned cloud account | User-controlled, AES-GCM-encrypted before upload | [src/utils/cloudSync.js](../src/utils/cloudSync.js) + [src/utils/cloudEncryption.js](../src/utils/cloudEncryption.js) |

### Layer 1 — Veteran profile (identity + saved forms + ratings)

- **Keys:** `vet_rate_veteran_profile`, `vet_rate_saved_forms`, `vet_rate_my_ratings`.
- **Schema:** ~150 declared `VALID_PROFILE_FIELDS` covering personal ID,
  contact, military service, dependents, claim history. Field-level
  allow-list enforced in [veteranProfile.js:21-115](../src/utils/veteranProfile.js#L21).
- **API:** `getVeteranProfile`, `saveVeteranProfile`, `updateVeteranProfile`,
  `clearVeteranProfile`, `hasVeteranProfile`, `exportAllVeteranData`,
  `importVeteranData`.
- **Decay:** Persists indefinitely until the user clears site data or
  calls `clearVeteranProfile()` (also wired to the in-app "Clear all"
  control).
- **AI visibility:** Read by feature components to pre-fill forms.
  **Never sent to a cloud LLM in raw form** — the PII scrubber
  ([src/utils/piiScrubber.js](../src/utils/piiScrubber.js)) runs first
  when content flows into `generateWithCloud` / `generateWithSwarm`.

### Layer 2 — My Packet (document store)

- **Backend:** IndexedDB database `VetRateMyPacket` (version 2), object
  stores `documents` + `document_index`.
- **Records:** Every uploaded DD214 / claim letter / C-File / Blue Button
  PDF, with raw OCR text, structured extracted fields, classification
  label, page count, upload timestamp.
- **API:** `saveDocumentToPacket`, `getPacketDocument`, `getPacketIndex`,
  `getPacketDocumentsByType`, `getAllPacketDocuments`,
  `updatePacketDocument`, `deletePacketDocument`,
  `searchPacketDocuments`, `getDocumentRawText`,
  `getDocumentExtractedData`, `getAllDocumentText`, `exportPacket`,
  `importPacket`, `clearPacket`, `generatePacketContext`.
- **Decay:** Per-document delete or full `clearPacket`.
- **AI visibility:** `generatePacketContext()` builds a controlled
  context window for AI tools. Raw OCR text never reaches the
  synthesizer prompt — it goes through the dual-LLM split
  ([src/utils/dualLLM.js](../src/utils/dualLLM.js)) so the extractor
  sees the spotlight-wrapped raw text and only the validated extraction
  reaches the synthesizer.

### Layer 3 — AI audit log (episodic / replay)

This is the **session-log pattern** the audit row asked for. Append-only,
hash-chained, tamper-evident.

- **Backend:** `idb-keyval`, keys prefixed `ailog:` (`ailog:_meta` plus
  one entry per monotonic seq).
- **Chain:** Each entry stores `prevHash` + `hash = sha256(prevHash ||
  JSON.stringify(entry minus hash))`. A single byte changed in any entry
  breaks the chain at that point.
- **API:** `logModelCall`, `logModelCallWithDigests`, `getRecentLogs`,
  `verifyLogChain`, `exportLogs`, `clearLogs`, `getLogCount`.
- **PII-aware:** Callers are expected to pass `sha256` digests of input
  and output, not raw text. The `meta` field carries non-sensitive
  context (model, tool, token count, agent).
- **Decay:** `clearLogs()` removes the entire chain and writes a fresh
  genesis entry tagged `audit:cleared` — clearing is itself an audit
  event.
- **Threat model (from [aiAuditLog.js:19-23](../src/utils/aiAuditLog.js#L19)):**
  - *Detects:* silent tampering with prior entries, replay of stale entries.
  - *Does NOT detect:* deletion of the entire log (mitigated by
    `lastSeq` meta snapshots).
  - *Does NOT prevent:* a malicious browser extension with full IDB
    access rewriting the chain end-to-end — there is no signing key.

### Layer 4 — Cloud encrypted backup (optional, off by default)

- **Backend:** Google Drive (`appDataFolder`) or OneDrive — user's own
  cloud account, app-only folder.
- **Encryption:** AES-GCM-256, key derived via PBKDF2-SHA256 600 000
  iterations (S8.5 hardening) from a user-supplied passphrase. Envelope
  is `VS2\0` magic + 16-byte random salt + 12-byte random IV.
- **Decay:** User-controlled. Deleting from cloud removes the only
  remote copy.
- **Privacy property:** The cloud provider sees opaque ciphertext.
  Losing the passphrase = data loss; the app cannot recover it.

## The ephemeral layer (NOT memory)

| Layer | Backend | Why this is not memory |
|---|---|---|
| Component `useState` / route state | React VDOM | Lost on tab close. Used for in-flight form data, modal open/close, loading flags. |

Anything that lives only in React state is *session*, not memory. The
distinction matters: a memory layer must survive a reload; ephemeral
state must not survive a reload (otherwise stale UI state corrupts the
next session).

## Memory hygiene rules

These apply to every feature that touches a memory layer:

1. **Field allow-list at write.** `veteranProfile.js` enforces this via
   `VALID_PROFILE_FIELDS`. `myPacketManager.js` enforces it via the
   `PACKET_DOC_TYPES` enum. New fields require an explicit allow-list
   edit — never a free-form passthrough.
2. **Sanitize at write, validate at read.** `sanitizeString` truncates
   to 500 chars in `veteranProfile.js`; the audit log SHA-256s before
   storage.
3. **No cleartext PII to cloud LLMs.** The PII scrubber sits between
   memory reads and `generateWithCloud`; the dual-LLM split sits
   between raw OCR text and the synthesizer.
4. **Clear paths are first-class.** Every layer exposes a `clear*`
   API and the in-app "Clear all data" control wires through to each.
   Memory the user cannot remove is not memory — it's surveillance.
5. **Audit-log every model call.** Tool surfaces that call
   `generateWithSwarm` / `generateWithCloud` are expected to also call
   `logModelCallWithDigests` so the veteran can replay what the model
   saw.

## What's deliberately NOT here

- **No server-side memory.** Zero-knowledge stance — no user account,
  no remote DB, no cross-device sync except via Layer 4's
  encrypted-cloud-backup pattern.
- **No automatic semantic memory** (e.g. "Claude remembers your
  preferences across sessions"). Episodic memory only — Layer 3 is a
  log of calls, not a learned profile.
- **No expiration / TTL.** Veterans' claim data has decade-long
  lifecycles. Auto-expiring claim evidence would be hostile.

## When to re-audit this file

- Adding a new persistence backend (e.g. WebSQL, OPFS, a new IDB).
- Adding a new cloud sync target.
- Adding any AI tool that touches a memory layer without going through
  the existing extract/scrub/wrap pipeline.
- Changing the hash function or PBKDF2 parameters.
