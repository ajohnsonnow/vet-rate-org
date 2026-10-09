const STORAGE_FAILURE =
  /CacheStorage|QuotaExceeded|NotAllowedError|SecurityError|Cache\.|storage/i;

export const NO_MODEL_TITLE = "No on-device AI model could be loaded.";

const STORAGE_REASON =
  "Your browser would not store the model files. This can happen in private windows, or when storage is full or blocked.";
const GENERAL_REASON =
  "The model files could not be loaded. Check your connection and that your device has free memory, then try again.";
const STILL_WORKS =
  "Without AI you can still use the calculators, the form tools and the Decision Decoder's rule-based reading.";

/**
 * Plain words for a load where every candidate model failed. `failures` is
 * the list initializeSwarm reports ({ modelId, reason } per model). The raw
 * browser messages stay in the console; they are not shown.
 */
export function describeLoadFailure(failures) {
  const storage = (failures ?? []).some((f) =>
    STORAGE_FAILURE.test(f?.reason ?? ""),
  );
  return {
    title: NO_MODEL_TITLE,
    storage,
    reason: storage ? STORAGE_REASON : GENERAL_REASON,
    stillWorks: STILL_WORKS,
  };
}
