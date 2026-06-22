/**
 * Vet-Rate.org - Cloud Encryption Utility
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * "THE ARMORED TRANSPORT" - AES-256-GCM encryption for cloud backups
 *
 * Encrypts data BEFORE it leaves the browser, so even if someone
 * gains access to the veteran's cloud storage, the data is unreadable.
 *
 * Security Features:
 * - AES-256-GCM encryption (NIST approved, same as military classified systems)
 * - PBKDF2-SHA256 key derivation with 600,000 iterations (OWASP 2023)
 * - Random 96-bit IV for each encryption (prevents pattern analysis)
 * - Optional passphrase for extra protection
 *
 * See docs/CRYPTO_AUDIT.md for the full Web Crypto audit. If you bump
 * PBKDF2_ITERATIONS again, also update CRYPTO_AUDIT.md.
 */

// VR_ENC_V3 = V2 + AAD-bound GCM (domain separation). V2 = PBKDF2 600k.
// V1 = PBKDF2 100k. Decrypt path picks iteration count + AAD presence from
// the envelope version so older backups still open.
const ENCRYPTION_VERSION = "VR_ENC_V3";
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_LEGACY_ITERATIONS = 100_000;

// AAD binds ciphertext to its envelope context — a V3 ciphertext cannot be
// repurposed against a V3-cloud-sync envelope (different AAD) or vice versa.
const AAD_V3 = new TextEncoder().encode("vetrate.cloud-encryption.v3");

function iterationsForVersion(version) {
  return version === "VR_ENC_V1" ? PBKDF2_LEGACY_ITERATIONS : PBKDF2_ITERATIONS;
}

function aadForVersion(version) {
  return version === "VR_ENC_V3" ? AAD_V3 : undefined;
}

/**
 * Check if Web Crypto API is available
 */
export const isCryptoAvailable = () => {
  return !!(window.crypto && window.crypto.subtle);
};

/**
 * Generate a random encryption key for one-time use
 */
export const generateEncryptionKey = async () => {
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  return key;
};

const deriveKeyFromPassphrase = async (
  passphrase,
  salt,
  iterations = PBKDF2_ITERATIONS,
) => {
  const encoder = new TextEncoder();
  const passphraseBuffer = encoder.encode(passphrase);

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    passphraseBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  return key;
};

/**
 * Convert ArrayBuffer to Base64 string
 */
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Convert Base64 string to ArrayBuffer.
 *
 * NOTE: feed the result to Web Crypto wrapped in a Uint8Array view
 * (`new Uint8Array(base64ToArrayBuffer(x))`), never as the bare ArrayBuffer.
 * jsdom's Web IDL BufferSource check (Node <=20) rejects a bare ArrayBuffer as
 * "not instance of ArrayBuffer, Buffer, TypedArray, or DataView" while accepting
 * a typed-array view; Node 25's runtime is lenient, so a bare buffer passes
 * locally and only fails in CI. The salt/iv/key/data call sites all wrap.
 */
const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Encrypt data for cloud storage
 *
 * @param {object} data - The data to encrypt (will be JSON stringified)
 * @param {string} passphrase - Optional passphrase for extra protection
 * @returns {object} Encrypted package with metadata
 */
export const encryptForCloud = async (data, passphrase = null) => {
  if (!isCryptoAvailable()) {
    throw new Error("Web Crypto API not available. Please use HTTPS.");
  }

  const encoder = new TextEncoder();
  const dataString = JSON.stringify(data);
  const dataBuffer = encoder.encode(dataString);

  // Generate random salt and IV
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  let key;
  let keyExport = null;

  if (passphrase) {
    // Use passphrase-derived key (user remembers passphrase)
    key = await deriveKeyFromPassphrase(passphrase, salt);
  } else {
    // Generate random key and export it (stored with backup metadata)
    key = await generateEncryptionKey();
    const rawKey = await window.crypto.subtle.exportKey("raw", key);
    keyExport = arrayBufferToBase64(rawKey);
  }

  // Encrypt the data (AAD binds ciphertext to V3 cloud-encryption context).
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv, additionalData: AAD_V3 },
    key,
    dataBuffer,
  );

  // Create encrypted package
  const encryptedPackage = {
    version: ENCRYPTION_VERSION,
    encrypted: true,
    timestamp: new Date().toISOString(),
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    data: arrayBufferToBase64(encryptedBuffer),
    // Only include key if no passphrase (key stored locally, not in cloud)
    hasPassphrase: !!passphrase,
  };

  // Return package and key info separately
  return {
    encryptedPackage,
    keyExport, // null if passphrase used, otherwise the exported key
  };
};

