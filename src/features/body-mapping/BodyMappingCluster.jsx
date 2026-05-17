import { lazy, Suspense, useState, useEffect } from "react";

const BodyMapSelector = lazy(() => import("../../components/BodyMapSelector"));
const PainPainter = lazy(() => import("../../components/PainPainter"));

/**
 * Somatic-mapping surfaces — BodyMapSelector (legacy quick picker) and
 * PainPainter (interactive body-map 2.0). Both feed into Symptom Logger
 * after a selection. Both opened via window events.
 *
 * Cross-feature flow: both dispatch openSymptomLogger on completion;
 * PainPainter also dispatches openBugSquasher. App.jsx bridges those
 * three events to local state (SymptomLogger not yet extracted).
 *
 * Extracted from App.jsx (audit #35, B45).
 */
export default function BodyMappingCluster() {
  const [showBodyMap, setShowBodyMap] = useState(false);
  const [showPainPainter, setShowPainPainter] = useState(false);

  useEffect(() => {
    const openBodyMap = () => setShowBodyMap(true);
    const openPainPainter = () => setShowPainPainter(true);
    window.addEventListener("openBodyMapSelector", openBodyMap);
    window.addEventListener("openPainPainter", openPainPainter);
    return () => {
      window.removeEventListener("openBodyMapSelector", openBodyMap);
      window.removeEventListener("openPainPainter", openPainPainter);
    };
  }, []);

  const openSymptomLogger = () =>
    window.dispatchEvent(new CustomEvent("openSymptomLogger"));

  return (
    <Suspense fallback={null}>
      {showBodyMap && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
          <div className="min-h-screen px-4 py-8">
            <div className="max-w-6xl mx-auto">
              <BodyMapSelector
                onClose={() => setShowBodyMap(false)}
                onLogToSymptomLogger={() => {
                  setShowBodyMap(false);
                  openSymptomLogger();
                }}
              />
            </div>
          </div>
        </div>
      )}
      {showPainPainter && (
        <PainPainter
          onClose={() => setShowPainPainter(false)}
          onLogToSymptomLogger={() => {
            setShowPainPainter(false);
            openSymptomLogger();
          }}
          onReportBug={() => {
            setShowPainPainter(false);
            window.dispatchEvent(new CustomEvent("openBugSquasher"));
          }}
        />
      )}
    </Suspense>
  );
}
