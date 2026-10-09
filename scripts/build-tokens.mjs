#!/usr/bin/env node
/**
 * Build design tokens — Style Dictionary v4, via npx-on-demand.
 *
 * Reads tokens/source/*.json and emits:
 *   src/generated/design-tokens.css   — CSS custom properties (runtime theming)
 *   src/generated/design-tokens.js    — CJS module consumed by tailwind.config.js
 *   docs/DESIGN_TOKENS_REFERENCE.md   — generated reference table
 *
 * Style Dictionary is invoked through `npx --yes style-dictionary@<pinned>` so the
 * package is downloaded only when this script runs — a clean `npm ci` does not
 * pull it. See docs/DESIGN_TOKENS.md for the rationale (mirrors the
 * PREFLIGHT_EXTRAS.md pattern).
 *
 * Usage:
 *   node scripts/build-tokens.mjs           # build all platforms
 *   node scripts/build-tokens.mjs --verify  # build, then fail if generated files
 *                                           # differ from what's on disk (CI gate)
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const argv = process.argv.slice(2);
const VERIFY = argv.includes("--verify");

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";
const SD_VERSION = "^4.0.0";

const CONFIG = path.join(ROOT, "style-dictionary.config.mjs");
const OUT_DIR = path.join(ROOT, "src", "generated");
const TARGETS = [
  "src/generated/design-tokens.css",
  "src/generated/design-tokens.js",
  "docs/DESIGN_TOKENS_REFERENCE.md",
  "src/generated/palette-themes.css",
];

const PALETTES_SRC = path.join(ROOT, "tokens", "source", "palettes.json");
const PALETTE_CSS_OUT = path.join(ROOT, "src", "generated", "palette-themes.css");

// ── Brand channel ramp (docs/AFFILIATION_PALETTES.md §"Brand channel") ───────────
// The Tailwind blue/indigo/sky/cyan families are remapped in tailwind.config.js to
// `rgb(var(--brand-N) / <alpha-value>)`. Tailwind can only synthesize the `/<alpha>`
// opacity variants (e.g. bg-blue-600/10) when the var holds SPACE-SEPARATED RGB
// CHANNELS — not hex. So every value below is emitted as "R G B".
const BRAND_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// Tailwind v3 default blue scale → the :root baseline (default palette = unchanged).
const TAILWIND_BLUE = {
  50: [239, 246, 255],
  100: [219, 234, 254],
  200: [191, 219, 254],
  300: [147, 197, 253],
  400: [96, 165, 250],
  500: [59, 130, 246],
  600: [37, 99, 235],
  700: [29, 78, 216],
  800: [30, 64, 175],
  900: [30, 58, 138],
  950: [23, 37, 84],
};

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));

function hexToRgb(hex) {
  const m = /^#?([a-f0-9]{6})$/i.exec(String(hex));
  if (!m) throw new Error(`Invalid brand hex: ${hex}`);
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

// Linear interpolation between two RGB triples (t in 0..1).
function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

// WCAG relative luminance (linearized sRGB). Channels in 0..255.
function relLuminance([r, g, b]) {
  const toLin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrastVsWhite(rgb) {
  const l = relLuminance(rgb);
  const lWhite = relLuminance(WHITE);
  return (lWhite + 0.05) / (l + 0.05);
}

// sRGB (0..255) → HSL (h 0..360, s/l 0..1).
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

// HSL → sRGB (0..255).
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

// Target lightness per step — mirrors the Tailwind ramp shape so light shades
// (50-400) stay genuinely LIGHT (readable as text/accents on dark surfaces) and
// dark shades (600-950) stay DARK (readable as text / white-text fills on light).
const STEP_LIGHTNESS = {
  50: 0.97, 100: 0.93, 200: 0.85, 300: 0.74, 400: 0.64,
  500: 0.55, 600: 0.46, 700: 0.38, 800: 0.31, 900: 0.24, 950: 0.16,
};

/**
 * Derive an 11-step brand ramp from a base hex. Keep the base's hue + saturation,
 * set each step to its target lightness (Tailwind-shaped). This guarantees the
 * light end is light and the dark end is dark regardless of how dark/light the
 * base is — fixing dark-mode contrast for dark bases (navy/flag/pride) whose
 * mix-toward-white ramp left 300/400 too dark to read on dark backgrounds.
 * 600/700 are then darkened if needed so they clear 4.5:1 on white (fills/text).
 */