/**
 * Decrypt data from cloud storage
 *
 * @param {object} encryptedPackage - The encrypted package from cloud
 * @param {string} passphraseOrKey - Either the passphrase or the exported key
 * @param {boolean} isPassphrase - Whether the second param is a passphrase
 * @returns {object} Decrypted data
 */
export const decryptFromCloud = async (
  encryptedPackage,
  passphraseOrKey,
  isPassphrase = false,
) => {
  if (!isCryptoAvailable()) {
    throw new Error("Web Crypto API not available. Please use HTTPS.");
  }

  // Validate package
  if (!encryptedPackage.encrypted || !encryptedPackage.version) {
    throw new Error("Invalid encrypted package");
  }

  // Extract components
  const salt = new Uint8Array(base64ToArrayBuffer(encryptedPackage.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(encryptedPackage.iv));
  const encryptedData = new Uint8Array(
    base64ToArrayBuffer(encryptedPackage.data),
  );

  let key;

  if (isPassphrase || encryptedPackage.hasPassphrase) {
    key = await deriveKeyFromPassphrase(
      passphraseOrKey,
      salt,
      iterationsForVersion(encryptedPackage.version),
    );
  } else {
    // Import the raw key
    const keyBuffer = new Uint8Array(base64ToArrayBuffer(passphraseOrKey));
    key = await window.crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
  }

  // Decrypt — V3 envelopes are bound to AAD; V1/V2 envelopes have none.
  try {
    const aad = aadForVersion(encryptedPackage.version);
    const params = { name: "AES-GCM", iv: iv };
    if (aad) params.additionalData = aad;

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      params,
      key,
      encryptedData,
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);
    return JSON.parse(jsonString);
  } catch (err) {
    throw new Error("Decryption failed. Wrong passphrase or corrupted data.");
  }
};

/**
 * Generate a secure backup filename with timestamp
 */
export const generateSecureBackupName = (prefix = "vetrate_backup") => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const randomId = window.crypto
    .getRandomValues(new Uint8Array(4))
    .reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
  return `${prefix}_${timestamp}_${randomId}.enc.json`;
};

const RECOGNIZED_VERSIONS = new Set(["VR_ENC_V1", "VR_ENC_V2", "VR_ENC_V3"]);

/**
 * Check if a backup is encrypted
 */
export const isEncryptedBackup = (data) => {
  return (
    data && data.encrypted === true && RECOGNIZED_VERSIONS.has(data.version)
  );
};

/**
 * ───────────────────────── Local key custody (S16) ─────────────────────────
 *
 * A passphrase-less backup generates a random per-backup DEK (data encryption
 * key) that must persist on-device so the backup can be restored. Historically
 * that DEK sat UNWRAPPED in plaintext localStorage (`vet_rate_backup_key_*`) —
 * readable by any XSS, a shared-device user, or the one-click debug dump.
 *
 * The optional device-passphrase keystore wraps each DEK under a
 * passphrase-anchored KEK (PBKDF2-SHA256 → AES-KW), so the at-rest material is
 * useless without the passphrase. AES-KW (RFC 3394) carries an integrity check,
 * so an unwrap under the wrong KEK throws — which is also how we verify the
 * passphrase on unlock (the `*_verifier` blob).
 *
 * Custody only — the cloud wire format (VR_ENC_V3 / VS3) is untouched. On
 * restore, getLocalKey unwraps and re-exports the DEK to base64 to feed the
 * unchanged decryptFromCloud raw-key branch; wrapping protects the key at REST,
 * not against in-session XSS while a decrypt is live.
 *
 * NOTE: storeLocalKey/getLocalKey are now async — Web Crypto unwrap is
 * inherently async, so the wrapped path cannot stay synchronous. All call sites
 * were already inside async functions. See docs/CRYPTO_AUDIT.md §7 and
 * docs/audit/S16_ROTATION_DEAUTH_DESIGN.md.
 */
const KEY_STORAGE_PREFIX = "vet_rate_backup_key_"; // legacy plaintext DEK (base64 raw)
const WRAPPED_KEY_PREFIX = "vet_rate_wrapped_key_"; // AES-KW wrapped DEK (base64)
const ROTATING_KEY_PREFIX = "vet_rate_rotating_key_"; // temp wrapped DEK mid-rotation
const KEK_META_KEY = "vet_rate_kek_meta"; // { v, salt, iterations, createdAt }
const KEK_VERIFIER_KEY = "vet_rate_kek_verifier"; // AES-KW wrap of a throwaway key
const KEK_VERIFIER_TAG_KEY = "vet_rate_kek_verifier_tag"; // SHA-256 of the verifier bytes (corruption check)
const KEK_ROTATING_KEY = "vet_rate_kek_rotating"; // rotation commit marker (new meta + verifier)

