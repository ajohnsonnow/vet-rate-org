/**
 * Vet-Rate.org - Smart Field Collection Rules
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * Defines field collection rules for all 16 document types.
 * Controls which fields are required, optional, or ignored.
 * Provides tooltips explaining why each field is needed.
 */

import { DOCUMENT_TYPES } from "./documentClassifier";

/**
 * Field importance levels
 */
export const FIELD_IMPORTANCE = {
  REQUIRED: "required", // Must be present for meaningful processing
  IMPORTANT: "important", // Highly valuable but not strictly required
  OPTIONAL: "optional", // Nice to have, but not critical
  IGNORE: "ignore", // Don't collect (irrelevant or duplicate)
};

/**
 * Field category tags
 */
export const FIELD_CATEGORIES = {
  IDENTITY: "identity", // SSN, name, DOB
  SERVICE: "service", // Branch, dates, MOS
  MEDICAL: "medical", // Conditions, ratings, diagnoses
  BENEFITS: "benefits", // Claims, ratings, payments
  CONTACT: "contact", // Address, phone, email
  ADMINISTRATIVE: "administrative", // File numbers, dates, references
};

/**
 * Collection rules for DD214 (Separation Documents)
 */
const DD214_RULES = {
  // ============================================================
  // IDENTITY FIELDS (Box 1, 3, 5)
  // ============================================================
  veteranName: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.IDENTITY,
    tooltip:
      "Box 1: Full name (Last, First Middle). Required to identify veteran and match with VA records.",
    validation: (val) => val && val.length > 2,
  },

  lastName: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.IDENTITY,
    tooltip: "Box 1: Last name extracted separately for profile matching.",
    validation: (val) => val && val.length >= 2,
  },

  firstName: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.IDENTITY,
    tooltip: "Box 1: First name extracted separately for profile matching.",
    validation: (val) => val && val.length >= 2,
  },

  middleName: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.IDENTITY,
    tooltip: "Box 1: Middle name if present.",
    validation: null,
  },

  suffix: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.IDENTITY,
    tooltip: "Box 1: Name suffix (Jr, Sr, III, etc.).",
    validation: null,
  },

  department: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip: "Box 2: Department (e.g., Department of the Army).",
    validation: null,
  },

  ssn: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.IDENTITY,
    tooltip:
      "Box 3: Primary identifier for VA claims. Used to match all medical and service records.",
    validation: (val) => val && /^\d{3}-?\d{2}-?\d{4}$/.test(val),
  },

  dateOfBirth: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.IDENTITY,
    tooltip:
      "Box 5: Date of Birth. Needed for age-related presumptive conditions (PACT Act, Agent Orange).",
    validation: (val) => val && !isNaN(Date.parse(val)),
  },

  // ============================================================
  // SERVICE FIELDS (Box 2, 4, 7, 8, 11, 12)
  // ============================================================
  branch: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 2: Branch of service. Determines eligibility for branch-specific benefits and exposure presumptions.",
    validation: (val) =>
      val &&
      [
        "Army",
        "Navy",
        "Air Force",
        "Marines",
        "Marine Corps",
        "Coast Guard",
        "Space Force",
      ].some((b) => val.includes(b)),
  },

  component: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 2: Active Duty, Reserve, or National Guard. May affect exposure presumptions and benefits.",
    validation: null,
  },

  rank: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 4a: Final rank/grade at separation. Useful for records requests and verifying service.",
    validation: null,
  },

  payGrade: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 4b: Pay grade (E-4, O-3, etc.). Indicates military classification.",
    validation: (val) => val && /^[EO]-?\d$/.test(val),
  },

  reserveObligationDate: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip: "Box 6: Reserve Obligation Termination Date.",
    validation: null,
  },

  placeOfEntry: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 7a: Location where entered active duty. May help verify service records.",
    validation: null,
  },

  homeOfRecord: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.CONTACT,
    tooltip: "Box 7b: Home of record at time of entry.",
    validation: null,
  },

  lastDutyAssignment: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip: "Box 8a: Last duty assignment and major command.",
    validation: null,
  },

  stationSeparated: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip: "Box 8b: Station where separated.",
    validation: null,
  },

  commandTransferred: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip: "Box 9: Command to which transferred (e.g., USAR Control Group).",
    validation: null,
  },

  sgliCoverage: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.BENEFITS,
    tooltip: "Box 10: SGLI coverage amount at separation.",
    validation: null,
  },

  mos: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 11: Military Occupational Specialty (MOS/AFSC/Rate). Links to hazardous exposures (burn pits, chemicals, radiation, noise).",
    validation: (val) => val && val.length > 0,
  },

  mosTitle: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 11: Job title for your MOS. Helps identify specific occupational hazards.",
    validation: null,
  },

  additionalMos: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip: "Box 11: Additional MOS/specialty codes beyond primary.",
    validation: null,
  },

  yearsInMos: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip: "Box 11: Time served in primary MOS.",
    validation: null,
  },

  serviceStartDate: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 12a: Date entered active duty this period. Proves active duty status for service-connection.",
    validation: (val) => val && !isNaN(Date.parse(val)),
  },

  serviceEndDate: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      'Box 12b: Separation date. Establishes end of active duty for "within one year" conditions.',
    validation: (val) => val && !isNaN(Date.parse(val)),
  },

  // ============================================================
  // SERVICE TIME CALCULATIONS (Box 12c-e)
  // ============================================================
  totalActiveService: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 12c: Net active service this period. Shows total time on active duty for benefits calculation.",
    validation: null,
  },

  totalPriorActiveService: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip: "Box 12c: Total prior active service from previous enlistments.",
    validation: null,
  },

  totalPriorInactiveService: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 12d: Total prior inactive service (Reserve/Guard time not on active duty).",
    validation: null,
  },

  foreignService: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 12e: Foreign service time. Critical for overseas exposure presumptions.",
    validation: null,
  },

  seaService: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 12e: Sea service time. May indicate exposure to asbestos, JP-5, etc.",
    validation: null,
  },

  // ============================================================
  // DECORATIONS, MEDALS, AWARDS (Box 13)
  // ============================================================
  awards: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 13: Decorations, medals, badges. Combat awards (Purple Heart, CAB, CIB, CAR) support PTSD claims without stressor verification.",
    validation: (val) => Array.isArray(val),
  },

  campaignRibbons: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 13: Campaign/service ribbons. May indicate specific theater exposure (Vietnam, Gulf War, OIF/OEF).",
    validation: null,
  },

  badges: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 13: Military badges (CIB, CAB, EIB, Parachutist, etc.). Combat badges support PTSD claims.",
    validation: null,
  },

  citations: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip: "Box 13: Award citations with narrative descriptions.",
    validation: null,
  },

  // ============================================================
  // VEAP & LEAVE (Box 15-16)
  // ============================================================
  veapContribution: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.BENEFITS,
    tooltip:
      "Box 15a: Whether member contributed to Post-Vietnam Era Veterans Educational Assistance Program.",
    validation: null,
  },

  veapAmount: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.BENEFITS,
    tooltip: "Box 15b: Amount contributed to VEAP.",
    validation: null,
  },

  accruedLeavePaid: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.BENEFITS,
    tooltip: "Box 16: Days of accrued leave paid at separation.",
    validation: null,
  },

  dentalExamProvided: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Box 17: Whether dental exam was provided within 90 days of separation.",
    validation: null,
  },

  // ============================================================
  // DEPLOYMENTS & LOCATIONS
  // ============================================================
  deployments: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Deployment locations from Box 18 remarks. Determine exposure presumptions (Agent Orange, Gulf War illness, burn pits).",
    validation: (val) => Array.isArray(val) && val.length > 0,
  },

  // ============================================================
  // SEPARATION INFORMATION (Box 23-28)
  // ============================================================
  separationType: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.ADMINISTRATIVE,
    tooltip: "Box 23: Type of separation (retirement, ETS, medical, etc.).",
    validation: null,
  },

  dischargeType: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 24: Character of service. Honorable/General required for VA benefits. OTH may be eligible with discharge upgrade.",
    validation: (val) => val && val.length > 0,
  },

  separationAuthority: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.ADMINISTRATIVE,
    tooltip:
      "Box 25: Regulation under which separated. Useful for understanding separation reason.",
    validation: null,
  },

  spdCode: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.ADMINISTRATIVE,
    tooltip:
      "Box 26: Separation Program Designator. 3-letter code indicating separation reason.",
    validation: (val) => val && /^[A-Z]{3}$/.test(val),
  },

  reentryCode: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.ADMINISTRATIVE,
    tooltip:
      "Box 27: Reentry code (RE-1, RE-2, etc.). Affects reenlistment eligibility and some VA benefits.",
    validation: (val) => val && /^(RE-?[1-4][A-Z]?|NA)$/i.test(val),
  },

  narrativeReason: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.ADMINISTRATIVE,
    tooltip:
      "Box 28: Narrative reason for separation. Explains why service member was discharged.",
    validation: null,
  },

  // ============================================================
  // EDUCATION & TRAINING (Box 14)
  // ============================================================
  militaryEducation: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 14: Military education and training completed. May indicate specialized exposures.",
    validation: null,
  },

  // ============================================================
  // REMARKS & METADATA (Box 18)
  // ============================================================
  remarks: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.ADMINISTRATIVE,
    tooltip:
      "Box 18: Remarks section. Often contains deployment dates, overseas service, and combat info.",
    validation: null,
  },

  combatZone: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 18: Combat zone service documented in remarks. Critical for PTSD and presumptive conditions.",
    validation: null,
  },

  injuriesDocumented: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Box 18: Injuries or medical conditions documented in remarks section.",
    validation: null,
  },

  // ============================================================
  // MAILING & ADMINISTRATIVE (Box 19-20, 29)
  // ============================================================
  mailingAddress: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.CONTACT,
    tooltip: "Box 19: Mailing address after separation.",
    validation: null,
  },

  copy4Destination: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.ADMINISTRATIVE,
    tooltip: "Box 20: Destination for Member Copy 4.",
    validation: null,
  },

  timeLost: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "Box 29: Dates of time lost during this period (AWOL, confinement, etc.).",
    validation: null,
  },

  // Metadata fields (still useful for display)
  signatureDate: {
    importance: FIELD_IMPORTANCE.IGNORE,
    category: FIELD_CATEGORIES.ADMINISTRATIVE,
    tooltip: null,
  },
};

