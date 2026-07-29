/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * VA Benefits Reference Data Hook
 *
 * Custom hook for fetching and caching benefits reference data from VA.gov.
 * Uses API Key authentication (not OAuth).
 *
 * This data powers:
 * - Decision Decoder: Explains claim phases and typical wait times
 * - Claims Status: Translates status codes to human-readable text
 * - Education Center: Provides official VA definitions
 *
 * @see https://developer.va.gov/explore/benefits/docs/benefits_reference_data
 */

import { useState, useCallback } from "react";
import { VA_BENEFITS_REF_API_KEY } from "../config/vaAuth";
import { startApiLog, API_CATEGORIES } from "../utils/vaSyncLogger";

// Cache duration (1 hour - this data doesn't change often)
const CACHE_DURATION = 60 * 60 * 1000;

// Local cache store
const cache = {
  disabilities: null,
  disabilities_timestamp: 0,
  contention_types: null,
  contention_types_timestamp: 0,
  intake_sites: null,
  intake_sites_timestamp: 0,
  countries: null,
  countries_timestamp: 0,
  states: null,
  states_timestamp: 0,
  service_branches: null,
  service_branches_timestamp: 0,
};

// Base URL for benefits reference API
const isDev = import.meta.env.DEV;
const API_BASE = isDev ? "/va-api" : "https://sandbox-api.va.gov";

/**
 * Generic fetch with API key authentication
 */