const KEYSTORE_LOCK_NAME = "vet_rate_keystore_rotation";
const withKeystoreLock = (fn) =>
  navigator?.locks?.request
    ? navigator.locks.request(KEYSTORE_LOCK_NAME, fn)
    : fn();

// Unlocked KEK for this tab session only — never persisted.
let sessionKEK = null;

/**
 * Derive the passphrase-anchored key-encryption key (AES-KW, non-extractable).
 */
export const deriveKEK = async (
  passphrase,
  salt,
  iterations = PBKDF2_ITERATIONS,
) => {
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
};

const importRawDEK = (dekBase64) =>
  window.crypto.subtle.importKey(
    "raw",
    new Uint8Array(base64ToArrayBuffer(dekBase64)),
    { name: "AES-GCM", length: 256 },
    true, // extractable: AES-KW must read the bytes to wrap; restore re-exports
    ["encrypt", "decrypt"],
  );

const wrapDEK = async (dekBase64, kek) => {
  const dek = await importRawDEK(dekBase64);
  const wrapped = await window.crypto.subtle.wrapKey("raw", dek, kek, {
    name: "AES-KW",
  });
  return arrayBufferToBase64(wrapped);
};

const unwrapDEK = async (wrappedBase64, kek) => {
  const dek = await window.crypto.subtle.unwrapKey(
    "raw",
    new Uint8Array(base64ToArrayBuffer(wrappedBase64)),
    kek,
    { name: "AES-KW" },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  return arrayBufferToBase64(await window.crypto.subtle.exportKey("raw", dek));
};

const makeVerifier = async (kek) => {
  const throwaway = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const wrapped = await window.crypto.subtle.wrapKey("raw", throwaway, kek, {
    name: "AES-KW",
  });
  return arrayBufferToBase64(wrapped);
};

// AES-KW wrap of a 256-bit key is exactly 40 bytes (RFC 3394: n+1 64-bit blocks
// = 4 + 1). A stored verifier/wrapped blob that decodes to any other length — or
// is not valid base64 — is corrupt, NOT a wrong-passphrase case. Distinguishing
// the two lets unlock report corruption honestly instead of telling the user
// their (correct) passphrase is wrong.
const WRAPPED_BLOB_BYTES = 40;

const KEYSTORE_CORRUPT_MESSAGE =
  "Device keystore is corrupted and cannot be unlocked. Restore a recovery export if you have one; otherwise this device's saved backup keys are unrecoverable.";

// Decode a stored AES-KW blob, throwing a corruption error (never a wrong-
// passphrase error) if it is missing, not base64, or the wrong length.
const readWrappedBlob = (base64) => {
  if (base64 === null) throw new Error(KEYSTORE_CORRUPT_MESSAGE);
  let bytes;
  try {
    bytes = new Uint8Array(base64ToArrayBuffer(base64));
  } catch {
    throw new Error(KEYSTORE_CORRUPT_MESSAGE);
  }
  if (bytes.length !== WRAPPED_BLOB_BYTES) {
    throw new Error(KEYSTORE_CORRUPT_MESSAGE);
  }
  return bytes;
};

// PBKDF2 iteration counts must be a positive 32-bit integer or Web Crypto's
// deriveKey throws a raw, unhandled TypeError. A descriptor carrying a truthy-but-
// invalid value (negative, non-numeric, out of range) falls back to the default —
// which self-heals, since every descriptor this code writes uses PBKDF2_ITERATIONS.
const validIterations = (n) =>
  Number.isInteger(n) && n > 0 && n <= 0xffffffff ? n : PBKDF2_ITERATIONS;

const computeVerifierTag = async (verifierBytes) =>
  arrayBufferToBase64(
    await window.crypto.subtle.digest("SHA-256", verifierBytes),
  );

// Parse + validate the KEK descriptor, returning the decoded salt and iteration
// count. A corrupt descriptor (unparseable JSON, missing/invalid salt) throws a
// clear corruption error rather than a raw SyntaxError that would escape unlock
// unhandled and brick every future attempt.
const readKeystoreMeta = () => {
  let meta = null;
  try {
    meta = JSON.parse(localStorage.getItem(KEK_META_KEY));
  } catch {
    meta = null;
  }
  if (!meta || typeof meta.salt !== "string") {
    throw new Error(KEYSTORE_CORRUPT_MESSAGE);
  }
  let salt;
  try {
    salt = new Uint8Array(base64ToArrayBuffer(meta.salt));
  } catch {
    throw new Error(KEYSTORE_CORRUPT_MESSAGE);
  }
  if (salt.length === 0) throw new Error(KEYSTORE_CORRUPT_MESSAGE);
  return { salt, iterations: validIterations(meta.iterations) };
};

/**
 * Whether a device passphrase has been set up on this device.
 */
export const isDevicePassphraseEnabled = () =>
  localStorage.getItem(KEK_META_KEY) !== null;

/**
 * Whether the keystore is unlocked in this tab session.
 */
export const isKeystoreUnlocked = () => sessionKEK !== null;

/**
 * Whether the keystore exists but is locked this session — the state the restore
 * UI branches on to prompt for the device passphrase. Distinct from "no
 * passphrase set": a disabled keystore is not "locked", it is simply absent.
 */
export const isDeviceKeystoreLocked = () =>
  isDevicePassphraseEnabled() && !isKeystoreUnlocked();

/**
 * Every backup id that has a stored key (plaintext or wrapped).
 */
export const listBackupKeyIds = () => {
  const ids = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_STORAGE_PREFIX)) {
      ids.add(k.slice(KEY_STORAGE_PREFIX.length));
    } else if (k && k.startsWith(WRAPPED_KEY_PREFIX)) {
      ids.add(k.slice(WRAPPED_KEY_PREFIX.length));
    }
  }
  return Array.from(ids);
};

