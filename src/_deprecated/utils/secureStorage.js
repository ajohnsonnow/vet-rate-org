/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * THE VAULT - Secure Storage Manager
 * Military-grade client-side encryption using AES-GCM
 * Protects veteran data from unauthorized access on shared/public computers
 */

// Storage keys
const ENCRYPTION_KEY_STORAGE = "vet_rate_enc_key";
const ENCRYPTED_DATA_PREFIX = "vet_rate_encrypted_";
const SALT_STORAGE = "vet_rate_salt";
const PIN_HASH_STORAGE = "vet_rate_pin_hash";
const MIGRATION_FLAG = "vet_rate_vault_migrated";

/**
 * Check if Web Crypto API is available
 */
export const isCryptoAvailable = () => {
  return window.crypto && window.crypto.subtle;
};

/**
 * Generate a cryptographic salt for key derivation
 */
const generateSalt = () => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Convert hex string to Uint8Array
 */
const hexToBytes = (hex) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};

/**
 * Derive encryption key from PIN using PBKDF2
 */
const deriveKey = async (pin, salt) => {
  const encoder = new TextEncoder();
  const pinBuffer = encoder.encode(pin);

  // Import PIN as key material
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    pinBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );

  // Derive AES-GCM key
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: hexToBytes(salt),
      iterations: 100000,
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
 * Hash PIN for verification (without storing plaintext)
 */
const hashPin = async (pin, salt) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + salt);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * Encrypt data using AES-GCM
 */
const encryptData = async (data, key) => {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(data));

  // Generate IV (Initialization Vector)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    dataBuffer,
  );

  // Combine IV and encrypted data
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const combined = new Uint8Array(iv.length + encryptedArray.length);
  combined.set(iv);
  combined.set(encryptedArray, iv.length);

  // Convert to hex string
  return Array.from(combined)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Decrypt data using AES-GCM
 */
const decryptData = async (encryptedHex, key) => {
  const encryptedBytes = hexToBytes(encryptedHex);

  // Extract IV and encrypted data
  const iv = encryptedBytes.slice(0, 12);
  const data = encryptedBytes.slice(12);

  // Decrypt
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    data,
  );

  // Convert to string and parse JSON
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(decryptedBuffer);
  return JSON.parse(jsonString);
};

/**
 * Check if user has an existing PIN setup
 */
export const hasExistingPin = () => {
  return localStorage.getItem(PIN_HASH_STORAGE) !== null;
};

/**
 * Verify PIN matches stored hash
 */
export const verifyPin = async (pin) => {
  try {
    const storedHash = localStorage.getItem(PIN_HASH_STORAGE);
    const salt = localStorage.getItem(SALT_STORAGE);

    if (!storedHash || !salt) {
      return false;
    }

    const pinHash = await hashPin(pin, salt);
    return pinHash === storedHash;
  } catch (error) {
    console.error("PIN verification failed:", error);
    return false;
  }
};

/**
 * Initialize encryption with new PIN
 */
export const initializeVault = async (pin) => {
  try {
    // Generate and store salt
    const salt = generateSalt();
    localStorage.setItem(SALT_STORAGE, salt);

    // Hash and store PIN
    const pinHash = await hashPin(pin, salt);
    localStorage.setItem(PIN_HASH_STORAGE, pinHash);

    return true;
  } catch (error) {
    console.error("Vault initialization failed:", error);
    return false;
  }
};

/**
 * Change existing PIN
 */
export const changePin = async (oldPin, newPin) => {
  try {
    // Verify old PIN
    const isValid = await verifyPin(oldPin);
    if (!isValid) {
      throw new Error("Invalid current PIN");
    }

    // Decrypt all data with old PIN
    const salt = localStorage.getItem(SALT_STORAGE);
    const oldKey = await deriveKey(oldPin, salt);

    const encryptedKeys = Object.keys(localStorage).filter((key) =>
      key.startsWith(ENCRYPTED_DATA_PREFIX),
    );

    const decryptedData = {};
    for (const key of encryptedKeys) {
      const storageKey = key.replace(ENCRYPTED_DATA_PREFIX, "");
      const encrypted = localStorage.getItem(key);
      decryptedData[storageKey] = await decryptData(encrypted, oldKey);
    }

    // Generate new salt and hash for new PIN
    const newSalt = generateSalt();
    localStorage.setItem(SALT_STORAGE, newSalt);

    const newPinHash = await hashPin(newPin, newSalt);
    localStorage.setItem(PIN_HASH_STORAGE, newPinHash);

    // Re-encrypt all data with new PIN
    const newKey = await deriveKey(newPin, newSalt);
    for (const [storageKey, data] of Object.entries(decryptedData)) {
      const encrypted = await encryptData(data, newKey);
      localStorage.setItem(ENCRYPTED_DATA_PREFIX + storageKey, encrypted);
    }

    return true;
  } catch (error) {
    console.error("PIN change failed:", error);
    return false;
  }
};

