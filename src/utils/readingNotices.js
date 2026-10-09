/**
 * Plain-language notes about how completely a document was read and whether
 * its AI analysis finished. They live on the extraction result while an
 * import runs and are copied into the stored document's extractedData
 * (aiAnalysisNotice already is; pageCoverageNote is added at persist time) so
 * My Packet can show the same sentences later.
 */

const clean = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const count = (list) => (Array.isArray(list) ? list.length : 0);

// A fully text-layer document reads cleanly and needs no note; anything
// else (OCR, blank pages, pages not read) is worth saying out loud.
export function isNotableCoverage(result) {
  return (
    count(result?.pagesSkipped) > 0 ||
    count(result?.pagesFailed) > 0 ||
    count(result?.pagesBlank) > 0 ||
    (result?.pagesOCRd ?? 0) > 0
  );
}

export function getReadingNotices(result) {
  const stored = clean(result?.extractedData?.pageCoverageNote);
  const live = isNotableCoverage(result) ? clean(result?.coverageNote) : null;
  return {
    coverageNote: live ?? stored,
    aiAnalysisNotice: clean(result?.extractedData?.aiAnalysisNotice),
    pagesNotRead:
      count(result?.pagesSkipped) > 0 || count(result?.pagesFailed) > 0,
  };
}

// What gets stored with the document: its extracted fields plus, when the
// read was not a plain text-layer read, the coverage sentence.
export function withStoredReadingNotes(result) {
  const { coverageNote } = getReadingNotices(result);
  if (!coverageNote) return result.extractedData;
  return { ...result.extractedData, pageCoverageNote: coverageNote };
}
