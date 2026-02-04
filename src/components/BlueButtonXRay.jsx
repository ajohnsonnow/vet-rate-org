/**
 * Vet-Rate.org - Blue Button X-Ray Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * "Instant Evidence" - AI-powered parser for VA Blue Button Medical Records
 * Extracts diagnoses from Problem List section without requiring 6-month C-File wait
 * 
 * Privacy: Text extraction happens locally. AI analysis uses your configured AI (Local or Cloud).
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import BuyMeCoffee from './BuyMeCoffee';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { generateAI, isAnyAIAvailable, getAIStatus, AI_MODES } from '../utils/unifiedAIService';
import { AIStatusBadge } from './AIModeSelector';
import { LLMRecommendationBadge } from './LLMRecommendation';
import SmartAILoadButton from './SmartAILoadButton';
import ReportBugLink from './ReportBugLink';
import { addDocumentToVKB } from '../utils/veteranKnowledgeBase';

// Configure PDF.js worker - use bundled worker from npm package for version compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * AI System Prompt for extracting diagnoses from Blue Button reports
 * Designed to identify ACTUAL medical conditions, not provider names or admin data
 */
const BLUE_BUTTON_AI_PROMPT_HEADER = `Extract medical conditions from this VA Blue Button report.

INCLUDE: Diagnoses, health conditions, medical problems
EXCLUDE: Doctor names, facilities, lab tests, medications, vitals, vaccines

HIGH PRIORITY (VA-claimable): PTSD, Depression, Anxiety, Sleep Apnea, Tinnitus, Hearing Loss, Back/Knee/Shoulder pain, Arthritis, Migraines, Hypertension, Diabetes, GERD, Neuropathy

DOCUMENT:
`;

// This goes AFTER the document text to ensure JSON format is always at the end
const BLUE_BUTTON_AI_PROMPT_FOOTER = `

RESPOND IN JSON ONLY:
{"conditions":[{"name":"ConditionName","dateFound":"Date","isClaimable":true,"category":"Category"}],"summary":"Brief summary"}`;

// Legacy constant for backward compatibility
const BLUE_BUTTON_AI_PROMPT = BLUE_BUTTON_AI_PROMPT_HEADER + `[DOCUMENT TEXT HERE]` + BLUE_BUTTON_AI_PROMPT_FOOTER;

/**
 * Regex patterns to find the Problem List / Active Problems section in Blue Button reports
 * These vary based on the export format (text vs PDF)
 */
const PROBLEM_LIST_PATTERNS = [
  // VA Blue Button common headers
  /(?:VA\s*)?Problem\s*List[:\s]*\n/gi,
  /Active\s*Problems?[:\s]*\n/gi,
  /(?:VA\s*)?Health\s*Issues?[:\s]*\n/gi,
  /(?:My\s*)?VA\s*Diagnos[ie]s[:\s]*\n/gi,
  /(?:Medical\s*)?Conditions?[:\s]*\n/gi,
  /ICD[-\s]*(?:10|9)[:\s]*(?:Codes?)?[:\s]*\n/gi,
  // Section end markers
  /(?=\n(?:Allergies|Medications|Vitals|Immunizations|Notes|Labs|Appointments|Demographics|Health\s*Care\s*Team)[:\s]*\n)/gi
];

/**
 * Patterns to extract individual diagnoses from the problem list
 * Handles various Blue Button formats
 */
const DIAGNOSIS_PATTERNS = [
  // Format: "Condition Name - Date" or "Condition Name (Date)"
  /^\s*[-•*]?\s*(.+?)\s*[-–—]\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4})/gm,
  // Format: "ICD-10: Code - Description"
  /(?:ICD[-\s]*10[:\s]*)?([A-Z]\d{2}(?:\.\d{1,4})?)\s*[-–—:]\s*(.+?)(?:\n|$)/gi,
  // Format: Simple "Condition Name" on its own line
  /^\s*[-•*]?\s*([A-Za-z][A-Za-z\s,'()-]+?)(?:\s*(?:Since|Onset|Date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}))?$/gm,
  // Format: "Date: Condition" or "Date - Condition"
  /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4})\s*[-–—:]\s*(.+?)(?:\n|$)/gm
];

/**
 * Common VA diagnoses we want to flag (conditions often claimed)
 * Maps common variations to standardized names
 */
const CLAIMABLE_CONDITIONS = {
  // Mental Health
  'ptsd': 'PTSD (Post-Traumatic Stress Disorder)',
  'post traumatic stress': 'PTSD (Post-Traumatic Stress Disorder)',
  'depression': 'Major Depressive Disorder',
  'major depressive': 'Major Depressive Disorder',
  'anxiety': 'Generalized Anxiety Disorder',
  'generalized anxiety': 'Generalized Anxiety Disorder',
  'bipolar': 'Bipolar Disorder',
  'insomnia': 'Insomnia / Sleep Disorder',
  'sleep apnea': 'Sleep Apnea',
  'obstructive sleep': 'Sleep Apnea',
  
  // Musculoskeletal
  'tinnitus': 'Tinnitus',
  'hearing loss': 'Hearing Loss',
  'degenerative disc': 'Degenerative Disc Disease',
  'lumbar': 'Lumbar Spine Condition',
  'cervical': 'Cervical Spine Condition',
  'thoracolumbar': 'Thoracolumbar Spine Condition',
  'arthritis': 'Arthritis',
  'osteoarthritis': 'Osteoarthritis',
  'rheumatoid': 'Rheumatoid Arthritis',
  'fibromyalgia': 'Fibromyalgia',
  'gout': 'Gout',
  'plantar fasciitis': 'Plantar Fasciitis',
  'pes planus': 'Pes Planus (Flat Feet)',
  'flat feet': 'Pes Planus (Flat Feet)',
  'hallux valgus': 'Hallux Valgus (Bunions)',
  'bunion': 'Hallux Valgus (Bunions)',
  'carpal tunnel': 'Carpal Tunnel Syndrome',
  'radiculopathy': 'Radiculopathy',
  'sciatica': 'Sciatica / Lumbar Radiculopathy',
  
  // Cardiovascular
  'hypertension': 'Hypertension (High Blood Pressure)',
  'high blood pressure': 'Hypertension (High Blood Pressure)',
  'coronary artery': 'Coronary Artery Disease',
  'heart disease': 'Heart Disease',
  'atrial fibrillation': 'Atrial Fibrillation',
  'peripheral artery': 'Peripheral Artery Disease',
  'varicose': 'Varicose Veins',
  
  // Respiratory
  'asthma': 'Asthma',
  'copd': 'COPD',
  'chronic obstructive': 'COPD',
  'sinusitis': 'Sinusitis',
  'rhinitis': 'Allergic Rhinitis',
  
  // Gastrointestinal
  'gerd': 'GERD (Acid Reflux)',
  'acid reflux': 'GERD (Acid Reflux)',
  'gastroesophageal': 'GERD (Acid Reflux)',
  'ibs': 'Irritable Bowel Syndrome',
  'irritable bowel': 'Irritable Bowel Syndrome',
  'hiatal hernia': 'Hiatal Hernia',
  
  // Endocrine
  'diabetes': 'Diabetes Mellitus',
  'type 2 diabetes': 'Diabetes Mellitus Type II',
  'hypothyroid': 'Hypothyroidism',
  'hyperthyroid': 'Hyperthyroidism',
  
  // Skin
  'eczema': 'Eczema',
  'psoriasis': 'Psoriasis',
  'acne': 'Acne / Chloracne',
  
  // Neurological
  'migraine': 'Migraine Headaches',
  'tension headache': 'Tension Headaches',
  'headache': 'Chronic Headaches',
  'peripheral neuropathy': 'Peripheral Neuropathy',
  'neuropathy': 'Peripheral Neuropathy',
  'tremor': 'Tremors',
  'parkinson': "Parkinson's Disease",
  
  // Other common
  'erectile dysfunction': 'Erectile Dysfunction',
  'ed': 'Erectile Dysfunction',
  'chronic fatigue': 'Chronic Fatigue Syndrome',
  'gulf war': 'Gulf War Syndrome',
};

