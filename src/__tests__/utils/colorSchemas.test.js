import { describe, it, expect } from 'vitest';
import { BASE_COLORS } from '../../utils/colorSchemas';

describe('BASE_COLORS', () => {
  it('has backdrop for all vision modes', () => {
    expect(BASE_COLORS.backdrop.light).toBeDefined();
    expect(BASE_COLORS.backdrop.dark).toBeDefined();
    expect(BASE_COLORS.backdrop.protanopia).toBeDefined();
    expect(BASE_COLORS.backdrop.deuteranopia).toBeDefined();
    expect(BASE_COLORS.backdrop.tritanopia).toBeDefined();
    expect(BASE_COLORS.backdrop.highContrast).toBeDefined();
  });

  it('has modal colors', () => {
    expect(BASE_COLORS.modal.light).toBeDefined();
    expect(BASE_COLORS.modal.dark).toBeDefined();
  });

  it('has section colors', () => {
    expect(BASE_COLORS.section.light).toBeDefined();
  });

  it('has card colors', () => {
    expect(BASE_COLORS.card.light).toBeDefined();
  });

  it('all color values are strings', () => {
    Object.values(BASE_COLORS.backdrop).forEach(v => {
      expect(typeof v).toBe('string');
    });
  });
});
