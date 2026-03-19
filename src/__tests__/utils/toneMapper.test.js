import { describe, it, expect } from 'vitest';
import { applyCompassionateTone } from '../../utils/toneMapper';

describe('applyCompassionateTone', () => {
  it('returns empty string for null input', () => {
    expect(applyCompassionateTone(null)).toBe('');
    expect(applyCompassionateTone('')).toBe('');
  });

  it('returns a string', () => {
    const result = applyCompassionateTone('Your claim was denied.');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('accepts sourceModel parameter', () => {
    const result = applyCompassionateTone('Test text', 'AUDITOR');
    expect(typeof result).toBe('string');
  });

  it('accepts language parameter', () => {
    const result = applyCompassionateTone('Test text', 'GENERAL', 'es');
    expect(typeof result).toBe('string');
  });

  it('accepts branch parameter for honorific', () => {
    const result = applyCompassionateTone('Test text', 'GENERAL', 'en', 'Army');
    expect(typeof result).toBe('string');
  });
});
