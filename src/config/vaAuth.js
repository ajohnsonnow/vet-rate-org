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
// appealable_issues.read: Access to appealable decisions (DISABLED - may not be approved)
// appeals_status.read: Access to appeals status (DISABLED - may not be approved)

// NOTE: Only request scopes that were approved when you registered your Client ID!
// If login fails with "invalid_scope", comment out the unapproved scopes below.
// Start with minimal scopes and add more as they're approved.
export const VA_SCOPES = [
  'openid',
  'profile',
  // 'offline_access',          // Uncomment if approved for refresh tokens
  // 'claim.read',              // Uncomment if approved
  // 'service_history.read',    // Uncomment if approved
  // 'appealable_issues.read',  // Uncomment if approved
  // 'appeals_status.read',     // Uncomment if approved
].join(' ');

// VA API Keys (separate from OAuth)
export const VA_FACILITIES_API_KEY = import.meta.env.VITE_VA_API_KEY;
export const VA_FORMS_API_KEY = import.meta.env.VITE_VA_FORMS_API_KEY;
export const VA_BENEFITS_REF_API_KEY = import.meta.env.VITE_VA_BENEFITS_REF_API_KEY;

// Storage keys
export const STORAGE_KEYS = {
  CODE_VERIFIER: 'va_code_verifier',
  STATE: 'va_oauth_state',
  ACCESS_TOKEN: 'va_access_token',
  REFRESH_TOKEN: 'va_refresh_token',
  TOKEN_EXPIRY: 'va_token_expiry',
  USER_INFO: 'va_user_info',
};

// Check if VA integration is configured (without logging errors)
export function isVaIntegrationConfigured() {
  return !!(VA_AUTH_CONFIG.clientId && VA_AUTH_CONFIG.redirectUri);
}

// Get configuration status for UI display
export function getVaConfigStatus() {
  const issues = [];
  if (!VA_AUTH_CONFIG.clientId) {
    issues.push('VITE_VA_CLIENT_ID not set');
  }
  if (!VA_AUTH_CONFIG.redirectUri) {
    issues.push('VITE_VA_REDIRECT_URL not set');
  }
  if (!VA_FACILITIES_API_KEY) {
    issues.push('VITE_VA_API_KEY not set (VA Facilities)');
  }
  if (!VA_FORMS_API_KEY) {
    issues.push('VITE_VA_FORMS_API_KEY not set (VA Forms)');
  }
  if (!VA_BENEFITS_REF_API_KEY) {
    issues.push('VITE_VA_BENEFITS_REF_API_KEY not set (Benefits Reference Data)');
  }
  return {
    isConfigured: issues.length === 0,
    issues,
    environment: VA_AUTH_CONFIG.environment,
    // Primary property names (used by VADataCenter)
    oauthConfigured: !!(VA_AUTH_CONFIG.clientId && VA_AUTH_CONFIG.redirectUri),
    facilitiesConfigured: !!VA_FACILITIES_API_KEY,
    formsConfigured: !!VA_FORMS_API_KEY,
    benefitsConfigured: !!VA_BENEFITS_REF_API_KEY,
    // Legacy aliases (backwards compat)
    hasOAuth: !!(VA_AUTH_CONFIG.clientId && VA_AUTH_CONFIG.redirectUri),
    hasApiKey: !!VA_FACILITIES_API_KEY,
    hasFormsApiKey: !!VA_FORMS_API_KEY,
    hasBenefitsApiKey: !!VA_BENEFITS_REF_API_KEY,
    hasAllApiKeys: !!(VA_FACILITIES_API_KEY && VA_FORMS_API_KEY && VA_BENEFITS_REF_API_KEY),
  };
}

// Validate configuration (logs errors - use for login attempts)
export function validateConfig() {
  if (!VA_AUTH_CONFIG.clientId) {
    console.error('[VA Auth] Missing VITE_VA_CLIENT_ID environment variable');
    console.error('[VA Auth] Set this in your Render Dashboard or .env.local file');
    return false;
  }
  if (!VA_AUTH_CONFIG.redirectUri) {
    console.error('[VA Auth] Missing VITE_VA_REDIRECT_URL environment variable');
    return false;
  }
  return true;
}
