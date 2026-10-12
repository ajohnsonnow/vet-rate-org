/**
 * What ADR-010 (docs/adr/ADR-010-qwen35-on-device-tiers.md, section 3) says
 * each tier loads and shows, and which tier each hardware profile is meant to
 * land in. The tier is the device class's intended tier, not whatever
 * src/utils/deviceCapabilityDetector.js currently returns. A profile where the
 * two disagree carries a knownIssues entry naming the tier the app really
 * lands in today (actualTier); the affected tests then assert that wrong
 * value, so only the documented defect passes and anything else fails.
 */

export type Tier =
  | "desktop-high"
  | "desktop-mid"
  | "laptop"
  | "tablet"
  | "mobile";

export interface TierExpectation {
  firstModel: string | null;
  modelCount: number;
  contextWindowSize: number | null;
  canUseWebLLM: boolean;
  /** Download size the app prints for the first model (ADR-010 section 3). */
  download: string | null;
  displayName: string | null;
  /** The notice card names the model without the visitor opening anything. */
  cardNamesModel: boolean;
}

export const TIERS: Record<Tier, TierExpectation> = {
  "desktop-high": {
    firstModel: "Qwen3.5-4B-q4f16_1-MLC",
    modelCount: 4,
    contextWindowSize: 12288,
    canUseWebLLM: true,
    download: "about 2.4 GB",
    displayName: "Qwen 3.5 4B",
    cardNamesModel: true,
  },
  "desktop-mid": {
    firstModel: "Qwen3.5-4B-q4f16_1-MLC",
    modelCount: 4,
    contextWindowSize: 8192,
    canUseWebLLM: true,
    download: "about 2.4 GB",
    displayName: "Qwen 3.5 4B",
    cardNamesModel: true,
  },
  laptop: {
    firstModel: "Qwen3.5-2B-q4f16_1-MLC",
    modelCount: 4,
    contextWindowSize: 8192,
    canUseWebLLM: true,
    download: "about 1.1 GB",
    displayName: "Qwen 3.5 2B",
    cardNamesModel: false,
  },
  tablet: {
    firstModel: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    modelCount: 2,
    contextWindowSize: 8192,
    canUseWebLLM: true,
    download: "about 0.9 GB",
    displayName: "Qwen 2.5 1.5B",
    cardNamesModel: true,
  },
  mobile: {
    firstModel: null,
    modelCount: 0,
    contextWindowSize: null,
    canUseWebLLM: false,
    download: null,
    displayName: null,
    cardNamesModel: false,
  },
};

export interface ProfileExpectation {
  tier: Tier;
  /** The profile is a phone, or has no WebGPU: no on-device model is offered. */
  noOnDeviceModel: boolean;
  /** Offered reason text on the Load card when no model is offered. */
  noModelReason?: RegExp;
  knownIssues?: {
    /** The tier the app puts this profile in today; the pinned tests assert it. */
    actualTier: Tier;
    tier?: string;
    config?: string;
  };
}

const PHONE_REASON = /On-device AI is not available on phones\./;
const NO_WEBGPU_REASON = /needs a browser with WebGPU/;

const DESKTOP_MID_ISSUE =
  "desktop-mid is reachable only with screen.width under 1400 and a 1.5 GB or larger maxBufferSize; a 1920-wide discrete 8 GB-class GPU lands in desktop-high (deviceCapabilityDetector.js _deviceTierFor).";

export const PROFILES: Record<string, ProfileExpectation> = {
  "desktop-high": { tier: "desktop-high", noOnDeviceModel: false },
  "desktop-4k": { tier: "desktop-high", noOnDeviceModel: false },
  "desktop-mid": {
    tier: "desktop-mid",
    noOnDeviceModel: false,
    knownIssues: {
      actualTier: "desktop-high",
      tier: DESKTOP_MID_ISSUE,
      config:
        DESKTOP_MID_ISSUE +
        " Context is 12288, not the 8192 ADR-010 gives desktop-mid.",
    },
  },
  "laptop-integrated-8gb": { tier: "laptop", noOnDeviceModel: false },
  "laptop-integrated-16gb": { tier: "laptop", noOnDeviceModel: false },
  "apple-silicon-base": { tier: "desktop-high", noOnDeviceModel: false },
  "tablet-android": { tier: "tablet", noOnDeviceModel: false },
  "tablet-ipad": { tier: "tablet", noOnDeviceModel: false },
  "tablet-ipad-mobile-ua": { tier: "tablet", noOnDeviceModel: false },
  "phone-android-mid": {
    tier: "mobile",
    noOnDeviceModel: true,
    noModelReason: PHONE_REASON,
  },
  "phone-android-low": {
    tier: "mobile",
    noOnDeviceModel: true,
    noModelReason: PHONE_REASON,
  },
  "phone-iphone": {
    tier: "mobile",
    noOnDeviceModel: true,
    noModelReason: PHONE_REASON,
  },
  "no-webgpu-desktop": {
    tier: "mobile",
    noOnDeviceModel: true,
    noModelReason: NO_WEBGPU_REASON,
  },
};
