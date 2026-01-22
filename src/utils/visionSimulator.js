/**
 * ============================================================================
 * Vet-Rate Vision Simulator
 * ============================================================================
 * 
 * A clever workaround for the WebGPU u8 shader limitation in vision models.
 * 
 * THE PROBLEM:
 * Vision models like Phi-3.5-Vision use CLIP encoders that process images
 * as uint8 (u8) pixel data. WebGPU shaders for this require the experimental
 * "chromium_experimental_subgroup_matrix" extension, which isn't available
 * in standard browsers.
 * 
 * THE SOLUTION:
 * Instead of using a true vision LLM, we:
 * 1. Use Tesseract.js (OCR) to extract text from images
 * 2. Use Canvas API to analyze image structure/layout
 * 3. Combine this metadata with a text-only LLM
 * 
 * This gives us ~80% of vision model functionality for DD214/document analysis
 * while working in ANY browser with WebGPU support!
 * 
 * Usage:
 *   import { VisionSimulator } from './visionSimulator';
 *   const simulator = new VisionSimulator();
 *   const analysis = await simulator.analyzeImage(imageBlob, 'Describe this DD214');
 * ============================================================================
 */

// Check if Tesseract is available
let Tesseract = null;

/**
 * Initialize Tesseract.js lazily
 */
async function initTesseract() {
  if (Tesseract) return Tesseract;
  
  try {
    // Dynamic import for code splitting
    const module = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
    Tesseract = module.default || module;
    return Tesseract;
  } catch (err) {
    console.warn('Failed to load Tesseract.js:', err);
    return null;
  }
}

/**
 * Extract visual metadata from an image using Canvas API
 * This gives us structural information without needing u8 shaders
 */
async function analyzeImageStructure(imageBlob) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Get image data for analysis
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Calculate basic statistics
      let totalBrightness = 0;
      let darkPixels = 0;
      let lightPixels = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        
        totalBrightness += brightness;
        if (brightness < 64) darkPixels++;
        if (brightness > 192) lightPixels++;
      }
      
      const pixelCount = data.length / 4;
      const avgBrightness = totalBrightness / pixelCount;
      
      // Detect if it's likely a document (high contrast, mostly light background)
      const isLikelyDocument = avgBrightness > 180 && (lightPixels / pixelCount) > 0.6;
      const isLikelyScanned = avgBrightness > 150 && avgBrightness < 230;
      
      // Detect aspect ratio (portrait documents vs landscape photos)
      const aspectRatio = img.width / img.height;
      const isPortrait = aspectRatio < 0.9;
      const isLandscape = aspectRatio > 1.1;
      const isStandardLetter = Math.abs(aspectRatio - 0.773) < 0.1; // 8.5x11 ratio
      
      // Edge detection for text density estimation
      let edgeCount = 0;
      for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
          const idx = (y * canvas.width + x) * 4;
          const center = data[idx];
          const left = data[idx - 4];
          const right = data[idx + 4];
          const up = data[idx - canvas.width * 4];
          const down = data[idx + canvas.width * 4];
          
          const gradient = Math.abs(center - left) + Math.abs(center - right) +
                          Math.abs(center - up) + Math.abs(center - down);
          
          if (gradient > 100) edgeCount++;
        }
      }
      
      const textDensity = edgeCount / pixelCount;
      const hasHighTextDensity = textDensity > 0.1;
      
      URL.revokeObjectURL(url);
      
      resolve({
        width: img.width,
        height: img.height,
        aspectRatio: aspectRatio.toFixed(2),
        avgBrightness: Math.round(avgBrightness),
        isLikelyDocument,
        isLikelyScanned,
        isPortrait,
        isLandscape,
        isStandardLetter,
        hasHighTextDensity,
        textDensityScore: (textDensity * 100).toFixed(1) + '%',
        estimatedType: isLikelyDocument 
          ? (isStandardLetter ? 'Official Document (Letter Size)' : 'Document/Form')
          : (hasHighTextDensity ? 'Text-Heavy Image' : 'Photo/Graphics')
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        error: 'Failed to load image',
        width: 0,
        height: 0
      });
    };
    
    img.src = url;
  });
}

/**
 * Perform OCR on an image
 */
