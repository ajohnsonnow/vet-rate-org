/**
 * ADR-010 section 11. While a small-class on-device model is the one that
 * would answer, an open question about VA law or claims is not sent to it:
 * in every graded run that model wrote at least two answers with invented
 * facts or wrong law. The veteran is shown this fixed message instead. It
 * names no model, so it stays true when the small-class table changes.
 */
export const OPEN_ADVICE_HELD_MESSAGE = [
  "This device runs a small on-device AI model. In testing, that model gave wrong information too often on open questions about VA law and claims, so Vet-Rate does not use it to answer them.",
  [
    "On this device Vet-Rate can still:",
    "- Work out a combined rating, the bilateral factor and the TDIU percentage thresholds with its calculator. Ask here, or open the Rating Calculator.",
    "- Help you write a statement with the form and statement tools.",
    "- Read a decision letter with the Decision Decoder. Here it uses fixed rules, not the AI model: it picks out the kind of decision, the deadline and the review options. It does not explain VA's reasons.",
    "- Search the regulations with Ask the Regs and show you the regulation text.",
  ].join("\n"),
  "To have a document read, such as a DD214 or your records, open the tool for it: the DD214 Analyzer, the C-File Analyzer, Blue Button X-Ray or the Decision Decoder. This chat cannot read documents.",
  "An AI answer to an open question needs a device that can run the larger on-device model, or the cloud AI option if you have set one up.",
  "A Veterans Service Officer can answer this question, free of charge. Use the VSO Finder in Vet-Rate, or VA's list of accredited representatives at va.gov/ogc/apps/accreditation.",
].join("\n\n");

export const openAdviceHeldAnswer = () => ({
  text: OPEN_ADVICE_HELD_MESSAGE,
  openAdviceHeld: true,
});

export const REGULATION_TEXT_LEAD =
  "Regulation text found by searching for your question. It is quoted from the regulations, not written by AI, and it may not be the part that applies to you:";

// A table chunk can run to pages; the chat shows the start and says so.
const MAX_PASSAGE_CHARS = 1500;
const CONTINUES = "(The text continues in the regulation.)";

function quotePassage({ citation, title, text }) {
  const heading = title ? `${citation} - ${title}` : citation;
  const body =
    text.length > MAX_PASSAGE_CHARS
      ? `${text.slice(0, MAX_PASSAGE_CHARS).trimEnd()} ${CONTINUES}`
      : text;
  return [`**${heading}**`, body];
}

// The search ranks by cosine similarity of small-model embeddings, which sit
// between about 0.54 and 0.75 for every question, relevant or not. Measured on
// the 29 golden questions with text and four sleep apnea questions
// (src/__tests__/utils/fixtures/regulationSearchRelevance.json): no cutoff
// separates the passages that were on the question from those that were not.
// 0.58 drops the lowest-scoring hits (4 that were not on the question, 4 that
// were) and, since a misleading passage costs more than a missing one, is where
// this guard stops. ADR-010 section 13.
export const PASSAGE_RELEVANCE_FLOOR = 0.58;

export const NO_MATCHING_REGULATION_TEXT =
  "No closely matching regulation text was found; try Ask the Regs with the regulation's words.";

export const REGULATION_SEARCH_DISCLOSURE =
  "The first time you search, your device downloads a search model (about 34 MB) from Hugging Face and keeps it. The search runs on your device; your question is not sent there.";

const isRelevant = (passage) =>
  Number.isFinite(passage.score) &&
  passage.score >= PASSAGE_RELEVANCE_FLOOR &&
  !/\[Reserved\]/i.test(`${passage.title ?? ""} ${passage.text ?? ""}`);

/** The retrieved regulation passages as chat text, each under its citation. */
export const describeRegulationPassages = (passages) =>
  [
    REGULATION_TEXT_LEAD,
    ...passages.flatMap(quotePassage),
    REGULATION_SEARCH_DISCLOSURE,
  ].join("\n\n");

/**
 * What the assistant shows for a held question: the fixed message, then any
 * regulation text a search finds for the question. `retrieve` is the model-free
 * search (legalAnswerer retrieveRegulationText). The search is an addition:
 * when it fails the message still stands alone, and the failure is logged.
 */
export async function buildHeldAnswerContent(question, retrieve) {
  let passages = [];
  try {
    passages = (await retrieve(question)).filter(isRelevant);
  } catch (error) {
    console.error("Regulation search for a held question failed:", error);
    return OPEN_ADVICE_HELD_MESSAGE;
  }
  return passages.length > 0
    ? `${OPEN_ADVICE_HELD_MESSAGE}\n\n${describeRegulationPassages(passages)}`
    : `${OPEN_ADVICE_HELD_MESSAGE}\n\n${NO_MATCHING_REGULATION_TEXT}`;
}
