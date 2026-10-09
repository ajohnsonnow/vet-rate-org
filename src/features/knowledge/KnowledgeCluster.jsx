import { lazy, Suspense, useState, useEffect } from "react";

const VKBViewer = lazy(() => import("../../components/VKBViewer"));
const UserManual = lazy(() => import("../../components/UserManual"));

/**
 * Knowledge / reference surfaces — VKBViewer (Veteran Knowledge Base)
 * and UserManual (Field Manual). Both opened via window events.
 *
 * UserManual's onReportBug dispatches openBugSquasher (App.jsx bridge).
 *
 * Extracted from App.jsx (audit #35, B47).
 */
export default function KnowledgeCluster() {
  const [showVKB, setShowVKB] = useState(false);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    const openVKB = () => setShowVKB(true);
    const openManual = () => setShowManual(true);
    window.addEventListener("openVKBViewer", openVKB);
    window.addEventListener("openUserManual", openManual);
    return () => {
      window.removeEventListener("openVKBViewer", openVKB);
      window.removeEventListener("openUserManual", openManual);
    };
  }, []);

  return (
    <Suspense fallback={null}>
      {showVKB && (
        <VKBViewer isOpen={showVKB} onClose={() => setShowVKB(false)} />
      )}
      {showManual && (
        <UserManual
          onClose={() => setShowManual(false)}
          onReportBug={() => {
            setShowManual(false);
            window.dispatchEvent(new CustomEvent("openBugSquasher"));
          }}
        />
      )}
    </Suspense>
  );
}
