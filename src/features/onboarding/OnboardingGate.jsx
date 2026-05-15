import { useState } from "react";
import DisclaimerSplash from "../../components/DisclaimerSplash";
import BootCampTour from "../../components/BootCampTour";

/**
 * Onboarding flow — disclaimer splash on first visit + Boot Camp tour after
 * acknowledgment. Suppresses the tour while the What's New modal is on screen
 * so the two don't fight for attention.
 *
 * Extracted from App.jsx (audit #35, B28). The DisclaimerSplash gates itself
 * internally based on localStorage, so it always mounts; the splash either
 * shows the modal or fires `onAcknowledge` immediately for return visitors.
 */
export default function OnboardingGate({ whatsNewOpen }) {
  const [acknowledged, setAcknowledged] = useState(
    () => localStorage.getItem("vetrate_disclaimer-acknowledged") === "true",
  );

  return (
    <>
      <DisclaimerSplash onAcknowledge={() => setAcknowledged(true)} />
      {acknowledged && !whatsNewOpen && <BootCampTour />}
    </>
  );
}
