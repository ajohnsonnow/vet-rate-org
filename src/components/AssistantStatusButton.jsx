import { useState, useEffect } from "react";
import { AlertCircle, Cloud, Cpu, Loader2 } from "lucide-react";
import { APP_TRANSLATIONS } from "../i18n/translations";
import { useOptionalLanguage } from "../contexts/LanguageContext";
import { getAIStatus } from "../utils/unifiedAIService";
import { smallModelAnswering } from "../utils/smallModelAnswering";
import { describeModelFallback } from "../utils/modelFallback";
import { describeDeviceModel } from "../utils/deviceCapabilityDetector";
import { useDeviceProfile } from "../utils/deviceLabels";

const POLL_MS = 1000;
const ON_DEVICE_MODES = new Set(["swarm", "wllama", "local", "local-server"]);

// The kind of status, in plain terms: none, starting, cloud, on-device, or
// on-device with a model that is limited (small-class, or a fallback).
function statusKind(status, profile) {
  if (status?.localInitializing || status?.wllamaInitializing) {
    return "Starting";
  }
  if (status?.effectiveMode === "cloud") return "Cloud";
  if (ON_DEVICE_MODES.has(status?.effectiveMode)) {
    const limited =
      smallModelAnswering(status) || describeModelFallback(status, profile);
    return limited ? "OnDeviceLimited" : "OnDevice";
  }
  return "None";
}

const ICONS = {
  None: AlertCircle,
  Starting: Loader2,
  Cloud,
  OnDevice: Cpu,
  OnDeviceLimited: Cpu,
};

/**
 * The AI status in the assistant header: an icon and a short visible label,
 * one 44px button that opens the AI settings. Its accessible name is the
 * status in plain words, with no internal names.
 */
export default function AssistantStatusButton({ onClick, className = "" }) {
  const profile = useDeviceProfile();
  const language = useOptionalLanguage();
  const [status, setStatus] = useState(() => getAIStatus());
  useEffect(() => {
    const timer = setInterval(() => setStatus(getAIStatus()), POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const kind = statusKind(status, profile);
  const text = (key, params) =>
    language
      ? language.t("assistantStatus", key, params)
      : APP_TRANSLATIONS.assistantStatus[key].en.replace(
          "{model}",
          params?.model ?? "",
        );
  const loaded = status?.swarmStatus?.model;
  const model = loaded
    ? describeDeviceModel({ recommendedModels: [loaded] }).displayName
    : (status?.localModelName ?? "AI");
  const Icon = ICONS[kind];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={text(`name${kind}`, { model })}
      data-testid="ai-status-badge"
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border-2 border-white/80 bg-black/30 px-2.5 text-sm font-semibold text-white transition-colors hover:bg-black/40 ${className}`}
    >
      <Icon
        aria-hidden="true"
        className={`h-4 w-4 shrink-0 ${kind === "Starting" ? "animate-spin" : ""}`}
      />
      <span className="whitespace-nowrap">{text(`label${kind}`)}</span>
    </button>
  );
}
