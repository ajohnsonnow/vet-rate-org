/**
 * The writing tools' notes about official PDFs, drafts that differ from the
 * answers, small on-device models and closing with an unsaved edit are in
 * the translations in the five languages the file carries, not English-only
 * in the components. The Spanish, Tagalog, Vietnamese and Korean were written by
 * machine and are listed here by key for a native reader to review.
 */
import { describe, it, expect } from "vitest";
import { APP_TRANSLATIONS } from "../../contexts/LanguageContext";

export const MACHINE_WRITTEN_KEYS = [
  "formsHelper.officialPdfRest",
  "formsHelper.officialPdfNotePersonal",
  "formsHelper.officialPdfNotePtsd",
  "formsHelper.officialPdfNoteBuddy",
  "formsHelper.officialPdfNoteVso",
  "formsHelper.officialPdfNoteIntentToFile",
  "formsHelper.officialPdfNoteMedicalRelease",
  "formsHelper.officialPdfNotePriority",
  "formsHelper.officialPdfNoteIndividualRep",
  "formsHelper.officialPdfNoteOther",
  "formsHelper.officialPdfEdits",
  "formsHelper.textOnlyNote",
  "formsHelper.officialPdfOverflow",
  "formsHelper.officialPdfFailed",
  "formsHelper.officialPdfMoved",
  "formsHelper.officialPdfTextOnly",
  "formsHelper.officialPdfLeftBlank",
  "formsHelper.officialPdfNotPlaced",
  "formsHelper.draftOutOfStep",
  "nexusBuilder.statementOutOfStep",
  "witnessBench.smallModelQuestionsNote",
  "witnessBench.builtInQuestionsTitle",
  "witnessBench.builtInQuestionsDesc",
  "myPacketSection.ratingPercent",
  "common.unsavedEditTitle",
  "common.unsavedEditStay",
  "common.unsavedEditClose",
  "common.unsavedEditBody",
];

// The five languages the translations file carries for every string. The
// app's other languages fall back to English, here as everywhere.
const LOCALES = ["en", "es", "tl", "vi", "ko"];

describe.each(MACHINE_WRITTEN_KEYS)("%s", (path) => {
  const [section, key] = path.split(".");
  const leaf = APP_TRANSLATIONS[section]?.[key];

  it("has words in each of the five languages", () => {
    for (const locale of LOCALES) {
      expect([locale, typeof leaf?.[locale]]).toEqual([locale, "string"]);
      expect(leaf[locale].trim().length).toBeGreaterThan(1);
    }
  });

  it("is not English left in place of a translation", () => {
    for (const locale of LOCALES.filter((code) => code !== "en")) {
      expect([locale, leaf[locale] === leaf.en]).toEqual([locale, false]);
    }
  });

  it("keeps file types and form places as the form prints them", () => {
    for (const marker of [".TXT", ".DOCX", ".PDF", "Remarks", "VA.gov"]) {
      if (!leaf.en.includes(marker)) continue;
      for (const locale of LOCALES) {
        expect([locale, marker, leaf[locale].includes(marker)]).toEqual([
          locale,
          marker,
          true,
        ]);
      }
    }
  });
});
