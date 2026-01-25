/**
 * SupplyLocker.org - The Off-Site Bunker (Cloud Sync Utility)
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
  clientId: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || '',
  scopes: 'https://www.googleapis.com/auth/drive.file',
  discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  folderName: 'SupplyLocker-Backups',
  filePrefix: 'supplylocker_backup_'
};

// Store access token and user info
let accessToken = null;
let currentUser = null;
let tokenClient = null;
let gapiInited = false;
let gisInited = false;

/**
 * Initialize Google API client (gapi) - for Drive API calls
 */
function initializeGapiClient() {
  return new Promise((resolve, reject) => {
    if (typeof window.gapi === 'undefined') {
      reject(new Error('Google API (gapi) not loaded'));
      return;
    }
    
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({
          discoveryDocs: GDRIVE_CONFIG.discoveryDocs,
        });
        gapiInited = true;
        console.log('✅ GAPI client initialized');
        resolve(true);
      } catch (error) {
        console.error('GAPI init error:', error);
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
    if (typeof window.google === 'undefined' || !window.google.accounts) {
      reject(new Error('Google Identity Services (GIS) not loaded. Add: <script src="https://accounts.google.com/gsi/client"></script>'));
      return;
    }
    
    if (!GDRIVE_CONFIG.clientId) {
      reject(new Error('Missing VITE_GOOGLE_DRIVE_CLIENT_ID'));
      return;
    }
    
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GDRIVE_CONFIG.clientId,
        scope: GDRIVE_CONFIG.scopes,
        callback: (response) => {
          if (response.error) {
            console.error('Token error:', response);
            return;
          }
          accessToken = response.access_token;
          console.log('✅ Access token received');
        },
      });
      
      gisInited = true;
      console.log('✅ GIS client initialized');
      resolve(true);
    } catch (error) {
      console.error('GIS init error:', error);
      reject(error);
    }
  });
}

/**
 * Initialize Google Drive API (both GAPI and GIS)
 */
export async function initializeGoogleDrive() {
  try {
    console.log('🔄 Initializing Google Drive...');
    
    // Check for required scripts
    if (typeof window.gapi === 'undefined') {
      throw new Error('Google API (gapi) not loaded. Add to index.html: <script src="https://apis.google.com/js/api.js"></script>');
    }
    
    if (typeof window.google === 'undefined' || !window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services not loaded. Add to index.html: <script src="https://accounts.google.com/gsi/client"></script>');
    }
    
    // Initialize both clients
    await initializeGapiClient();
    await initializeGisClient();
    
    // Check for stored token
    const storedToken = sessionStorage.getItem('gdrive_token');
    if (storedToken) {
      accessToken = storedToken;
      window.gapi.client.setToken({ access_token: accessToken });
    }
    
    console.log('✅ Google Drive API ready');
    return true;
  } catch (error) {
    console.error('Google Drive initialization error:', error);
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
      reject(new Error('Google Identity Services not initialized'));
      return;
    }
    
    // Update callback to resolve promise
    tokenClient.callback = async (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error));
        return;
      }
      
      accessToken = response.access_token;
      sessionStorage.setItem('gdrive_token', accessToken);
      
      // Set token for gapi client
      window.gapi.client.setToken({ access_token: accessToken });
      
      // Get user info
      try {
        const userInfo = await fetchUserInfo(accessToken);
        currentUser = userInfo;
        resolve(userInfo);
      } catch (err) {
        // Even if we can't get user info, we're still signed in
        resolve({ email: 'Google User', name: 'Google User' });
      }
    };
    
    // Request access token
    if (accessToken) {
      // Already have token, just get user info
      fetchUserInfo(accessToken).then(resolve).catch(() => {
        // Token might be expired, request new one
        tokenClient.requestAccessToken({ prompt: '' });
      });
    } else {
      // No token, request with consent
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }
  });
}

/**
 * Fetch user info from Google
 */
async function fetchUserInfo(token) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }
  
  const data = await response.json();
  return {
    email: data.email,
    name: data.name,
    imageUrl: data.picture
  };
}

