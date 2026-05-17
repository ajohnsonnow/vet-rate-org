import { lazy, Suspense, useState, useEffect } from "react";
import ReportBugLink from "../../components/ReportBugLink";
import {
  saveStatement,
  getSavedClaims,
  getStatement,
} from "../../utils/claimsStorage";

const SecondaryScout = lazy(() => import("../../components/SecondaryScout"));
const SecondaryScoutLauncher = lazy(
  () => import("../../components/SecondaryScoutLauncher"),
);
const NexusBuilder = lazy(() => import("../../components/NexusBuilder"));

/**
 * Discover Tools — Secondary Scout Launcher → Secondary Scout results
 * → Nexus Builder. The three modals share a workflow: launcher picks
 * conditions, results suggest secondaries, Nexus Builder drafts the
 * statement of evidence.
 *
 * State owned:
 *   - showSecondaryScoutLauncher / showSecondaryScout / showNexusBuilder
 *   - nexusBuilderData ({ condition, primaryCondition, existingStatement })
 *
 * State borrowed (prop): userConditions (still consumed by AtomicWipe
 *   reset and MobileBottomNav in App.jsx). Cluster updates via
 *   setUserConditions when SecondaryScoutLauncher fires onLaunch.
 *
 * Events listened: openSecondaryScoutLauncher, openNexusBuilder
 *   (detail = { condition, primaryCondition, existingStatement? }),
 *   resumeFromPacket (detail = saved claim).
 *
 * Events dispatched: openMyPacket, openBugSquasher, openAISettings.
 *
 * Extracted from App.jsx (audit #35, B58). Replaces the three bridge
 * listeners added in B55/B56.
 */
export default function DiscoverCluster({ userConditions, setUserConditions }) {
  const [showSecondaryScoutLauncher, setShowSecondaryScoutLauncher] =
    useState(false);
  const [showSecondaryScout, setShowSecondaryScout] = useState(false);
  const [showNexusBuilder, setShowNexusBuilder] = useState(false);
  const [nexusBuilderData, setNexusBuilderData] = useState(null);

  useEffect(() => {
    const openLauncher = () => setShowSecondaryScoutLauncher(true);
    const openNexus = (e) => {
      if (e?.detail) setNexusBuilderData(e.detail);
      setShowNexusBuilder(true);
    };
    const resumeFromPacket = (e) => {
      const claim = e?.detail;
      if (!claim) return;
      const existingStatement = getStatement(claim.id);
      setNexusBuilderData({
        condition: claim.conditionName,
        primaryCondition: claim.parentCondition,
        existingStatement,
      });
      setShowNexusBuilder(true);
    };
    window.addEventListener("openSecondaryScoutLauncher", openLauncher);
    window.addEventListener("openNexusBuilder", openNexus);
    window.addEventListener("resumeFromPacket", resumeFromPacket);
    return () => {
      window.removeEventListener("openSecondaryScoutLauncher", openLauncher);
      window.removeEventListener("openNexusBuilder", openNexus);
      window.removeEventListener("resumeFromPacket", resumeFromPacket);
    };
  }, []);

  const handleLaunchSecondaryScout = (conditions) => {
    setUserConditions(conditions);
    setShowSecondaryScoutLauncher(false);
    setShowSecondaryScout(true);
  };

  const handleLearnHow = (suggestion) => {
    setNexusBuilderData({
      condition: suggestion.secondaryCondition,
      primaryCondition: suggestion.primaryCondition,
    });
    setShowSecondaryScout(false);
    setShowNexusBuilder(true);
  };

  const handleSaveStatement = (statementData) => {
    const savedClaims = getSavedClaims();
    const matchingClaim = savedClaims.find(
      (c) =>
        c.conditionName === statementData.condition &&
        c.parentCondition === (statementData.primaryCondition || null),
    );

    if (matchingClaim) {
      saveStatement(matchingClaim.id, statementData);
    } else {
      alert(
        "Error: Could not find matching claim. Please save the claim first from Secondary Scout.",
      );
    }

    setShowNexusBuilder(false);
    window.dispatchEvent(new CustomEvent("openMyPacket"));
  };

  return (
    <>
      {showSecondaryScoutLauncher && (
        <Suspense fallback={null}>
          <SecondaryScoutLauncher
            onLaunch={handleLaunchSecondaryScout}
            onClose={() => setShowSecondaryScoutLauncher(false)}
            onReportBug={() =>
              window.dispatchEvent(new CustomEvent("openBugSquasher"))
            }
          />
        </Suspense>
      )}

      {showSecondaryScout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
          <div className="min-h-screen px-4 py-8">
            <div className="bg-white dark:bg-emerald-950 rounded-lg shadow-xl max-w-7xl mx-auto">
              <div className="sticky top-0 bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-4 sm:px-6 py-4 z-10 rounded-t-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl sm:text-3xl font-bold truncate">
                      🔍 Secondary Scout Results
                    </h2>
                    <p className="text-sm text-blue-100 mt-1">
                      Based on {userConditions.length} service-connected
                      condition{userConditions.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <ReportBugLink
                      onClick={() =>
                        window.dispatchEvent(new CustomEvent("openBugSquasher"))
                      }
                      variant="light"
                      moduleName="Secondary Scout Results"
                    />
                    <button
                      onClick={() => {
                        setShowSecondaryScout(false);
                        window.dispatchEvent(new CustomEvent("openMyPacket"));
                      }}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-va-gold text-va-blue rounded-lg font-medium hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      <svg
                        className="w-4 h-4 sm:w-5 sm:h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span className="hidden xs:inline">My </span>Packet
                    </button>
                    <button
                      onClick={() => {
                        setShowSecondaryScout(false);
                        setShowSecondaryScoutLauncher(true);
                      }}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors text-sm sm:text-base"
                    >
                      <span className="hidden sm:inline">Change </span>
                      Conditions
                    </button>
                    <button
                      onClick={() => setShowSecondaryScout(false)}
                      className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                      aria-label="Close"
                    >
                      <svg
                        className="w-5 h-5 sm:w-6 sm:h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <Suspense fallback={null}>
                  <SecondaryScout
                    userDisabilities={userConditions}
                    onLearnHow={handleLearnHow}
                    onViewPacket={() => {
                      setShowSecondaryScout(false);
                      window.dispatchEvent(new CustomEvent("openMyPacket"));
                    }}
                    onOpenAISettings={() =>
                      window.dispatchEvent(new CustomEvent("openAISettings"))
                    }
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNexusBuilder && nexusBuilderData && (
        <Suspense fallback={null}>
          <NexusBuilder
            condition={nexusBuilderData.condition}
            primaryCondition={nexusBuilderData.primaryCondition}
            existingStatement={nexusBuilderData.existingStatement}
            onClose={() => setShowNexusBuilder(false)}
            onSave={handleSaveStatement}
            onReportBug={() =>
              window.dispatchEvent(new CustomEvent("openBugSquasher"))
            }
            onOpenAISettings={() =>
              window.dispatchEvent(new CustomEvent("openAISettings"))
            }
          />
        </Suspense>
      )}
    </>
  );
}
