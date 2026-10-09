/**
 * Veteran-facing labels for the on-device AI role pickers.
 *
 * Every entry in a picker selects an assistant role (a set of instructions);
 * initializeSwarm (diamondSwarm.js) loads whichever stock model the device
 * profile recommends. The model name and sizes shown here therefore come from
 * the device profile, not from the entry.
 */

import { useState, useEffect } from "react";
import {
  detectDeviceCapabilities,
  getCachedDeviceProfile,
  describeDeviceModel,
} from "./deviceCapabilityDetector";

const UNKNOWN_SIZE = "varies";
const UNKNOWN_VRAM = "varies";

const ONE_TIME_DOWNLOAD = "It is a one-time download kept on your device.";

export const formatDownloadSize = (deviceModel) =>
  deviceModel?.downloadGB
    ? `about ${deviceModel.downloadGB} GB`
    : "download size varies";

const formatGB = (gb, fallback) => (gb == null ? fallback : `~${gb} GB`);

export const getLocalModelLabels = (deviceModel) => ({
  size: formatGB(deviceModel?.downloadGB, UNKNOWN_SIZE),
  vramRequired: formatGB(deviceModel?.vramGB, UNKNOWN_VRAM),
  baseModel: deviceModel?.displayName ?? "Chosen for your device",
  baseModelInfo:
    "A general-purpose open-source model, not custom-trained on VA data. The role gives it VA-claims instructions. It runs entirely on your device.",
});

export const getDeviceModelSummary = (deviceModel) => {
  if (!deviceModel) {
    return `Each role uses the same on-device model, picked for your device (download size varies). ${ONE_TIME_DOWNLOAD} A role only changes the instructions the model follows.`;
  }
  return `Each role uses the same on-device model. Your device will load ${deviceModel.displayName} (${formatDownloadSize(deviceModel)}). ${ONE_TIME_DOWNLOAD} A role only changes the instructions the model follows.`;
};

const PANEL_ROLES = [
  {
    role: "auditor",
    name: "🎖️ CW5 Auditor (Recommended)",
    description:
      "Assistant role for claim review, compliance checks, and document analysis",
    bestFor: "🔍 Claim Review & Analysis",
    contextInfo:
      "Best for: DD214, C-File, Blue Button, Decision Decoder, compliance checking",
    recommended: true,
    trainingFocus: "VA regulations, 38 CFR, claim evidence analysis",
  },
  {
    role: "writer",
    name: "🎖️ CW4 Writer (Creative)",
    description:
      "Assistant role for personal statements, nexus letters, buddy statements",
    bestFor: "✍️ Statement Writing",
    contextInfo:
      "Best for: Personal statements, nexus letters, witness statements",
    recommended: true,
    trainingFocus:
      "Veteran-voice writing, empathetic statements, legal phrasing",
  },
  {
    role: "rater",
    name: "🎖️ CW3 Rater (Calculations)",
    description:
      "Assistant role for VA rating calculations and the bilateral factor",
    bestFor: "🧮 Rating Calculations",
    contextInfo:
      "Best for: Combined ratings, bilateral factor, TDIU assessment",
    recommended: true,
    trainingFocus: "VA math, bilateral factor, combined ratings table",
  },
];

export const buildPanelRoleModels = (deviceModel) => {
  const labels = getLocalModelLabels(deviceModel);
  return PANEL_ROLES.map(({ role, ...entry }) => ({
    id: `diamond-${role}`,
    ...entry,
    size: labels.size,
    vramRequired: labels.vramRequired,
    category: "diamond",
    isDiamond: true,
    baseModel: labels.baseModel,
    baseModelInfo: labels.baseModelInfo,
  }));
};

const COMMAND_CENTER_ROLES = [
  {
    role: "auditor",
    name: '🎖️ CWO3 "HAWKEYE" - 350F All Source Intel',
    description:
      "Claim review role: checks your service records and medical evidence against 38 CFR rules",
    recommended: true,
    bestFor: "Deep claim audits, evidence correlation, multi-source analysis",
    callSign: "HAWKEYE",
    mos: "350F",
  },
  {
    role: "writer",
    name: '🎖️ CWO4 "PHANTOM" - 270A Legal Admin',
    description:
      "Writing role: drafts personal statements, nexus letters, and appeal documents",
    bestFor: "Legal documents, NODs, HLR scripts, formal correspondence",
    callSign: "PHANTOM",
    mos: "270A",
  },
  {
    role: "rater",
    name: '🎖️ CWO5 "ORACLE" - 352N SIGINT Analyst',
    description:
      "Rating role: explains rating math, the bilateral factor, SMC codes, and TDIU thresholds",
    bestFor: "Complex calculations, pattern analysis, SMC/TDIU strategy",
    callSign: "ORACLE",
    mos: "352N",
  },
];

export const buildCommandCenterModels = (deviceModel) => {
  const labels = getLocalModelLabels(deviceModel);
  return COMMAND_CENTER_ROLES.map(({ role, ...entry }) => ({
    id: `vetrate-${role}-7b-v2`,
    ...entry,
    size: labels.size,
    vramRequired: labels.vramRequired,
  }));
};

export function useDeviceModel() {
  const [deviceModel, setDeviceModel] = useState(() =>
    describeDeviceModel(getCachedDeviceProfile()),
  );

  useEffect(() => {
    let active = true;
    detectDeviceCapabilities()
      .then((profile) => {
        if (active) setDeviceModel(describeDeviceModel(profile));
      })
      .catch((err) => {
        console.warn("Could not read device profile for model labels:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  return deviceModel;
}
