/**
 * Vet-Rate.org - DD214 Text Parser
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * PURPOSE: Parse raw OCR text from DD214/NGB22 into structured data
 *
 * FIELD LOCATIONS ON DD214:
 * - Block 1: Name (Last, First, Middle)
 * - Block 2: Department/Component/Branch
 * - Block 3: Social Security Number
 * - Block 4a: Grade/Rank/Rate
 * - Block 4b: Pay Grade
 * - Block 5: Primary MOS/Specialty
 * - Block 11: Primary Specialty (Full Title)
 * - Block 12a: Entry Date
 * - Block 12b: Separation Date
 * - Block 13: Decorations, Medals, Badges, Citations
 * - Block 18: Remarks (Overflow for awards, additional info)
 * - Block 24: Character of Service
 * - Block 25: Separation Authority
 * - Block 26: Separation Code (SPN Code)
 * - Block 27: Reentry Code
 * - Block 28: Narrative Reason for Separation
 *
 * PRIVACY NOTE: This runs 100% client-side. PII is extracted for
 * the veteran's own use and can be redacted before display.
 */

/**
 * Main parser function - extracts DD214 fields from raw OCR text
 *
 * @param {string} rawText - Raw OCR text from Florence-2
 * @returns {Object} Structured DD214 data
 */
export function parseDD214Text(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { error: "No text provided", fields: {} };
  }

  // Normalize text (handle OCR quirks)
  const text = normalizeOcrText(rawText);

  // Debug: Log first 1000 chars of normalized text
  // eslint-disable-next-line no-console
  console.log("🔍 [DD214Parser] Input text length:", rawText.length);
  // eslint-disable-next-line no-console
  console.log(
    "🔍 [DD214Parser] Normalized text (first 1000 chars):",
    text.substring(0, 1000),
  );

  const fields = {};
  const confidence = {};
  const extractionNotes = [];

  // === PERSONAL INFORMATION ===

  // Name (Block 1)
  const nameResult = extractName(text);
  fields.name = nameResult.value;
  fields.lastName = nameResult.lastName;
  fields.firstName = nameResult.firstName;
  fields.middleName = nameResult.middleName;
  confidence.name = nameResult.confidence;

  // SSN (Block 3) - SENSITIVE
  const ssnResult = extractSSN(text);
  fields.ssn = ssnResult.value;
  fields.ssnMasked = ssnResult.masked;
  confidence.ssn = ssnResult.confidence;

  // Service Number (older DD214s)
  const serviceNumResult = extractServiceNumber(text);
  fields.serviceNumber = serviceNumResult.value;
  confidence.serviceNumber = serviceNumResult.confidence;

  // === MILITARY SERVICE INFO ===

  // Branch (Block 2)
  const branchResult = extractBranch(text);
  fields.branch = branchResult.value;
  fields.component = branchResult.component;
  confidence.branch = branchResult.confidence;

  // Rank/Grade (Block 4a/4b)
  const rankResult = extractRank(text);
  fields.rank = rankResult.value;
  fields.payGrade = rankResult.payGrade;
  confidence.rank = rankResult.confidence;

  // MOS (Block 4b/5/11)
  const mosResult = extractMOS(text);
  fields.mos = mosResult.value;
  fields.mosTitle = mosResult.title;
  confidence.mos = mosResult.confidence;

  // === DATES ===

  // Entry Date (Block 12a)
  const entryDateResult = extractDate(text, "entry|enlist|active|ead");
  fields.entryDate = entryDateResult.value;
  fields.entryDateFormatted = entryDateResult.formatted;
  confidence.entryDate = entryDateResult.confidence;

  // Separation Date (Block 12b)
  const sepDateResult = extractDate(text, "separat|discharg|release|ets|dos");
  fields.separationDate = sepDateResult.value;
  fields.separationDateFormatted = sepDateResult.formatted;
  confidence.separationDate = sepDateResult.confidence;

  // Calculate service length
  if (fields.entryDate && fields.separationDate) {
    const serviceLength = calculateServiceLength(
      fields.entryDate,
      fields.separationDate,
    );
    fields.yearsService = serviceLength.years;
    fields.monthsService = serviceLength.months;
    fields.daysService = serviceLength.days;
    fields.totalMonthsService = serviceLength.totalMonths;
  }

  // === DISCHARGE INFO ===

  // Character of Service (Block 24)
  const characterResult = extractCharacterOfService(text);
  fields.characterOfService = characterResult.value;
  confidence.characterOfService = characterResult.confidence;

  // Separation Code (Block 26)
  const sepCodeResult = extractSeparationCode(text);
  fields.separationCode = sepCodeResult.value;
  fields.separationCodeMeaning = sepCodeResult.meaning;
  confidence.separationCode = sepCodeResult.confidence;

  // Reentry Code (Block 27)
  const reentryResult = extractReentryCode(text);
  fields.reentryCode = reentryResult.value;
  fields.reentryCodeMeaning = reentryResult.meaning;
  confidence.reentryCode = reentryResult.confidence;

  // Narrative Reason (Block 28)
  const narrativeResult = extractNarrativeReason(text);
  fields.narrativeReason = narrativeResult.value;
  confidence.narrativeReason = narrativeResult.confidence;

  // === AWARDS AND DECORATIONS ===

  // Extract from Block 13 and Block 18 (Remarks)
  const awardsResult = extractAwards(text);
  fields.awards = awardsResult.awards;
  fields.awardCount = awardsResult.awards.length;
  fields.hasCombatAwards = awardsResult.hasCombatAwards;
  confidence.awards = awardsResult.confidence;

  // === COMBAT INDICATORS ===
  const combatResult = detectCombatService(text, fields.awards);
  fields.combatService = combatResult;

  // === FOREIGN SERVICE ===
  const foreignResult = detectForeignService(text);
  fields.foreignService = foreignResult.detected;
  fields.foreignServiceLocations = foreignResult.locations;

  // === DOCUMENT TYPE DETECTION ===
  fields.documentType = detectDocumentType(text);

  // === OVERALL CONFIDENCE ===
  const confidenceValues = Object.values(confidence).filter(
    (v) => typeof v === "number",
  );
  fields.overallConfidence =
    confidenceValues.length > 0
      ? Math.round(
          confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length,
        )
      : 0;

  return {
    fields: normalizeParsedFields(fields),
    confidence,
    extractionNotes,
    rawTextLength: text.length,
    documentType: fields.documentType,
  };
}

