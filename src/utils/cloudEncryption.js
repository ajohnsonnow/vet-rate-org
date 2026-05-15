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
 * Local key storage (for backups without passphrase)
 * Keys stored locally never leave the device
 */
const KEY_STORAGE_PREFIX = "vet_rate_backup_key_";

/**
 * Store encryption key locally (indexed by backup filename)
 */
export const storeLocalKey = (backupId, keyExport) => {
  if (keyExport) {
    localStorage.setItem(KEY_STORAGE_PREFIX + backupId, keyExport);
  }
};

/**
 * Retrieve encryption key from local storage
 */
export const getLocalKey = (backupId) => {
  return localStorage.getItem(KEY_STORAGE_PREFIX + backupId);
};
