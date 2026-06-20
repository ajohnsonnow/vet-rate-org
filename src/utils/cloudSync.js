/**
 * Vet-Rate.org - The Off-Site Bunker (Cloud Sync Utility)
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * "Bring Your Own Cloud" - Client-side Google Drive backup integration
 *
 * UPDATED: Uses new Google Identity Services (GIS) library
 * The old gapi.auth2 is deprecated as of 2023
 *
 * The Problem: localStorage is risky. If their computer dies, their claim dies.
 * But we don't want to host medical data (liability nightmare).
 *
 * The Solution: Veterans connect THEIR Google Drive. We encrypt and upload to THEIR cloud.
 * We hold zero data. They have 100% redundancy. No server costs. No HIPAA compliance headaches.
 */

/**
 * Google Drive API Configuration
 */
const GDRIVE_CONFIG = {
  clientId: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || "",
  scopes: "https://www.googleapis.com/auth/drive.file",
  discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  folderName: "Vet-Rate-Backups",
  filePrefix: "vetrate_backup_",
};

// Store access token and user info
let accessToken = null;
let currentUser = null;
let tokenClient = null;
// eslint-disable-next-line no-unused-vars
let gapiInited = false;
// eslint-disable-next-line no-unused-vars
let gisInited = false;

/**
 * Initialize Google API client (gapi) - for Drive API calls
 */
function initializeGapiClient() {
  return new Promise((resolve, reject) => {
    if (typeof window.gapi === "undefined") {
      reject(new Error("Google API (gapi) not loaded"));
      return;
    }

    window.gapi.load("client", async () => {
      try {
        await window.gapi.client.init({
          discoveryDocs: GDRIVE_CONFIG.discoveryDocs,
        });
        gapiInited = true;
        // eslint-disable-next-line no-console
        console.log("✅ GAPI client initialized");
        resolve(true);
      } catch (error) {
        console.error("GAPI init error:", error);
        reject(error);
      }
    });
  });
}

/**
 * Initialize Google Identity Services (GIS) - for OAuth
 */
function initializeGisClient() {
  return new Promise((resolve, reject) => {
    if (typeof window.google === "undefined" || !window.google.accounts) {
      reject(
        new Error(
          'Google Identity Services (GIS) not loaded. Add: <script src="https://accounts.google.com/gsi/client"></script>',
        ),
      );
      return;
    }

    if (!GDRIVE_CONFIG.clientId) {
      reject(new Error("Missing VITE_GOOGLE_DRIVE_CLIENT_ID"));
      return;
    }

    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GDRIVE_CONFIG.clientId,
        scope: GDRIVE_CONFIG.scopes,
        callback: (response) => {
          if (response.error) {
            console.error("Token error:", response);
            return;
          }
          accessToken = response.access_token;
          // eslint-disable-next-line no-console
          console.log("✅ Access token received");
        },
      });

      gisInited = true;
      // eslint-disable-next-line no-console
      console.log("✅ GIS client initialized");
      resolve(true);
    } catch (error) {
      console.error("GIS init error:", error);
      reject(error);
    }
  });
}

/**
 * Initialize Google Drive API (both GAPI and GIS)
 */
export async function initializeGoogleDrive() {
  try {
    // eslint-disable-next-line no-console
    console.log("🔄 Initializing Google Drive...");

    // Check for required scripts
    if (typeof window.gapi === "undefined") {
      throw new Error(
        'Google API (gapi) not loaded. Add to index.html: <script src="https://apis.google.com/js/api.js"></script>',
      );
    }

    if (
      typeof window.google === "undefined" ||
      !window.google?.accounts?.oauth2
    ) {
      throw new Error(
        'Google Identity Services not loaded. Add to index.html: <script src="https://accounts.google.com/gsi/client"></script>',
      );
    }

    // Initialize both clients
    await initializeGapiClient();
    await initializeGisClient();

    // Check for stored token
    const storedToken = sessionStorage.getItem("gdrive_token");
    if (storedToken) {
      accessToken = storedToken;
      window.gapi.client.setToken({ access_token: accessToken });
    }

    // eslint-disable-next-line no-console
    console.log("✅ Google Drive API ready");
    return true;
  } catch (error) {
    console.error("Google Drive initialization error:", error);
    throw error;
  }
}

