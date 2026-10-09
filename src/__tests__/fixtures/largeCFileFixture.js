/**
 * D19-7: a generic, PII-free synthetic C-File large enough (by default,
 * 2,000 "pages") to reproduce the main-thread cost segmentCFile,
 * findDocumentBoundaries and the vaCodeSheet.js parsers showed on a very
 * large claims file - calibrated against this exact generator: 2,000 pages/100-page code-sheet cadence/40 conditions per sheet
 * produces ~7.3M characters and ~400-500ms of combined synchronous work on
 * the pre-chunking code path. Shared by the chunked-vs-sync equivalence
 * tests for cFileSegmentation.js and vaCodeSheet.js so both exercise the
 * exact same fixture.
 */

const RATING_STEPS =
  "10% from 07/14/2006 20% from 07/14/2011 30% from 07/13/2016";

function makeCodeSheetPage(pageNumber, conditionCount) {
  const lines = [
    `--- PAGE ${pageNumber + 90000} ---`,
    "RATING CODE SHEET",
    "Rating Decision Department of Veterans Affairs Veterans Benefits " +
      "Administration Page 23 of 41 08/14/2020 NAME OF VETERAN JANE Q SAMPLE " +
      "SOCIAL SECURITY NR 000-00-0000 POA SOME ORG COPY TO COPY MADE BY VBA " +
      "FROM A RECORD IN VA'S POSSESSION",
    "ACTIVE DUTY EOD RAD BRANCH CHARACTER OF DISCHARGE 11/07/1998 " +
      "10/27/1999 Army Honorable",
    "JURISDICTION: New Claim Received 03/03/2020 SUBJECT TO COMPENSATION (1.SC)",
  ];
  for (let i = 0; i < conditionCount; i++) {
    lines.push(
      `${1000 + i} CONDITION NAME NUMBER ${i} [TAG] Service Connected, Peacetime, Incurred ${RATING_STEPS}`,
    );
  }
  lines.push(
    "COMBINED EVALUATION FOR COMPENSATION : 10% from 12/15/2003 20% from 12/23/2004",
    "NOT SERVICE CONNECTED/NOT SUBJECT TO COMPENSATION (8.NSC Gulf War)",
    "7346 HIATAL HERNIA Not Service Connected, Peacetime, No Diagnosis " +
      "Original Date of Denial: 10/19/2004",
    "______ eSign: certified by",
  );
  return lines.join("\n") + "\n";
}

function filler(label) {
  return (
    `${label} continuation text detailing clinical findings and narrative history. `.repeat(
      40,
    ) +
    "Additional narrative body so the segment clears the minimum length filter."
  );
}

function buildOrdinaryPage(kind, pageNumber) {
  if (kind === "dd214") {
    return (
      "DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY\n" +
      "CHARACTER OF SERVICE: HONORABLE\n" +
      filler(`Service record ${pageNumber}`) +
      "\n"
    );
  }
  if (kind === "letter") {
    return (
      "DEPARTMENT OF VETERANS AFFAIRS\nDear Mr. SAMPLE:\n" +
      "YOUR CLAIM NUMBER is 000-00-0000.\n" +
      filler(`Letter body ${pageNumber}`) +
      "\n"
    );
  }
  return (
    "SERVICE TREATMENT RECORD\nCHRONOLOGICAL RECORD OF MEDICAL CARE\n" +
    filler(`Treatment ${pageNumber}`) +
    "\n"
  );
}

/**
 * @param {Object} [opts]
 * @param {number} [opts.pages] - total synthetic "pages"
 * @param {number} [opts.codeSheetEvery] - a code-sheet page every N pages
 * @param {number} [opts.conditionsPerSheet] - rated conditions per code sheet
 * @returns {string}
 */
export function buildLargeCFileFixture({
  pages = 2000,
  codeSheetEvery = 100,
  conditionsPerSheet = 40,
} = {}) {
  const kinds = ["dd214", "letter", "str"];
  let text = "";
  for (let i = 0; i < pages; i++) {
    if (codeSheetEvery && i > 0 && i % codeSheetEvery === 0) {
      text += makeCodeSheetPage(i, conditionsPerSheet);
    }
    text += buildOrdinaryPage(kinds[i % kinds.length], i);
  }
  return text;
}
