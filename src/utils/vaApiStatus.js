/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * VA API Status Monitor - "The Lighthouse Keeper"
 *
 * Monitors VA Lighthouse API status page to inform users when
 * VA APIs are experiencing issues (not a Vet-Rate.org problem).
 *
 * Status Page: https://valighthouse.statuspage.io/
 * JSON API: https://valighthouse.statuspage.io/api/v2/summary.json
 */

// StatusPage.io API endpoints
const STATUS_PAGE_URL = "https://valighthouse.statuspage.io";
const STATUS_API_URL = "https://valighthouse.statuspage.io/api/v2/summary.json";
const INCIDENTS_API_URL =
  "https://valighthouse.statuspage.io/api/v2/incidents/unresolved.json";
const SCHEDULED_API_URL =
  "https://valighthouse.statuspage.io/api/v2/scheduled-maintenances/upcoming.json";

// Allowed URL domains for external links from status API
const TRUSTED_URL_DOMAINS = ["statuspage.io", "va.gov", "stspg.io"];

/**
 * Sanitize external URL - only allow https from trusted domains
 * Returns sanitized URL or fallback STATUS_PAGE_URL
 */
export function sanitizeStatusUrl(url) {
  if (!url || typeof url !== "string") return STATUS_PAGE_URL;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return STATUS_PAGE_URL;
    if (!TRUSTED_URL_DOMAINS.some((d) => parsed.hostname.endsWith(d)))
      return STATUS_PAGE_URL;
    return url;
  } catch {
    return STATUS_PAGE_URL;
  }
}

// Cache duration (5 minutes)
const CACHE_DURATION_MS = 5 * 60 * 1000;

// Local cache
let statusCache = null;
let lastFetchTime = null;

/**
 * Map of VA API names to StatusPage component names
 * These are the APIs that Vet-Rate.org uses
 */
export const VA_API_MAPPING = {
  // OAuth-protected APIs
  claims: ["Benefits Claims API - v1", "Benefits Claims API - v2"],
  service_history: ["Veteran Service History and Eligibility API"],
  appeals: [
    "Appeals Status API",
    "Appealable Issues API",
    "Decision Reviews API",
    "Legacy Appeals API",
  ],
  direct_deposit: ["Direct Deposit Management API"],

  // Open Data APIs (API Key)
  facilities: ["VA Facilities API"],
  forms: ["VA Forms API"],
  benefits_ref: ["Benefits Reference Data API"],
  benefits_intake: ["Benefits Intake API"],
  benefits_documents: ["Benefits Documents API"],

  // Health APIs (FHIR)
  health: [
    "Clinical Health API (FHIR)",
    "Patient Health API (FHIR)",
    "Health Care Costs and Coverage API",
  ],

  // Other APIs
  address_validation: ["Address Validation API"],
  provider_directory: ["Provider Directory API"],
  education: ["Education Benefits API"],
  loan: ["Loan Guaranty API", "Loan Review API"],
};

/**
 * Status levels in order of severity
 */
export const STATUS_LEVELS = {
  operational: { level: 0, label: "Operational", color: "green", icon: "✅" },
  degraded_performance: {
    level: 1,
    label: "Degraded Performance",
    color: "yellow",
    icon: "⚠️",
  },
  partial_outage: {
    level: 2,
    label: "Partial Outage",
    color: "orange",
    icon: "🔶",
  },
  major_outage: { level: 3, label: "Major Outage", color: "red", icon: "🔴" },
  under_maintenance: {
    level: 4,
    label: "Under Maintenance",
    color: "blue",
    icon: "🔧",
  },
};

/**
 * Fetch VA API status from StatusPage.io
 * Uses caching to avoid excessive API calls
 *
 * @returns {Promise<Object>} Status data
 */
export async function fetchVaApiStatus() {
  // Return cached data if fresh
  if (
    statusCache &&
    lastFetchTime &&
    Date.now() - lastFetchTime < CACHE_DURATION_MS
  ) {
    return statusCache;
  }

  try {
    // Fetch summary and incidents in parallel
    const [summaryRes, incidentsRes, scheduledRes] = await Promise.all([
      fetch(STATUS_API_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
        // No-cache to get fresh data when we do fetch
        cache: "no-store",
      }),
      fetch(INCIDENTS_API_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      }),
      fetch(SCHEDULED_API_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      }),
    ]);

    if (!summaryRes.ok) {
      throw new Error(`Status API returned ${summaryRes.status}`);
    }

    const summary = await summaryRes.json();
    const incidents = incidentsRes.ok
      ? await incidentsRes.json()
      : { incidents: [] };
    const scheduled = scheduledRes.ok
      ? await scheduledRes.json()
      : { scheduled_maintenances: [] };

    // Process the data
    const processedStatus = processStatusData(summary, incidents, scheduled);

    // Cache the result
    statusCache = processedStatus;
    lastFetchTime = Date.now();

    return processedStatus;
  } catch (error) {
    console.error("[VA Status] Failed to fetch status:", error);

    // Return cached data if available, even if stale
    if (statusCache) {
      return { ...statusCache, stale: true, error: error.message };
    }

    // Return error state
    return {
      available: false,
      error: error.message,
      lastChecked: new Date().toISOString(),
      overallStatus: "unknown",
      components: {},
      activeIncidents: [],
      scheduledMaintenance: [],
    };
  }
}

