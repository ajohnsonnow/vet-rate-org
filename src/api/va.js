/**
 * VA.gov API Service
 *
 * Utility functions for fetching data from VA.gov Sandbox APIs.
 * All functions require a valid access token from the OAuth flow.
 *
 * API Documentation:
 * - Service History: https://developer.va.gov/explore/verification/docs/veteran_verification
 * - Claims: https://developer.va.gov/explore/benefits/docs/claims
 * - Appeals: https://developer.va.gov/explore/appeals/docs/appeals
 * - Facilities: https://developer.va.gov/explore/facilities/docs/va_facilities
 */

import { VA_AUTH_CONFIG, assertVaApiEnabled } from "../config/vaAuth";
import { startApiLog, API_CATEGORIES } from "../utils/vaSyncLogger";

// Base URLs for VA.gov APIs
const VA_API_BASE = {
  sandbox: "https://sandbox-api.va.gov",
  production: "https://api.va.gov",
};

// Proxy path for development (to bypass CORS)
// Vite proxies /va-api/* to https://sandbox-api.va.gov/*
const VA_PROXY_PATH = "/va-api";

// Detect if running in development mode
const isDevelopment = import.meta.env.DEV;

// Get the base URL based on environment
// In development, use the proxy to bypass CORS for authenticated APIs
const getBaseUrl = () =>
  VA_API_BASE[VA_AUTH_CONFIG.environment] || VA_API_BASE.sandbox;

// Get the proxied URL for authenticated requests (bypasses CORS in development)
const getProxiedUrl = () => (isDevelopment ? VA_PROXY_PATH : getBaseUrl());

// ============================================================================
// RATE LIMITER
// Prevents accidental API abuse with simple client-side throttling
// VA API limits: ~60 requests/minute for sandbox, stricter for production
// ============================================================================

const rateLimiter = {
  requests: [],
  maxRequests: 30, // Conservative limit (half of VA's 60/min)
  windowMs: 60000, // 1 minute window

  /**
   * Check if we can make a request, throws if rate limited
   */
  checkLimit() {
    const now = Date.now();
    // Remove requests outside the window
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = Math.ceil(
        (this.windowMs - (now - oldestRequest)) / 1000,
      );
      const error = new Error(
        `Rate limit reached. Please wait ${waitTime} seconds before making more requests.`,
      );
      error.code = "RATE_LIMITED";
      error.retryAfter = waitTime;
      throw error;
    }

    this.requests.push(now);
    return true;
  },

  /**
   * Get current rate limit status
   */
  getStatus() {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);
    return {
      remaining: this.maxRequests - this.requests.length,
      total: this.maxRequests,
      resetsIn:
        this.requests.length > 0
          ? Math.ceil((this.windowMs - (now - this.requests[0])) / 1000)
          : 0,
    };
  },
};

// Export rate limiter status for UI display
export const getApiRateLimitStatus = () => rateLimiter.getStatus();

/**
 * Generic authenticated fetch wrapper
 * Handles common error cases and adds authorization header
 * Uses Vite proxy in development to bypass CORS restrictions
 */
async function authenticatedFetch(endpoint, accessToken, options = {}) {
  assertVaApiEnabled();
  // Check rate limit before making request
  rateLimiter.checkLimit();

  if (!accessToken) {
    throw new Error("No access token provided. Please log in first.");
  }

  // Use proxied URL in development to bypass CORS
  const url = `${getProxiedUrl()}${endpoint}`;

  // eslint-disable-next-line no-console
  console.log(
    `[VA API] Fetching: ${endpoint}${isDevelopment ? " (via proxy)" : ""}`,
  );

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...options.headers,
    },
  });

  // Handle 401 Unauthorized - token may be expired
  if (response.status === 401) {
    const error = new Error("Session expired. Please log in again.");
    error.code = "UNAUTHORIZED";
    throw error;
  }

  // Handle 403 Forbidden - missing required scope
  if (response.status === 403) {
    const error = new Error(
      "Access denied. You may not have the required permissions for this data.",
    );
    error.code = "FORBIDDEN";
    throw error;
  }

  // Handle other errors
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    let errorMessage = `API request failed: ${response.status} ${response.statusText}`;

    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.message || errorJson.error || errorMessage;
    } catch {
      // If body isn't JSON, use the default message
    }

    const error = new Error(errorMessage);
    error.status = response.status;
    error.body = errorBody;
    throw error;
  }

  return response.json();
}

