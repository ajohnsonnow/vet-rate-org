/**
 * Vet-Rate.org - DD214 Field Extractor (Regex-Based)
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * DIAMOND STANDARD: Deterministic DD214 field extraction using regex patterns.
 * This runs AFTER OCR/text extraction and BEFORE AI analysis.
 * Think of this as a safety net — even if the AI misses something,
 * the regex extractor catches it from the raw text.
 *
 * Handles DD214 format variations across eras:
 * - Modern DD214 (post-2000): Digital/typed, standardized layout
 * - Gulf War era (1990s): Mix of typed and dot-matrix
 * - Vietnam/Cold War era: Typewriter, older block numbering
 * - Pre-Vietnam: DD Form 214 with different block layout
 *
 * Also supports: NGB 22, DD256, DD257, DD215
 *
 * All processing is 100% client-side.
 */

/**
 * All DD214 block field definitions with multiple regex patterns per field.
 * Each pattern is tried in order; first match wins.
 * Patterns handle OCR typos, spacing variations, and era-specific layouts.
 */
const DD214_FIELD_PATTERNS = {
  // ===== BLOCK 1: Name =====
  fullName: {
    block: 1,
    label: "Name",
    patterns: [
      /(?:BLOCK\s*1|BOX\s*1|1\.\s*NAME)[:\s.]*([A-Z][A-Z,.\s'-]+)/i,
      /NAME[:\s]*(?:LAST,?\s*FIRST,?\s*(?:AND\s*)?MIDDLE)[:\s.]*\n?\s*([A-Z][A-Z,.\s'-]+)/i,
      /(?:^|\n)\s*([A-Z]{2,}(?:\s*,\s*[A-Z]{2,}){1,2})\s*(?:\n|$)/m,
    ],
    validate: (val) => val && val.includes(",") && val.length > 4,
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 2: Department, Component, Branch =====
  departmentComponentBranch: {
    block: 2,
    label: "Department/Component/Branch",
    patterns: [
      /(?:BLOCK\s*2|BOX\s*2|2\.\s*DEPARTMENT)[:\s.]*\n?\s*([A-Z/\s]+(?:ARMY|NAVY|AIR\s*FORCE|MARINE|COAST\s*GUARD|SPACE\s*FORCE)[A-Z/\s]*)/i,
      /DEPARTMENT[,\s]*COMPONENT[,\s]*(?:AND\s*)?BRANCH[:\s.]*\n?\s*([A-Z][A-Z/\s]*)/i,
      /((?:ARMY|NAVY|AIR\s*FORCE|MARINES?|COAST\s*GUARD|SPACE\s*FORCE)\s*\/\s*(?:ACTIVE|ARNG|USAR|RESERVE|NATIONAL\s*GUARD|RA|USN|USAF|USMC|USCG))/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim().toUpperCase(),
  },

  // ===== BLOCK 3: SSN =====
  ssn: {
    block: 3,
    label: "Social Security Number",
    patterns: [
      /(?:BLOCK\s*3|BOX\s*3|3\.\s*SOCIAL)[:\s.]*\n?\s*(\d{3}[\s|.-]*\d{2}[\s|.-]*\d{4})/i,
      /(?:SOCIAL\s*SECURITY|SSN|S\.?S\.?N\.?)[:\s#.]*(\d{3}[\s|.-]*\d{2}[\s|.-]*\d{4})/i,
      /(\d{3}[\s|]*\d{2}[\s|]*\d{4})(?:\s|$)/,
    ],
    sensitive: true,
    normalize: (val) => {
      const digits = val.replace(/\D/g, "");
      return digits.length === 9 ? digits : val;
    },
    extractLast4: (val) => {
      const digits = val.replace(/\D/g, "");
      return digits.length >= 4 ? digits.slice(-4) : "";
    },
  },

  // ===== BLOCK 4a: Grade/Rate/Rank =====
  rank: {
    block: "4a",
    label: "Grade/Rate/Rank",
    patterns: [
      /(?:BLOCK\s*4\s*A|BOX\s*4\s*A|4\s*[Aa]\.?\s*(?:GRADE|RANK))[:\s.]*\n?\s*([A-Z0-9]{2,10})/i,
      /(?:GRADE[,\s]*RATE[,\s]*(?:OR\s*)?RANK)[:\s.]*\n?\s*([A-Z]{2,4}\d?)/i,
    ],
    normalize: (val) => val.trim().toUpperCase(),
  },

  // ===== BLOCK 4b: Pay Grade =====
  payGrade: {
    block: "4b",
    label: "Pay Grade",
    patterns: [
      /(?:BLOCK\s*4\s*B|BOX\s*4\s*B|4\s*[Bb]\.?\s*PAY\s*GRADE)[:\s.]*\n?\s*([EWO]-?\d{1,2})/i,
      /PAY\s*GRADE[:\s.]*\n?\s*([EWO]-?\d{1,2})/i,
      /\b([EWO][- ]?\d{1,2})\b/,
    ],
    normalize: (val) => {
      const clean = val.replace(/\s/g, "").toUpperCase();
      // Normalize E1 -> E-1, O3 -> O-3, etc.
      return clean.replace(/^([EWO])(\d)/, "$1-$2");
    },
  },

  // ===== BLOCK 5: Date of Birth =====
  dateOfBirth: {
    block: 5,
    label: "Date of Birth",
    patterns: [
      /(?:BLOCK\s*5|BOX\s*5|5\.\s*DATE\s*OF\s*BIRTH)[:\s.]*\n?\s*(\d{4}\s*\d{2}\s*\d{2}|\d{8}|\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})/i,
      /DATE\s*OF\s*BIRTH[:\s.]*\n?\s*(\d{4}\s*\d{2}\s*\d{2}|\d{8}|\d{2}[/-]\d{2}[/-]\d{4})/i,
    ],
    normalize: (val) => normalizeDate(val),
  },

  // ===== BLOCK 6: Reserve Obligation Termination Date =====
  reserveObligationDate: {
    block: 6,
    label: "Reserve Obligation Termination Date",
    patterns: [
      /(?:BLOCK\s*6|BOX\s*6|6\.\s*RESERVE\s*OBLIG)[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      /RESERVE\s*(?:OBLIG(?:ATION)?|IBLIGATION)\s*(?:TERM(?:INATION)?\.?\s*DATE)?[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeDate(val),
  },

  // ===== BLOCK 7a: Place of Entry into Active Duty =====
  placeOfEntry: {
    block: "7a",
    label: "Place of Entry into Active Duty",
    patterns: [
      /(?:BLOCK\s*7\s*A|BOX\s*7\s*A|7\s*[Aa]\.?\s*PLACE\s*OF\s*ENTRY)[:\s.]*\n?\s*([A-Z][A-Z,.\s]+(?:,\s*[A-Z]{2}))/i,
      /PLACE\s*OF\s*ENTRY\s*(?:INTO\s*(?:ACTIVE\s*)?DUTY)?[:\s.]*\n?\s*([A-Z][A-Z,.\s]+(?:,\s*[A-Z]{2,}))/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 7b: Home of Record =====
  homeOfRecord: {
    block: "7b",
    label: "Home of Record at Time of Entry",
    patterns: [
      /(?:BLOCK\s*7\s*B|BOX\s*7\s*B|7\s*[Bb]\.?\s*HOME\s*OF\s*RECORD)[:\s.]*\n?\s*([\s\S]{10,100}?)(?=\n\s*(?:BLOCK|BOX|8\s*[Aa]|\d+\.))/i,
      /HOME\s*OF\s*RECORD[:\s.]*\n?\s*([\s\S]{10,100}?)(?=\n\s*(?:BLOCK|BOX|8|\d+\.))/i,
    ],
    normalize: (val) => val.replace(/\n/g, ", ").replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 8a: Last Duty Assignment =====
  lastDutyAssignment: {
    block: "8a",
    label: "Last Duty Assignment and Major Command",
    patterns: [
      /(?:BLOCK\s*8\s*A|BOX\s*8\s*A|8\s*[Aa]\.?\s*LAST\s*DUT[YE])[:\s.]*\n?\s*([A-Z0-9][A-Z0-9()\s/,.-]+)/i,
      /LAST\s*DUT[YE]\s*ASSIGNMENT[:\s.]*\n?\s*([A-Z0-9][A-Z0-9()\s/,.-]+)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 8b: Station Where Separated =====
  stationWhereSeparated: {
    block: "8b",
    label: "Station Where Separated",
    patterns: [
      /(?:BLOCK\s*8\s*B|BOX\s*8\s*B|8\s*[Bb]\.?\s*STATION)[:\s.]*\n?\s*([A-Z][A-Z,.\s0-9-]+(?:,\s*[A-Z]{2}))/i,
      /STATION\s*(?:WHERE\s*)?SEPARATED[:\s.]*\n?\s*([A-Z][A-Z,.\s0-9-]+)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 9: Command to Which Transferred =====
  commandTransferredTo: {
    block: 9,
    label: "Command to Which Transferred",
    patterns: [
      /(?:BLOCK\s*9|BOX\s*9|9\.\s*COMMAND)[:\s.]*\n?\s*([A-Z0-9][A-Z0-9()\s/,.-]+)/i,
      /COMMAND\s*(?:TO\s*WHICH\s*)?TRANSFERRED[:\s.]*\n?\s*([A-Z0-9][A-Z0-9()\s/,.-]+)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 10: SGLI Coverage =====
  sglCoverage: {
    block: 10,
    label: "SGLI Coverage Amount",
    patterns: [
      /(?:BLOCK\s*10|BOX\s*10|10\.\s*SGL[I]?\s*COVERAGE)[:\s.]*\n?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
      /SGL[I]?\s*(?:COVERAGE)?[:\s.]*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    ],
    normalize: (val) => val.replace(/\s/g, ""),
  },

  // ===== BLOCK 11: Primary Specialty (MOS) =====
  primarySpecialty: {
    block: 11,
    label: "Primary Specialty (MOS/AFSC/Rating)",
    patterns: [
      /(?:BLOCK\s*11|BOX\s*11|11\.\s*PRIMARY\s*SPECIALTY)[:\s.]*\n?\s*([A-Z0-9][A-Z0-9\s/,.-]+?)(?=\/\/|NOTHING\s*FOLLOWS|\n\s*(?:BLOCK|BOX|12))/i,
      /PRIMARY\s*SPECIALTY[:\s.]*\n?\s*([A-Z0-9][A-Z0-9\s/,.-]+?)(?=\/\/|NOTHING\s*FOLLOWS|\n)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
    extractMOS: (val) => {
      // Extract MOS code like 92Y10, 11B30, 68W10
      const mosMatch = val.match(/\b(\d{2}[A-Z]\d{2})\b/);
      return mosMatch ? mosMatch[1] : null;
    },
    extractTitle: (val) => {
      // Remove MOS code and time-in-specialty to get just the title
      const cleaned = val
        .replace(/\b\d{2}[A-Z]\d{2}\s*/i, "")
        .replace(/\d+\s*(?:YRS?|MOS?)[\s-]*/gi, "")
        .replace(/\b\d{2}\b/g, "")
        .replace(/\/\/.*$/i, "")
        .replace(/NOTHING\s*FOLLOWS.*/i, "")
        .replace(/[-–—]+/g, "")
        .trim();
      return cleaned || null;
    },
  },

  // ===== BLOCK 12a: Date Entered Active Duty This Period =====
  entryDate: {
    block: "12a",
    label: "Date Entered Active Duty This Period",
    patterns: [
      /(?:BLOCK\s*12\s*A|BOX\s*12\s*A|12\s*[Aa]\.?\s*DATE\s*ENTERED)[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      /DATE\s*ENTERED\s*(?:AD|ACTIVE\s*DUTY)\s*(?:THIS\s*PERIOD)?[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeDate(val),
  },

  // ===== BLOCK 12b: Separation Date =====
  separationDate: {
    block: "12b",
    label: "Separation Date This Period",
    patterns: [
      /(?:BLOCK\s*12\s*B|BOX\s*12\s*B|12\s*[Bb]\.?\s*SEPARATION\s*DATE)[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      /SEPARATION\s*DATE\s*(?:THIS\s*PERIOD)?[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeDate(val),
  },

  // ===== BLOCK 12c: Net Active Service This Period =====
  netActiveService: {
    block: "12c",
    label: "Net Active Service This Period",
    patterns: [
      /(?:BLOCK\s*12\s*C|BOX\s*12\s*C|12\s*[Cc]\.?\s*NET\s*ACTIVE)[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      /NET\s*ACTIVE\s*SERVICE\s*(?:THIS\s*PERIOD)?[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeServiceTime(val),
  },

  // ===== BLOCK 12d: Total Prior Active Service =====
  totalPriorActiveService: {
    block: "12d",
    label: "Total Prior Active Service",
    patterns: [
      /(?:BLOCK\s*12\s*D|BOX\s*12\s*D|12\s*[Dd]\.?\s*TOTAL\s*PRIOR\s*ACTIVE)[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      /TOTAL\s*PRIOR\s*ACTIVE\s*SERVICE[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeServiceTime(val),
  },

  // ===== BLOCK 12e: Total Prior Inactive Service =====
  totalPriorInactiveService: {
    block: "12e",
    label: "Total Prior Inactive Service",
    patterns: [
      /(?:BLOCK\s*12\s*E|BOX\s*12\s*E|12\s*[Ee]\.?\s*TOTAL\s*PRIOR\s*INACTIVE)[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      /TOTAL\s*PRIOR\s*INACTIVE\s*SERVICE[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeServiceTime(val),
  },

  // ===== BLOCK 12f: Foreign Service =====
  foreignServiceTime: {
    block: "12f",
    label: "Foreign Service",
    patterns: [
      /(?:BLOCK\s*12\s*F|BOX\s*12\s*F|12\s*[Ff]\.?\s*FOREIGN\s*SERVICE)[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      /FOREIGN\s*SERVICE[,\s]*(?:SEA)?[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeServiceTime(val),
  },

  // ===== BLOCK 12g: Sea Service =====
  seaServiceTime: {
    block: "12g",
    label: "Sea Service",
    patterns: [
      /(?:BLOCK\s*12\s*G|BOX\s*12\s*G|12\s*[Gg]\.?\s*SEA\s*SERVICE)[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      /SEA\s*SERVICE[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeServiceTime(val),
  },

  // ===== BLOCK 12h: Effective Date of Pay Grade =====
  dateOfRank: {
    block: "12h",
    label: "Effective Date of Pay Grade",
    patterns: [
      /(?:BLOCK\s*12\s*H|BOX\s*12\s*H|12\s*[Hh]\.?\s*EFFECTIVE\s*DATE)[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      /EFFECTIVE\s*DATE\s*(?:OF\s*)?PAY\s*GRADE[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeDate(val),
  },

  // ===== BLOCK 13: Awards, Decorations, Medals =====
  awardsRaw: {
    block: 13,
    label: "Decorations, Medals, Badges, Citations",
    patterns: [
      /(?:BLOCK\s*13|BOX\s*13|13\.\s*DECORATIONS)[:\s.]*\n?\s*([\s\S]+?)(?=(?:\n\s*(?:BLOCK\s*14|BOX\s*14|14\.|MILITARY\s*EDUCATION))|$)/i,
      /DECORATIONS[,\s]*MEDALS[,\s]*BADGES[,\s]*(?:CITATIONS)?[:\s.]*\n?\s*([\s\S]+?)(?=(?:\n\s*(?:BLOCK\s*14|BOX\s*14|14\.|MILITARY\s*EDUCATION))|$)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 14: Military Education =====
  militaryEducation: {
    block: 14,
    label: "Military Education",
    patterns: [
      /(?:BLOCK\s*14|BOX\s*14|14\.\s*MILITARY\s*EDUCATION)[:\s.]*\n?\s*([\s\S]+?)(?=(?:\n\s*(?:BLOCK\s*15|BOX\s*15|15\.))|$)/i,
      /MILITARY\s*EDUCATION[:\s.]*\n?\s*([\s\S]+?)(?=(?:\n\s*(?:BLOCK\s*15|BOX\s*15|15\.))|$)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 18: Remarks =====
  remarks: {
    block: 18,
    label: "Remarks",
    patterns: [
      /(?:BLOCK\s*18|BOX\s*18|18\.\s*REMARKS)[:\s.]*\n?\s*([\s\S]+?)(?=(?:\n\s*(?:BLOCK\s*19|BOX\s*19|19\.|MAILING))|$)/i,
      /REMARKS[:\s.]*\n?\s*([\s\S]+?)(?=(?:\n\s*(?:BLOCK\s*19|BOX\s*19|19\.|MAILING))|$)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 19: Mailing Address =====
  mailingAddress: {
    block: 19,
    label: "Mailing Address After Separation",
    patterns: [
      /(?:BLOCK\s*19|BOX\s*19|19\.?\s*MAILING\s*ADDRESS)[:\s.]*\n?\s*([\s\S]{10,150}?)(?=\n\s*(?:19\s*[Bb]|BLOCK\s*20|BOX\s*20|20\.))/i,
      /MAILING\s*ADDRESS\s*(?:AFTER\s*SEPARATION)?[:\s.]*\n?\s*([\s\S]{10,150}?)(?=\n\s*(?:19\s*[Bb]|BLOCK\s*20|BOX\s*20|20\.))/i,
    ],
    normalize: (val) => val.replace(/\n/g, ", ").replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 23: Type of Separation =====
  separationType: {
    block: 23,
    label: "Type of Separation",
    patterns: [
      /(?:BLOCK\s*23|BOX\s*23|23\.\s*TYPE\s*OF\s*SEPARATION)[:\s.]*\n?\s*([A-Z][A-Z\s]+)/i,
      /TYPE\s*OF\s*SEPARATION[:\s.]*\n?\s*([A-Z][A-Z\s]+)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 24: Character of Service =====
  characterOfService: {
    block: 24,
    label: "Character of Service",
    patterns: [
      /(?:BLOCK\s*24|BOX\s*24|24\.\s*CHARACTER\s*OF\s*SERVICE)[:\s.]*\n?\s*(HONORABLE|GENERAL(?:\s*UNDER\s*HONORABLE\s*CONDITIONS)?|(?:OTHER\s*THAN\s*HONORABLE|OTH)|DISHONORABLE|BAD\s*CONDUCT|UNCHARACTERIZED)/i,
      /CHARACTER\s*OF\s*(?:SERVICE|DISCHARGE)[:\s.]*\n?\s*(HONORABLE|GENERAL(?:\s*UNDER\s*HONORABLE\s*CONDITIONS)?|(?:OTHER\s*THAN\s*HONORABLE|OTH)|DISHONORABLE|BAD\s*CONDUCT|UNCHARACTERIZED)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 25: Separation Authority =====
  separationAuthority: {
    block: 25,
    label: "Separation Authority",
    patterns: [
      /(?:BLOCK\s*25|BOX\s*25|25\.\s*SEPARATION\s*AUTHORITY)[:\s.]*\n?\s*([A-Z0-9][A-Z0-9\s.,()-]+)/i,
      /SEPARATION\s*AUTHORITY[:\s.]*\n?\s*([A-Z0-9][A-Z0-9\s.,()-]+)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 26: Separation Code (SPD) =====
  separationCode: {
    block: 26,
    label: "Separation Code (SPD)",
    patterns: [
      /(?:BLOCK\s*26|BOX\s*26|26\.\s*SEPARATION\s*CODE)[:\s.]*\n?\s*([A-Z]{3})/i,
      /(?:SEPARATION\s*CODE|SPD(?:\s*CODE)?)[:\s.]*\n?\s*([A-Z]{3})/i,
    ],
    normalize: (val) => val.trim().toUpperCase(),
  },

  // ===== BLOCK 27: Reentry Code =====
  reentryCode: {
    block: 27,
    label: "Reentry Code (RE Code)",
    patterns: [
      /(?:BLOCK\s*27|BOX\s*27|27\.\s*REENTRY\s*CODE)[:\s.]*\n?\s*(RE?-?\d|N\/?A|NA)/i,
      /(?:REENTRY|RE-ENTRY|RE)\s*(?:CODE)?[:\s.]*\n?\s*(RE?-?\d|N\/?A|NA)/i,
    ],
    normalize: (val) => val.trim().toUpperCase(),
  },

  // ===== BLOCK 28: Narrative Reason for Separation =====
  narrativeReason: {
    block: 28,
    label: "Narrative Reason for Separation",
    patterns: [
      /(?:BLOCK\s*28|BOX\s*28|28\.\s*NARRATIVE\s*REASON)[:\s.]*\n?\s*([A-Z][A-Z\s]+)/i,
      /NARRATIVE\s*REASON\s*(?:FOR\s*)?SEPARATION[:\s.]*\n?\s*([A-Z][A-Z\s]+)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 29: Dates of Time Lost =====
  daysLost: {
    block: 29,
    label: "Dates of Time Lost",
    patterns: [
      /(?:BLOCK\s*29|BOX\s*29|29\.\s*DATES?\s*(?:OF\s*)?TIME\s*LOST)[:\s.]*\n?\s*(NONE|\d+(?:\s*DAYS?)?|[\s\S]+?)(?=\n\s*(?:BLOCK\s*30|BOX\s*30|30\.))/i,
      /TIME\s*LOST[:\s.]*\n?\s*(NONE|\d+)/i,
    ],
    normalize: (val) => val.trim(),
  },
};

/**
 * Normalize a date from DD214 format (YYYYMMDD or YYYY|MM|DD) to YYYY-MM-DD
 */
function normalizeDate(val) {
  if (!val) return null;
  const cleaned = val.replace(/[\s|.-]/g, "");
  if (cleaned.length === 8 && /^\d{8}$/.test(cleaned)) {
    const y = cleaned.substring(0, 4);
    const m = cleaned.substring(4, 6);
    const d = cleaned.substring(6, 8);
    // Validate
    const year = parseInt(y);
    const month = parseInt(m);
    const day = parseInt(d);
    if (
      year >= 1900 &&
      year <= 2100 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return `${y}-${m}-${d}`;
    }
  }
  // Try MM/DD/YYYY or MM-DD-YYYY
  const slashMatch = val.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[1]}-${slashMatch[2]}`;
  }
  // Try YYYY-MM-DD already
  const isoMatch = val.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  return null;
}

/**
 * Normalize service time from YYYYMMDD format to {years, months, days}
 * DD214s encode service time as YYYYMMDD where YYYY=years, MM=months, DD=days
 */
function normalizeServiceTime(val) {
  if (!val) return null;
  const cleaned = val.replace(/[\s|.-]/g, "");
  if (cleaned.length >= 6 && /^\d+$/.test(cleaned)) {
    // Pad to 8 digits
    const padded = cleaned.padStart(8, "0");
    const years = parseInt(padded.substring(0, 4));
    const months = parseInt(padded.substring(4, 6));
    const days = parseInt(padded.substring(6, 8));
    return { years, months, days };
  }
  return null;
}

/**
 * Parse awards string into structured array
 * Handles // delimiters, "CONT IN BLOCK 18", device counts, etc.
 */
function parseAwardsString(awardsRaw, remarksText) {
  if (!awardsRaw) return [];

  let fullAwardsText = awardsRaw;

  // Check for continuation in Block 18
  const contPatterns = [
    /CONT(?:INUED?)?\s*(?:IN\s*)?(?:BLOCK\s*18|REMARKS)/i,
    /SEE\s*(?:BLOCK\s*18|REMARKS)/i,
    /CONT\s*(?:FROM|IN)\s*(?:BLOCK\s*13|ITEM\s*13)/i,
  ];

  // If remarks contain continuation, append
  if (remarksText) {
    for (const pat of contPatterns) {
      if (pat.test(awardsRaw) || pat.test(remarksText)) {
        // Extract the continuation text from remarks
        const contMatch = remarksText.match(
          /(?:CONT(?:INUED?)?(?:\s*FROM)?\s*(?:BLOCK\s*13|ITEM\s*13)[:\s]*)([\s\S]+?)(?=\/\/\s*(?:NOTHING\s*FOLLOWS|$))/i,
        );
        if (contMatch) {
          fullAwardsText += "//" + contMatch[1];
        } else {
          // Try broader match — sometimes the continuation is just listed
          const broadMatch = remarksText.match(
            /(?:CONT\s*(?:FROM|IN)\s*(?:BLOCK\s*13))[:\s]*([\s\S]+?)(?=\/\/\s*NOTHING|$)/i,
          );
          if (broadMatch) {
            fullAwardsText += "//" + broadMatch[1];
          }
        }
        break;
      }
    }
  }

  // Split by // delimiter
  const rawAwards = fullAwardsText
    .split(/\s*\/\/\s*/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s &&
        !s.match(/^NOTHING\s*FOLLOWS$/i) &&
        !s.match(/^CONT/i) &&
        s.length > 2,
    );

  // Parse each award
  const awards = rawAwards.map((raw) => {
    const award = {
      raw: raw,
      name: raw,
      abbreviation: "",
      devices: [],
      deviceCount: 0,
      isCombat: false,
    };

    // Extract device information (e.g., "2ND AWARD", "W/ M DEVICE", "W/ 1 OLC")
    const devicePatterns = [
      { pattern: /\((\d+)(?:ST|ND|RD|TH)\s*AWARD\)/i, type: "award_count" },
      { pattern: /(\d+)(?:ST|ND|RD|TH)\s*AWARD/i, type: "award_count" },
      { pattern: /-(\d+)/i, type: "award_count_dash" },
      { pattern: /W\/?\s*'?M'?\s*DEVICE/i, type: "M Device" },
      { pattern: /W\/?\s*'?V'?\s*DEVICE/i, type: "V Device" },
      {
        pattern: /W\/?\s*(\d+)\s*(?:OLC|OAK\s*LEAF)/i,
        type: "Oak Leaf Cluster",
      },
      {
        pattern: /W\/?\s*(\d+)\s*(?:BRONZE\s*)?(?:SERVICE\s*)?STAR/i,
        type: "Bronze Service Star",
      },
    ];

    for (const dp of devicePatterns) {
      const match = raw.match(dp.pattern);
      if (match) {
        if (dp.type === "award_count" || dp.type === "award_count_dash") {
          award.deviceCount = parseInt(match[1]);
          award.name = raw.replace(match[0], "").trim();
        } else if (dp.type === "M Device" || dp.type === "V Device") {
          award.devices.push(dp.type);
          award.name = raw.replace(match[0], "").trim();
        } else {
          const count = parseInt(match[1]) || 1;
          for (let i = 0; i < count; i++) {
            award.devices.push(dp.type);
          }
          award.name = raw.replace(match[0], "").trim();
        }
      }
    }

    // Clean up name
    award.name = award.name
      .replace(/[-–—]+\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();

    // Check if combat-related
    const combatIndicators = [
      /COMBAT\s*(?:ACTION|INFANTRY)/i,
      /PURPLE\s*HEART/i,
      /BRONZE\s*STAR/i,
      /SILVER\s*STAR/i,
      /V\s*DEVICE/i,
      /VALOR/i,
      /CAMPAIGN\s*MEDAL/i,
      /EXPEDITIONARY\s*MEDAL/i,
      /IMMINENT\s*DANGER/i,
    ];
    award.isCombat = combatIndicators.some((p) => p.test(raw));

    return award;
  });

  return awards;
}

/**
 * Extract deployment information from Block 18 remarks
 */
function extractDeployments(remarksText) {
  if (!remarksText) return [];
  const deployments = [];

  // Pattern: SERVICE IN [LOCATION] FROM YYYYMMDD TO YYYYMMDD
  const deployPatterns = [
    /SERVICE\s*IN\s+([A-Z]+)\s*(?:FROM\s*)?(\d{8})\s*(?:TO|-)\s*(\d{8})/gi,
    /SERVED?\s*IN\s+([A-Z]+)\s*(?:FROM\s*)?(\d{8})\s*(?:TO|-)\s*(\d{8})/gi,
    /(?:SINAI|AFGHANISTAN|IRAQ|KUWAIT|KOREA)\s*(?:FROM\s*)?(\d{8})\s*(?:TO|-)\s*(\d{8})/gi,
    /SERVICE\s*IN\s+([A-Z\s]+?)\s+(\d{8})\s*-\s*(\d{8})/gi,
  ];

  for (const pattern of deployPatterns) {
    let match;
    while ((match = pattern.exec(remarksText)) !== null) {
      const location = match[1].trim();
      const startDate = normalizeDate(match[2] || match[1]);
      const endDate = normalizeDate(match[3] || match[2]);
      if (location && location.length > 2) {
        deployments.push({
          location,
          startDate,
          endDate,
          raw: match[0],
        });
      }
    }
  }

  // Also check for operation names
  const opPatterns = [
    /OPERATION\s+(ENDURING\s*FREEDOM|IRAQI?\s*FREEDOM|NEW\s*DAWN|INHERENT\s*RESOLVE|FREEDOM'?S?\s*SENTINEL)/gi,
    /(?:OEF|OIF|OND|OIR|OFS)/g,
  ];
  for (const pattern of opPatterns) {
    let match;
    while ((match = pattern.exec(remarksText)) !== null) {
      const existing = deployments.find(
        (d) => d.raw && d.raw.includes(match[0]),
      );
      if (!existing) {
        deployments.push({
          operation: match[1] || match[0],
          raw: match[0],
        });
      }
    }
  }

  return deployments;
}

/**
 * Extract combat indicators from Block 13 + Block 18
 */
function extractCombatIndicators(awardsText, remarksText) {
  const indicators = [];
  const combinedText = `${awardsText || ""} ${remarksText || ""}`;

  const combatPatterns = [
    { pattern: /COMBAT\s*ACTION\s*BADGE/i, name: "Combat Action Badge" },
    {
      pattern: /COMBAT\s*INFANTRY(?:MAN)?(?:'?S)?\s*BADGE/i,
      name: "Combat Infantryman Badge",
    },
    { pattern: /COMBAT\s*MEDICAL\s*BADGE/i, name: "Combat Medical Badge" },
    { pattern: /PURPLE\s*HEART/i, name: "Purple Heart" },
    { pattern: /BRONZE\s*STAR/i, name: "Bronze Star Medal" },
    { pattern: /SILVER\s*STAR/i, name: "Silver Star" },
    { pattern: /IMMINENT\s*DANGER\s*PAY/i, name: "Imminent Danger Pay Zone" },
    { pattern: /HOSTILE\s*FIRE\s*PAY/i, name: "Hostile Fire Pay" },
    { pattern: /V\s*DEVICE/i, name: "V Device (Valor)" },
    { pattern: /CAMPAIGN\s*MEDAL/i, name: "Campaign Medal" },
  ];

  for (const cp of combatPatterns) {
    if (cp.pattern.test(combinedText)) {
      indicators.push(cp.name);
    }
  }

  return indicators;
}

/**
 * Extract special qualifications from Block 13/18
 */
function extractSpecialQualifications(text) {
  if (!text) return [];
  const quals = [];

  const qualPatterns = [
    { pattern: /AIRBORNE/i, name: "Airborne" },
    { pattern: /RANGER/i, name: "Ranger" },
    { pattern: /SPECIAL\s*FORCES/i, name: "Special Forces" },
    { pattern: /AIR\s*ASSAULT/i, name: "Air Assault" },
    { pattern: /PATHFINDER/i, name: "Pathfinder" },
    { pattern: /SAPPER/i, name: "Sapper" },
    { pattern: /COMBAT\s*DIVER/i, name: "Combat Diver" },
    { pattern: /COMBAT\s*LIFE\s*SAVER/i, name: "Combat Life Saver" },
    { pattern: /EXPERT\s*(?:INFANTRY|FIELD\s*MEDICAL)/i, name: "Expert Badge" },
    { pattern: /SNIPER/i, name: "Sniper" },
    { pattern: /JUMPMASTER/i, name: "Jumpmaster" },
  ];

  for (const qp of qualPatterns) {
    if (qp.pattern.test(text)) {
      quals.push(qp.name);
    }
  }

  return quals;
}

/**
 * Parse branch and component from Block 2 text
 */
function parseBranchComponent(text) {
  if (!text) return { branch: null, component: null, componentFull: null };

  const result = { branch: null, component: null, componentFull: null };

  // Branch detection
  if (/ARMY/i.test(text)) result.branch = "Army";
  else if (/NAVY/i.test(text)) result.branch = "Navy";
  else if (/AIR\s*FORCE/i.test(text)) result.branch = "Air Force";
  else if (/MARINE/i.test(text)) result.branch = "Marines";
  else if (/COAST\s*GUARD/i.test(text)) result.branch = "Coast Guard";
  else if (/SPACE\s*FORCE/i.test(text)) result.branch = "Space Force";

  // Component detection
  if (/ARNG|NATIONAL\s*GUARD/i.test(text)) {
    result.component = "ARNG";
    result.componentFull = `${result.branch || "Army"} National Guard`;
  } else if (/USAR|RESERVE/i.test(text)) {
    result.component = "USAR";
    result.componentFull = `${result.branch || "Army"} Reserve`;
  } else if (/ACTIVE|RA\b|USN\b|USAF\b|USMC\b/i.test(text)) {
    result.component = "RA";
    result.componentFull = `Regular ${result.branch || "Army"}`;
  }

  return result;
}

/**
 * Parse name into components
 */
function parseName(fullName) {
  if (!fullName) return { lastName: null, firstName: null, middleName: null };

  // Format: "LAST, FIRST MIDDLE" or "LAST, FIRST M."
  const parts = fullName.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    const lastName = parts[0];
    const firstMiddle = parts[1].split(/\s+/);
    return {
      lastName,
      firstName: firstMiddle[0] || null,
      middleName: firstMiddle.slice(1).join(" ") || null,
    };
  }

  // Format: "FIRST MIDDLE LAST"
  const words = fullName.split(/\s+/);
  if (words.length >= 2) {
    return {
      firstName: words[0],
      middleName: words.length > 2 ? words.slice(1, -1).join(" ") : null,
      lastName: words[words.length - 1],
    };
  }

  return { lastName: fullName, firstName: null, middleName: null };
}

// ============================================================
// MAIN EXPORT: extractDD214Fields
// ============================================================

/**
 * Extract ALL DD214 fields from raw OCR text using regex patterns.
 * This is a deterministic, AI-free extraction that serves as:
 * 1. Primary extraction when AI is unavailable
 * 2. Validation layer to cross-check AI results
 * 3. Fallback for fields AI misses
 *
 * @param {string} rawText - The raw OCR/extracted text from a DD214
 * @param {Object} options - Configuration options
 * @returns {Object} Structured DD214 data matching the AI output schema
 */
export function extractDD214Fields(rawText, options = {}) {
  if (!rawText || typeof rawText !== "string") {
    return { success: false, error: "No text provided", fields: {} };
  }

  const text = rawText.toUpperCase();
  const extractedFields = {};
  const fieldConfidence = {};
  const extractionNotes = [];

  // Run each field pattern
  for (const [fieldName, fieldDef] of Object.entries(DD214_FIELD_PATTERNS)) {
    for (const pattern of fieldDef.patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let value = match[1].trim();

        // Apply normalization if defined
        if (fieldDef.normalize) {
          value = fieldDef.normalize(value);
        }

        // Apply validation if defined
        if (fieldDef.validate && !fieldDef.validate(value)) {
          continue; // Skip invalid matches
        }

        extractedFields[fieldName] = value;
        fieldConfidence[fieldName] = "regex_match";
        break; // First match wins
      }
    }
  }

  // ===== POST-PROCESSING =====

  // Parse name components
  if (extractedFields.fullName) {
    const nameParts = parseName(extractedFields.fullName);
    if (!extractedFields.lastName)
      extractedFields.lastName = nameParts.lastName;
    if (!extractedFields.firstName)
      extractedFields.firstName = nameParts.firstName;
    if (!extractedFields.middleName)
      extractedFields.middleName = nameParts.middleName;
  }

  // Parse branch/component
  if (extractedFields.departmentComponentBranch) {
    const branchInfo = parseBranchComponent(
      extractedFields.departmentComponentBranch,
    );
    extractedFields.branch = branchInfo.branch;
    extractedFields.component = branchInfo.component;
    extractedFields.componentFull = branchInfo.componentFull;
  }

  // Extract SSN last 4
  if (extractedFields.ssn) {
    extractedFields.ssnLast4 = DD214_FIELD_PATTERNS.ssn.extractLast4(
      extractedFields.ssn,
    );
    // Remove full SSN for security — we only keep last 4
    if (!options.keepFullSSN) {
      delete extractedFields.ssn;
    }
  }

  // Parse MOS from primary specialty
  if (extractedFields.primarySpecialty) {
    const mosCode = DD214_FIELD_PATTERNS.primarySpecialty.extractMOS(
      extractedFields.primarySpecialty,
    );
    const mosTitle = DD214_FIELD_PATTERNS.primarySpecialty.extractTitle(
      extractedFields.primarySpecialty,
    );
    if (mosCode) extractedFields.mos = mosCode;
    if (mosTitle) extractedFields.mosTitle = mosTitle;
  }

  // Parse awards
  const awardsRaw = extractedFields.awardsRaw || "";
  const remarksText = extractedFields.remarks || "";
  extractedFields.awards = parseAwardsString(awardsRaw, remarksText);
  if (extractedFields.awards.length > 0) {
    extractionNotes.push(
      `Extracted ${extractedFields.awards.length} awards/decorations`,
    );
  }

  // Extract deployments from remarks
  extractedFields.deployments = extractDeployments(remarksText);
  if (extractedFields.deployments.length > 0) {
    extractionNotes.push(
      `Found ${extractedFields.deployments.length} deployment(s) in remarks`,
    );
  }

  // Extract combat indicators
  const combatIndicators = extractCombatIndicators(awardsRaw, remarksText);
  extractedFields.combatService = {
    hasVerifiedCombat: combatIndicators.length > 0,
    indicators: combatIndicators,
    deployments: extractedFields.deployments.map((d) =>
      d.location
        ? `${d.location} ${d.startDate || ""}-${d.endDate || ""}`.trim()
        : d.operation,
    ),
  };

  // Extract special qualifications
  const allText = `${awardsRaw} ${remarksText} ${extractedFields.militaryEducation || ""}`;
  extractedFields.specialQualifications = extractSpecialQualifications(allText);

  // Calculate total service
  if (
    extractedFields.netActiveService &&
    typeof extractedFields.netActiveService === "object"
  ) {
    extractedFields.yearsService = extractedFields.netActiveService.years;
    extractedFields.monthsService = extractedFields.netActiveService.months;
    extractedFields.daysService = extractedFields.netActiveService.days;
  }

  // Foreign service detection
  if (extractedFields.foreignServiceTime) {
    const fst = extractedFields.foreignServiceTime;
    extractedFields.foreignService =
      fst.years > 0 || fst.months > 0 || fst.days > 0;
  }

  // Parse military education into array
  if (
    extractedFields.militaryEducation &&
    typeof extractedFields.militaryEducation === "string"
  ) {
    const eduText = extractedFields.militaryEducation;
    extractedFields.militaryEducation = eduText
      .split(/\/\//)
      .map((e) => e.trim())
      .filter(
        (e) => e && !e.match(/^NOTHING\s*FOLLOWS$/i) && !e.match(/^NONE$/i),
      );
  }

  // Clean up internal-only fields
  delete extractedFields.awardsRaw;
  delete extractedFields.departmentComponentBranch;

  return {
    success: true,
    fields: extractedFields,
    fieldConfidence,
    extractionNotes,
    fieldsExtracted: Object.keys(extractedFields).length,
    method: "regex",
  };
}

/**
 * Merge regex-extracted fields with AI-extracted fields.
 * AI wins for complex fields (awards interpretation, combat assessment).
 * Regex wins for structured fields (dates, codes, SSN).
 * Missing AI fields are filled by regex.
 *
 * @param {Object} aiResult - AI-extracted DD214 data
 * @param {Object} regexResult - Regex-extracted DD214 data (from extractDD214Fields)
 * @returns {Object} Merged result with best-of-both data
 */
export function mergeAIAndRegexResults(aiResult, regexResult) {
  if (!aiResult && !regexResult?.fields) return aiResult || {};
  if (!aiResult) return regexResult.fields;
  if (!regexResult?.fields) return aiResult;

  const merged = { ...aiResult };
  const regexFields = regexResult.fields;
  const mergeNotes = [];

  // Fields where regex is more reliable (structured/format-sensitive)
  const regexPreferred = [
    "ssnLast4",
    "entryDate",
    "separationDate",
    "dateOfBirth",
    "dateOfRank",
    "reserveObligationDate",
    "separationCode",
    "reentryCode",
    "payGrade",
    "netActiveService",
    "totalPriorActiveService",
    "totalPriorInactiveService",
    "foreignServiceTime",
    "seaServiceTime",
  ];

  // Fields where AI is more reliable (requires interpretation)
  const _aiPreferred = [
    "awards",
    "combatService",
    "specialQualifications",
    "narrativeReason",
    "militaryEducation",
  ];

  // Fill missing AI fields from regex
  for (const [key, value] of Object.entries(regexFields)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;

    const aiValue = merged[key];
    const aiMissing =
      aiValue === null ||
      aiValue === undefined ||
      (typeof aiValue === "string" && aiValue.trim() === "");

    if (aiMissing) {
      merged[key] = value;
      mergeNotes.push(`Filled '${key}' from regex (AI missed it)`);
    } else if (regexPreferred.includes(key)) {
      // For structured fields, prefer regex if AI value looks wrong
      if (
        key.includes("Date") &&
        typeof aiValue === "string" &&
        !/^\d{4}-\d{2}-\d{2}$/.test(aiValue)
      ) {
        merged[key] = value;
        mergeNotes.push(
          `Corrected '${key}' with regex value (AI format was wrong)`,
        );
      }
    }
  }

  // Merge deployment arrays (union)
  if (regexFields.deployments?.length > 0 && !merged.deployments?.length) {
    merged.deployments = regexFields.deployments;
    mergeNotes.push(
      `Added ${regexFields.deployments.length} deployment(s) from regex`,
    );
  }

  // Ensure combat indicators are complete
  if (regexFields.combatService?.indicators?.length > 0) {
    if (!merged.combatService) merged.combatService = regexFields.combatService;
    else {
      const existingIndicators = new Set(merged.combatService.indicators || []);
      for (const ind of regexFields.combatService.indicators) {
        if (!existingIndicators.has(ind)) {
          merged.combatService.indicators.push(ind);
          mergeNotes.push(`Added combat indicator '${ind}' from regex`);
        }
      }
      if (regexFields.combatService.hasVerifiedCombat) {
        merged.combatService.hasVerifiedCombat = true;
      }
    }
  }

  merged._mergeNotes = mergeNotes;
  merged._regexFieldCount = regexResult.fieldsExtracted;
  return merged;
}

/**
 * Detect which DD214 document(s) are present in the text
 * Returns info about each detected document
 */
export function detectDD214Documents(text) {
  const documents = [];

  // Split by page markers
  const _pages = text.split(/---\s*PAGE\s+(\d+)\s*(?:\([^)]*\))?\s*---/i);

  // Look for form identifiers
  const formPatterns = [
    { pattern: /DD\s*(?:FORM\s*)?214/i, type: "DD214" },
    { pattern: /NGB\s*(?:FORM\s*)?22/i, type: "NGB22" },
    { pattern: /DD\s*(?:FORM\s*)?256/i, type: "DD256" },
    { pattern: /DD\s*(?:FORM\s*)?257/i, type: "DD257" },
    { pattern: /DD\s*(?:FORM\s*)?215/i, type: "DD215" },
  ];

  // Look for separation dates to identify distinct documents
  const sepDatePattern =
    /(?:SEPARATION\s*DATE|12\s*[Bb])[:\s.]*\n?\s*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/gi;
  let match;
  while ((match = sepDatePattern.exec(text)) !== null) {
    const date = normalizeDate(match[1]);
    if (date) {
      let type = "DD214";
      for (const fp of formPatterns) {
        // Check nearby text for form type
        const nearby = text.substring(
          Math.max(0, match.index - 500),
          match.index + 500,
        );
        if (fp.pattern.test(nearby)) {
          type = fp.type;
          break;
        }
      }
      documents.push({ type, separationDate: date, position: match.index });
    }
  }

  return documents;
}

export default {
  extractDD214Fields,
  mergeAIAndRegexResults,
  detectDD214Documents,
  parseAwardsString,
  extractDeployments,
  extractCombatIndicators,
};