/**
 * Process raw StatusPage data into a more usable format
 */
function processStatusData(summary, incidents, scheduled) {
  const { page, components = [], status } = summary;

  // Build component status map
  const componentStatus = {};
  for (const component of components) {
    // Handle sub-components (like Production/Sandbox environments)
    if (component.components && component.components.length > 0) {
      // This is a group, process children
      for (const childId of component.components) {
        const child = components.find((c) => c.id === childId);
        if (child) {
          componentStatus[child.name] = {
            status: normalizeStatus(child.status),
            description: child.description,
            updatedAt: child.updated_at,
            group: component.name,
          };
        }
      }
    } else if (!component.group_id) {
      // Top-level component (not in a group)
      componentStatus[component.name] = {
        status: normalizeStatus(component.status),
        description: component.description,
        updatedAt: component.updated_at,
        group: null,
      };
    } else {
      // Component in a group
      componentStatus[component.name] = {
        status: normalizeStatus(component.status),
        description: component.description,
        updatedAt: component.updated_at,
        group:
          components.find((c) => c.id === component.group_id)?.name || null,
      };
    }
  }

  // Process active incidents
  const activeIncidents = (incidents.incidents || []).map((incident) => ({
    id: incident.id,
    name: incident.name,
    status: incident.status,
    impact: incident.impact,
    createdAt: incident.created_at,
    updatedAt: incident.updated_at,
    shortlink: sanitizeStatusUrl(incident.shortlink),
    affectedComponents: (incident.components || []).map((c) => c.name),
    updates: (incident.incident_updates || []).map((update) => ({
      status: update.status,
      body: update.body,
      createdAt: update.created_at,
    })),
  }));

  // Process scheduled maintenance
  const scheduledMaintenance = (scheduled.scheduled_maintenances || []).map(
    (maint) => ({
      id: maint.id,
      name: maint.name,
      status: maint.status,
      impact: maint.impact,
      scheduledFor: maint.scheduled_for,
      scheduledUntil: maint.scheduled_until,
      shortlink: sanitizeStatusUrl(maint.shortlink),
      affectedComponents: (maint.components || []).map((c) => c.name),
      updates: (maint.incident_updates || []).map((update) => ({
        status: update.status,
        body: update.body,
        createdAt: update.created_at,
      })),
    }),
  );

  return {
    available: true,
    lastChecked: new Date().toISOString(),
    overallStatus: normalizeStatus(status?.indicator || "none"),
    overallDescription: status?.description || "All Systems Operational",
    pageUrl: sanitizeStatusUrl(page?.url) || STATUS_PAGE_URL,
    components: componentStatus,
    activeIncidents,
    scheduledMaintenance,
    stale: false,
    error: null,
  };
}

/**
 * Normalize status strings to consistent values
 */
function normalizeStatus(status) {
  const statusMap = {
    none: "operational",
    operational: "operational",
    degraded_performance: "degraded_performance",
    partial_outage: "partial_outage",
    major_outage: "major_outage",
    under_maintenance: "under_maintenance",
    maintenance: "under_maintenance",
    minor: "degraded_performance",
    major: "major_outage",
    critical: "major_outage",
  };
  return statusMap[status?.toLowerCase()] || "unknown";
}

/**
 * Get status for a specific Vet-Rate feature's required APIs
 *
 * @param {string} feature - Feature name (e.g., 'claims', 'facilities')
 * @param {Object} statusData - Status data from fetchVaApiStatus
 * @returns {Object} Status for the feature
 */
