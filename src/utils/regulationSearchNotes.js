export const SEARCH_RESULTS_LABEL =
  "Search results from the regulations. These are the closest text matches and may not be about your question. Read the section heading before relying on one.";

export const REGULATION_SEARCH_DISCLOSURE =
  "The first time you search, your device downloads a search model (about 34 MB) from Hugging Face and keeps it. The search runs on your device; your question is not sent there.";

export const NEEDS_AI_FOR_ANSWER =
  "An AI answer needs an AI mode set up. Tap the AI status at the top of this window to set one up.";

/** A section the regulations reserve has no text, so it is never shown. */
export const isReservedPassage = (passage) =>
  /\[Reserved\]/i.test(passage?.title ?? "") ||
  /^\W*\[Reserved\]\W*$/i.test(passage?.text ?? "");

/** The section number and heading a passage is shown under. */
export const passageHeading = (passage) => {
  const title = (passage.title ?? "").trim();
  return title && !title.startsWith(passage.citation)
    ? `${passage.citation} - ${title.replace(/^§+\s*[\d.a-z-]+\s*/i, "")}`
    : passage.citation;
};