/**
 * Conditions to filter out (not claimable or too vague)
 */
const EXCLUDED_CONDITIONS = [
  'blood pressure check',
  'routine exam',
  'annual physical',
  'well visit',
  'follow up',
  'followup',
  'referral',
  'lab work',
  'imaging',
  'screening',
  'preventive',
  'immunization',
  'vaccine',
  'counseling',
  'education',
  'unknown',
  'unspecified'
];

export default function BlueButtonXRay({ onClose, onAddToCalculator, onCheckRatingCriteria, onOpenAISettings, onReportBug }) {
  const { t } = useLanguage();
  // Lock body scroll when modal is open
  useBodyScrollLock(true);
  
  // AI status state
  const [aiStatus, setAIStatus] = useState(getAIStatus());
  
  // Monitor AI status changes
  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // File state
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [error, setError] = useState(null);
  
  // Results state
  const [extractedConditions, setExtractedConditions] = useState([]);
  const [rawText, setRawText] = useState('');
  const [showRawText, setShowRawText] = useState(false);
  const [savedToVKB, setSavedToVKB] = useState(false);
  const [savingToVKB, setSavingToVKB] = useState(false);
  
  /**
   * Save the Blue Button document to VKB (My Packet) for future AI queries
   * This stores the raw text so AI can reference it later
   * Can be called before OR after AI analysis
   */
  const handleSaveToVKB = async () => {
    if (!file) {
      setError('No document to save. Please upload a file first.');
      return;
    }
    
    setSavingToVKB(true);
    try {
      // If we don't have rawText yet, read the file now
      let textToSave = rawText;
      if (!textToSave) {
        setProcessingStage('Reading file...');
        if (file.type === 'application/pdf') {
          textToSave = await extractTextFromPDF(file);
        } else {
          textToSave = await readTextFile(file);
        }
        setRawText(textToSave); // Save for later use
      }
      
      await addDocumentToVKB({
        fileName: file.name,
        classification: 'blue_button',
        rawText: textToSave,
        extractedData: {
          conditions: extractedConditions.length > 0 ? extractedConditions : [],
          processingDate: new Date().toISOString(),
          source: 'BlueButtonXRay'
        },
        documentDate: new Date().toISOString(),
        sourceFile: file.name
      });
      
      setSavedToVKB(true);
      console.log('✅ Blue Button saved to VKB (My Packet)');
    } catch (err) {
      console.error('Failed to save to VKB:', err);
      setError('Failed to save to My Packet: ' + err.message);
    } finally {
      setSavingToVKB(false);
      setProcessingStage('');
    }
  };
  
  // Handle file drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      const fileType = droppedFile.type;
      const fileName = droppedFile.name.toLowerCase();
      
      if (fileType !== 'application/pdf' && fileType !== 'text/plain' && !fileName.endsWith('.txt')) {
        setError('Please upload a PDF or TXT file. Blue Button reports are typically downloaded as .txt or .pdf files.');
        return;
      }
      setFile(droppedFile);
      setError(null);
      setExtractedConditions([]);
    }
  }, []);
  
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleFileSelect = useCallback((e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const fileType = selectedFile.type;
      const fileName = selectedFile.name.toLowerCase();
      
      if (fileType !== 'application/pdf' && fileType !== 'text/plain' && !fileName.endsWith('.txt')) {
        setError('Please upload a PDF or TXT file. Blue Button reports are typically downloaded as .txt or .pdf files.');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setExtractedConditions([]);
    }
  }, []);
  
  /**
   * Read text file
   */
  const readTextFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read text file'));
      reader.readAsText(file);
    });
  };
  
  /**
   * Extract text from PDF using PDF.js
   */
  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ 
      data: arrayBuffer, 
      standardFontDataUrl: STANDARD_FONT_DATA_URL 
    }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      setProcessingStage(`Extracting page ${i} of ${pdf.numPages}...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  };
  
  /**
   * Parse the text to find Problem List section and extract diagnoses
   */
  const parseBlueButtonText = (text) => {
    // Validate input
    if (!text || typeof text !== 'string') {
      console.error('parseBlueButtonText received invalid input:', typeof text);
      return [];
    }
    
    const conditions = [];
    const seenConditions = new Set();
    
    // Normalize text
    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\s{2,}/g, ' ');
    
    // Try to find the Problem List section
    let problemListSection = '';
    
    // Look for various section headers
    const sectionPatterns = [
      /(?:VA\s*)?Problem\s*List[\s:]*\n([\s\S]*?)(?=\n(?:Allergies|Medications|Vitals|Immunizations|Notes|Labs|Appointments|Demographics|Health\s*Care\s*Team|Active\s*Outpatient|Procedures|$)[\s:]*\n)/i,
      /Active\s*Problems?[\s:]*\n([\s\S]*?)(?=\n(?:Allergies|Medications|Vitals|Immunizations|Notes|Labs|Appointments|Demographics|$)[\s:]*\n)/i,
      /(?:My\s*)?VA\s*(?:Health\s*)?Issues?[\s:]*\n([\s\S]*?)(?=\n(?:Allergies|Medications|Vitals|Immunizations|$)[\s:]*\n)/i,
      /Diagnos[ie]s[\s:]*\n([\s\S]*?)(?=\n(?:Allergies|Medications|Vitals|$)[\s:]*\n)/i,
    ];
    
    for (const pattern of sectionPatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        problemListSection = match[1];
        break;
      }
    }
    
    // If no section found, try to extract from the whole document
    if (!problemListSection) {
      problemListSection = normalizedText;
    }
    
    // Extract conditions line by line
    const lines = problemListSection.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.length < 3) continue;
      
      // Skip excluded patterns
      const lowerLine = trimmedLine.toLowerCase();
      if (EXCLUDED_CONDITIONS.some(exc => lowerLine.includes(exc))) continue;
      
      // Try to extract condition and date
      let conditionName = trimmedLine;
      let dateFound = null;
      
      // Check for date patterns
      const dateMatch = trimmedLine.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\b\d{4}\b)/i);
      if (dateMatch) {
        dateFound = dateMatch[1];
        // Remove date from condition name
        conditionName = trimmedLine.replace(dateMatch[0], '').trim();
      }
      
      // Clean up condition name
      conditionName = conditionName
        .replace(/^[-•*\d.)\]]+\s*/, '') // Remove list markers
        .replace(/\s*[-–—:]+\s*$/, '') // Remove trailing separators
        .replace(/^\s*ICD[-\s]*10[:\s]*/i, '') // Remove ICD-10 prefix
        .replace(/\s*\([^)]*\)\s*$/, '') // Remove trailing parenthetical
        .trim();
      
      // Skip if too short or looks like a header
      if (conditionName.length < 4 || conditionName.length > 100) continue;
      if (/^(Problem|Active|Health|Issue|Date|Status|Provider|Note)s?$/i.test(conditionName)) continue;
      
      // Check if this is a claimable condition
      const normalizedCondition = conditionName.toLowerCase();
      const normalizedKey = seenConditions.has(normalizedCondition) ? null : normalizedCondition;
      
      if (normalizedKey) {
        seenConditions.add(normalizedCondition);
        
        // Check if it matches a known claimable condition
        let matchedClaimable = null;
        for (const [key, value] of Object.entries(CLAIMABLE_CONDITIONS)) {
          if (normalizedCondition.includes(key)) {
            matchedClaimable = value;
            break;
          }
        }
        
        conditions.push({
          id: conditions.length + 1,
          rawName: conditionName,
          standardizedName: matchedClaimable || conditionName,
          dateFound: dateFound,
          isClaimable: Boolean(matchedClaimable),
          selected: false
        });
      }
    }
    
    // Sort: claimable conditions first, then alphabetically
    conditions.sort((a, b) => {
      if (a.isClaimable && !b.isClaimable) return -1;
      if (!a.isClaimable && b.isClaimable) return 1;
      return a.standardizedName.localeCompare(b.standardizedName);
    });
    
    return conditions;
  };
  
  /**
   * Estimate token count from text (rough approximation: 1 token ≈ 4 characters)
   */
  const estimateTokens = (text) => {
    return Math.ceil(text.length / 4);
  };
  
  /**
   * Extract the Problem List / Active Problems section from Blue Button text
   * This prioritizes the most relevant section for diagnosis extraction
   */
  const extractProblemListSection = (text) => {
    // Validate input
    if (!text || typeof text !== 'string') {
      console.error('extractProblemListSection received invalid input:', typeof text);
      return '';
    }
    
    // Try to find problem list section
    const problemListStart = text.search(/(?:VA\s*)?Problem\s*List[:\s]*|Active\s*Problems?[:\s]*|(?:My\s*)?VA\s*Diagnos[ie]s[:\s]*/gi);
    
    if (problemListStart !== -1) {
      // Find where this section ends (next major section or 5000 chars, whichever comes first)
      const afterStart = text.substring(problemListStart);
      const sectionEndMatch = afterStart.search(/\n(?:Allergies|Medications|Vitals|Immunizations|Notes|Labs|Appointments|Demographics|Health\s*Care\s*Team|Provider|Facility)[:\s]*\n/i);
      
      if (sectionEndMatch !== -1) {
        return afterStart.substring(0, sectionEndMatch);
      }
      
      // If no end marker found, take next 5000 chars
      return afterStart.substring(0, Math.min(5000, afterStart.length));
    }
    
    // If no problem list found, return first portion of document
    return text.substring(0, Math.min(5000, text.length));
  };
  
  /**
   * Split text into chunks that fit within a token limit
   * Tries to split at natural boundaries (sections, paragraphs)
   */
  const chunkText = (text, maxTokensPerChunk = 2500) => {
    // Validate input
    if (!text || typeof text !== 'string') {
      console.error('chunkText received invalid input:', typeof text);
      return [];
    }
    
    const chunks = [];
    const maxCharsPerChunk = maxTokensPerChunk * 4; // Rough conversion
    
    // First, try to extract problem list section
    const problemListSection = extractProblemListSection(text);
    if (problemListSection && estimateTokens(problemListSection) < maxTokensPerChunk) {
      // If problem list fits in one chunk, use it alone
      chunks.push(problemListSection);
      return chunks;
    }
    
    // Otherwise, split the text into chunks
    let remainingText = text;
    
    while (remainingText.length > 0) {
      if (remainingText.length <= maxCharsPerChunk) {
        chunks.push(remainingText);
        break;
      }
      
      // Try to find a good break point (paragraph, section header, or newline)
      let breakPoint = maxCharsPerChunk;
      const searchStart = Math.max(0, maxCharsPerChunk - 500);
      const searchEnd = Math.min(remainingText.length, maxCharsPerChunk + 500);
      const searchRegion = remainingText.substring(searchStart, searchEnd);
      
      // Look for section breaks (double newline)
      const doubleNewline = searchRegion.lastIndexOf('\n\n');
      if (doubleNewline !== -1) {
        breakPoint = searchStart + doubleNewline + 2;
      } else {
        // Look for single newline
        const singleNewline = searchRegion.lastIndexOf('\n');
        if (singleNewline !== -1) {
          breakPoint = searchStart + singleNewline + 1;
        }
      }
      
      chunks.push(remainingText.substring(0, breakPoint));
      remainingText = remainingText.substring(breakPoint);
    }
    
    return chunks;
  };
  
  /**
   * AI-powered extraction of diagnoses from Blue Button text
   * Handles large documents by chunking them for models with smaller context windows
   */
  const analyzeWithAI = async (text) => {
    // Validate input
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input - expected a string but got: ' + typeof text);
    }
    
    if (text.trim().length === 0) {
      throw new Error('Text is empty - nothing to analyze');
    }
    
    // Check if AI is available
    if (!isAnyAIAvailable()) {
      throw new Error('No AI available. Please configure AI in settings first.');
    }
    
    // Calculate prompt overhead (the AI prompt itself takes tokens)
    const promptTokens = estimateTokens(BLUE_BUTTON_AI_PROMPT_HEADER) + estimateTokens(BLUE_BUTTON_AI_PROMPT_FOOTER);
    const maxInputTokens = 2800; // Conservative limit for 4096 context window (leaving room for output)
    const maxTextTokens = maxInputTokens - promptTokens;
    const textTokens = estimateTokens(text);
    
    // Determine if we need to chunk
    const needsChunking = textTokens > maxTextTokens;
    
    if (!needsChunking) {
      // Text fits in one request - process normally
      // Structure: HEADER + document + FOOTER (JSON instructions at END)
      const fullPrompt = BLUE_BUTTON_AI_PROMPT_HEADER + text + BLUE_BUTTON_AI_PROMPT_FOOTER;
      
      const aiResponse = await generateAI(fullPrompt, {
        temperature: 0.2,
        maxTokens: 2000,
        expectJSON: true,
        skipHallucinationCheck: true, // Blue Button finds conditions, doesn't validate VA codes yet
        skipCrisisCheck: true, // Medical records contain terms that trigger false positives
        useDKB: false, // Skip DKB - we're just extracting medical terms, not citing VA regulations
        systemPrompt: '' // Skip system prompt - the prompt already has all context needed
      });
      
      const parsed = parseAIResponse(aiResponse);
      return formatConditionsResponse(parsed);
      
    } else {
      // Text is too large - process in chunks
      console.log(`📄 Large document detected (${textTokens} tokens). Chunking for processing...`);
      setProcessingStage(`Large document - processing in multiple parts...`);
      
      const chunks = chunkText(text, maxTextTokens);
      console.log(`Split into ${chunks.length} chunks`);
      
      const allConditions = [];
      const summaries = [];
      
      /**
       * Process a single chunk with retry logic and multiple fallback strategies
       * NO FAILED SECTIONS ALLOWED - we try everything possible
       */
      const processChunkWithRetry = async (chunkText, chunkIndex) => {
        const MAX_RETRIES = 3;
        const strategies = [
          { maxTokens: 2000, temp: 0.2, name: 'Standard' },
          { maxTokens: 3000, temp: 0.1, name: 'Extended+Precise' },
          { maxTokens: 4000, temp: 0.0, name: 'Maximum+Deterministic' }
        ];
        
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            const strategy = strategies[attempt];
            setProcessingStage(`Processing section ${chunkIndex + 1} of ${chunks.length}... (${strategy.name})`);
            
            const chunkPrompt = BLUE_BUTTON_AI_PROMPT_HEADER + chunkText + BLUE_BUTTON_AI_PROMPT_FOOTER;
            
            const aiResponse = await generateAI(chunkPrompt, {
              temperature: strategy.temp,
              maxTokens: strategy.maxTokens,
              expectJSON: true,
              skipHallucinationCheck: true,
              skipCrisisCheck: true,
              useDKB: false,
              systemPrompt: ''
            });
            
            const parsed = parseAIResponse(aiResponse);
            
            // Success! Return results
            if (parsed && parsed.conditions && Array.isArray(parsed.conditions)) {
              console.log(`✅ Section ${chunkIndex + 1} succeeded on ${strategy.name} strategy (${parsed.conditions.length} conditions)`);
              return parsed;
            }
            
          } catch (error) {
            console.warn(`⚠️ Section ${chunkIndex + 1} attempt ${attempt + 1}/${MAX_RETRIES} failed:`, error.message);
            
            // If this was the last attempt, try regex fallback
            if (attempt === MAX_RETRIES - 1) {
              console.log(`🔧 Section ${chunkIndex + 1}: Trying regex fallback extraction...`);
              const fallbackConditions = extractConditionsFromText(chunkText);
              
              if (fallbackConditions.length > 0) {
                console.log(`✅ Section ${chunkIndex + 1} RECOVERED via regex fallback (${fallbackConditions.length} conditions)`);
                return {
                  conditions: fallbackConditions,
                  summary: `Extracted via fallback (section ${chunkIndex + 1})`,
                  wasFallback: true
                };
              }
            }
            
            // Wait before retry (exponential backoff)
            if (attempt < MAX_RETRIES - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
          }
        }
        
        // ABSOLUTE LAST RESORT: Return empty but don't crash
        console.error(`❌ Section ${chunkIndex + 1} FAILED after all strategies - returning empty results`);
        return {
          conditions: [],
          summary: `Section ${chunkIndex + 1}: Could not extract conditions after ${MAX_RETRIES} attempts + fallback`,
          failed: true
        };
      };
      
      // Process each chunk with bulletproof retry logic
      for (let i = 0; i < chunks.length; i++) {
        const result = await processChunkWithRetry(chunks[i], i);
        
        if (result.conditions && result.conditions.length > 0) {
          allConditions.push(...result.conditions);
        }
        
        if (result.summary) {
          summaries.push(result.summary);
        }
        
        if (result.failed) {
          console.warn(`⚠️ Section ${i + 1} marked as failed but processing continues`);
        }
        
        // Small delay between chunks to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Deduplicate conditions (same name = same condition)
      const uniqueConditions = [];
      const seenNames = new Set();
      
      for (const condition of allConditions) {
        const normalizedName = condition.name.toLowerCase().trim();
        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName);
          uniqueConditions.push(condition);
        }
      }
      
      console.log(`Found ${allConditions.length} total conditions, ${uniqueConditions.length} unique`);
      
      return formatConditionsResponse({
        conditions: uniqueConditions,
        summary: summaries.length > 0 ? summaries.join(' ') : null
      });
    }
  };
  
  /**
   * Parse AI response JSON
   * FIX for BUG-MKUA99RE: generateAI returns {text, mode} object, not a string
   */
  const parseAIResponse = (aiResponse) => {
    try {
      // Handle both string responses and {text, mode} objects from generateAI
      let responseText;
      if (typeof aiResponse === 'string') {
        responseText = aiResponse;
      } else if (aiResponse && typeof aiResponse === 'object') {
        // generateAI returns {text: string, mode: string, ...}
        responseText = aiResponse.text;
        if (typeof responseText !== 'string') {
          throw new Error('AI response object missing text property');
        }
      } else {
        throw new Error(`Invalid AI response type: ${typeof aiResponse}`);
      }
      
      // Clean up potential markdown formatting
      let cleanResponse = responseText.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.slice(7);
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.slice(3);
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.slice(0, -3);
      }
      cleanResponse = cleanResponse.trim();
      
      // Try to repair truncated JSON (AI ran out of output tokens mid-response)
      let parsed;
      try {
        parsed = JSON.parse(cleanResponse);
      } catch (jsonErr) {
        // AGGRESSIVE JSON REPAIR - we need this to work!
        console.log('💡 Attempting advanced JSON repair...');
        let repaired = cleanResponse;
        
        // Strategy 1: Remove trailing garbage after last complete structure
        const lastCloseBrace = repaired.lastIndexOf('}');
        const lastCloseBracket = repaired.lastIndexOf(']');
        
        if (lastCloseBrace > 0 || lastCloseBracket > 0) {
          // Find the outermost closing position
          const lastValidPos = Math.max(lastCloseBrace, lastCloseBracket);
          
          // Check if there's garbage after this position
          const afterLast = repaired.substring(lastValidPos + 1).trim();
          if (afterLast.length > 0 && !afterLast.match(/^[}\]]*$/)) {
            // Truncate to last valid JSON structure
            repaired = repaired.substring(0, lastValidPos + 1);
            console.log('🔧 Removed trailing garbage');
          }
        }
        
        // Strategy 2: Handle truncated strings (very common with token limits)
        const quoteCount = (repaired.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          console.log('🔧 Detected unmatched quotes - finding last complete object');
          
          // Find last complete object (ends with },)
          const patterns = [
            /},\s*{[^}]*$/,          // Last incomplete object after comma
            /"[^"]*$/,                // Incomplete string at end
            /:\s*"[^"]*$/,            // Incomplete property value
          ];
          
          for (const pattern of patterns) {
            const match = repaired.match(pattern);
            if (match) {
              const cutPosition = match.index;
              repaired = repaired.substring(0, cutPosition);
              console.log(`🔧 Cut at position ${cutPosition} to remove incomplete content`);
              break;
            }
          }
        }
        
        // Strategy 3: Balance brackets and braces
        const openBraces = (repaired.match(/{/g) || []).length;
        const closeBraces = (repaired.match(/}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;
        
        console.log(`🔧 Brackets: ${openBrackets} open, ${closeBrackets} close | Braces: ${openBraces} open, ${closeBraces} close`);
        
        // Close arrays first (conditions array)
        if (repaired.includes('"conditions"') && openBrackets > closeBrackets) {
          const missing = openBrackets - closeBrackets;
          console.log(`🔧 Adding ${missing} closing brackets`);
          for (let i = 0; i < missing; i++) {
            repaired += ']';
          }
        }
        
        // Close objects
        const currentCloseBraces = (repaired.match(/}/g) || []).length;
        const neededBraces = openBraces - currentCloseBraces;
        if (neededBraces > 0) {
          console.log(`🔧 Adding ${neededBraces} closing braces`);
          for (let i = 0; i < neededBraces; i++) {
            repaired += '}';
          }
        }
        
        // Strategy 4: If still failing, try to extract just the conditions array
        try {
          parsed = JSON.parse(repaired);
          console.log('✅ Repaired JSON successfully');
        } catch (stillFailing) {
          console.log('🔧 Standard repair failed, trying to extract conditions array directly...');
          
          // Try to find and extract just the conditions array
          const conditionsMatch = repaired.match(/"conditions"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
          if (conditionsMatch) {
            let conditionsContent = conditionsMatch[1];
            
            // Try to complete the last object if it's incomplete
            const lastOpenBrace = conditionsContent.lastIndexOf('{');
            const lastCloseBrace = conditionsContent.lastIndexOf('}');
            
            if (lastOpenBrace > lastCloseBrace) {
              // Incomplete object - remove it
              conditionsContent = conditionsContent.substring(0, lastOpenBrace);
            }
            
            // Remove trailing comma
            conditionsContent = conditionsContent.trim().replace(/,\s*$/, '');
            
            const reconstructed = `{"conditions":[${conditionsContent}]}`;
            
            try {
              parsed = JSON.parse(reconstructed);
              console.log('✅ Extracted conditions array successfully');
            } catch {
              throw jsonErr; // Give up, rethrow original
            }
          } else {
            throw jsonErr; // No conditions array found
          }
        }
      }
      
      if (!parsed.conditions || !Array.isArray(parsed.conditions)) {
        throw new Error('AI response missing conditions array.');
      }
      
      return parsed;
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError.message || parseError);
      // Safely log raw response (limit to 500 chars for readability)
      try {
        const rawForLog = typeof aiResponse === 'string' 
          ? aiResponse.substring(0, 500) 
          : (aiResponse && typeof aiResponse === 'object' 
              ? JSON.stringify({text: aiResponse.text?.substring(0, 400), mode: aiResponse.mode})
              : String(aiResponse).substring(0, 500));
        console.error('Raw response:', rawForLog);
      } catch (logError) {
        console.error('Could not log raw response:', logError.message);
      }
      
      // Check for specific error messages that indicate recoverable situations
      const rawText = typeof aiResponse === 'string' ? aiResponse : (aiResponse?.text || '');
      if (rawText.includes('model is still loading') || rawText.includes('still loading')) {
        throw new Error('AI model is still loading. Please wait a moment and try again.');
      }
      if (rawText.includes('context window') || rawText.includes('ContextWindowSizeExceeded')) {
        throw new Error('Document is too large for local AI. Try using Cloud AI or upload a smaller file.');
      }
      if (rawText.includes('[Warrant Council') || rawText.includes('CW5 Auditor')) {
        // AI returned a helpful message but not JSON - extract and return as error
        const msgMatch = rawText.match(/will help with[:\s]*(.+?)(?:Your question|$)/s);
        if (msgMatch) {
          throw new Error('AI is initializing. ' + msgMatch[1].trim().split('\n')[0]);
        }
      }
      
      // FALLBACK: Try to extract conditions from plain text response
      // The AI may have returned useful info in a non-JSON format
      if (rawText.length > 50 && !rawText.includes('error') && !rawText.includes('Error')) {
        console.log('💡 Attempting text fallback extraction...');
        const extractedConditions = extractConditionsFromText(rawText);
        if (extractedConditions.length > 0) {
          console.log(`✅ Fallback extracted ${extractedConditions.length} conditions from text`);
          return {
            conditions: extractedConditions,
            summary: 'Extracted from AI text response (non-JSON fallback)',
            wasFallback: true
          };
        }
      }
      
      throw new Error('AI returned invalid format. Please try again.');
    }
  };
  
  /**
   * Fallback: Extract conditions from plain text when AI doesn't return JSON
   * Looks for common medical condition patterns in the response
   */
  const extractConditionsFromText = (text) => {
    const conditions = [];
    const seen = new Set();
    
    // Common VA-claimable conditions to look for
    const knownConditions = [
      { pattern: /PTSD|post[- ]?traumatic stress/gi, name: 'PTSD', category: 'Mental Health', claimable: true },
      { pattern: /depress(?:ion|ive)/gi, name: 'Depression', category: 'Mental Health', claimable: true },
      { pattern: /anxiety/gi, name: 'Anxiety', category: 'Mental Health', claimable: true },
      { pattern: /tinnitus/gi, name: 'Tinnitus', category: 'Musculoskeletal', claimable: true },
      { pattern: /hearing loss/gi, name: 'Hearing Loss', category: 'Musculoskeletal', claimable: true },
      { pattern: /sleep apnea/gi, name: 'Sleep Apnea', category: 'Respiratory', claimable: true },
      { pattern: /hypertension|high blood pressure/gi, name: 'Hypertension', category: 'Cardiovascular', claimable: true },
      { pattern: /diabetes|diabetic/gi, name: 'Diabetes', category: 'Endocrine', claimable: true },
      { pattern: /GERD|gastroesophageal reflux/gi, name: 'GERD', category: 'GI', claimable: true },
      { pattern: /migraine/gi, name: 'Migraines', category: 'Neurological', claimable: true },
      { pattern: /lumbar|lower back|lumbosacral/gi, name: 'Lumbar Spine Condition', category: 'Musculoskeletal', claimable: true },
      { pattern: /cervical|neck pain|cervicalgia/gi, name: 'Cervical Spine Condition', category: 'Musculoskeletal', claimable: true },
      { pattern: /radiculopathy/gi, name: 'Radiculopathy', category: 'Neurological', claimable: true },
      { pattern: /neuropathy/gi, name: 'Peripheral Neuropathy', category: 'Neurological', claimable: true },
      { pattern: /insomnia|sleep disorder/gi, name: 'Insomnia', category: 'Mental Health', claimable: true },
      { pattern: /TBI|traumatic brain injury/gi, name: 'TBI', category: 'Neurological', claimable: true },
      { pattern: /erectile dysfunction|ED\b/gi, name: 'Erectile Dysfunction', category: 'Other', claimable: true },
      { pattern: /arthritis/gi, name: 'Arthritis', category: 'Musculoskeletal', claimable: true },
    ];
    
    for (const { pattern, name, category, claimable } of knownConditions) {
      if (pattern.test(text) && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        conditions.push({
          name,
          rawText: name,
          dateFound: null,
          isClaimable: claimable,
          category
        });
      }
    }
    
    return conditions;
  };
  
  /**
   * Format conditions response into our standard format
   */
  const formatConditionsResponse = (parsed) => {
    // Transform AI response into our condition format
    const conditions = parsed.conditions.map((c, index) => ({
      id: index + 1,
      rawName: c.rawText || c.name,
      standardizedName: c.name,
      dateFound: c.dateFound || null,
      isClaimable: c.isClaimable === true,
      category: c.category || 'Other',
      selected: false
    }));
    
    // Sort: claimable conditions first, then alphabetically
    conditions.sort((a, b) => {
      if (a.isClaimable && !b.isClaimable) return -1;
      if (!a.isClaimable && b.isClaimable) return 1;
      return a.standardizedName.localeCompare(b.standardizedName);
    });
    
    return {
      conditions,
      summary: parsed.summary || null
    };
  };
  
  /**
   * Process the dropped in file using AI
   * Auto-saves to VKB first so the document is available to other tools
   */
  const handleProcessFile = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }
    
    // Check AI availability
    if (!isAnyAIAvailable()) {
      setError('No AI available. Click the AI button in the header to configure Local AI or enter your Gemini API key.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setExtractedConditions([]);
    
    try {
      let text = '';
      
      if (file.type === 'application/pdf') {
        setProcessingStage('Extracting text from PDF...');
        text = await extractTextFromPDF(file);
      } else {
        setProcessingStage('Reading text file...');
        text = await readTextFile(file);
      }
      
      setRawText(text);
      
      if (text.length < 100) {
        throw new Error('File appears to be empty or too short. Please drop in a valid Blue Button report.');
      }
      
      // Auto-save to VKB before AI analysis (if not already saved)
      if (!savedToVKB) {
        setProcessingStage('Saving to My Packet...');
        try {
          await addDocumentToVKB({
            fileName: file.name,
            classification: 'blue_button',
            rawText: text,
            extractedData: {
              conditions: [], // Will be updated after AI analysis
              processingDate: new Date().toISOString(),
              source: 'BlueButtonXRay'
            },
            documentDate: new Date().toISOString(),
            sourceFile: file.name
          });
          setSavedToVKB(true);
          console.log('✅ Auto-saved Blue Button to VKB before AI analysis');
        } catch (vkbErr) {
          console.warn('⚠️ Could not save to VKB, continuing with AI analysis:', vkbErr.message);
          // Don't block AI analysis if VKB save fails
        }
      }
      
      setProcessingStage('AI analyzing diagnoses (this may take 30-60 seconds)...');
      const result = await analyzeWithAI(text);
      
      if (result.conditions.length === 0) {
        setError('No diagnoses found in this file. This might not be a Blue Button report, or it contains no medical conditions. You can view the raw text below.');
      } else {
        setExtractedConditions(result.conditions);
      }
      
    } catch (err) {
      console.error('Processing error:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };
  
  /**
   * Toggle condition selection
   */
  const toggleConditionSelection = (id) => {
    setExtractedConditions(prev => 
      prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c)
    );
  };
  
  /**
   * Select all claimable conditions
   */
  const selectAllClaimable = () => {
    setExtractedConditions(prev => 
      prev.map(c => ({ ...c, selected: c.isClaimable }))
    );
  };
  
  /**
   * Reset the tool
   */
  const handleReset = () => {
    setFile(null);
    setExtractedConditions([]);
    setRawText('');
    setError(null);
    setShowRawText(false);
    setSavedToVKB(false);
    setSavingToVKB(false);
  };
  
  /**
   * Get count of claimable conditions not typically claimed
   */
  const getUnclaimedCount = () => {
    return extractedConditions.filter(c => c.isClaimable).length;
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-violet-600 to-purple-600 p-4 shadow-lg rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📋</span>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Blue Button X-Ray
                  <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded">AI</span>
                  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">BETA</span>
                </h2>
                <p className="text-sm text-violet-100">AI-Powered Evidence Mining from VA Medical Records</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LLMRecommendationBadge toolId="blue-button" />
              <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
              {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Blue Button X-Ray" />}
              <button
                onClick={onClose}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        <div className="overflow-y-auto flex-1 p-4">
          {/* Main Content */}
          <div className="max-w-4xl mx-auto">
            {/* Info Banner */}
            <div className="bg-cyan-50 dark:bg-cyan-900/30 border-l-4 border-cyan-500 p-4 mb-6 rounded-r-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <h3 className="font-bold text-cyan-800 dark:text-cyan-200">What is the Blue Button Report?</h3>
                  <p className="text-cyan-700 dark:text-cyan-300 text-sm mt-1">
                    The <strong>Blue Button</strong> is your instant-download VA medical record from <a href="https://www.va.gov/my-health/medical-records/download/" target="_blank" rel="noopener noreferrer" className="underline hover:text-cyan-600">VA.gov</a>. 
                    Unlike the C-File (which takes 6+ months), you can get this <strong>today</strong>.
                  </p>
                  <p className="text-cyan-700 dark:text-cyan-300 text-sm mt-2">
                    🤖 <strong>AI-Powered:</strong> Uses your {aiStatus.effectiveMode === AI_MODES.LOCAL ? 'secure Local AI' : 'Cloud AI'} to intelligently extract diagnoses. 
                    {aiStatus.effectiveMode === AI_MODES.LOCAL && ' Your data never leaves your device!'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Smart AI Load Button */}
            {!isAnyAIAvailable() && (
              <div className="mb-6">
                <SmartAILoadButton 
                  toolId="bluebutton-xray"
                  onLoadComplete={(model) => console.log('Smart AI loaded for BlueButton XRay:', model?.name)}
                />
              </div>
            )}
            
            {/* Large Document Info */}
            {isAnyAIAvailable() && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div>
                    <h3 className="font-bold text-blue-800 dark:text-blue-200">Large Files? No Problem!</h3>
                    <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                      Got a big medical record? Don't worry! The system automatically handles large Blue Button files 
                      by breaking them into smaller sections and combining the results. <strong>You don't need to do anything special.</strong>
                    </p>
                    <p className="text-blue-600 dark:text-blue-400 text-xs mt-2">
                      📄 Files of any size work • ⚡ Processing time depends on file size • 🔄 Multi-part files process automatically
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* File Drop In Section */}
            {!extractedConditions.length && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                  Step 1: Drop In Your Blue Button Report
                </h3>
                
                {/* Drop Zone */}
                <div
                  className={`border-3 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30'
                      : file
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                      : 'border-gray-300 dark:border-gray-600 hover:border-cyan-400 dark:hover:border-cyan-500'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,text/plain,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {file ? (
                    <div className="space-y-2">
                      <span className="text-4xl">✅</span>
                      <p className="text-green-700 dark:text-green-300 font-semibold">{file.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <span className="text-5xl">📄</span>
                      <p className="text-gray-600 dark:text-gray-300 font-semibold">
                        Drop your Blue Button report here
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Accepts PDF or TXT files from MyHealtheVet
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Process Button */}
                {file && (
                  <div className="flex flex-col sm:flex-row gap-3 mt-4">
                    {/* Save to VKB Button - Available immediately after upload */}
                    <button
                      onClick={handleSaveToVKB}
                      disabled={savingToVKB || savedToVKB}
                      className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
                        savedToVKB
                          ? 'bg-green-600 text-white cursor-default'
                          : savingToVKB
                            ? 'bg-gray-400 text-white cursor-wait'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      <span>{savedToVKB ? '✓' : savingToVKB ? '⏳' : '📦'}</span>
                      <span>{savedToVKB ? 'Saved to My Packet!' : savingToVKB ? 'Saving...' : 'Save to My Packet'}</span>
                    </button>
                    
                    {/* AI Scan Button */}
                    <button
                      onClick={handleProcessFile}
                      disabled={isProcessing || !isAnyAIAvailable()}
                      className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
                        isProcessing || !isAnyAIAvailable()
                          ? 'bg-gray-400 cursor-not-allowed text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          <span>{processingStage}</span>
                        </>
                      ) : !isAnyAIAvailable() ? (
                        <>
                          <span>⚠️</span>
                          <span>Configure AI First</span>
                        </>
                      ) : (
                        <>
                          <span>🤖</span>
                          <span>AI Scan for Diagnoses</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {/* Explanation of options */}
                {file && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                    💡 <strong>Save to My Packet</strong> stores the document now. <strong>AI Scan</strong> auto-saves first, then extracts diagnoses.
                  </p>
                )}
                
                {/* How to Download Blue Button */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">📥 How to Download Your Blue Button:</h4>
                  <ol className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-decimal list-inside">
                    <li>Go to <a href="https://www.va.gov/my-health/medical-records/download/" target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 underline">VA.gov Medical Records Download</a></li>
                    <li>Sign in with your Login.gov or ID.me account</li>
                    <li><strong>Step 1:</strong> Select date range (choose <strong>"All Time"</strong> for complete history)</li>
                    <li><strong>Step 2:</strong> Check <strong>"Select all VA records"</strong> (includes all conditions, labs, meds)</li>
                    <li><strong>Step 3:</strong> Choose <strong>"Text file"</strong> format (works best with X-Ray)</li>
                    <li>Click <strong>"Download report"</strong> and drop the file in here</li>
                  </ol>
                </div>
              </div>
            )}
            
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h3 className="font-bold text-red-800 dark:text-red-200">Issue Found</h3>
                    <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Results Section */}
            {extractedConditions.length > 0 && (
              <div className="space-y-6">
                {/* Summary Card */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 rounded-full p-3">
                      <span className="text-4xl">🎯</span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">Found {extractedConditions.length} Conditions!</h3>
                      <p className="text-green-100">
                        {getUnclaimedCount()} are commonly claimed VA disabilities
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={selectAllClaimable}
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition-colors flex items-center gap-2"
                  >
                    <span>✅</span> Select All Claimable
                  </button>
                  <button
                    onClick={handleSaveToVKB}
                    disabled={savingToVKB || savedToVKB}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                      savedToVKB
                        ? 'bg-green-600 text-white cursor-default'
                        : savingToVKB
                          ? 'bg-gray-400 text-white cursor-wait'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    <span>{savedToVKB ? '✓' : savingToVKB ? '⏳' : '📦'}</span>
                    {savedToVKB ? 'Saved to My Packet!' : savingToVKB ? 'Saving...' : 'Save to My Packet'}
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                  >
                    <span>🔄</span> Start Over
                  </button>
                  <button
                    onClick={() => setShowRawText(!showRawText)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                  >
                    <span>📝</span> {showRawText ? 'Hide' : 'Show'} Raw Text
                  </button>
                </div>
                
                {/* Conditions List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                      📋 Extracted Diagnoses
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Click a condition to select it, then add to your calculator or check rating criteria
                    </p>
                  </div>
                  
                  <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
                    {extractedConditions.map((condition) => (
                      <div
                        key={condition.id}
                        className={`p-4 cursor-pointer transition-colors ${
                          condition.selected
                            ? 'bg-cyan-50 dark:bg-cyan-900/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                        onClick={() => toggleConditionSelection(condition.id)}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            condition.selected
                              ? 'bg-cyan-600 border-cyan-600 text-white'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {condition.selected && (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          
                          {/* Condition Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-800 dark:text-gray-100">
                                {condition.standardizedName}
                              </span>
                              {condition.isClaimable && (
                                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                                  ⭐ Commonly Claimed
                                </span>
                              )}
                            </div>
                            {condition.rawName !== condition.standardizedName && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                From record: "{condition.rawName}"
                              </p>
                            )}
                            {condition.dateFound && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                📅 Date in record: {condition.dateFound}
                              </p>
                            )}
                          </div>
                          
                          {/* Quick Actions */}
                          <div className="flex gap-2 flex-shrink-0">
                            {onCheckRatingCriteria && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCheckRatingCriteria(condition.standardizedName);
                                }}
                                className="px-3 py-1.5 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/70 transition-colors"
                                title="Search rating criteria for this condition"
                              >
                                🔍 Check Criteria
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Add Selected to Calculator */}
                {extractedConditions.some(c => c.selected) && onAddToCalculator && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-100">
                          {extractedConditions.filter(c => c.selected).length} condition(s) selected
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Add to Pathfinder for strategic analysis
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const selected = extractedConditions.filter(c => c.selected);
                          onAddToCalculator(selected);
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-bold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center gap-2"
                      >
                        <span>🧭</span>
                        Add to Pathfinder
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Raw Text View */}
                {showRawText && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                        📝 Raw Extracted Text
                      </h3>
                    </div>
                    <div className="p-4 max-h-96 overflow-y-auto">
                      <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono">
                        {rawText.substring(0, 10000)}
                        {rawText.length > 10000 && '\n\n... [Text truncated for display]'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Not Currently Claimed Alert */}
            {extractedConditions.length > 0 && getUnclaimedCount() > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 mt-6 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💰</span>
                  <div>
                    <h3 className="font-bold text-amber-800 dark:text-amber-200">
                      Potential Unclaimed Disabilities Found!
                    </h3>
                    <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                      You have <strong>{getUnclaimedCount()} condition(s)</strong> in your VA records that are commonly service-connected. 
                      Use the <strong>Pathfinder</strong> to analyze which ones might qualify for compensation!
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Support CTA after extraction */}
            {extractedConditions.length > 0 && (
              <div className="bg-gradient-to-r from-blue-900/40 to-cyan-900/40 rounded-2xl p-6 border border-blue-700/50 mt-6">
                <div className="flex items-center gap-4">
                  <img 
                    src="/images/Anth.jpg" 
                    alt="Anthony - Vet-Rate Developer"
                    className="w-14 h-14 rounded-full object-cover border-2 border-blue-500 shadow-lg flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-blue-200 font-semibold mb-1">
                      🩺 That medical record parsing would cost $200+ at a law firm
                    </p>
                    <p className="text-blue-300/70 text-sm">
                      This AI-powered tool scans your Blue Button records, extracts diagnoses, and 
                      cross-references VA's rating schedule - all locally in your browser. 
                      Help fund the servers and development that make this possible.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* BuyMeCoffee - shows after successful extraction */}
      <BuyMeCoffee 
        show={extractedConditions.length > 0} 
        trigger="blue-button" 
        context={{ count: extractedConditions.length }}
        componentKey="blue-button-xray"
      />
    </div>
  );
}