// === HELPER FUNCTIONS ===

// Every field a consumer may read off parsedData.fields — guarantees
// present-or-null so missing extractions never propagate `undefined`
const PARSED_FIELD_KEYS = [
  "name",
  "lastName",
  "firstName",
  "middleName",
  "ssn",
  "ssnMasked",
  "serviceNumber",
  "branch",
  "component",
  "rank",
  "payGrade",
  "mos",
  "mosTitle",
  "entryDate",
  "entryDateFormatted",
  "separationDate",
  "separationDateFormatted",
  "yearsService",
  "monthsService",
  "daysService",
  "totalMonthsService",
  "characterOfService",
  "separationCode",
  "separationCodeMeaning",
  "reentryCode",
  "reentryCodeMeaning",
  "narrativeReason",
  "hasCombatAwards",
  "foreignService",
  "documentType",
];

function normalizeParsedFields(fields) {
  for (const key of PARSED_FIELD_KEYS) {
    if (fields[key] === undefined) {
      fields[key] = null;
    }
  }
  if (!Array.isArray(fields.awards)) {
    fields.awards = [];
  }
  if (!Array.isArray(fields.foreignServiceLocations)) {
    fields.foreignServiceLocations = [];
  }
  if (!fields.combatService || typeof fields.combatService !== "object") {
    fields.combatService = { hasVerifiedCombat: false, indicators: [] };
  }
  if (typeof fields.awardCount !== "number") {
    fields.awardCount = fields.awards.length;
  }
  if (typeof fields.overallConfidence !== "number") {
    fields.overallConfidence = 0;
  }
  return fields;
}

/**
 * Normalize OCR text - handle common recognition errors
 */
function normalizeOcrText(text) {
  return (
    text
      // Normalize whitespace
      .replace(/[\r\n]+/g, "\n")
      .replace(/[ \t]+/g, " ")
      // Common OCR errors
      .replace(/[0O](?=\d{2}-\d{2}-\d{4})/g, "0") // O -> 0 before dates
      .replace(/l(?=\d)/g, "1") // l -> 1 before numbers
      .replace(/I(?=\d)/g, "1") // I -> 1 before numbers
      .trim()
  );
}

