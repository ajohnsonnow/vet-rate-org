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
 * 
 * Storage: Uses IndexedDB as primary storage (unlimited capacity)
 * with localStorage as metadata cache only.
 */

const VKB_STORAGE_KEY = 'vetrate_knowledge_base';
const VKB_VERSION = '1.0.0';

// IndexedDB Configuration
const VKB_DB_NAME = 'VetRateVKB';
const VKB_DB_VERSION = 1;
const VKB_STORE_NAME = 'knowledge_base';

let vkbDB = null;

/**
 * Open/Initialize the VKB IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
const openVKBDatabase = () => {
  return new Promise((resolve, reject) => {
    if (vkbDB) {
      resolve(vkbDB);
      return;
    }

    const request = indexedDB.open(VKB_DB_NAME, VKB_DB_VERSION);

    request.onerror = () => {
      console.error('❌ Failed to open VKB database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      vkbDB = request.result;
      console.log('✅ VKB IndexedDB opened successfully');
      resolve(vkbDB);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Create VKB store
      if (!database.objectStoreNames.contains(VKB_STORE_NAME)) {
        const vkbStore = database.createObjectStore(VKB_STORE_NAME, { keyPath: 'id' });
        vkbStore.createIndex('lastUpdated', 'metadata.lastUpdated', { unique: false });
        console.log('✅ VKB object store created');
      }
    };
  });
};

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
 * Load VKB from IndexedDB (primary) or localStorage (legacy fallback)
 */
export const loadVKB = async () => {
  try {
    // Try IndexedDB first
    const db = await openVKBDatabase();
    const transaction = db.transaction([VKB_STORE_NAME], 'readonly');
    const store = transaction.objectStore(VKB_STORE_NAME);
    const request = store.get('main');

    return new Promise((resolve) => {
      request.onsuccess = () => {
        if (request.result) {
          console.log('📂 Loaded VKB from IndexedDB');
          // Cache metadata in localStorage for quick access
          try {
            localStorage.setItem(VKB_STORAGE_KEY, JSON.stringify({ 
              metadata: request.result.metadata,
              source: 'indexeddb'
            }));
          } catch (e) {
            // Ignore localStorage errors
          }
          resolve(request.result);
        } else {
          // Try localStorage for legacy data
          console.log('📂 No IndexedDB VKB, checking localStorage...');
          try {
            const stored = localStorage.getItem(VKB_STORAGE_KEY);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed.overflow || parsed.source === 'indexeddb') {
                // This is just metadata, initialize new VKB
                console.log('📂 Found metadata only, initializing fresh VKB');
                resolve(initializeVKB());
              } else {
                // Legacy full VKB, migrate to IndexedDB
                console.log('📂 Migrating legacy localStorage VKB to IndexedDB');
                saveVKB(parsed).then(() => resolve(parsed));
              }
            } else {
              resolve(initializeVKB());
            }
          } catch (err) {
            console.error('Error loading from localStorage:', err);
            resolve(initializeVKB());
          }
        }
      };

      request.onerror = () => {
        console.error('Error loading from IndexedDB:', request.error);
        // Fallback to localStorage
        try {
          const stored = localStorage.getItem(VKB_STORAGE_KEY);
          resolve(stored ? JSON.parse(stored) : initializeVKB());
        } catch (err) {
          resolve(initializeVKB());
        }
      };
    });
  } catch (err) {
    console.error('Error opening VKB database:', err);
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(VKB_STORAGE_KEY);
      return stored ? JSON.parse(stored) : initializeVKB();
    } catch (lsErr) {
      return initializeVKB();
    }
  }
};

/**
 * Save VKB to IndexedDB (primary) with localStorage metadata cache
 */