/**
 * Collection rules for Rating Decision Letters
 */
const RATING_DECISION_RULES = {
  veteranName: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.IDENTITY,
    tooltip: "Confirms this rating belongs to the correct veteran.",
    validation: (val) => val && val.length > 2,
  },

  fileNumber: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.ADMINISTRATIVE,
    tooltip:
      "VA claim file number. Used to track claims and match with C&P exams.",
    validation: (val) => val && val.length > 5,
  },

  decisionDate: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.ADMINISTRATIVE,
    tooltip:
      "Establishes effective date for back pay. Must be within one year for appeals.",
    validation: (val) => val && !isNaN(Date.parse(val)),
  },

  combinedRating: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.BENEFITS,
    tooltip:
      "Overall VA disability rating. Determines monthly compensation and benefits eligibility.",
    validation: (val) => val && val >= 0 && val <= 100,
  },

  conditions: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Service-connected conditions with individual ratings. Used to identify secondary conditions and calculate bilateral factor.",
    validation: (val) => Array.isArray(val) && val.length > 0,
  },

  effectiveDate: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.BENEFITS,
    tooltip:
      "Date benefits begin. Determines retroactive pay amount. Can be backdated if Intent to File was submitted.",
    validation: (val) => val && !isNaN(Date.parse(val)),
  },

  deniedConditions: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Conditions denied service-connection. These can be appealed or re-filed with new evidence.",
    validation: (val) => Array.isArray(val),
  },

  deferredConditions: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Conditions pending more evidence. VA is still deciding - watch for follow-up letters.",
    validation: (val) => Array.isArray(val),
  },

  monthlyAmount: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.BENEFITS,
    tooltip:
      "Current monthly payment. Used to verify rating accuracy and calculate future increases.",
    validation: (val) => val && val > 0,
  },
};