// Wrap a still-plaintext DEK, verify the roundtrip, THEN delete the plaintext —
// never the reverse, so an interrupted migration can't strand a key.
const migratePlaintextKey = async (backupId) => {
  const plaintext = localStorage.getItem(KEY_STORAGE_PREFIX + backupId);
  if (plaintext === null) return;
  const wrapped = await wrapDEK(plaintext, sessionKEK);
  if ((await unwrapDEK(wrapped, sessionKEK)) !== plaintext) {
    throw new Error("Key migration verification failed; plaintext retained.");
  }
  localStorage.setItem(WRAPPED_KEY_PREFIX + backupId, wrapped);
  localStorage.removeItem(KEY_STORAGE_PREFIX + backupId);
};

// Sweep every still-plaintext DEK into the wrapped store under the session KEK.
// Per-key isolation: one un-wrappable key (e.g. a truncated crash-left blob)
// is skipped so the others still heal — without it a single bad key would abort
// the whole sweep and strand every later key in plaintext.
const migrateAllPlaintextKeys = async () => {
  for (const id of listBackupKeyIds()) {
    try {
      await migratePlaintextKey(id);
    } catch {
      /* skip this key; the others still heal */
    }
  }
};

const purgeRotatingTemp = () => {
  const stale = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(ROTATING_KEY_PREFIX)) stale.push(k);
  }
  stale.forEach((k) => localStorage.removeItem(k));
};

/**
 * Idempotent, forward-only completion of an interrupted passphrase rotation:
 * move any remaining temp→live, swap the KEK descriptor, clear the marker. Pure
 * localStorage moves — it derives no KEK and is passphrase-free by design.
 *
 * Because it is passphrase-free it does NOT cryptographically verify the marker —
 * it trusts the marker's descriptor + verifier and overwrites the live META/
 * VERIFIER with them. It is therefore NOT safe to call on an unverified or
 * injected marker before a passphrase is known: a shape-valid-but-garbage marker
 * would commit an unconfirmed KEK over the only intact old material and brick the
 * keystore. Callers must confirm the new KEK first — `unlockDeviceKeystore` gates
 * this behind `unwrapsUnder`, and `rotateDevicePassphrase` writes a freshly
 * derived marker immediately before calling it. Only a *structurally* broken
 * marker (unparseable / wrong shape) is rolled back here; a shape-valid marker is
 * assumed pre-confirmed by the caller.
 */
export const completePendingRotation = () => {
  const markerRaw = localStorage.getItem(KEK_ROTATING_KEY);
  if (!markerRaw) {
    // No marker → no rotation, OR a sibling tab is mid-phase-1. Do NOT purge
    // temp slots here: that would delete an in-flight rotation's staged work.
    // Genuine orphans are cleared by rotateDevicePassphrase's own pre-purge.
    return false;
  }
  let marker;
  try {
    marker = JSON.parse(markerRaw);
  } catch {
    marker = null;
  }
  if (
    !marker ||
    !marker.meta ||
    typeof marker.meta.salt !== "string" ||
    typeof marker.verifier !== "string"
  ) {
    // Corrupt commit marker: the new KEK it described was never confirmed, so
    // the temp slots wrapped under it are unrecoverable. Roll back to the still
    // intact old META/VERIFIER (the old passphrase keeps working) and discard
    // the debris rather than throwing — an unguarded parse here would brick
    // every future unlock.
    purgeRotatingTemp();
    localStorage.removeItem(KEK_ROTATING_KEY);
    return false;
  }
  const tempIds = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(ROTATING_KEY_PREFIX)) {
      tempIds.push(k.slice(ROTATING_KEY_PREFIX.length));
    }
  }
  for (const id of tempIds) {
    const val = localStorage.getItem(ROTATING_KEY_PREFIX + id);
    if (val !== null) localStorage.setItem(WRAPPED_KEY_PREFIX + id, val);
    localStorage.removeItem(ROTATING_KEY_PREFIX + id);
  }
  localStorage.setItem(KEK_META_KEY, JSON.stringify(marker.meta));
  localStorage.setItem(KEK_VERIFIER_KEY, marker.verifier);
  if (typeof marker.verifierTag === "string") {
    localStorage.setItem(KEK_VERIFIER_TAG_KEY, marker.verifierTag);
  } else {
    localStorage.removeItem(KEK_VERIFIER_TAG_KEY);
  }
  localStorage.removeItem(KEK_ROTATING_KEY);
  return true;
};

