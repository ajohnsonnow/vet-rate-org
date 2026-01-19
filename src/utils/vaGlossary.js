/**
 * VA Terminology Glossary - "Jargon Decoder"
 * Comprehensive dictionary of VA acronyms and terminology
 * Used for automatic tooltip generation throughout the application
 * 
 * Last updated: January 19, 2026
 * Verified against 38 CFR Parts 3 & 4
 */

export const VA_GLOSSARY = {
  // Core VA Terms
  'C&P': 'Compensation & Pension Exam - A medical examination scheduled by the VA to evaluate your claimed disability',
  'C&P Exam': 'Compensation & Pension Exam - A medical examination scheduled by the VA to evaluate your claimed disability',
  'DBQ': 'Disability Benefits Questionnaire - A standardized form used by medical providers to document disability evaluations for VA claims',
  'VARO': 'VA Regional Office - The local VA office that processes disability claims for your region',
  'DRO': 'Decision Review Officer - A senior VA employee who reviews claim decisions during the appeals process',
  'VSO': 'Veterans Service Organization - Accredited organizations (like DAV, VFW, American Legion) that provide free help with VA claims',
  'NEXUS': 'Medical link or connection between your service-connected condition and your claimed disability. Often stated as "at least as likely as not"',
  'Nexus': 'Medical link or connection between your service-connected condition and your claimed disability. Often stated as "at least as likely as not"',
  'Nexus Letter': 'A medical opinion letter from a doctor establishing the connection between your service/service-connected condition and your current disability',
  'VA': 'Department of Veterans Affairs - The federal agency responsible for providing benefits and services to veterans',
  'VBA': 'Veterans Benefits Administration - The VA division that handles disability compensation, pension, and other benefits',
  'VHA': 'Veterans Health Administration - The VA division that provides healthcare services to veterans',
  
  // Claim Types
  'SC': 'Service-Connected - A disability that was caused or aggravated by military service',
  'NSC': 'Non-Service-Connected - A disability not related to military service',
  'P&T': 'Permanent and Total - A 100% disability rating that VA considers permanent and unlikely to improve',
  'TDIU': 'Total Disability Individual Unemployability - Provides 100% compensation when service-connected disabilities prevent substantial gainful employment',
  'SMC': 'Special Monthly Compensation - Additional compensation for veterans with severe disabilities like loss of limbs, blindness, or need for aid and attendance',
  'IU': 'Individual Unemployability - See TDIU',
  'Secondary Condition': 'A disability caused or aggravated by an already service-connected condition (38 CFR 3.310)',
  'Aggravation': 'Worsening of a pre-existing condition beyond natural progression due to military service',
  'Direct Service Connection': 'A disability directly caused by an event, injury, or disease during military service',
  
  // Appeals & Review
  'BVA': 'Board of Veterans\' Appeals - The appellate body that reviews claim decisions when higher-level review doesn\'t resolve the issue',
  'NOD': 'Notice of Disagreement - The initial appeal filed when you disagree with a VA decision',
  'HLR': 'Higher-Level Review - A review of your claim by a senior VA employee using only existing evidence',
  'SOC': 'Statement of the Case - The VA\'s detailed explanation of their decision on your claim',
  'SSOC': 'Supplemental Statement of the Case - Additional VA explanation issued after new evidence or arguments',
  'CUE': 'Clear and Unmistakable Error - A specific type of appeal arguing the VA made an obvious mistake in law or fact',
  'AMA': 'Appeals Modernization Act - The current VA appeals process implemented in 2019, offering three decision review lanes',
  'Legacy': 'Legacy Appeals System - The old VA appeals process (pre-2019). Some claims are still in this system',
  'Supplemental Claim': 'An appeal lane where you submit new and relevant evidence to reopen a denied claim',
  'De Novo Review': 'A fresh look at your claim by a different reviewer (used in Higher-Level Review)',
  'Remand': 'When the BVA sends a case back to the regional office for additional development',
  
  // Evidence & Documentation
  'IMO': 'Independent Medical Opinion - A private medical evaluation obtained by the veteran, often a nexus letter',
  'IME': 'Independent Medical Examination - Similar to IMO, a private medical exam obtained outside the VA system',
  'Lay Evidence': 'Personal statements from the veteran, buddies, or family members describing symptoms and functional impact',
  'Buddy Statement': 'A sworn statement from someone who witnessed your condition during or after service, often filed on VA Form 21-10210',
  'VA Form 21-526EZ': 'Application for Disability Compensation and Related Compensation Benefits - The main form to file a VA disability claim',
  'VA Form 21-4138': 'Statement in Support of Claim - A general-purpose form for submitting personal statements and additional information',
  'VA Form 21-0781': 'Statement in Support of Claim for PTSD - Specialized form for describing PTSD stressors',
  'VA Form 21-0781a': 'Statement in Support of Claim for PTSD Secondary to Personal Assault - Specialized form for PTSD from MST or personal trauma',
  'VA Form 21-10210': 'Lay/Witness Statement - Form for buddy statements from people who observed your condition',
  'VA Form 21-0966': 'Intent to File - Locks in your effective date for up to 1 year while you gather evidence',
  'VA Form 21-8940': 'Veterans Application for Increased Compensation Based on Unemployability - The form to apply for TDIU',
  'VA Form 21-4192': 'Request for Employment Information in Connection with Claim for Disability Benefits - Employer verification for TDIU',
  'VA Form 20-0995': 'Decision Review Request: Supplemental Claim - Used to submit new evidence on a denied claim',
  'VA Form 20-0996': 'Decision Review Request: Higher-Level Review - Used to request senior reviewer look at your claim',
  
  // Medical Records
  'STR': 'Service Treatment Records - Your official military medical records created during active duty',
  'C-File': 'Claims File - Your complete VA claims folder containing all evidence, decisions, and correspondence',
  'VBMS': 'Veterans Benefits Management System - The VA\'s electronic claims processing system',
  'CAPRI': 'Computerized Patient Record Interface - VA\'s internal medical records system',
  'Blue Button': 'VA\'s online tool to download your VA medical records and health information',
  'FOIA': 'Freedom of Information Act - Legal right to request copies of your records from VA and DoD',
  'DD-214': 'Certificate of Release or Discharge from Active Duty - Official proof of military service',
  'MEB': 'Medical Evaluation Board - Military board that determines fitness for duty due to medical conditions',
  'PEB': 'Physical Evaluation Board - Military board that determines disability rating upon separation',
  
  // Rating & Evaluation
  'CFR': 'Code of Federal Regulations - The legal framework governing VA disability ratings. Title 38 CFR covers veterans benefits',
  '38 CFR': 'Title 38 of the Code of Federal Regulations - The specific section of law covering VA disability rating criteria',
  '38 CFR Part 3': 'Adjudication rules - Covers who qualifies, how claims are processed, and eligibility requirements',
  '38 CFR Part 4': 'Schedule for Rating Disabilities (VASRD) - Contains all diagnostic codes and rating criteria',
  'Diagnostic Code': 'Specific numerical code in 38 CFR used to rate a particular condition (e.g., DC 5003 for arthritis)',
  'DC': 'Diagnostic Code - See Diagnostic Code',
  'Pyramiding': 'Illegal practice of rating the same disability or symptoms under multiple diagnostic codes',
  'Bilateral Factor': 'Additional percentage added when you have the same disability affecting both sides of your body',
  'Combined Rating': 'The VA\'s unique math formula for combining multiple disability ratings (not simple addition)',
  'Schedular Rating': 'A disability rating based on the criteria in 38 CFR Part 4',
  'Extraschedular Rating': 'A rating above the schedule maximum for exceptional cases (38 CFR 3.321)',
  'Staged Rating': 'Different rating percentages for different time periods based on changing severity',
  'Protected Rating': 'A rating that cannot be reduced once held for 20+ years (38 CFR 3.951)',
  
  // PACT Act & Exposures
  'PACT Act': 'Promise to Address Comprehensive Toxics Act - Expands VA benefits for veterans exposed to burn pits, Agent Orange, and other toxic substances',
  'Presumptive': 'A condition automatically assumed to be service-connected if you served in certain locations or time periods',
  'Gulf War Illness': 'Medically unexplained chronic symptoms affecting Gulf War veterans, presumed service-connected',
  'Agent Orange': 'Toxic herbicide used in Vietnam; certain conditions are presumptive for exposed veterans',
  'Burn Pit': 'Open-air waste burning common in Iraq/Afghanistan; PACT Act establishes presumptive conditions',
  'Camp Lejeune': 'Marine base with contaminated water (1953-1987); presumptive conditions established by PACT Act',
  'Radiation Exposure': 'Exposure to ionizing radiation during service; certain conditions are presumptive',
  'Persian Gulf War': 'Operations after August 2, 1990; qualifies for Gulf War presumptive conditions',
  'Southwest Asia': 'Iraq, Kuwait, Saudi Arabia, and surrounding areas - location for Gulf War presumptives',
  
  // Special Programs
  'VR&E': 'Vocational Rehabilitation & Employment - VA program providing job training and employment support (formerly Voc Rehab)',
  'Chapter 31': 'Another name for VR&E/Vocational Rehabilitation',
  'IDES': 'Integrated Disability Evaluation System - DoD/VA process for evaluating disabilities before separation from service',
  'QTC': 'QTC Medical Services - One of the private contractors VA uses to conduct C&P exams',
  'LHI': 'Logistics Health Incorporated - Another VA contractor that conducts C&P exams',
  'VES': 'Veterans Evaluation Services - Another VA contractor for C&P exams',
  'CHAMPVA': 'Civilian Health and Medical Program of VA - Healthcare for dependents of P&T veterans',
  'VA Pension': 'Non-service-connected pension for low-income wartime veterans',
  'Aid & Attendance': 'Additional benefit for veterans who need help with daily activities',
  'Housebound': 'Additional benefit for veterans substantially confined to their home',
  
  // Legal & Representation
  'NOVA': 'National Organization of Veterans\' Advocates - Professional association of VA-accredited attorneys',
  'OGC': 'Office of General Counsel - VA\'s legal department',
  'CAVC': 'Court of Appeals for Veterans Claims - Federal court that reviews BVA decisions',
  'Ebenefits': 'VA\'s online portal for managing claims and viewing disability ratings (being replaced by VA.gov)',
  'POA': 'Power of Attorney - Document authorizing a VSO or attorney to represent you',
  'VA Form 21-22': 'Appointment of Veterans Service Organization as Claimant Representative',
  'VA Form 21-22a': 'Appointment of Individual as Claimant Representative (for attorneys/agents)',
  
  // Common Medical Terms
  'ROM': 'Range of Motion - Measurement of joint flexibility, critical for musculoskeletal ratings',
  'MST': 'Military Sexual Trauma - Sexual assault or harassment experienced during military service',
  'TBI': 'Traumatic Brain Injury - Brain injury from blast, impact, or concussion during service',
  'PTSD': 'Post-Traumatic Stress Disorder - Mental health condition triggered by traumatic events',
  'MDD': 'Major Depressive Disorder - Clinical depression that may be service-connected',
  'GAD': 'Generalized Anxiety Disorder - Chronic anxiety that may be service-connected',
  'GAF': 'Global Assessment of Functioning - Outdated mental health rating scale (no longer used by VA)',
  'WHODAS': 'World Health Organization Disability Assessment Schedule - Current tool VA uses to assess functional impairment',
  'ADL': 'Activities of Daily Living - Basic self-care tasks like bathing, dressing, eating',
  'IADL': 'Instrumental Activities of Daily Living - Complex tasks like cooking, cleaning, managing finances',
  'ICD-10': 'International Classification of Diseases, 10th Edition - Standard medical diagnosis codes',
  'DSM-5': 'Diagnostic and Statistical Manual of Mental Disorders, 5th Edition - Mental health diagnosis criteria',
  
  // Time Periods & Dates
  'EED': 'Earliest Effective Date - The date VA uses to calculate when benefits begin, usually the claim filing date',
  'Intent to File': 'VA Form 21-0966 - Locks in an effective date while you gather evidence for your claim',
  'FDC': 'Fully Developed Claim - A claim submitted with all evidence upfront for faster processing',
  'Effective Date': 'The date from which VA compensation payments begin',
  'Backpay': 'Retroactive compensation from your effective date to the present',
  'Date of Claim': 'The official date VA receives your claim or Intent to File',
  
  // Compensation Rates
  'VA Math': 'The VA\'s unique method of combining disability percentages (uses efficiency of function, not simple addition)',
  'Whole Person Theory': 'VA rating concept that additional disabilities have smaller impact on already-disabled person',
  'DEA': 'Dependents\' Educational Assistance (Chapter 35) - Education benefits for dependents of 100% P&T veterans',
  'Chapter 35': 'See DEA - education benefits for dependents',
  'DIC': 'Dependency and Indemnity Compensation - Benefits for surviving spouses and dependents of veterans who died from service-connected disabilities',
  'SBP': 'Survivor Benefit Plan - DoD program that may offset DIC payments',
  
  // Common Phrases
  'at least as likely as not': 'Medical probability of 50% or greater - the standard required for VA nexus opinions',
  '50/50 rule': 'Legal principle that VA must give veterans the benefit of the doubt when evidence is equal on both sides',
  'favorable finding': 'Evidence or testimony that supports the veteran\'s claim',
  'duty to assist': 'VA\'s legal obligation to help veterans develop evidence for their claims',
  'benefit of the doubt': 'When evidence is approximately equal, VA must decide in favor of the veteran (38 CFR 3.102)',
  'probative value': 'The weight or persuasiveness of evidence in supporting a claim',
  'preponderance of evidence': 'Standard where more evidence supports one side than the other',
  'material fact': 'A fact significant enough to affect the outcome of a claim',
  'competent evidence': 'Evidence from a qualified source (medical evidence from doctors, lay evidence from witnesses)',
  'credible evidence': 'Evidence that is believable and trustworthy',
};

