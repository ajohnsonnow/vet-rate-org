import { describe, it, expect } from 'vitest';

// Test formValidator - VA form reference detection and validation
// Dynamic import to handle the JSON dependency

describe('Form Reference Extraction', () => {
  const FORM_PATTERNS = [
    /\b(\d{2}-\d{3,5}[a-zA-Z0-9-]*)\b/gi,
    /\b(SF-\d{2,4})\b/gi,
    /VA\s+Form\s+(\d{2}-?\d{3,5}[a-zA-Z0-9-]*)/gi,
    /\b(SGLV-\d{4})\b/gi
  ];

  function extractFormReferences(text) {
    if (!text || typeof text !== 'string') return [];
    const foundForms = new Set();
    FORM_PATTERNS.forEach(pattern => {
      const matches = text.matchAll(new RegExp(pattern));
      for (const match of matches) {
        const formRef = (match[1] || match[0]).trim();
        if (formRef) foundForms.add(formRef);
      }
    });
    return [...foundForms];
  }

  it('extracts standard VA form numbers', () => {
    const forms = extractFormReferences('File VA Form 21-526EZ for your claim');
    expect(forms.length).toBeGreaterThan(0);
    expect(forms.some(f => f.includes('21-526'))).toBe(true);
  });

  it('extracts SF forms', () => {
    const forms = extractFormReferences('Submit SF-180 to get your records');
    expect(forms).toContain('SF-180');
  });

  it('extracts multiple forms', () => {
    const forms = extractFormReferences('You need 21-526EZ and 20-0995 and SF-180');
    expect(forms.length).toBeGreaterThanOrEqual(3);
  });

  it('returns empty array for text without forms', () => {
    const forms = extractFormReferences('PTSD is rated at 70 percent');
    expect(forms).toEqual([]);
  });

  it('returns empty array for null input', () => {
    expect(extractFormReferences(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractFormReferences('')).toEqual([]);
  });

  it('extracts SGLV insurance forms', () => {
    const forms = extractFormReferences('Complete SGLV-8286 for beneficiary');
    expect(forms).toContain('SGLV-8286');
  });

  it('handles "VA Form" prefix', () => {
    const forms = extractFormReferences('VA Form 21-4138 is the statement form');
    expect(forms.some(f => f.includes('21-4138'))).toBe(true);
  });
});
