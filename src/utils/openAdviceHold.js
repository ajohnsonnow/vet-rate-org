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
    "- Read a decision letter with the Decision Decoder, using fixed rules instead of the AI model.",
    "- Search the regulations with Ask the Regs and show you the regulation text.",
  ].join("\n"),
  "An AI answer to an open question needs a larger device, such as a desktop computer, or the cloud AI option if you have set one up.",
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

/** The retrieved regulation passages as chat text, each under its citation. */
export const describeRegulationPassages = (passages) =>
  [REGULATION_TEXT_LEAD, ...passages.flatMap(quotePassage)].join("\n\n");

/**
 * What the assistant shows for a held question: the fixed message, then any
 * regulation text a search finds for the question. `retrieve` is the model-free
 * search (legalAnswerer retrieveRegulationText). The search is an addition:
 * when it fails the message still stands alone, and the failure is logged.
 */
export async function buildHeldAnswerContent(question, retrieve) {
  let passages = [];
  try {
    passages = await retrieve(question);
  } catch (error) {
    console.error("Regulation search for a held question failed:", error);
  }
  return passages.length > 0
    ? `${OPEN_ADVICE_HELD_MESSAGE}\n\n${describeRegulationPassages(passages)}`
    : OPEN_ADVICE_HELD_MESSAGE;
}