/**
 * Sign out of Google Drive
 */
export async function signOutOfGoogleDrive() {
  if (accessToken) {
    // Revoke token
    window.google.accounts.oauth2.revoke(accessToken, () => {
      console.log('✅ Token revoked');
    });
  }
  
  accessToken = null;
  currentUser = null;
  sessionStorage.removeItem('gdrive_token');
  window.gapi.client.setToken(null);
  
  console.log('✅ Signed out of Google Drive');
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
      spaces: 'drive',
      fields: 'files(id, name)'
    });

    const folders = response.result.files;

    if (folders && folders.length > 0) {
      return folders[0].id;
    }

    // Create new folder
    const folder = await window.gapi.client.drive.files.create({
      resource: {
        name: GDRIVE_CONFIG.folderName,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });

    console.log(`✅ Created backup folder: ${GDRIVE_CONFIG.folderName}`);
    return folder.result.id;
  } catch (error) {
    console.error('Error creating/finding backup folder:', error);
    throw error;
  }
}

/**
 * Encrypt data using Web Crypto API
 */
async function encryptData(text, password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('SupplyLocker-salt-v1'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data
 */
async function decryptData(encryptedBase64, password) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('SupplyLocker-salt-v1'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return decoder.decode(decrypted);
}

/**
 * Save backup to Google Drive
 */
export async function saveBackupToGoogleDrive(data, password = null) {
  try {
    if (!accessToken) {
      throw new Error('Not signed in to Google Drive');
    }
    
    // Use email as default encryption key
    const encryptionKey = password || currentUser?.email || 'SupplyLocker-default-key';
    
    const jsonData = JSON.stringify(data);
    const encryptedData = await encryptData(jsonData, encryptionKey);
    
    const folderId = await getOrCreateBackupFolder();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${GDRIVE_CONFIG.filePrefix}${timestamp}.json`;
    
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
      description: 'SupplyLocker.org encrypted backup'
    };
    
    const fileContent = new Blob([encryptedData], { type: 'application/json' });
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
    form.append('file', fileContent);
    
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form
    });
    
    const result = await response.json();
    
    console.log(`✅ Backup saved to Google Drive: ${fileName}`);
    
    return { fileId: result.id, fileName };
  } catch (error) {
    console.error('Error saving backup to Google Drive:', error);
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
      orderBy: 'createdTime desc',
      fields: 'files(id, name, createdTime, modifiedTime, size)'
    });
    
    return response.result.files || [];
  } catch (error) {
    console.error('Error listing backups:', error);
    throw error;
  }
}

/**
 * Restore backup from Google Drive
 */
export async function restoreBackupFromGoogleDrive(fileId, password = null) {
  try {
    const encryptionKey = password || currentUser?.email || 'SupplyLocker-default-key';
    
    const response = await window.gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media'
    });
    
    const encryptedData = response.body;
    const jsonData = await decryptData(encryptedData, encryptionKey);
    const data = JSON.parse(jsonData);
    
    console.log(`✅ Backup restored from Google Drive`);
    
    return data;
  } catch (error) {
    console.error('Error restoring backup:', error);
    throw error;
  }
}

/**
 * Delete a backup from Google Drive
 */
export async function deleteBackupFromGoogleDrive(fileId) {
  try {
    await window.gapi.client.drive.files.delete({ fileId });
    console.log(`✅ Backup deleted from Google Drive`);
  } catch (error) {
    console.error('Error deleting backup:', error);
    throw error;
  }
}

/**
 * Auto-backup on interval
 */
export function setupAutoBackup(getDataCallback, intervalMinutes = 30) {
  const intervalId = setInterval(async () => {
    try {
      if (isSignedInToGoogleDrive()) {
        const data = getDataCallback();
        await saveBackupToGoogleDrive(data);
        console.log(`✅ Auto-backup completed at ${new Date().toLocaleTimeString()}`);
      }
    } catch (error) {
      console.error('Auto-backup failed:', error);
    }
  }, intervalMinutes * 60 * 1000);
  
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
  setupAutoBackup
};
