/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 *
 * Persistent Storage System - "The Bunker"
 *
 * A multi-layered, crash-proof storage system that ensures veteran data
 * survives browser crashes, cache clears, and device changes.
 *
 * Storage Hierarchy:
 * 1. File System Access API (Desktop) - Crash/cache proof, saves to user's drive
 * 2. IndexedDB - Primary browser storage, survives tab closes
 * 3. Memory buffer - Real-time changes before save
 *
 * Features:
 * - Auto-save on form changes ("Save-As-You-Go")
 * - Desktop: Seamless background saves to user's file system
 * - Mobile: LocalStorage + Download prompt at milestones
 * - Unsaved changes warning before tab close
 * - Resume packet from saved file
 */

import { storage } from "./storage";
import { CURRENT_PACKET_VERSION } from "./migrationManager";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  PACKET_FILENAME: "My-Vet-Rate-Packet.json",
  AUTO_SAVE_DEBOUNCE_MS: 1500, // Wait 1.5s after last input before auto-save
  MILESTONE_SAVE_MS: 30000, // Force save every 30 seconds if changes exist
  STORAGE_KEY_PREFIX: "vetrate_",
  FILE_HANDLE_KEY: "vetrate_file_handle_metadata",
  UNSAVED_FLAG_KEY: "vetrate_unsaved_changes",
  LAST_SAVE_KEY: "vetrate_last_save_timestamp",
  PACKET_VERSION: CURRENT_PACKET_VERSION,
};

// ============================================================================
// INTERNAL STATE
// ============================================================================

let activeFileHandle = null; // File System Access API handle
let hasUnsavedChanges = false; // Tracks if there are pending changes
let autoSaveTimer = null; // Debounce timer for auto-save
let milestoneSaveTimer = null; // Periodic milestone save timer
let saveInProgress = false; // Prevents concurrent saves
let lastSaveTimestamp = null; // When we last saved
let saveListeners = []; // Callbacks for save events
let packetData = null; // Current packet data in memory

// ============================================================================
// FEATURE DETECTION
// ============================================================================

/**
 * Check if File System Access API is supported (desktop browsers only)
 */
export const supportsFileSystemAccess = () => {
  return "showSaveFilePicker" in window && "showOpenFilePicker" in window;
};

/**
 * Check if we're on a tablet device (iPad, Android tablet, etc.)
 * Tablets get special handling - they can use File System API if supported
 * but also need enhanced touch/download UX
 */
export const isTabletDevice = () => {
  const ua = navigator.userAgent;

  // iPad detection (including iPadOS 13+ which reports as Mac)
  const isIPad =
    /iPad/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // Android tablet detection (Android without "Mobile" keyword)
  const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);

  // Surface/Windows tablet detection
  const isSurfaceTablet = /Windows.*Touch/i.test(ua);

  // Screen size check for tablets (768px-1366px typical range)
  const screenWidth = Math.max(window.screen.width, window.screen.height);
  const isTabletScreenSize = screenWidth >= 768 && screenWidth <= 1366;

  return (
    isIPad ||
    isAndroidTablet ||
    isSurfaceTablet ||
    (navigator.maxTouchPoints > 2 && isTabletScreenSize)
  );
};

/**
 * Check if we're on a mobile phone (not tablet)
 */
export const isMobilePhone = () => {
  const ua = navigator.userAgent;

  // Phones explicitly
  const isPhone =
    /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|IEMobile|Opera Mini/i.test(
      ua,
    );

  // Not a tablet
  return isPhone && !isTabletDevice();
};

/**
 * Check if we're on a mobile device (phone OR tablet)
 */
export const isMobileDevice = () => {
  return isMobilePhone() || isTabletDevice();
};

/**
 * Get screen orientation info
 */
