/**
 * VA.gov Rating Parser
 * Parses rating data copied directly from va.gov/disability/view-disability-rating/rating
 *
 * Handles full page copy (CTRL+A, CTRL+C, CTRL+V) including:
 * - Combined disability rating
 * - Service-connected ratings with percentages
 * - Non-service-connected conditions (parsed separately)
 * - Effective dates
 * - Website navigation/chrome (automatically filtered out)
 *
 * Expected format:
 * "Your combined disability rating is 80%"
 * "20% rating for radiculopathy, left lower extremity (femoral)"
 * "Effective date: September 15, 2023"
 *
 * Also handles simpler formats:
 * "PTSD 50%"
 * "Tinnitus - 10%"
 */

import { formatLocalDate } from "./dateUtils";

/**
 * Parse a block of text from VA.gov ratings page
 * @param {string} text - Raw text pasted from VA.gov (full page or partial)
 * @returns {Object} Object with combinedRating, serviceConnected, notServiceConnected arrays
 */
function _parseServiceConnectedSection(text) {
  const serviceConnectedMatch = text.match(
    // eslint-disable-next-line sonarjs/regex-complexity -- input is text the user pasted from their own VA.gov page (bounded, not attacker-controlled); a rewrite of this section-boundary matcher risks silently changing what counts as the "service-connected" block
    /Service-connected\s+ratings?(.*?)(?:Conditions?\s+VA\s+determined\s+aren't\s+service-connected|Learn\s+about\s+VA\s+disability|Need\s+help\?|$)/is,
  );

  const serviceConnected = [];
  if (!serviceConnectedMatch || !serviceConnectedMatch[1])
    return serviceConnected;

  const serviceConnectedText = serviceConnectedMatch[1];

  // Find all rating patterns: "X% rating for [condition]"
  // Improved regex to handle newlines and effective dates better
  // eslint-disable-next-line sonarjs/slow-regex -- input is user-pasted VA.gov text (bounded), and the lookahead prevents runaway matches
  const ratingPattern = /(\d+)%\s+rating\s+for\s+([^\n\r]+?)(?=\s*\n|$)/gi;
  let match;

  while ((match = ratingPattern.exec(serviceConnectedText)) !== null) {
    const rating = parseInt(match[1], 10);
    let condition = match[2].trim();

    // Clean up condition name - remove any trailing punctuation or dates
    condition = condition
      // eslint-disable-next-line sonarjs/slow-regex -- input is a single already-extracted condition line (a few dozen chars), not attacker-controlled length
      .replace(/\s*Effective\s+date:.*$/i, "") // Remove effective date if captured
      .replace(/\(previously rated as .+?\)/gi, "") // Remove "previously rated as" text
      .replace(/\(claimed as .+?\)/gi, "") // Remove "claimed as" text
      .trim();

    // Skip if condition name is empty or too short
    if (!condition || condition.length < 2) {
      continue;
    }

    // Try to find effective date on the next line
    const effectiveDateMatch = serviceConnectedText
      .substring(
        match.index + match[0].length,
        match.index + match[0].length + 200,
      )
      .match(/Effective\s+date:\s*([^\n]+)/i);
    const effectiveDate = effectiveDateMatch
      ? parseDate(effectiveDateMatch[1].trim())
      : null;

    serviceConnected.push({
      rating,
      condition,
      effectiveDate,
      rawLine: match[0],
    });
  }

  return serviceConnected;
}

function _parseNotServiceConnectedSection(text) {
  const notServiceConnectedMatch = text.match(
    /Conditions?\s+VA\s+determined\s+aren't\s+service-connected(.*?)(?:Learn\s+about\s+VA\s+disability|Need\s+help\?|Feedback|Veteran\s+programs|$)/is,
  );

  const notServiceConnected = [];
  if (!notServiceConnectedMatch || !notServiceConnectedMatch[1])
    return notServiceConnected;

  const lines = notServiceConnectedMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      // Filter out empty lines and navigation/chrome
      if (line.length < 3 || line.length > 200) return false;
      if (isNavigationOrChrome(line)) return false;
      return true;
    });

  lines.forEach((line) => {
    if (line) {
      notServiceConnected.push({
        rating: null,
        condition: line,
        effectiveDate: null,
        serviceConnected: false,
        rawLine: line,
      });
    }
  });

  return notServiceConnected;
}

export function parseVAGovRatings(text) {
  if (!text || typeof text !== "string") {
    return {
      combinedRating: null,
      serviceConnected: [],
      notServiceConnected: [],
    };
  }

  // Extract combined rating directly from text
  const combinedRating = extractCombinedRating(text);
  const serviceConnected = _parseServiceConnectedSection(text);
  const notServiceConnected = _parseNotServiceConnectedSection(text);

  // eslint-disable-next-line no-console
  console.log("Parser: Combined rating:", combinedRating);
  // eslint-disable-next-line no-console
  console.log("Parser: Service-connected found:", serviceConnected.length);
  // eslint-disable-next-line no-console
  console.log(
    "Parser: Not service-connected found:",
    notServiceConnected.length,
  );

  return {
    combinedRating,
    serviceConnected,
    notServiceConnected,
  };
}