/**
 * Extract name from DD214 text
 */
function extractName(text) {
  // Debug: log what we're searching
  // eslint-disable-next-line no-console
  console.log("🔍 [DD214Parser:Name] Searching for name patterns...");

  // Pattern: "NAME (Last, First, Middle): JOHNSON, JOHN WILLIAM"
  // Also handle Florence-2 output which may have different formatting
  const patterns = [
    // Standard DD214 format
    /name\s*\(?last[,\s]*first[,\s]*middle\)?[:\s]+([A-Z][A-Z\-']+),\s*([A-Z][A-Z\-']+)(?:\s+([A-Z][A-Z\-']*))?/i,
    // Numbered block format
    /1\.\s*name[:\s]+([A-Z][A-Z\-']+),\s*([A-Z][A-Z\-']+)(?:\s+([A-Z][A-Z\-']*))?/i,
    // Name followed by SSN or digits
    /([A-Z]{2,}),\s+([A-Z]{2,})(?:\s+([A-Z]{2,}))?(?=\s*\d|\s*ssn|\s*social)/i,
    // Florence-2 may output: "JOHNSON JOHN WILLIAM" or "LAST: JOHNSON FIRST: JOHN"
    /last\s*name?\s*[:-]?\s*([A-Z][A-Za-z\-']+)\s+first\s*name?\s*[:-]?\s*([A-Za-z\-']+)/i,
    // Just look for LASTNAME, FIRSTNAME pattern anywhere
    /\b([A-Z][A-Z]+),\s*([A-Z][A-Za-z]+)(?:\s+([A-Z][A-Za-z]*))?(?=\s|$|\d|,)/,
    // Veterans name format - flexible
    /(?:member|veteran|service\s*member)['']?s?\s*name[:\s]+([A-Z][A-Za-z\-']+),?\s*([A-Za-z\-']+)/i,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = text.match(pattern);
    if (match) {
      // eslint-disable-next-line no-console
      console.log(
        `🔍 [DD214Parser:Name] Pattern ${i} matched:`,
        match[0].substring(0, 100),
      );
      return {
        value: match[0]
          .replace(/name[^:]*:\s*/i, "")
          .replace(/^(last|first|member|veteran)[\s:]+/i, "")
          .trim(),
        lastName: match[1]?.trim() || null,
        firstName: match[2]?.trim() || null,
        middleName: match[3]?.trim() || null,
        confidence: 85,
      };
    }
  }

  // eslint-disable-next-line no-console
  console.log("🔍 [DD214Parser:Name] No patterns matched");
  return {
    value: null,
    lastName: null,
    firstName: null,
    middleName: null,
    confidence: 0,
  };
}

/**
 * Extract SSN (sensitive - provide masked option)
 */
function extractSSN(text) {
  // Pattern: XXX-XX-XXXX or XXXXXXXXX
  const patterns = [
    /ssn[:\s#]*(\d{3})-?(\d{2})-?(\d{4})/i,
    /social\s*security[:\s#]*(\d{3})-?(\d{2})-?(\d{4})/i,
    /(?:^|\s)(\d{3})-(\d{2})-(\d{4})(?:\s|$)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const full = `${match[1]}-${match[2]}-${match[3]}`;
      return {
        value: full,
        masked: `***-**-${match[3]}`,
        confidence: 90,
      };
    }
  }

  return { value: null, masked: null, confidence: 0 };
}

/**
 * Extract service number (older DD214s, pre-SSN era)
 */
function extractServiceNumber(text) {
  // Patterns vary by branch: RA12345678 (Army), etc.
  const patterns = [
    /service\s*(?:no|num|number)[:\s#]*([A-Z]{1,2}\s?\d{6,8})/i,
    /(?:ser|svc)\s*(?:no|#)[:\s]*([A-Z]{1,2}\s?\d{6,8})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return { value: match[1].replace(/\s/g, ""), confidence: 80 };
    }
  }

  return { value: null, confidence: 0 };
}

/**
 * Extract branch of service
 */
function extractBranch(text) {
  const branches = {
    ARMY: {
      name: "Army",
      components: ["Active Army", "Army Reserve", "Army National Guard"],
    },
    NAVY: { name: "Navy", components: ["Active Navy", "Navy Reserve"] },
    "AIR FORCE": {
      name: "Air Force",
      components: [
        "Active Air Force",
        "Air Force Reserve",
        "Air National Guard",
      ],
    },
    MARINE: {
      name: "Marine Corps",
      components: ["Active Marine Corps", "Marine Corps Reserve"],
    },
    "COAST GUARD": {
      name: "Coast Guard",
      components: ["Active Coast Guard", "Coast Guard Reserve"],
    },
    "SPACE FORCE": { name: "Space Force", components: ["Active Space Force"] },
  };

  // Also check for abbreviated/variations
  const branchAliases = {
    "US ARMY": "ARMY",
    "U.S. ARMY": "ARMY",
    "UNITED STATES ARMY": "ARMY",
    USMC: "MARINE",
    "US MARINE": "MARINE",
    USAF: "AIR FORCE",
    "US AIR FORCE": "AIR FORCE",
    USN: "NAVY",
    "US NAVY": "NAVY",
    USCG: "COAST GUARD",
    USSF: "SPACE FORCE",
  };

  const textUpper = text.toUpperCase();

  // Check aliases first
  for (const [alias, branchKey] of Object.entries(branchAliases)) {
    if (textUpper.includes(alias)) {
      const value = branches[branchKey];
      let component = "Active";
      if (
        textUpper.includes("RESERVE") ||
        textUpper.includes("USAR") ||
        textUpper.includes("USNR")
      ) {
        component = "Reserve";
      } else if (
        textUpper.includes("NATIONAL GUARD") ||
        textUpper.includes("ARNG") ||
        textUpper.includes("ANG")
      ) {
        component = "National Guard";
      }
      // eslint-disable-next-line no-console
      console.log(
        `🔍 [DD214Parser:Branch] Found via alias "${alias}":`,
        value.name,
      );
      return { value: value.name, component, confidence: 90 };
    }
  }

  for (const [key, value] of Object.entries(branches)) {
    if (textUpper.includes(key)) {
      // Try to detect component
      let component = "Active";
      if (
        textUpper.includes("RESERVE") ||
        textUpper.includes("USAR") ||
        textUpper.includes("USNR")
      ) {
        component = "Reserve";
      } else if (
        textUpper.includes("NATIONAL GUARD") ||
        textUpper.includes("ARNG") ||
        textUpper.includes("ANG")
      ) {
        component = "National Guard";
      }

      // eslint-disable-next-line no-console
      console.log(`🔍 [DD214Parser:Branch] Found:`, value.name);
      return {
        value: value.name,
        component,
        confidence: 90,
      };
    }
  }

  // eslint-disable-next-line no-console
  console.log("🔍 [DD214Parser:Branch] No branch found");
  return { value: null, component: null, confidence: 0 };
}

/**
 * Extract rank and pay grade
 */
function extractRank(text) {
  // Common pay grades
  const payGradePattern = /(?:pay\s*grade|grade)[:\s]*([EWO]-?\d{1,2})/i;
  const payMatch = text.match(payGradePattern);

  // Enlisted ranks
  const enlistedRanks = [
    "PVT",
    "PV2",
    "PFC",
    "SPC",
    "CPL",
    "SGT",
    "SSG",
    "SFC",
    "MSG",
    "1SG",
    "SGM",
    "CSM",
    "SR",
    "SA",
    "SN",
    "PO3",
    "PO2",
    "PO1",
    "CPO",
    "SCPO",
    "MCPO",
    "AB",
    "AMN",
    "A1C",
    "SRA",
    "SSGT",
    "TSGT",
    "MSGT",
    "SMSGT",
    "CMSGT",
    "PVT",
    "LCPL",
    "CPL",
    "SGT",
    "SSGT",
    "GYSGT",
    "MSGT",
    "MGYSGT",
    "SGTMAJ",
  ];

  // Officer ranks
  const officerRanks = [
    "2LT",
    "1LT",
    "CPT",
    "MAJ",
    "LTC",
    "COL",
    "BG",
    "MG",
    "LTG",
    "GEN",
    "ENS",
    "LTJG",
    "LT",
    "LCDR",
    "CDR",
    "CAPT",
    "RADM",
    "VADM",
    "ADM",
  ];

  const allRanks = [...enlistedRanks, ...officerRanks];
  const rankPattern = new RegExp(
    `(?:rank|grade|rate)[:\\s]*(${allRanks.join("|")})`,
    "i",
  );
  const rankMatch = text.match(rankPattern);

  return {
    value: rankMatch ? rankMatch[1].toUpperCase() : null,
    payGrade: payMatch ? payMatch[1].toUpperCase().replace("-", "") : null,
    confidence: rankMatch ? 85 : payMatch ? 70 : 0,
  };
}

/**
 * Extract MOS/Rating/AFSC
 */
function extractMOS(text) {
  // Army MOS: 11B, 92Y, 68W
  // Navy Rating: BM, ET, HM
  // Air Force AFSC: 2A5X1, 3D0X2
  // Marine MOS: 0311, 0331

  const patterns = [
    // Block 11 - Primary Specialty
    /primary\s*(?:specialty|mos|afsc|rating)[:\s#]*([0-9A-Z]{2,6})\s*[-–]\s*([A-Za-z\s]+)/i,
    // Block 4b/5
    /(?:mos|afsc|rating|specialty)[:\s#]*([0-9]{2}[A-Z]{1,2}[0-9]?)/i,
    // Army format: 11B, 92Y
    /(?:mos|pmos)[:\s#]*([0-9]{2}[A-Z][0-9]?)/i,
    // Air Force AFSC: 2A5X1
    /afsc[:\s#]*([0-9][A-Z][0-9X][0-9X][0-9X]?)/i,
    // Marine: 0311
    /mos[:\s#]*(0[0-9]{3})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        value: match[1].toUpperCase(),
        title: match[2]?.trim() || null,
        confidence: 85,
      };
    }
  }

  return { value: null, title: null, confidence: 0 };
}

/**
 * Extract dates from text
 */
function extractDate(text, context) {
  const contextPattern = new RegExp(
    `(${context})[^\\d]*(\\d{1,2})[\\s\\-\\/](\\d{1,2}|[A-Z]{3})[\\s\\-\\/](\\d{2,4})`,
    "i",
  );
  const match = text.match(contextPattern);

  if (match) {
    let month = match[3];
    let day = match[2];
    let year = match[4];

    // Handle 2-digit year
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    }

    // Handle month names
    const monthNames = {
      JAN: "01",
      FEB: "02",
      MAR: "03",
      APR: "04",
      MAY: "05",
      JUN: "06",
      JUL: "07",
      AUG: "08",
      SEP: "09",
      OCT: "10",
      NOV: "11",
      DEC: "12",
    };
    if (monthNames[month.toUpperCase()]) {
      month = monthNames[month.toUpperCase()];
    }

    const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const formatted = new Date(isoDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return { value: isoDate, formatted, confidence: 80 };
  }

  return { value: null, formatted: null, confidence: 0 };
}

/**
 * Calculate service length
 */
function calculateServiceLength(entryDate, separationDate) {
  const start = new Date(entryDate);
  const end = new Date(separationDate);

  if (isNaN(start) || isNaN(end)) {
    return { years: null, months: null, days: null, totalMonths: null };
  }

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months--;
    days += 30;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const totalMonths = years * 12 + months;

  return { years, months, days, totalMonths };
}

/**
 * Extract character of service
 */
function extractCharacterOfService(text) {
  const characters = [
    "HONORABLE",
    "GENERAL UNDER HONORABLE CONDITIONS",
    "GENERAL",
    "OTHER THAN HONORABLE",
    "BAD CONDUCT",
    "DISHONORABLE",
    "UNCHARACTERIZED",
  ];

  const textUpper = text.toUpperCase();

  for (const character of characters) {
    if (textUpper.includes(character)) {
      return { value: character, confidence: 90 };
    }
  }

  // Check block 24 specifically
  const block24Match = text.match(/24[.:\s]+character[^:]*[:\s]+([A-Z\s]+)/i);
  if (block24Match) {
    return { value: block24Match[1].trim(), confidence: 75 };
  }

  return { value: null, confidence: 0 };
}

/**
 * Extract separation code (SPN code)
 */
function extractSeparationCode(text) {
  // Common separation codes
  const codePattern =
    /(?:separation\s*code|spn\s*code|sep\s*code)[:\s#]*([A-Z]{2,3})/i;
  const match = text.match(codePattern);

  if (match) {
    const code = match[1].toUpperCase();
    const meanings = {
      JBK: "Completion of Required Active Service",
      JBM: "Completion of ROTC Commitment",
      JBN: "Expiration of Enlistment",
      MBK: "Medical - Physical Disability",
      JDA: "Hardship",
      JFT: "Pregnancy",
      KGF: "Misconduct - Drug Abuse",
      KGH: "Misconduct - Commission of Serious Offense",
    };

    return {
      value: code,
      meaning: meanings[code] || "Unknown",
      confidence: 85,
    };
  }

  return { value: null, meaning: null, confidence: 0 };
}

/**
 * Extract reentry code
 */
function extractReentryCode(text) {
  const pattern =
    /(?:reentry|re-entry|reenlist)[^:]*code[:\s#]*([A-Z0-9]{1,3})/i;
  const match = text.match(pattern);

  if (match) {
    const code = match[1].toUpperCase();
    const meanings = {
      "RE-1": "Fully Qualified for Reenlistment",
      "RE-1A": "Fully Qualified for Reenlistment",
      "RE-2": "Qualified but needs waiver",
      "RE-3": "Ineligible without waiver",
      "RE-4": "Ineligible for reenlistment",
      1: "Fully Qualified",
      2: "Needs waiver",
      3: "Ineligible without waiver",
      4: "Ineligible",
    };

    return {
      value: code,
      meaning: meanings[code] || "Unknown",
      confidence: 80,
    };
  }

  return { value: null, meaning: null, confidence: 0 };
}

/**
 * Extract narrative reason for separation
 */
function extractNarrativeReason(text) {
  const pattern =
    /(?:narrative\s*reason|reason\s*for\s*separation)[:\s]+([A-Za-z\s,]+)(?=\s*\d|\s*29|\s*block)/i;
  const match = text.match(pattern);

  if (match) {
    return { value: match[1].trim(), confidence: 75 };
  }

  return { value: null, confidence: 0 };
}

/**
 * Extract awards and decorations from Block 13 and Block 18
 */
function extractAwards(text) {
  // Common military awards
  const awardPatterns = [
    {
      name: "Purple Heart",
      abbrev: "PH",
      combat: true,
      pattern: /purple\s*heart/gi,
    },
    {
      name: "Bronze Star Medal",
      abbrev: "BSM",
      combat: true,
      pattern: /bronze\s*star/gi,
    },
    {
      name: "Silver Star",
      abbrev: "SS",
      combat: true,
      pattern: /silver\s*star/gi,
    },
    {
      name: "Combat Infantryman Badge",
      abbrev: "CIB",
      combat: true,
      pattern: /combat\s*infantry(?:man)?\s*badge|cib/gi,
    },
    {
      name: "Combat Action Badge",
      abbrev: "CAB",
      combat: true,
      pattern: /combat\s*action\s*badge|cab/gi,
    },
    {
      name: "Combat Action Ribbon",
      abbrev: "CAR",
      combat: true,
      pattern: /combat\s*action\s*ribbon|car/gi,
    },
    {
      name: "Army Commendation Medal",
      abbrev: "ARCOM",
      combat: false,
      pattern: /army\s*commendation/gi,
    },
    {
      name: "Army Achievement Medal",
      abbrev: "AAM",
      combat: false,
      pattern: /army\s*achievement/gi,
    },
    {
      name: "Good Conduct Medal",
      abbrev: "GCM",
      combat: false,
      pattern: /good\s*conduct/gi,
    },
    {
      name: "National Defense Service Medal",
      abbrev: "NDSM",
      combat: false,
      pattern: /national\s*defense/gi,
    },
    {
      name: "Global War on Terrorism Service Medal",
      abbrev: "GWOTSM",
      combat: false,
      pattern: /global\s*war.*terrorism.*service/gi,
    },
    {
      name: "Global War on Terrorism Expeditionary Medal",
      abbrev: "GWOTEM",
      combat: true,
      pattern: /global\s*war.*terrorism.*expedition/gi,
    },
    {
      name: "Iraq Campaign Medal",
      abbrev: "ICM",
      combat: true,
      pattern: /iraq\s*campaign/gi,
    },
    {
      name: "Afghanistan Campaign Medal",
      abbrev: "ACM",
      combat: true,
      pattern: /afghanistan\s*campaign/gi,
    },
    {
      name: "Expert Infantryman Badge",
      abbrev: "EIB",
      combat: false,
      pattern: /expert\s*infantry(?:man)?\s*badge|eib/gi,
    },
    {
      name: "Parachutist Badge",
      abbrev: "PARA",
      combat: false,
      pattern: /parachutist|airborne/gi,
    },
    {
      name: "Air Assault Badge",
      abbrev: "AAB",
      combat: false,
      pattern: /air\s*assault/gi,
    },
    {
      name: "Meritorious Service Medal",
      abbrev: "MSM",
      combat: false,
      pattern: /meritorious\s*service/gi,
    },
  ];

  const awards = [];
  let hasCombatAwards = false;

  for (const award of awardPatterns) {
    const matches = text.match(award.pattern);
    if (matches) {
      awards.push({
        name: award.name,
        abbreviation: award.abbrev,
        isCombat: award.combat,
        count: matches.length,
      });
      if (award.combat) {
        hasCombatAwards = true;
      }
    }
  }

  // Look for device indicators (Oak Leaf Clusters, etc.)
  const olcPattern = /(\d+)\s*(?:oak\s*leaf|olc)/gi;
  const olcMatches = text.match(olcPattern);
  if (olcMatches) {
    // Note: Would need to associate with specific awards
  }

  return {
    awards,
    hasCombatAwards,
    confidence: awards.length > 0 ? 80 : 50,
  };
}

/**
 * Detect combat service indicators
 */
function detectCombatService(text, awards) {
  const indicators = [];

  // Combat awards
  if (awards && awards.some((a) => a.isCombat)) {
    indicators.push("Combat Awards Present");
  }

  // Combat zones
  const combatZones = [
    { pattern: /iraq|oif|iraqi\s*freedom/i, name: "Iraq" },
    { pattern: /afghanistan|oef|enduring\s*freedom/i, name: "Afghanistan" },
    { pattern: /vietnam/i, name: "Vietnam" },
    { pattern: /korea|korean/i, name: "Korea" },
    { pattern: /desert\s*(storm|shield)/i, name: "Persian Gulf" },
    { pattern: /syria|inherent\s*resolve/i, name: "Syria/ISIS" },
  ];

  for (const zone of combatZones) {
    if (zone.pattern.test(text)) {
      indicators.push(`Service in ${zone.name}`);
    }
  }

  // Hostile fire/imminent danger pay
  if (/hostile\s*fire|imminent\s*danger|combat\s*zone\s*tax/i.test(text)) {
    indicators.push("Hostile Fire/Imminent Danger Pay");
  }

  return {
    hasVerifiedCombat: indicators.length > 0,
    indicators,
  };
}

/**
 * Detect foreign service locations
 */
function detectForeignService(text) {
  const locations = [];

  const countries = [
    "Germany",
    "Japan",
    "Korea",
    "Italy",
    "United Kingdom",
    "UK",
    "England",
    "Iraq",
    "Afghanistan",
    "Kuwait",
    "Qatar",
    "Saudi Arabia",
    "Bahrain",
    "Philippines",
    "Guam",
    "Hawaii",
    "Alaska",
    "Puerto Rico",
    "Vietnam",
    "Thailand",
    "Okinawa",
    "Diego Garcia",
    "Djibouti",
  ];

  for (const country of countries) {
    if (new RegExp(country, "i").test(text)) {
      locations.push(country);
    }
  }

  return {
    detected: locations.length > 0,
    locations,
  };
}

/**
 * Detect document type
 */
function detectDocumentType(text) {
  const textUpper = text.toUpperCase();

  if (textUpper.includes("DD FORM 214") || textUpper.includes("DD214")) {
    return "DD214";
  }
  if (
    textUpper.includes("NGB FORM 22") ||
    textUpper.includes("NGB22") ||
    textUpper.includes("NATIONAL GUARD")
  ) {
    return "NGB22";
  }
  if (textUpper.includes("DD FORM 256") || textUpper.includes("DD256")) {
    return "DD256";
  }
  if (textUpper.includes("DD FORM 257") || textUpper.includes("DD257")) {
    return "DD257";
  }

  return "Unknown";
}

/**
 * Export for use with existing DD214Analyzer
 */
export default {
  parseDD214Text,
  normalizeOcrText,
  extractName,
  extractSSN,
  extractBranch,
  extractRank,
  extractMOS,
  extractCharacterOfService,
  extractAwards,
  detectCombatService,
};
