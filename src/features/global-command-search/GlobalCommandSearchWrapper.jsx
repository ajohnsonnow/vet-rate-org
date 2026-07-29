import { useState, useEffect } from "react";
import GlobalCommandSearch from "../../components/GlobalCommandSearch";

/**
 * Global Command Search (CMD/Ctrl + K) — owns the open/close state,
 * the global keyboard shortcut, and the `openGlobalCommandSearch`
 * event listener so other surfaces (e.g. MobileBottomNav) can request
 * the modal without prop-drilling a setter.
 *
 * Tool selection routes through window CustomEvents (one per tool ID).
 * Diagnostic-code selection dispatches `searchDisability` with the
 * term, which the App.jsx bridge maps to the disability-search input.
 *
 * Extracted from App.jsx (audit #35, B63). The previous inline JSX
 * called a dangling `handleSearch(code.code)` reference that was a
 * pre-existing dead identifier (would throw at click time); the
 * extraction routes the same intent through the existing
 * `searchDisability` bridge instead.
 */
const TOOL_EVENT_MAP = {
  "tactical-calculator": "openTacticalCalculator",
  "my-packet": "openMyPacket",
  "secondary-scout": "openSecondaryScoutLauncher",
  "cap-simulator": "openCAPSimulator",
  "nexus-builder": "openNexusBuilder",
  pathfinder: "openPathfinder",
  "claim-navigator": "openClaimNavigator",
  "cfile-analyzer": "openCFileAnalyzer",
  "forms-helper": "openFormsHelper",
  "red-team": "openRedTeam",
  "shark-radar": "openSharkRadar",
  "denial-decoder": "openDenialDecoder",
  "decision-decoder": "openDecisionDecoder",
  "consistency-engine": "openConsistencyEngine",
  "claim-stress-test": "openClaimStressTest",
  "evidence-gap": "openEvidenceGapVisualizer",
  "risk-assessment": "openRiskAssessment",
  "tdiu-builder": "openTDIUBuilder",
  "state-benefits": "openStateBenefitHunter",
  "the-tribunal": "openTheTribunal",
  "vso-finder": "openVSOFinder",
  "user-manual": "openUserManual",
  "knowledge-base": "openVKBViewer",
  "million-dollar": "openMillionDollarDashboard",
  "what-if-sandbox": "openWhatIfSandbox",
  "retro-pay": "openRetroPayHunter",
  "time-machine": "openTimeMachine",
  "pact-act": "openPACTActNavigator",
  "mos-hazard": "openMOSHazardMatcher",
  "web-of-conditions": "openWebOfConditions",
  "blue-button": "openBlueButtonXRay",
  "witness-bench": "openWitnessBench",
  "symptom-logger": "openSymptomLogger",
  "pain-painter": "openPainPainter",
  "evidence-timeline": "openEvidenceTimeline",
  "foia-generator": "openFOIAGenerator",
  "legislative-watchdog": "openLegislativeWatchdog",
  "backup-manager": "openBackupManager",
  "ai-settings": "openAISettings",
  "workflow-guide": "openWorkflowGuide",
  "record-search": "openRecordSearch",
  "dd214-analyzer": "openDD214Analyzer",
  "bdd-builder": "openBDDBuilder",
  "ask-the-regs": "openAskTheRegs",
};

export default function GlobalCommandSearchWrapper() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    const openListener = () => setIsOpen(true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("openGlobalCommandSearch", openListener);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("openGlobalCommandSearch", openListener);
    };
  }, []);

  return (
    <GlobalCommandSearch
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onToolSelect={(toolId) => {
        setIsOpen(false);
        const eventName = TOOL_EVENT_MAP[toolId];
        if (eventName) {
          window.dispatchEvent(new CustomEvent(eventName));
        }
      }}
      onConditionSelect={(code) => {
        setIsOpen(false);
        window.dispatchEvent(
          new CustomEvent("searchDisability", {
            detail: { term: code.code },
          }),
        );
      }}
    />
  );
}
