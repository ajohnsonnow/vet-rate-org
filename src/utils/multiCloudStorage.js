/**
 * Vet-Rate.org - Multi-Provider Cloud Storage
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * "THE REDUNDANT BUNKER NETWORK" - Multiple secure cloud storage options
 *
 * Supported Providers (all with encryption in transit + at rest):
 * - Google Drive - Most veterans have Gmail
 * - Dropbox - Strong security, good mobile apps
 * - OneDrive - For veterans using Microsoft/VA computers
 *
 * All data is AES-256-GCM encrypted BEFORE leaving the browser.
 * Even if cloud storage is compromised, data remains protected.
 */

import {
  encryptForCloud,
  decryptFromCloud,
  generateSecureBackupName,
  storeLocalKey,
  getLocalKey,
  isEncryptedBackup,
} from "./cloudEncryption";

// Provider configurations
const PROVIDERS = {
  GOOGLE_DRIVE: {
    id: "google_drive",
    name: "Google Drive",
    icon: "📁",
    color: "from-blue-500 to-green-500",
    folderName: "Vet-Rate-Backups",
    scopes: "https://www.googleapis.com/auth/drive.file",
    security: {
      encryptionInTransit: true,
      encryptionAtRest: true,
      twoFactorAvailable: true,
      hipaaCompliant: false, // Not BAA by default
      certifications: ["SOC 2", "ISO 27001"],
    },
  },
  DROPBOX: {
    id: "dropbox",
    name: "Dropbox",
    icon: "📦",
    color: "from-blue-600 to-blue-400",
    folderName: "/Vet-Rate-Backups",
    scopes: "files.content.write files.content.read",
    security: {
      encryptionInTransit: true,
      encryptionAtRest: true,
      twoFactorAvailable: true,
      hipaaCompliant: true, // Dropbox Business has BAA
      certifications: ["SOC 2", "SOC 3", "ISO 27001", "HIPAA"],
    },
  },
  ONEDRIVE: {
    id: "onedrive",
    name: "OneDrive",
    icon: "☁️",
    color: "from-blue-500 to-cyan-400",
    folderName: "Vet-Rate-Backups",
    scopes: "Files.ReadWrite.AppFolder",
    security: {
      encryptionInTransit: true,
      encryptionAtRest: true,
      twoFactorAvailable: true,
      hipaaCompliant: true, // Microsoft 365 has BAA
      certifications: ["SOC 1", "SOC 2", "ISO 27001", "HIPAA", "FedRAMP"],
    },
  },
};

// Track connection states
const connectionState = {
  google_drive: { connected: false, user: null, token: null },
  dropbox: { connected: false, user: null, token: null },
  onedrive: { connected: false, user: null, token: null },
};

/**
 * Get all available providers
 */
export const getProviders = () => Object.values(PROVIDERS);

/**
 * Get provider by ID
 */
export const getProvider = (providerId) => {
  return Object.values(PROVIDERS).find((p) => p.id === providerId);
};

/**
 * Check if a provider is connected
 */
export const isProviderConnected = (providerId) => {
  return connectionState[providerId]?.connected || false;
};

/**
 * Get connection state for a provider
 */
export const getProviderState = (providerId) => {
  return (
    connectionState[providerId] || { connected: false, user: null, token: null }
  );
};

// ============================================================
// DROPBOX INTEGRATION
// ============================================================

const DROPBOX_CONFIG = {
  clientId: import.meta.env.VITE_DROPBOX_APP_KEY || "",
  redirectUri: `${window.location.origin}/auth/dropbox/callback`,
};

/**
 * Generate PKCE challenge for Dropbox OAuth
 */
const generatePKCE = async () => {
  const verifier = window.crypto.getRandomValues(new Uint8Array(32));
  const verifierStr = Array.from(verifier)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const encoder = new TextEncoder();
  const data = encoder.encode(verifierStr);
  const hash = await window.crypto.subtle.digest("SHA-256", data);

  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { verifier: verifierStr, challenge };
};

/**
 * Initialize Dropbox OAuth flow with PKCE
 */
