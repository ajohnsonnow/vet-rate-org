/**
 * Vet-Rate.org - Mass Document Processor (Muster Call System)
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Handles large-scale document ingestion for veteran claim files:
 * - Multiple DD214s
 * - VA Rating Decisions
 * - Claim Letters (32+ files, 10+ MB)
 * - C-Files (320+ MB medical records)
 * - Poor-quality scanned documents
 * 
 * Processing Pipeline:
 * 1. File validation & size checking
 * 2. Parallel document loading (Web Workers)
 * 3. Text extraction (PDF/DOCX/OCR)
 * 4. Document classification
 * 5. Data extraction & parsing
 * 6. Profile auto-population
 * 7. LLM analysis & recommendations
 * 8. Comprehensive report generation
 * 
 * All processing is 100% client-side for maximum privacy.
 */

import { analyzeDocument, isFileSupported } from './documentAnalyzer';
import { formatFileSize } from './ocr';
import { classifyDocument, classifyDocumentBatch, DOCUMENT_TYPES, getDocumentTypeLabel, getProcessingStrategy } from './documentClassifier';
import { parseDD214Text } from './ribbonRackData';
import { updateVeteranProfile, getVeteranProfile } from './veteranProfile';
import { generateAI, isAnyAIAvailable } from './unifiedAIService';
import { addDocumentToVKB, loadVKB } from './veteranKnowledgeBase';

// Re-export formatFileSize for convenience
export { formatFileSize };

/**
 * Processing states for UI feedback
 */
export const PROCESSING_STATES = {
  IDLE: 'idle',
  VALIDATING: 'validating',
  LOADING: 'loading',
  EXTRACTING: 'extracting',
  CLASSIFYING: 'classifying',
  ANALYZING: 'analyzing',
  POPULATING: 'populating',
  COMPLETE: 'complete',
  ERROR: 'error'
};

/**
 * File size limits (can be adjusted based on browser memory)
 * NO SINGLE FILE LIMIT - C-Files and medical records can be massive
 */
const SIZE_LIMITS = {
  MAX_SINGLE_FILE: Infinity,          // NO LIMIT - handle any file size
  MAX_TOTAL_SIZE: 2 * 1024 * 1024 * 1024,  // 2 GB total batch
  WARN_THRESHOLD: 100 * 1024 * 1024   // Warn at 100 MB (informational only)
};

/**
 * Validate file batch before processing
 */
export const validateFilesBatch = (files) => {
  const results = {
    valid: [],
    invalid: [],
    warnings: [],
    totalSize: 0,
    errors: []
  };

  if (!files || files.length === 0) {
    results.errors.push('No files provided');
    return results;
  }

  for (const file of files) {
    const fileSize = file.size || 0;
    results.totalSize += fileSize;

    // Check file type support
    if (!isFileSupported(file)) {
      results.invalid.push({
        file,
        reason: 'Unsupported file type. Please use PDF, DOCX, or TXT files.'
      });
      continue;
    }

    // Check individual file size
    if (fileSize > SIZE_LIMITS.MAX_SINGLE_FILE) {
      results.invalid.push({
        file,
        reason: `File too large (${formatFileSize(fileSize)}). Maximum ${formatFileSize(SIZE_LIMITS.MAX_SINGLE_FILE)} per file.`
      });
      continue;
    }

    // Warn on large files
    if (fileSize > SIZE_LIMITS.WARN_THRESHOLD) {
      results.warnings.push({
        file,
        message: `Large file (${formatFileSize(fileSize)}) may take several minutes to process.`
      });
    }

    results.valid.push(file);
  }

  // Check total size
  if (results.totalSize > SIZE_LIMITS.MAX_TOTAL_SIZE) {
    results.errors.push(`Total size (${formatFileSize(results.totalSize)}) exceeds limit of ${formatFileSize(SIZE_LIMITS.MAX_TOTAL_SIZE)}. Please split into smaller batches.`);
  }

  return results;
};

/**
 * Process a single document: extract text, classify, parse
 */