/**
 * Sign in to Google Drive
 * Opens OAuth consent popup using new GIS library
 */
export async function signInToGoogleDrive() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error("Google Identity Services not initialized"));
      return;
    }

    // Update callback to resolve promise
    tokenClient.callback = async (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error));
        return;
      }

      accessToken = response.access_token;
      sessionStorage.setItem("gdrive_token", accessToken);

      // Set token for gapi client
      window.gapi.client.setToken({ access_token: accessToken });

      // Get user info
      try {
        const userInfo = await fetchUserInfo(accessToken);
        currentUser = userInfo;
        resolve(userInfo);
      } catch (err) {
        // Even if we can't get user info, we're still signed in
        resolve({ email: "Google User", name: "Google User" });
      }
    };

    // Request access token
    if (accessToken) {
      // Already have token, just get user info
      fetchUserInfo(accessToken)
        .then(resolve)
        .catch(() => {
          // Token might be expired, request new one
          tokenClient.requestAccessToken({ prompt: "" });
        });
    } else {
      // No token, request with consent
      tokenClient.requestAccessToken({ prompt: "consent" });
    }
  });
}

/**
 * Fetch user info from Google
 */
async function fetchUserInfo(token) {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch user info");
  }

  const data = await response.json();
  return {
    email: data.email,
    name: data.name,
    imageUrl: data.picture,
  };
}

/**
 * Sign out of Google Drive
 */
export async function signOutOfGoogleDrive() {
  if (accessToken) {
    // Revoke token
    window.google.accounts.oauth2.revoke(accessToken, () => {
      // eslint-disable-next-line no-console
      console.log("✅ Token revoked");
    });
  }

  accessToken = null;
  currentUser = null;
  sessionStorage.removeItem("gdrive_token");
  window.gapi.client.setToken(null);

  // eslint-disable-next-line no-console
  console.log("✅ Signed out of Google Drive");
}

/**
 * Check if user is signed in
 */
export function isSignedInToGoogleDrive() {
  return !!accessToken;
}

/**
 * Get current user info
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Find or create the backup folder
 */
