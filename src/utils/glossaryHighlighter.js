/**
 * VA Glossary Highlighter - "Jargon Decoder"
 * Automatically detects VA acronyms in text and wraps them with tooltip markup
 * 
 * Usage:
 *   import { highlightVATerms } from './utils/glossaryHighlighter';
 *   
 *   const enhanced = highlightVATerms("You need a C&P Exam and a Nexus Letter for your claim.");
 *   // Returns: "You need a <span class="va-term" data-term="C&P">C&P</span> Exam..."
 */

import { VA_GLOSSARY, VA_GLOSSARY_PATTERNS, getDefinition } from './vaGlossary';

/**
 * Escape special regex characters in a string
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Highlight VA terms in text with tooltip markup
 * @param {string} text - The text to process
 * @param {Object} options - Configuration options
 * @param {boolean} options.caseSensitive - Whether to match case-sensitively (default: false)
 * @param {string[]} options.excludeTerms - Terms to skip highlighting
 * @param {string} options.wrapperClass - CSS class for wrapper span (default: 'va-term')
 * @returns {string} - HTML string with tooltip markup
 */
export const highlightVATerms = (text, options = {}) => {
  const {
    caseSensitive = false,
    excludeTerms = [],
    wrapperClass = 'va-term'
  } = options;

  if (!text || typeof text !== 'string') {
    return text;
  }

  let processedText = text;
  const replacements = [];

  // First pass: Handle pattern-based matching (multi-word phrases)
  VA_GLOSSARY_PATTERNS.forEach(({ pattern, key }) => {
    if (excludeTerms.includes(key)) return;

    const matches = [...processedText.matchAll(pattern)];
    matches.forEach(match => {
      const term = match[0];
      const definition = getDefinition(key);
      
      if (definition) {
        const placeholder = `__VA_TERM_${replacements.length}__`;
        replacements.push({
          placeholder,
          html: `<span class="${wrapperClass}" data-term="${escapeHtml(key)}" data-definition="${escapeHtml(definition)}">${escapeHtml(term)}</span>`
        });
        
        // Replace with placeholder to prevent double-processing
        processedText = processedText.replace(match[0], placeholder);
      }
    });
  });

  // Second pass: Handle single-word terms from glossary
  Object.keys(VA_GLOSSARY).forEach(term => {
    if (excludeTerms.includes(term)) return;
    
    // Skip if already covered by patterns
    const alreadyCovered = VA_GLOSSARY_PATTERNS.some(p => p.key === term);
    if (alreadyCovered) return;

    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, flags);
    
    // Only process if not inside a placeholder
    const matches = [...processedText.matchAll(regex)];
    matches.forEach(match => {
      // Skip if inside an existing placeholder
      if (match.input.substring(Math.max(0, match.index - 10), match.index).includes('__VA_TERM_')) {
        return;
      }
      
      const definition = VA_GLOSSARY[term];
      const placeholder = `__VA_TERM_${replacements.length}__`;
      replacements.push({
        placeholder,
        html: `<span class="${wrapperClass}" data-term="${escapeHtml(term)}" data-definition="${escapeHtml(definition)}">${escapeHtml(match[0])}</span>`
      });
      
      processedText = processedText.replace(match[0], placeholder);
    });
  });

  // Final pass: Replace all placeholders with actual HTML
  replacements.forEach(({ placeholder, html }) => {
    processedText = processedText.replace(placeholder, html);
  });

  return processedText;
};

/**
 * React-friendly version that returns JSX elements instead of HTML strings
 * @param {string} text - The text to process
 * @param {Object} options - Configuration options (same as highlightVATerms)
 * @returns {Array<string|Object>} - Array of text strings and React element objects
 */
export const highlightVATermsReact = (text, options = {}) => {
  if (!text || typeof text !== 'string') {
    return [text];
  }

  const {
    caseSensitive = false,
    excludeTerms = [],
  } = options;

  const elements = [];
  let lastIndex = 0;
  const matches = [];

  // Collect all matches with their positions
  VA_GLOSSARY_PATTERNS.forEach(({ pattern, key }) => {
    if (excludeTerms.includes(key)) return;
    
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const definition = getDefinition(key);
      if (definition) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          term: match[0],
          key: key,
          definition: definition
        });
      }
    }
  });

  // Add single-word matches
  Object.keys(VA_GLOSSARY).forEach(term => {
    if (excludeTerms.includes(term)) return;
    
    const alreadyCovered = VA_GLOSSARY_PATTERNS.some(p => p.key === term);
    if (alreadyCovered) return;

    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const definition = VA_GLOSSARY[term];
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        term: match[0],
        key: term,
        definition: definition
      });
    }
  });

  // Sort matches by position and remove overlaps
  matches.sort((a, b) => a.start - b.start);
  const filteredMatches = [];
  let lastEnd = -1;
  
  matches.forEach(match => {
    if (match.start >= lastEnd) {
      filteredMatches.push(match);
      lastEnd = match.end;
    }
  });

  // Build the result array
  filteredMatches.forEach((match, index) => {
    // Add text before this match
    if (match.start > lastIndex) {
      elements.push(text.substring(lastIndex, match.start));
    }
    
    // Add the match as a React element object
    elements.push({
      type: 'va-term',
      key: `va-term-${index}`,
      term: match.key,
      displayText: match.term,
      definition: match.definition
    });
    
    lastIndex = match.end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements.length > 0 ? elements : [text];
};

/**
 * Escape HTML special characters
 */
const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Extract all VA terms found in text (for analysis/debugging)
 * @param {string} text - The text to analyze
 * @returns {Array<{term: string, definition: string}>}
 */
export const extractVATerms = (text) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const found = [];
  const seen = new Set();

  // Check patterns
  VA_GLOSSARY_PATTERNS.forEach(({ pattern, key }) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = [...text.matchAll(regex)];
    
    matches.forEach(match => {
      if (!seen.has(key)) {
        const definition = getDefinition(key);
        if (definition) {
          found.push({ term: key, definition, instances: 1 });
          seen.add(key);
        }
      }
    });
  });

  // Check single words
  Object.keys(VA_GLOSSARY).forEach(term => {
    if (seen.has(term)) return;
    
    const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
    if (regex.test(text)) {
      found.push({ term, definition: VA_GLOSSARY[term] });
      seen.add(term);
    }
  });

  return found;
};

export default highlightVATerms;
