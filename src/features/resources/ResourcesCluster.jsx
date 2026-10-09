import { lazy, Suspense, useState, useEffect } from "react";

const RecordSearch = lazy(() => import("../../components/RecordSearch"));
const VAResources = lazy(() => import("../../components/VAResources"));

/**
 * Information-discovery surfaces — RecordSearch (records lookup) +
 * VAResources Hub (programs / benefits directory). Both opened via
 * window events from toolbar callbacks and tool routers.
 *
 * VAResources's "Report Bug" dispatches openBugSquasher (App.jsx bridge).
 *
 * Extracted from App.jsx (audit #35, B42).
 */
export default function ResourcesCluster() {
  const [showRecord, setShowRecord] = useState(false);
  const [showResources, setShowResources] = useState(false);

  useEffect(() => {
    const openRecord = () => setShowRecord(true);
    const openResources = () => setShowResources(true);
    window.addEventListener("openRecordSearch", openRecord);
    window.addEventListener("openVAResources", openResources);
    return () => {
      window.removeEventListener("openRecordSearch", openRecord);
      window.removeEventListener("openVAResources", openResources);
    };
  }, []);

  return (
    <Suspense fallback={null}>
      {showRecord && <RecordSearch onClose={() => setShowRecord(false)} />}
      {showResources && (
        <VAResources
          onClose={() => setShowResources(false)}
          onReportBug={() =>
            window.dispatchEvent(new CustomEvent("openBugSquasher"))
          }
        />
      )}
    </Suspense>
  );
}
