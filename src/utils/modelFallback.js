import { useState, useEffect } from "react";
import {
  describeDeviceModel,
  isGradedWeaker,
} from "./deviceCapabilityDetector";
import { getAIStatus } from "./unifiedAIService";
import { useDeviceProfile } from "./deviceLabels";

const POLL_MS = 1000;

/**
 * When the model the device profile chose first could not be loaded and a
 * later one in its list loaded instead, the words that say so; otherwise
 * null. Keyed to the model actually loaded (the swarm status), so it is null
 * with no model loaded, with cloud answering, or before the device is probed.
 */
export function describeModelFallback(status, profile) {
  if (status?.effectiveMode !== "swarm" || !status.swarmAvailable) return null;
  const loadedId = status.swarmStatus?.model;
  const intended = describeDeviceModel(profile);
  if (!loadedId || !intended || loadedId === intended.modelId) return null;
  const loaded = describeDeviceModel({ recommendedModels: [loadedId] });
  const weaker = isGradedWeaker(loadedId)
    ? `${loaded.displayName} is an older model, and its answers were weaker in our tests.`
    : `${loaded.displayName} is an older model and has not been tested here.`;
  return {
    intended,
    loaded,
    text: `Vet-Rate meant to load ${intended.displayName} on this device, but it could not be loaded. ${loaded.displayName} is loaded instead. ${weaker}`,
  };
}

/** Live form of describeModelFallback for a component. */
export function useModelFallback() {
  const profile = useDeviceProfile();
  const [status, setStatus] = useState(() => getAIStatus());
  useEffect(() => {
    const timer = setInterval(() => setStatus(getAIStatus()), POLL_MS);
    return () => clearInterval(timer);
  }, []);
  return describeModelFallback(status, profile);
}
