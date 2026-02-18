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
 * - PBKDF2 key derivation with 100,000 iterations (OWASP recommended)
 * - Random 96-bit IV for each encryption (prevents pattern analysis)
 * - Optional passphrase for extra protection
 */

const ENCRYPTION_VERSION = 'VR_ENC_V1'; // Version tag for future compatibility

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
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  return key;
};

/**
 * Derive encryption key from passphrase using PBKDF2
 */
const deriveKeyFromPassphrase = async (passphrase, salt) => {
  const encoder = new TextEncoder();
  const passphraseBuffer = encoder.encode(passphrase);
  
  // Import passphrase as key material
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    passphraseBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive AES-GCM key with 100,000 iterations
  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  
  return key;
};

/**
 * Convert ArrayBuffer to Base64 string
 */
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
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
    throw new Error('Web Crypto API not available. Please use HTTPS.');
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
    const rawKey = await window.crypto.subtle.exportKey('raw', key);
    keyExport = arrayBufferToBase64(rawKey);
  }
  
  // Encrypt the data
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    dataBuffer
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
export const decryptFromCloud = async (encryptedPackage, passphraseOrKey, isPassphrase = false) => {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API not available. Please use HTTPS.');
  }
  
  // Validate package
  if (!encryptedPackage.encrypted || !encryptedPackage.version) {
    throw new Error('Invalid encrypted package');
  }
  
  // Extract components
  const salt = new Uint8Array(base64ToArrayBuffer(encryptedPackage.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(encryptedPackage.iv));
  const encryptedData = base64ToArrayBuffer(encryptedPackage.data);
  
  let key;
  
  if (isPassphrase || encryptedPackage.hasPassphrase) {
    // Derive key from passphrase
    key = await deriveKeyFromPassphrase(passphraseOrKey, salt);
  } else {
    // Import the raw key
    const keyBuffer = base64ToArrayBuffer(passphraseOrKey);
    key = await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }
  
  // Decrypt
  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedData
    );
    
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);
    return JSON.parse(jsonString);
  } catch (err) {
    throw new Error('Decryption failed. Wrong passphrase or corrupted data.');
  }
};

/**
 * Generate a secure backup filename with timestamp
 */
export const generateSecureBackupName = (prefix = 'vetrate_backup') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const randomId = window.crypto.getRandomValues(new Uint8Array(4))
    .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
  return `${prefix}_${timestamp}_${randomId}.enc.json`;
};

/**
 * Check if a backup is encrypted
 */
export const isEncryptedBackup = (data) => {
  return data && data.version === ENCRYPTION_VERSION && data.encrypted === true;
};

/**
 * Local key storage (for backups without passphrase)
 * Keys stored locally never leave the device
 */
const KEY_STORAGE_PREFIX = 'vet_rate_backup_key_';

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
