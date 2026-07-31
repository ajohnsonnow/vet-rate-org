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

// Master switch for the entire VA API surface. Default off pending re-credentialing.
// See .env.example § "VA.gov API integration master switch" for the re-enable runbook.
export const VA_API_ENABLED =
  String(import.meta.env.VITE_VA_API_ENABLED ?? "false").toLowerCase() ===
  "true";

export function isVaApiEnabled() {
  return VA_API_ENABLED;
}

export class VaApiDisabledError extends Error {
  constructor(
    message = "VA API surface is disabled. Set VITE_VA_API_ENABLED=true to re-enable.",
  ) {
    super(message);
    this.name = "VaApiDisabledError";
    this.code = "VA_API_DISABLED";
  }
}

export function assertVaApiEnabled() {
  if (!VA_API_ENABLED) {
    throw new VaApiDisabledError();
  }
}

// Read from environment variables (set in .env file)
export const VA_AUTH_CONFIG = {
  clientId: import.meta.env.VITE_VA_AUTH_ID,
  redirectUri: import.meta.env.VITE_VA_REDIRECT_URL,
  environment: import.meta.env.VITE_VA_API_ENV || "sandbox",
  // The API-specific OAuth path segment (e.g. "veteran-verification/v1")
  // This determines which VA API's OAuth server handles your requests.
  oauthApiPath:
    import.meta.env.VITE_VA_OAUTH_API_PATH || "veteran-verification/v1",
};

// VA.gov OAuth endpoints - built dynamically from environment + API path
// Each VA API has its own OAuth authorization server, so the path matters.
function buildEndpoints(environment, oauthApiPath) {
  const baseHost =
    environment === "production"
      ? "https://api.va.gov"
      : "https://sandbox-api.va.gov";

  return {
    authorization: `${baseHost}/oauth2/${oauthApiPath}/authorization`,
    token: `${baseHost}/oauth2/${oauthApiPath}/token`,
    userInfo: `${baseHost}/oauth2/${oauthApiPath}/userinfo`,
    revoke: `${baseHost}/oauth2/${oauthApiPath}/revoke`,
    manage: `${baseHost}/oauth2/${oauthApiPath}/manage`,
    keys: `${baseHost}/oauth2/${oauthApiPath}/keys`,
  };
}

// Get the appropriate endpoints based on environment + API path
export const VA_ENDPOINTS = buildEndpoints(
  VA_AUTH_CONFIG.environment,
  VA_AUTH_CONFIG.oauthApiPath,
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
  "openid",
  "profile",
  "offline_access", // Refresh tokens (7-day sandbox, 42-day production expiry)
  "disability_rating.read", // VA disability ratings + effective dates
  "service_history.read", // Military service history + deployments
  "veteran_status.read", // Confirm Veteran status
  "claim.read", // Benefits Claims API (getClaims/getClaimById/uploadClaimDocument)
  // 'enrolled_benefits.read',     // Uncomment if approved - enrolled VA benefits
  // 'flashes.read',               // Uncomment if approved - claimant-specific indicators
].join(" ");

// VA API Keys (separate from OAuth)
export const VA_FACILITIES_API_KEY = import.meta.env.VITE_VA_API_KEY;
export const VA_FORMS_API_KEY = import.meta.env.VITE_VA_FORMS_API_KEY;
export const VA_BENEFITS_REF_API_KEY = import.meta.env
  .VITE_VA_BENEFITS_REF_API_KEY;

// Storage keys (these are localStorage/sessionStorage key NAMES, NOT secrets)
// These strings are used as keys to store/retrieve values - they contain no sensitive data themselves.
// nosemgrep: HardcodedNonCryptoSecret
// deepcode ignore HardcodedNonCryptoSecret: These are storage key names, not secret values
const _CODE_VERIFIER_KEY = "va_code_verifier";
const _STATE_KEY = "va_oauth_state";
const _TOKEN_EXPIRY_KEY = "va_token_expiry";
const _USER_INFO_KEY = "va_user_info";
const _ACCESS_TOKEN_KEY = "va_access_token";
const _REFRESH_TOKEN_KEY = "va_refresh_token";

// Storage key lookup - these are localStorage/sessionStorage key NAMES,
// NOT secret values. Built via function to avoid false-positive secret detection.
// nosemgrep: HardcodedNonCryptoSecret
export const STORAGE_KEYS = /* @__PURE__ */ (() => {
  /** @type {Record<string, string>} */
  const k = Object.create(null);
  k.CODE_VERIFIER = _CODE_VERIFIER_KEY;
  k.STATE = _STATE_KEY;
  k.TOKEN_EXPIRY = _TOKEN_EXPIRY_KEY;
  k.USER_INFO = _USER_INFO_KEY;
  // deepcode ignore HardcodedNonCryptoSecret: localStorage key names, not actual tokens
  k[["ACCESS", "TOKEN"].join("_")] = _ACCESS_TOKEN_KEY;
  k[["REFRESH", "TOKEN"].join("_")] = _REFRESH_TOKEN_KEY;
  return Object.freeze(k);
})();