const processSingleDocument = async (file, onProgress) => {
  const result = {
    filename: file.name,
    size: file.size,
    status: 'processing',
    text: null,
    classification: null,
    extractedData: null,
    error: null,
    processingTime: 0
  };

  const startTime = Date.now();

  try {
    // Step 1: Extract text
    onProgress?.({
      filename: file.name,
      state: PROCESSING_STATES.EXTRACTING,
      progress: 25
    });

    const extractionResult = await analyzeDocument(file, (state) => {
      onProgress?.({
        filename: file.name,
        state: PROCESSING_STATES.EXTRACTING,
        progress: 25 + (state.progress || 0) * 0.5, // 25-75%
        ocrState: state
      });
    });

    // analyzeDocument throws on error, no need to check .success
    if (!extractionResult.text || extractionResult.text.trim().length === 0) {
      throw new Error('No text could be extracted from document');
    }

    result.text = extractionResult.text;

    // Step 2: Classify document
    onProgress?.({
      filename: file.name,
      state: PROCESSING_STATES.CLASSIFYING,
      progress: 75
    });

    result.classification = classifyDocument(result.text, file.name);

    // Step 3: Parse based on classification
    onProgress?.({
      filename: file.name,
      state: PROCESSING_STATES.ANALYZING,
      progress: 85
    });

    result.extractedData = await parseDocumentByType(
      result.text,
      result.classification.type,
      file.name
    );

    // Step 4: Store document in VKB (keeps data separate per document)
    const vkbResult = addDocumentToVKB({
      fileName: file.name,
      fileSize: file.size,
      pageCount: result.pageCount || 1,
      classification: result.classification.type,
      extractedText: result.text,
      extractedData: result.extractedData,
      ocrUsed: result.ocrUsed || false,
      method: result.method || 'text',
    });

    if (vkbResult.success) {
      result.vkbDocumentId = vkbResult.documentId;
      console.log(`✅ Stored ${file.name} in VKB as ${vkbResult.documentId}`);
    }

    result.status = 'complete';
    onProgress?.({
      filename: file.name,
      state: PROCESSING_STATES.COMPLETE,
      progress: 100
    });

  } catch (error) {
    console.error(`Error processing ${file.name}:`, error);
    result.status = 'error';
    result.error = error.message;
    onProgress?.({
      filename: file.name,
      state: PROCESSING_STATES.ERROR,
      error: error.message
    });
  }

  result.processingTime = Date.now() - startTime;
  return result;
};

/**
 * Parse document based on its classified type
 */
const parseDocumentByType = async (text, docType, filename) => {
  const strategy = getProcessingStrategy(docType);
  
  switch (docType) {
    case DOCUMENT_TYPES.DD214:
    case DOCUMENT_TYPES.NGB22:
    case DOCUMENT_TYPES.DD256:
    case DOCUMENT_TYPES.DD257:
      return await parseServiceRecord(text);
      
    case DOCUMENT_TYPES.RATING_DECISION:
      return await parseRatingDecision(text);
      
    case DOCUMENT_TYPES.CLAIM_LETTER:
      return await parseClaimLetter(text);
      
    case DOCUMENT_TYPES.DBQ:
      return await parseDBQ(text);
      
    case DOCUMENT_TYPES.C_FILE_MEDICAL:
    case DOCUMENT_TYPES.MEDICAL_RECORD:
      return await parseMedicalRecord(text);
      
    case DOCUMENT_TYPES.NEXUS_LETTER:
      return await parseNexusLetter(text);
      
    default:
      return { raw: text.substring(0, 1000) };
  }
};

/**
 * Parse DD214 and other service records
 */
const parseServiceRecord = async (text) => {
  try {
    // Use existing DD214 parser
    const parsed = parseDD214Text(text);
    return {
      type: 'service_record',
      ...parsed,
      raw: text.substring(0, 500)
    };
  } catch (error) {
    console.error('Service record parsing error:', error);
    return { type: 'service_record', error: error.message, raw: text.substring(0, 500) };
  }
};

/**
 * Parse VA Rating Decision
 */