// ============================================================================
// SERVICE HISTORY API
// Scope required: service_history.read
// ============================================================================

/**
 * Get veteran's military service history
 * Returns branches served, service dates, discharge status, etc.
 *
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<Object>} Service history data
 *
 * Example response:
 * {
 *   "data": [
 *     {
 *       "id": "...",
 *       "type": "service_history_episodes",
 *       "attributes": {
 *         "first_name": "Tamara",
 *         "last_name": "Ellis",
 *         "start_date": "2007-04-01",
 *         "end_date": "2016-06-01",
 *         "branch_of_service": "Air Force",
 *         "discharge_status": "honorable",
 *         "deployments": [...]
 *       }
 *     }
 *   ]
 * }
 */
export async function getServiceHistory(accessToken) {
  const endpoint = "/services/veteran_verification/v2/service_history";
  const { complete, fail } = startApiLog(
    API_CATEGORIES.SERVICE_HISTORY,
    endpoint,
    "OAuth",
  );

  try {
    const data = await authenticatedFetch(endpoint, accessToken);
    complete(data, data?.data?.length || 0);
    return data;
  } catch (error) {
    fail(error.message);
    throw error;
  }
}

/**
 * Get veteran's disability rating
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<Object>} Disability rating data
 */
export async function getDisabilityRating(accessToken) {
  const endpoint = "/services/veteran_verification/v2/disability_rating";
  const { complete, fail } = startApiLog(
    API_CATEGORIES.DISABILITY_RATING,
    endpoint,
    "OAuth",
  );

  try {
    const data = await authenticatedFetch(endpoint, accessToken);
    complete(data, 1);
    return data;
  } catch (error) {
    fail(error.message);
    throw error;
  }
}

// ============================================================================
// CLAIMS API
// Scope required: claim.read
// ============================================================================

/**
 * Get all claims for the authenticated veteran
 *
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<Object>} Claims list
 *
 * Example response:
 * {
 *   "data": [
 *     {
 *       "id": "...",
 *       "type": "claim",
 *       "attributes": {
 *         "claimDate": "2022-01-15",
 *         "claimPhaseDates": {...},
 *         "claimType": "Compensation",
 *         "closeDate": null,
 *         "status": "INITIAL_REVIEW",
 *         "supportingDocuments": [...]
 *       }
 *     }
 *   ]
 * }
 */
export async function getClaims(accessToken) {
  const endpoint = "/services/claims/v2/veterans/me/claims";
  const { complete, fail } = startApiLog(
    API_CATEGORIES.CLAIMS,
    endpoint,
    "OAuth",
  );

  try {
    const data = await authenticatedFetch(endpoint, accessToken);
    complete(data, data?.data?.length || 0);
    return data;
  } catch (error) {
    fail(error.message);
    throw error;
  }
}

/**
 * Get details for a specific claim
 *
 * @param {string} accessToken - OAuth access token
 * @param {string} claimId - The ID of the claim
 * @returns {Promise<Object>} Claim details
 */
export async function getClaimById(accessToken, claimId) {
  const endpoint = `/services/claims/v2/veterans/me/claims/${claimId}`;
  const { complete, fail } = startApiLog(
    API_CATEGORIES.CLAIMS,
    endpoint,
    "OAuth",
  );

  try {
    const data = await authenticatedFetch(endpoint, accessToken);
    complete(data, 1);
    return data;
  } catch (error) {
    fail(error.message);
    throw error;
  }
}

