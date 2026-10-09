import { lazy, Suspense, useState, useEffect } from "react";

const TDIUBuilder = lazy(() => import("../../components/TDIUBuilder"));
const StateBenefitHunter = lazy(
  () => import("../../components/StateBenefitHunter"),
);
const TheTribunal = lazy(() => import("../../components/TheTribunal"));
const LegislativeWatchdog = lazy(
  () => import("../../components/LegislativeWatchdog"),
);

/**
 * Rating-maximization surfaces — TDIUBuilder (work-impact narrative),
 * StateBenefitHunter (50-state benefits cross-walk), TheTribunal (mock
 * BVA hearing prep), and LegislativeWatchdog (rule-change radar).
 *
 * TDIUBuilder and TheTribunal dispatch openAISettings; all four dispatch
 * openBugSquasher. App.jsx bridges those events to local state.
 *
 * Extracted from App.jsx (audit #35, B44).
 */
export default function MaximizeRatingCluster() {
  const [showTDIU, setShowTDIU] = useState(false);
  const [showState, setShowState] = useState(false);
  const [showTribunal, setShowTribunal] = useState(false);
  const [showWatchdog, setShowWatchdog] = useState(false);

  useEffect(() => {
    const openTDIU = () => setShowTDIU(true);
    const openState = () => setShowState(true);
    const openTribunal = () => setShowTribunal(true);
    const openWatchdog = () => setShowWatchdog(true);
    window.addEventListener("openTDIUBuilder", openTDIU);
    window.addEventListener("openStateBenefitHunter", openState);
    window.addEventListener("openTheTribunal", openTribunal);
    window.addEventListener("openLegislativeWatchdog", openWatchdog);
    return () => {
      window.removeEventListener("openTDIUBuilder", openTDIU);
      window.removeEventListener("openStateBenefitHunter", openState);
      window.removeEventListener("openTheTribunal", openTribunal);
      window.removeEventListener("openLegislativeWatchdog", openWatchdog);
    };
  }, []);

  const reportBug = (closeFn) => () => {
    closeFn(false);
    window.dispatchEvent(new CustomEvent("openBugSquasher"));
  };
  const openAISettings = () =>
    window.dispatchEvent(new CustomEvent("openAISettings"));

  return (
    <Suspense fallback={null}>
      {showTDIU && (
        <TDIUBuilder
          onClose={() => setShowTDIU(false)}
          onReportBug={reportBug(setShowTDIU)}
          onOpenAISettings={openAISettings}
        />
      )}
      {showState && (
        <StateBenefitHunter
          onClose={() => setShowState(false)}
          onReportBug={reportBug(setShowState)}
        />
      )}
      {showTribunal && (
        <TheTribunal
          onClose={() => setShowTribunal(false)}
          onReportBug={reportBug(setShowTribunal)}
          onOpenAISettings={openAISettings}
        />
      )}
      {showWatchdog && (
        <LegislativeWatchdog
          onClose={() => setShowWatchdog(false)}
          onReportBug={reportBug(setShowWatchdog)}
        />
      )}
    </Suspense>
  );
}