/**
 * Extract combined disability rating from text
 * @param {string} text - Full text from VA.gov
 * @returns {number|null} Combined rating percentage or null
 */
function extractCombinedRating(text) {
  const match = text.match(
    /Your\s+combined\s+disability\s+rating\s+is\s+(\d+)%/i,
  );
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Check if a line is website navigation or chrome (should be filtered out)
 * @param {string} line - Line of text
 * @returns {boolean} True if line is navigation/chrome
 */
function isNavigationOrChrome(line) {
  const chromePatterns = [
    /^Skip\s+to\s+Content/i,
    /^U\.S\.\s+flag/i,
    /^An\s+official\s+website/i,
    /^Here's\s+how\s+you\s+know/i,
    /^Talk\s+to\s+the\s+Veterans\s+Crisis\s+Line/i,
    /^VA\s+logo/i,
    /^Search$/i,
    /^Contact\s+us$/i,
    /^About\s+VA$/i,
    /^Find\s+a\s+VA\s+Location/i,
    /^My\s+(VA|HealtheVet)$/i,
    /^VA\.gov\s+home/i,
    /^Disability\s+benefits$/i,
    /^View\s+your\s+VA\s+disability\s+rating/i,
    /^Your\s+VA\s+disability\s+rating$/i,
    /^View\s+your\s+VA\s+disability\s+ratings?$/i,
    /^On\s+this\s+page$/i,
    /^Your\s+individual\s+ratings$/i,
    /^Your\s+combined\s+disability\s+rating$/i,
    /^This\s+rating\s+doesn't\s+include/i,
    /^Check\s+the\s+status/i,
    /^VA\s+Benefits\s+and\s+Health\s+Care$/i,
    /^\d{3}-\d{3}-\d{4}$/i, // Phone numbers
    /^800-\d{3}-\d{4}$/i,
    /^TTY:/i,
    /^Facebook|Instagram|Twitter|YouTube|Flickr|^X$/i,
    /^Get\s+VA\s+updates/i,
    /^VA\s+news/i,
    /^Press\s+releases/i,
    /^Email\s+updates/i,
    /^All\s+VA\s+social\s+media/i,
    /^In\s+crisis\?/i,
    /^Get\s+answers$/i,
    /^Resources\s+and\s+support/i,
    /^Call\s+us$/i,
    /^Visit\s+a\s+medical\s+center/i,
    /^Language\s+assistance/i,
    /^(?:Español|Tagalog|Other\s+languages)/i,
    /^508\s+compliance/i,
    /^Civil\s+Rights/i,
    /^Freedom\s+of\s+Information/i,
    /^FOIA/i,
    /^Harassment/i,
    /^Office\s+of\s+Inspector\s+General/i,
    /^Plain\s+language/i,
    /^Privacy,?\s+policies/i,
    /^VA\s+Privacy\s+Service/i,
    /^No\s+FEAR\s+Act/i,
    /^USA\.gov/i,
    /^VA\s+performance/i,
    /^Veterans\s+Portrait\s+Project/i,
    /^Veteran\s+programs\s+and\s+services/i,
    /^Homeless\s+Veterans/i,
    /^Women\s+Veterans/i,
    /^Minority\s+Veterans/i,
    /^PTSD$/i,
    /^Mental\s+health/i,
    /^Adaptive\s+sports/i,
    /^Small\s+business/i,
    /^VA\s+outreach/i,
    /^National\s+Resource\s+Directory/i,
    /^More\s+VA\s+resources/i,
    /^VA\s+forms/i,
    /^VA\s+health\s+care/i,
    /^Get\s+help\s+from\s+an\s+accredited/i,
    /^VA\s+mobile\s+apps/i,
    /^State\s+Veterans\s+Affairs/i,
    /^Doing\s+business\s+with\s+VA/i,
    /^Careers\s+at\s+VA/i,
    /^Your\s+VA\s+welcome\s+kit/i,
    /^Feedback$/i,
  ];

  return chromePatterns.some((pattern) => pattern.test(line));
}

/**
 * Parse date string from VA.gov format
 * @param {string} dateStr - Date string like "September 15, 2023"
 * @returns {string|null} ISO date string or null
 */
function parseDate(dateStr) {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString().split("T")[0]; // Return YYYY-MM-DD format
  } catch (e) {
    console.warn("[vaGovRatingParser] Failed to parse date:", dateStr, e);
    return null;
  }
}

/**
 * Validate and clean parsed ratings
 * @param {Array} ratings - Array of parsed ratings
 * @returns {Array} Cleaned and validated ratings
 */
