/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Claim Progress Hook - Enhanced Mission Readiness System
 * Tracks completion across all major tools for gamified progress
 * Includes Ready-to-File validation and manual workflow support
 */

import { useState, useEffect, useCallback } from "react";

// Manual progress storage key for user-confirmed completions
const MANUAL_PROGRESS_KEY = "vet_rate_manual_progress";

// Phase definitions for organized milestone tracking
export const PHASES = {
  PREPARATION: { id: "preparation", title: "Phase 1: Preparation", order: 1 },
  DISCOVERY: { id: "discovery", title: "Phase 2: Discovery", order: 2 },
  EVIDENCE: { id: "evidence", title: "Phase 3: Evidence Building", order: 3 },
  DOCUMENTATION: {
    id: "documentation",
    title: "Phase 4: Documentation",
    order: 4,
  },
  FILING: { id: "filing", title: "Phase 5: Filing", order: 5 },
};

// Define all completion milestones with enhanced detection
const MILESTONES = [
  // ========== PHASE 1: PREPARATION ==========
  {
    id: "itf_filed",
    title: "Intent to File (ITF) Submitted",
    description: "Protect your effective date with VA Form 21-0966",
    storageKey: "vet_rate_itf_status",
    alternateKeys: ["itf_filed", "itf_date", "vet_rate_itf_filed"],
    checkCompleted: (data, altData) => {
      // Check primary key
      if (data === "true" || data === "filed") return true;
      try {
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.filed || parsed.status === "filed" || parsed.date)
            return true;
        }
      } catch {
        /* ignored */
      }
      // Check alternate keys
      if (altData?.some((d) => d === "true" || d)) return true;
      return false;
    },
    icon: "🛡️",
    weight: 10,
    phase: "preparation",
    critical: true, // Required for Ready-to-File
    manualAllowed: true,
  },
  {
    id: "profile",
    title: "Veteran Profile Created",
    description: "Basic service and contact information entered",
    storageKey: "vet_rate_veteran_profile",
    alternateKeys: ["veteran_profile", "user_profile"],
    checkCompleted: (data, altData) => {
      if (!data && !altData?.length) return false;
      try {
        const profile = JSON.parse(data || altData?.[0]);
        return !!(profile?.firstName && profile?.lastName && profile?.dob);
      } catch {
        return false;
      }
    },
    icon: "👤",
    weight: 5,
    phase: "preparation",
    critical: true,
    manualAllowed: true,
  },

  // ========== PHASE 2: DISCOVERY ==========
  {
    id: "diagnosis",
    title: "Diagnosis Found",
    description:
      "Medical conditions identified via Blue Button or manual entry",
    storageKey: "vet_rate_saved_claims",
    alternateKeys: ["diagnoses", "conditions", "vet_rate_conditions"],
    checkCompleted: (data, altData) => {
      if (!data && !altData?.length) return false;
      try {
        const claims = JSON.parse(data || altData?.[0]);
        return Array.isArray(claims)
          ? claims.length > 0
          : Object.keys(claims || {}).length > 0;
      } catch {
        return false;
      }
    },
    icon: "🏥",
    weight: 12,
    phase: "discovery",
    critical: true,
    manualAllowed: true,
  },
  {
    id: "secondary",
    title: "Secondary Conditions Explored",
    description: "Secondary Scout used to find connected conditions",
    storageKey: "secondary_conditions_found",
    alternateKeys: ["vet_rate_secondary", "secondary_analysis_complete"],
    checkCompleted: (data, altData) => {
      if (data === "true") return true;
      if (altData?.some((d) => d === "true" || d)) return true;
      try {
        const parsed = JSON.parse(data);
        return !!(parsed?.completed || parsed?.conditions?.length > 0);
      } catch {
        return false;
      }
    },
    icon: "🔍",
    weight: 8,
    phase: "discovery",
    critical: false,
    manualAllowed: true,
  },
  {
    id: "medical_records",
    title: "Medical Records Reviewed",
    description:
      "Service treatment records and private medical records gathered",
    storageKey: "vet_rate_medical_records_status",
    alternateKeys: ["medical_records_reviewed", "str_reviewed", "pmr_reviewed"],
    checkCompleted: (data, altData) => {
      if (data === "true" || data === "reviewed") return true;
      if (altData?.some((d) => d === "true")) return true;
      try {
        const parsed = JSON.parse(data);
        return !!(parsed?.reviewed || parsed?.str || parsed?.pmr);
      } catch {
        return false;
      }
    },
    icon: "📁",
    weight: 10,
    phase: "discovery",
    critical: true,
    manualAllowed: true,
  },

  // ========== PHASE 3: EVIDENCE BUILDING ==========
  {
    id: "service_connection",
    title: "Service Event Documented",
    description:
      "In-service event/injury identified via C-File analysis or records",
    storageKey: "cfile_analysis_completed",
    alternateKeys: ["service_connection_identified", "vet_rate_service_events"],
    checkCompleted: (data, altData) => {
      if (data === "true") return true;
      if (altData?.some((d) => d === "true" || d)) return true;
      try {
        const parsed = JSON.parse(data);
        return !!(parsed?.completed || parsed?.events?.length > 0);
      } catch {
        return false;
      }
    },
    icon: "📋",
    weight: 12,
    phase: "evidence",
    critical: true,
    manualAllowed: true,
  },
  {
    id: "symptoms",
    title: "Symptoms Documented",
    description: "Daily symptoms logged in Symptom Logger",
    storageKey: "symptom_logs",
    alternateKeys: ["vet_rate_symptoms", "symptom_entries"],
    checkCompleted: (data, altData) => {
      if (!data && !altData?.length) return false;
      try {
        const logs = JSON.parse(data || altData?.[0]);
        if (Array.isArray(logs)) return logs.length > 0;
        return Object.keys(logs || {}).length > 0;
      } catch {
        return false;
      }
    },
    icon: "📝",
    weight: 8,
    phase: "evidence",
    critical: false,
    manualAllowed: true,
  },
  {
    id: "buddy_statements",
    title: "Buddy/Lay Statements Gathered",
    description:
      "Supporting statements from family, friends, or fellow service members",
    storageKey: "vet_rate_buddy_statements",
    alternateKeys: ["buddy_statements", "lay_statements", "witness_statements"],
    checkCompleted: (data, altData) => {
      if (data === "true") return true;
      if (altData?.some((d) => d === "true")) return true;
      try {
        const parsed = JSON.parse(data || altData?.[0]);
        if (Array.isArray(parsed)) return parsed.length > 0;
        return !!(
          parsed?.count > 0 ||
          parsed?.statements?.length > 0 ||
          parsed?.gathered
        );
      } catch {
        return false;
      }
    },
    icon: "🤝",
    weight: 8,
    phase: "evidence",
    critical: false,
    manualAllowed: true,
  },
  {
    id: "nexus",
    title: "Nexus Logic Generated",
    description: "Medical reasoning documented connecting condition to service",
    storageKey: "nexus_letters",
    alternateKeys: ["vet_rate_nexus", "nexus_builder_complete"],
    checkCompleted: (data, altData) => {
      if (!data && !altData?.length) return false;
      try {
        const letters = JSON.parse(data || altData?.[0]);
        if (Array.isArray(letters)) return letters.length > 0;
        return Object.keys(letters || {}).length > 0;
      } catch {
        return false;
      }
    },
    icon: "🔗",
    weight: 12,
    phase: "evidence",
    critical: true,
    manualAllowed: true,
  },

  // ========== PHASE 4: DOCUMENTATION ==========
  {
    id: "statement",
    title: "Personal Statement Written",
    description: "Statement generated using AI Assistant or manually composed",
    storageKey: "vet_rate_statements",
    alternateKeys: ["personal_statements", "claim_statements"],
    checkCompleted: (data, altData) => {
      if (!data && !altData?.length) return false;
      try {
        const statements = JSON.parse(data || altData?.[0]);
        if (Array.isArray(statements)) return statements.length > 0;
        return Object.keys(statements || {}).length > 0;
      } catch {
        return false;
      }
    },
    icon: "✍️",
    weight: 10,
    phase: "documentation",
    critical: true,
    manualAllowed: true,
  },
  {
    id: "exam_prep",
    title: "C&P Exam Prepared",
    description: "Reviewed exam guidance and what to expect",
    storageKey: "vet_rate_exam_prep_complete",
    alternateKeys: ["cp_exam_prepared", "exam_prep_reviewed"],
    checkCompleted: (data, altData) => {
      if (data === "true") return true;
      if (altData?.some((d) => d === "true")) return true;
      try {
        const parsed = JSON.parse(data);
        return !!(parsed?.completed || parsed?.reviewed);
      } catch {
        return false;
      }
    },
    icon: "🎓",
    weight: 5,
    phase: "documentation",
    critical: false,
    manualAllowed: true,
  },

  // ========== PHASE 5: FILING ==========
  {
    id: "ratings",
    title: "Ratings Calculated",
    description: "Combined rating estimated in Tactical Calculator",
    storageKey: "vet_rate_my_ratings",
    alternateKeys: ["my_ratings", "calculated_ratings"],
    checkCompleted: (data, altData) => {
      if (!data && !altData?.length) return false;
      try {
        const ratings = JSON.parse(data || altData?.[0]);
        if (Array.isArray(ratings)) return ratings.length > 0;
        return !!(ratings?.combined || ratings?.conditions?.length > 0);
      } catch {
        return false;
      }
    },
    icon: "🎯",
    weight: 5,
    phase: "filing",
    critical: false,
    manualAllowed: true,
  },
  {
    id: "forms",
    title: "VA Forms Prepared",
    description: "VA forms filled using Forms Helper (526EZ, DBQs, etc.)",
    storageKey: "vet_rate_saved_forms",
    alternateKeys: ["saved_forms", "va_forms"],
    checkCompleted: (data, altData) => {
      if (!data && !altData?.length) return false;
      try {
        const forms = JSON.parse(data || altData?.[0]);
        if (Array.isArray(forms)) return forms.length > 0;
        return Object.keys(forms || {}).length > 0;
      } catch {
        return false;
      }
    },
    icon: "📄",
    weight: 5,
    phase: "filing",
    critical: true,
    manualAllowed: true,
  },

  // ========== CLAIM NAVIGATOR INTEGRATION ==========
  {
    id: "claim_navigator_used",
    title: "Claim Navigator Activated",
    description: "Using Claim Navigator to track claim workflow and deadlines",
    storageKey: "vet_rate_claim_navigator_active",
    alternateKeys: ["vet_rate_claim_navigator_claim_created"],
    checkCompleted: (data, altData) => {
      if (data === "true") return true;
      if (altData?.some((d) => d && d !== "null")) return true;
      try {
        const parsed = JSON.parse(data || altData?.[0]);
        return !!(parsed?.created || parsed?.active);
      } catch {
        return data === "true" || altData?.some((d) => d === "true");
      }
    },
    icon: "🗺️",
    weight: 5,
    phase: "preparation",
    critical: false,
    manualAllowed: false,
  },
  {
    id: "claim_tracked",
    title: "Claims in Navigator",
    description: "At least one claim being tracked in Claim Navigator",
    storageKey: "vet_rate_claim_navigator_claims",
    alternateKeys: [],
    checkCompleted: (data) => {
      if (!data) return false;
      try {
        const parsed = JSON.parse(data);
        if (parsed?.claims && Array.isArray(parsed.claims)) {
          return parsed.claims.length > 0;
        }
        return false;
      } catch {
        return false;
      }
    },
    icon: "📋",
    weight: 8,
    phase: "preparation",
    critical: false,
    manualAllowed: false,
  },
];

