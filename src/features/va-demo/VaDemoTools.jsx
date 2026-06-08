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
 * Opened by `openDemoDashboard` (Ctrl+Shift+D keyboard shortcut, owned
 * by this component since B69) and `openVaIntegrationDemo` (toolbar
 * callback) window events. The feature returns null entirely when the
 * VA-API flag is off, so neither lazy chunk is touched in non-demo
 * builds — and the keyboard shortcut is not registered either.
 *
 * Extracted from App.jsx (audit #35, B35; shortcut moved B69).
 */
export default function VaDemoTools() {
  const [showDemo, setShowDemo] = useState(false);
  const [showIntegration, setShowIntegration] = useState(false);

  useEffect(() => {
    if (!isVaApiEnabled()) return;
    const openDemo = () => setShowDemo(true);
    const openIntegration = () => setShowIntegration(true);
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setShowDemo(true);
      }
    };
    window.addEventListener("openDemoDashboard", openDemo);
    window.addEventListener("openVaIntegrationDemo", openIntegration);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("openDemoDashboard", openDemo);
      window.removeEventListener("openVaIntegrationDemo", openIntegration);
      window.removeEventListener("keydown", handleKeyDown);
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