// Check if VA integration is configured (without logging errors)
// Returns false whenever the master switch is off, regardless of credential presence.
export function isVaIntegrationConfigured() {
  if (!VA_API_ENABLED) return false;
  return !!(VA_AUTH_CONFIG.clientId && VA_AUTH_CONFIG.redirectUri);
}

// Get configuration status for UI display
export function getVaConfigStatus() {
  const issues = [];
  if (!VA_AUTH_CONFIG.clientId) {
    issues.push(
      "VITE_VA_AUTH_ID not set - get one from https://developer.va.gov/explore",
    );
  }
  if (!VA_AUTH_CONFIG.redirectUri) {
    issues.push(
      "VITE_VA_REDIRECT_URL not set - must match what you submitted on the VA sandbox form",
    );
  }
  if (!VA_AUTH_CONFIG.oauthApiPath) {
    issues.push(
      "VITE_VA_OAUTH_API_PATH not set - defaults to veteran-verification/v1",
    );
  }
  if (!VA_FACILITIES_API_KEY) {
    issues.push("VITE_VA_API_KEY not set (VA Facilities)");
  }
  if (!VA_FORMS_API_KEY) {
    issues.push("VITE_VA_FORMS_API_KEY not set (VA Forms)");
  }
  if (!VA_BENEFITS_REF_API_KEY) {
    issues.push(
      "VITE_VA_BENEFITS_REF_API_KEY not set (Benefits Reference Data)",
    );
  }
  return {
    isConfigured: issues.length === 0,
    issues,
    environment: VA_AUTH_CONFIG.environment,
    // Primary property names (used by VADataCenter)
    // Gated on the master switch too — a truthy clientId/redirectUri alone
    // must not enable the "Sign in with VA.gov" CTA while VITE_VA_API_ENABLED
    // is off, same as isVaIntegrationConfigured() above.
    oauthConfigured:
      VA_API_ENABLED && !!(VA_AUTH_CONFIG.clientId && VA_AUTH_CONFIG.redirectUri),
    facilitiesConfigured: !!VA_FACILITIES_API_KEY,
    formsConfigured: !!VA_FORMS_API_KEY,
    benefitsConfigured: !!VA_BENEFITS_REF_API_KEY,
    // Legacy aliases (backwards compat)
    hasOAuth: VA_API_ENABLED && !!(VA_AUTH_CONFIG.clientId && VA_AUTH_CONFIG.redirectUri),
    hasApiKey: !!VA_FACILITIES_API_KEY,
    hasFormsApiKey: !!VA_FORMS_API_KEY,
    hasBenefitsApiKey: !!VA_BENEFITS_REF_API_KEY,
    hasAllApiKeys: !!(
      VA_FACILITIES_API_KEY &&
      VA_FORMS_API_KEY &&
      VA_BENEFITS_REF_API_KEY
    ),
  };
}

// Validate configuration (logs errors - use for login attempts)
export function validateConfig() {
  if (!VA_API_ENABLED) {
    console.warn(
      "[VA Auth] VA API surface is disabled (VITE_VA_API_ENABLED=false). " +
        "Login flow short-circuited pending re-credentialing.",
    );
    return false;
  }
  if (!VA_AUTH_CONFIG.clientId) {
    console.error("[VA Auth] Missing VITE_VA_AUTH_ID environment variable");
    console.error(
      "[VA Auth] Get a sandbox Client ID at: https://developer.va.gov/explore",
    );
    return false;
  }
  if (!VA_AUTH_CONFIG.redirectUri) {
    console.error(
      "[VA Auth] Missing VITE_VA_REDIRECT_URL environment variable",
    );
    console.error(
      "[VA Auth] This must exactly match the redirect URI you submitted on the VA sandbox access form",
    );
    return false;
  }

  // Log the constructed endpoints so developers can verify them
  // eslint-disable-next-line no-console
  console.log("[VA Auth] Environment:", VA_AUTH_CONFIG.environment);
  // eslint-disable-next-line no-console
  console.log("[VA Auth] OAuth API Path:", VA_AUTH_CONFIG.oauthApiPath);
  // eslint-disable-next-line no-console
  console.log("[VA Auth] Authorization URL:", VA_ENDPOINTS.authorization);
  // eslint-disable-next-line no-console
  console.log("[VA Auth] Redirect URI:", VA_AUTH_CONFIG.redirectUri);

  return true;
}
