/**
 * Tool-ID → CustomEvent dispatcher for App-level tool launches.
 *
 * Used by Workflow Guides + Claim Prep clusters (via their
 * `onToolSelect` prop) so that a tool ID picked from a checklist or
 * guide launches the matching feature modal.
 *
 * Unknown tool IDs are a silent no-op (the upstream UI may render
 * tool entries we have not wired yet).
 *
 * Extracted from App.jsx#handleToolSelect (audit #35, B66).
 */
const TOOL_EVENT_MAP = {
  "forms-helper": "openFormsHelper",
  "veteran-profile": "openMyPacket",
  "tactical-calculator": "openTacticalCalculator",
  "secondary-scout": "openSecondaryScoutLauncher",
  "my-packet": "openMyPacket",
  "knowledge-base": "openVKBViewer",
  "nexus-builder": "openNexusBuilder",
  "statement-analyzer": "openNexusBuilder",
  "mos-hazard": "openMOSHazardMatcher",
  "timeline-wizard": "openEvidenceTimeline",
  "dd214-analyzer": "openDD214Analyzer",
  "web-of-conditions": "openWebOfConditions",
  "cap-simulator": "openCAPSimulator",
  "pain-painter": "openPainPainter",
  "evidence-gap": "openEvidenceGapVisualizer",
  "cfile-analyzer": "openCFileAnalyzer",
  "foia-generator": "openFOIAGenerator",
  "retro-pay-hunter": "openRetroPayHunter",
  "tdiu-builder": "openTDIUBuilder",
  pathfinder: "openPathfinder",
  "million-dollar-dashboard": "openMillionDollarDashboard",
  "vso-finder": "openVSOFinder",
  "witness-bench": "openWitnessBench",
  "claim-navigator": "openClaimNavigator",
  "va-resources": "openVAResources",
  "user-manual": "openUserManual",
  "nexus-analyzer": "openNexusQualityAnalyzer",
  "remand-checker": "openRemandRiskChecker",
  "appeals-advisor": "openAppealsLaneAdvisor",
  "bdd-builder": "openBDDBuilder",
  "the-tribunal": "openTheTribunal",
  "denial-decoder": "openDenialDecoder",
  "pact-act": "openPACTActNavigator",
  "symptom-logger": "openSymptomLogger",
};

export function dispatchToolById(toolId) {
  // conditions-search has no modal — the main search bar is always
  // visible. Silently no-op so the checklist entry doesn't error.
  if (toolId === "conditions-search") return;
  const eventName = TOOL_EVENT_MAP[toolId];
  if (eventName) {
    window.dispatchEvent(new CustomEvent(eventName));
  }
}
