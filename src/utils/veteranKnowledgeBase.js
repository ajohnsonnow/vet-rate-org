/**
 * Vet-Rate.org - Veteran Knowledge Base (VKB)
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * The VKB is a structured, AI-queryable knowledge graph built from:
 * - DD-214 documents
 * - Blue Button medical records
 * - C-File claim documents
 * - Muster Call batch processing
 * 
 * Purpose: Give LLMs complete context about a veteran's claim without
 * repeatedly parsing documents. One source of truth for all AI agents.
 */

const VKB_STORAGE_KEY = 'vetrate_knowledge_base';
const VKB_VERSION = '1.0.0';

/**
 * Veteran Knowledge Base Schema
 * 
 * This structure is optimized for LLM consumption - clear hierarchy,
 * minimal nesting, timestamped entries, source attribution.
 */
export const VKB_SCHEMA = {
  metadata: {
    version: VKB_VERSION,
    lastUpdated: null, // ISO timestamp
    documentCount: 0,
    completeness: 0, // 0-100 score based on filled fields
  },
  
  personal: {
    fullName: null,
    dateOfBirth: null,
    ssn: null, // Last 4 only
    veteranFileNumber: null,
    email: null,
    phone: null,
    address: {
      street: null,
      city: null,
      state: null,
      zip: null,
    },
  },
  
  serviceHistory: {
    branch: null, // Army, Navy, Air Force, Marines, Coast Guard, Space Force
    entryDate: null,
    separationDate: null,
    yearsOfService: null,
    rank: {
      entry: null,
      discharge: null,
    },
    mos: [], // [{code, title, dates, hazards}]
    characterOfService: null, // Honorable, General, etc.
    deployments: [], // [{location, startDate, endDate, combatZone, operation}]
    awards: [], // [{name, date, isCombat, devices}]
    foreignService: false,
    reenlisted: false,
  },
  
  medicalConditions: {
    current: [], // [{name, diagnosisDate, icdCode, severity, ratedPercentage, serviceConnected}]
    past: [], // Historical conditions
    secondary: [], // [{condition, primaryCondition, relationship}]
    presumptive: [], // [{condition, exposureType, eligibleUnder}]
  },
  
  medications: {
    current: [], // [{name, dosage, frequency, startDate, prescribedFor}]
    past: [], // Historical meds
  },
  
  treatments: {
    procedures: [], // [{name, date, provider, outcome, relatedCondition}]
    therapies: [], // [{type, startDate, endDate, frequency, relatedCondition}]
    hospitalizations: [], // [{facility, admitDate, dischargeDate, reason, duration}]
  },
  
  medicalAppointments: {
    cAndPExams: [], // [{date, examiner, conditionsExamined, findings, dbqSubmitted}]
    vaAppointments: [], // [{date, facility, provider, reason, notes}]
    privateDoctor: [], // [{date, provider, specialty, reason, notes}]
  },
  
  vaClaimsHistory: {
    claims: [], // [{claimNumber, filedDate, status, decision, decisionDate, conditions}]
    ratings: [], // [{condition, percentage, effectiveDate, combinedRating}]
    appeals: [], // [{claimNumber, appealDate, status, boardDate, decision}]
  },
  
  exposures: {
    environmental: [], // [{type, location, dates, documentation}] - Agent Orange, burn pits, etc.
    occupational: [], // [{hazard, mos, dates, protectionUsed}]
    combat: [], // [{incident, date, location, injuries, documentation}]
  },
  
  evidenceTimeline: [], // [{date, eventType, description, source, significance}]
  
  keyFacts: [], // [{fact, source, documentId, pageNumber, extractedText, importance}]
  
  nexusStatements: [], // [{condition, statedBy, date, relationship, documentSource}]
  
  documentation: {
    dd214s: [], // [{id, fileName, uploadDate, pageCount, extracted}]
    blueButtonReports: [], // [{id, fileName, uploadDate, dateRange, recordCount}]
    cFiles: [], // [{id, fileName, uploadDate, pageCount, claimNumber}]
    privateRecords: [], // [{id, fileName, uploadDate, provider, dateRange}]
    otherEvidence: [], // [{id, fileName, uploadDate, category, description}]
  },
  
  aiInsights: {
    strengthsOfClaim: [], // [{condition, strength, reasons}]
    weaknesses: [], // [{condition, weakness, recommendations}]
    missingEvidence: [], // [{condition, evidenceType, howToObtain, priority}]
    suggestedSecondaries: [], // [{primaryCondition, secondaryCondition, likelihood, rationale}]
  },
};

/**
 * Initialize empty VKB
 */
export const initializeVKB = () => {
  const vkb = JSON.parse(JSON.stringify(VKB_SCHEMA));
  vkb.metadata.lastUpdated = new Date().toISOString();
  return vkb;
};

