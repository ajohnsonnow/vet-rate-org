/**
 * Palette Contrast Test — Sprint 5 gate
 *
 * Enforces WCAG AA contrast thresholds for affiliation palette accents:
 * - va-blue (anchor): ≥ 4.5:1 vs surface
 * - va-gold (accent): ≥ 3.0:1 vs surface
 *
 * Surfaces: light palette on #ffffff, dark palette on #1a2620.
 * Also asserts that palette classes are suppressed when colorblind modes are active.
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { createElement as h, useEffect } from "react";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import palettesData from "../../../tokens/source/palettes.json";
import { ThemeProvider, useTheme } from "../../contexts/ThemeContext.jsx";

// ThemeProvider reads window.matchMedia (system color-scheme / reduced-motion) on mount;
// jsdom doesn't implement it. Provide a minimal stub so the provider can render.
beforeAll(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    });
  }
});

const { palettes } = palettesData;

/**
 * Convert hex color to sRGB [r, g, b] in [0, 1].
 */
function hexToRgb(hex) {
  const match = hex.match(/^#?([a-f0-9]{6})$/i);
  if (!match) throw new Error(`Invalid hex color: ${hex}`);
  const num = Number.parseInt(match[1], 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff].map(
    (x) => x / 255,
  );
}

/**
 * Compute relative luminance per sRGB→linear→L formula.
 * https://webaim.org/articles/contrast/
 */
function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  const toLinear = (c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const rL = toLinear(r);
  const gL = toLinear(g);
  const bL = toLinear(b);
  return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL;
}

/**
 * Compute WCAG contrast ratio between two colors.
 * ratio = (Lhi + 0.05) / (Llo + 0.05), where Lhi > Llo.
 */
function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lMax = Math.max(l1, l2);
  const lMin = Math.min(l1, l2);
  return (lMax + 0.05) / (lMin + 0.05);
}

