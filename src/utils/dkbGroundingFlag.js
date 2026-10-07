/**
 * Opt-in switch for grounding AI answers in the full sharded knowledge base.
 * Same convention as the other experimental AI toggles
 * (localStorage "vet_rate_experimental_webgpu"): off unless the stored value
 * is exactly "true". Deliberately not routed through featureFlags.js, whose
 * remote kill switch fails open (unknown flags read as enabled).
 */
export const FULL_DKB_GROUNDING_KEY = "vet_rate_experimental_full_dkb";

export function isFullDKBGroundingEnabled() {
  try {
    return localStorage.getItem(FULL_DKB_GROUNDING_KEY) === "true";
  } catch {
    return false;
  }
}
