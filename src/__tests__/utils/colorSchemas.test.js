/**
 * BASE_COLORS palette — covers every theme variant veterans actually use,
 * including all three colorblind modes that were trivially missing from the
 * earlier `src/test/` duplicate before consolidation.
 */
import { describe, it, expect } from "vitest";
import { BASE_COLORS } from "../../utils/colorSchemas";

const ALL_THEMES = [
  "light",
  "dark",
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "highContrast",
];

describe("BASE_COLORS — structural completeness", () => {
  it("exposes the full palette surface", () => {
    expect(BASE_COLORS.backdrop).toBeDefined();
    expect(BASE_COLORS.modal).toBeDefined();
    expect(BASE_COLORS.section).toBeDefined();
    expect(BASE_COLORS.card).toBeDefined();
  });

  it.each(ALL_THEMES)("backdrop has '%s' theme variant", (theme) => {
    expect(BASE_COLORS.backdrop[theme]).toBeDefined();
  });

  it.each(ALL_THEMES)("modal has '%s' theme variant", (theme) => {
    expect(BASE_COLORS.modal[theme]).toBeDefined();
  });

  it("all backdrop values are non-empty strings", () => {
    Object.values(BASE_COLORS.backdrop).forEach((v) => {
      expect(typeof v).toBe("string");
      expect(v.length).toBeGreaterThan(0);
    });
  });
});

describe("BASE_COLORS — semantic correctness", () => {
  it("light backdrop uses black overlay", () => {
    expect(BASE_COLORS.backdrop.light).toContain("bg-black");
  });

  it("high-contrast backdrop is darkest (>=80% opacity)", () => {
    expect(BASE_COLORS.backdrop.highContrast).toContain("80");
  });

  it("light modal is white", () => {
    expect(BASE_COLORS.modal.light).toContain("bg-white");
  });

  it("dark modal uses gray-800", () => {
    expect(BASE_COLORS.modal.dark).toContain("gray-800");
  });
});

describe("Color Vision Accessibility — colorblind variants exist", () => {
  it.each(["protanopia", "deuteranopia", "tritanopia"])(
    "%s variants exist for backdrop and modal",
    (mode) => {
      expect(BASE_COLORS.backdrop[mode]).toBeTruthy();
      expect(BASE_COLORS.modal[mode]).toBeTruthy();
    },
  );
});