/**
 * Securely store encrypted data
 */
export const secureSetItem = async (key, value, pin) => {
  try {
    const salt = localStorage.getItem(SALT_STORAGE);
    if (!salt) {
      throw new Error("Vault not initialized");
    }

    const cryptoKey = await deriveKey(pin, salt);
    const encrypted = await encryptData(value, cryptoKey);
    localStorage.setItem(ENCRYPTED_DATA_PREFIX + key, encrypted);
    return true;
  } catch (error) {
    console.error("Secure storage failed:", error);
    throw error;
  }
};

/**
 * Retrieve and decrypt data
 */
export const secureGetItem = async (key, pin) => {
  try {
    const encryptedData = localStorage.getItem(ENCRYPTED_DATA_PREFIX + key);
    if (!encryptedData) {
      return null;
    }

    const salt = localStorage.getItem(SALT_STORAGE);
    if (!salt) {
      throw new Error("Vault not initialized");
    }

    const cryptoKey = await deriveKey(pin, salt);
    const decrypted = await decryptData(encryptedData, cryptoKey);
    return decrypted;
  } catch (error) {
    console.error("Secure retrieval failed:", error);
    throw error;
  }
};

/**
 * Remove encrypted item
 */
export const secureRemoveItem = (key) => {
  localStorage.removeItem(ENCRYPTED_DATA_PREFIX + key);
};

/**
 * Check if data needs migration (legacy plaintext to encrypted)
 */
export const needsMigration = () => {
  const hasMigrated = localStorage.getItem(MIGRATION_FLAG) === "true";
  if (hasMigrated) return false;

  // Check for legacy plaintext data
  const legacyKeys = [
    "vet_rate_saved_claims",
    "vet_rate_statements",
    "vet-rate-user-profile",
  ];

  return legacyKeys.some((key) => localStorage.getItem(key) !== null);
};

/**
 * Migrate legacy plaintext data to encrypted storage
 */
export const migrateLegacyData = async (pin) => {
  try {
    const legacyKeys = [
      "vet_rate_saved_claims",
      "vet_rate_statements",
      "vet-rate-user-profile",
      "vet_rate_nexus_statements",
      "vet_rate_cap_simulator_data",
    ];

    // Initialize vault if not already done
    if (!hasExistingPin()) {
      await initializeVault(pin);
    }

    // Migrate each legacy key
    for (const key of legacyKeys) {
      const plaintext = localStorage.getItem(key);
      if (plaintext) {
        try {
          const data = JSON.parse(plaintext);
          await secureSetItem(key, data, pin);
          // Keep legacy data for now (will be cleaned up after verification)
        } catch (parseError) {
          // If it's not JSON, store as-is
          await secureSetItem(key, plaintext, pin);
        }
      }
    }

    localStorage.setItem(MIGRATION_FLAG, "true");
    return true;
  } catch (error) {
    console.error("Migration failed:", error);
    return false;
  }
};

/**
 * Complete migration cleanup (remove plaintext data)
 */
export const completeMigrationCleanup = () => {
  const legacyKeys = [
    "vet_rate_saved_claims",
    "vet_rate_statements",
    "vet-rate-user-profile",
    "vet_rate_nexus_statements",
    "vet_rate_cap_simulator_data",
  ];

  legacyKeys.forEach((key) => localStorage.removeItem(key));
};

/**
 * Emergency access: Clear all encrypted data (use with caution)
 */
export const emergencyClearVault = () => {
  const encryptedKeys = Object.keys(localStorage).filter(
    (key) =>
      key.startsWith(ENCRYPTED_DATA_PREFIX) ||
      key === PIN_HASH_STORAGE ||
      key === SALT_STORAGE ||
      key === MIGRATION_FLAG,
  );

  encryptedKeys.forEach((key) => localStorage.removeItem(key));
};

/**
 * Get vault status for diagnostics
 */
export const getVaultStatus = () => {
  return {
    isInitialized: hasExistingPin(),
    hasMigrated: localStorage.getItem(MIGRATION_FLAG) === "true",
    needsMigration: needsMigration(),
    encryptedItemCount: Object.keys(localStorage).filter((k) =>
      k.startsWith(ENCRYPTED_DATA_PREFIX),
    ).length,
    cryptoAvailable: isCryptoAvailable(),
  };
};
