import { lazy, Suspense, useState, useEffect } from "react";

const CAPSimulator = lazy(() => import("../../components/CAPSimulator"));
const TacticalCalculator = lazy(
  () => import("../../components/TacticalCalculator"),
);

/**
 * Calculate-and-simulate surfaces — the two tools that feed each other:
 *   - CAPSimulator (C&P exam predictor)
 *   - TacticalCalculator (combined-rating math, pay tables)
 *
 * Both open via window events (openCAPSimulator, openTacticalCalculator).
 *
 * CAPSimulator's predicted ratings flow into TacticalCalculator via the
 * internal capSimulatorResults state — when CAPSimulator's onSendToCalculator
 * fires, the cluster appends to capSimulatorResults, closes CAPSimulator,
 * and opens TacticalCalculator. TacticalCalculator can clear the seeded
 * results via onClearCapResults. This handoff is purely internal — no
 * coordination with App.jsx required (previously the handleSendToCalculator
 * handler + capSimulatorResults state lived in App.jsx).
 *
 * Bridges via App.jsx: openBugSquasher.
 *
 * Extracted from App.jsx (audit #35, B53).
 */
export default function CalculateCluster() {
  const [showCAP, setShowCAP] = useState(false);
  const [showTactical, setShowTactical] = useState(false);
  const [capSimulatorResults, setCapSimulatorResults] = useState([]);

  useEffect(() => {
    const openCAP = () => setShowCAP(true);
    const openTactical = () => setShowTactical(true);
    window.addEventListener("openCAPSimulator", openCAP);
    window.addEventListener("openTacticalCalculator", openTactical);
    return () => {
      window.removeEventListener("openCAPSimulator", openCAP);
      window.removeEventListener("openTacticalCalculator", openTactical);
    };
  }, []);

  const reportBug = (closeFn) => () => {
    closeFn(false);
    window.dispatchEvent(new CustomEvent("openBugSquasher"));
  };

  const handleSendToCalculator = (result, conditionName, diagnosticCode) => {
    const newResult = {
      id: Date.now(),
      conditionName,
      diagnosticCode,
      rating: result.predictedRating,
      source: "C&P Simulator",
      dateAdded: new Date().toISOString(),
    };
    setCapSimulatorResults((prev) => [...prev, newResult]);
    setShowCAP(false);
    setShowTactical(true);
  };

  return (
    <Suspense fallback={null}>
      {showCAP && (
        <CAPSimulator
          onClose={() => setShowCAP(false)}
          onReportBug={reportBug(setShowCAP)}
          onSendToCalculator={handleSendToCalculator}
        />
      )}
      {showTactical && (
        <TacticalCalculator
          onClose={() => setShowTactical(false)}
          onReportBug={reportBug(setShowTactical)}
          capSimulatorResults={capSimulatorResults}
          onClearCapResults={() => setCapSimulatorResults([])}
        />
      )}
    </Suspense>
  );
}