export function getFeatureStatus(feature, statusData) {
  if (!statusData?.available || !statusData?.components) {
    return {
      status: "unknown",
      statusInfo: { level: -1, label: "Unknown", color: "gray", icon: "❓" },
      affectedApis: [],
      incidents: [],
      maintenance: [],
    };
  }

  const apiNames = VA_API_MAPPING[feature] || [];
  if (apiNames.length === 0) {
    return {
      status: "unknown",
      statusInfo: { level: -1, label: "Unknown", color: "gray", icon: "❓" },
      affectedApis: [],
      incidents: [],
      maintenance: [],
    };
  }

  // Find worst status among required APIs
  let worstStatus = "operational";
  let worstLevel = 0;
  const affectedApis = [];

  for (const apiName of apiNames) {
    const componentStatus = statusData.components[apiName];
    if (componentStatus) {
      const statusInfo =
        STATUS_LEVELS[componentStatus.status] || STATUS_LEVELS.operational;
      if (statusInfo.level > worstLevel) {
        worstLevel = statusInfo.level;
        worstStatus = componentStatus.status;
      }
      if (componentStatus.status !== "operational") {
        affectedApis.push({
          name: apiName,
          status: componentStatus.status,
          statusInfo: STATUS_LEVELS[componentStatus.status],
        });
      }
    }
  }

  // Find related incidents
  const relatedIncidents = statusData.activeIncidents.filter((incident) =>
    incident.affectedComponents.some((comp) => apiNames.includes(comp)),
  );

  // Find related maintenance
  const relatedMaintenance = statusData.scheduledMaintenance.filter((maint) =>
    maint.affectedComponents.some((comp) => apiNames.includes(comp)),
  );

  return {
    status: worstStatus,
    statusInfo: STATUS_LEVELS[worstStatus] || STATUS_LEVELS.operational,
    affectedApis,
    incidents: relatedIncidents,
    maintenance: relatedMaintenance,
  };
}

/**
 * Check if any VA APIs are experiencing issues
 *
 * @param {Object} statusData - Status data from fetchVaApiStatus
 * @returns {boolean} True if any issues detected
 */
export function hasAnyIssues(statusData) {
  if (!statusData?.available) return false;

  return (
    statusData.overallStatus !== "operational" ||
    statusData.activeIncidents.length > 0 ||
    statusData.scheduledMaintenance.some((m) => m.status === "in_progress")
  );
}

/**
 * Get a summary of current issues for display
 *
 * @param {Object} statusData - Status data from fetchVaApiStatus
 * @returns {Object} Summary for display
 */
export function getStatusSummary(statusData) {
  if (!statusData?.available) {
    return {
      hasIssues: false,
      title: "Unable to check VA API status",
      description: "Could not connect to VA status page",
      severity: "unknown",
      icon: "❓",
    };
  }

  const activeIssues = statusData.activeIncidents.length;
  const activeMaintenance = statusData.scheduledMaintenance.filter(
    (m) => m.status === "in_progress",
  ).length;
  const upcomingMaintenance = statusData.scheduledMaintenance.filter(
    (m) => m.status === "scheduled",
  ).length;

  if (statusData.overallStatus === "major_outage") {
    return {
      hasIssues: true,
      title: "VA Systems Experiencing Major Outage",
      description: `${activeIssues} active incident${activeIssues !== 1 ? "s" : ""} reported`,
      severity: "major_outage",
      icon: "🔴",
      url: STATUS_PAGE_URL,
    };
  }

  if (activeMaintenance > 0) {
    return {
      hasIssues: true,
      title: "VA Systems Under Maintenance",
      description: "Some VA APIs may be temporarily unavailable",
      severity: "under_maintenance",
      icon: "🔧",
      url: STATUS_PAGE_URL,
    };
  }

  if (
    statusData.overallStatus === "partial_outage" ||
    statusData.overallStatus === "degraded_performance"
  ) {
    return {
      hasIssues: true,
      title: "VA Systems Experiencing Issues",
      description: `${activeIssues} active incident${activeIssues !== 1 ? "s" : ""} affecting some services`,
      severity: statusData.overallStatus,
      icon: statusData.overallStatus === "partial_outage" ? "🔶" : "⚠️",
      url: STATUS_PAGE_URL,
    };
  }

  if (upcomingMaintenance > 0) {
    const nextMaint = statusData.scheduledMaintenance[0];
    const maintTime = new Date(nextMaint.scheduledFor);
    return {
      hasIssues: false,
      hasUpcoming: true,
      title: "Scheduled Maintenance Coming",
      description: `${nextMaint.name} - ${maintTime.toLocaleDateString()} at ${maintTime.toLocaleTimeString()}`,
      severity: "info",
      icon: "📅",
      url: STATUS_PAGE_URL,
    };
  }

  return {
    hasIssues: false,
    title: "All VA Systems Operational",
    description: "VA APIs are running normally",
    severity: "operational",
    icon: "✅",
  };
}

/**
 * Force refresh the status cache
 */
export function clearStatusCache() {
  statusCache = null;
  lastFetchTime = null;
}

/**
 * Get the StatusPage URL for users to check
 */
export function getStatusPageUrl() {
  return STATUS_PAGE_URL;
}

export default {
  fetchVaApiStatus,
  getFeatureStatus,
  hasAnyIssues,
  getStatusSummary,
  clearStatusCache,
  getStatusPageUrl,
  sanitizeStatusUrl,
  VA_API_MAPPING,
  STATUS_LEVELS,
};
