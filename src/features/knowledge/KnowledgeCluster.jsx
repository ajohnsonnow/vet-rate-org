import { lazy, Suspense, useState, useEffect } from "react";

const VKBViewer = lazy(() => import("../../components/VKBViewer"));
const UserManual = lazy(() => import("../../components/UserManual"));
const VsoHelpGuide = lazy(() => import("../../components/VsoHelpGuide"));

/**
 * Knowledge / reference surfaces — VKBViewer (Veteran Knowledge Base),
 * UserManual (Field Manual) and VsoHelpGuide. All opened via window events.
 *
 * UserManual's onReportBug dispatches openBugSquasher (App.jsx bridge).
 *
 * Extracted from App.jsx (audit #35, B47).
 */
export default function KnowledgeCluster() {
  const [showVKB, setShowVKB] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showVsoHelp, setShowVsoHelp] = useState(false);

  useEffect(() => {
    const openVKB = () => setShowVKB(true);
    const openManual = () => setShowManual(true);
    const openVsoHelp = () => setShowVsoHelp(true);
    window.addEventListener("openVKBViewer", openVKB);
    window.addEventListener("openUserManual", openManual);
    window.addEventListener("openVsoHelp", openVsoHelp);
    return () => {
      window.removeEventListener("openVKBViewer", openVKB);
      window.removeEventListener("openUserManual", openManual);
      window.removeEventListener("openVsoHelp", openVsoHelp);
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
      {showVsoHelp && <VsoHelpGuide onClose={() => setShowVsoHelp(false)} />}
    </Suspense>
  );
}
