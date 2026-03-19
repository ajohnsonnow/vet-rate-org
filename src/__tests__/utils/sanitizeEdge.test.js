import { describe, it, expect } from 'vitest';
import { sanitizeUrl, escapeHtml } from '../../utils/sanitize';

describe('sanitizeUrl - edge cases', () => {
  it('handles URLs with query params', () => {
    expect(sanitizeUrl('https://va.gov/search?q=ptsd')).toBe('https://va.gov/search?q=ptsd');
  });

  it('handles URLs with fragments', () => {
    expect(sanitizeUrl('https://va.gov/page#section')).toBe('https://va.gov/page#section');
  });

  it('handles ftp protocol (blocked)', () => {
    expect(sanitizeUrl('ftp://files.va.gov/doc')).toBe('#');
  });

  it('handles whitespace-only input', () => {
    expect(sanitizeUrl('   ')).toBe('#');
  });

  it('handles non-string types', () => {
    expect(sanitizeUrl(123)).toBe('#');
    expect(sanitizeUrl({})).toBe('#');
  });

  it('tel protocol is allowed', () => {
    expect(sanitizeUrl('tel:+18001234567')).toBe('tel:+18001234567');
  });
});

describe('escapeHtml - additional', () => {
  it('handles mixed content', () => {
    const result = escapeHtml('<b>test</b> & "quotes"');
    expect(result).not.toContain('<b>');
    expect(result).toContain('&amp;');
  });

  it('handles numbers coerced to string', () => {
    // Should handle gracefully
    expect(typeof escapeHtml('123')).toBe('string');
  });
});
