import { describe, it, expect } from 'vitest';
import { scrubPII } from '../utils/piiScrubber';

describe('scrubPII', () => {
  it('returns unchanged for null input', () => {
    const result = scrubPII(null);
    expect(result.piiFound).toBe(false);
    expect(result.scrubbedText).toBeNull();
  });

  it('returns unchanged for empty string', () => {
    const result = scrubPII('');
    expect(result.piiFound).toBe(false);
  });

  it('detects SSN in XXX-XX-XXXX format', () => {
    const result = scrubPII('My SSN is 123-45-6789');
    expect(result.piiFound).toBe(true);
    expect(result.scrubbedText).not.toContain('123-45-6789');
  });

  it('detects email addresses', () => {
    const result = scrubPII('Contact me at john@example.com for details');
    expect(result.piiFound).toBe(true);
    expect(result.scrubbedText).not.toContain('john@example.com');
  });

  it('detects phone numbers', () => {
    const result = scrubPII('Call me at 555-123-4567');
    expect(result.piiFound).toBe(true);
    expect(result.scrubbedText).not.toContain('555-123-4567');
  });

  it('detects credit card numbers', () => {
    const result = scrubPII('Card: 4111-1111-1111-1111');
    expect(result.piiFound).toBe(true);
    expect(result.scrubbedText).not.toContain('4111-1111-1111-1111');
  });

  it('leaves clean text unchanged', () => {
    const text = 'I have PTSD rated at 70 percent';
    const result = scrubPII(text);
    expect(result.scrubbedText).toBe(text);
    expect(result.piiFound).toBe(false);
  });

  it('returns details array', () => {
    const result = scrubPII('SSN: 123-45-6789, email: a@b.com');
    expect(result.details).toBeDefined();
    expect(Array.isArray(result.details)).toBe(true);
  });

  it('handles non-string input', () => {
    const result = scrubPII(123 as any);
    expect(result.piiFound).toBe(false);
  });
});