export const connectDropbox = async () => {
  if (!DROPBOX_CONFIG.clientId) {
    throw new Error(
      "Dropbox App Key not configured. Set VITE_DROPBOX_APP_KEY in .env",
    );
  }

  const { verifier, challenge } = await generatePKCE();
  sessionStorage.setItem("dropbox_pkce_verifier", verifier);

  const authUrl = new URL("https://www.dropbox.com/oauth2/authorize");
  authUrl.searchParams.set("client_id", DROPBOX_CONFIG.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", DROPBOX_CONFIG.redirectUri);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("token_access_type", "offline");

  // Open in popup
  const popup = window.open(
    authUrl.toString(),
    "dropbox_auth",
    "width=600,height=700",
  );

  return new Promise((resolve, reject) => {
    const checkPopup = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(checkPopup);
          const token = sessionStorage.getItem("dropbox_token");
          if (token) {
            connectionState.dropbox = { connected: true, token, user: null };
            resolve({ connected: true });
          } else {
            reject(new Error("Dropbox authentication cancelled"));
          }
        }

        // Check for callback URL
        if (popup.location.href.includes("/auth/dropbox/callback")) {
          const url = new URL(popup.location.href);
          const code = url.searchParams.get("code");

          if (code) {
            popup.close();
            clearInterval(checkPopup);

            // Exchange code for token
            exchangeDropboxCode(code).then(resolve).catch(reject);
          }
        }
      } catch (e) {
        // Cross-origin access denied - popup still on Dropbox
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(checkPopup);
      if (!popup.closed) popup.close();
      reject(new Error("Authentication timeout"));
    }, 300000);
  });
};

/**
 * Exchange Dropbox auth code for token
 */
const exchangeDropboxCode = async (code) => {
  const verifier = sessionStorage.getItem("dropbox_pkce_verifier");

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: DROPBOX_CONFIG.clientId,
      redirect_uri: DROPBOX_CONFIG.redirectUri,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange code for token");
  }

  const data = await response.json();
  const token = data.access_token;

  sessionStorage.setItem("dropbox_token", token);
  sessionStorage.removeItem("dropbox_pkce_verifier");

  // Get user info
  const userResponse = await fetch(
    "https://api.dropboxapi.com/2/users/get_current_account",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  const user = await userResponse.json();

  connectionState.dropbox = {
    connected: true,
    token,
    user: { email: user.email, name: user.name.display_name },
  };

  return { connected: true, user: connectionState.dropbox.user };
};

/**
 * Save backup to Dropbox
 */
export const saveToDropbox = async (data, filename, passphrase = null) => {
  const state = connectionState.dropbox;
  if (!state.connected || !state.token) {
    throw new Error("Not connected to Dropbox");
  }

  // Encrypt the data
  const { encryptedPackage, keyExport } = await encryptForCloud(
    data,
    passphrase,
  );

  // Store key locally if no passphrase
  if (keyExport) {
    await storeLocalKey(`dropbox_${filename}`, keyExport);
  }

  // Upload to Dropbox
  const response = await fetch(
    "https://content.dropboxapi.com/2/files/upload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: `${PROVIDERS.DROPBOX.folderName}/${filename}`,
          mode: "overwrite",
          autorename: true,
        }),
      },
      body: JSON.stringify(encryptedPackage),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_summary || "Upload failed");
  }

  return await response.json();
};

/**
 * List backups from Dropbox
 */
export const listDropboxBackups = async () => {
  const state = connectionState.dropbox;
  if (!state.connected || !state.token) {
    throw new Error("Not connected to Dropbox");
  }

  const response = await fetch(
    "https://api.dropboxapi.com/2/files/list_folder",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: PROVIDERS.DROPBOX.folderName,
        include_deleted: false,
      }),
    },
  );

  if (!response.ok) {
    // Folder might not exist yet
    return [];
  }

  const data = await response.json();
  return data.entries
    .filter((entry) => entry[".tag"] === "file" && entry.name.endsWith(".json"))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      size: entry.size,
      modified: entry.server_modified,
      path: entry.path_display,
    }));
};

/**
 * Restore backup from Dropbox
 */
