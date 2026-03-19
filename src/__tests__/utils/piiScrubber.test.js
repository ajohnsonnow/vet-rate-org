import { describe, it, expect } from 'vitest';
import { scrubPII } from '../../utils/piiScrubber';

describe('scrubPII', () => {
  it('returns unchanged text when no PII found', () => {
    const result = scrubPII('This is a normal sentence.');
    expect(result.scrubbedText).toBe('This is a normal sentence.');
    expect(result.piiFound).toBe(false);
  });

  it('returns input for null/undefined', () => {
    const result = scrubPII(null);
    expect(result.piiFound).toBe(false);
  });

  it('scrubs SSN in XXX-XX-XXXX format', () => {
    const result = scrubPII('My SSN is 123-45-6789');
    expect(result.scrubbedText).not.toContain('123-45-6789');
    expect(result.piiFound).toBe(true);
  });

  it('scrubs email addresses', () => {
    const result = scrubPII('Contact me at veteran@gmail.com');
    expect(result.scrubbedText).not.toContain('veteran@gmail.com');
    expect(result.piiFound).toBe(true);
  });

  it('scrubs credit card numbers', () => {
    const result = scrubPII('Card: 4111-1111-1111-1111');
    expect(result.scrubbedText).not.toContain('4111-1111-1111-1111');
    expect(result.piiFound).toBe(true);
  });

  it('scrubs phone numbers', () => {
    const result = scrubPII('Call me at (555) 123-4567');
    expect(result.scrubbedText).not.toContain('555');
    expect(result.piiFound).toBe(true);
  });

  it('returns details about what was scrubbed', () => {
    const result = scrubPII('Email: test@example.com SSN: 123-45-6789');
    expect(result.details.length).toBeGreaterThan(0);
  });

  it('handles aggressive mode for DOB', () => {
    const result = scrubPII('Born on 01/15/1990', { aggressive: true });
    expect(result.scrubbedText).not.toContain('01/15/1990');
  });
});