/**
 * Get manual progress data from localStorage
    icon: '📄',
    weight: 5,
    phase: 'filing',
    critical: true,
    manualAllowed: true
  }
];

/**
 * Get manual progress data from localStorage
 */
const getManualProgress = () => {
  try {
    const data = localStorage.getItem(MANUAL_PROGRESS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

/**
 * Set manual progress for a milestone
 */
const _setManualProgress = (milestoneId, completed, notes = "") => {
  const current = getManualProgress();
  current[milestoneId] = {
    completed,
    notes,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(MANUAL_PROGRESS_KEY, JSON.stringify(current));

  // Dispatch event for real-time updates
  window.dispatchEvent(
    new CustomEvent("claimProgressUpdate", {
      detail: { milestoneId, completed },
    }),
  );
};

/**
 * Check if a milestone is completed (automatic or manual)
 */
const checkMilestoneCompletion = (milestone) => {
  // Check manual override first
  const manualProgress = getManualProgress();
  if (manualProgress[milestone.id]?.completed) {
    return { completed: true, source: "manual" };
  }

  // Check primary storage key
  const primaryData = localStorage.getItem(milestone.storageKey);

  // Gather alternate key data
  const altData =
    milestone.alternateKeys
      ?.map((key) => localStorage.getItem(key))
      .filter(Boolean) || [];

  // Run the completion check
  const autoCompleted = milestone.checkCompleted(primaryData, altData);

  return { completed: autoCompleted, source: autoCompleted ? "auto" : null };
};

/**
 * Calculate Ready-to-File status
 */
const calculateReadyToFile = (completedMilestones) => {
  const criticalMilestones = MILESTONES.filter((m) => m.critical);
  const completedCritical = criticalMilestones.filter((cm) =>
    completedMilestones.some((m) => m.id === cm.id),
  );

  const missingCritical = criticalMilestones.filter(
    (cm) => !completedMilestones.some((m) => m.id === cm.id),
  );

  const readyToFile = missingCritical.length === 0;
  const criticalProgress = Math.round(
    (completedCritical.length / criticalMilestones.length) * 100,
  );

  return {
    ready: readyToFile,
    criticalCompleted: completedCritical.length,
    criticalTotal: criticalMilestones.length,
    criticalProgress,
    missingCritical: missingCritical.map((m) => ({
      id: m.id,
      title: m.title,
      phase: m.phase,
    })),
  };
};

/**
 * Group milestones by phase
 */
const _getMilestonesByPhase = () => {
  const grouped = {};
  Object.values(PHASES).forEach((phase) => {
    grouped[phase.id] = {
      ...phase,
      milestones: MILESTONES.filter((m) => m.phase === phase.id),
    };
  });
  return grouped;
};

function _buildPhaseProgress(phase, milestones, completed) {
  const phaseMilestones = milestones.filter((m) => m.phase === phase.id);
  const phaseCompleted = phaseMilestones.filter((pm) =>
    completed.some((c) => c.id === pm.id),
  );
  return {
    ...phase,
    milestones: phaseMilestones,
    completed: phaseCompleted.length,
    total: phaseMilestones.length,
    percentage: Math.round(
      (phaseCompleted.length / phaseMilestones.length) * 100,
    ),
  };
}

function computeProgress() {
  const completed = [];
  let completedWeight = 0;

  MILESTONES.forEach((milestone) => {
    const { completed: isCompleted, source } =
      checkMilestoneCompletion(milestone);
    if (isCompleted) {
      completed.push({ ...milestone, completionSource: source });
      completedWeight += milestone.weight;
    }
  });

  const totalWeight = MILESTONES.reduce((sum, m) => sum + m.weight, 0);
  const percentage = Math.round((completedWeight / totalWeight) * 100);

  // Calculate Ready-to-File status
  const readyToFile = calculateReadyToFile(completed);

  // Group by phase with completion status
  const byPhase = {};
  Object.values(PHASES).forEach((phase) => {
    byPhase[phase.id] = _buildPhaseProgress(phase, MILESTONES, completed);
  });

  return {
    completedMilestones: completed,
    totalMilestones: MILESTONES.length,
    percentage,
    completedWeight,
    totalWeight,
    milestones: MILESTONES,
    readyToFile,
    byPhase,
  };
}

/**
 * Custom hook to track claim progress across all tools
 */
export default function useClaimProgress() {
  // Computed synchronously on the initial render (not in an effect after
  // mount) so the first paint already reflects real data — deferring this to
  // a post-mount effect caused a second render with different content height,
  // a measurable layout shift for whatever renders progress (e.g. the home
  // page's CommandersChecklist).
  const [progress, setProgress] = useState(computeProgress);

  const checkProgress = useCallback(() => {
    setProgress(computeProgress());
  }, []);

  useEffect(() => {
    checkProgress();

    // Listen for storage changes (in case data is updated in another tab)
    const handleStorageChange = () => {
      checkProgress();
    };

    // Listen for custom progress updates
    const handleProgressUpdate = () => {
      checkProgress();
    };

    // Listen for Claim Navigator updates (new integration)
    const handleNavigatorUpdate = () => {
      checkProgress();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("claimProgressUpdate", handleProgressUpdate);
    window.addEventListener("claimNavigatorUpdate", handleNavigatorUpdate);
    window.addEventListener("bigThreeUpdate", handleProgressUpdate);

    // Set up interval to check periodically (every 10 seconds)
    const interval = setInterval(checkProgress, 10000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("claimProgressUpdate", handleProgressUpdate);
      window.removeEventListener("claimNavigatorUpdate", handleNavigatorUpdate);
      window.removeEventListener("bigThreeUpdate", handleProgressUpdate);
      clearInterval(interval);
    };
  }, [checkProgress]);

  return {
    ...progress,
    refresh: checkProgress,
  };
}

/**
 * Export phases for external use
 */
