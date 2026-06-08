import { lazy, Suspense, useState, useEffect } from "react";
import { saveClaim } from "../../utils/claimsStorage";

const PACTActNavigator = lazy(
  () => import("../../components/PACTActNavigator"),
);
const MOSHazardMatcher = lazy(
  () => import("../../components/MOSHazardMatcher"),
);
const WebOfConditions = lazy(() => import("../../components/WebOfConditions"));
const TimeMachine = lazy(() => import("../../components/TimeMachine"));
const BDDBuilder = lazy(() => import("../../components/BDDBuilder"));
const VSOFinder = lazy(() => import("../../components/VSOFinder"));

/**
 * Claim-prep surfaces — six specialized tools that help veterans
 * gather facts and route their claim before filing:
 *   - PACTActNavigator (presumptive eligibility)
 *   - MOSHazardMatcher (deployment / exposure crosswalk)
 *   - WebOfConditions (secondary-condition graph)
 *   - TimeMachine (ITF countdown / window tracker)
 *   - BDDBuilder (pre-discharge planner)
 *   - VSOFinder (Veteran Service Organization locator)
 *
 * All six dispatch openBugSquasher. BDDBuilder also needs the legacy
 * handleToolSelect router from App.jsx (still references some local
 * setShow*() that haven't migrated yet) — passed in via `onToolSelect`.
 *
 * MOSHazardMatcher.onAddToPathfinder and WebOfConditions.onSelectCondition
 * are stubs in App.jsx (console.log only) — preserved as-is.
 *
 * Extracted from App.jsx (audit #35, B48).
 */
export default function ClaimPrepCluster({ onToolSelect }) {
  const [showPACT, setShowPACT] = useState(false);
  const [showMOS, setShowMOS] = useState(false);
  const [showWeb, setShowWeb] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showBDD, setShowBDD] = useState(false);
  const [showVSO, setShowVSO] = useState(false);

  useEffect(() => {
    const openPACT = () => setShowPACT(true);
    const openMOS = () => setShowMOS(true);
    const openWeb = () => setShowWeb(true);
    const openTime = () => setShowTime(true);
    const openBDD = () => setShowBDD(true);
    const openVSO = () => setShowVSO(true);
    window.addEventListener("openPACTActNavigator", openPACT);
    window.addEventListener("openMOSHazardMatcher", openMOS);
    window.addEventListener("openWebOfConditions", openWeb);
    window.addEventListener("openTimeMachine", openTime);
    window.addEventListener("openBDDBuilder", openBDD);
    window.addEventListener("openVSOFinder", openVSO);
    return () => {
      window.removeEventListener("openPACTActNavigator", openPACT);
      window.removeEventListener("openMOSHazardMatcher", openMOS);
      window.removeEventListener("openWebOfConditions", openWeb);
      window.removeEventListener("openTimeMachine", openTime);
      window.removeEventListener("openBDDBuilder", openBDD);
      window.removeEventListener("openVSOFinder", openVSO);
    };
  }, []);

  const reportBug = (closeFn) => () => {
    closeFn(false);
    window.dispatchEvent(new CustomEvent("openBugSquasher"));
  };

  return (
    <Suspense fallback={null}>
      {showPACT && (
        <PACTActNavigator
          onClose={() => setShowPACT(false)}
          onReportBug={reportBug(setShowPACT)}
        />
      )}
      {showMOS && (
        <MOSHazardMatcher
          onClose={() => setShowMOS(false)}
          onAddToPathfinder={(conditions) => {
            setShowMOS(false);
            window.dispatchEvent(
              new CustomEvent("openPathfinder", { detail: { conditions } }),
            );
          }}
          onReportBug={reportBug(setShowMOS)}
        />
      )}
      {showWeb && (
        <WebOfConditions
          onClose={() => setShowWeb(false)}
          onSelectCondition={(condition) => {
            saveClaim({ conditionName: condition });
          }}
          onReportBug={reportBug(setShowWeb)}
        />
      )}
      {showTime && (
        <TimeMachine
          onClose={() => setShowTime(false)}
          onReportBug={reportBug(setShowTime)}
        />
      )}
      {showBDD && (
        <BDDBuilder
          onClose={() => setShowBDD(false)}
          onReportBug={reportBug(setShowBDD)}
          onNavigateToTool={(toolId) => {
            setShowBDD(false);
            onToolSelect?.(toolId);
          }}
        />
      )}
      {showVSO && (
        <VSOFinder
          onClose={() => setShowVSO(false)}
          onReportBug={reportBug(setShowVSO)}
        />
      )}
    </Suspense>
  );
}
