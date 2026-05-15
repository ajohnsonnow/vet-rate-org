import { describe, it, expect } from "vitest";
import { BASE_COLORS } from "../../utils/colorSchemas";

describe("BASE_COLORS", () => {
  it("has backdrop colors", () => {
    expect(BASE_COLORS.backdrop).toBeDefined();
  });

  it("has modal colors", () => {
    expect(BASE_COLORS.modal).toBeDefined();
  });

  it("backdrop has all theme variants", () => {
    const themes = [
      "light",
      "dark",
      "protanopia",
      "deuteranopia",
      "tritanopia",
      "highContrast",
    ];
    themes.forEach((theme) => {
      expect(BASE_COLORS.backdrop[theme]).toBeDefined();
    });
  });

  it("modal has all theme variants", () => {
    const themes = [
      "light",
      "dark",
      "protanopia",
      "deuteranopia",
      "tritanopia",
      "highContrast",
    ];
    themes.forEach((theme) => {
      expect(BASE_COLORS.modal[theme]).toBeDefined();
    });
  });

  it("light backdrop uses black overlay", () => {
    expect(BASE_COLORS.backdrop.light).toContain("bg-black");
  });

  it("high contrast backdrop is darkest", () => {
    // highContrast should have higher opacity
    expect(BASE_COLORS.backdrop.highContrast).toContain("80");
  });

  it("light modal is white", () => {
    expect(BASE_COLORS.modal.light).toContain("bg-white");
  });

  it("dark modal uses gray-800", () => {
    expect(BASE_COLORS.modal.dark).toContain("gray-800");
  });
});

describe("Color Vision Accessibility", () => {
  it("protanopia variants exist for all base colors", () => {
    expect(BASE_COLORS.backdrop.protanopia).toBeTruthy();
    expect(BASE_COLORS.modal.protanopia).toBeTruthy();
  });

  it("deuteranopia variants exist", () => {
    expect(BASE_COLORS.backdrop.deuteranopia).toBeTruthy();
    expect(BASE_COLORS.modal.deuteranopia).toBeTruthy();
  });

  it("tritanopia variants exist", () => {
    expect(BASE_COLORS.backdrop.tritanopia).toBeTruthy();
    expect(BASE_COLORS.modal.tritanopia).toBeTruthy();
  });
});
