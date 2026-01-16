/**
 * Advanced search utility with synonym matching and fuzzy search
 * Supports finding related terms for conditions (PTSD, posttraumatic stress disorder, etc)
 */

/**
 * Normalize search term for comparison
 */
export const normalizeSearchTerm = (term) => {
  return term
    .toLowerCase()
    .trim()
    .replace(/[-\/]/g, '') // Remove hyphens and slashes
    .replace(/\s+/g, ' '); // Normalize spaces
};

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
const levenshteinDistance = (str1, str2) => {
  const track = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(0));

  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  return track[str2.length][str1.length];
};

/**
 * Perform fuzzy match with threshold
 */
const fuzzyMatch = (searchTerm, candidateTerm, threshold = 0.7) => {
  const normalized1 = normalizeSearchTerm(searchTerm);
  const normalized2 = normalizeSearchTerm(candidateTerm);

  if (normalized1 === normalized2) return true;
  if (normalized1.length < 3 || normalized2.length < 3) return false;

  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const similarity = 1 - distance / maxLength;

  return similarity >= threshold;
};

/**
 * Main search function with multiple strategies
 */
export const searchDisabilityData = (searchTerm, data) => {
  if (!searchTerm || !searchTerm.trim()) return [];

  const normalizedSearchTerm = normalizeSearchTerm(searchTerm);
  const results = [];
  const seen = new Set();

  if (!data || !data.disabilities) {
    console.warn('Invalid disability data structure');
    return [];
  }

  data.disabilities.forEach((disability) => {
    const score = calculateMatchScore(
      normalizedSearchTerm,
      disability,
      data.synonymDictionary
    );

    if (score > 0 && !seen.has(disability.id)) {
      seen.add(disability.id);
      results.push({
        ...disability,
        matchScore: score,
      });
    }
  });

  // Sort by match score (highest first)
  return results.sort((a, b) => b.matchScore - a.matchScore);
};

/**
 * Calculate match score based on multiple criteria
 */
const calculateMatchScore = (searchTerm, disability, synonymDictionary) => {
  let score = 0;

  // 1. Exact diagnostic code match (highest priority)
  if (disability.diagnosticCode === searchTerm) {
    score += 100;
  }

  // 2. Condition name exact match
  if (normalizeSearchTerm(disability.conditionName) === searchTerm) {
    score += 90;
  }

  // 3. Condition name contains search term
  if (normalizeSearchTerm(disability.conditionName).includes(searchTerm)) {
    score += 70;
  }

  // 4. Alias exact or partial match
  if (disability.aliases && Array.isArray(disability.aliases)) {
    disability.aliases.forEach((alias) => {
      const normalizedAlias = normalizeSearchTerm(alias);
      if (normalizedAlias === searchTerm) {
        score += 85;
      } else if (normalizedAlias.includes(searchTerm)) {
        score += 60;
      }
    });
  }

  // 5. Search terms exact or partial match
  if (disability.searchTerms && Array.isArray(disability.searchTerms)) {
    disability.searchTerms.forEach((term) => {
      const normalizedTerm = normalizeSearchTerm(term);
      if (normalizedTerm === searchTerm) {
        score += 80;
      } else if (normalizedTerm.includes(searchTerm)) {
        score += 55;
      } else if (fuzzyMatch(searchTerm, term, 0.75)) {
        score += 40;
      }
    });
  }

  // 6. Synonym dictionary matching
  if (synonymDictionary) {
    Object.entries(synonymDictionary).forEach(([keyword, synonyms]) => {
      if (Array.isArray(synonyms)) {
        synonyms.forEach((synonym) => {
          const normalizedSynonym = normalizeSearchTerm(synonym);
          if (normalizedSynonym === searchTerm || normalizedSynonym.includes(searchTerm)) {
            // Check if this disability is related to this keyword
            const disabilityTerms = [
              ...disability.aliases,
              ...disability.searchTerms,
              disability.conditionName,
            ]
              .map(normalizeSearchTerm)
              .join(' ');

            if (disabilityTerms.includes(keyword.toLowerCase())) {
              score += 50;
            }
          }
        });
      }
    });
  }

  // 7. Fuzzy match on condition name (lowest priority)
  if (fuzzyMatch(searchTerm, disability.conditionName, 0.7)) {
    score += 30;
  }

  return score;
};

/**
 * Get suggestions/autocomplete options
 */
export const getSearchSuggestions = (searchTerm, data, limit = 10) => {
  if (!searchTerm || searchTerm.length < 2) return [];

  const normalized = normalizeSearchTerm(searchTerm);
  const suggestions = new Set();

  if (!data || !data.disabilities) return [];

  // Add condition names
  data.disabilities.forEach((disability) => {
    if (normalizeSearchTerm(disability.conditionName).includes(normalized)) {
      suggestions.add(disability.conditionName);
    }
    if (disability.aliases) {
      disability.aliases.forEach((alias) => {
        if (normalizeSearchTerm(alias).includes(normalized)) {
          suggestions.add(alias);
        }
      });
    }
  });

  // Add from synonym dictionary
  if (data.synonymDictionary) {
    Object.entries(data.synonymDictionary).forEach(([keyword, synonyms]) => {
      if (normalizeSearchTerm(keyword).includes(normalized)) {
        suggestions.add(keyword);
      }
      if (Array.isArray(synonyms)) {
        synonyms.forEach((syn) => {
          if (normalizeSearchTerm(syn).includes(normalized)) {
            suggestions.add(syn);
          }
        });
      }
    });
  }

  return Array.from(suggestions).slice(0, limit);
};

/**
 * Validate search term for security
 * Allows all standard medical/anatomical terminology
 */
export const validateSearchTerm = (term) => {
  if (typeof term !== 'string') return false;
  if (term.length === 0) return false;
  if (term.length > 150) return false; // Increased limit for longer medical terms
  
  // Allow alphanumeric, spaces, hyphens, slashes, parentheses, periods, commas, ampersands, and apostrophes
  // This supports all legitimate medical terminology including anatomical terms
  return /^[a-zA-Z0-9\s\-\/().,&']*$/.test(term);
};
