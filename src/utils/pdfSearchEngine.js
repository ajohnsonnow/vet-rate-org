/**
 * SupplyLocker.org - The Needle in the Haystack (PDF Keyword Search)
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * "The Evidence Hunter" - Find specific keywords in massive STR/C-File PDFs
 * 
 * The Problem: Veterans know they injured their back in 2006, but their Service Treatment
 * Record is a 2,000-page unsearchable PDF. They can't cite evidence they can't find.
 * 
 * The Solution: Client-side PDF search that finds every mention of a keyword and shows
 * the page number + context snippet. NO upload to servers-100% private.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker - use bundled worker from npm package for version compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Standard fonts CDN path (suppresses font warnings)
const STANDARD_FONT_DATA_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/standard_fonts/';

/**
 * Search result object
 * @typedef {Object} SearchResult
 * @property {number} page - Page number where keyword was found
 * @property {string} context - Text snippet showing keyword in context
 * @property {number} position - Character position on the page
 */

/**
 * Search a PDF file for keywords
 * Runs in chunks to prevent UI freezing on large files
 * 
 * @param {ArrayBuffer} pdfData - The PDF file as an ArrayBuffer
 * @param {string|RegExp} searchTerm - The keyword or regex pattern to search for
 * @param {Object} options - Search options
 * @param {boolean} options.caseSensitive - Whether search should be case-sensitive
 * @param {boolean} options.wholeWord - Whether to match whole words only
 * @param {number} options.contextLength - Characters to show before/after match (default 150)
 * @param {Function} options.onProgress - Progress callback (currentPage, totalPages)
 * @returns {Promise<{results: SearchResult[], totalMatches: number, pagesSearched: number}>}
 */
export async function searchPdfForKeyword(pdfData, searchTerm, options = {}) {
  const {
    caseSensitive = false,
    wholeWord = false,
    contextLength = 150,
    onProgress = () => {}
  } = options;

  try {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const numPages = pdf.numPages;
    const results = [];
    let totalMatches = 0;

    // Build search pattern
    let pattern;
    if (searchTerm instanceof RegExp) {
      pattern = searchTerm;
    } else {
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundary = wholeWord ? '\\b' : '';
      const flags = caseSensitive ? 'g' : 'gi';
      pattern = new RegExp(`${wordBoundary}${escapedTerm}${wordBoundary}`, flags);
    }

    // Search each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Extract text from page
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .replace(/\s+/g, ' ');

        // Find all matches on this page
        const matches = [...pageText.matchAll(pattern)];
        
        if (matches.length > 0) {
          totalMatches += matches.length;
          
          // For each match, create a result with context
          matches.forEach((match) => {
            const matchIndex = match.index;
            const matchText = match[0];
            
            // Extract context around the match
            const contextStart = Math.max(0, matchIndex - contextLength);
            const contextEnd = Math.min(pageText.length, matchIndex + matchText.length + contextLength);
            
            let context = pageText.substring(contextStart, contextEnd);
            
            // Add ellipsis if we're not at the start/end
            if (contextStart > 0) context = '...' + context;
            if (contextEnd < pageText.length) context = context + '...';
            
            results.push({
              page: pageNum,
              context: context,
              matchText: matchText,
              position: matchIndex
            });
          });
        }

        // Report progress
        onProgress(pageNum, numPages);

        // Yield to browser every 10 pages to prevent UI freeze
        if (pageNum % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } catch (pageError) {
        console.warn(`Error searching page ${pageNum}:`, pageError);
        onProgress(pageNum, numPages);
      }
    }

    return {
      results,
      totalMatches,
      pagesSearched: numPages
    };
  } catch (error) {
    console.error('PDF search error:', error);
    throw new Error(`Failed to search PDF: ${error.message}`);
  }
}

/**
 * Search for multiple keywords at once
 * More efficient than running separate searches
 * 
 * @param {ArrayBuffer} pdfData - The PDF file
 * @param {string[]} keywords - Array of keywords to search for
 * @param {Object} options - Search options (same as searchPdfForKeyword)
 * @returns {Promise<Map<string, SearchResult[]>>}
 */
