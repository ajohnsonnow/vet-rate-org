import { describe, it, expect } from 'vitest';
import { normalizeSearchTerm } from '../../utils/searchUtils';

describe('normalizeSearchTerm', () => {
  it('lowercases input', () => {
    expect(normalizeSearchTerm('PTSD')).toBe('ptsd');
  });

  it('trims whitespace', () => {
    expect(normalizeSearchTerm('  ptsd  ')).toBe('ptsd');
  });

  it('replaces hyphens with spaces', () => {
    expect(normalizeSearchTerm('post-traumatic')).toBe('post traumatic');
  });

  it('replaces commas with spaces', () => {
    expect(normalizeSearchTerm('Ankle, ankylosis')).toBe('ankle ankylosis');
  });

  it('replaces slashes with spaces', () => {
    expect(normalizeSearchTerm('knee/leg')).toBe('knee leg');
  });

  it('normalizes multiple spaces', () => {
    expect(normalizeSearchTerm('a   b   c')).toBe('a b c');
  });

  it('handles parentheses', () => {
    expect(normalizeSearchTerm('tinnitus (bilateral)')).toBe('tinnitus bilateral');
  });

  it('handles empty string', () => {
    expect(normalizeSearchTerm('')).toBe('');
  });
});
