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
 * Convert Base64 string to ArrayBuffer
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
  const encryptedData = base64ToArrayBuffer(encryptedPackage.data);

  let key;

  if (isPassphrase || encryptedPackage.hasPassphrase) {
    key = await deriveKeyFromPassphrase(
      passphraseOrKey,
      salt,
      iterationsForVersion(encryptedPackage.version),
    );
  } else {
    // Import the raw key
    const keyBuffer = base64ToArrayBuffer(passphraseOrKey);
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
const KEK_ROTATING_KEY = "vet_rate_kek_rotating"; // rotation commit marker (new meta + verifier)

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
    base64ToArrayBuffer(dekBase64),
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
    base64ToArrayBuffer(wrappedBase64),
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

const purgeRotatingTemp = () => {
  const stale = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(ROTATING_KEY_PREFIX)) stale.push(k);
  }
  stale.forEach((k) => localStorage.removeItem(k));
};

/**
 * Idempotent, forward-only completion of an interrupted passphrase rotation.
 * The commit marker is written LAST in phase 1, so its presence proves every
 * temp slot is ready: move any remaining temp→live, swap the KEK descriptor,
 * clear the marker. Pure localStorage moves — needs neither the old nor the new
 * KEK, so it is safe to run at boot/unlock before any passphrase is known.
 */
export const completePendingRotation = () => {
  const markerRaw = localStorage.getItem(KEK_ROTATING_KEY);
  if (!markerRaw) {
    purgeRotatingTemp(); // orphans from a phase-1 abort (never committed)
    return false;
  }
  const marker = JSON.parse(markerRaw);
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
  localStorage.removeItem(KEK_ROTATING_KEY);
  return true;
};

/**
 * Turn on the device passphrase and migrate existing plaintext keys to wrapped.
 */
export const enableDevicePassphrase = async (passphrase) => {
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
  sessionKEK = kek;
  for (const id of listBackupKeyIds()) {
    await migratePlaintextKey(id);
  }
  return true;
};

/**
 * Unlock the keystore for this session by deriving + verifying the KEK.
 */
export const unlockDeviceKeystore = async (passphrase) => {
  if (!isDevicePassphraseEnabled()) {
    throw new Error("Device passphrase is not enabled.");
  }
  completePendingRotation(); // finish any interrupted rotation before reading meta
  const meta = JSON.parse(localStorage.getItem(KEK_META_KEY));
  const salt = new Uint8Array(base64ToArrayBuffer(meta.salt));
  const kek = await deriveKEK(
    passphrase,
    salt,
    meta.iterations || PBKDF2_ITERATIONS,
  );
  // AES-KW unwrap throws on a wrong KEK → the verifier doubles as a passphrase check.
  try {
    await window.crypto.subtle.unwrapKey(
      "raw",
      base64ToArrayBuffer(localStorage.getItem(KEK_VERIFIER_KEY)),
      kek,
      { name: "AES-KW" },
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } catch {
    throw new Error("Incorrect device passphrase.");
  }
  sessionKEK = kek;
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
export const rotateDevicePassphrase = async (newPassphrase) => {
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

  // Phase 1 (abortable): re-wrap every DEK under the new KEK into temp slots.
  // Throwing here leaves live keys untouched — no marker means no commit.
  const ids = listBackupKeyIds();
  for (const id of ids) {
    const wrapped = localStorage.getItem(WRAPPED_KEY_PREFIX + id);
    let dekBase64;
    if (wrapped !== null) {
      dekBase64 = await unwrapDEK(wrapped, oldKEK);
    } else {
      const plaintext = localStorage.getItem(KEY_STORAGE_PREFIX + id);
      if (plaintext === null) continue;
      dekBase64 = plaintext;
    }
    localStorage.setItem(
      ROTATING_KEY_PREFIX + id,
      await wrapDEK(dekBase64, newKEK),
    );
  }
  // Commit point — the marker carries the new descriptor + verifier.
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
    }),
  );

  // Phase 2: promote temp→live, swap descriptor, clear marker.
  completePendingRotation();
  for (const id of ids) {
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
        k === KEK_ROTATING_KEY)
    ) {
      toRemove.push(k);
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
  sessionKEK = null;
  return toRemove.length;
};

/**
 * Store encryption key locally (indexed by backup filename). When a device
 * passphrase is enabled the key is wrapped under the session KEK; refusing to
 * silently fall back to plaintext when locked.
 */
export const storeLocalKey = async (backupId, keyExport) => {
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
export const getLocalKey = async (backupId) => {
  const wrapped = localStorage.getItem(WRAPPED_KEY_PREFIX + backupId);
  if (wrapped !== null) {
    if (sessionKEK === null) {
      throw new Error(
        "Device keystore is locked. Unlock it to read this backup key.",
      );
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