async function performOCR(imageBlob, onProgress) {
  const tesseract = await initTesseract();
  
  if (!tesseract) {
    return {
      text: '',
      confidence: 0,
      error: 'OCR not available'
    };
  }
  
  try {
    const worker = await tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (onProgress && m.status === 'recognizing text') {
          onProgress(Math.round(m.progress * 100));
        }
      }
    });
    
    const { data } = await worker.recognize(imageBlob);
    await worker.terminate();
    
    return {
      text: data.text,
      confidence: data.confidence,
      lines: data.lines?.length || 0,
      words: data.words?.length || 0
    };
  } catch (err) {
    console.error('OCR error:', err);
    return {
      text: '',
      confidence: 0,
      error: err.message
    };
  }
}

/**
 * Detect DD214-specific elements in OCR text
 */
function detectDD214Elements(text) {
  const upperText = text.toUpperCase();
  
  const elements = {
    isLikelyDD214: false,
    formNumber: null,
    memberInfo: {},
    serviceInfo: {},
    characterOfService: null,
    decorations: [],
    remarks: null
  };
  
  // Check for DD214 form identifiers
  if (upperText.includes('DD FORM 214') || upperText.includes('DD214') || 
      upperText.includes('CERTIFICATE OF RELEASE') || upperText.includes('DISCHARGE FROM ACTIVE DUTY')) {
    elements.isLikelyDD214 = true;
  }
  
  // Extract service dates
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;
  const dates = text.match(datePattern) || [];
  if (dates.length >= 2) {
    elements.serviceInfo.possibleDates = dates.slice(0, 4);
  }
  
  // Character of service keywords
  const characterKeywords = ['HONORABLE', 'GENERAL', 'OTHER THAN HONORABLE', 'BAD CONDUCT', 'DISHONORABLE'];
  for (const char of characterKeywords) {
    if (upperText.includes(char)) {
      elements.characterOfService = char;
      break;
    }
  }
  
  // Military branch detection
  const branches = ['ARMY', 'NAVY', 'AIR FORCE', 'MARINE', 'COAST GUARD', 'SPACE FORCE'];
  for (const branch of branches) {
    if (upperText.includes(branch)) {
      elements.serviceInfo.branch = branch;
      break;
    }
  }
  
  // MOS/Rating detection
  const mosPattern = /\b(\d{2}[A-Z]\d{2}|\d{2}[A-Z])\b/g;
  const mosMatches = text.match(mosPattern);
  if (mosMatches) {
    elements.serviceInfo.possibleMOS = mosMatches;
  }
  
  // Decoration keywords
  const decorationKeywords = ['MEDAL', 'RIBBON', 'BADGE', 'AWARD', 'STAR', 'HEART', 'COMMENDATION'];
  elements.decorations = decorationKeywords.filter(kw => upperText.includes(kw));
  
  return elements;
}

/**
 * Build a structured prompt for the text LLM that simulates vision understanding
 */
function buildVisionSimulatorPrompt(structureInfo, ocrResult, dd214Elements, userQuery) {
  let contextPrompt = `You are analyzing a document image. Here's what I can see:

📊 IMAGE STRUCTURE:
- Dimensions: ${structureInfo.width} x ${structureInfo.height} pixels
- Type: ${structureInfo.estimatedType}
- Orientation: ${structureInfo.isPortrait ? 'Portrait' : structureInfo.isLandscape ? 'Landscape' : 'Square'}
- Text Density: ${structureInfo.textDensityScore}
${structureInfo.isLikelyDocument ? '- This appears to be an official document' : ''}
${structureInfo.isStandardLetter ? '- Standard letter size (8.5" x 11")' : ''}

📝 EXTRACTED TEXT:
"""
${ocrResult.text.substring(0, 4000)}${ocrResult.text.length > 4000 ? '\n[...text truncated...]' : ''}
"""

OCR Confidence: ${ocrResult.confidence}%
Lines detected: ${ocrResult.lines}
Words detected: ${ocrResult.words}
`;

  if (dd214Elements.isLikelyDD214) {
    contextPrompt += `
🎖️ DD214 DETECTION:
This document appears to be a DD214 (Certificate of Release or Discharge from Active Duty).

Detected Elements:
- Character of Service: ${dd214Elements.characterOfService || 'Not clearly detected'}
- Branch: ${dd214Elements.serviceInfo.branch || 'Not clearly detected'}
- Possible Dates: ${dd214Elements.serviceInfo.possibleDates?.join(', ') || 'Not detected'}
- MOS/Rating Codes: ${dd214Elements.serviceInfo.possibleMOS?.join(', ') || 'Not detected'}
- Decorations/Awards mentioned: ${dd214Elements.decorations.length > 0 ? dd214Elements.decorations.join(', ') : 'None detected'}
`;
  }

  contextPrompt += `
---
USER QUESTION: ${userQuery}

Based on the extracted text and document structure above, please answer the user's question. If information is unclear or not visible in the extracted text, say so honestly.`;

  return contextPrompt;
}