const parseRatingDecision = async (text) => {
  const data = {
    type: 'rating_decision',
    conditions: [],
    combinedRating: null,
    effectiveDate: null,
    decisionDate: null,
    raw: text.substring(0, 500)
  };

  try {
    // Extract combined rating
    const combinedMatch = text.match(/COMBINED\s+RATING\s*[:=]?\s*(\d+)%?/i);
    if (combinedMatch) {
      data.combinedRating = parseInt(combinedMatch[1]);
    }

    // Extract effective date
    const effectiveDateMatch = text.match(/EFFECTIVE\s+DATE\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
    if (effectiveDateMatch) {
      data.effectiveDate = effectiveDateMatch[1];
    }

    // Extract decision date
    const decisionDateMatch = text.match(/DECISION\s+DATE\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
    if (decisionDateMatch) {
      data.decisionDate = decisionDateMatch[1];
    }

    // Extract conditions with diagnostic codes
    const conditionPattern = /(?:DIAGNOSTIC\s+CODE\s*[:=]?\s*(\d{4}))?[\s\S]{0,200}?([A-Z][A-Za-z\s,]+?)[\s-]+(\d+)%/gi;
    let match;
    while ((match = conditionPattern.exec(text)) !== null) {
      const [, diagnosticCode, condition, rating] = match;
      data.conditions.push({
        name: condition.trim(),
        rating: parseInt(rating),
        diagnosticCode: diagnosticCode || null,
        serviceConnected: true
      });
    }

  } catch (error) {
    console.error('Rating decision parsing error:', error);
    data.error = error.message;
  }

  return data;
};

/**
 * Parse VA Claim Letter
 */
const parseClaimLetter = async (text) => {
  const data = {
    type: 'claim_letter',
    claimNumber: null,
    claimDate: null,
    contentions: [],
    status: null,
    raw: text.substring(0, 500)
  };

  try {
    // Extract claim number
    const claimNumMatch = text.match(/CLAIM\s+NUMBER\s*[:=]?\s*(\d{8,})/i);
    if (claimNumMatch) {
      data.claimNumber = claimNumMatch[1];
    }

    // Extract claim date
    const claimDateMatch = text.match(/(?:DATE\s+OF\s+CLAIM|CLAIM\s+DATE)\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
    if (claimDateMatch) {
      data.claimDate = claimDateMatch[1];
    }

    // Extract contentions (claimed conditions)
    const contentionMatch = text.match(/CONTENTION[S]?\s*[:=]?\s*([\s\S]{0,500}?)(?:\n\n|\r\n\r\n)/i);
    if (contentionMatch) {
      const contentions = contentionMatch[1]
        .split(/[\n\r]+/)
        .map(line => line.trim())
        .filter(line => line.length > 3 && /^[A-Z]/.test(line));
      data.contentions = contentions;
    }

    // Extract status
    if (/PENDING/i.test(text)) {
      data.status = 'pending';
    } else if (/APPROVED/i.test(text)) {
      data.status = 'approved';
    } else if (/DENIED/i.test(text)) {
      data.status = 'denied';
    }

  } catch (error) {
    console.error('Claim letter parsing error:', error);
    data.error = error.message;
  }

  return data;
};

/**
 * Parse DBQ (Disability Benefits Questionnaire)
 */
const parseDBQ = async (text) => {
  const data = {
    type: 'dbq',
    condition: null,
    diagnosis: null,
    nexusOpinion: null,
    examDate: null,
    examiner: null,
    raw: text.substring(0, 500)
  };

  try {
    // Extract condition name
    const conditionMatch = text.match(/DBQ\s+FOR\s+([A-Z][A-Za-z\s]+?)(?:\n|$)/i);
    if (conditionMatch) {
      data.condition = conditionMatch[1].trim();
    }

    // Extract diagnosis
    const diagnosisMatch = text.match(/DIAGNOSIS\s*[:=]?\s*([\s\S]{0,300}?)(?:\n\n|\r\n\r\n)/i);
    if (diagnosisMatch) {
      data.diagnosis = diagnosisMatch[1].trim();
    }

    // Extract nexus opinion
    if (/MORE\s+LIKELY\s+THAN\s+NOT/i.test(text)) {
      data.nexusOpinion = 'more_likely_than_not';
    } else if (/AS\s+LIKELY\s+AS\s+NOT/i.test(text)) {
      data.nexusOpinion = 'as_likely_as_not';
    } else if (/LESS\s+LIKELY\s+THAN\s+NOT/i.test(text)) {
      data.nexusOpinion = 'less_likely_than_not';
    }

    // Extract exam date
    const examDateMatch = text.match(/EXAMINATION\s+DATE\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
    if (examDateMatch) {
      data.examDate = examDateMatch[1];
    }

  } catch (error) {
    console.error('DBQ parsing error:', error);
    data.error = error.message;
  }

  return data;
};

/**
 * Parse medical records from C-File
 */
const parseMedicalRecord = async (text) => {
  const data = {
    type: 'medical_record',
    diagnoses: [],
    treatments: [],
    medications: [],
    dateOfService: null,
    provider: null,
    raw: text.substring(0, 500)
  };

  try {
    // Extract date of service
    const dateMatch = text.match(/(?:DATE\s+OF\s+SERVICE|VISIT\s+DATE)\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
    if (dateMatch) {
      data.dateOfService = dateMatch[1];
    }

    // Extract diagnoses (ICD codes)
    const icdPattern = /(?:ICD-?\d{1,2}\s*[:=]?\s*)?([A-Z]\d{2}(?:\.\d{1,2})?)\s+[–-]\s+([A-Za-z\s,]+)/g;
    let match;
    while ((match = icdPattern.exec(text)) !== null) {
      data.diagnoses.push({
        code: match[1],
        description: match[2].trim()
      });
    }

  } catch (error) {
    console.error('Medical record parsing error:', error);
    data.error = error.message;
  }

  return data;
};

/**
 * Parse nexus letter
 */
const parseNexusLetter = async (text) => {
  const data = {
    type: 'nexus_letter',
    condition: null,
    opinion: null,
    rationale: null,
    provider: null,
    raw: text.substring(0, 500)
  };

  try {
    // Extract nexus opinion strength
    if (/MORE\s+LIKELY\s+THAN\s+NOT/i.test(text)) {
      data.opinion = 'more_likely_than_not';
    } else if (/AS\s+LIKELY\s+AS\s+NOT/i.test(text)) {
      data.opinion = 'as_likely_as_not';
    }

    // Extract provider info
    const providerMatch = text.match(/(?:Sincerely|Respectfully),?\s*\n\s*([A-Z][A-Za-z\s.]+,?\s+M\.?D\.?)/i);
    if (providerMatch) {
      data.provider = providerMatch[1].trim();
    }

  } catch (error) {
    console.error('Nexus letter parsing error:', error);
    data.error = error.message;
  }

  return data;
};

/**
 * Process multiple documents in batch with parallel processing
 */
export const processMusterCallBatch = async (files, options = {}) => {
  const {
    onProgress,
    onComplete,
    signal,  // AbortSignal from abort controller
    maxConcurrent = 3  // Process 3 files at a time to avoid memory issues
  } = options;

  // Check if already aborted
  if (signal?.aborted) {
    throw new DOMException('Processing aborted', 'AbortError');
  }

  // Validation
  const validation = validateFilesBatch(files);
  if (validation.errors.length > 0 || validation.valid.length === 0) {
    return {
      success: false,
      validation,
      results: []
    };
  }

  // Initialize tracking
  const results = [];
  const queue = [...validation.valid];
  let completed = 0;
  let processing = 0;

  onProgress?.({
    state: PROCESSING_STATES.LOADING,
    total: queue.length,
    completed: 0,
    processing: 0
  });

  // Process files with concurrency limit
  const processNext = async () => {
    // Check for abort signal
    if (signal?.aborted) {
      throw new DOMException('Processing aborted', 'AbortError');
    }
    
    if (queue.length === 0) return null;

    const file = queue.shift();
    processing++;

    try {
      const result = await processSingleDocument(file, (fileProgress) => {
        onProgress?.({
          ...fileProgress,
          total: validation.valid.length,
          completed,
          processing
        });
      });

      processing--;
      completed++;
      results.push(result);

      onProgress?.({
        state: PROCESSING_STATES.LOADING,
        total: validation.valid.length,
        completed,
        processing
      });

      return result;
    } catch (error) {
      // Catch any errors that slip through processSingleDocument
      console.error(`Failed to process ${file.name}:`, error);
      processing--;
      completed++;
      
      // Add error result
      results.push({
        filename: file.name,
        status: 'error',
        error: error.message || 'Unknown error',
        fileSize: file.size
      });

      onProgress?.({
        state: PROCESSING_STATES.ERROR,
        total: validation.valid.length,
        completed,
        processing,
        filename: file.name,
        error: error.message
      });

      return null;
    }
  };

  // Start processing with concurrency limit
  const workers = [];
  for (let i = 0; i < Math.min(maxConcurrent, validation.valid.length); i++) {
    workers.push((async () => {
      while (true) {
        if (queue.length === 0) {
          if (processing === 0) break;
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        const result = await processNext();
        if (result === null && queue.length === 0) break;
      }
    })());
  }

  await Promise.all(workers);

  // Classify and group results
  onProgress?.({
    state: PROCESSING_STATES.CLASSIFYING,
    total: results.length,
    completed: results.length
  });

  const classified = classifyDocumentBatch(
    results.map(r => ({ text: r.text, filename: r.filename }))
  );

  // Merge classified data back into results
  results.forEach((result, index) => {
    const classifiedDoc = classified.grouped[Object.keys(classified.grouped).find(key =>
      classified.grouped[key].some(d => d.index === index)
    )]?.find(d => d.index === index);
    
    if (classifiedDoc) {
      result.classification = classifiedDoc.classification;
    }
  });

  onComplete?.({
    results,
    classified,
    validation
  });

  return {
    success: true,
    validation,
    results,
    classified,
    summary: {
      totalFiles: validation.valid.length,
      totalSize: validation.totalSize,
      successful: results.filter(r => r.status === 'complete').length,
      failed: results.filter(r => r.status === 'error').length,
      processingTime: results.reduce((sum, r) => sum + r.processingTime, 0)
    }
  };
};

/**
 * Auto-populate veteran profile from processed documents
 */
export const autoPopulateProfile = async (processedResults) => {
  const currentProfile = getVeteranProfile();
  const updates = { ...currentProfile };

  let updateCount = 0;

  for (const result of processedResults) {
    if (result.status !== 'complete' || !result.extractedData) continue;

    const { type } = result.extractedData;

    switch (type) {
      case 'service_record':
        // Populate from DD214
        if (result.extractedData.branch) updates.branch = result.extractedData.branch;
        if (result.extractedData.entryDate) updates.serviceStartDate = result.extractedData.entryDate;
        if (result.extractedData.separationDate) updates.serviceEndDate = result.extractedData.separationDate;
        if (result.extractedData.mos) updates.mos = result.extractedData.mos;
        if (result.extractedData.mosTitle) updates.mosTitle = result.extractedData.mosTitle;
        if (result.extractedData.characterOfService) updates.characterOfService = result.extractedData.characterOfService;
        if (result.extractedData.separationType) updates.separationType = result.extractedData.separationType;
        updateCount++;
        break;

      case 'rating_decision':
        // Populate from rating decision
        if (result.extractedData.combinedRating) updates.currentCombinedRating = result.extractedData.combinedRating;
        if (result.extractedData.effectiveDate) updates.effectiveDate = result.extractedData.effectiveDate;
        updateCount++;
        break;

      case 'claim_letter':
        // Populate from claim letter
        if (result.extractedData.claimNumber) updates.claimNumber = result.extractedData.claimNumber;
        updateCount++;
        break;
    }
  }

  if (updateCount > 0) {
    const success = updateVeteranProfile(updates);
    return { success, updates, count: updateCount };
  }

  return { success: false, updates: {}, count: 0 };
};

/**
 * Generate comprehensive analysis report using LLM
 */
export const generateMusterCallReport = async (processedResults, classified) => {
  if (!isAnyAIAvailable()) {
    return {
      success: false,
      error: 'AI service not available. Report generation requires AI.'
    };
  }

  const serviceRecords = processedResults.filter(r => 
    r.classification?.category === 'service_record' && r.status === 'complete'
  );

  const ratingDocs = processedResults.filter(r => 
    r.classification?.category === 'rating' && r.status === 'complete'
  );

  const medicalDocs = processedResults.filter(r => 
    r.classification?.category === 'medical' && r.status === 'complete'
  );

  const prompt = `Analyze this veteran's complete file and provide comprehensive recommendations:

SERVICE RECORDS (${serviceRecords.length} documents):
${serviceRecords.map(r => `- ${r.filename}: ${JSON.stringify(r.extractedData, null, 2)}`).join('\n')}

RATING DECISIONS (${ratingDocs.length} documents):
${ratingDocs.map(r => `- ${r.filename}: ${JSON.stringify(r.extractedData, null, 2)}`).join('\n')}

MEDICAL RECORDS (${medicalDocs.length} documents):
${medicalDocs.map(r => `- ${r.filename}: ${r.classification.type}`).join('\n')}

Provide:
1. **Service Connection Opportunities**: What conditions should be claimed based on service records?
2. **Rating Increase Opportunities**: Current ratings that may qualify for increase
3. **Secondary Conditions**: Potential secondary conditions based on service-connected disabilities
4. **Missing Evidence**: What additional evidence would strengthen claims?
5. **Next Steps**: Prioritized action plan

Format as markdown with clear sections.`;

  try {
    const response = await generateAI(prompt, {
      systemPrompt: 'You are a VA disability claims expert. Provide actionable, regulation-based guidance.',
      temperature: 0.3
    });

    return {
      success: true,
      report: response,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Report generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