async function getOrCreateBackupFolder() {
  try {
    // Search for existing folder
    const response = await window.gapi.client.drive.files.list({
      q: `name='${GDRIVE_CONFIG.folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: "drive",
      fields: "files(id, name)",
    });

    const folders = response.result.files;

    if (folders && folders.length > 0) {
      return folders[0].id;
    }

    // Create new folder
    const folder = await window.gapi.client.drive.files.create({
      resource: {
        name: GDRIVE_CONFIG.folderName,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });

    // eslint-disable-next-line no-console
    console.log(`✅ Created backup folder: ${GDRIVE_CONFIG.folderName}`);
    return folder.result.id;
  } catch (error) {
    console.error("Error creating/finding backup folder:", error);
    throw error;
  }
}

// Versioned encryption envelope.
//   V1 (legacy): raw base64(iv || ciphertext), 12-byte IV, fixed salt
//                "vet-rate-salt-v1", PBKDF2-SHA256 100k iterations.
//   V2 (legacy): base64(magic[4] || salt[16] || iv[12] || ciphertext),
//                 PBKDF2-SHA256 600k iterations (OWASP 2023). Per-encryption
//                 random salt.
//   V3 (current): identical layout to V2 but new magic "VS3\0" and AAD-bound
//                  AES-GCM. AAD = UTF-8 "vetrate.cloud-sync.v3" — domain-
//                  separates this envelope from cloud-encryption.js V3 and
//                  prevents cross-context ciphertext reuse.
// Decrypt sniffs the magic; V1 (no magic) and V2 path still decrypt so
// existing user backups keep working. See docs/CRYPTO_AUDIT.md.

const CLOUDSYNC_V2_MAGIC = new Uint8Array([0x56, 0x53, 0x32, 0x00]); // "VS2\0"
const CLOUDSYNC_V3_MAGIC = new Uint8Array([0x56, 0x53, 0x33, 0x00]); // "VS3\0"
const CLOUDSYNC_AAD_V3 = new TextEncoder().encode("vetrate.cloud-sync.v3");
const PBKDF2_ITERS_V2 = 600_000;
const PBKDF2_ITERS_V1 = 100_000;
const V1_FIXED_SALT_TEXT = "vet-rate-salt-v1";

function _matchesMagic(bytes, magic) {
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

async function _deriveKey(password, salt, iterations, usage) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

export async function encryptData(text, password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await _deriveKey(password, salt, PBKDF2_ITERS_V2, "encrypt");

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: CLOUDSYNC_AAD_V3 },
    key,
    data,
  );

  const out = new Uint8Array(
    CLOUDSYNC_V3_MAGIC.length + salt.length + iv.length + encrypted.byteLength,
  );
  let o = 0;
  out.set(CLOUDSYNC_V3_MAGIC, o);
  o += CLOUDSYNC_V3_MAGIC.length;
  out.set(salt, o);
  o += salt.length;
  out.set(iv, o);
  o += iv.length;
  out.set(new Uint8Array(encrypted), o);

  return btoa(String.fromCharCode(...out));
}

export async function decryptData(encryptedBase64, password) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

  if (_matchesMagic(bytes, CLOUDSYNC_V3_MAGIC)) {
    let o = CLOUDSYNC_V3_MAGIC.length;
    const salt = bytes.slice(o, o + 16);
    o += 16;
    const iv = bytes.slice(o, o + 12);
    o += 12;
    const ciphertext = bytes.slice(o);
    const key = await _deriveKey(password, salt, PBKDF2_ITERS_V2, "decrypt");
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: CLOUDSYNC_AAD_V3 },
      key,
      ciphertext,
    );
    return decoder.decode(plain);
  }

  if (_matchesMagic(bytes, CLOUDSYNC_V2_MAGIC)) {
    let o = CLOUDSYNC_V2_MAGIC.length;
    const salt = bytes.slice(o, o + 16);
    o += 16;
    const iv = bytes.slice(o, o + 12);
    o += 12;
    const ciphertext = bytes.slice(o);
    const key = await _deriveKey(password, salt, PBKDF2_ITERS_V2, "decrypt");
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );
    return decoder.decode(plain);
  }

  // V1 legacy fallback — fixed salt + 100k iterations. New writes never take
  // this path; only existing user backups do.
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const key = await _deriveKey(
    password,
    encoder.encode(V1_FIXED_SALT_TEXT),
    PBKDF2_ITERS_V1,
    "decrypt",
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return decoder.decode(plain);
}

// The hardcoded last-resort key older backups may have been encrypted under.
// Retired for WRITES (it is low-entropy and shared across every install) but
// kept for RESTORE so those existing backups still open. See the S16 design,
// Q-LEGACY-DRIVE: "forbid new writes, keep last-resort decrypt indefinitely".
export const LEGACY_DEFAULT_KEY = "vet-rate-default-key";

// Key for a NEW write: the user's passphrase, else their account email. The
// shared default key is refused — a new backup must bind to something
// user-specific, never the global constant — so a write with neither a
// passphrase nor a signed-in email throws instead of silently using it.
export function selectWriteKey(password, user) {
  const key = password || user?.email;
  if (!key) {
    throw new Error(
      "No encryption key available for this backup. Provide a passphrase or sign in before backing up.",
    );
  }
  return key;
}

// Key for RESTORE: the same preference, but fall back to the legacy default so a
// backup written under it before the retirement still decrypts.
export function selectRestoreKey(password, user) {
  return password || user?.email || LEGACY_DEFAULT_KEY;
}

// A passphrase-less write binds to the account email — user-specific but NOT
// secret: it is low entropy and knowable by anyone, so the resulting backup is
// only weakly protected. Callers must not present such a write as "secure";
// surface a warning and recommend setting a passphrase. (A random DEK wrapped in
// the device keystore would be stronger, but that is a new envelope format that
// must coexist with V1/V2/V3 restore — deferred as a design decision.)
export function isWeakWriteKey(password) {
  return !password;
}

/**
 * Save backup to Google Drive
 */
export async function saveBackupToGoogleDrive(data, password = null) {
  try {
    if (!accessToken) {
      throw new Error("Not signed in to Google Drive");
    }

    const encryptionKey = selectWriteKey(password, currentUser);
    const weakKey = isWeakWriteKey(password);
    if (weakKey) {
      // eslint-disable-next-line no-console
      console.warn(
        "⚠️ Cloud backup encrypted with an email-derived key (no passphrase set). The email is not secret — set a passphrase for stronger protection.",
      );
    }

    const jsonData = JSON.stringify(data);
    const encryptedData = await encryptData(jsonData, encryptionKey);

    const folderId = await getOrCreateBackupFolder();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${GDRIVE_CONFIG.filePrefix}${timestamp}.json`;

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
      description: "Vet-Rate.org encrypted backup",
    };

    const fileContent = new Blob([encryptedData], { type: "application/json" });

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(fileMetadata)], { type: "application/json" }),
    );
    form.append("file", fileContent);

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      },
    );

    const result = await response.json();

    // eslint-disable-next-line no-console
    console.log(`✅ Backup saved to Google Drive: ${fileName}`);

    return { fileId: result.id, fileName, weakKey };
  } catch (error) {
    console.error("Error saving backup to Google Drive:", error);
    throw error;
  }
}

