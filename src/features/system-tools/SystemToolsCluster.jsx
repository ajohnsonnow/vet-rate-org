import { lazy, Suspense, useState, useEffect } from "react";

const BugSquasher = lazy(() => import("../../components/BugSquasher"));
const SymptomLogger = lazy(() => import("../../components/SymptomLogger"));
const AICommandCenter = lazy(() => import("../../components/AICommandCenter"));

/**
 * System / infrastructure surfaces — three utilities invoked across
 * the app rather than within a specific claim workflow:
 *   - BugSquasher (in-app bug reporter — needs live app-state snapshot)
 *   - SymptomLogger (daily symptom tracking)
 *   - AICommandCenter (unified Faraday Cage / AI settings)
 *
 * Owns the openBugSquasher / openAISettings / openSymptomLogger window
 * event listeners that previously lived as a bridge in App.jsx. Also
 * owns the openVisionSimulator → close-AI-Command-Center side-effect
 * (Vision Simulator is launched from inside the AI Command Center, so
 * the parent must dismiss when the child mounts).
 *
 * BugSquasher receives appState by calling `getAppState()` at render
 * time — mirrors the FeedbackHub pattern so the snapshot is live, not
 * stale from cluster mount.
 *
 * Bug reports from within AICommandCenter / SymptomLogger close their
 * own modal and dispatch openBugSquasher to open the reporter cleanly.
 *
 * Extracted from App.jsx (audit #35, B52). Closes the
 * openBugSquasher / openAISettings event-bridge useEffect.
 */
export default function SystemToolsCluster({ getAppState }) {
  const [showBugSquasher, setShowBugSquasher] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showSymptomLogger, setShowSymptomLogger] = useState(false);

  useEffect(() => {
    const openBug = () => setShowBugSquasher(true);
    const openAi = () => setShowAISettings(true);
    const openSymptom = () => setShowSymptomLogger(true);
    const closeAiOnVision = () => setShowAISettings(false);
    window.addEventListener("openBugSquasher", openBug);
    window.addEventListener("openAISettings", openAi);
    window.addEventListener("openSymptomLogger", openSymptom);
    window.addEventListener("openVisionSimulator", closeAiOnVision);
    return () => {
      window.removeEventListener("openBugSquasher", openBug);
      window.removeEventListener("openAISettings", openAi);
      window.removeEventListener("openSymptomLogger", openSymptom);
      window.removeEventListener("openVisionSimulator", closeAiOnVision);
    };
  }, []);

  const reportBugFrom = (closeFn) => () => {
    closeFn(false);
    setShowBugSquasher(true);
  };

  return (
    <Suspense fallback={null}>
      {showBugSquasher && (
        <BugSquasher
          onClose={() => setShowBugSquasher(false)}
          appState={getAppState?.()}
          onOpenRoadmap={() =>
            window.dispatchEvent(new CustomEvent("openCommunityRoadmap"))
          }
        />
      )}
      {showSymptomLogger && (
        <SymptomLogger
          onClose={() => setShowSymptomLogger(false)}
          onReportBug={reportBugFrom(setShowSymptomLogger)}
        />
      )}
      {showAISettings && (
        <AICommandCenter
          onClose={() => setShowAISettings(false)}
          onReportBug={reportBugFrom(setShowAISettings)}
        />
      )}
    </Suspense>
  );
}