/**
 * Load VKB from localStorage
 */
export const loadVKB = () => {
  try {
    const stored = localStorage.getItem(VKB_STORAGE_KEY);
    if (!stored) return initializeVKB();
    
    const vkb = JSON.parse(stored);
    
    // Version migration (future-proofing)
    if (vkb.metadata.version !== VKB_VERSION) {
      console.log(`Migrating VKB from ${vkb.metadata.version} to ${VKB_VERSION}`);
      // Future migration logic here
    }
    
    return vkb;
  } catch (err) {
    console.error('Error loading VKB:', err);
    return initializeVKB();
  }
};

/**
 * Save VKB to localStorage
 */
export const saveVKB = (vkb) => {
  try {
    vkb.metadata.lastUpdated = new Date().toISOString();
    vkb.metadata.completeness = calculateCompleteness(vkb);
    localStorage.setItem(VKB_STORAGE_KEY, JSON.stringify(vkb));
    return { success: true };
  } catch (err) {
    console.error('Error saving VKB:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Add a document to VKB with full metadata
 * Keeps each document's data separate and organized
 */
export const addDocumentToVKB = (documentInfo) => {
  const vkb = loadVKB();
  
  const docEntry = {
    id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fileName: documentInfo.fileName,
    uploadDate: new Date().toISOString(),
    fileSize: documentInfo.fileSize,
    pageCount: documentInfo.pageCount || 1,
    classification: documentInfo.classification || 'unknown',
    extractedText: documentInfo.extractedText || '',
    extractedData: documentInfo.extractedData || {},
    ocrUsed: documentInfo.ocrUsed || false,
    method: documentInfo.method || 'text',
  };

  // Route to appropriate documentation category
  switch (documentInfo.classification) {
    case 'DD214':
    case 'service_record':
      vkb.documentation.dd214s.push(docEntry);
      break;
    
    case 'blue_button':
    case 'medical_record':
      vkb.documentation.blueButtonReports.push(docEntry);
      break;
    
    case 'c_file':
    case 'rating_decision':
    case 'claim_letter':
    case 'va_decision':
      vkb.documentation.cFiles.push(docEntry);
      break;
    
    case 'private_medical':
    case 'provider_letter':
    case 'nexus_letter':
      vkb.documentation.privateRecords.push(docEntry);
      break;
    
    default:
      vkb.documentation.otherEvidence.push(docEntry);
  }

  vkb.metadata.documentCount = 
    vkb.documentation.dd214s.length +
    vkb.documentation.blueButtonReports.length +
    vkb.documentation.cFiles.length +
    vkb.documentation.privateRecords.length +
    vkb.documentation.otherEvidence.length;

  saveVKB(vkb);
  return { success: true, documentId: docEntry.id, vkb };
};

/**
 * Get all documents from VKB
 */
export const getAllDocumentsFromVKB = () => {
  const vkb = loadVKB();
  return [
    ...vkb.documentation.dd214s,
    ...vkb.documentation.blueButtonReports,
    ...vkb.documentation.cFiles,
    ...vkb.documentation.privateRecords,
    ...vkb.documentation.otherEvidence,
  ];
};

/**
 * Get specific document by ID
 */
export const getDocumentFromVKB = (documentId) => {
  const allDocs = getAllDocumentsFromVKB();
  return allDocs.find(doc => doc.id === documentId);
};

/**
 * Calculate VKB completeness score (0-100)
 */
export const calculateCompleteness = (vkb) => {
  let score = 0;
  let maxScore = 0;
  
  // Personal info (20 points)
  maxScore += 20;
  if (vkb.personal.fullName) score += 5;
  if (vkb.personal.dateOfBirth) score += 5;
  if (vkb.personal.address.state) score += 5;
  if (vkb.personal.email || vkb.personal.phone) score += 5;
  
  // Service history (25 points)
  maxScore += 25;
  if (vkb.serviceHistory.branch) score += 5;
  if (vkb.serviceHistory.entryDate) score += 5;
  if (vkb.serviceHistory.separationDate) score += 5;
  if (vkb.serviceHistory.mos.length > 0) score += 5;
  if (vkb.serviceHistory.characterOfService) score += 5;
  
  // Medical conditions (30 points)
  maxScore += 30;
  if (vkb.medicalConditions.current.length > 0) score += 15;
  if (vkb.medicalConditions.secondary.length > 0) score += 10;
  if (vkb.medications.current.length > 0) score += 5;
  
  // Evidence (15 points)
  maxScore += 15;
  if (vkb.documentation.dd214s.length > 0) score += 5;
  if (vkb.documentation.blueButtonReports.length > 0) score += 5;
  if (vkb.evidenceTimeline.length > 0) score += 5;
  
  // Claims history (10 points)
  maxScore += 10;
  if (vkb.vaClaimsHistory.claims.length > 0) score += 5;
  if (vkb.vaClaimsHistory.ratings.length > 0) score += 5;
  
  return Math.round((score / maxScore) * 100);
};

/**
 * Merge data from DD-214 into VKB
 */
export const mergeDD214IntoVKB = (vkb, dd214Data) => {
  // Personal info
  if (dd214Data.name && !vkb.personal.fullName) {
    vkb.personal.fullName = dd214Data.name;
  }
  if (dd214Data.ssn && !vkb.personal.ssn) {
    vkb.personal.ssn = dd214Data.ssn.slice(-4);
  }
  
  // Service history
  vkb.serviceHistory.branch = dd214Data.branch || vkb.serviceHistory.branch;
  vkb.serviceHistory.entryDate = dd214Data.entryDate || vkb.serviceHistory.entryDate;
  vkb.serviceHistory.separationDate = dd214Data.separationDate || vkb.serviceHistory.separationDate;
  vkb.serviceHistory.yearsOfService = dd214Data.yearsService || vkb.serviceHistory.yearsOfService;
  vkb.serviceHistory.characterOfService = dd214Data.characterOfService || vkb.serviceHistory.characterOfService;
  vkb.serviceHistory.reenlisted = dd214Data.reenlisted || vkb.serviceHistory.reenlisted;
  vkb.serviceHistory.foreignService = dd214Data.foreignService || vkb.serviceHistory.foreignService;
  
  // MOS
  if (dd214Data.mos && dd214Data.mosTitle) {
    const existingMOS = vkb.serviceHistory.mos.find(m => m.code === dd214Data.mos);
    if (!existingMOS) {
      vkb.serviceHistory.mos.push({
        code: dd214Data.mos,
        title: dd214Data.mosTitle,
        dates: {
          start: dd214Data.entryDate,
          end: dd214Data.separationDate,
        },
        hazards: [], // To be filled by MOS Hazard Matcher
      });
    }
  }
  
  // Awards
  if (dd214Data.awards && Array.isArray(dd214Data.awards)) {
    dd214Data.awards.forEach(award => {
      const existingAward = vkb.serviceHistory.awards.find(a => 
        a.name === award.name || a.name === award.abbreviation
      );
      if (!existingAward) {
        vkb.serviceHistory.awards.push({
          name: award.name,
          date: null,
          isCombat: award.isCombat || false,
          devices: award.devices || [],
        });
      }
    });
  }
  
  // Documentation
  vkb.documentation.dd214s.push({
    id: `dd214-${Date.now()}`,
    fileName: 'DD-214',
    uploadDate: new Date().toISOString(),
    pageCount: dd214Data.pageCount || 1,
    extracted: true,
  });
  
  vkb.metadata.documentCount++;
  return vkb;
};

/**
 * Merge data from Blue Button into VKB
 */
export const mergeBlueButtonIntoVKB = (vkb, blueButtonData) => {
  // Medical conditions
  if (blueButtonData.conditions && Array.isArray(blueButtonData.conditions)) {
    blueButtonData.conditions.forEach(condition => {
      const existingCondition = vkb.medicalConditions.current.find(c => 
        c.name.toLowerCase() === condition.standardizedName.toLowerCase()
      );
      
      if (!existingCondition) {
        vkb.medicalConditions.current.push({
          name: condition.standardizedName,
          diagnosisDate: condition.dateFound || null,
          icdCode: null,
          severity: null,
          ratedPercentage: null,
          serviceConnected: null,
          source: 'Blue Button',
        });
      }
    });
  }
  
  // Evidence timeline
  if (blueButtonData.conditions && Array.isArray(blueButtonData.conditions)) {
    blueButtonData.conditions.forEach(condition => {
      if (condition.dateFound) {
        vkb.evidenceTimeline.push({
          date: condition.dateFound,
          eventType: 'diagnosis',
          description: `Diagnosed with ${condition.standardizedName}`,
          source: 'Blue Button Report',
          significance: 'medical_diagnosis',
        });
      }
    });
  }
  
  // Documentation
  vkb.documentation.blueButtonReports.push({
    id: `bluebutton-${Date.now()}`,
    fileName: 'VA Blue Button Report',
    uploadDate: new Date().toISOString(),
    dateRange: null,
    recordCount: blueButtonData.conditions?.length || 0,
  });
  
  vkb.metadata.documentCount++;
  return vkb;
};

/**
 * Merge data from Muster Call into VKB
 */
export const mergeMusterCallIntoVKB = (vkb, musterCallData) => {
  // Muster Call returns combined data from multiple documents
  // Route to appropriate merge functions based on document type
  
  if (musterCallData.dd214) {
    vkb = mergeDD214IntoVKB(vkb, musterCallData.dd214);
  }
  
  if (musterCallData.blueButton) {
    vkb = mergeBlueButtonIntoVKB(vkb, musterCallData.blueButton);
  }
  
  // Generic document metadata
  if (musterCallData.documents) {
    musterCallData.documents.forEach(doc => {
      vkb.documentation.otherEvidence.push({
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fileName: doc.fileName,
        uploadDate: new Date().toISOString(),
        category: doc.type || 'other',
        description: doc.summary || '',
      });
    });
  }
  
  return vkb;
};

/**
 * Generate LLM context string from VKB
 * This is what we'll inject into AI prompts
 */
export const generateLLMContext = (vkb) => {
  let context = '=== VETERAN KNOWLEDGE BASE ===\n\n';
  
  // Personal
  if (vkb.personal.fullName) {
    context += `Veteran: ${vkb.personal.fullName}\n`;
  }
  if (vkb.personal.dateOfBirth) {
    context += `DOB: ${vkb.personal.dateOfBirth}\n`;
  }
  
  // Service
  context += '\n--- SERVICE HISTORY ---\n';
  if (vkb.serviceHistory.branch) {
    context += `Branch: ${vkb.serviceHistory.branch}\n`;
  }
  if (vkb.serviceHistory.entryDate && vkb.serviceHistory.separationDate) {
    context += `Service: ${vkb.serviceHistory.entryDate} to ${vkb.serviceHistory.separationDate} (${vkb.serviceHistory.yearsOfService} years)\n`;
  }
  if (vkb.serviceHistory.mos.length > 0) {
    context += `MOS: ${vkb.serviceHistory.mos.map(m => `${m.code} (${m.title})`).join(', ')}\n`;
  }
  if (vkb.serviceHistory.characterOfService) {
    context += `Discharge: ${vkb.serviceHistory.characterOfService}\n`;
  }
  
  // Conditions
  context += '\n--- CLAIMED CONDITIONS ---\n';
  vkb.medicalConditions.current.forEach(condition => {
    context += `• ${condition.name}`;
    if (condition.diagnosisDate) context += ` (diagnosed ${condition.diagnosisDate})`;
    if (condition.ratedPercentage) context += ` [${condition.ratedPercentage}% rated]`;
    context += '\n';
  });
  
  // Secondary conditions
  if (vkb.medicalConditions.secondary.length > 0) {
    context += '\n--- SECONDARY CONDITIONS ---\n';
    vkb.medicalConditions.secondary.forEach(sec => {
      context += `• ${sec.condition} (secondary to ${sec.primaryCondition})\n`;
    });
  }
  
  // Evidence
  context += '\n--- EVIDENCE ON FILE ---\n';
  context += `DD-214s: ${vkb.documentation.dd214s.length}\n`;
  context += `Blue Button Reports: ${vkb.documentation.blueButtonReports.length}\n`;
  context += `C-Files: ${vkb.documentation.cFiles.length}\n`;
  context += `Private Records: ${vkb.documentation.privateRecords.length}\n`;
  context += `Other Evidence: ${vkb.documentation.otherEvidence.length}\n`;
  
  // Key facts
  if (vkb.keyFacts.length > 0) {
    context += '\n--- KEY FACTS ---\n';
    vkb.keyFacts.slice(0, 10).forEach(fact => { // Top 10 most important
      context += `• ${fact.fact} [Source: ${fact.source}]\n`;
    });
  }
  
  // AI Insights
  if (vkb.aiInsights.missingEvidence.length > 0) {
    context += '\n--- MISSING EVIDENCE ---\n';
    vkb.aiInsights.missingEvidence.slice(0, 5).forEach(missing => {
      context += `• ${missing.condition}: Need ${missing.evidenceType}\n`;
    });
  }
  
  context += '\n=== END KNOWLEDGE BASE ===\n';
  return context;
};

/**
 * Export VKB for backup
 */
export const exportVKB = () => {
  const vkb = loadVKB();
  const blob = new Blob([JSON.stringify(vkb, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vetrate-knowledge-base-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Import VKB from file
 */
export const importVKB = (fileContent) => {
  try {
    const vkb = JSON.parse(fileContent);
    if (!vkb.metadata || !vkb.personal || !vkb.serviceHistory) {
      throw new Error('Invalid VKB format');
    }
    saveVKB(vkb);
    return { success: true };
  } catch (err) {
    console.error('Error importing VKB:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Clear entire VKB (with confirmation)
 */
export const clearVKB = () => {
  localStorage.removeItem(VKB_STORAGE_KEY);
  return initializeVKB();
};