/**
 * Upload a supporting document to a specific claim
 *
 * Used for submitting:
 * - DBQs (Disability Benefits Questionnaires)
 * - Nexus Letters / Independent Medical Opinions (IMOs)
 * - Buddy Statements / Lay Statements
 * - Medical Records
 * - Service Records
 * - Other supporting evidence
 *
 * @param {string} accessToken - OAuth access token
 * @param {string} claimId - The ID of the claim to upload to
 * @param {File} file - The PDF file to upload
 * @param {string} documentType - VA document type code (e.g., 'L049' for DBQ)
 * @returns {Promise<Object>} Upload confirmation
 *
 * Document Type Codes:
 * - L049: Disability Benefits Questionnaire (DBQ)
 * - L229: Independent Medical Opinion / Nexus Letter
 * - L034: Buddy Statement / Lay Statement
 * - L015: Medical Treatment Records
 * - L107: Service Records
 * - L023: Other Evidence
 *
 * @see https://developer.va.gov/explore/benefits/docs/claims
 */
export async function uploadClaimDocument(
  accessToken,
  claimId,
  file,
  documentType = "L049",
) {
  assertVaApiEnabled();
  if (!accessToken) {
    throw new Error("No access token provided. Please log in first.");
  }

  if (!claimId) {
    throw new Error("No claim ID provided.");
  }

  if (!file) {
    throw new Error("No file provided.");
  }

  const endpoint = `/services/claims/v2/veterans/me/claims/${claimId}/documents`;
  const url = `${getProxiedUrl()}${endpoint}`;

  // eslint-disable-next-line no-console
  console.log(`[VA API] Uploading document to claim ${claimId}`);
  // eslint-disable-next-line no-console
  console.log(`[VA API] Document type: ${documentType}`);
  // eslint-disable-next-line no-console
  console.log(`[VA API] File: ${file.name} (${file.size} bytes)`);

  // Create FormData for multipart upload
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);

  // Add metadata as JSON
  const metadata = {
    documentType: documentType,
    fileName: file.name,
    description: `Supporting evidence: ${file.name}`,
  };
  formData.append("metadata", JSON.stringify(metadata));

  const { complete, fail } = startApiLog(
    API_CATEGORIES.CLAIMS,
    endpoint,
    "OAuth (Upload)",
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // Note: Do NOT set Content-Type for FormData - browser sets it with boundary
      },
      body: formData,
    });

    if (response.status === 401) {
      const error = new Error("Session expired. Please log in again.");
      error.code = "UNAUTHORIZED";
      throw error;
    }

    if (response.status === 403) {
      const error = new Error(
        "Access denied. You may not have permission to upload to this claim.",
      );
      error.code = "FORBIDDEN";
      throw error;
    }

    if (response.status === 413) {
      throw new Error("File too large. Maximum file size is 25MB.");
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let errorMessage = `Upload failed: ${response.status} ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        // Use default message
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    complete(data, 1);

    // eslint-disable-next-line no-console
    console.log("[VA API] Document uploaded successfully");
    return data;
  } catch (error) {
    fail(error.message);
    throw error;
  }
}

// ============================================================================
// APPEALS API
// Scope required: appealable_issues.read
// ============================================================================

/**
 * Get appealable issues for the authenticated veteran
 * These are decisions that can be appealed through various lanes.
 *
 * @param {string} accessToken - OAuth access token
 * @param {Object} options - Query parameters
 * @param {string} options.decisionReviewType - Type of appeal (e.g., 'higher_level_reviews', 'notice_of_disagreements', 'supplemental_claims')
 * @param {string} options.benefitType - Type of benefit (default: 'compensation')
 * @returns {Promise<Object>} Appealable issues
 *
 * Example response:
 * {
 *   "data": [
 *     {
 *       "type": "appealableIssue",
 *       "id": "...",
 *       "attributes": {
 *         "ratingIssueSubjectText": "Tinnitus",
 *         "description": "Service connection for tinnitus is denied.",
 *         "approxDecisionDate": "2021-03-15",
 *         "decisionIssueId": 12345,
 *         "ratingIssueReferenceId": "67890",
 *         "ratingDecisionReferenceId": "11111",
 *         "ratingIssuePercentNumber": "0"
 *       }
 *     }
 *   ]
 * }
 */
export async function getAppealableIssues(accessToken, options = {}) {
  const params = new URLSearchParams({
    decisionReviewType: options.decisionReviewType || "higher_level_reviews",
    benefitType: options.benefitType || "compensation",
  });

  const endpoint = `/services/appeals/appealable-issues/v0/appealable-issues?${params}`;
  const { complete, fail } = startApiLog(
    API_CATEGORIES.APPEALS,
    endpoint,
    "OAuth",
  );

  try {
    const data = await authenticatedFetch(endpoint, accessToken);
    complete(data, data?.data?.length || 0);
    return data;
  } catch (error) {
    fail(error.message);
    throw error;
  }
}

// ============================================================================
// FACILITIES API (API Key Authentication - No OAuth Required)
// ============================================================================

/**
 * Get VA facilities near a location
 * NOTE: This endpoint uses API Key authentication, NOT OAuth
 *
 * @param {string} apiKey - VA API Key (from developer.va.gov)
 * @param {Object} options - Search parameters
 * @param {string} options.zip - ZIP code to search near
 * @param {number} options.radius - Radius in miles (default: 50)
 * @param {string} options.type - Facility type filter (health, benefits, cemetery, vet_center)
 * @param {string[]} options.services - Service types to filter by
 * @returns {Promise<Object>} Facilities list
 */
export async function getFacilities(apiKey, options = {}) {
  assertVaApiEnabled();
  if (!apiKey) {
    throw new Error("VA API Key is required for facility search");
  }

  const params = new URLSearchParams();

  if (options.zip) {
    params.set("zip", options.zip);
  }
  if (options.lat && options.lng) {
    params.set("lat", options.lat);
    params.set("long", options.lng);
  }
  if (options.radius) {
    params.set("radius", options.radius.toString());
  }
  if (options.type) {
    params.set("type", options.type);
  }
  if (options.services && options.services.length > 0) {
    params.set("services[]", options.services.join(","));
  }
  if (options.page) {
    params.set("page", options.page.toString());
  }
  if (options.perPage) {
    params.set("per_page", options.perPage.toString());
  }

  const baseUrl =
    VA_API_BASE[VA_AUTH_CONFIG.environment] || VA_API_BASE.sandbox;
  const endpoint = `/services/va_facilities/v1/facilities?${params}`;
  const url = `${baseUrl}${endpoint}`;
  const { complete, fail } = startApiLog(
    API_CATEGORIES.FACILITIES,
    endpoint,
    "API Key",
  );

  // eslint-disable-next-line no-console
  console.log(`[VA Facilities API] Fetching: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        apikey: apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Facilities API error: ${response.status} - ${errorBody}`,
      );
    }

    const data = await response.json();
    complete(data, data?.data?.length || 0);
    return data;
  } catch (error) {
    fail(error.message);
    throw error;
  }
}

/**
 * Get a specific facility by ID
 *
 * @param {string} apiKey - VA API Key
 * @param {string} facilityId - The facility ID (e.g., 'vha_648')
 * @returns {Promise<Object>} Facility details
 */
export async function getFacilityById(apiKey, facilityId) {
  assertVaApiEnabled();
  if (!apiKey) {
    throw new Error("VA API Key is required");
  }

  const baseUrl =
    VA_API_BASE[VA_AUTH_CONFIG.environment] || VA_API_BASE.sandbox;
  const url = `${baseUrl}/services/va_facilities/v1/facilities/${facilityId}`;

  const response = await fetch(url, {
    headers: {
      apikey: apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Facilities API error: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// APPEALS STATUS API (OAuth Required)
// Scope required: appeals_status.read
// ============================================================================

/**
 * Get all appeals for the authenticated veteran
 * Returns the status of all appeals (legacy, HLR, NOD, SC)
 *
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<Object>} Appeals status data
 *
 * Example response:
 * {
 *   "data": [
 *     {
 *       "type": "appeal",
 *       "id": "...",
 *       "attributes": {
 *         "appealIds": [...],
 *         "updated": "2021-03-15T12:00:00Z",
 *         "active": true,
 *         "incompleteHistory": false,
 *         "aoj": "vba",
 *         "programArea": "compensation",
 *         "status": {...},
 *         "alerts": [...],
 *         "events": [...],
 *         "issues": [...]
 *       }
 *     }
 *   ]
 * }
 */
export async function getAppealsStatus(accessToken) {
  const endpoint = "/services/appeals/v0/appeals";
  const { complete, fail } = startApiLog(
    API_CATEGORIES.APPEALS,
    endpoint,
    "OAuth",
  );

  try {
    const data = await authenticatedFetch(endpoint, accessToken);
    complete(data, data?.data?.length || 0);
    return data;
  } catch (error) {
    fail(error.message);
    throw error;
  }
}

// ============================================================================
// VA FORMS API (API Key Authentication - No OAuth Required)
// ============================================================================

/**
 * Search VA forms by query string
 *
 * @param {string} apiKey - VA API Key
 * @param {string} query - Search query (e.g., "21-526EZ")
 * @returns {Promise<Object>} Forms matching the query
 *
 * Example response:
 * {
 *   "data": [
 *     {
 *       "id": "21-526EZ",
 *       "type": "va_form",
 *       "attributes": {
 *         "form_name": "21-526EZ",
 *         "title": "Application for Disability Compensation...",
 *         "url": "https://www.va.gov/vaforms/va/pdf/VA21-526EZ.pdf",
 *         "first_issued_on": "2012-01-01",
 *         "last_revision_on": "2023-10-01",
 *         "pages": 12,
 *         "sha256": "...",
 *         "valid_pdf": true
 *       }
 *     }
 *   ]
 * }
 */
export async function searchForms(apiKey, query) {
  assertVaApiEnabled();
  if (!apiKey) {
    throw new Error("VA API Key is required for forms search");
  }

  const params = new URLSearchParams({ query });
  const baseUrl =
    VA_API_BASE[VA_AUTH_CONFIG.environment] || VA_API_BASE.sandbox;
  const endpoint = `/services/va_forms/v0/forms?${params}`;
  const url = `${baseUrl}${endpoint}`;
  const { complete, fail } = startApiLog(
    API_CATEGORIES.FORMS,
    endpoint,
    "API Key",
  );

  // eslint-disable-next-line no-console
  console.log(`[VA Forms API] Searching: ${query}`);

  try {
    const response = await fetch(url, {
      headers: {
        apikey: apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Forms API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    complete(data, data?.data?.length || 0);
    return data;
  } catch (error) {
    fail(error.message);
    throw error;
  }
}

/**
 * Get a specific form by form name
 *
 * @param {string} apiKey - VA API Key
 * @param {string} formName - The form name (e.g., "21-526EZ")
 * @returns {Promise<Object>} Form details
 */
export async function getFormByName(apiKey, formName) {
  assertVaApiEnabled();
  if (!apiKey) {
    throw new Error("VA API Key is required");
  }

  const baseUrl =
    VA_API_BASE[VA_AUTH_CONFIG.environment] || VA_API_BASE.sandbox;
  const url = `${baseUrl}/services/va_forms/v0/forms/${formName}`;

  const response = await fetch(url, {
    headers: {
      apikey: apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Forms API error: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// BENEFITS REFERENCE DATA API (API Key Authentication - No OAuth Required)
// ============================================================================

/**
 * Get list of disabilities from Benefits Reference Data
 *
 * @param {string} apiKey - VA API Key
 * @returns {Promise<Object>} List of disabilities
 *
 * Example response:
 * {
 *   "items": [
 *     {
 *       "id": "string",
 *       "name": "Tinnitus",
 *       "endDateTime": "2099-12-31T23:59:59Z"
 *     }
 *   ]
 * }
 */
export async function getBenefitsReferenceDisabilities(apiKey) {
  assertVaApiEnabled();
  if (!apiKey) {
    throw new Error("VA API Key is required for benefits reference data");
  }

  const baseUrl =
    VA_API_BASE[VA_AUTH_CONFIG.environment] || VA_API_BASE.sandbox;
  const endpoint = "/services/benefits-reference-data/v1/disabilities";
  const url = `${baseUrl}${endpoint}`;
  const { complete, fail } = startApiLog(
    API_CATEGORIES.BENEFITS_REF,
    endpoint,
    "API Key",
  );

  // eslint-disable-next-line no-console
  console.log(`[VA Benefits Reference API] Fetching disabilities list`);

  try {
    const response = await fetch(url, {
      headers: {
        apikey: apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Benefits Reference API error: ${response.status} - ${errorBody}`,
      );
    }

    const data = await response.json();
    complete(data, data?.items?.length || 0);
    return data;
  } catch (error) {
    fail(error.message);
    throw error;
  }
}

