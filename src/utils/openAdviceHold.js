/**
 * ADR-010 section 11. While a small-class on-device model is the one that
 * would answer, an open question about VA law or claims is not sent to it:
 * in every graded run that model wrote at least two answers with invented
 * facts or wrong law. The veteran is shown this fixed message instead. It
 * names no model, so it stays true when the small-class table changes.
 *
 * Nothing is shown under it. A search of the regulations was tried under the
 * message and removed: on the golden questions 16 of 33 top passages were not
 * on the question and no score separated them (ADR-010 section 13). The
 * message points to Ask the Regs for a search the veteran asks for.
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
