/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
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
    if (!isConfigured) {
      setError(
        "VA Benefits Reference API is not configured. Add VITE_VA_BENEFITS_REF_API_KEY to .env",
      );
      return { success: false, error: "API not configured" };
    }

    // Check cache
    const now = Date.now();
    if (
      cache.disabilities &&
      now - cache.disabilities_timestamp < CACHE_DURATION
    ) {
      setDisabilities(cache.disabilities);
      return { success: true, data: cache.disabilities, cached: true };
    }

    setLoading(true);
    setError(null);

    const { complete, fail } = startApiLog(
      API_CATEGORIES.BENEFITS_REF,
      "/services/benefits-reference-data/v1/disabilities",
      "API Key",
    );

    try {
      const data = await fetchBenefitsRef(
        "/services/benefits-reference-data/v1/disabilities",
        apiKey,
      );

      // Update cache
      cache.disabilities = data.items || data;
      cache.disabilities_timestamp = now;

      setDisabilities(cache.disabilities);
      complete(data, cache.disabilities.length);

      return { success: true, data: cache.disabilities };
    } catch (err) {
      console.error("[Benefits Ref] Error fetching disabilities:", err);
      setError(err.message);
      fail(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [apiKey, isConfigured]);

  /**
   * Fetch contention types with caching
   */
  const fetchContentionTypes = useCallback(async () => {
    if (!isConfigured) {
      return { success: false, error: "API not configured" };
    }

    const now = Date.now();
    if (
      cache.contention_types &&
      now - cache.contention_types_timestamp < CACHE_DURATION
    ) {
      setContentionTypes(cache.contention_types);
      return { success: true, data: cache.contention_types, cached: true };
    }

    setLoading(true);

    const { complete, fail } = startApiLog(
      API_CATEGORIES.BENEFITS_REF,
      "/services/benefits-reference-data/v1/contention-types",
      "API Key",
    );

    try {
      const data = await fetchBenefitsRef(
        "/services/benefits-reference-data/v1/contention-types",
        apiKey,
      );

      cache.contention_types = data.items || data;
      cache.contention_types_timestamp = now;

      setContentionTypes(cache.contention_types);
      complete(data, cache.contention_types.length);

      return { success: true, data: cache.contention_types };
    } catch (err) {
      console.error("[Benefits Ref] Error fetching contention types:", err);
      fail(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [apiKey, isConfigured]);

  /**
   * Fetch service branches with caching
   */
  const fetchServiceBranches = useCallback(async () => {
    if (!isConfigured) {
      return { success: false, error: "API not configured" };
    }

    const now = Date.now();
    if (
      cache.service_branches &&
      now - cache.service_branches_timestamp < CACHE_DURATION
    ) {
      setServiceBranches(cache.service_branches);
      return { success: true, data: cache.service_branches, cached: true };
    }

    setLoading(true);

    const { complete, fail } = startApiLog(
      API_CATEGORIES.BENEFITS_REF,
      "/services/benefits-reference-data/v1/service-branches",
      "API Key",
    );

    try {
      const data = await fetchBenefitsRef(
        "/services/benefits-reference-data/v1/service-branches",
        apiKey,
      );

      cache.service_branches = data.items || data;
      cache.service_branches_timestamp = now;

      setServiceBranches(cache.service_branches);
      complete(data, cache.service_branches.length);

      return { success: true, data: cache.service_branches };
    } catch (err) {
      console.error("[Benefits Ref] Error fetching service branches:", err);
      fail(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
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

  /**
   * Get claim phase info
   */
  const getClaimPhaseInfo = useCallback((status) => {
    const upperStatus = status?.toUpperCase().replace(/ /g, "_");
    return CLAIM_PHASES[upperStatus] || CLAIM_PHASES["CLAIM_RECEIVED"];
  }, []);

  /**
   * Get all claim phases for display
   */
  const getAllClaimPhases = useCallback(() => {
    return Object.entries(CLAIM_PHASES)
      .filter(([key]) => key !== "ERRORED")
      .sort((a, b) => a[1].phase - b[1].phase)
      .map(([key, value]) => ({ key, ...value }));
  }, []);

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