/**
 * Turn on the device passphrase and migrate existing plaintext keys to wrapped.
 */
const _enableDevicePassphrase = async (passphrase) => {
  if (!isCryptoAvailable()) {
    throw new Error("Web Crypto API not available. Please use HTTPS.");
  }
  if (isDevicePassphraseEnabled()) {
    throw new Error(
      "Device passphrase already enabled. Use rotateDevicePassphrase to change it.",
    );
  }
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveKEK(passphrase, salt);
  const verifier = await makeVerifier(kek);
  // Descriptor + verifier first: a crash mid-migration then still leaves an
  // unlockable keystore, and getLocalKey/storeLocalKey migrate the rest lazily.
  localStorage.setItem(
    KEK_META_KEY,
    JSON.stringify({
      v: 1,
      salt: arrayBufferToBase64(salt),
      iterations: PBKDF2_ITERATIONS,
      createdAt: new Date().toISOString(),
    }),
  );
  localStorage.setItem(KEK_VERIFIER_KEY, verifier);
  localStorage.setItem(
    KEK_VERIFIER_TAG_KEY,
    await computeVerifierTag(new Uint8Array(base64ToArrayBuffer(verifier))),
  );
  sessionKEK = kek;
  await migrateAllPlaintextKeys();
  return true;
};

// Read + structurally validate the rotation commit marker, returning the new
// KEK descriptor (salt, iterations) and the decoded verifier bytes — or null if
// there is no marker, or it is unparseable / wrong-shape / wrong-length. A
// non-null result is only "shape valid": unlock still confirms the new KEK
// cryptographically (unwrapsUnder) BEFORE committing, so a shape-valid marker
// carrying a garbage verifier can never overwrite the intact old material.
const readPendingRotation = () => {
  const raw = localStorage.getItem(KEK_ROTATING_KEY);
  if (raw === null) return null;
  let marker;
  try {
    marker = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !marker ||
    !marker.meta ||
    typeof marker.meta.salt !== "string" ||
    typeof marker.verifier !== "string"
  ) {
    return null;
  }
  let salt;
  try {
    salt = new Uint8Array(base64ToArrayBuffer(marker.meta.salt));
  } catch {
    return null;
  }
  if (salt.length === 0) return null;
  let verifierBytes;
  try {
    verifierBytes = readWrappedBlob(marker.verifier);
  } catch {
    return null;
  }
  return {
    salt,
    iterations: validIterations(marker.meta.iterations),
    verifierBytes,
  };
};

// True iff `verifierBytes` (an AES-KW blob) unwraps under `kek`. RFC 3394's
// integrity check makes a wrong-KEK unwrap throw, so a success confirms the KEK
// is the one the verifier was made under — i.e. the passphrase is correct.
const unwrapsUnder = async (verifierBytes, kek) => {
  try {
    await window.crypto.subtle.unwrapKey(
      "raw",
      verifierBytes,
      kek,
      { name: "AES-KW" },
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    return true;
  } catch {
    return false;
  }
};

// Whether every live wrapped DEK opens under `kek` (true when there are none).
// Detects a phase-2 rotation crash: a confirmable marker is present and the OLD
// passphrase verifies the still-intact old descriptor, but the live keys were
// already promoted under the NEW KEK — so an old-passphrase unlock would report
// success yet serve a keystore it cannot read. The unwrap attempts are pure reads.
const wrappedKeysReadableUnder = async (kek) => {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(WRAPPED_KEY_PREFIX)) continue;
    try {
      await unwrapDEK(localStorage.getItem(k), kek);
    } catch {
      return false;
    }
  }
  return true;
};

