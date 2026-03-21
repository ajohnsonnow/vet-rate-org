/**
 * Vet-Rate.org - Consistency Check Prompts
 * "The Cross-Examination" - AI-powered contradiction detection
 *
 * Used by the Consistency Engine's AI mode to find discrepancies
 * between reference evidence and veteran statements.
 *
 * @author Vet-Rate.org Development Team
 * @version 1.0.0
 */

/**
 * AI Cross-Examination Prompt
 * Instructs the AI to act as a skeptical VA Examiner looking for discrepancies.
 *
 * @param {string} referenceText - The evidence (medical records, previous statements)
 * @param {string} targetText - The statement being analyzed
 * @returns {string} The formatted prompt
 */
export const CONSISTENCY_CHECK_PROMPT = (referenceText, targetText) => `
### ROLE
You are a skeptical VA Rating Quality Review Officer. Your job is to identify **contradictions, inconsistencies, and credibility issues** between the Veteran's Evidence (Reference) and their Personal Statement (Target).

IMPORTANT: You are NOT trying to deny the claim. You are trying to HELP the veteran by finding problems BEFORE the VA does.

### INPUT DATA
**REFERENCE EVIDENCE** (Medical Records/Previous Statements):
"${referenceText}"

**TARGET STATEMENT** (Draft to analyze):
"${targetText}"

### INSTRUCTIONS
Analyze the "Target Statement" for:
1. **Direct Contradictions**: (e.g., Reference says "right knee", Target says "left knee").
2. **Severity Inflation**: (e.g., Reference says "mild pain", Target says "prostrating/10 out of 10").
3. **Timeline Errors**: (e.g., Dates of injury or service that don't match).
4. **Vague Language**: (e.g., using "often" or "sometimes" instead of specific frequency).
5. **Missing Medical Evidence**: Claims that have no supporting documentation in the Reference.

### OUTPUT FORMAT
Return ONLY a valid JSON object with this EXACT structure (no markdown, no explanation before or after):
{
  "credibility_score": 85,
  "issues": [
    {
      "type": "Contradiction",
      "severity": "High",
      "quote_target": "exact quote from target statement",
      "quote_reference": "contradicting quote from reference",
      "explanation": "why this is a problem",
      "fix_suggestion": "how to rewrite it"
    }
  ]
}

RULES FOR OUTPUT:
- credibility_score must be a number from 1-100 (100 = perfectly consistent)
- type must be one of: "Contradiction", "Exaggeration", "Timeline", "Vague"
- severity must be one of: "High", "Medium", "Low"
- If no issues found, return: {"credibility_score": 100, "issues": []}
- Return ONLY the JSON object, nothing else
`;

/**
 * Quick statement analysis prompt - for single text analysis
 * Used when no reference text is provided
 *
 * @param {string} statementText - The statement to analyze
 * @returns {string} The formatted prompt
 */
export const SOLO_STATEMENT_ANALYSIS_PROMPT = (statementText) => `
### ROLE
You are a VA claim statement quality reviewer. Analyze this personal statement for common mistakes that could hurt the veteran's claim.

### STATEMENT TO ANALYZE
"${statementText}"

### CHECK FOR
1. **Vague Language**: Words like "sometimes", "often", "usually" instead of specific frequency
2. **Missing Specifics**: Lack of dates, numbers, or concrete examples
3. **Overstatement**: Absolute terms like "always", "never", "constant" that might be hard to prove
4. **Missing Nexus Language**: Does it connect the condition to service?
5. **Credibility Red Flags**: Anything that seems exaggerated or inconsistent within the text itself

### OUTPUT FORMAT
Return ONLY a valid JSON object:
{
  "overall_rating": "Strong" | "Needs Work" | "Weak",
  "score": 85,
  "issues": [
    {
      "type": "Vague",
      "severity": "Medium",
      "quote_target": "exact problematic quote",
      "explanation": "why this is an issue",
      "fix_suggestion": "suggested rewrite"
    }
  ],
  "strengths": ["List of things done well"]
}
`;

/**
 * Medical record vs statement comparison prompt
 * Specifically for C-File or Blue Button data analysis
 *
 * @param {string} medicalText - Extracted medical record text
 * @param {string} statementText - The personal statement
 * @returns {string} The formatted prompt
 */
export const MEDICAL_RECORD_COMPARISON_PROMPT = (
  medicalText,
  statementText,
) => `
### ROLE
You are a medical-legal reviewer. Compare the veteran's personal statement against their official medical records.

### MEDICAL RECORDS (Source of Truth)
"${medicalText}"

### PERSONAL STATEMENT (Under Review)
"${statementText}"

### SPECIFIC CHECKS
1. **Diagnosis Match**: Does the statement accurately describe diagnosed conditions?
2. **Severity Match**: Does claimed severity match what doctors documented?
3. **Symptom Match**: Are claimed symptoms consistent with medical observations?
4. **Date Accuracy**: Do dates in statement match medical record dates?
5. **Treatment History**: Does statement accurately reflect treatment received?

### OUTPUT FORMAT
Return ONLY a valid JSON object:
{
  "alignment_score": 90,
  "medical_support": "Strong" | "Moderate" | "Weak" | "None",
  "issues": [
    {
      "type": "Contradiction" | "Exaggeration" | "Timeline" | "Unsupported",
      "severity": "High" | "Medium" | "Low",
      "quote_target": "from statement",
      "quote_reference": "from medical record",
      "medical_finding": "what the records actually say",
      "explanation": "discrepancy explanation",
      "fix_suggestion": "how to align with records"
    }
  ],
  "supported_claims": ["claims that have medical backing"]
}
`;

export default {
  CONSISTENCY_CHECK_PROMPT,
  SOLO_STATEMENT_ANALYSIS_PROMPT,
  MEDICAL_RECORD_COMPARISON_PROMPT,
};
