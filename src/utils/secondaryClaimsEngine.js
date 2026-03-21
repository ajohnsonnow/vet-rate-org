/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Secondary Conditions Scout Engine
 * Implements 38 CFR § 3.310 logic for identifying potential secondary claims
 * Based on Medical Logic Graph traversal
 */

import secondaryConditionsDB from "../data/secondary_conditions_db.json";
import {
  normalizeCondition,
  requiresNSAIDuse,
  isLowerBodyJoint,
  getContralateralJoint,
  getDisplayName,
} from "./secondaryConditionsMatcher.js";

/**
 * Main function to find potential secondary claims
 * @param {string[]} userDisabilities - Array of user's current service-connected disabilities
 * @returns {Object[]} - Prioritized array of secondary condition suggestions
 */
export function findSecondaryClaims(userDisabilities) {
  if (!userDisabilities || userDisabilities.length === 0) {
    return [];
  }

  const suggestions = [];
  const normalizedDisabilities = [];
  const alreadySuggested = new Set();

  // Step 1: Normalize user input
  userDisabilities.forEach((disability) => {
    const normalized = normalizeCondition(disability);
    if (normalized) {
      normalizedDisabilities.push({
        original: disability,
        slug: normalized,
      });
    }
  });

  // Step 2: Direct lookup in database
  normalizedDisabilities.forEach(({ original, slug }) => {
    if (secondaryConditionsDB[slug]) {
      const primaryData = secondaryConditionsDB[slug];

      primaryData.potential_secondaries.forEach((secondary) => {
        // Check if user already has this condition
        const hasCondition = userDisabilities.some((d) =>
          d.toLowerCase().includes(secondary.condition.toLowerCase()),
        );

        if (!hasCondition && !alreadySuggested.has(secondary.condition)) {
          suggestions.push({
            primaryCondition: original,
            primarySlug: slug,
            secondaryCondition: secondary.condition,
            ecfrDiagnosticCode: secondary.ecfr_diagnostic_code || null,
            probability: secondary.probability,
            mechanism: secondary.mechanism,
            nexusTheory: secondary.nexus_theory,
            // Support both old field name (medical_citations) and new field name (medical_evidence)
            medicalEvidence:
              secondary.medical_evidence || secondary.medical_citations || [],
            evidenceType:
              secondary.evidence_type ||
              "Medical Literature (for IMO/Nexus purposes)",
            source: "direct_lookup",
          });
          alreadySuggested.add(secondary.condition);
        }
      });
    }
  });

  // Step 3: Cluster Logic - Medication Bridge (NSAID)
  const hasNSAIDCondition = userDisabilities.some((d) => requiresNSAIDuse(d));

  if (hasNSAIDCondition) {
    const nsaidSecondaries = [
      {
        condition: "Gastroesophageal Reflux Disease (GERD)",
        mechanism: "Medication",
        nexusTheory:
          "Chronic use of nonsteroidal anti-inflammatory drugs (NSAIDs) to manage service-connected pain disrupts the gastric mucosal barrier by inhibiting prostaglandin synthesis. This permits gastric acid to damage the esophageal lining and reduces lower esophageal sphincter pressure, directly causing GERD. The medically necessary NSAID therapy for service-connected pain management proximately causes this secondary gastrointestinal condition.",
        probability: "High",
      },
      {
        condition: "Peptic Ulcer Disease",
        mechanism: "Medication",
        nexusTheory:
          "Chronic NSAID use required for managing service-connected pain directly causes peptic ulcer disease through disruption of gastric mucosal defenses. NSAIDs inhibit prostaglandin synthesis, reducing mucus production and mucosal blood flow, permitting gastric acid to damage the gastric and duodenal mucosa.",
        probability: "High",
      },
      {
        condition: "Chronic Kidney Disease (CKD)",
        mechanism: "Medication",
        nexusTheory:
          "Long-term NSAID use for service-connected pain management causes chronic kidney disease through multiple mechanisms: reduced renal blood flow by inhibiting vasodilatory prostaglandins, acute tubular necrosis, and chronic tubulointerstitial damage. The cumulative renal toxicity from medically necessary NSAID therapy proximately causes progressive kidney disease.",
        probability: "Medium",
      },
    ];

    nsaidSecondaries.forEach((secondary) => {
      const hasCondition = userDisabilities.some((d) =>
        d.toLowerCase().includes(secondary.condition.toLowerCase()),
      );

      if (!hasCondition && !alreadySuggested.has(secondary.condition)) {
        suggestions.push({
          primaryCondition: "Chronic Pain Requiring NSAIDs",
          primarySlug: "chronic_pain_nsaid",
          secondaryCondition: secondary.condition,
          ecfrDiagnosticCode: secondary.condition.includes("GERD")
            ? "DC 7206"
            : secondary.condition.includes("Ulcer")
              ? "DC 7304"
              : secondary.condition.includes("Kidney")
                ? "DC 7530"
                : null,
          probability: secondary.probability,
          mechanism: secondary.mechanism,
          nexusTheory: secondary.nexusTheory,
          medicalEvidence: [
            'Lanza et al., "Guidelines for prevention of NSAID-related ulcer complications," Am J Gastroenterol 2009',
            'Sostres et al., "Adverse effects of NSAIDs on the gastrointestinal tract," Gastroenterol Res Pract 2010',
          ],
          evidenceType: "Medical Literature (for IMO/Nexus purposes)",
          source: "medication_bridge",
          warning:
            "If you take NSAIDs (ibuprofen, naproxen, aspirin) daily or frequently for pain",
        });
        alreadySuggested.add(secondary.condition);
      }
    });
  }

  // Step 4: Cluster Logic - Orthopedic Cascade (Altered Gait)
  normalizedDisabilities.forEach(({ original, slug }) => {
    if (isLowerBodyJoint(slug)) {
      const contralateral = getContralateralJoint(slug);

      // Suggest contralateral joint
      if (contralateral) {
        const contralateralDisplay = getDisplayName(contralateral);
        const hasContralateral = normalizedDisabilities.some(
          (d) => d.slug === contralateral,
        );

        if (!hasContralateral && !alreadySuggested.has(contralateralDisplay)) {
          suggestions.push({
            primaryCondition: original,
            primarySlug: slug,
            secondaryCondition: contralateralDisplay,
            ecfrDiagnosticCode: "DC 5260/5261 or DC 5270/5271",
            probability: "High",
            mechanism: "Altered Gait",
            nexusTheory: `The veteran's service-connected ${original} necessitates an antalgic gait (pain-avoiding gait) to ambulate. This compensatory biomechanical alteration places disproportionate and excessive mechanical stress on the contralateral joint. The asymmetric loading pattern creates abnormal contact pressures on the articular cartilage, accelerating degenerative changes. This chronic mechanical overload proximately causes or aggravates the contralateral condition.`,
            medicalEvidence: [
              'Shakoor et al., "Asymmetric loading and contralateral joint OA," Arthritis Rheum 2011',
              'Thorp et al., "Biomechanical gait alterations and OA," Clin Biomech 2007',
            ],
            evidenceType: "Medical Literature (for IMO/Nexus purposes)",
            source: "orthopedic_cascade",
          });
          alreadySuggested.add(contralateralDisplay);
        }
      }

      // Suggest lumbar spine if not already present
      if (slug !== "lumbar_spine") {
        const hasLumbar = normalizedDisabilities.some(
          (d) => d.slug === "lumbar_spine",
        );
        const lumbarDisplay = "Lumbar Spine Degenerative Disc Disease";

        if (!hasLumbar && !alreadySuggested.has(lumbarDisplay)) {
          suggestions.push({
            primaryCondition: original,
            primarySlug: slug,
            secondaryCondition: lumbarDisplay,
            ecfrDiagnosticCode: "DC 5237/5242/5243",
            probability: "High",
            mechanism: "Altered Gait",
            nexusTheory: `The veteran's service-connected ${original} requires biomechanical compensation through altered gait mechanics, pelvic tilt, and postural adjustments. This asymmetric loading pattern creates abnormal stress distribution on the lumbar spine, particularly affecting the L4-L5 and L5-S1 segments. The altered kinetic chain proximately causes accelerated degenerative disc disease and facet arthropathy in the lumbar spine.`,
            medicalEvidence: [
              'Lewek et al., "OA and trunk kinematics during gait," Gait Posture 2006',
              'Hunt et al., "Biomechanical changes at spine due to lower limb OA," Arthritis Care Res 2011',
            ],
            evidenceType: "Medical Literature (for IMO/Nexus purposes)",
            source: "orthopedic_cascade",
          });
          alreadySuggested.add(lumbarDisplay);
        }
      }
    }
  });

  // Step 5: Cluster Logic - Mental Health & Tinnitus Combinations
  const hasPTSD = normalizedDisabilities.some((d) => d.slug === "ptsd");
  const hasTinnitus = normalizedDisabilities.some((d) => d.slug === "tinnitus");
  const hasMigraines = userDisabilities.some(
    (d) =>
      d.toLowerCase().includes("migraine") ||
      d.toLowerCase().includes("headache"),
  );

  if (
    hasTinnitus &&
    !hasMigraines &&
    !alreadySuggested.has("Migraine Headaches")
  ) {
    suggestions.push({
      primaryCondition: "Tinnitus",
      primarySlug: "tinnitus",
      secondaryCondition: "Migraine Headaches",
      probability: "High",
      mechanism: "Direct",
      nexusTheory:
        "The veteran's service-connected tinnitus proximately causes or aggravates migraine headaches through sensory pathway sensitization. Tinnitus represents aberrant neural activity in the auditory cortex that can trigger or lower the threshold for migraine attacks. Chronic auditory phantom perception creates continuous sensory stress, activating trigeminovascular pathways implicated in migraine pathophysiology.",
      medicalCitations: [
        'Langguth et al., "Tinnitus and headache," Biomed Res Int 2015',
        'Haider et al., "Tinnitus, headache, and mood disorders," J Head Face Pain 2017',
      ],
      source: "cluster_detection",
    });
    alreadySuggested.add("Migraine Headaches");
  }

  // Step 6: Sort by probability (High first, then Medium)
  const priorityMap = { High: 3, Medium: 2, Low: 1 };

  suggestions.sort((a, b) => {
    const priorityDiff =
      priorityMap[b.probability] - priorityMap[a.probability];
    if (priorityDiff !== 0) return priorityDiff;
    // Secondary sort by mechanism (Direct > Medication > Altered Gait)
    const mechanismPriority = { Direct: 3, Medication: 2, "Altered Gait": 1 };
    return (
      (mechanismPriority[b.mechanism] || 0) -
      (mechanismPriority[a.mechanism] || 0)
    );
  });

  return suggestions;
}

/**
 * Gets summary statistics about potential secondary claims
 * @param {Object[]} suggestions - Array from findSecondaryClaims
 * @returns {Object} - Summary statistics
 */
export function getSecondaryClaimsSummary(suggestions) {
  return {
    totalSuggestions: suggestions.length,
    highProbability: suggestions.filter((s) => s.probability === "High").length,
    mediumProbability: suggestions.filter((s) => s.probability === "Medium")
      .length,
    byMechanism: {
      direct: suggestions.filter((s) => s.mechanism === "Direct").length,
      medication: suggestions.filter((s) => s.mechanism === "Medication")
        .length,
      alteredGait: suggestions.filter((s) => s.mechanism === "Altered Gait")
        .length,
    },
  };
}

/**
 * Filters suggestions by probability threshold
 * @param {Object[]} suggestions - Array from findSecondaryClaims
 * @param {string} minProbability - 'High' or 'Medium'
 * @returns {Object[]} - Filtered suggestions
 */
export function filterByProbability(suggestions, minProbability = "Medium") {
  if (minProbability === "High") {
    return suggestions.filter((s) => s.probability === "High");
  }
  return suggestions.filter(
    (s) => s.probability === "High" || s.probability === "Medium",
  );
}
