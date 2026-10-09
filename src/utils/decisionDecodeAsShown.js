import { decodeDecision } from "./aiStatementHelper";
import { smallModelReading } from "./decisionPatternReading";
import { smallModelAnswering } from "./smallModelAnswering";
import { getAIStatus } from "./unifiedAIService";

/**
 * ADR-010 section 9: a small-class on-device model misread the test decision
 * letter in every graded run, and a misreading cannot be corrected after the
 * fact. While such a model is the one that would answer, the letter is not
 * sent to it. Returns the rule-based reading to show, or null when a model
 * may read the letter. This one condition is the whole decision.
 */
export function readingWithoutModel(denialText) {
  return smallModelAnswering(getAIStatus())
    ? smallModelReading(denialText)
    : null;
}

/**
 * What the Decision Decoder shows for a letter on this device, in the shape
 * decodeDecision returns. The evaluation runner calls this, so its Decision
 * Decoder case records what a veteran on that device is shown.
 */
export async function decodeDecisionAsShown(denialText, options) {
  const withoutModel = readingWithoutModel(denialText);
  return withoutModel
    ? { success: true, data: withoutModel, modelCalled: false }
    : decodeDecision(denialText, options);
}
