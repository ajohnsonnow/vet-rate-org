/**
 * Copy shown to users gives no time for an on-device model to download, load
 * or answer unless the figure was measured (ADR-010 section 2 measured only
 * the time per golden-set answer on one desktop GPU, which fits none of the
 * places below).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { APP_TRANSLATIONS } from "../../i18n/translations";

const source = (path) => readFileSync(path, "utf8");
const LANGUAGES = ["en", "es", "tl", "vi", "ko"];
const DURATIONS = [
  /\d\s?(?:min|minutes?|sec|seconds?)\b/i,
  /\d\s?(?:phút|분|minutos?|segundos?)/i,
  /segundos|segundo lang|vài giây|몇 초/i,
];
const namesADuration = (text) => DURATIONS.some((p) => p.test(text));

describe("the Pathfinder tip", () => {
  it("promises no speed in English", () => {
    expect(APP_TRANSLATIONS.pathfinder.aiTipText.en).toBe(
      "Every AI model can analyze your ratings. How long a strategy takes depends on your device.",
    );
  });

  it.each(LANGUAGES)("%s: says nothing takes seconds", (language) => {
    expect(
      namesADuration(APP_TRANSLATIONS.pathfinder.aiTipText[language]),
    ).toBe(false);
  });
});

describe("the C-File large-file notice", () => {
  it("points to the live estimate and gives no fixed time per section", () => {
    expect(APP_TRANSLATIONS.cfileAnalyzer.largeFileDetected.en).toBe(
      "Large file detected! Processing in {total} chunks, one at a time - see the time estimate above. Please keep this tab open.",
    );
  });

  it.each(LANGUAGES)("%s: gives no fixed time per section", (language) => {
    const text = APP_TRANSLATIONS.cfileAnalyzer.largeFileDetected[language];
    expect(namesADuration(text)).toBe(false);
    expect(text).toContain("{total}");
  });
});

describe("screens with their own copy", () => {
  it("the manual gives no download time and does not call loading instant", () => {
    const manual = source("src/components/UserManual.jsx");
    expect(manual).not.toContain("(~2 min)");
    expect(manual).not.toContain("instant loading");
    expect(manual).toContain(
      '4. Click "Initialize" - the model downloads once; how long depends on its size and your connection',
    );
    expect(manual).toContain(
      "5. You're ready! The model stays on your device, so it is not downloaded again",
    );
  });

  it("the Blue Button analysis gives no time", () => {
    const screen = source("src/components/BlueButtonXRay.jsx");
    expect(screen).not.toContain("30-60 seconds");
    expect(screen).toContain(
      '"AI analyzing diagnoses (this can take a while)..."',
    );
  });
});
