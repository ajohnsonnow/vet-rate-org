import { describe, it, expect } from 'vitest';
import { sanitizeUrl, sanitizeErrorMessage, escapeHtml } from '../../utils/sanitize';

describe('sanitizeUrl', () => {
  it('returns # for null/undefined', () => {
    expect(sanitizeUrl(null)).toBe('#');
    expect(sanitizeUrl(undefined)).toBe('#');
    expect(sanitizeUrl('')).toBe('#');
  });

  it('allows https URLs', () => {
    expect(sanitizeUrl('https://va.gov/claims')).toBe('https://va.gov/claims');
  });

  it('allows http URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('allows mailto URLs', () => {
    expect(sanitizeUrl('mailto:test@va.gov')).toBe('mailto:test@va.gov');
  });

  it('blocks javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
  });

  it('blocks data: URLs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
  });

  it('allows relative paths starting with /', () => {
    expect(sanitizeUrl('/about')).toBe('/about');
  });

  it('blocks protocol-relative URLs (//)', () => {
    expect(sanitizeUrl('//evil.com')).toBe('#');
  });

  it('requireGov option blocks non-gov domains', () => {
    expect(sanitizeUrl('https://google.com', { requireGov: true })).toBe('#');
    expect(sanitizeUrl('https://www.va.gov/claims', { requireGov: true })).toBe('https://www.va.gov/claims');
  });
});

describe('sanitizeErrorMessage', () => {
  it('returns safe string for non-string input', () => {
    const result = sanitizeErrorMessage(null);
    expect(typeof result).toBe('string');
  });

  it('strips HTML tags from error messages', () => {
    const result = sanitizeErrorMessage('<script>alert(1)</script>Error');
    expect(result).not.toContain('<script>');
  });
});

describe('escapeHtml', () => {
  it('escapes angle brackets', () => {
    const result = escapeHtml('<div>test</div>');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toContain('&amp;');
  });

  it('escapes quotes', () => {
    const result = escapeHtml('"test"');
    expect(result).toContain('&quot;');
  });

  it('returns empty string for falsy input', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
  });
});