/**
 * Collection rules for C&P Exam Reports
 */
const CP_EXAM_RULES = {
  veteranName: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.IDENTITY,
    tooltip: "Confirms exam belongs to correct veteran.",
    validation: (val) => val && val.length > 2,
  },

  examDate: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.ADMINISTRATIVE,
    tooltip:
      "Date of examination. Used to match with rating decision timeline.",
    validation: (val) => val && !isNaN(Date.parse(val)),
  },

  examType: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Type of exam (e.g., PTSD DBQ, Knee DBQ). Determines which diagnostic criteria apply.",
    validation: (val) => val && val.length > 0,
  },

  conditionExamined: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip: "Specific condition being examined. Must match claim.",
    validation: (val) => val && val.length > 0,
  },

  diagnosis: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Medical diagnosis given by examiner. Used to verify service-connection and rating percentage.",
    validation: (val) => val && val.length > 0,
  },

  examinerOpinion: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      'Examiner\'s opinion on service-connection. "At least as likely as not" language is crucial for approval.',
    validation: (val) => val && val.length > 10,
  },

  functionalImpact: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "How condition affects daily life. Used to determine rating percentage under 38 CFR §4.",
    validation: (val) => val && val.length > 0,
  },

  romFindings: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Range of Motion measurements for musculoskeletal conditions. Used for precise rating under Diagnostic Code.",
    validation: null,
  },
};

/**
 * Collection rules for Medical Records
 */