/**
 * Vision Simulator Class
 * Provides vision-like capabilities using OCR + text LLM
 */
export class VisionSimulator {
  constructor(options = {}) {
    this.options = {
      maxTextLength: options.maxTextLength || 6000,
      enableDD214Detection: options.enableDD214Detection ?? true,
      ...options
    };
  }
  
  /**
   * Analyze an image and answer a question about it
   * @param {Blob|File} imageBlob - The image to analyze
   * @param {string} query - The user's question about the image
   * @param {Function} onProgress - Progress callback (0-100)
   * @returns {Promise<Object>} Analysis result with context for LLM
   */
  async analyzeImage(imageBlob, query, onProgress) {
    const result = {
      success: false,
      structureInfo: null,
      ocrResult: null,
      dd214Elements: null,
      llmPrompt: null,
      error: null
    };
    
    try {
      // Step 1: Analyze image structure (fast, no external deps)
      if (onProgress) onProgress(10);
      result.structureInfo = await analyzeImageStructure(imageBlob);
      
      // Step 2: Perform OCR (slower, uses Tesseract.js)
      if (onProgress) onProgress(20);
      result.ocrResult = await performOCR(imageBlob, (p) => {
        if (onProgress) onProgress(20 + Math.round(p * 0.6)); // 20-80%
      });
      
      // Step 3: Detect DD214 elements if enabled
      if (onProgress) onProgress(85);
      if (this.options.enableDD214Detection && result.ocrResult.text) {
        result.dd214Elements = detectDD214Elements(result.ocrResult.text);
      }
      
      // Step 4: Build the LLM prompt
      if (onProgress) onProgress(95);
      result.llmPrompt = buildVisionSimulatorPrompt(
        result.structureInfo,
        result.ocrResult,
        result.dd214Elements || {},
        query
      );
      
      result.success = true;
      if (onProgress) onProgress(100);
      
    } catch (err) {
      result.error = err.message;
      console.error('Vision simulation error:', err);
    }
    
    return result;
  }
  
  /**
   * Quick check if an image is likely a DD214
   */
  async quickDD214Check(imageBlob) {
    const structure = await analyzeImageStructure(imageBlob);
    
    // Quick heuristics for DD214
    if (!structure.isLikelyDocument) return { isLikely: false, reason: 'Not a document' };
    if (!structure.hasHighTextDensity) return { isLikely: false, reason: 'Low text density' };
    
    // Do quick OCR on first portion
    const ocr = await performOCR(imageBlob);
    const upperText = ocr.text.toUpperCase();
    
    const dd214Indicators = [
      'DD FORM 214',
      'DD214',
      'CERTIFICATE OF RELEASE',
      'DISCHARGE FROM ACTIVE DUTY',
      'ARMED FORCES OF THE UNITED STATES'
    ];
    
    const found = dd214Indicators.filter(ind => upperText.includes(ind));
    
    return {
      isLikely: found.length > 0,
      confidence: Math.min(100, found.length * 30 + ocr.confidence * 0.3),
      indicators: found,
      reason: found.length > 0 ? `Found: ${found.join(', ')}` : 'No DD214 indicators found'
    };
  }
  
  /**
   * Get the capabilities/limitations of the simulator
   */
  static getCapabilities() {
    return {
      name: 'Vision Simulator',
      description: 'OCR + Canvas API simulation of vision model capabilities',
      worksInStandardChrome: true,
      requiresExperimentalFlags: false,
      capabilities: [
        '✅ Extract text from documents and images',
        '✅ Detect DD214 forms and extract key fields',
        '✅ Analyze document structure and layout',
        '✅ Answer questions about document content',
        '✅ Works in ALL browsers with WebGPU support'
      ],
      limitations: [
        '⚠️ Cannot understand non-text visual elements (photos, diagrams)',
        '⚠️ OCR accuracy depends on image quality',
        '⚠️ Cannot read handwritten text well',
        '⚠️ No true visual reasoning (relies on extracted text)'
      ],
      bestFor: [
        'DD214 analysis',
        'Medical record text extraction',
        'VA form processing',
        'Document text questions'
      ]
    };
  }
}

// Export individual functions for flexibility
export {
  analyzeImageStructure,
  performOCR,
  detectDD214Elements,
  buildVisionSimulatorPrompt
};

export default VisionSimulator;
