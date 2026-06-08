import { lazy, Suspense, useState, useEffect } from "react";

const RedTeam = lazy(() => import("../../components/RedTeam"));
const ClaimStressTest = lazy(() => import("../../components/ClaimStressTest"));

/**
 * Adversarial QC surfaces — RedTeam (statement stress test, skeptical reviewer)
 * + ClaimStressTest (war-game C&P examiner). Both opened via window events.
 *
 * RedTeam dispatches openAISettings + openBugSquasher; ClaimStressTest
 * dispatches openBugSquasher. App.jsx bridges those events.
 *
 * Extracted from App.jsx (audit #35, B43).
 */
export default function AdversarialTestingCluster() {
  const [showRedTeam, setShowRedTeam] = useState(false);
  const [showClaimStressTest, setShowClaimStressTest] = useState(false);

  useEffect(() => {
    const openRedTeam = () => setShowRedTeam(true);
    const openClaimStress = () => setShowClaimStressTest(true);
    window.addEventListener("openRedTeam", openRedTeam);
    window.addEventListener("openClaimStressTest", openClaimStress);
    return () => {
      window.removeEventListener("openRedTeam", openRedTeam);
      window.removeEventListener("openClaimStressTest", openClaimStress);
    };
  }, []);

  return (
    <Suspense fallback={null}>
      {showRedTeam && (
        <RedTeam
          onClose={() => setShowRedTeam(false)}
          onReportBug={() => {
            setShowRedTeam(false);
            window.dispatchEvent(new CustomEvent("openBugSquasher"));
          }}
          onOpenAISettings={() =>
            window.dispatchEvent(new CustomEvent("openAISettings"))
          }
        />
      )}
      {showClaimStressTest && (
        <ClaimStressTest
          onClose={() => setShowClaimStressTest(false)}
          onReportBug={() => {
            setShowClaimStressTest(false);
            window.dispatchEvent(new CustomEvent("openBugSquasher"));
          }}
        />
      )}
    </Suspense>
  );
}
