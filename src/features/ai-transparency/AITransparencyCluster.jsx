import { lazy, Suspense, useState, useEffect } from "react";

const VAAITransparency = lazy(
  () => import("../../components/VAAITransparency"),
);
const ConsistencyEngine = lazy(
  () => import("../../components/ConsistencyEngine"),
);

/**
 * AI-output quality / transparency surfaces — VAAITransparency Hub
 * (educates veterans about VA's 227 AI systems) and ConsistencyEngine
 * (statement-consistency QC). Both opened via window events.
 *
 * VAAITransparency dispatches openBugSquasher (App.jsx bridges it).
 *
 * Extracted from App.jsx (audit #35, B41).
 */
export default function AITransparencyCluster() {
  const [showTransparency, setShowTransparency] = useState(false);
  const [showConsistency, setShowConsistency] = useState(false);

  useEffect(() => {
    const openTransparency = () => setShowTransparency(true);
    const openConsistency = () => setShowConsistency(true);
    window.addEventListener("openVAAITransparency", openTransparency);
    window.addEventListener("openConsistencyEngine", openConsistency);
    return () => {
      window.removeEventListener("openVAAITransparency", openTransparency);
      window.removeEventListener("openConsistencyEngine", openConsistency);
    };
  }, []);

  return (
    <Suspense fallback={null}>
      {showTransparency && (
        <VAAITransparency
          onClose={() => setShowTransparency(false)}
          onReportBug={() => {
            setShowTransparency(false);
            window.dispatchEvent(new CustomEvent("openBugSquasher"));
          }}
        />
      )}
      {showConsistency && (
        <ConsistencyEngine onClose={() => setShowConsistency(false)} />
      )}
    </Suspense>
  );
}