export const saveVKB = async (vkb) => {
  try {
    vkb.metadata.lastUpdated = new Date().toISOString();
    vkb.metadata.completeness = calculateCompleteness(vkb);
    
    // Add ID for IndexedDB
    vkb.id = 'main';
    
    // Calculate size
    const vkbString = JSON.stringify(vkb);
    const sizeInBytes = new Blob([vkbString]).size;
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
    
    console.log(`💾 Saving VKB to IndexedDB (${sizeInMB}MB, ${vkb.metadata.documentCount} documents)`);
    
    // Save to IndexedDB (unlimited storage)
    const db = await openVKBDatabase();
    const transaction = db.transaction([VKB_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(VKB_STORE_NAME);
    const request = store.put(vkb);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        console.log(`✅ VKB saved to IndexedDB (${sizeInMB}MB)`);
        
        // Cache metadata in localStorage for quick access
        try {
          localStorage.setItem(VKB_STORAGE_KEY, JSON.stringify({
            metadata: vkb.metadata,
            source: 'indexeddb',
            size: sizeInMB
          }));
        } catch (lsErr) {
          // LocalStorage full, but that's OK - data is in IndexedDB
          console.log('💡 localStorage full, metadata not cached (data safe in IndexedDB)');
        }
        
        resolve({ success: true, size: sizeInMB });
      };

      request.onerror = () => {
        console.error('❌ Failed to save VKB to IndexedDB:', request.error);
        resolve({ success: false, error: request.error.message });
      };
    });
  } catch (err) {
    console.error('❌ Error saving VKB:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Add a document to VKB with full metadata and version tracking
 * Keeps each document's data separate - NEVER overwrites existing documents
 */
export const addDocumentToVKB = async (documentInfo) => {
  const vkb = await loadVKB();
  
  // Determine document category
  let category = 'otherEvidence';
  switch (documentInfo.classification) {
    case 'DD214':
    case 'service_record':
      category = 'dd214s';
      break;
    case 'blue_button':
    case 'medical_record':
      category = 'blueButtonReports';
      break;
    case 'c_file':
    case 'rating_decision':
    case 'claim_letter':
    case 'va_decision':
      category = 'cFiles';
      break;
    case 'private_medical':
    case 'provider_letter':
    case 'nexus_letter':
      category = 'privateRecords';
      break;
  }
  
  // Calculate version number (count existing documents of this type + 1)
  const existingDocs = vkb.documentation[category] || [];
  const versionNumber = existingDocs.length + 1;
  
  // Mark all previous documents as NOT most recent
  existingDocs.forEach(doc => {
    doc.mostRecent = false;
  });
  
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
    version: versionNumber,
    mostRecent: true,
    category: category,
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

  const saveResult = await saveVKB(vkb);
  
  // IndexedDB has no storage limits - all documents saved successfully
  return { 
    success: saveResult.success, 
    documentId: docEntry.id, 
    vkb,
    size: saveResult.size
  };
};

/**
 * Get all documents from VKB
 */
export const getAllDocumentsFromVKB = async () => {
  const vkb = await loadVKB();
  return [
    ...vkb.documentation.dd214s,
    ...vkb.documentation.blueButtonReports,
    ...vkb.documentation.cFiles,
    ...vkb.documentation.privateRecords,
    ...vkb.documentation.otherEvidence,
  ];
};

/**
 * Get all documents grouped by category with metadata
 * Useful for timeline/overview displays
 */
export const getAllDocumentsByCategory = async () => {
  const vkb = await loadVKB();
  return {
    dd214s: {
      label: 'DD-214 Service Records',
      icon: '🎖️',
      documents: vkb.documentation.dd214s.sort((a, b) => (b.version || 0) - (a.version || 0)),
      count: vkb.documentation.dd214s.length,
    },
    blueButtonReports: {
      label: 'Blue Button Medical Records',
      icon: '🏥',
      documents: vkb.documentation.blueButtonReports.sort((a, b) => (b.version || 0) - (a.version || 0)),
      count: vkb.documentation.blueButtonReports.length,
    },
    cFiles: {
      label: 'VA Claims & Decisions',
      icon: '📋',
      documents: vkb.documentation.cFiles.sort((a, b) => (b.version || 0) - (a.version || 0)),
      count: vkb.documentation.cFiles.length,
    },
    privateRecords: {
      label: 'Private Medical Records',
      icon: '🩺',
      documents: vkb.documentation.privateRecords.sort((a, b) => (b.version || 0) - (a.version || 0)),
      count: vkb.documentation.privateRecords.length,
    },
    otherEvidence: {
      label: 'Other Evidence',
      icon: '📄',
      documents: vkb.documentation.otherEvidence.sort((a, b) => (b.version || 0) - (a.version || 0)),
      count: vkb.documentation.otherEvidence.length,
    },
  };
};

/**
 * Get specific document by ID
 */
export const getDocumentFromVKB = async (documentId) => {
  const allDocs = await getAllDocumentsFromVKB();
  return allDocs.find(doc => doc.id === documentId);
};

/**
 * Get all documents of a specific type/category
 * @param {string} category - One of: dd214s, blueButtonReports, cFiles, privateRecords, otherEvidence
 * @returns {Promise<Array>} All documents of that type, sorted by version (newest first)
 */
export const getDocumentsByType = async (category) => {
  const vkb = await loadVKB();
  const docs = vkb.documentation[category] || [];
  
  // Sort by version number descending (newest first)
  return docs.sort((a, b) => (b.version || 0) - (a.version || 0));
};

/**
 * Get the most recent document of a specific type
 * @param {string} category - One of: dd214s, blueButtonReports, cFiles, privateRecords, otherEvidence
 * @returns {Promise<object|null>} Most recent document or null if none exist
 */
export const getMostRecentDocument = async (category) => {
  const vkb = await loadVKB();
  const docs = vkb.documentation[category] || [];
  
  // Find document marked as mostRecent
  const mostRecent = docs.find(doc => doc.mostRecent === true);
  if (mostRecent) return mostRecent;
  
  // Fallback: return document with highest version number
  if (docs.length === 0) return null;
  return docs.reduce((latest, doc) => 
    (doc.version || 0) > (latest.version || 0) ? doc : latest
  );
};

/**
 * Compare two document versions side-by-side
 * @param {string} docId1 - ID of first document
 * @param {string} docId2 - ID of second document
 * @returns {Promise<object>} Comparison object with differences highlighted
 */
export const compareDocumentVersions = async (docId1, docId2) => {
  const doc1 = await getDocumentFromVKB(docId1);
  const doc2 = await getDocumentFromVKB(docId2);
  
  if (!doc1 || !doc2) {
    return { error: 'One or both documents not found' };
  }
  
  const differences = [];
  const allFields = new Set([
    ...Object.keys(doc1.extractedData || {}),
    ...Object.keys(doc2.extractedData || {})
  ]);
  
  allFields.forEach(field => {
    const val1 = doc1.extractedData[field];
    const val2 = doc2.extractedData[field];
    
    // Deep comparison
    const val1Str = JSON.stringify(val1);
    const val2Str = JSON.stringify(val2);
    
    if (val1Str !== val2Str) {
      differences.push({
        field,
        doc1Value: val1,
        doc2Value: val2,
        changed: val1 !== undefined && val2 !== undefined,
        addedInDoc2: val1 === undefined && val2 !== undefined,
        removedInDoc2: val1 !== undefined && val2 === undefined,
      });
    }
  });
  
  return {
    doc1: {
      id: doc1.id,
      fileName: doc1.fileName,
      uploadDate: doc1.uploadDate,
      version: doc1.version,
    },
    doc2: {
      id: doc2.id,
      fileName: doc2.fileName,
      uploadDate: doc2.uploadDate,
      version: doc2.version,
    },
    differences,
    differenceCount: differences.length,
    identical: differences.length === 0,
  };
};

/**
 * Remove a document from VKB (useful for duplicates or errors)
 * @param {string} documentId - ID of document to remove
 * @returns {Promise<object>} Result with success status
 */
export const removeDocumentFromVKB = async (documentId) => {
  const vkb = await loadVKB();
  let removed = false;
  let category = null;
  
  // Search all categories
  const categories = ['dd214s', 'blueButtonReports', 'cFiles', 'privateRecords', 'otherEvidence'];
  
  for (const cat of categories) {
    const index = vkb.documentation[cat].findIndex(doc => doc.id === documentId);
    if (index !== -1) {
      vkb.documentation[cat].splice(index, 1);
      removed = true;
      category = cat;
      
      // Recalculate version numbers
      vkb.documentation[cat].forEach((doc, idx) => {
        doc.version = idx + 1;
      });
      
      // Mark most recent
      if (vkb.documentation[cat].length > 0) {
        vkb.documentation[cat][vkb.documentation[cat].length - 1].mostRecent = true;
      }
      
      break;
    }
  }
  
  if (removed) {
    // Update document count
    vkb.metadata.documentCount = 
      vkb.documentation.dd214s.length +
      vkb.documentation.blueButtonReports.length +
      vkb.documentation.cFiles.length +
      vkb.documentation.privateRecords.length +
      vkb.documentation.otherEvidence.length;
    
    const saveResult = await saveVKB(vkb);
    return { success: saveResult.success, category, documentId };
  }
  
  return { success: false, error: 'Document not found' };
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
