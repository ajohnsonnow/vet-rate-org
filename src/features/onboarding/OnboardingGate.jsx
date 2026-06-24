import { useState } from "react";
import DisclaimerSplash from "../../components/DisclaimerSplash";
import BootCampTour from "../../components/BootCampTour";
import AffiliationPickerPrompt from "./AffiliationPickerPrompt";

/**
 * Onboarding flow — disclaimer splash on first visit + Boot Camp tour after
 * acknowledgment. Suppresses the tour while the What's New modal is on screen
 * so the two don't fight for attention.
 *
 * Sprint 4 adds an optional one-time affiliation-picker prompt that appears
 * after the disclaimer is acknowledged, before the Boot Camp tour launches.
 * The prompt is fully skippable and non-blocking.
 *
 * Extracted from App.jsx (audit #35, B28). The DisclaimerSplash gates itself
 * internally based on localStorage, so it always mounts; the splash either
 * shows the modal or fires `onAcknowledge` immediately for return visitors.
 */
export default function OnboardingGate({ whatsNewOpen }) {
  const [acknowledged, setAcknowledged] = useState(
    () => localStorage.getItem("vetrate_disclaimer-acknowledged") === "true",
  );
  const [affiliationPromptDone, setAffiliationPromptDone] = useState(
    () => localStorage.getItem("vetrate_affiliation-prompt-seen") === "true",
  );

  const handleAcknowledge = () => setAcknowledged(true);
  const handleAffiliationPromptDone = () => {
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    setAffiliationPromptDone(true);
  };

  return (
    <>
      <DisclaimerSplash onAcknowledge={handleAcknowledge} />
      {acknowledged && !affiliationPromptDone && (
        <AffiliationPickerPrompt onDone={handleAffiliationPromptDone} />
      )}
      {acknowledged && affiliationPromptDone && !whatsNewOpen && (
        <BootCampTour />
      )}
    </>
  );
}