function deriveBrandRamp(baseHex) {
  const [h, sRaw] = rgbToHsl(hexToRgb(baseHex));
  // Keep saturation but floor it a touch so near-grey bases (pow-mia) still ramp.
  const s = Math.max(sRaw, 0.04);

  const ensure45 = (rgb) => {
    let out = rgb.slice();
    let guard = 0;
    // Target 4.6 (not 4.5) so channel rounding never lands a browser-computed
    // ratio just under 4.5 (e.g. coast-guard brand-600 measured 4.48 at 4.5).
    while (contrastVsWhite(out) < 4.6 && guard < 60) {
      out = mix(out, BLACK, 0.04);
      guard += 1;
    }
    return out;
  };

  const channels = {};
  for (const step of BRAND_STEPS) {
    let rgb = hslToRgb(h, s, STEP_LIGHTNESS[step]);
    if (step === 600 || step === 700) rgb = ensure45(rgb);
    channels[step] = rgb.map(clamp);
  }
  // Keep 700 at least as dark as 600 after the contrast guard.
  if (relLuminance(channels[700]) > relLuminance(channels[600])) {
    channels[700] = mix(channels[600], BLACK, 0.12).map(clamp);
  }
  return channels;
}

const channelStr = (rgb) => rgb.join(" ");

function brandBlockBody(channels) {
  return BRAND_STEPS.map((s) => `--brand-${s}: ${channelStr(channels[s])};`).join(" ");
}

if (!existsSync(CONFIG)) {
  console.error(`[fail] missing config: ${CONFIG}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

// Snapshot pre-build content for --verify mode (so we can compare).
const before = {};
if (VERIFY) {
  for (const t of TARGETS) {
    const p = path.join(ROOT, t);
    before[t] = existsSync(p) ? readFileSync(p, "utf8") : null;
  }
}

console.log(`[run] style-dictionary build (npx --yes style-dictionary@${SD_VERSION})`);
const r = spawnSync(
  NPX,
  ["--yes", `style-dictionary@${SD_VERSION}`, "build", "--config", "style-dictionary.config.mjs"],
  {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  }
);

if (r.status !== 0) {
  console.error(`[fail] style-dictionary exited ${r.status}`);
  process.exit(1);
}

console.log("[ok]  tokens built");

// Generate palette-themes.css from tokens/source/palettes.json.
// Style Dictionary handles the other generated files; this step owns palette-themes.css
// because the palette data shape doesn't map cleanly to Style Dictionary's CSS-var pipeline.
{
  if (!existsSync(PALETTES_SRC)) {
    console.error(`[fail] missing palettes source: ${PALETTES_SRC}`);
    process.exit(1);
  }
  const palettesData = JSON.parse(readFileSync(PALETTES_SRC, "utf8"));
  const palettes = palettesData.palettes || {};
  const lines = [
    "/* AUTOGENERATED by scripts/build-tokens.mjs — do not edit directly. */",
    "/* Source: tokens/source/palettes.json — run `npm run build:tokens` after editing. */",
    "/* Precedence (docs/AFFILIATION_PALETTES.md §2): ThemeContext omits the palette-* class while a */",
    "/* colorblind mode is active, so these rules never compete with the colorblind/AAA accent overrides. */",
    "",
    "/* Brand channel baseline — Tailwind v3 default blue scale as space-separated RGB channels. */",
    "/* tailwind.config.js remaps blue/indigo/sky/cyan to rgb(var(--brand-N) / <alpha-value>); the */",
    "/* default palette (no palette-* class) resolves to these, so it stays visually identical. */",
    `:root { ${brandBlockBody(
      Object.fromEntries(BRAND_STEPS.map((s) => [s, TAILWIND_BLUE[s]]))
    )} }`,
    "",
  ];
  for (const [id, modes] of Object.entries(palettes)) {
    const { light, dark } = modes;
    const lightBlue = light["va-blue"].value;
    const lightGold = light["va-gold"].value;
    const darkBlue  = dark["va-blue"].value;
    const darkGold  = dark["va-gold"].value;
    lines.push(
      `html.light.palette-${id} { --va-blue:${lightBlue}; --va-gold:${lightGold}; --focus-ring:${lightGold}; }`,
      `html.dark.palette-${id}  { --va-blue:${darkBlue}; --va-gold:${darkGold}; --focus-ring:${darkGold}; }`,
    );
    if (modes.brand?.value) {
      lines.push(
        `html.palette-${id} { ${brandBlockBody(deriveBrandRamp(modes.brand.value))} }`,
      );
    }
    lines.push("");
  }
  writeFileSync(PALETTE_CSS_OUT, lines.join("\n"), "utf8");
  console.log("[ok]  palette-themes.css written");
}

if (VERIFY) {
  let drift = false;
  for (const t of TARGETS) {
    const p = path.join(ROOT, t);
    const now = existsSync(p) ? readFileSync(p, "utf8") : null;
    if (now !== before[t]) {
      console.error(`[drift] ${t} would change — re-run \`npm run build:tokens\` and commit.`);
      drift = true;
    }
  }
  if (drift) process.exit(2);
  console.log("[ok]  no drift — generated tokens match source.");
}
