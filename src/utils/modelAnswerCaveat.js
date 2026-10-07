import { smallModelAnswering } from "./smallModelAnswering";

// English source of the fixed line; the shown text comes from the
// modelAnswerCaveat.line translations, which must match this in English.
export const MODEL_ANSWER_CAVEAT =
  "Written by an AI model on your device. It can be wrong about VA law and about your case. Check anything you will act on with an accredited Veterans Service Officer.";

const ON_DEVICE_MODES = new Set(["swarm", "wllama", "local"]);

/**
 * True for an answer an on-device model that is not small-class wrote. Not
 * for the calculator's answers (no model was called), not for the fixed
 * open-advice message, and not for cloud answers. A small-class model has its
 * own caveat and is not asked open questions.
 *
 * @param {object} result what generateAI resolved
 * @param {object} status what getAIStatus() returns
 */
export const isModelWrittenOnDevice = (result, status) =>
  Boolean(result?.onDevice) &&
  result.modelCalled !== false &&
  !result.openAdviceHeld &&
  !smallModelAnswering(status);

/** The same test before an answer exists, for a view that has only the status. */
export const onDeviceModelAnswering = (status) =>
  ON_DEVICE_MODES.has(status?.effectiveMode) && !smallModelAnswering(status);