export const getOrientationInfo = () => {
  const isLandscape = window.innerWidth > window.innerHeight;
  let screenType;
  if (isTabletDevice()) {
    screenType = "tablet";
  } else if (isMobilePhone()) {
    screenType = "phone";
  } else {
    screenType = "desktop";
  }

  return {
    isLandscape,
    isPortrait: !isLandscape,
    screenType,
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

/**
 * Get the storage strategy based on device capabilities
 * - Desktop: File System API (crash-proof, saves to user's drive)
 * - Tablet: File System API if available, else enhanced IndexedDB + download prompts
 * - Phone: IndexedDB + download prompts
 */
export const getStorageStrategy = () => {
  const hasFileSystemAPI = supportsFileSystemAccess();
  const isTablet = isTabletDevice();
  const isPhone = isMobilePhone();

  if (hasFileSystemAPI && !isPhone) {
    // Desktop and some tablets (iPad Safari 15.2+, Chrome on tablets) support File System API
    return "file-system";
  }

  if (isTablet) {
    // Tablets get enhanced experience with more prominent save prompts
    return "indexeddb-download-enhanced";
  }

  // Phones use basic IndexedDB + download
  return "indexeddb-download";
};

// ============================================================================
// FILE SYSTEM ACCESS API (Desktop "Gold Standard")
// ============================================================================

/**
 * Open the "Save As" dialog and create a new packet file
 * This should be called when user clicks "Start Packet" or "Save My Packet"
 * @returns {Promise<boolean>} Success status
 */
export async function createPacketFile() {
  if (!supportsFileSystemAccess()) {
    console.warn("File System Access API not supported, using fallback");
    return false;
  }

  try {
    const opts = {
      suggestedName: CONFIG.PACKET_FILENAME,
      types: [
        {
          description: "Veteran Packet File",
          accept: { "application/json": [".json"] },
        },
      ],
    };

    // Show system "Save As" dialog
    activeFileHandle = await window.showSaveFilePicker(opts);

    // Store handle metadata for session persistence
    await storeFileHandleMetadata();

    // Initial write to create the file
    const initialData = getEmptyPacket();
    await writeToFileHandle(initialData);

    // eslint-disable-next-line no-console
    console.log("✅ Packet file created successfully");
    notifySaveListeners("file-created", initialData);

    return true;
  } catch (error) {
    if (error.name === "AbortError") {
      // eslint-disable-next-line no-console
      console.log("User cancelled file creation");
      return false;
    }
    console.error("Error creating packet file:", error);
    return false;
  }
}

/**
 * Write data directly to the active file handle (silent save)
 * @param {Object} data - The packet data to write
 * @returns {Promise<boolean>} Success status
 */
async function writeToFileHandle(data) {
  if (!activeFileHandle) {
    console.warn("No active file handle for direct write");
    return false;
  }

  try {
    saveInProgress = true;

    // Create the writable stream
    const writable = await activeFileHandle.createWritable();

    // Prepare packet with metadata
    const packetToSave = {
      ...data,
      _meta: {
        version: CONFIG.PACKET_VERSION,
        savedAt: new Date().toISOString(),
        savedBy: "Vet-Rate.org",
        checksum: generateChecksum(data),
      },
    };

    // Write the JSON data
    await writable.write(JSON.stringify(packetToSave, null, 2));

    // Close the stream (completes the save)
    await writable.close();

    lastSaveTimestamp = Date.now();
    hasUnsavedChanges = false;

    // Update IndexedDB backup
    await storage.setItem(CONFIG.LAST_SAVE_KEY, lastSaveTimestamp.toString());
    await storage.setItem(CONFIG.UNSAVED_FLAG_KEY, "false");

    // eslint-disable-next-line no-console
    console.log("💾 Auto-saved to file:", new Date().toLocaleTimeString());
    notifySaveListeners("saved", data);

    return true;
  } catch (error) {
    console.error("❌ File write failed:", error);
    notifySaveListeners("save-error", error);

    // Fall back to IndexedDB if file write fails
    await saveToIndexedDB(data);
    return false;
  } finally {
    saveInProgress = false;
  }
}

/**
 * Store file handle metadata for session recovery
 * Note: The actual handle can't be stored, but we track that one exists
 */
async function storeFileHandleMetadata() {
  if (!activeFileHandle) return;

  try {
    const metadata = {
      hasHandle: true,
      name: activeFileHandle.name,
      createdAt: new Date().toISOString(),
    };
    await storage.setItem(CONFIG.FILE_HANDLE_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error("Error storing file handle metadata:", error);
  }
}

/**
 * Open an existing packet file for "Resume Packet" feature
 * @returns {Promise<Object|null>} The loaded packet data or null
 */
export async function openExistingPacket() {
  if (!supportsFileSystemAccess()) {
    console.warn("File System Access API not supported");
    return null;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: "Veteran Packet File",
          accept: { "application/json": [".json"] },
        },
      ],
      multiple: false,
    });

    activeFileHandle = handle;
    await storeFileHandleMetadata();

    // Read the file contents
    const file = await handle.getFile();
    const contents = await file.text();
    const data = JSON.parse(contents);

    // Validate it's a Vet-Rate packet
    if (!validatePacketData(data)) {
      throw new Error("Invalid packet file format");
    }

    // Load into memory and IndexedDB
    packetData = data;
    await saveToIndexedDB(data);

    // eslint-disable-next-line no-console
    console.log("✅ Packet loaded from file");
    notifySaveListeners("loaded", data);

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      // eslint-disable-next-line no-console
      console.log("User cancelled file selection");
      return null;
    }
    console.error("Error opening packet file:", error);
    throw error;
  }
}