describe("Affiliation Palette Contrast — WCAG AA verification", () => {
  describe("Contrast matrix: all 16 palettes", () => {
    const cases = Object.entries(palettes).flatMap(([id, palette]) => {
      const lightBlue = palette.light["va-blue"].value;
      const lightGold = palette.light["va-gold"].value;
      const darkBlue = palette.dark["va-blue"].value;
      const darkGold = palette.dark["va-gold"].value;

      // Real-world usage (verified against rendered DOM via tests/e2e axe):
      //  - .bg-va-blue is a FILL with WHITE text → va-blue must clear 4.5:1 vs white
      //    (also covers .text-va-blue on a white card). Same value both modes.
      //  - .bg-va-gold is a FILL with DARK text (#111827) → va-gold must clear 4.5:1
      //    vs that dark text (also covers .text-va-gold on a dark surface).
      // The app's lightest "dark text" placed on .bg-va-gold (--text-primary, the
      // hardest case). Brighter than gray-900, so it's the binding constraint.
      const DARK_TEXT = "#1a1f16";
      return [
        {
          id,
          mode: "light",
          role: "va-blue",
          color: lightBlue,
          surface: "#ffffff",
          threshold: 4.5,
        },
        {
          id,
          mode: "light",
          role: "va-gold",
          color: lightGold,
          surface: DARK_TEXT,
          threshold: 4.5,
        },
        {
          id,
          mode: "dark",
          role: "va-blue",
          color: darkBlue,
          surface: "#ffffff",
          threshold: 4.5,
        },
        {
          id,
          mode: "dark",
          role: "va-gold",
          color: darkGold,
          surface: DARK_TEXT,
          threshold: 4.5,
        },
      ];
    });

    it.each(cases)(
      "$id $mode $role ≥ $threshold:1",
      ({ id, mode, role, color, surface, threshold }) => {
        const ratio = contrastRatio(color, surface);
        expect(ratio).toBeGreaterThanOrEqual(
          threshold,
          `${id} ${mode} ${role}: ${color} on ${surface} = ${ratio.toFixed(2)}:1 (need ≥${threshold}:1)`,
        );
      },
    );
  });

  describe("Brand channel ramp: --brand-600 / --brand-700 ≥ 4.5:1 vs white", () => {
    // The generated palette-themes.css remaps Tailwind blue/indigo/sky/cyan to
    // rgb(var(--brand-N) / <alpha>). brand-600 and brand-700 are the text/fill weights,
    // so they must clear 4.5:1 on white for every palette. The build script
    // (scripts/build-tokens.mjs) auto-darkens them until they pass; this is the gate.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const generatedCss = readFileSync(
      path.resolve(here, "../../generated/palette-themes.css"),
      "utf8",
    );

    // Relative luminance from space-separated RGB channels (0–255).
    function luminanceFromChannels([r, g, b]) {
      const toLinear = (c) => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    }
    function channelContrastVsWhite(channels) {
      const lWhite = luminanceFromChannels([255, 255, 255]);
      const l = luminanceFromChannels(channels);
      return (lWhite + 0.05) / (l + 0.05);
    }

    // Parse `html.palette-<id> { --brand-50: R G B; ... }` blocks from the generated CSS.
    function parseBrandBlocks(css) {
      const blocks = {};
      const blockRe = /html\.palette-([a-z-]+)\s*\{\s*(--brand-[^}]+)\}/g;
      let m;
      while ((m = blockRe.exec(css)) !== null) {
        const id = m[1];
        const vars = {};
        for (const decl of m[2].split(";")) {
          const trimmed = decl.trim();
          if (!trimmed) continue;
          const [name, value] = trimmed.split(":");
          vars[name.trim()] = value.trim().split(/\s+/).map(Number);
        }
        blocks[id] = vars;
      }
      return blocks;
    }

    const brandBlocks = parseBrandBlocks(generatedCss);

    it("emits a brand ramp for every palette in the source", () => {
      const ids = Object.keys(palettes);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(
          brandBlocks[id],
          `missing html.palette-${id} brand block in palette-themes.css`,
        ).toBeDefined();
      }
    });

    const brandCases = Object.keys(palettes).flatMap((id) => [
      { id, step: 600 },
      { id, step: 700 },
    ]);

    it.each(brandCases)(
      "$id --brand-$step ≥ 4.5:1 on white",
      ({ id, step }) => {
        const channels = brandBlocks[id]?.[`--brand-${step}`];
        expect(
          channels,
          `--brand-${step} not found for palette ${id}`,
        ).toBeDefined();
        const ratio = channelContrastVsWhite(channels);
        expect(ratio).toBeGreaterThanOrEqual(
          4.5,
          `${id} --brand-${step}: rgb(${channels.join(" ")}) on white = ${ratio.toFixed(2)}:1 (need ≥4.5:1)`,
        );
      },
    );
  });

  describe("Precedence: real ThemeProvider suppresses palette under colorblind", () => {
    // Drives the ACTUAL ThemeContext effect (not a re-implementation) and asserts the
    // class it applies to <html>. The rule (ThemeContext.jsx): palette-<id> is added only
    // when palette !== "default" AND no colorblind mode is active — so colorblind/AAA
    // accent overrides are never weakened by branding. See docs/AFFILIATION_PALETTES.md §2.

    // Drives useTheme() to the requested state via effects, then renders nothing.
    function Controller({ palette, colorBlindMode }) {
      const { setPalette, setColorBlindMode } = useTheme();
      useEffect(() => {
        setColorBlindMode(colorBlindMode);
        setPalette(palette);
      }, [setPalette, setColorBlindMode, palette, colorBlindMode]);
      return null;
    }

    const drive = (palette, colorBlindMode) =>
      render(
        h(ThemeProvider, null, h(Controller, { palette, colorBlindMode })),
      );

    afterEach(() => {
      cleanup();
      document.documentElement.className = "";
      localStorage.clear();
    });

    it("applies palette-army with no colorblind mode", () => {
      drive("army", "none");
      expect(document.documentElement.classList.contains("palette-army")).toBe(
        true,
      );
    });

    it("suppresses palette-army when deuteranopia is active (colorblind class wins)", () => {
      drive("army", "deuteranopia");
      const cl = document.documentElement.classList;
      expect(cl.contains("palette-army")).toBe(false);
      expect(cl.contains("cb-deuteranopia")).toBe(true);
    });

    it("suppresses any palette under high-contrast colorblind mode", () => {
      drive("navy", "high-contrast");
      expect(document.documentElement.classList.contains("palette-navy")).toBe(
        false,
      );
    });

    it("never applies a class for the default palette (no-op)", () => {
      drive("default", "none");
      const classes = [...document.documentElement.classList];
      expect(classes.some((c) => c.startsWith("palette-"))).toBe(false);
    });
  });
});