const MEDICAL_RECORDS_RULES = {
  veteranName: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.IDENTITY,
    tooltip: "Confirms records belong to correct veteran.",
    validation: (val) => val && val.length > 2,
  },

  treatmentDate: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Date of medical treatment. Establishes continuity of treatment for chronic conditions.",
    validation: (val) => val && !isNaN(Date.parse(val)),
  },

  diagnosis: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Medical diagnosis. Proves condition exists and is documented by licensed provider.",
    validation: (val) => val && val.length > 0,
  },

  provider: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Healthcare provider name. Licensed providers carry more weight than unlicensed (e.g., MD > nurse).",
    validation: (val) => val && val.length > 0,
  },

  symptoms: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Documented symptoms. Used to show severity and frequency for rating purposes.",
    validation: (val) => Array.isArray(val) && val.length > 0,
  },

  medications: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Prescribed medications. Can indicate severity and support higher ratings.",
    validation: (val) => Array.isArray(val),
  },

  treatment: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip: "Treatment provided. Shows ongoing management of condition.",
    validation: (val) => val && val.length > 0,
  },
};

/**
 * Collection rules for VA Form 21-526EZ (Disability Claim)
 */
const VA_CLAIM_FORM_RULES = {
  veteranName: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.IDENTITY,
    tooltip: "Primary identifier for claim.",
    validation: (val) => val && val.length > 2,
  },

  ssn: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.IDENTITY,
    tooltip: "Required for claim processing and matching with service records.",
    validation: (val) => val && /^\d{3}-?\d{2}-?\d{4}$/.test(val),
  },

  claimDate: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.ADMINISTRATIVE,
    tooltip: "Date claim was filed. Determines effective date for back pay.",
    validation: (val) => val && !isNaN(Date.parse(val)),
  },

  claimedConditions: {
    importance: FIELD_IMPORTANCE.REQUIRED,
    category: FIELD_CATEGORIES.MEDICAL,
    tooltip:
      "Conditions being claimed. Must be specific and service-connected.",
    validation: (val) => Array.isArray(val) && val.length > 0,
  },

  serviceConnection: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.SERVICE,
    tooltip:
      "How condition is service-connected (direct, secondary, aggravated, presumptive).",
    validation: (val) => val && val.length > 0,
  },

  address: {
    importance: FIELD_IMPORTANCE.IMPORTANT,
    category: FIELD_CATEGORIES.CONTACT,
    tooltip:
      "Mailing address for VA correspondence. Must be current or claim letters will be missed.",
    validation: (val) => val && val.length > 5,
  },

  phone: {
    importance: FIELD_IMPORTANCE.OPTIONAL,
    category: FIELD_CATEGORIES.CONTACT,
    tooltip: "Contact number. VA may call for additional information.",
    validation: null,
  },
};

/**
 * Master collection rules by document type
 */
export const COLLECTION_RULES = {
  [DOCUMENT_TYPES.DD214]: DD214_RULES,
  [DOCUMENT_TYPES.RATING_DECISION]: RATING_DECISION_RULES,
  [DOCUMENT_TYPES.CP_EXAM]: CP_EXAM_RULES,
  [DOCUMENT_TYPES.MEDICAL_RECORDS]: MEDICAL_RECORDS_RULES,
  [DOCUMENT_TYPES.VA_CLAIM_FORM]: VA_CLAIM_FORM_RULES,

  // Default rules for other document types
  [DOCUMENT_TYPES.UNKNOWN]: {
    veteranName: {
      importance: FIELD_IMPORTANCE.OPTIONAL,
      tooltip: "Helps identify document owner.",
    },
    text: {
      importance: FIELD_IMPORTANCE.IMPORTANT,
      tooltip: "Full text preserved for future analysis.",
    },
  },
};

/**
 * Get collection rules for a document type
 */
export function getCollectionRules(documentType) {
  return (
    COLLECTION_RULES[documentType] || COLLECTION_RULES[DOCUMENT_TYPES.UNKNOWN]
  );
}

/**
 * Get tooltip for a field
 */
export function getFieldTooltip(field, documentType) {
  const rules = getCollectionRules(documentType);
  const rule = rules[field];
  return rule?.tooltip || null;
}

/**
 * Check if field should be collected
 */
export function shouldCollectField(field, documentType) {
  const rules = getCollectionRules(documentType);
  const rule = rules[field];
  return !rule || rule.importance !== FIELD_IMPORTANCE.IGNORE;
}

/**
 * Get field category
 */
export function getFieldCategory(field, documentType) {
  const rules = getCollectionRules(documentType);
  const rule = rules[field];
  return rule?.category || FIELD_CATEGORIES.ADMINISTRATIVE;
}

/**
 * Group fields by category
 */
export function groupFieldsByCategory(extractedData, documentType) {
  const rules = getCollectionRules(documentType);
  const grouped = {};

  for (const [field, value] of Object.entries(extractedData)) {
    const category = getFieldCategory(field, documentType);

    if (!grouped[category]) {
      grouped[category] = {};
    }

    grouped[category][field] = value;
  }

  return grouped;
}
