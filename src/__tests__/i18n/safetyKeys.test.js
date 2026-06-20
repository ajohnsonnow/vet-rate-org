import { describe, it, expect } from "vitest";
import {
  APP_TRANSLATIONS,
  SUPPORTED_LANGUAGES,
} from "../../contexts/LanguageContext";

/**
 * RT-3 (audit blind-spot #4): safety-critical strings must never blank out for a
 * non-English veteran. Translations are stored per-string as { en, es, tl, … }
 * leaves and t() resolves `leaf[lang] || leaf.en || key`, so the failure modes are:
 *   (a) the safety string is missing entirely → t() returns the bare key name; or
 *   (b) its English floor is empty → t() returns the key name.
 * The English fallback means a missing NON-English translation degrades to English
 * (acceptable, not blank) — so this test asserts the floor (en) exists + is non-empty
 * for every safety string, and that every shipped locale resolves to a non-blank value.
 *
 * Content-based (matches by the safety text itself) so it survives key renames.
 * The 18 U.S.C. 1001 / false-statement warning lives in component code
 * (FormsHelper / WitnessBench / nexus generator), not i18n — covered by AIS-02/03/RT2-5.
 */

const LOCALES = Object.keys(SUPPORTED_LANGUAGES);

function collectLeaves(translations) {
  const leaves = [];
  for (const [section, keys] of Object.entries(translations || {})) {
    if (!keys || typeof keys !== "object") continue;
    for (const [key, leaf] of Object.entries(keys)) {
      if (leaf && typeof leaf === "object" && typeof leaf.en === "string") {
        leaves.push({ path: `${section}.${key}`, leaf });
      }
    }
  }
  return leaves;
}

const LEAVES = collectLeaves(APP_TRANSLATIONS);

const SAFETY_MARKERS = [
  { name: "Veterans Crisis Line / 988", re: /\b988\b/ },
  { name: "Medical/legal disclaimer", re: /legal or medical advice/i },
  { name: "Non-affiliation with the VA", re: /not an official VA/i },
];

describe("i18n safety-critical strings (RT-3)", () => {
  it("ships more than one locale and includes the English floor", () => {
    expect(LOCALES.length).toBeGreaterThan(1);
    expect(LOCALES).toContain("en");
  });

  it("parsed a meaningful number of translation leaves", () => {
    expect(LEAVES.length).toBeGreaterThan(100);
  });

  for (const marker of SAFETY_MARKERS) {
    describe(marker.name, () => {
      const matches = LEAVES.filter((l) => marker.re.test(l.leaf.en));

      it("is present with a non-empty English floor", () => {
        expect(
          matches.length,
          `No translation leaf matches the safety string "${marker.name}". It may have been renamed or deleted.`,
        ).toBeGreaterThan(0);
        for (const m of matches) {
          expect(
            m.leaf.en.trim(),
            `${m.path} has a blank English value`,
          ).toBeTruthy();
        }
      });

      it("resolves to a non-blank string for every shipped locale (own value or English fallback)", () => {
        for (const m of matches) {
          for (const loc of LOCALES) {
            const resolved = (m.leaf[loc] || m.leaf.en || "").trim();
            expect(
              resolved,
              `Safety string ${m.path} resolves blank for locale "${loc}"`,
            ).toBeTruthy();
          }
        }
      });
    });
  }
});
