import { isSmallModel } from "./deviceCapabilityDetector";

/**
 * True only while an on-device model of the small class (per the device
 * profile table) is the one loaded and answering: the swarm is ready, it is
 * the effective mode, and the model that is actually loaded is in the small
 * class. Cloud answers, no AI, and a model that is not loaded all give
 * false. The small-model note and the writing tools share this one test.
 *
 * @param {object} status what getAIStatus() returns
 */
export const smallModelAnswering = (status) =>
  status?.effectiveMode === "swarm" &&
  Boolean(status.swarmAvailable) &&
  isSmallModel(status.swarmStatus?.model);
