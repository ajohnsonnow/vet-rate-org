import { describe, it, expect } from "vitest";
import {
  ACTIVE_SILO_KEY,
  SILO_SWITCH_JOURNAL_KEY,
  VSO_IDLE_MINUTES_KEY,
  VSO_REGISTRY_KEY,
  isDeviceKey,
} from "../../utils/siloScope";

// Every name in docs/VSO_SILOS_SPEC.md section 3.2, written out by hand so a
// change to the module's list cannot silently change what this test expects.
const SPEC_DEVICE_KEYS = [
  // display and accessibility
  "vet-rate-theme",
  "vet-rate-color-blind-mode",
  "vet-rate-reduced-motion",
  "vet-rate-font-size",
  "vetrate_language",
  "vetrate-helper-mode",
  "vetrate-helper-tooltips",
  "vetrate-focus-mode",
  "vetrate-tour-completed",
  // AI and runtime settings
  "vet_rate_local_ai_model",
  "vet_rate_experimental_webgpu",
  "vet_rate_selected_gpu",
  "vet_rate_gpu_preference",
  "vetrate_token_limit_config",
  "vet_rate_ai_mode",
  "vetrate_ai_preset",
  "vetrate_diamond_swarm_config",
  "vetrate_wllama_config",
  "vetrate_wllama_cache",
  "vetrate_local_server_config",
  // device bookkeeping
  "vet_rate_last_seen_version",
  "pwa_install_dismissed",
  "vetrate_system_status",
  "vetrate-mobile-notice-dismissed",
  // cross-tab panic-wipe signals
  "vetrate_data_wipe_broadcast",
  "vetrate_data_wipe_pending_broadcast",
  // silo bookkeeping (spec 3.1)
  "vetrate_vso_registry",
  "vetrate_active_silo",
  "vetrate_silo_switch_journal",
  "vetrate_vso_idle_minutes",
];

// Keys the spec says belong to a veteran (sections 2 and 3.2).
const VETERAN_KEYS = [
  "vet_rate_veteran_profile",
  "vet_rate_my_ratings",
  "vet_rate_saved_forms",
  "vet_rate_service_history",
  "vet_rate_timeline_events",
  "vet_rate_pain_maps",
  "vet_rate_data_schema_version",
  "vet_rate_app_version",
  "vet-rate-palette",
  "vetrate_affiliation-prompt-seen",
  "vetrate_ai_consent",
  "vetrate_gemini_key",
  "vetrate_session_silo",
  "va_access_token",
];

describe("isDeviceKey", () => {
  it.each(SPEC_DEVICE_KEYS)("treats %s as a device key", (key) => {
    expect(isDeviceKey(key)).toBe(true);
  });

  it.each([
    "vet_rate_kek_meta",
    "vet_rate_kek_verifier",
    "vet_rate_kek_verifier_tag",
    "vet_rate_kek_rotating",
    "vet_rate_wrapped_key_vso_0123456789ab",
    "vet_rate_wrapped_key_vetrate_backup_1700000000_x",
    "vet_rate_rotating_key_vso_0123456789ab",
    "vet_rate_backup_key_vso_0123456789ab",
    "vet_rate_backup_key_vetrate_backup_1700000000_x",
  ])("treats the keystore key %s as a device key", (key) => {
    expect(isDeviceKey(key)).toBe(true);
  });

  it.each(VETERAN_KEYS)("treats %s as veteran data", (key) => {
    expect(isDeviceKey(key)).toBe(false);
  });

  // AC3
  it("treats a key the app has never seen as veteran data", () => {
    expect(isDeviceKey("vet_rate_future_x")).toBe(false);
  });

  it.each([
    "",
    "unknown",
    "VET-RATE-THEME",
    "Vet-Rate-Theme",
    "vet-rate-theme ",
    " vet-rate-theme",
    "vet-rate-theme2",
    "vet-rate-theme_old",
    "x_vet-rate-theme",
    "vetrate_language_override",
    "vet_rate_kek",
    "vet_rate_kekmeta",
    "xvet_rate_kek_meta",
    "VET_RATE_KEK_META",
    "vet_rate_wrapped_key",
    "vet_rate_wrapped_keys_x",
    "vet_rate_backup_settings",
    "vet_rate_backup_key",
    "vetrate_vso_registry_copy",
    "vetrate_active_silo2",
    "toString",
    "constructor",
    "__proto__",
    "hasOwnProperty",
  ])("treats the near-miss or odd key %j as veteran data", (key) => {
    expect(isDeviceKey(key)).toBe(false);
  });

  it.each([undefined, null, 0, 1, true, {}, [], ["vet-rate-theme"], () => 1])(
    "treats the non-string %j as veteran data",
    (key) => {
      expect(isDeviceKey(key)).toBe(false);
    },
  );

  it("exports the silo bookkeeping key names the spec fixes", () => {
    expect(VSO_REGISTRY_KEY).toBe("vetrate_vso_registry");
    expect(ACTIVE_SILO_KEY).toBe("vetrate_active_silo");
    expect(SILO_SWITCH_JOURNAL_KEY).toBe("vetrate_silo_switch_journal");
    expect(VSO_IDLE_MINUTES_KEY).toBe("vetrate_vso_idle_minutes");
  });
});
