import { describe, it, expect } from "vitest";
import { APP_TRANSLATIONS } from "../../contexts/LanguageContext";

/**
 * Duty stations + world map spec §5 / acceptance criterion 12: all 16 new
 * myPacketSection keys must resolve in all 5 shipped locales. Note this is
 * NOT Object.keys(SUPPORTED_LANGUAGES) — that map lists dozens of locales
 * (ch, sm, haw, ...) that intentionally fall back to English for every
 * string; the 5 locales actually carrying real translation leaves
 * throughout myPacketSection are exactly en/es/tl/vi/ko, per spec §5.
 */
const LOCALES = ["en", "es", "tl", "vi", "ko"];

const DUTY_STATION_KEYS = [
  "dutyStations",
  "dutyStationsDescription",
  "addDutyStation",
  "noDutyStationsYet",
  "stationName",
  "stationNamePlaceholder",
  "linkedPeriod",
  "unassignedPeriod",
  "latitude",
  "longitude",
  "pickOnMap",
  "pickCountryHint",
  "atSea",
  "mapAriaLabel",
  "equalAreaNote",
  "removeDutyStation",
];

describe("Duty stations i18n keys", () => {
  it("ships exactly the 16 keys specified", () => {
    expect(DUTY_STATION_KEYS).toHaveLength(16);
  });

  for (const key of DUTY_STATION_KEYS) {
    describe(`myPacketSection.${key}`, () => {
      const leaf = APP_TRANSLATIONS.myPacketSection?.[key];

      it("exists with a non-empty English floor", () => {
        expect(leaf, `myPacketSection.${key} is missing`).toBeTruthy();
        expect(leaf.en?.trim()).toBeTruthy();
      });

      it("has an explicit (non-fallback) value for all 5 locales", () => {
        for (const loc of LOCALES) {
          expect(
            leaf[loc],
            `myPacketSection.${key}.${loc} is missing`,
          ).toBeTruthy();
        }
      });

      it("resolves to a non-blank string for every locale", () => {
        for (const loc of LOCALES) {
          expect(
            (leaf[loc] || leaf.en || "").trim(),
            `myPacketSection.${key} resolves blank for "${loc}"`,
          ).toBeTruthy();
        }
      });
    });
  }
});
