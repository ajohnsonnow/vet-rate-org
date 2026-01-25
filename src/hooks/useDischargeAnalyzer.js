import separationCodes from '../data/separation_codes_db.json';

/**
 * DD-214 Discharge Analyzer Hook
 * 
 * Purpose: Extract and decode Separation Program Numbers (SPN) from DD-214 text
 * to identify claim opportunities and route to appropriate tools.
 * 
 * Architecture:
 * - Deterministic lookup (no LLM needed for codes)
 * - Acts as "router" to other tools (Pathfinder, Red Team, etc.)
 * - Client-side only (privacy-first)
 * 
 * @returns {Object} Analyzer functions
 */
export const useDischargeAnalyzer = () => {

  /**
   * Analyze DD-214 extracted text for separation codes and strategic implications
   * 
   * @param {string} extractedText - OCR'd or PDF-extracted text from DD-214
   * @returns {Object} Analysis results with codes, flags, and workflow suggestions
   */
  const analyzeDD214 = (extractedText) => {
    const analysisResults = {
      spnCode: null,
      reEntryCode: null,
      characterOfService: null,
      flags: [],
      suggestedWorkflows: [],
      metadata: {
        analyzed_at: new Date().toISOString(),
        database_version: separationCodes.meta.version
      }
    };

    if (!extractedText || typeof extractedText !== 'string') {
      analysisResults.flags.push({
        type: 'ERROR',
        message: 'No text provided for analysis'
      });
      return analysisResults;
    }

    // 1. Extract SPN Code (Box 26 - Separation Code)
    // Pattern: Looks for 3 capital letters after "Box 26", "Separation Code", or "SPN"
    // DD-214 OCR can be messy, so we try multiple patterns
    const spnPatterns = [
      /Box\s*26[:\s]*([A-Z]{3})/i,
      /Separation\s+Code[:\s]*([A-Z]{3})/i,
      /SPN[:\s]*([A-Z]{3})/i,
      /26\.\s+Separation\s+Code[:\s]*([A-Z]{3})/i
    ];

    let spnMatch = null;
    for (const pattern of spnPatterns) {
      spnMatch = extractedText.match(pattern);
      if (spnMatch) break;
    }
    
    if (spnMatch) {
      const code = spnMatch[1].toUpperCase();
      const codeData = separationCodes.codes[code];
      
      if (codeData) {
        analysisResults.spnCode = {
          code: codeData.code,
          description: codeData.description,
          category: codeData.category,
          narrative: codeData.narrative,
          risk_level: codeData.risk_level,
          claim_potential: codeData.strategic_implications.claim_potential
        };
        
        // Push Red Team Flags
        if (codeData.strategic_implications.red_team_flag) {
          analysisResults.flags.push({
            type: codeData.risk_level === 'High' ? 'WARNING' : 'INFO',
            category: 'Strategic Intelligence',
            message: codeData.strategic_implications.red_team_flag
          });
        }

        // Push Workflow Suggestions
        codeData.strategic_implications.suggested_actions.forEach(action => {
          analysisResults.suggestedWorkflows.push({
            tool: action.tool,
            action: action.action,
            priority: codeData.risk_level === 'High' ? 'High' : 'Normal'
          });
        });
      } else {
        // Code not in database - flag for manual review
        analysisResults.flags.push({
          type: 'WARNING',
          category: 'Unknown Code',
          message: `Separation code "${code}" not found in database. This may be a valid code not yet cataloged. Consider manual review.`
        });
      }
    }

    // 2. Extract Re-Entry Code (Box 27)
    const reEntryPatterns = [
      /Box\s*27[:\s]*([A-Z0-9-]{2,5})/i,
      /Re-?entry\s+Code[:\s]*([A-Z0-9-]{2,5})/i,
      /27\.\s+Re-?entry\s+Eligibility\s+Code[:\s]*([A-Z0-9-]{2,5})/i
    ];

    let reEntryMatch = null;
    for (const pattern of reEntryPatterns) {
      reEntryMatch = extractedText.match(pattern);
      if (reEntryMatch) break;
    }

    if (reEntryMatch) {
      const reCode = reEntryMatch[1].toUpperCase();
      analysisResults.reEntryCode = reCode;

      // RE-4 = Not eligible to reenlist (barrier to benefits)
      if (reCode.includes('RE-4') || reCode.includes('RE4')) {
        analysisResults.flags.push({
          type: 'WARNING',
          category: 'Re-Entry Eligibility',
          message: 'RE-4 code indicates you were not eligible to reenlist. This may impact eligibility for certain benefits and could indicate adverse discharge circumstances.'
        });
        
        analysisResults.suggestedWorkflows.push({
          tool: 'Pathfinder',
          action: 'Review discharge characterization and upgrade eligibility',
          priority: 'High'
        });
      }
    }

    // 3. Extract Character of Service (Box 24)
    const characterPatterns = [
      /Box\s*24[:\s]*(Honorable|General|Under\s+Honorable\s+Conditions|Other\s+Than\s+Honorable|Bad\s+Conduct|Dishonorable)/i,
      /Character\s+of\s+Service[:\s]*(Honorable|General|Under\s+Honorable\s+Conditions|Other\s+Than\s+Honorable|Bad\s+Conduct|Dishonorable)/i,
      /24\.\s+Character\s+of\s+Service[:\s]*(Honorable|General|Under\s+Honorable\s+Conditions|Other\s+Than\s+Honorable|Bad\s+Conduct|Dishonorable)/i
    ];

    let characterMatch = null;
    for (const pattern of characterPatterns) {
      characterMatch = extractedText.match(pattern);
      if (characterMatch) break;
    }

    if (characterMatch) {
      const character = characterMatch[1];
      analysisResults.characterOfService = character;

      // Flag non-honorable discharges
      if (character.match(/General|Other|Bad|Dishonorable/i)) {
        analysisResults.flags.push({
          type: 'WARNING',
          category: 'Character of Service',
          message: `${character} discharge may limit eligibility for VA benefits. However, VA evaluates eligibility separately from DoD discharge characterization. Character of service upgrades are possible through discharge review boards.`
        });
        
        analysisResults.suggestedWorkflows.push({
          tool: 'Pathfinder',
          action: 'Initiate discharge upgrade review process',
          priority: 'High'
        });
      }
    }

    return analysisResults;
  };

  /**
   * Extract service dates for Time Machine integration
   * 
   * @param {string} extractedText - DD-214 text
   * @returns {Object} Service dates
   */
  const extractServiceDates = (extractedText) => {
    const dates = {
      entryDate: null,
      separationDate: null
    };

    // Box 12a - Entry on Active Duty
    const entryPatterns = [
      /12a[:\s.]*(\d{2}[/-]\d{2}[/-]\d{2,4})/i,
      /Entry.*Active\s+Duty[:\s]*(\d{2}[/-]\d{2}[/-]\d{2,4})/i
    ];

    for (const pattern of entryPatterns) {
      const match = extractedText.match(pattern);
      if (match) {
        dates.entryDate = match[1];
        break;
      }
    }

    // Box 11 - Separation Date
    const separationPatterns = [
      /11[:\s.]*(\d{2}[/-]\d{2}[/-]\d{2,4})/i,
      /Date\s+of\s+Separation[:\s]*(\d{2}[/-]\d{2}[/-]\d{2,4})/i
    ];

    for (const pattern of separationPatterns) {
      const match = extractedText.match(pattern);
      if (match) {
        dates.separationDate = match[1];
        break;
      }
    }

    return dates;
  };

  /**
   * Get all known SPN codes for reference
   * 
   * @returns {Array} List of all codes in database
   */
  const getKnownCodes = () => {
    return Object.values(separationCodes.codes).map(code => ({
      code: code.code,
      description: code.description,
      category: code.category,
      risk_level: code.risk_level
    }));
  };

  return { 
    analyzeDD214,
    extractServiceDates,
    getKnownCodes
  };
};
