import { lazy, Suspense, useState, useEffect } from "react";
import ReportBugLink from "../../components/ReportBugLink";
import ResponsiveModal from "../../components/common/ResponsiveModal";
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
function useDiscoverEventListeners(
  setShowSecondaryScoutLauncher,
  setNexusBuilderData,
  setShowNexusBuilder,
) {
  useEffect(() => {
    const openLauncher = () => setShowSecondaryScoutLauncher(true);
    const openNexus = (e) => {
      if (e?.detail) {
        setNexusBuilderData(e.detail);
      } else {
        const saved = getSavedClaims();
        const first = saved[0];
        setNexusBuilderData(
          first
            ? {
                condition: first.conditionName,
                primaryCondition: first.parentCondition ?? null,
                existingStatement: getStatement(first.id),
              }
            : {
                condition: "",
                primaryCondition: null,
                existingStatement: null,
              },
        );
      }
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
  }, [setShowSecondaryScoutLauncher, setNexusBuilderData, setShowNexusBuilder]);
}

function SecondaryScoutHeader({
  userConditions,
  onReportBug,
  onViewPacket,
  onChangeConditions,
  onClose,
}) {
  return (
    <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-4 sm:px-6 py-4 rounded-t-lg">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2
            id="secondary-scout-title"
            className="text-xl sm:text-3xl font-bold truncate"
          >
            🔍 Secondary Scout Results
          </h2>
          <p className="text-sm text-blue-100 mt-1">
            Based on {userConditions.length} service-connected condition
            {userConditions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <ReportBugLink
            onClick={onReportBug}
            variant="light"
            moduleName="Secondary Scout Results"
          />
          <button
            onClick={onViewPacket}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-va-gold text-gray-900 rounded-lg font-medium hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
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
            onClick={onChangeConditions}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors text-sm sm:text-base"
          >
            <span className="hidden sm:inline">Change </span>
            Conditions
          </button>
          <button
            onClick={onClose}
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
  );
}

function SecondaryScoutLauncherModal({ onLaunch, onClose, onReportBug }) {
  return (
    <Suspense fallback={null}>
      <SecondaryScoutLauncher
        onLaunch={onLaunch}
        onClose={onClose}
        onReportBug={onReportBug}
      />
    </Suspense>
  );
}

function findMatchingClaim(statementData) {
  const savedClaims = getSavedClaims();
  return savedClaims.find(
    (c) =>
      c.conditionName === statementData.condition &&
      c.parentCondition === (statementData.primaryCondition || null),
  );
}

function saveStatementOrAlert(statementData) {
  const matchingClaim = findMatchingClaim(statementData);
  if (matchingClaim) {
    saveStatement(matchingClaim.id, statementData);
  } else {
    alert(
      "Error: Could not find matching claim. Please save the claim first from Secondary Scout.",
    );
  }
}

function DiscoverNexusBuilderModal({
  data,
  onClose,
  onSave,
  onReportBug,
  onOpenAISettings,
}) {
  return (
    <Suspense fallback={null}>
      <NexusBuilder
        condition={data.condition}
        primaryCondition={data.primaryCondition}
        existingStatement={data.existingStatement}
        onClose={onClose}
        onSave={onSave}
        onReportBug={onReportBug}
        onOpenAISettings={onOpenAISettings}
      />
    </Suspense>
  );
}

function SecondaryScoutModal({
  userConditions,
  onClose,
  onLearnHow,
  onChangeConditions,
  onViewPacket,
  onReportBug,
  onOpenAISettings,
}) {
  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="full"
      labelledBy="secondary-scout-title"
      className="dark:!bg-emerald-950"
      header={
        <SecondaryScoutHeader
          userConditions={userConditions}
          onReportBug={onReportBug}
          onViewPacket={onViewPacket}
          onChangeConditions={onChangeConditions}
          onClose={onClose}
        />
      }
    >
      <Suspense fallback={null}>
        <SecondaryScout
          userDisabilities={userConditions}
          onLearnHow={onLearnHow}
          onViewPacket={onViewPacket}
          onOpenAISettings={onOpenAISettings}
        />
      </Suspense>
    </ResponsiveModal>
  );
}

export default function DiscoverCluster({ userConditions, setUserConditions }) {
  const [showSecondaryScoutLauncher, setShowSecondaryScoutLauncher] =
    useState(false);
  const [showSecondaryScout, setShowSecondaryScout] = useState(false);
  const [showNexusBuilder, setShowNexusBuilder] = useState(false);
  const [nexusBuilderData, setNexusBuilderData] = useState(null);

  useDiscoverEventListeners(
    setShowSecondaryScoutLauncher,
    setNexusBuilderData,
    setShowNexusBuilder,
  );

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
    saveStatementOrAlert(statementData);
    setShowNexusBuilder(false);
    window.dispatchEvent(new CustomEvent("openMyPacket"));
  };

  return (
    <>
      {showSecondaryScoutLauncher && (
        <SecondaryScoutLauncherModal
          onLaunch={handleLaunchSecondaryScout}
          onClose={() => setShowSecondaryScoutLauncher(false)}
          onReportBug={() =>
            window.dispatchEvent(new CustomEvent("openBugSquasher"))
          }
        />
      )}

      {showSecondaryScout && (
        <SecondaryScoutModal
          userConditions={userConditions}
          onClose={() => setShowSecondaryScout(false)}
          onLearnHow={handleLearnHow}
          onChangeConditions={() => {
            setShowSecondaryScout(false);
            setShowSecondaryScoutLauncher(true);
          }}
          onViewPacket={() => {
            setShowSecondaryScout(false);
            window.dispatchEvent(new CustomEvent("openMyPacket"));
          }}
          onReportBug={() =>
            window.dispatchEvent(new CustomEvent("openBugSquasher"))
          }
          onOpenAISettings={() =>
            window.dispatchEvent(new CustomEvent("openAISettings"))
          }
        />
      )}

      {showNexusBuilder && nexusBuilderData && (
        <DiscoverNexusBuilderModal
          data={nexusBuilderData}
          onClose={() => setShowNexusBuilder(false)}
          onSave={handleSaveStatement}
          onReportBug={() =>
            window.dispatchEvent(new CustomEvent("openBugSquasher"))
          }
          onOpenAISettings={() =>
            window.dispatchEvent(new CustomEvent("openAISettings"))
          }
        />
      )}
    </>
  );
}
