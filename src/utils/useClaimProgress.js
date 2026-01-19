/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Claim Progress Hook
 * Tracks completion across all major tools for gamified progress
 */

import { useState, useEffect } from 'react';

// Define all completion milestones
const MILESTONES = [
  {
    id: 'profile',
    title: 'Veteran Profile Created',
    description: 'Basic information entered',
    storageKey: 'vet_rate_veteran_profile',
    checkCompleted: (data) => {
      if (!data) return false;
      const profile = JSON.parse(data);
      return profile.firstName && profile.lastName && profile.dob;
    },
    icon: '👤',
    weight: 5
  },
  {
    id: 'diagnosis',
    title: 'Diagnosis Found',
    description: 'Medical evidence identified via Blue Button or manual entry',
    storageKey: 'vet_rate_saved_claims',
    checkCompleted: (data) => {
      if (!data) return false;
      const claims = JSON.parse(data);
      return claims && claims.length > 0;
    },
    icon: '🏥',
    weight: 15
  },
  {
    id: 'service_connection',
    title: 'Service Event Linked',
    description: 'C-File analysis or service records reviewed',
    storageKey: 'cfile_analysis_completed',
    checkCompleted: (data) => {
      return data === 'true';
    },
    icon: '📋',
    weight: 15
  },
  {
    id: 'symptoms',
    title: 'Symptoms Documented',
    description: 'Daily symptoms logged in Symptom Logger',
    storageKey: 'symptom_logs',
    checkCompleted: (data) => {
      if (!data) return false;
      try {
        const logs = JSON.parse(data);
        return logs && Object.keys(logs).length > 0;
      } catch {
        return false;
      }
    },
    icon: '📝',
    weight: 10
  },
  {
    id: 'statement',
    title: 'Personal Statement Written',
    description: 'Statement generated using AI Assistant or manually',
    storageKey: 'vet_rate_statements',
    checkCompleted: (data) => {
      if (!data) return false;
      const statements = JSON.parse(data);
      return statements && Object.keys(statements).length > 0;
    },
    icon: '✍️',
    weight: 15
  },
  {
    id: 'nexus',
    title: 'Nexus Logic Generated',
    description: 'Medical reasoning documented in Nexus Builder',
    storageKey: 'nexus_letters',
    checkCompleted: (data) => {
      if (!data) return false;
      try {
        const letters = JSON.parse(data);
        return letters && letters.length > 0;
      } catch {
        return false;
      }
    },
    icon: '🔗',
    weight: 15
  },
  {
    id: 'secondary',
    title: 'Secondary Conditions Identified',
    description: 'Secondary Scout used to find connected conditions',
    storageKey: 'secondary_conditions_found',
    checkCompleted: (data) => {
      return data === 'true';
    },
    icon: '🔍',
    weight: 10
  },
  {
    id: 'ratings',
    title: 'Ratings Calculated',
    description: 'Combined rating estimated in Tactical Calculator',
    storageKey: 'vet_rate_my_ratings',
    checkCompleted: (data) => {
      if (!data) return false;
      const ratings = JSON.parse(data);
      return ratings && ratings.length > 0;
    },
    icon: '🎯',
    weight: 10
  },
  {
    id: 'forms',
    title: 'Forms Prepared',
    description: 'VA forms filled using Forms Helper',
    storageKey: 'vet_rate_saved_forms',
    checkCompleted: (data) => {
      if (!data) return false;
      const forms = JSON.parse(data);
      return forms && forms.length > 0;
    },
    icon: '📄',
    weight: 5
  }
];

/**
 * Custom hook to track claim progress across all tools
 */
export default function useClaimProgress() {
  const [progress, setProgress] = useState({
    completedMilestones: [],
    totalMilestones: MILESTONES.length,
    percentage: 0,
    completedWeight: 0,
    totalWeight: MILESTONES.reduce((sum, m) => sum + m.weight, 0)
  });

  const checkProgress = () => {
    const completed = [];
    let completedWeight = 0;

    MILESTONES.forEach(milestone => {
      const data = localStorage.getItem(milestone.storageKey);
      if (milestone.checkCompleted(data)) {
        completed.push(milestone);
        completedWeight += milestone.weight;
      }
    });

    const totalWeight = MILESTONES.reduce((sum, m) => sum + m.weight, 0);
    const percentage = Math.round((completedWeight / totalWeight) * 100);

    setProgress({
      completedMilestones: completed,
      totalMilestones: MILESTONES.length,
      percentage,
      completedWeight,
      totalWeight,
      milestones: MILESTONES
    });
  };

  useEffect(() => {
    checkProgress();

    // Listen for storage changes (in case data is updated in another tab)
    const handleStorageChange = () => {
      checkProgress();
    };

    window.addEventListener('storage', handleStorageChange);

    // Set up interval to check periodically (every 10 seconds)
    const interval = setInterval(checkProgress, 10000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return {
    ...progress,
    refresh: checkProgress
  };
}

/**
 * Get milestone status
 */
export const getMilestoneStatus = (milestoneId) => {
  const milestone = MILESTONES.find(m => m.id === milestoneId);
  if (!milestone) return false;

  const data = localStorage.getItem(milestone.storageKey);
  return milestone.checkCompleted(data);
};

/**
 * Mark a milestone as completed (for tools that don't use standard storage)
 */
export const markMilestoneCompleted = (milestoneId) => {
  const milestone = MILESTONES.find(m => m.id === milestoneId);
  if (!milestone) return false;

  // For boolean flags
  if (milestoneId === 'service_connection' || milestoneId === 'secondary') {
    localStorage.setItem(milestone.storageKey, 'true');
    return true;
  }

  return false;
};