export const restoreFromDropbox = async (filePath, passphraseOrKey = null) => {
  const state = connectionState.dropbox;
  if (!state.connected || !state.token) {
    throw new Error("Not connected to Dropbox");
  }

  const response = await fetch(
    "https://content.dropboxapi.com/2/files/download",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.token}`,
        "Dropbox-API-Arg": JSON.stringify({ path: filePath }),
      },
    },
  );

  if (!response.ok) {
    throw new Error("Download failed");
  }

  const encryptedPackage = await response.json();

  // Check if it's encrypted
  if (isEncryptedBackup(encryptedPackage)) {
    // Try local key first if no passphrase provided
    let key = passphraseOrKey;
    const filename = filePath.split("/").pop();

    if (!key) {
      key = await getLocalKey(`dropbox_${filename}`);
    }

    if (!key) {
      throw new Error("PASSPHRASE_REQUIRED");
    }

    return await decryptFromCloud(
      encryptedPackage,
      key,
      encryptedPackage.hasPassphrase,
    );
  }

  // Return unencrypted data (legacy backups)
  return encryptedPackage;
};

/**
 * Disconnect from Dropbox
 */
export const disconnectDropbox = () => {
  sessionStorage.removeItem("dropbox_token");
  connectionState.dropbox = { connected: false, user: null, token: null };
};

// ============================================================
// ONEDRIVE INTEGRATION
// ============================================================

const ONEDRIVE_CONFIG = {
  clientId: import.meta.env.VITE_ONEDRIVE_CLIENT_ID || "",
  redirectUri: `${window.location.origin}/auth/onedrive/callback`,
  authority: "https://login.microsoftonline.com/common",
  scopes: ["Files.ReadWrite.AppFolder", "User.Read"],
};

/**
 * Connect to OneDrive using MSAL
 */
export const connectOneDrive = async () => {
  if (!ONEDRIVE_CONFIG.clientId) {
    throw new Error(
      "OneDrive Client ID not configured. Set VITE_ONEDRIVE_CLIENT_ID in .env",
    );
  }

  // Use PKCE-based popup flow
  const { verifier, challenge } = await generatePKCE();
  sessionStorage.setItem("onedrive_pkce_verifier", verifier);

  const authUrl = new URL(`${ONEDRIVE_CONFIG.authority}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set("client_id", ONEDRIVE_CONFIG.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", ONEDRIVE_CONFIG.redirectUri);
  authUrl.searchParams.set("scope", ONEDRIVE_CONFIG.scopes.join(" "));
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("response_mode", "query");

  const popup = window.open(
    authUrl.toString(),
    "onedrive_auth",
    "width=600,height=700",
  );

  return new Promise((resolve, reject) => {
    const checkPopup = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(checkPopup);
          const token = sessionStorage.getItem("onedrive_token");
          if (token) {
            connectionState.onedrive = { connected: true, token, user: null };
            resolve({ connected: true });
          } else {
            reject(new Error("OneDrive authentication cancelled"));
          }
        }

        if (popup.location.href.includes("/auth/onedrive/callback")) {
          const url = new URL(popup.location.href);
          const code = url.searchParams.get("code");

          if (code) {
            popup.close();
            clearInterval(checkPopup);
            exchangeOneDriveCode(code).then(resolve).catch(reject);
          }
        }
      } catch (e) {
        // Cross-origin
      }
    }, 500);

    setTimeout(() => {
      clearInterval(checkPopup);
      if (!popup.closed) popup.close();
      reject(new Error("Authentication timeout"));
    }, 300000);
  });
};

/**
 * Exchange OneDrive auth code for token
 */
