/**
 * VA.gov OAuth 2.0 Configuration
 * 
 * This configuration is for the Authorization Code Grant with PKCE flow.
 * Client-side only - NO CLIENT SECRET required or used.
 */

// Read from environment variables (set in .env file)
export const VA_AUTH_CONFIG = {
  clientId: import.meta.env.VITE_VA_CLIENT_ID,
  redirectUri: import.meta.env.VITE_VA_REDIRECT_URL,
  environment: import.meta.env.VITE_VA_API_ENV || 'sandbox',
};

// VA.gov OAuth endpoints
const ENDPOINTS = {
  sandbox: {
    authorization: 'https://sandbox-api.va.gov/oauth2/authorization',
    token: 'https://sandbox-api.va.gov/oauth2/token',
    userInfo: 'https://sandbox-api.va.gov/oauth2/userinfo',
    revoke: 'https://sandbox-api.va.gov/oauth2/revoke',
  },
  production: {
    authorization: 'https://api.va.gov/oauth2/authorization',
    token: 'https://api.va.gov/oauth2/token',
    userInfo: 'https://api.va.gov/oauth2/userinfo',
    revoke: 'https://api.va.gov/oauth2/revoke',
  },
};

// Get the appropriate endpoints based on environment
export const VA_ENDPOINTS = ENDPOINTS[VA_AUTH_CONFIG.environment];

// OAuth Scopes
// openid: Required for OpenID Connect
// profile: Basic user profile info
// offline_access: Enables refresh tokens for long-term access
// claim.read: Access to VA claims data
// service_history.read: Access to military service history
export const VA_SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'claim.read',
  'service_history.read',
].join(' ');

// Storage keys
export const STORAGE_KEYS = {
  CODE_VERIFIER: 'va_code_verifier',
  STATE: 'va_oauth_state',
  ACCESS_TOKEN: 'va_access_token',
  REFRESH_TOKEN: 'va_refresh_token',
  TOKEN_EXPIRY: 'va_token_expiry',
  USER_INFO: 'va_user_info',
};

// Validate configuration
export function validateConfig() {
  if (!VA_AUTH_CONFIG.clientId) {
    console.error('[VA Auth] Missing VITE_VA_CLIENT_ID environment variable');
    return false;
  }
  if (!VA_AUTH_CONFIG.redirectUri) {
    console.error('[VA Auth] Missing VITE_VA_REDIRECT_URL environment variable');
    return false;
  }
  return true;
}