/**
 * List all backups in Google Drive
 */
export async function listBackupsFromGoogleDrive() {
  try {
    const folderId = await getOrCreateBackupFolder();

    const response = await window.gapi.client.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      orderBy: "createdTime desc",
      fields: "files(id, name, createdTime, modifiedTime, size)",
    });

    return response.result.files || [];
  } catch (error) {
    console.error("Error listing backups:", error);
    throw error;
  }
}

/**
 * Restore backup from Google Drive
 */
export async function restoreBackupFromGoogleDrive(fileId, password = null) {
  try {
    const encryptionKey = selectRestoreKey(password, currentUser);

    const response = await window.gapi.client.drive.files.get({
      fileId: fileId,
      alt: "media",
    });

    const encryptedData = response.body;
    const jsonData = await decryptData(encryptedData, encryptionKey);
    const data = JSON.parse(jsonData);

    // eslint-disable-next-line no-console
    console.log(`✅ Backup restored from Google Drive`);

    return data;
  } catch (error) {
    console.error("Error restoring backup:", error);
    throw error;
  }
}

/**
 * Delete a backup from Google Drive
 */
export async function deleteBackupFromGoogleDrive(fileId) {
  try {
    await window.gapi.client.drive.files.delete({ fileId });
    // eslint-disable-next-line no-console
    console.log(`✅ Backup deleted from Google Drive`);
  } catch (error) {
    console.error("Error deleting backup:", error);
    throw error;
  }
}

/**
 * Auto-backup on interval
 */
export function setupAutoBackup(getDataCallback, intervalMinutes = 30) {
  const intervalId = setInterval(
    async () => {
      try {
        if (isSignedInToGoogleDrive()) {
          const data = getDataCallback();
          await saveBackupToGoogleDrive(data);
          // eslint-disable-next-line no-console
          console.log(
            `✅ Auto-backup completed at ${new Date().toLocaleTimeString()}`,
          );
        }
      } catch (error) {
        console.error("Auto-backup failed:", error);
      }
    },
    intervalMinutes * 60 * 1000,
  );

  return () => clearInterval(intervalId);
}

export default {
  initializeGoogleDrive,
  signInToGoogleDrive,
  signOutOfGoogleDrive,
  isSignedInToGoogleDrive,
  getCurrentUser,
  saveBackupToGoogleDrive,
  listBackupsFromGoogleDrive,
  restoreBackupFromGoogleDrive,
  deleteBackupFromGoogleDrive,
  setupAutoBackup,
};
