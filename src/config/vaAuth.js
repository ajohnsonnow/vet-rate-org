/**
 * VA.gov OAuth 2.0 Configuration
 * 
 * This configuration is for the Authorization Code Grant with PKCE flow.
 * Client-side only - NO CLIENT SECRET required or used.
 * 
 * IMPORTANT: VA OAuth endpoints are API-specific. Different APIs use different
 * OAuth paths. For example:
 *   - Veteran Service History & Eligibility: /oauth2/veteran-verification/v1/
 *   - Benefits Claims: /oauth2/claims/v1/
 *   - Clinical Health: /oauth2/clinical-health/v1/
 * 
 * Set VITE_VA_OAUTH_API_PATH to match the API you registered for at:
 *   https://developer.va.gov/explore
 * 
 * The redirect URI you set in VITE_VA_REDIRECT_URL MUST exactly match
 * the redirect URI you submitted on the VA sandbox access form.
 * 
 * @see https://developer.va.gov/explore/api/veteran-service-history-and-eligibility/authorization-code
 */

// Read from environment variables (set in .env file)
export const VA_AUTH_CONFIG = {
  clientId: import.meta.env.VITE_VA_AUTH_ID,
  redirectUri: import.meta.env.VITE_VA_REDIRECT_URL,
  environment: import.meta.env.VITE_VA_API_ENV || 'sandbox',
  // The API-specific OAuth path segment (e.g. "veteran-verification/v1")
  // This determines which VA API's OAuth server handles your requests.
  oauthApiPath: import.meta.env.VITE_VA_OAUTH_API_PATH || 'veteran-verification/v1',
};

// VA.gov OAuth endpoints - built dynamically from environment + API path
// Each VA API has its own OAuth authorization server, so the path matters.
function buildEndpoints(environment, oauthApiPath) {
  const baseHost = environment === 'production'
    ? 'https://api.va.gov'
    : 'https://sandbox-api.va.gov';

  return {
    authorization: `${baseHost}/oauth2/${oauthApiPath}/authorization`,
    token:         `${baseHost}/oauth2/${oauthApiPath}/token`,
    userInfo:      `${baseHost}/oauth2/${oauthApiPath}/userinfo`,
    revoke:        `${baseHost}/oauth2/${oauthApiPath}/revoke`,
    manage:        `${baseHost}/oauth2/${oauthApiPath}/manage`,
    keys:          `${baseHost}/oauth2/${oauthApiPath}/keys`,
  };
}

// Get the appropriate endpoints based on environment + API path
export const VA_ENDPOINTS = buildEndpoints(
  VA_AUTH_CONFIG.environment,
  VA_AUTH_CONFIG.oauthApiPath
);

// OAuth Scopes - must match exactly what was approved when you registered
// your Client ID via the VA sandbox access form.
//
// Scopes for the Veteran Service History & Eligibility API:
//   openid, profile, offline_access,
//   disability_rating.read, service_history.read, veteran_status.read,
//   enrolled_benefits.read, flashes.read
//
// If login fails with "invalid_scope", reduce to only the scopes VA approved.
// Start minimal (openid + profile) and add more as approved.
export const VA_SCOPES = [
  'openid',
  'profile',
  'offline_access',                // Refresh tokens (7-day sandbox, 42-day production expiry)
  'disability_rating.read',        // VA disability ratings + effective dates
  'service_history.read',          // Military service history + deployments
  'veteran_status.read',           // Confirm Veteran status
  // 'enrolled_benefits.read',     // Uncomment if approved - enrolled VA benefits
  // 'flashes.read',               // Uncomment if approved - claimant-specific indicators
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
    issues.push('VITE_VA_AUTH_ID not set - get one from https://developer.va.gov/explore');
  }
  if (!VA_AUTH_CONFIG.redirectUri) {
    issues.push('VITE_VA_REDIRECT_URL not set - must match what you submitted on the VA sandbox form');
  }
  if (!VA_AUTH_CONFIG.oauthApiPath) {
    issues.push('VITE_VA_OAUTH_API_PATH not set - defaults to veteran-verification/v1');
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
    console.error('[VA Auth] Missing VITE_VA_AUTH_ID environment variable');
    console.error('[VA Auth] Get a sandbox Client ID at: https://developer.va.gov/explore');
    return false;
  }
  if (!VA_AUTH_CONFIG.redirectUri) {
    console.error('[VA Auth] Missing VITE_VA_REDIRECT_URL environment variable');
    console.error('[VA Auth] This must exactly match the redirect URI you submitted on the VA sandbox access form');
    return false;
  }
  
  // Log the constructed endpoints so developers can verify them
  console.log('[VA Auth] Environment:', VA_AUTH_CONFIG.environment);
  console.log('[VA Auth] OAuth API Path:', VA_AUTH_CONFIG.oauthApiPath);
  console.log('[VA Auth] Authorization URL:', VA_ENDPOINTS.authorization);
  console.log('[VA Auth] Redirect URI:', VA_AUTH_CONFIG.redirectUri);
  
  return true;
}
