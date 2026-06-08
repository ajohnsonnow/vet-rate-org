import { lazy, Suspense, useState, useEffect } from "react";

const FOIAGenerator = lazy(() => import("../../components/FOIAGenerator"));
const MillionDollarDashboard = lazy(
  () => import("../../components/MillionDollarDashboard"),
);
const EvidenceTimeline = lazy(
  () => import("../../components/EvidenceTimeline"),
);
const RetroPayHunter = lazy(() => import("../../components/RetroPayHunter"));

/**
 * Specialized/standalone surfaces — four tools that don't fit any of
 * the thematic clusters but share the same minimal callback shape:
 *   - FOIAGenerator ("The Keysmith" — FOIA request builder)
 *   - MillionDollarDashboard (shock-and-awe lifetime-value visualizer)
 *   - EvidenceTimeline (Continuity Thread — owns its ResponsiveModal chrome)
 *   - RetroPayHunter (effective-date back-pay calculator)
 *
 * Bridges via App.jsx: openBugSquasher, openAISettings.
 *
 * Bug-fix note: prior to extraction, RetroPayHunter's onReportBug
 * called the undefined setShowBugReporter (typo for setShowBugSquasher),
 * which threw silently. Cluster routes through openBugSquasher.
 *
 * Extracted from App.jsx (audit #35, B50).
 */
export default function SpecializedToolsCluster() {
  const [showFOIA, setShowFOIA] = useState(false);
  const [showMillion, setShowMillion] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showRetro, setShowRetro] = useState(false);

  useEffect(() => {
    const openFOIA = () => setShowFOIA(true);
    const openMillion = () => setShowMillion(true);
    const openTimeline = () => setShowTimeline(true);
    const openRetro = () => setShowRetro(true);
    window.addEventListener("openFOIAGenerator", openFOIA);
    window.addEventListener("openMillionDollarDashboard", openMillion);
    window.addEventListener("openEvidenceTimeline", openTimeline);
    window.addEventListener("openRetroPayHunter", openRetro);
    return () => {
      window.removeEventListener("openFOIAGenerator", openFOIA);
      window.removeEventListener("openMillionDollarDashboard", openMillion);
      window.removeEventListener("openEvidenceTimeline", openTimeline);
      window.removeEventListener("openRetroPayHunter", openRetro);
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
      {showFOIA && (
        <FOIAGenerator
          onClose={() => setShowFOIA(false)}
          onReportBug={reportBug(setShowFOIA)}
        />
      )}
      {showMillion && (
        <MillionDollarDashboard
          onClose={() => setShowMillion(false)}
          onReportBug={reportBug(setShowMillion)}
        />
      )}
      {showTimeline && (
        <EvidenceTimeline
          onClose={() => setShowTimeline(false)}
          onReportBug={reportBug(setShowTimeline)}
        />
      )}
      {showRetro && (
        <RetroPayHunter
          onClose={() => setShowRetro(false)}
          onReportBug={reportBug(setShowRetro)}
          onAISettingsClick={openAISettings}
        />
      )}
    </Suspense>
  );
}
