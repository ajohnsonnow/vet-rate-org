import redTeamData from '../data/red_team_protocols.json';

/**
 * War Game Adversarial Simulation Hook
 * 
 * Purpose: Stress-test VA claims by simulating a skeptical VA rater's review.
 * Identifies weaknesses before submission to give veterans a chance to fix issues.
 * 
 * Philosophy: "Find the holes before the VA does."
 * 
 * Architecture:
 * - Pattern matching for common denial triggers
 * - Scoring modifiers based on evidence quality
 * - Adversarial interrogation questions
 * - Actionable fix recommendations
 * 
 * Future Enhancement: Replace pattern matching with local LLM (Diamond-Swarm-Auditor)
 * for more sophisticated analysis.
 * 
 * @returns {Object} Simulation functions
 */
export const useWarGame = () => {

  /**
   * Run adversarial simulation on claim evidence
   * 
   * @param {Object} claimData - The claim package to test
   * @param {string} claimData.evidenceText - Combined text of all evidence
   * @param {Array} claimData.tags - User tags (COMBAT_VERIFIED, PACT_POST_911, etc.)
   * @param {boolean} claimData.hasBuddyStatements - Lay witness statements present
   * @param {boolean} claimData.hasPrivateDBQ - Private DBQ submitted
   * @param {boolean} claimData.hasSTRs - Service treatment records available
   * @param {string} claimData.conditionType - Type of claim (direct, secondary, presumptive)
   * @returns {Object} Simulation result with verdict and recommendations
   */
  const runSimulation = (claimData) => {
    const {
      evidenceText = '',
      tags = [],
      hasBuddyStatements = false,
      hasPrivateDBQ = false,
      hasSTRs = true,
      conditionType = 'direct',
      isPresumptive = false
    } = claimData;

    // Base result (optimistic start)
    let result = {
      verdict: "GRANT",
      confidence: 85,
      lethalWeakness: null,
      weaknesses: [],
      strengths: [],
      fixes: [],
      interrogationQuestions: [],
      score: 100,
      scenariosTriggered: []
    };

    const textLower = evidenceText.toLowerCase();

    // ========================================
    // CRITICAL SCENARIO CHECKS
    // ========================================

    // Check 1: Nexus Weakness (Speculative Language)
    const nexusScenario = redTeamData.scenarios.NEXUS_WEAKNESS;
    const hasSpeculativeLanguage = nexusScenario.trigger_phrases.some(phrase => 
      textLower.includes(phrase)
    );

    if (hasSpeculativeLanguage && conditionType !== 'presumptive') {
      result.verdict = "DENIED";
      result.confidence = 25;
      result.lethalWeakness = nexusScenario.simulation_output.lethalWeakness;
      result.score -= 35;
      result.scenariosTriggered.push(nexusScenario.id);
      
      result.weaknesses.push({
        severity: "Critical",
        title: nexusScenario.simulation_output.lethalWeakness,
        description: nexusScenario.simulation_output.rationale
      });

      result.fixes.push({
        title: "Strengthen Medical Nexus",
        instruction: nexusScenario.simulation_output.fix_action,
        priority: "Critical"
      });

      result.interrogationQuestions.push(...nexusScenario.simulation_output.interrogation_questions);
    }

    // Check 2: Missing Diagnosis
    const diagnosisScenario = redTeamData.scenarios.MISSING_DIAGNOSIS;
    const hasSymptomsOnly = diagnosisScenario.trigger_phrases.some(phrase => 
      textLower.includes(phrase)
    );
    const hasDiagnosis = diagnosisScenario.missing_keywords.some(keyword => 
      textLower.includes(keyword)
    );

    if (hasSymptomsOnly && !hasDiagnosis) {
      result.verdict = "DENIED";
      result.confidence = 15;
      result.lethalWeakness = diagnosisScenario.simulation_output.lethalWeakness;
      result.score -= 40;
      result.scenariosTriggered.push(diagnosisScenario.id);

      result.weaknesses.push({
        severity: "Critical",
        title: diagnosisScenario.simulation_output.lethalWeakness,
        description: diagnosisScenario.simulation_output.rationale
      });

      result.fixes.push({
        title: "Obtain Formal Diagnosis",
        instruction: diagnosisScenario.simulation_output.fix_action,
        priority: "Critical"
      });

      result.interrogationQuestions.push(...diagnosisScenario.simulation_output.interrogation_questions);
    }

    // Check 3: No In-Service Evidence
    const inServiceScenario = redTeamData.scenarios.NO_IN_SERVICE_EVIDENCE;
    const claimsPostService = inServiceScenario.trigger_phrases.some(phrase => 
      textLower.includes(phrase)
    );
    const hasInServiceEvidence = inServiceScenario.missing_keywords.some(keyword => 
      textLower.includes(keyword)
    );

    if (claimsPostService && !hasInServiceEvidence && !isPresumptive) {
      result.verdict = "DENIED";
      result.confidence = 20;
      result.lethalWeakness = inServiceScenario.simulation_output.lethalWeakness;
      result.score -= 40;
      result.scenariosTriggered.push(inServiceScenario.id);

      result.weaknesses.push({
        severity: "Critical",
        title: inServiceScenario.simulation_output.lethalWeakness,
        description: inServiceScenario.simulation_output.rationale
      });

      result.fixes.push({
        title: "Establish Nexus or Find STR Evidence",
        instruction: inServiceScenario.simulation_output.fix_action,
        priority: "Critical"
      });

      result.interrogationQuestions.push(...inServiceScenario.simulation_output.interrogation_questions);
    }

    // Check 4: Secondary Without Primary
    if (conditionType === 'secondary') {
      const secondaryScenario = redTeamData.scenarios.SECONDARY_WITHOUT_PRIMARY;
      const mentionsPrimary = secondaryScenario.missing_keywords.some(keyword => 
        textLower.includes(keyword)
      );

      if (!mentionsPrimary) {
        result.verdict = "DENIED";
        result.confidence = 10;
        result.lethalWeakness = secondaryScenario.simulation_output.lethalWeakness;
        result.score -= 50;
        result.scenariosTriggered.push(secondaryScenario.id);

        result.weaknesses.push({
          severity: "Critical",
          title: secondaryScenario.simulation_output.lethalWeakness,
          description: secondaryScenario.simulation_output.rationale
        });

        result.fixes.push({
          title: "Verify Primary Condition Service Connection",
          instruction: secondaryScenario.simulation_output.fix_action,
          priority: "Critical"
        });

        result.interrogationQuestions.push(...secondaryScenario.simulation_output.interrogation_questions);
      }
    }

    // Check 5: PTSD Weak Stressor
    if (textLower.includes('ptsd') || textLower.includes('post-traumatic stress')) {
      const stressorScenario = redTeamData.scenarios.WEAK_STRESSOR;
      const hasWeakStressor = stressorScenario.trigger_phrases.some(phrase => 
        textLower.includes(phrase)
      );
      const hasCriterionA = stressorScenario.missing_keywords.some(keyword => 
        textLower.includes(keyword)
      );

      if (hasWeakStressor && !hasCriterionA && !tags.includes('COMBAT_STRESSOR')) {
        result.verdict = "DENIED";
        result.confidence = 30;
        result.lethalWeakness = stressorScenario.simulation_output.lethalWeakness;
        result.score -= 40;
        result.scenariosTriggered.push(stressorScenario.id);

        result.weaknesses.push({
          severity: "High",
          title: stressorScenario.simulation_output.lethalWeakness,
          description: stressorScenario.simulation_output.rationale
        });

        result.fixes.push({
          title: "Identify Criterion A Stressor",
          instruction: stressorScenario.simulation_output.fix_action,
          priority: "High"
        });

        result.interrogationQuestions.push(...stressorScenario.simulation_output.interrogation_questions);
      }
    }

    // ========================================
    // SCORING MODIFIERS (Strengths)
    // ========================================

    // Combat Verification Boost
    if (tags.includes('COMBAT_STRESSOR')) {
      const modifier = redTeamData.scoring_modifiers.COMBAT_VERIFICATION_PRESENT;
      result.score += modifier.score_adjustment;
      result.strengths.push({
        title: "Combat Verification Present",
        description: modifier.note,
        bonus: `+${modifier.score_adjustment} points`
      });
    }

    // Presumptive Condition Boost
    if (isPresumptive || tags.includes('PACT_POST_911') || tags.includes('PACT_GULF')) {
      const modifier = redTeamData.scoring_modifiers.PRESUMPTIVE_CONDITION;
      result.score += modifier.score_adjustment;
      result.strengths.push({
        title: "Presumptive Service Connection",
        description: modifier.note,
        bonus: `+${modifier.score_adjustment} points`
      });
    }

    // Buddy Statements Boost
    if (hasBuddyStatements) {
      const modifier = redTeamData.scoring_modifiers.BUDDY_STATEMENTS_PRESENT;
      result.score += modifier.score_adjustment;
      result.strengths.push({
        title: "Lay Witness Statements Included",
        description: modifier.note,
        bonus: `+${modifier.score_adjustment} points`
      });
    }

    // Private DBQ Boost
    if (hasPrivateDBQ) {
      const modifier = redTeamData.scoring_modifiers.PRIVATE_DBQ_COMPLETE;
      result.score += modifier.score_adjustment;
      result.strengths.push({
        title: "Private DBQ Submitted",
        description: modifier.note,
        bonus: `+${modifier.score_adjustment} points`
      });
    }

    // No Medical Records Penalty
    if (!hasSTRs && !textLower.includes('medical record')) {
      const modifier = redTeamData.scoring_modifiers.NO_MEDICAL_RECORDS;
      result.score += modifier.score_adjustment; // This is negative
      result.weaknesses.push({
        severity: "High",
        title: "Insufficient Medical Evidence",
        description: modifier.note
      });
    }

    // Clamp score between 0-100
    result.score = Math.max(0, Math.min(100, result.score));

    // Update verdict based on final score if no critical denials
    if (result.verdict === "GRANT") {
      if (result.score >= 70) {
        result.verdict = "GRANT";
        result.confidence = result.score;
      } else if (result.score >= 40) {
        result.verdict = "DEVELOPMENT NEEDED";
        result.confidence = result.score;
        result.lethalWeakness = "Claim requires additional evidence before submission";
      } else {
        result.verdict = "HIGH RISK";
        result.confidence = result.score;
        result.lethalWeakness = "Significant weaknesses detected - do not file yet";
      }
    }

    return result;
  };

  /**
   * Get all available denial scenarios for reference
   * 
   * @returns {Array} List of all red team scenarios
   */
  const getAllScenarios = () => {
    return Object.values(redTeamData.scenarios);
  };

  /**
   * Get specific scenario details by ID
   * 
   * @param {string} scenarioId - The scenario ID (e.g., DENIAL_CODE_104)
   * @returns {Object|null} Scenario data or null if not found
   */
  const getScenario = (scenarioId) => {
    return Object.values(redTeamData.scenarios).find(s => s.id === scenarioId) || null;
  };

  return {
    runSimulation,
    getAllScenarios,
    getScenario
  };
};