async function fetchBenefitsRef(endpoint, apiKey) {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      apikey: apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Benefits Ref API error: ${response.status} - ${errorBody}`,
    );
  }

  return response.json();
}

/**
 * Claim status phases - manually curated for Decision Decoder
 * These explain what each phase means to veterans
 */
export const CLAIM_PHASES = {
  CLAIM_RECEIVED: {
    phase: 1,
    name: "Claim Received",
    shortDesc: "The VA has received your claim",
    longDesc:
      "Your claim has been received and is waiting to be assigned to a claims processor. This is the starting point for all claims.",
    avgDays: "1-7 days",
    whatNext: "Wait for the claim to be assigned. No action needed from you.",
    tips: [
      "You can track your claim status on VA.gov",
      "Gather any additional evidence while you wait",
    ],
  },
  INITIAL_REVIEW: {
    phase: 2,
    name: "Initial Review",
    shortDesc:
      "A Veterans Service Representative (VSR) is reviewing your claim",
    longDesc:
      "A claims processor is reviewing your submitted evidence and determining what additional information may be needed.",
    avgDays: "7-30 days",
    whatNext: "Check if you've received any requests for additional evidence.",
    tips: [
      "Respond quickly to any requests for more information",
      "This is a good time to submit buddy statements if you haven't",
    ],
  },
  EVIDENCE_GATHERING: {
    phase: 3,
    name: "Evidence Gathering, Review, and Decision",
    shortDesc: "The VA is gathering and reviewing evidence",
    longDesc:
      "The VA is collecting medical records, scheduling C&P exams, and reviewing all evidence. This is typically the longest phase.",
    avgDays: "30-90+ days",
    whatNext:
      "Attend any scheduled C&P exams. Submit any additional evidence promptly.",
    tips: [
      "Attend ALL scheduled C&P exams - missing one can delay your claim significantly",
      "Be honest and thorough during exams - describe your worst days",
      "You can submit additional evidence during this phase",
    ],
  },
  PREPARATION_FOR_DECISION: {
    phase: 4,
    name: "Preparation for Decision",
    shortDesc:
      "All evidence has been collected and a decision is being prepared",
    longDesc:
      "A Rating Veterans Service Representative (RVSR) is reviewing all evidence and preparing the rating decision.",
    avgDays: "7-30 days",
    whatNext:
      "Wait for the decision. You can still submit evidence, but it may delay the process.",
    tips: [
      "This is a good sign - you're near the end",
      "New evidence at this stage may restart the review process",
    ],
  },
  PENDING_DECISION_APPROVAL: {
    phase: 5,
    name: "Pending Decision Approval",
    shortDesc: "Your rating decision is being reviewed for approval",
    longDesc:
      "The decision has been made and is awaiting final quality review and approval before being sent to you.",
    avgDays: "3-14 days",
    whatNext: "Wait for your decision letter to arrive.",
    tips: [
      "Your decision is almost ready",
      "Check your mail and eBenefits regularly",
    ],
  },
  PREPARATION_FOR_NOTIFICATION: {
    phase: 6,
    name: "Preparation for Notification",
    shortDesc: "Your decision letter is being prepared",
    longDesc:
      "The decision has been approved and your notification letter is being generated and prepared for mailing.",
    avgDays: "1-7 days",
    whatNext: "Watch for your decision letter in the mail.",
    tips: [
      "The decision is final - review your options when you receive it",
      "Decision letters are also available on VA.gov",
    ],
  },
  COMPLETE: {
    phase: 7,
    name: "Complete",
    shortDesc: "Your claim has been decided",
    longDesc:
      "A decision has been made on your claim. Review your decision letter carefully for the effective date, rating, and appeal rights.",
    avgDays: "N/A",
    whatNext:
      "Review your decision letter. If you disagree, you have appeal options.",
    tips: [
      "Check your effective date - this determines back pay",
      "You have 1 year to appeal if you disagree",
      "Consider consulting with a VSO about your options",
    ],
  },
  ERRORED: {
    phase: 0,
    name: "Error",
    shortDesc: "There was an error processing your claim",
    longDesc:
      "Something unexpected happened with your claim. This is rare and usually requires VA staff to intervene.",
    avgDays: "Varies",
    whatNext: "Contact the VA or your VSO to understand what happened.",
    tips: [
      "Don't panic - errors can usually be resolved",
      "Call the VA hotline: 1-800-827-1000",
    ],
  },
};

/**
 * Shared cached-fetch logic used by each of the hook's fetch* methods.
 * `setError` is optional - only fetchDisabilities surfaces errors to state.
 */
async function runCachedBenefitsFetch({
  cacheKey,
  timestampKey,
  endpoint,
  apiKey,
  isConfigured,
  setState,
  setLoading,
  setError,
  errorLabel,
}) {
  if (!isConfigured) {
    if (setError) {
      setError(
        "VA Benefits Reference API is not configured. Add VITE_VA_BENEFITS_REF_API_KEY to .env",
      );
    }
    return { success: false, error: "API not configured" };
  }

  const now = Date.now();
  if (cache[cacheKey] && now - cache[timestampKey] < CACHE_DURATION) {
    setState(cache[cacheKey]);
    return { success: true, data: cache[cacheKey], cached: true };
  }

  setLoading(true);
  if (setError) setError(null);

  const { complete, fail } = startApiLog(
    API_CATEGORIES.BENEFITS_REF,
    endpoint,
    "API Key",
  );

  try {
    const data = await fetchBenefitsRef(endpoint, apiKey);

    cache[cacheKey] = data.items || data;
    cache[timestampKey] = now;

    setState(cache[cacheKey]);
    complete(data, cache[cacheKey].length);

    return { success: true, data: cache[cacheKey] };
  } catch (err) {
    console.error(`[Benefits Ref] Error fetching ${errorLabel}:`, err);
    if (setError) setError(err.message);
    fail(err.message);
    return { success: false, error: err.message };
  } finally {
    setLoading(false);
  }
}

/**
 * Get claim phase info - no hook state involved, safe to hoist out of the hook.
 */
function getClaimPhaseInfo(status) {
  const upperStatus = status?.toUpperCase().replace(/ /g, "_");
  return CLAIM_PHASES[upperStatus] || CLAIM_PHASES["CLAIM_RECEIVED"];
}

/**
 * Get all claim phases for display - no hook state involved, safe to hoist out of the hook.
 */
function getAllClaimPhases() {
  return Object.entries(CLAIM_PHASES)
    .filter(([key]) => key !== "ERRORED")
    .sort((a, b) => a[1].phase - b[1].phase)
    .map(([key, value]) => ({ key, ...value }));
}

/**
 * Custom hook for VA Benefits Reference Data
 */
export function useVaBenefitsRef() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [disabilities, setDisabilities] = useState([]);
  const [contentionTypes, setContentionTypes] = useState([]);
  const [serviceBranches, setServiceBranches] = useState([]);

  const apiKey = VA_BENEFITS_REF_API_KEY;
  const isConfigured = Boolean(
    apiKey && apiKey !== "your_va_benefits_ref_api_key_here",
  );

  /**
   * Fetch disabilities list with caching
   */
  const fetchDisabilities = useCallback(async () => {
    return runCachedBenefitsFetch({
      cacheKey: "disabilities",
      timestampKey: "disabilities_timestamp",
      endpoint: "/services/benefits-reference-data/v1/disabilities",
      apiKey,
      isConfigured,
      setState: setDisabilities,
      setLoading,
      setError,
      errorLabel: "disabilities",
    });
  }, [apiKey, isConfigured]);

  /**
   * Fetch contention types with caching
   */
  const fetchContentionTypes = useCallback(async () => {
    return runCachedBenefitsFetch({
      cacheKey: "contention_types",
      timestampKey: "contention_types_timestamp",
      endpoint: "/services/benefits-reference-data/v1/contention-types",
      apiKey,
      isConfigured,
      setState: setContentionTypes,
      setLoading,
      errorLabel: "contention types",
    });
  }, [apiKey, isConfigured]);

  /**
   * Fetch service branches with caching
   */
  const fetchServiceBranches = useCallback(async () => {
    return runCachedBenefitsFetch({
      cacheKey: "service_branches",
      timestampKey: "service_branches_timestamp",
      endpoint: "/services/benefits-reference-data/v1/service-branches",
      apiKey,
      isConfigured,
      setState: setServiceBranches,
      setLoading,
      errorLabel: "service branches",
    });
  }, [apiKey, isConfigured]);

  /**
   * Search disabilities by name
   */
  const searchDisabilities = useCallback(
    (query) => {
      if (!query || query.length < 2) return [];

      const lowerQuery = query.toLowerCase();
      return disabilities
        .filter(
          (d) =>
            d.name?.toLowerCase().includes(lowerQuery) ||
            d.description?.toLowerCase().includes(lowerQuery),
        )
        .slice(0, 20);
    },
    [disabilities],
  );

  return {
    // State
    loading,
    error,
    disabilities,
    contentionTypes,
    serviceBranches,
    isConfigured,

    // Fetch methods
    fetchDisabilities,
    fetchContentionTypes,
    fetchServiceBranches,

    // Utility methods
    searchDisabilities,
    getClaimPhaseInfo,
    getAllClaimPhases,

    // Static data
    CLAIM_PHASES,
  };
}

export default useVaBenefitsRef;
