import { lazy, Suspense, useState, useEffect } from "react";

const RemandRiskChecker = lazy(
  () => import("../../components/RemandRiskChecker"),
);
const AppealsLaneAdvisor = lazy(
  () => import("../../components/AppealsLaneAdvisor"),
);

/**
 * Appeals-stage tooling cluster — RemandRiskChecker + AppealsLaneAdvisor.
 * Both are reachable from the App.jsx tool-router (`handleToolSelect`)
 * under tool ids "remand-checker" and "appeals-advisor"; the router
 * now dispatches `openRemandRiskChecker` / `openAppealsLaneAdvisor`
 * events instead of calling setShow* directly.
 *
 * Extracted from App.jsx (audit #35, B38).
 */
export default function AppealsToolsCluster() {
  const [showRemand, setShowRemand] = useState(false);
  const [showAdvisor, setShowAdvisor] = useState(false);

  useEffect(() => {
    const openRemand = () => setShowRemand(true);
    const openAdvisor = () => setShowAdvisor(true);
    window.addEventListener("openRemandRiskChecker", openRemand);
    window.addEventListener("openAppealsLaneAdvisor", openAdvisor);
    return () => {
      window.removeEventListener("openRemandRiskChecker", openRemand);
      window.removeEventListener("openAppealsLaneAdvisor", openAdvisor);
    };
  }, []);

  return (
    <Suspense fallback={null}>
      {showRemand && <RemandRiskChecker onClose={() => setShowRemand(false)} />}
      {showAdvisor && (
        <AppealsLaneAdvisor onClose={() => setShowAdvisor(false)} />
      )}
    </Suspense>
  );
}