export async function searchPdfForMultipleKeywords(pdfData, keywords, options = {}) {
  const {
    caseSensitive = false,
    wholeWord = false,
    contextLength = 150,
    onProgress = () => {}
  } = options;

  try {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const numPages = pdf.numPages;
    
    // Initialize results map
    const resultsMap = new Map();
    keywords.forEach(keyword => resultsMap.set(keyword, []));

    // Build search patterns for all keywords
    const patterns = keywords.map(keyword => {
      const escapedTerm = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundary = wholeWord ? '\\b' : '';
      const flags = caseSensitive ? 'g' : 'gi';
      return {
        keyword,
        pattern: new RegExp(`${wordBoundary}${escapedTerm}${wordBoundary}`, flags)
      };
    });

    // Search each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .replace(/\s+/g, ' ');

        // Test all patterns against this page
        patterns.forEach(({ keyword, pattern }) => {
          const matches = [...pageText.matchAll(pattern)];
          
          matches.forEach((match) => {
            const matchIndex = match.index;
            const matchText = match[0];
            
            const contextStart = Math.max(0, matchIndex - contextLength);
            const contextEnd = Math.min(pageText.length, matchIndex + matchText.length + contextLength);
            
            let context = pageText.substring(contextStart, contextEnd);
            if (contextStart > 0) context = '...' + context;
            if (contextEnd < pageText.length) context = context + '...';
            
            resultsMap.get(keyword).push({
              page: pageNum,
              context: context,
              matchText: matchText,
              position: matchIndex
            });
          });
        });

        onProgress(pageNum, numPages);

        if (pageNum % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } catch (pageError) {
        console.warn(`Error searching page ${pageNum}:`, pageError);
        onProgress(pageNum, numPages);
      }
    }

    return resultsMap;
  } catch (error) {
    console.error('Multi-keyword PDF search error:', error);
    throw new Error(`Failed to search PDF: ${error.message}`);
  }
}

/**
 * Get common medical keywords for quick search
 * Pre-built search terms for common VA conditions
 */
export const COMMON_MEDICAL_KEYWORDS = {
  back: ['back', 'lumbar', 'spine', 'vertebra', 'disc', 'spinal'],
  knee: ['knee', 'patella', 'meniscus', 'ACL', 'MCL', 'ligament'],
  shoulder: ['shoulder', 'rotator', 'clavicle', 'scapula', 'humerus'],
  mental_health: ['PTSD', 'depression', 'anxiety', 'panic', 'stress', 'mental health'],
  tbi: ['TBI', 'concussion', 'head injury', 'traumatic brain', 'blast'],
  hearing: ['tinnitus', 'hearing', 'audiogram', 'ear', 'acoustic'],
  respiratory: ['asthma', 'COPD', 'breathing', 'lung', 'pulmonary'],
  heart: ['heart', 'cardiac', 'coronary', 'hypertension', 'blood pressure'],
  skin: ['skin', 'dermatology', 'rash', 'psoriasis', 'eczema'],
  gastrointestinal: ['stomach', 'bowel', 'IBS', 'GERD', 'reflux', 'gastro'],
  sleep: ['sleep', 'insomnia', 'apnea', 'fatigue', 'nightmare']
};

/**
 * Extract page content for citation
 * Useful for generating "As noted on page X..." citations
 * 
 * @param {ArrayBuffer} pdfData - The PDF file
 * @param {number} pageNum - Page number to extract
 * @returns {Promise<string>}
 */
export async function extractPageText(pdfData, pageNum) {
  try {
    const pdf = await pdfjsLib.getDocument({ 
      data: pdfData,
      standardFontDataUrl: STANDARD_FONT_DATA_URL 
    }).promise;
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    const pageText = textContent.items
      .map(item => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return pageText;
  } catch (error) {
    console.error(`Error extracting page ${pageNum}:`, error);
    throw new Error(`Failed to extract page ${pageNum}: ${error.message}`);
  }
}

/**
 * Highlight search term in context string (for UI display)
 * Returns HTML string with <mark> tags
 * 
 * @param {string} context - The context text
 * @param {string} searchTerm - The term to highlight
 * @param {boolean} caseSensitive - Whether to match case
 * @returns {string} HTML string with highlighted term
 */
export function highlightSearchTerm(context, searchTerm, caseSensitive = false) {
  const flags = caseSensitive ? 'g' : 'gi';
  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(${escapedTerm})`, flags);
  
  return context.replace(pattern, '<mark class="bg-yellow-300 dark:bg-yellow-600 font-bold">$1</mark>');
}

export default {
  searchPdfForKeyword,
  searchPdfForMultipleKeywords,
  extractPageText,
  highlightSearchTerm,
  COMMON_MEDICAL_KEYWORDS
};