export function validateParsedRatings(ratings) {
  return ratings
    .filter((r) => {
      // Must have a condition name
      if (!r.condition || r.condition.length < 2) {
        return false;
      }

      // If rating is present, must be valid (0-100)
      if (r.rating !== null && (r.rating < 0 || r.rating > 100)) {
        return false;
      }

      return true;
    })
    .map((r) => ({
      ...r,
      // Clean up condition name
      condition: r.condition
        .replace(/\s+/g, " ")
        .replace(/\(previously rated as .+?\)/gi, "") // Remove "previously rated as" text
        .replace(/\(claimed as .+?\)/gi, "") // Remove "claimed as" text
        .trim(),
    }));
}

/**
 * Format parsed ratings for display
 * @param {Object} parseResult - Result from parseVAGovRatings with combinedRating, serviceConnected, notServiceConnected
 * @returns {string} Formatted text summary
 */
export function formatParsedRatings(parseResult) {
  // Handle legacy array format for backwards compatibility
  if (Array.isArray(parseResult)) {
    const ratings = parseResult;
    if (ratings.length === 0) {
      return "No ratings found in pasted text.";
    }

    let text = `Found ${ratings.length} rating${ratings.length === 1 ? "" : "s"}:\n\n`;

    ratings.forEach((r, i) => {
      text += `${i + 1}. ${r.condition}`;
      if (r.rating !== null) {
        text += ` - ${r.rating}%`;
      } else {
        text += ` - (No rating found, please set manually)`;
      }
      if (r.effectiveDate) {
        text += ` (Effective: ${formatLocalDate(r.effectiveDate).toLocaleDateString()})`;
      }
      text += "\n";
    });

    return text;
  }

  // New object format
  const { combinedRating, serviceConnected, notServiceConnected } = parseResult;

  if (serviceConnected.length === 0 && notServiceConnected.length === 0) {
    return "No ratings found in pasted text.";
  }

  let text = "";

  // Show combined rating if found
  if (combinedRating !== null) {
    text += `✓ Combined VA Disability Rating: ${combinedRating}%\n\n`;
  }

  // Show service-connected ratings
  if (serviceConnected.length > 0) {
    text += `Found ${serviceConnected.length} service-connected rating${serviceConnected.length === 1 ? "" : "s"}:\n\n`;

    serviceConnected.forEach((r, i) => {
      text += `${i + 1}. ${r.condition}`;
      if (r.rating !== null) {
        text += ` - ${r.rating}%`;
      }
      if (r.effectiveDate) {
        text += ` (Effective: ${formatLocalDate(r.effectiveDate).toLocaleDateString()})`;
      }
      text += "\n";
    });
  }

  // Show non-service-connected conditions
  if (notServiceConnected.length > 0) {
    if (serviceConnected.length > 0) {
      text += "\n";
    }
    text += `Found ${notServiceConnected.length} non-service-connected condition${notServiceConnected.length === 1 ? "" : "s"}:\n`;
    text += "(These will not be imported as they have no rating)\n\n";

    notServiceConnected.forEach((r, i) => {
      text += `${i + 1}. ${r.condition}\n`;
    });
  }

  return text;
}

/**
 * Example usage and test data
 */
export const EXAMPLE_VA_GOV_TEXT = `Your combined disability rating is 80%

Service-connected ratings
20% rating for radiculopathy, left lower extremity (femoral)
Effective date: September 15, 2023
20% rating for lumbosacral strain, degenerative disc disease other than intervertebral disc syndrome, Intervertebral disc syndrome, thoracic degenerative arthritis, lumbar and thoracic spine scoliosis (previously rated as lumbago)
Effective date: September 15, 2023
0% rating for right hip limited extension
Effective date: September 15, 2023
10% rating for left hip limited adduction
Effective date: September 15, 2023
10% rating for right hip limited adduction
Effective date: September 15, 2023
0% rating for Iliotibial band syndrome Greater trochanteric pain syndrome (not bursitis), left hip
Effective date: September 15, 2023
0% rating for Reactive airway disease (claimed as lung condition and shortness of breath)
Effective date: September 15, 2023
0% rating for left hip limited extension
Effective date: September 15, 2023
0% rating for Iliotibial band syndrome Greater trochanteric pain syndrome (not bursitis), right hip
Effective date: September 15, 2023
10% rating for radiculopathy, right lower extremity (femoral)
Effective date: March 31, 2023
50% rating for post-traumatic stress disorder
Effective date: March 31, 2023
10% rating for tinnitus
Effective date: March 31, 2023
0% rating for rhinitis
Effective date: August 10, 2022

Conditions VA determined aren't service-connected
adjustment disorder with anxiety and anxious mood
sleep disorder
occupational problem
bilateral hearing loss
secondary insomnia
sinusitis
Lipoma, left scalp (claimed as sebaceous cyst (back of head)`;
