/**
 * PKCE (Proof Key for Code Exchange) Utilities
 * 
 * Implements RFC 7636 for secure OAuth 2.0 authorization without client secrets.
 * Uses native Web Crypto API - no external dependencies required.
 */

/**
 * Generate a cryptographically secure random string for the code_verifier
 * @returns {string} A URL-safe base64 encoded random string (43-128 characters)
 */
export function generateCodeVerifier() {
  const array = new Uint8Array(32); // 32 bytes = 256 bits
  window.crypto.getRandomValues(array);
  
  // Convert to base64url encoding (URL-safe base64)
  return base64UrlEncode(array);
}

/**
 * Generate the code_challenge from the code_verifier using SHA-256
 * @param {string} codeVerifier - The code verifier to hash
 * @returns {Promise<string>} The base64url-encoded SHA-256 hash
 */
export async function generateCodeChallenge(codeVerifier) {
  // Convert the verifier to a buffer
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  
  // Hash it with SHA-256
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  
  // Convert to base64url encoding
  const hashArray = new Uint8Array(hashBuffer);
  return base64UrlEncode(hashArray);
}

/**
 * Generate a random state parameter for CSRF protection
 * @returns {string} A random state string
 */
export function generateState() {
  const array = new Uint8Array(16); // 16 bytes = 128 bits
  window.crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Convert a Uint8Array to base64url encoding
 * @param {Uint8Array} buffer - The buffer to encode
 * @returns {string} Base64url encoded string
 */
function base64UrlEncode(buffer) {
  // Convert buffer to base64
  let base64 = btoa(String.fromCharCode(...buffer));
  
  // Make it URL-safe:
  // Replace + with - (minus)
  // Replace / with _ (underscore)
  // Remove trailing = padding
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate both code_verifier and code_challenge at once
 * @returns {Promise<{verifier: string, challenge: string}>}
 */
export async function generatePKCEPair() {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  
  return {
    verifier,
    challenge,
  };
}
