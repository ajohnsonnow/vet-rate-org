// Map a failed assistant request into the localized message to display.
// Expected, handled states (no AI set up, crisis, disabled, not ready) are
// shown to the veteran and are not logged as errors.
export function mapAssistantErrorMessage(error, t) {
  const errMsg = error?.message ?? "";

  if (errMsg === "CRISIS_DETECTED") return t("aiAssistant", "errorCrisis");
  if (errMsg.includes("No AI available")) return t("aiAssistant", "errorNoAI");
  if (errMsg.includes("temporarily disabled")) {
    return t("aiAssistant", "errorDisabled");
  }
  if (errMsg.includes("empty response")) {
    return t("aiAssistant", "errorEmptyResponse");
  }
  if (errMsg.includes("not initialized") || errMsg.includes("not loaded")) {
    return t("aiAssistant", "errorNotReady");
  }

  console.error("Navigator AI error:", errMsg || error);
  return errMsg ? `⚠️ ${errMsg}` : t("aiAssistant", "errorGeneric");
}