// Best-effort heal of any plaintext DEK once the session KEK is set. A single
// un-wrappable key is skipped (migrateAllPlaintextKeys is per-key resilient) and
// any larger failure is swallowed — the unlock has already succeeded; the
// plaintext stays for the next unlock to retry.
const sweepPlaintextKeys = async () => {
  try {
    await migrateAllPlaintextKeys();
  } catch {
    /* plaintext retained, retried later; unlock succeeded */
  }
};

/**
 * Unlock the keystore for this session by deriving + verifying the KEK.
 */
const _unlockDeviceKeystore = async (passphrase) => {
  if (!isDevicePassphraseEnabled()) {
    throw new Error("Device passphrase is not enabled.");
  }
  // Verify-before-commit: if a rotation is mid-flight, finish it ONLY once the
  // passphrase is proven to derive the marker's NEW KEK (its verifier unwraps
  // under it). A shape-valid marker carrying a garbage verifier is never
  // committed, so the intact old META/VERIFIER survive for the old passphrase —
  // the C1 brick (committing an unconfirmed KEK over the only good material)
  // cannot happen.
  const pending = readPendingRotation();
  if (pending) {
    const newKEK = await deriveKEK(
      passphrase,
      pending.salt,
      pending.iterations,
    ).catch(() => null);
    if (newKEK && (await unwrapsUnder(pending.verifierBytes, newKEK))) {
      completePendingRotation(); // promote temp→live, swap descriptor, clear marker
      sessionKEK = newKEK;
      await sweepPlaintextKeys();
      return true;
    }
    // New KEK unconfirmed → leave the marker for a later forward completion and
    // fall back to the still-intact old material below.
  }
  // A marker that is structurally broken (unparseable / wrong shape / wrong
  // length) can never be completed forward; once the OLD passphrase is confirmed
  // below, discard the debris.
  const brokenMarker =
    !pending && localStorage.getItem(KEK_ROTATING_KEY) !== null;
  // Old path. readKeystoreMeta + readWrappedBlob throw KEYSTORE_CORRUPT on
  // damaged material (an honest corruption error, never a bogus wrong-passphrase).
  const { salt, iterations } = readKeystoreMeta();
  const verifierBytes = readWrappedBlob(localStorage.getItem(KEK_VERIFIER_KEY));
  const storedTag = localStorage.getItem(KEK_VERIFIER_TAG_KEY);
  if (
    storedTag !== null &&
    (await computeVerifierTag(verifierBytes)) !== storedTag
  ) {
    throw new Error(KEYSTORE_CORRUPT_MESSAGE);
  }
  const kek = await deriveKEK(passphrase, salt, iterations).catch(() => null);
  if (!kek || !(await unwrapsUnder(verifierBytes, kek))) {
    throw new Error("Incorrect device passphrase.");
  }
  // A confirmable rotation marker is present but this passphrase derived only the
  // OLD KEK (it verified the still-intact old descriptor, not the marker's new
  // KEK). If the live keys were already promoted under the new KEK — a phase-2
  // crash, the state pinned by the mid-phase-2 recovery test — the old KEK cannot
  // read them, so don't report a false success. Steer the user to the new
  // passphrase, which completes the rotation forward. A still-readable keystore
  // (phase-1 interruption, keys untouched) unlocks normally and leaves the marker.
  if (pending && !(await wrappedKeysReadableUnder(kek))) {
    throw new Error(
      "A device passphrase change is in progress. Unlock with your new passphrase.",
    );
  }
  if (brokenMarker) {
    purgeRotatingTemp();
    localStorage.removeItem(KEK_ROTATING_KEY);
  }
  sessionKEK = kek;
  if (storedTag === null) {
    localStorage.setItem(
      KEK_VERIFIER_TAG_KEY,
      await computeVerifierTag(verifierBytes),
    );
  }
  // Heal any plaintext DEK left by a crash or a pre-keystore backup now that the
  // KEK is in hand. Best-effort: the unlock itself has already succeeded.
  await sweepPlaintextKeys();
  return true;
};

/**
 * Drop the in-session KEK (re-lock without touching stored material).
 */
export const lockDeviceKeystore = () => {
  sessionKEK = null;
};

/**
 * Re-wrap every DEK under a new passphrase. All-or-nothing: phase 1 writes temp
 * slots and a commit marker; phase 2 promotes them. An interruption is repaired
 * by completePendingRotation at the next unlock.
 */