/**
 * Get intake sites from Benefits Reference Data
 *
 * @param {string} apiKey - VA API Key
 * @returns {Promise<Object>} List of intake sites
 */
export async function getBenefitsReferenceIntakeSites(apiKey) {
  assertVaApiEnabled();
  if (!apiKey) {
    throw new Error("VA API Key is required");
  }

  const baseUrl =
    VA_API_BASE[VA_AUTH_CONFIG.environment] || VA_API_BASE.sandbox;
  const url = `${baseUrl}/services/benefits-reference-data/v1/intake-sites`;

  const response = await fetch(url, {
    headers: {
      apikey: apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Benefits Reference API error: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format service history for display
 */
export function formatServiceHistory(data) {
  if (!data?.data || !Array.isArray(data.data)) {
    return [];
  }

  return data.data.map((episode) => ({
    id: episode.id,
    branch: episode.attributes?.branch_of_service || "Unknown",
    startDate: episode.attributes?.start_date,
    endDate: episode.attributes?.end_date,
    dischargeStatus: episode.attributes?.discharge_status,
    payGrade: episode.attributes?.pay_grade,
    separationReason: episode.attributes?.separation_reason,
    deployments: episode.attributes?.deployments || [],
  }));
}

/**
 * Format claims data for display
 */
export function formatClaims(data) {
  if (!data?.data || !Array.isArray(data.data)) {
    return [];
  }

  return data.data.map((claim) => ({
    id: claim.id,
    type: claim.attributes?.claimType || "Unknown",
    status: claim.attributes?.status,
    phase: getClaimPhase(claim.attributes?.status),
    dateFiled: claim.attributes?.claimDate,
    closeDate: claim.attributes?.closeDate,
    developmentLetterSent: claim.attributes?.developmentLetterSent,
    decisionLetterSent: claim.attributes?.decisionLetterSent,
    documentsNeeded: claim.attributes?.documentsNeeded,
    endProductCode: claim.attributes?.endProductCode,
    evidenceWaiverSubmitted5103: claim.attributes?.evidenceWaiverSubmitted5103,
    lighthouseId: claim.attributes?.lighthouseId,
    supportingDocuments: claim.attributes?.supportingDocuments || [],
  }));
}

/**
 * Map claim status to user-friendly phase
 */
function getClaimPhase(status) {
  const phases = {
    CLAIM_RECEIVED: { number: 1, name: "Claim Received" },
    UNDER_REVIEW: { number: 2, name: "Initial Review" },
    INITIAL_REVIEW: { number: 2, name: "Initial Review" },
    GATHERING_OF_EVIDENCE: { number: 3, name: "Evidence Gathering" },
    EVIDENCE_GATHERING_REVIEW_DECISION: {
      number: 3,
      name: "Evidence Gathering",
    },
    REVIEW_OF_EVIDENCE: { number: 4, name: "Review of Evidence" },
    PREPARATION_FOR_DECISION: { number: 5, name: "Preparation for Decision" },
    PENDING_DECISION_APPROVAL: { number: 6, name: "Pending Decision" },
    PREPARATION_FOR_NOTIFICATION: { number: 7, name: "Preparing Notification" },
    COMPLETE: { number: 8, name: "Complete" },
    ERRORED: { number: 0, name: "Error" },
    CANCELED: { number: 0, name: "Canceled" },
  };

  return phases[status] || { number: 0, name: status || "Unknown" };
}

/**
 * Format appealable issues for display
 */
export function formatAppealableIssues(data) {
  if (!data?.data || !Array.isArray(data.data)) {
    return [];
  }

  return data.data.map((issue) => ({
    id: issue.id,
    subject: issue.attributes?.ratingIssueSubjectText || "Unknown Issue",
    description: issue.attributes?.description,
    decisionDate: issue.attributes?.approxDecisionDate,
    percentNumber: issue.attributes?.ratingIssuePercentNumber,
    decisionIssueId: issue.attributes?.decisionIssueId,
    ratingIssueReferenceId: issue.attributes?.ratingIssueReferenceId,
    isRating: issue.attributes?.ratingIssueReferenceId != null,
  }));
}

/**
 * Format appeals status for display
 */
export function formatAppealsStatus(data) {
  if (!data?.data || !Array.isArray(data.data)) {
    return [];
  }

  return data.data.map((appeal) => ({
    id: appeal.id,
    type: appeal.attributes?.type || "Unknown",
    active: appeal.attributes?.active,
    programArea: appeal.attributes?.programArea,
    aoj: appeal.attributes?.aoj,
    status: {
      type: appeal.attributes?.status?.type,
      details: appeal.attributes?.status?.details,
    },
    docket: appeal.attributes?.docket,
    issues: appeal.attributes?.issues || [],
    alerts: appeal.attributes?.alerts || [],
    events: appeal.attributes?.events || [],
    updated: appeal.attributes?.updated,
  }));
}

/**
 * Format forms for display
 */
export function formatForms(data) {
  if (!data?.data || !Array.isArray(data.data)) {
    return [];
  }

  return data.data.map((form) => ({
    id: form.id,
    formName: form.attributes?.form_name,
    title: form.attributes?.title,
    url: form.attributes?.url,
    pdfUrl: form.attributes?.url,
    firstIssuedOn: form.attributes?.first_issued_on,
    lastRevisionOn: form.attributes?.last_revision_on,
    pages: form.attributes?.pages,
    validPdf: form.attributes?.valid_pdf,
    deletedAt: form.attributes?.deleted_at,
    relatedForms: form.attributes?.related_forms || [],
    benefitCategories: form.attributes?.benefit_categories || [],
  }));
}

/**
 * Format benefits reference disabilities for display
 */
export function formatBenefitsDisabilities(data) {
  if (!data?.items || !Array.isArray(data.items)) {
    return [];
  }

  return data.items.map((item) => ({
    id: item.id,
    name: item.name,
    endDateTime: item.endDateTime,
  }));
}

/**
 * Format facilities for display
 */
export function formatFacilities(data) {
  if (!data?.data || !Array.isArray(data.data)) {
    return [];
  }

  return data.data.map((facility) => ({
    id: facility.id,
    name: facility.attributes?.name,
    type: facility.attributes?.facilityType,
    classification: facility.attributes?.classification,
    website: facility.attributes?.website,
    phone: facility.attributes?.phone?.main,
    address: {
      street: facility.attributes?.address?.physical?.address1,
      city: facility.attributes?.address?.physical?.city,
      state: facility.attributes?.address?.physical?.state,
      zip: facility.attributes?.address?.physical?.zip,
    },
    hours: facility.attributes?.hours,
    services: facility.attributes?.services || {},
    distance: facility.attributes?.distance,
    coordinates: {
      lat: facility.attributes?.lat,
      lng: facility.attributes?.long,
    },
  }));
}

export default {
  // OAuth-authenticated endpoints
  getServiceHistory,
  getDisabilityRating,
  getClaims,
  getClaimById,
  getAppealableIssues,
  getAppealsStatus,

  // API Key endpoints (Open Data)
  getFacilities,
  getFacilityById,
  searchForms,
  getFormByName,
  getBenefitsReferenceDisabilities,
  getBenefitsReferenceIntakeSites,

  // Formatters
  formatServiceHistory,
  formatClaims,
  formatAppealableIssues,
  formatAppealsStatus,
  formatForms,
  formatBenefitsDisabilities,
  formatFacilities,
};
