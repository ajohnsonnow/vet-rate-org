import { isSmallModel } from "./deviceCapabilityDetector";

/**
 * True only while an on-device model of the small class is the one loaded and
 * answering: the swarm is ready, it is the effective mode, and the model that
 * is actually loaded is in the small class (the `smallModel` rows of the
 * per-model table). Cloud answers, no AI, and a model that is not loaded all
 * give false. `status` is what getAIStatus() returns.
 */
export const smallModelAnswering = (status) =>
  status?.effectiveMode === "swarm" &&
  Boolean(status.swarmAvailable) &&
  isSmallModel(status.swarmStatus?.model);