const _rotateDevicePassphrase = async (newPassphrase) => {
  if (!isCryptoAvailable()) {
    throw new Error("Web Crypto API not available. Please use HTTPS.");
  }
  if (!isDevicePassphraseEnabled()) {
    throw new Error("Device passphrase is not enabled.");
  }
  if (sessionKEK === null) {
    throw new Error("Unlock the keystore before rotating its passphrase.");
  }
  purgeRotatingTemp(); // clear debris from a prior aborted rotation
  const oldKEK = sessionKEK;
  const newSalt = window.crypto.getRandomValues(new Uint8Array(16));
  const newKEK = await deriveKEK(newPassphrase, newSalt);
  const verifier = await makeVerifier(newKEK);
  const verifierTag = await computeVerifierTag(
    new Uint8Array(base64ToArrayBuffer(verifier)),
  );

  // Phase 1 (abortable): re-wrap every DEK under the new KEK into temp slots.
  // Throwing here leaves live keys untouched — no marker means no commit.
  // Re-scan and fold until the id set stops growing, so a key a sibling tab
  // stores mid-rotation is still captured (C3); each id is staged at most once.
  const staged = new Set();
  const stageId = async (id) => {
    if (staged.has(id)) return;
    const wrapped = localStorage.getItem(WRAPPED_KEY_PREFIX + id);
    let dekBase64;
    if (wrapped !== null) {
      dekBase64 = await unwrapDEK(wrapped, oldKEK);
    } else {
      const plaintext = localStorage.getItem(KEY_STORAGE_PREFIX + id);
      if (plaintext === null) return;
      dekBase64 = plaintext;
    }
    localStorage.setItem(
      ROTATING_KEY_PREFIX + id,
      await wrapDEK(dekBase64, newKEK),
    );
    staged.add(id);
  };
  let lastCount = -1;
  while (staged.size !== lastCount) {
    lastCount = staged.size;
    for (const id of listBackupKeyIds()) await stageId(id);
  }
  // Commit point — the marker carries the new descriptor + verifier + tag.
  localStorage.setItem(
    KEK_ROTATING_KEY,
    JSON.stringify({
      meta: {
        v: 1,
        salt: arrayBufferToBase64(newSalt),
        iterations: PBKDF2_ITERATIONS,
        createdAt: new Date().toISOString(),
      },
      verifier,
      verifierTag,
    }),
  );

  // Phase 2: promote temp→live, swap descriptor, clear marker.
  completePendingRotation();
  for (const id of staged) {
    if (localStorage.getItem(WRAPPED_KEY_PREFIX + id) !== null) {
      localStorage.removeItem(KEY_STORAGE_PREFIX + id); // drop superseded plaintext
    }
  }
  sessionKEK = newKEK;
  return true;
};

/**
 * Local self-deauthorization: erase all on-device key material and re-lock.
 * Returns the number of storage entries removed. Cannot recall already-synced
 * cloud files (see S16 design §3).
 */
export const wipeLocalKeystore = () => {
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (
      k &&
      (k.startsWith(KEY_STORAGE_PREFIX) ||
        k.startsWith(WRAPPED_KEY_PREFIX) ||
        k.startsWith(ROTATING_KEY_PREFIX) ||
        k === KEK_META_KEY ||
        k === KEK_VERIFIER_KEY ||
        k === KEK_VERIFIER_TAG_KEY ||
        k === KEK_ROTATING_KEY)
    ) {
      toRemove.push(k);
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
  sessionKEK = null;
  return toRemove.length;
};

const RECOVERY_BUNDLE_FORMAT = "vetrate.keystore-recovery";

/**
 * Export the at-rest keystore — KEK descriptor + verifier + every wrapped DEK —
 * as a portable bundle the USER downloads and keeps (Q-RECOVERY). Every byte is
 * already wrapped under the passphrase-anchored KEK, so the bundle is useless
 * without the device passphrase; this is NOT escrow and we never hold a copy.
 * Un-migrated plaintext DEKs are deliberately excluded so a bundle can never
 * carry an unwrapped key. Runs under the keystore lock for a snapshot that is
 * never captured mid-rotation.
 */
const _exportRecoveryBundle = async () => {
  if (!isDevicePassphraseEnabled()) {
    throw new Error("Device passphrase is not enabled; nothing to export.");
  }
  let meta;
  try {
    meta = JSON.parse(localStorage.getItem(KEK_META_KEY));
  } catch {
    meta = null;
  }
  if (!meta || typeof meta.salt !== "string") {
    throw new Error(KEYSTORE_CORRUPT_MESSAGE);
  }
  const wrappedKeys = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(WRAPPED_KEY_PREFIX)) {
      wrappedKeys[k.slice(WRAPPED_KEY_PREFIX.length)] = localStorage.getItem(k);
    }
  }
  return {
    format: RECOVERY_BUNDLE_FORMAT,
    v: 1,
    exportedAt: new Date().toISOString(),
    meta,
    verifier: localStorage.getItem(KEK_VERIFIER_KEY),
    verifierTag: localStorage.getItem(KEK_VERIFIER_TAG_KEY),
    wrappedKeys,
  };
};

