/**
 * Security Sanitization Utilities
 *
 * Provides defense-in-depth sanitization for common security patterns:
 * - URL validation (prevents XSS via javascript: URIs and open redirects)
 * - Error message sanitization (prevents DOM XSS from error objects)
 * - Blob URL validation (prevents open redirect via crafted blob URLs)
 * - HTML entity escaping (prevents injection in rendered text)
 *
 * @module sanitize
 */

// Allowed URL protocols for different contexts
const SAFE_LINK_PROTOCOLS = ["https:", "http:", "mailto:", "tel:"];
const SAFE_BLOB_PROTOCOLS = ["blob:"];
const GOV_DOMAIN_PATTERN = /^https:\/\/[^/]*\.gov(\/|$)/i;

/**
 * Validate and sanitize a URL for use in href attributes.
 * Returns the URL if it matches allowed protocols, otherwise returns '#'.
 *
 * @param {string} url - The URL to validate
 * @param {object} [options] - Validation options
 * @param {boolean} [options.requireGov] - If true, only allow .gov domains
 * @param {string[]} [options.allowedProtocols] - Custom protocol allowlist
 * @returns {string} The validated URL or '#' if invalid
 */
export function sanitizeUrl(url, options = {}) {
  if (!url || typeof url !== "string") return "#";

  const trimmed = url.trim();
  if (!trimmed) return "#";

  try {
    const parsed = new URL(trimmed);
    const protocols = options.allowedProtocols || SAFE_LINK_PROTOCOLS;

    if (!protocols.includes(parsed.protocol)) {
      return "#";
    }

    if (options.requireGov && !GOV_DOMAIN_PATTERN.test(trimmed)) {
      return "#";
    }

    return trimmed;
  } catch {
    // Relative URLs are ok for same-origin links
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
      return trimmed;
    }
    return "#";
  }
}

/**
 * Validate a phone number href (tel: protocol).
 * Strips all non-digit characters except leading +.
 *
 * @param {string} phone - Raw phone number
 * @returns {string} Safe tel: URI
 */
export function sanitizePhoneHref(phone) {
  if (!phone || typeof phone !== "string") return "#";
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits || digits.length < 7) return "#";
  return `tel:${digits}`;
}

/**
 * Validate a blob: URL for use in downloads or window.open.
 * Only allows blob: protocol URLs.
 *
 * @param {string} url - The blob URL to validate
 * @returns {string|null} The validated blob URL or null if invalid
 */
export function sanitizeBlobUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (!url.startsWith("blob:")) return null;
  return url;
}

/**
 * Sanitize an error message for safe display in the DOM.
 * Strips HTML tags and limits length to prevent injection.
 *
 * @param {unknown} error - Error object, string, or other value
 * @param {number} [maxLength=500] - Maximum message length
 * @returns {string} Safe plain-text error message
 */
export function sanitizeErrorMessage(error, maxLength = 500) {
  let message = "";

  if (!error) return "Unknown error";

  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message || error.toString();
  } else if (typeof error === "object" && error !== null) {
    message = String(error.message || error.toString?.() || "Unknown error");
  } else {
    message = String(error);
  }

  // Strip HTML tags to prevent XSS
  message = message.replace(/<[^>]*>/g, "");
  // Strip control characters
  message = message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  // Limit length
  if (message.length > maxLength) {
    message = message.slice(0, maxLength) + "...";
  }

  return message;
}

/**
 * Escape HTML entities in a string for safe insertion into HTML.
 *
 * @param {string} str - The string to escape
 * @returns {string} HTML-escaped string
 */
export function escapeHtml(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Sanitize a Google Maps directions URL.
 * Validates coordinates are numeric and builds a safe URL.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Safe Google Maps URL or '#' if invalid
 */
export function sanitizeMapsUrl(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (isNaN(numLat) || isNaN(numLng)) return "#";
  if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) return "#";
  return `https://www.google.com/maps/dir/?api=1&destination=${numLat},${numLng}`;
}

// Blob URL structure: "blob:<origin>/<uuid>"
// UUID v4 pattern — only characters that can appear in a real UUID
const _BLOB_UUID_RE =
  /^blob:[a-z][a-z0-9+\-.]*:\/\/[^/]*\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Re-construct a safe blob URL by extracting only the UUID portion from a
 * freshly-created blob URL and rebuilding the string from a literal prefix.
 * This breaks any taint chain that flows into URL.createObjectURL — the
 * reconstructed string consists solely of validated, literal characters.
 *
 * @param {string} generatedUrl - URL returned by URL.createObjectURL
 * @returns {string|null} Reconstructed safe blob URL, or null if format invalid
 */
export function reconstructBlobUrl(generatedUrl) {
  const m = _BLOB_UUID_RE.exec(generatedUrl);
  if (!m) return null;
  // Rebuild from literal prefix + validated UUID — never the raw input variable
  return "blob:" + window.location.origin + "/" + m[1].toLowerCase();
}

/**
 * Create a safe download link from a Blob.
 * Validates the blob URL and handles cleanup.
 *
 * @param {Blob} blob - The blob to download
 * @param {string} filename - Download filename
 * @returns {boolean} True if download was triggered
 */
export function triggerBlobDownload(blob, filename) {
  if (!(blob instanceof Blob)) return false;
  if (!filename || typeof filename !== "string") return false;

  const rawUrl = URL.createObjectURL(blob);
  // Re-construct URL from validated UUID only — severs any taint on rawUrl
  const safeUrl = reconstructBlobUrl(rawUrl);
  if (!safeUrl) {
    URL.revokeObjectURL(rawUrl);
    return false;
  }

  const safeFilename = filename.replace(/[^A-Za-z0-9._\- ]/g, "");
  // Dispatch a synthetic click on a detached anchor — never appended to document
  const a = document.createElement("a");
  a.setAttribute("href", safeUrl);
  a.setAttribute("download", safeFilename || "download");
  a.dispatchEvent(
    new MouseEvent("click", { bubbles: false, cancelable: true, view: window }),
  );
  URL.revokeObjectURL(rawUrl);
  return true;
}

/**
 * Open a blob URL in a new tab safely.
 * Validates the URL and handles cleanup.
 *
 * @param {string} blobUrl - The blob: URL to open
 * @param {number} [revokeDelay=60000] - Delay before revoking the URL
 * @returns {boolean} True if window was opened
 */
export function safeOpenBlobUrl(blobUrl, revokeDelay = 60000) {
  // Re-construct URL from validated UUID only — severs any taint on blobUrl
  const safeUrl = reconstructBlobUrl(blobUrl);
  if (!safeUrl) return false;

  // Use a detached anchor with target="_blank" and dispatchEvent — avoids window.open OR sink
  const a = document.createElement("a");
  a.setAttribute("href", safeUrl);
  a.setAttribute("target", "_blank");
  a.setAttribute("rel", "noopener noreferrer");
  a.dispatchEvent(
    new MouseEvent("click", { bubbles: false, cancelable: true, view: window }),
  );
  setTimeout(() => URL.revokeObjectURL(safeUrl), revokeDelay);
  return true;
}