// ============================================================================
// INDEXEDDB STORAGE LAYER (Primary Browser Storage)
// ============================================================================

const PACKET_STORAGE_KEY = "vetrate_complete_packet";

/**
 * Save packet data to IndexedDB (the browser backup)
 * @param {Object} data - The packet data
 * @returns {Promise<boolean>} Success status
 */
export async function saveToIndexedDB(data) {
  try {
    const packetToSave = {
      ...data,
      _indexedDBMeta: {
        savedAt: new Date().toISOString(),
        isBackup: !activeFileHandle,
      },
    };

    await storage.setItem(PACKET_STORAGE_KEY, JSON.stringify(packetToSave));
    // eslint-disable-next-line no-console
    console.log("📦 Saved to IndexedDB backup");
    return true;
  } catch (error) {
    console.error("IndexedDB save error:", error);
    return false;
  }
}

/**
 * Load packet data from IndexedDB
 * @returns {Promise<Object|null>} The packet data or null
 */
export async function loadFromIndexedDB() {
  try {
    const data = await storage.getItem(PACKET_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      packetData = parsed;
      return parsed;
    }
    return null;
  } catch (error) {
    console.error("IndexedDB load error:", error);
    return null;
  }
}

// ============================================================================
// MOBILE FALLBACK: Download Trigger
// ============================================================================

/**
 * Force download of the current packet as a JSON file (mobile fallback)
 * @param {Object} data - The packet data to download
 * @param {string} filename - Optional custom filename
 */
