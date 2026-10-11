export const VSO_REGISTRY_KEY = "vetrate_vso_registry";
export const ACTIVE_SILO_KEY = "vetrate_active_silo";
export const SILO_SWITCH_JOURNAL_KEY = "vetrate_silo_switch_journal";
export const VSO_IDLE_MINUTES_KEY = "vetrate_vso_idle_minutes";

const DEVICE_KEY_NAMES = new Set([
  "vet-rate-theme",
  "vet-rate-color-blind-mode",
  "vet-rate-reduced-motion",
  "vet-rate-font-size",
  "vetrate_language",
  "vetrate-helper-mode",
  "vetrate-helper-tooltips",
  "vetrate-focus-mode",
  "vetrate-tour-completed",

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

  "vet_rate_last_seen_version",
  "pwa_install_dismissed",
  "vetrate_system_status",
  "vetrate-mobile-notice-dismissed",

  // Cross-tab panic-wipe signals (a timestamp only). The write guard drops
  // veteran keys during a switch, and a wipe must never be droppable.
  "vetrate_data_wipe_broadcast",
  "vetrate_data_wipe_pending_broadcast",

  VSO_REGISTRY_KEY,
  ACTIVE_SILO_KEY,
  SILO_SWITCH_JOURNAL_KEY,
  VSO_IDLE_MINUTES_KEY,
]);

const DEVICE_KEY_PREFIXES = Object.freeze([
  "vet_rate_kek_",
  "vet_rate_wrapped_key_",
  "vet_rate_rotating_key_",
  "vet_rate_backup_key_",
]);

export function isDeviceKey(key) {
  if (typeof key !== "string") return false;
  if (DEVICE_KEY_NAMES.has(key)) return true;
  return DEVICE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}