/**
 * Restore a recovery bundle onto a device that has NO keystore (fresh or freshly
 * deauthorized). Refuses to overwrite a live keystore — an import would clobber
 * its KEK descriptor and orphan every DEK wrapped under it. After import the
 * keystore is present but LOCKED; the user unlocks with the same passphrase the
 * bundle was made under (a wrong passphrase or a tampered bundle simply fails
 * that unlock — there is no pre-existing material to brick). Returns the count
 * of wrapped keys written.
 */
const _importRecoveryBundle = async (bundle) => {
  if (isDevicePassphraseEnabled()) {
    throw new Error(
      "This device already has a passphrase keystore. Deauthorize it before importing a recovery bundle.",
    );
  }
  if (
    !bundle ||
    bundle.format !== RECOVERY_BUNDLE_FORMAT ||
    !bundle.meta ||
    typeof bundle.meta.salt !== "string" ||
    typeof bundle.verifier !== "string" ||
    !bundle.wrappedKeys ||
    typeof bundle.wrappedKeys !== "object"
  ) {
    throw new Error("Not a valid Vet-Rate keystore recovery bundle.");
  }
  localStorage.setItem(KEK_META_KEY, JSON.stringify(bundle.meta));
  localStorage.setItem(KEK_VERIFIER_KEY, bundle.verifier);
  if (typeof bundle.verifierTag === "string") {
    localStorage.setItem(KEK_VERIFIER_TAG_KEY, bundle.verifierTag);
  }
  let count = 0;
  for (const [id, wrapped] of Object.entries(bundle.wrappedKeys)) {
    if (typeof wrapped === "string") {
      localStorage.setItem(WRAPPED_KEY_PREFIX + id, wrapped);
      count += 1;
    }
  }
  sessionKEK = null; // imported locked — the user unlocks with the passphrase
  return count;
};

/**
 * Store encryption key locally (indexed by backup filename). When a device
 * passphrase is enabled the key is wrapped under the session KEK; refusing to
 * silently fall back to plaintext when locked.
 */
const _storeLocalKey = async (backupId, keyExport) => {
  if (!keyExport) return;
  if (isDevicePassphraseEnabled()) {
    if (sessionKEK === null) {
      throw new Error(
        "Device keystore is locked. Unlock it before saving a backup key.",
      );
    }
    localStorage.setItem(
      WRAPPED_KEY_PREFIX + backupId,
      await wrapDEK(keyExport, sessionKEK),
    );
    localStorage.removeItem(KEY_STORAGE_PREFIX + backupId);
  } else {
    localStorage.setItem(KEY_STORAGE_PREFIX + backupId, keyExport);
  }
};

/**
 * Retrieve encryption key from local storage as base64 raw (for the
 * decryptFromCloud raw-key branch). Unwraps a wrapped key when present
 * (requires unlock); lazily migrates a plaintext key when unlocked.
 */
const _getLocalKey = async (backupId) => {
  const wrapped = localStorage.getItem(WRAPPED_KEY_PREFIX + backupId);
  if (wrapped !== null) {
    if (sessionKEK === null) {
      // Bare sentinel (not a sentence) so the restore UI can branch on it and
      // render its own unlock prompt — mirrors the PASSPHRASE_REQUIRED sentinel
      // the restore flow already keys on.
      throw new Error("KEYSTORE_LOCKED");
    }
    const dekBase64 = await unwrapDEK(wrapped, sessionKEK);
    localStorage.removeItem(KEY_STORAGE_PREFIX + backupId); // drop any stale sibling
    return dekBase64;
  }
  const plaintext = localStorage.getItem(KEY_STORAGE_PREFIX + backupId);
  if (plaintext !== null && sessionKEK !== null) {
    await migratePlaintextKey(backupId);
  }
  return plaintext;
};

export const enableDevicePassphrase = (passphrase) =>
  withKeystoreLock(() => _enableDevicePassphrase(passphrase));
export const unlockDeviceKeystore = (passphrase) =>
  withKeystoreLock(() => _unlockDeviceKeystore(passphrase));
export const storeLocalKey = (backupId, keyExport) =>
  withKeystoreLock(() => _storeLocalKey(backupId, keyExport));
export const getLocalKey = (backupId) =>
  withKeystoreLock(() => _getLocalKey(backupId));
export const rotateDevicePassphrase = (newPassphrase) =>
  withKeystoreLock(() => _rotateDevicePassphrase(newPassphrase));
export const exportRecoveryBundle = () =>
  withKeystoreLock(() => _exportRecoveryBundle());
export const importRecoveryBundle = (bundle) =>
  withKeystoreLock(() => _importRecoveryBundle(bundle));
