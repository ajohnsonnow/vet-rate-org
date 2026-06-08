/**
 * VA Sandbox API Utilities
 *
 * Provides functions to interact with all VA.gov Sandbox APIs:
 *
 * USER DATA (OAuth Required):
 * - Service History API
 * - Claims API
 * - Appealable Issues API
 * - Appeals Status API
 *
 * OPEN DATA (API Key Required):
 * - VA Facilities API
 * - VA Forms API
 * - Benefits Reference Data API
 *
 * @see https://developer.va.gov/explore
 */

import { assertVaApiEnabled } from "../config/vaAuth";

// Base URLs - use proxy in development to bypass CORS
const isDev = import.meta.env.DEV;
const SANDBOX_BASE = isDev ? "/va-api" : "https://sandbox-api.va.gov";

// Get API keys from environment (each VA API may have its own key)
const API_KEY = import.meta.env.VITE_VA_API_KEY;
const BENEFITS_REF_API_KEY = import.meta.env.VITE_VA_BENEFITS_REF_API_KEY;
const FORMS_API_KEY = import.meta.env.VITE_VA_FORMS_API_KEY;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Make an authenticated request (OAuth Bearer token)
 */
async function authenticatedFetch(endpoint, accessToken, options = {}) {
  assertVaApiEnabled();
  const url = `${SANDBOX_BASE}${endpoint}`;

  // eslint-disable-next-line no-console
  console.log(`[VA API] Fetching: ${url}`);

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (response.status === 401) {
    const error = new Error(
      "Authentication expired. Please reconnect your VA account.",
    );
    error.code = "UNAUTHORIZED";
    throw error;
  }

  if (response.status === 403) {
    const error = new Error(
      "Access denied. Missing required scope for this data.",
    );
    error.code = "FORBIDDEN";
    throw error;
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    let errorMessage = `API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.message || errorJson.error || errorMessage;
    } catch {
      // Use default message
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Make an API key authenticated request (Open Data)
 * @param {string} endpoint - API endpoint path
 * @param {Object} options - Fetch options
 * @param {string} customApiKey - Optional specific API key (defaults to VITE_VA_API_KEY)
 */
async function apiKeyFetch(endpoint, options = {}, customApiKey = null) {
  assertVaApiEnabled();
  const apiKey = customApiKey || API_KEY;

  if (!apiKey) {
    throw new Error("VA API Key not configured. Add VITE_VA_API_KEY to .env");
  }

  const url = `${SANDBOX_BASE}${endpoint}`;

  // eslint-disable-next-line no-console
  console.log(`[VA API] Fetching (API Key): ${url}`);
  // eslint-disable-next-line no-console
  console.log(`[VA API] Using API Key: ${apiKey.substring(0, 8)}...`);

  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: apiKey,
      Accept: "application/json",
      ...options.headers,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`[VA API] Response status: ${response.status}`);

  if (response.status === 401 || response.status === 403) {
    const errorBody = await response.text().catch(() => "");
    console.error(`[VA API] Auth error response: ${errorBody}`);
    throw new Error(
      `API access denied (${response.status}). Check your VITE_VA_API_KEY or API access.`,
    );
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    let errorMessage = `API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.message || errorJson.error || errorMessage;
    } catch {
      // Use default message
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// ============================================================================
// USER DATA APIs (OAuth Required)
// ============================================================================

/**
 * Get veteran's military service history
 * Scope: service_history.read
 *
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<Object>} Service history data
 */
export async function getServiceHistory(accessToken) {
  return authenticatedFetch(
    "/services/veteran_verification/v2/service_history",
    accessToken,
  );
}

/**
 * Get veteran's disability claims
 * Scope: claim.read
 *
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<Object>} Claims data
 */
export async function getClaims(accessToken) {
  return authenticatedFetch("/services/claims/v1/claims", accessToken);
}

/**
 * Get veteran's appealable issues (denied decisions that can be appealed)
 * Scope: appealable_issues.read
 *
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<Object>} Appealable issues data
 */
export async function getAppealableIssues(accessToken) {
  return authenticatedFetch(
    "/services/appeals/appealable-issues/v0/appealable-issues",
    accessToken,
  );
}

/**
 * Get veteran's appeals status
 * Scope: appeals_status.read
 *
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<Object>} Appeals status data
 */
export async function getAppealsStatus(accessToken) {
  return authenticatedFetch("/services/appeals/v0/appeals", accessToken);
}

/**
 * Upload a supporting document to a specific claim
 * Scope: claim.write
 *
 * @param {string} accessToken - OAuth access token
 * @param {string} claimId - The claim ID to upload to
 * @param {File} file - The PDF file to upload
 * @param {string} documentType - Document type code (default: L049 for DBQ)
 * @returns {Promise<Object>} Upload result
 */
export async function uploadClaimDocument(
  accessToken,
  claimId,
  file,
  documentType = "L049",
) {
  assertVaApiEnabled();
  if (!accessToken) {
    throw new Error("No access token provided");
  }
  if (!claimId) {
    throw new Error("No claim ID provided");
  }
  if (!file) {
    throw new Error("No file provided");
  }

  const url = `${SANDBOX_BASE}/services/claims/v2/veterans/me/claims/${claimId}/documents`;

  // eslint-disable-next-line no-console
  console.log(`[VA API] Uploading document to claim ${claimId}`);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (response.status === 401) {
    const error = new Error(
      "Authentication expired. Please reconnect your VA account.",
    );
    error.code = "UNAUTHORIZED";
    throw error;
  }

  if (response.status === 403) {
    const error = new Error(
      "Access denied. Missing required scope for document upload.",
    );
    error.code = "FORBIDDEN";
    throw error;
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    let errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.message || errorJson.error || errorMessage;
    } catch {
      // Use default
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// ============================================================================
// OPEN DATA APIs (API Key Required)
// ============================================================================

/**
 * Search for VA facilities near a ZIP code
 *
 * @param {string} zip - ZIP code to search near
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Facilities data
 */
export async function getFacilities(zip = "97217", options = {}) {
  const params = new URLSearchParams({
    zip: zip,
    per_page: options.perPage || "10",
  });

  // Add coordinates for Portland, OR area if using 97217
  if (zip === "97217") {
    params.set("lat", "45.523");
    params.set("long", "-122.676");
  }

  return apiKeyFetch(`/services/va_facilities/v1/facilities?${params}`);
}

/**
 * Search for VA forms
 *
 * @param {string} query - Search query (e.g., "21-526EZ")
 * @returns {Promise<Object>} Forms data
 */
export async function searchForms(query = "21-526EZ") {
  const params = new URLSearchParams({ query });
  // Use dedicated VA Forms API key
  return apiKeyFetch(
    `/services/va_forms/v0/forms?${params}`,
    {},
    FORMS_API_KEY,
  );
}

/**
 * Get benefits reference data (disabilities list)
 *
 * @returns {Promise<Object>} Disabilities reference data
 */
export async function getBenefitsReferenceData() {
  // Use dedicated Benefits Reference Data API key
  return apiKeyFetch(
    "/services/benefits-reference-data/v1/disabilities",
    {},
    BENEFITS_REF_API_KEY,
  );
}

// ============================================================================
// DATA FORMATTERS
// ============================================================================

/**
 * Format service history response for display
 */
export function formatServiceHistory(data) {
  if (!data?.data) return [];

  return data.data.map((episode) => ({
    id: episode.id,
    branch: episode.attributes?.branch_of_service || "Unknown Branch",
    startDate: episode.attributes?.start_date,
    endDate: episode.attributes?.end_date,
    dischargeStatus: episode.attributes?.discharge_status || "Unknown",
    payGrade: episode.attributes?.pay_grade,
    separationReason: episode.attributes?.separation_reason,
    deployments: episode.attributes?.deployments || [],
  }));
}

/**
 * Format claims response for display
 */
export function formatClaims(data) {
  if (!data?.data) return [];

  return data.data.map((claim) => ({
    id: claim.id,
    type: claim.attributes?.claim_type || "Unknown",
    status: claim.attributes?.status,
    phase: claim.attributes?.claim_phase_dates?.phase_change_date,
    phaseNumber: claim.attributes?.claim_phase_dates?.current_phase_back,
    dateFiled: claim.attributes?.claim_date,
    developmentLetter: claim.attributes?.development_letter_sent,
    decisionLetter: claim.attributes?.decision_letter_sent,
    documentsNeeded: claim.attributes?.documents_needed,
    contentions: claim.attributes?.contentions || [],
  }));
}

/**
 * Format appealable issues response for display
 */
export function formatAppealableIssues(data) {
  if (!data?.data) return [];

  return data.data.map((issue) => ({
    id: issue.id,
    type: issue.type,
    description:
      issue.attributes?.description || issue.attributes?.ratingIssueSubjectText,
    decisionDate:
      issue.attributes?.approxDecisionDate || issue.attributes?.decisionDate,
    ratingPercent: issue.attributes?.ratingIssuePercentNumber,
    diagnosticCode: issue.attributes?.ratingIssueDiagnosticCode,
  }));
}

/**
 * Format appeals status response for display
 */
export function formatAppealsStatus(data) {
  if (!data?.data) return [];

  return data.data.map((appeal) => ({
    id: appeal.id,
    type: appeal.type,
    status: appeal.attributes?.status?.type,
    statusDetails: appeal.attributes?.status?.details,
    updated: appeal.attributes?.updated,
    active: appeal.attributes?.active,
    programArea: appeal.attributes?.programArea,
    description: appeal.attributes?.description,
    events: appeal.attributes?.events || [],
    issues: appeal.attributes?.issues || [],
  }));
}

/**
 * Format facilities response for display
 */
export function formatFacilities(data) {
  if (!data?.data) return [];

  return data.data.map((facility) => ({
    id: facility.id,
    name: facility.attributes?.name,
    type: facility.attributes?.facility_type,
    classification: facility.attributes?.classification,
    address: facility.attributes?.address?.physical,
    phone: facility.attributes?.phone?.main,
    hours: facility.attributes?.hours,
    services: facility.attributes?.services?.health || [],
    website: facility.attributes?.website,
    distance: facility.attributes?.distance,
  }));
}

/**
 * Format forms response for display
 */
export function formatForms(data) {
  if (!data?.data) return [];

  return data.data.map((form) => ({
    id: form.id,
    name: form.attributes?.form_name,
    title: form.attributes?.title,
    url: form.attributes?.url,
    lastRevision: form.attributes?.last_revision_on,
    pages: form.attributes?.pages,
    sha256: form.attributes?.sha256,
    validPdf: form.attributes?.valid_pdf,
    formUsage: form.attributes?.form_usage,
    formToolIntro: form.attributes?.form_tool_intro,
    formToolUrl: form.attributes?.form_tool_url,
    benefitCategories: form.attributes?.benefit_categories || [],
  }));
}

/**
 * Format disabilities reference data for display
 */
export function formatDisabilities(data) {
  if (!data?.data) return [];

  // Handle both array and items property
  const items = Array.isArray(data.data) ? data.data : data.data.items || [];

  return items.slice(0, 50).map((disability) => ({
    id: disability.id || disability.name,
    name: disability.name || disability.attributes?.name,
    description: disability.description || disability.attributes?.description,
  }));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // User Data (OAuth)
  getServiceHistory,
  getClaims,
  getAppealableIssues,
  getAppealsStatus,
  uploadClaimDocument,

  // Open Data (API Key)
  getFacilities,
  searchForms,
  getBenefitsReferenceData,

  // Formatters
  formatServiceHistory,
  formatClaims,
  formatAppealableIssues,
  formatAppealsStatus,
  formatFacilities,
  formatForms,
  formatDisabilities,
};
