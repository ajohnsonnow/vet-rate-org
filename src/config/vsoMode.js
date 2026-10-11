// Build-time entry-point gate for VSO (multi-veteran) mode. Deliberately not
// routed through src/utils/featureFlags.js, which treats unknown features as
// enabled; this flag must default to off and only an explicit "true" turns it
// on. It gates the entry point only: an existing registry keeps the VSO code
// paths running whatever this returns (see isVsoModeActive in vsoRegistry.js).
export function isVsoModeEnabled() {
  return (
    String(import.meta.env.VITE_VSO_MODE_ENABLED ?? "false").toLowerCase() ===
    "true"
  );
}
