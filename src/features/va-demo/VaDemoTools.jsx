import { lazy, Suspense, useState, useEffect } from "react";
import { isVaApiEnabled } from "../../config/vaAuth";

const VaIntegrationTest = lazy(
  () => import("../../components/VaIntegrationTest"),
);
const DemoDashboard = lazy(() => import("../../components/DemoDashboard"));

/**
 * VA Production-Access demo surfaces — DemoDashboard and VaIntegrationTest.
 * Both are gated by `isVaApiEnabled()` and exist for the VA demo only.
 *
 * Opened by `openDemoDashboard` (Ctrl+Shift+D in App.jsx) and
 * `openVaIntegrationDemo` (toolbar callback) window events. The feature
 * returns null entirely when the VA-API flag is off, so neither lazy
 * chunk is touched in non-demo builds.
 *
 * Extracted from App.jsx (audit #35, B35).
 */
export default function VaDemoTools() {
  const [showDemo, setShowDemo] = useState(false);
  const [showIntegration, setShowIntegration] = useState(false);

  useEffect(() => {
    if (!isVaApiEnabled()) return;
    const openDemo = () => setShowDemo(true);
    const openIntegration = () => setShowIntegration(true);
    window.addEventListener("openDemoDashboard", openDemo);
    window.addEventListener("openVaIntegrationDemo", openIntegration);
    return () => {
      window.removeEventListener("openDemoDashboard", openDemo);
      window.removeEventListener("openVaIntegrationDemo", openIntegration);
    };
  }, []);

  if (!isVaApiEnabled()) return null;

  return (
    <Suspense fallback={null}>
      {showIntegration && (
        <VaIntegrationTest onClose={() => setShowIntegration(false)} />
      )}
      {showDemo && <DemoDashboard onClose={() => setShowDemo(false)} />}
    </Suspense>
  );
}