const exchangeOneDriveCode = async (code) => {
  const verifier = sessionStorage.getItem("onedrive_pkce_verifier");

  const response = await fetch(
    `${ONEDRIVE_CONFIG.authority}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: ONEDRIVE_CONFIG.clientId,
        redirect_uri: ONEDRIVE_CONFIG.redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to exchange code for token");
  }

  const data = await response.json();
  const token = data.access_token;

  sessionStorage.setItem("onedrive_token", token);
  sessionStorage.removeItem("onedrive_pkce_verifier");

  // Get user info
  const userResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const user = await userResponse.json();

  connectionState.onedrive = {
    connected: true,
    token,
    user: {
      email: user.mail || user.userPrincipalName,
      name: user.displayName,
    },
  };

  return { connected: true, user: connectionState.onedrive.user };
};

/**
 * Save backup to OneDrive (AppFolder)
 */
export const saveToOneDrive = async (data, filename, passphrase = null) => {
  const state = connectionState.onedrive;
  if (!state.connected || !state.token) {
    throw new Error("Not connected to OneDrive");
  }

  // Encrypt the data
  const { encryptedPackage, keyExport } = await encryptForCloud(
    data,
    passphrase,
  );

  if (keyExport) {
    await storeLocalKey(`onedrive_${filename}`, keyExport);
  }

  // Create folder if needed and upload
  const folderPath = PROVIDERS.ONEDRIVE.folderName;

  // Upload to OneDrive special approot folder
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${folderPath}/${filename}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${state.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(encryptedPackage),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Upload failed");
  }

  return await response.json();
};

/**
 * List backups from OneDrive
 */
export const listOneDriveBackups = async () => {
  const state = connectionState.onedrive;
  if (!state.connected || !state.token) {
    throw new Error("Not connected to OneDrive");
  }

  const folderPath = PROVIDERS.ONEDRIVE.folderName;

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${folderPath}:/children`,
    {
      headers: { Authorization: `Bearer ${state.token}` },
    },
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return (data.value || [])
    .filter((item) => item.name.endsWith(".json"))
    .map((item) => ({
      id: item.id,
      name: item.name,
      size: item.size,
      modified: item.lastModifiedDateTime,
      path: item.id,
    }));
};

/**
 * Restore backup from OneDrive
 */
export const restoreFromOneDrive = async (fileId, passphraseOrKey = null) => {
  const state = connectionState.onedrive;
  if (!state.connected || !state.token) {
    throw new Error("Not connected to OneDrive");
  }

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
    {
      headers: { Authorization: `Bearer ${state.token}` },
    },
  );

  if (!response.ok) {
    throw new Error("Download failed");
  }

  const encryptedPackage = await response.json();

  if (isEncryptedBackup(encryptedPackage)) {
    let key = passphraseOrKey;

    if (!key) {
      // Try to find local key by listing and matching
      const backups = await listOneDriveBackups();
      const backup = backups.find((b) => b.id === fileId);
      if (backup) {
        key = await getLocalKey(`onedrive_${backup.name}`);
      }
    }

    if (!key) {
      throw new Error("PASSPHRASE_REQUIRED");
    }

    return await decryptFromCloud(
      encryptedPackage,
      key,
      encryptedPackage.hasPassphrase,
    );
  }

  return encryptedPackage;
};

/**
 * Disconnect from OneDrive
 */
export const disconnectOneDrive = () => {
  sessionStorage.removeItem("onedrive_token");
  connectionState.onedrive = { connected: false, user: null, token: null };
};

// ============================================================
// UNIFIED INTERFACE
// ============================================================

/**
 * Connect to a cloud provider
 */
export const connectProvider = async (providerId) => {
  switch (providerId) {
    case "dropbox":
      return await connectDropbox();
    case "onedrive":
      return await connectOneDrive();
    case "google_drive":
      // Use existing Google Drive implementation
      throw new Error("Use existing CloudSyncManager for Google Drive");
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
};

/**
 * Disconnect from a cloud provider
 */
export const disconnectProvider = (providerId) => {
  switch (providerId) {
    case "dropbox":
      return disconnectDropbox();
    case "onedrive":
      return disconnectOneDrive();
    case "google_drive":
      throw new Error("Use existing CloudSyncManager for Google Drive");
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
};

/**
 * Save backup to specified provider
 */
export const saveBackup = async (providerId, data, passphrase = null) => {
  const filename = generateSecureBackupName();

  switch (providerId) {
    case "dropbox":
      return await saveToDropbox(data, filename, passphrase);
    case "onedrive":
      return await saveToOneDrive(data, filename, passphrase);
    case "google_drive":
      throw new Error("Use existing CloudSyncManager for Google Drive");
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
};

/**
 * List backups from specified provider
 */
export const listBackups = async (providerId) => {
  switch (providerId) {
    case "dropbox":
      return await listDropboxBackups();
    case "onedrive":
      return await listOneDriveBackups();
    case "google_drive":
      throw new Error("Use existing CloudSyncManager for Google Drive");
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
};

/**
 * Restore backup from specified provider
 */
export const restoreBackup = async (
  providerId,
  fileIdOrPath,
  passphraseOrKey = null,
) => {
  switch (providerId) {
    case "dropbox":
      return await restoreFromDropbox(fileIdOrPath, passphraseOrKey);
    case "onedrive":
      return await restoreFromOneDrive(fileIdOrPath, passphraseOrKey);
    case "google_drive":
      throw new Error("Use existing CloudSyncManager for Google Drive");
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
};

export { PROVIDERS };