/**
 * Pattern-based matching for multi-word terms and variations
 * Key: regex pattern, Value: definition key in VA_GLOSSARY
 */
export const VA_GLOSSARY_PATTERNS = [
  { pattern: /\bC&P\s+Exam\b/gi, key: 'C&P Exam' },
  { pattern: /\bC&P\b/gi, key: 'C&P' },
  { pattern: /\bNexus\s+Letter\b/gi, key: 'Nexus Letter' },
  { pattern: /\bVA\s+Form\s+21-526EZ\b/gi, key: 'VA Form 21-526EZ' },
  { pattern: /\bVA\s+Form\s+21-4138\b/gi, key: 'VA Form 21-4138' },
  { pattern: /\bVA\s+Form\s+21-0781a?\b/gi, key: 'VA Form 21-0781' },
  { pattern: /\bVA\s+Form\s+21-10210\b/gi, key: 'VA Form 21-10210' },
  { pattern: /\bBuddy\s+Statement\b/gi, key: 'Buddy Statement' },
  { pattern: /\bLay\s+Evidence\b/gi, key: 'Lay Evidence' },
  { pattern: /\b38\s+CFR\b/gi, key: '38 CFR' },
  { pattern: /\bDiagnostic\s+Code\b/gi, key: 'Diagnostic Code' },
  { pattern: /\bCombined\s+Rating\b/gi, key: 'Combined Rating' },
  { pattern: /\bGulf\s+War\s+Illness\b/gi, key: 'Gulf War Illness' },
  { pattern: /\bAgent\s+Orange\b/gi, key: 'Agent Orange' },
  { pattern: /\bBurn\s+Pit\b/gi, key: 'Burn Pit' },
  { pattern: /\bat\s+least\s+as\s+likely\s+as\s+not\b/gi, key: 'at least as likely as not' },
];

/**
 * Get definition for a VA term
 * @param {string} term - The VA term to look up
 * @returns {string|null} - The definition or null if not found
 */
export const getDefinition = (term) => {
  return VA_GLOSSARY[term] || null;
};

/**
 * Check if a term exists in the glossary
 * @param {string} term - The term to check
 * @returns {boolean}
 */
export const hasDefinition = (term) => {
  return term in VA_GLOSSARY;
};

/**
 * Get all glossary terms (for autocomplete, search, etc.)
 * @returns {string[]}
 */
export const getAllTerms = () => {
  return Object.keys(VA_GLOSSARY);
};

export default VA_GLOSSARY;