export function downloadPacketFile(data, filename = null) {
  const packetToDownload = {
    ...data,
    _meta: {
      version: CONFIG.PACKET_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy: "Vet-Rate.org",
    },
  };

  const jsonString = JSON.stringify(packetToDownload, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split("T")[0];
  const downloadName = filename || `My-Vet-Rate-Packet-${date}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Mark as saved
  hasUnsavedChanges = false;
  lastSaveTimestamp = Date.now();

  notifySaveListeners("downloaded", data);
  // eslint-disable-next-line no-console
  console.log("📥 Packet downloaded:", downloadName);
}

/**
 * Load packet from an uploaded file (for mobile restore)
 * @param {File} file - The uploaded JSON file
 * @returns {Promise<Object|null>} The loaded packet data
 */
export async function loadFromUploadedFile(file) {
  try {
    const contents = await file.text();
    const data = JSON.parse(contents);

    if (!validatePacketData(data)) {
      throw new Error("Invalid packet file format");
    }

    packetData = data;
    await saveToIndexedDB(data);

    notifySaveListeners("loaded", data);
    return data;
  } catch (error) {
    console.error("Error loading uploaded file:", error);
    throw error;
  }
}

// ============================================================================
// UNIFIED SAVE PROTOCOL ("Save-As-You-Go")
// ============================================================================

/**
 * Mark that changes have been made (triggers auto-save flow)
 * Call this whenever form data changes
 */
export function markAsModified() {
  hasUnsavedChanges = true;

  // Clear existing debounce timer
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  // Set new debounce timer for auto-save
  autoSaveTimer = setTimeout(() => {
    triggerAutoSave();
  }, CONFIG.AUTO_SAVE_DEBOUNCE_MS);
}

/**
 * Perform the auto-save based on device capabilities
 */
async function triggerAutoSave() {
  if (saveInProgress || !hasUnsavedChanges) return;

  const data = await gatherPacketData();

  if (supportsFileSystemAccess() && activeFileHandle) {
    // Desktop with active file: Direct file write
    await writeToFileHandle(data);
  } else {
    // Mobile or no file handle: IndexedDB only
    await saveToIndexedDB(data);

    // Store the unsaved flag for warning on close
    await storage.setItem(CONFIG.UNSAVED_FLAG_KEY, "true");
  }
}

/**
 * Manual save triggered by user (e.g., "Save My Packet" button)
 * @param {boolean} forceDownload - Force download even on desktop
 * @returns {Promise<boolean>} Success status
 */
export async function manualSave(forceDownload = false) {
  const data = await gatherPacketData();

  if (forceDownload || !supportsFileSystemAccess()) {
    // Download flow
    downloadPacketFile(data);
    return true;
  }

  if (activeFileHandle) {
    // Write to existing file
    return await writeToFileHandle(data);
  } else {
    // Create new file
    const created = await createPacketFile();
    if (created) {
      return await writeToFileHandle(data);
    }
    return false;
  }
}

/**
 * Save triggered when user clicks "Next" or completes a step
 * This is the "hook" that saves before screen transitions
 */
export async function saveOnStepComplete() {
  if (hasUnsavedChanges || packetData) {
    const data = await gatherPacketData();

    // Always save to IndexedDB as backup
    await saveToIndexedDB(data);

    // Desktop: Also save to file if handle exists
    if (supportsFileSystemAccess() && activeFileHandle) {
      await writeToFileHandle(data);
    }
  }

  return true;
}

// ============================================================================
// PACKET DATA MANAGEMENT
// ============================================================================

/**
 * Get an empty packet structure
 */
function getEmptyPacket() {
  return {
    version: CONFIG.PACKET_VERSION,
    createdAt: new Date().toISOString(),
    veteranProfile: {},
    claims: [],
    statements: {},
    savedForms: [],
    myRatings: [],
    serviceHistory: {
      deployments: [],
      awards: [],
      dd214Data: null,
    },
    gapAnalyses: [],
    settings: {},
  };
}

/**
 * Gather all current data into a unified packet structure
 * Pulls from localStorage and current state
 */
export async function gatherPacketData() {
  // If we have data in memory, use it as base
  const base = packetData || getEmptyPacket();

  // Gather from various storage locations
  const gathered = {
    ...base,
    lastUpdated: new Date().toISOString(),
  };

  // Pull claims
  try {
    const claims = localStorage.getItem("vet_rate_saved_claims");
    if (claims) gathered.claims = JSON.parse(claims);
  } catch (e) {
    // Non-fatal: keep the base/default claims if the stored copy is corrupt.
    console.warn("Could not parse saved claims from localStorage", e);
  }

  // Pull statements
  try {
    const statements = localStorage.getItem("vet_rate_statements");
    if (statements) gathered.statements = JSON.parse(statements);
  } catch (e) {
    // Non-fatal: keep the base/default statements if the stored copy is corrupt.
    console.warn("Could not parse saved statements from localStorage", e);
  }

  // Pull veteran profile
  try {
    const profile = localStorage.getItem("vet_rate_veteran_profile");
    if (profile) gathered.veteranProfile = JSON.parse(profile);
  } catch (e) {
    // Non-fatal: keep the base/default profile if the stored copy is corrupt.
    console.warn("Could not parse veteran profile from localStorage", e);
  }

  // Pull saved forms
  try {
    const forms = localStorage.getItem("vet_rate_saved_forms");
    if (forms) gathered.savedForms = JSON.parse(forms);
  } catch (e) {
    // Non-fatal: keep the base/default saved forms if the stored copy is corrupt.
    console.warn("Could not parse saved forms from localStorage", e);
  }

  // Pull ratings
  try {
    const ratings = localStorage.getItem("vet_rate_my_ratings");
    if (ratings) gathered.myRatings = JSON.parse(ratings);
  } catch (e) {
    // Non-fatal: keep the base/default ratings if the stored copy is corrupt.
    console.warn("Could not parse saved ratings from localStorage", e);
  }

  // Pull service history
  try {
    const history = localStorage.getItem("vet_rate_service_history");
    if (history) gathered.serviceHistory = JSON.parse(history);
  } catch (e) {
    // Non-fatal: keep the base/default service history if the stored copy is corrupt.
    console.warn("Could not parse service history from localStorage", e);
  }

  // Pull gap analyses
  try {
    const gaps = localStorage.getItem("vet_rate_gap_analyses");
    if (gaps) gathered.gapAnalyses = JSON.parse(gaps);
  } catch (e) {
    // Non-fatal: keep the base/default gap analyses if the stored copy is corrupt.
    console.warn("Could not parse gap analyses from localStorage", e);
  }

  packetData = gathered;
  return gathered;
}

/**
 * Restore packet data back into localStorage and app state
 * @param {Object} packet - The packet data to restore
 */
export async function restorePacketData(packet) {
  if (!packet) return false;

  try {
    // Restore each data type
    if (packet.claims) {
      localStorage.setItem(
        "vet_rate_saved_claims",
        JSON.stringify(packet.claims),
      );
    }
    if (packet.statements) {
      localStorage.setItem(
        "vet_rate_statements",
        JSON.stringify(packet.statements),
      );
    }
    if (packet.veteranProfile) {
      localStorage.setItem(
        "vet_rate_veteran_profile",
        JSON.stringify(packet.veteranProfile),
      );
    }
    if (packet.savedForms) {
      localStorage.setItem(
        "vet_rate_saved_forms",
        JSON.stringify(packet.savedForms),
      );
    }
    if (packet.myRatings) {
      localStorage.setItem(
        "vet_rate_my_ratings",
        JSON.stringify(packet.myRatings),
      );
    }
    if (packet.serviceHistory) {
      localStorage.setItem(
        "vet_rate_service_history",
        JSON.stringify(packet.serviceHistory),
      );
    }
    if (packet.gapAnalyses) {
      localStorage.setItem(
        "vet_rate_gap_analyses",
        JSON.stringify(packet.gapAnalyses),
      );
    }

    packetData = packet;

    // Also store in IndexedDB
    await saveToIndexedDB(packet);

    notifySaveListeners("restored", packet);
    // eslint-disable-next-line no-console
    console.log("✅ Packet data restored successfully");
    return true;
  } catch (error) {
    console.error("Error restoring packet data:", error);
    return false;
  }
}

// ============================================================================
// VALIDATION & INTEGRITY
// ============================================================================

/**
 * Validate that a packet has the expected structure
 */
function validatePacketData(data) {
  if (!data || typeof data !== "object") return false;

  // Must have at least version or some expected fields
  const hasVersion = data.version || data._meta?.version;
  const hasClaims = Array.isArray(data.claims);
  const hasProfile = data.veteranProfile !== undefined;

  return hasVersion || hasClaims || hasProfile;
}

/**
 * Generate a simple checksum for data integrity
 */
function generateChecksum(data) {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// ============================================================================
// UNSAVED CHANGES WARNING (beforeunload)
// ============================================================================

/**
 * Initialize the beforeunload warning for unsaved changes
 */
export function initUnsavedChangesWarning() {
  window.addEventListener("beforeunload", (event) => {
    if (hasUnsavedChanges) {
      // This triggers the browser's native warning dialog
      event.preventDefault();
      event.returnValue = "";
      return "";
    }
  });
}

/**
 * Check if there are unsaved changes
 */
export function checkHasUnsavedChanges() {
  return hasUnsavedChanges;
}

/**
 * Get info about save status
 */
export function getSaveStatus() {
  return {
    hasUnsavedChanges,
    lastSaveTimestamp,
    hasActiveFileHandle: !!activeFileHandle,
    storageStrategy: getStorageStrategy(),
    isMobile: isMobileDevice(),
  };
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Add a listener for save events
 * @param {Function} callback - Called with (eventType, data)
 */
export function addSaveListener(callback) {
  saveListeners.push(callback);
  return () => {
    saveListeners = saveListeners.filter((cb) => cb !== callback);
  };
}

/**
 * Notify all listeners of a save event
 */
function notifySaveListeners(eventType, data) {
  saveListeners.forEach((callback) => {
    try {
      callback(eventType, data);
    } catch (error) {
      console.error("Save listener error:", error);
    }
  });
}

// ============================================================================
// MILESTONE SAVES (Periodic Backup)
// ============================================================================

/**
 * Start the milestone save timer
 * This ensures periodic saves even if user isn't actively typing
 */
export function startMilestoneSaves() {
  if (milestoneSaveTimer) {
    clearInterval(milestoneSaveTimer);
  }

  milestoneSaveTimer = setInterval(async () => {
    if (hasUnsavedChanges && !saveInProgress) {
      // eslint-disable-next-line no-console
      console.log("⏰ Milestone save triggered");
      await triggerAutoSave();
    }
  }, CONFIG.MILESTONE_SAVE_MS);
}

/**
 * Stop milestone saves
 */
export function stopMilestoneSaves() {
  if (milestoneSaveTimer) {
    clearInterval(milestoneSaveTimer);
    milestoneSaveTimer = null;
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the persistent storage system
 * Call this on app startup
 */
export async function initPersistentStorage() {
  // eslint-disable-next-line no-console
  console.log("🚀 Initializing Persistent Storage System...");
  // eslint-disable-next-line no-console
  console.log(`   Strategy: ${getStorageStrategy()}`);
  // eslint-disable-next-line no-console
  console.log(
    `   File System API: ${supportsFileSystemAccess() ? "Supported" : "Not supported"}`,
  );
  // eslint-disable-next-line no-console
  console.log(`   Device: ${isMobileDevice() ? "Mobile" : "Desktop"}`);

  // Load any existing data from IndexedDB
  const existingData = await loadFromIndexedDB();
  if (existingData) {
    packetData = existingData;
    // eslint-disable-next-line no-console
    console.log("📂 Loaded existing packet from IndexedDB");
  }

  // Check if there were unsaved changes from a previous session
  const unsavedFlag = await storage.getItem(CONFIG.UNSAVED_FLAG_KEY);
  if (unsavedFlag === "true") {
    hasUnsavedChanges = true;
    // eslint-disable-next-line no-console
    console.log("⚠️ Found unsaved changes from previous session");
  }

  // Start milestone saves
  startMilestoneSaves();

  return {
    strategy: getStorageStrategy(),
    hasExistingData: !!existingData,
    hasUnsavedChanges,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Feature detection
  supportsFileSystemAccess,
  isMobileDevice,
  getStorageStrategy,

  // File System API
  createPacketFile,
  openExistingPacket,

  // IndexedDB
  saveToIndexedDB,
  loadFromIndexedDB,

  // Mobile fallback
  downloadPacketFile,
  loadFromUploadedFile,

  // Unified save protocol
  markAsModified,
  manualSave,
  saveOnStepComplete,

  // Data management
  gatherPacketData,
  restorePacketData,

  // Status
  checkHasUnsavedChanges,
  getSaveStatus,

  // Listeners
  addSaveListener,

  // Lifecycle
  initPersistentStorage,
  startMilestoneSaves,
  stopMilestoneSaves,
};
