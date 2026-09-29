// ──────────────────────────────────────────────────────────────
// All 48 user-facing tool events (verified against window.addEventListener
// calls across src/). Organised by cluster matching the app's 7 clusters.
//
// Lives in a non-spec module (no ".spec." in the filename) so it can be
// imported by more than one spec file. Playwright 1.58's test collector
// rejects any spec file that imports another spec file, so this data
// previously lived inside tool-launch-matrix.spec.ts itself, which broke
// every run that collected both files (including a bare `npx playwright
// test`) with 0 tests loaded.
// ──────────────────────────────────────────────────────────────
export const TOOLS: { name: string; event: string; cluster: string }[] = [
  // Calculate Your Rating
  {
    name: "Tactical Calculator",
    event: "openTacticalCalculator",
    cluster: "Calculate",
  },
  {
    name: "Million Dollar Dashboard",
    event: "openMillionDollarDashboard",
    cluster: "Calculate",
  },
  {
    name: "Time Machine (ITF)",
    event: "openTimeMachine",
    cluster: "Calculate",
  },
  {
    name: "Retro Pay Hunter",
    event: "openRetroPayHunter",
    cluster: "Calculate",
  },
  {
    name: "C&P Exam Simulator",
    event: "openCAPSimulator",
    cluster: "Calculate",
  },

  // Discover Your Claims
  { name: "BDD Builder", event: "openBDDBuilder", cluster: "Discover" },
  {
    name: "Secondary Scout",
    event: "openSecondaryScoutLauncher",
    cluster: "Discover",
  },
  { name: "Pathfinder", event: "openPathfinder", cluster: "Discover" },
  {
    name: "MOS Hazard Matcher",
    event: "openMOSHazardMatcher",
    cluster: "Discover",
  },
  {
    name: "PACT Act Navigator",
    event: "openPACTActNavigator",
    cluster: "Discover",
  },
  {
    name: "Web of Conditions",
    event: "openWebOfConditions",
    cluster: "Discover",
  },
  { name: "Claim Navigator", event: "openClaimNavigator", cluster: "Discover" },

  // Build Your Evidence
  {
    name: "C-File AI Analyzer",
    event: "openCFileAnalyzer",
    cluster: "Evidence",
  },
  {
    name: "Blue Button X-Ray",
    event: "openBlueButtonXRay",
    cluster: "Evidence",
  },
  { name: "Muster Call (PDF)", event: "openMusterCall", cluster: "Evidence" },
  { name: "Witness Bench", event: "openWitnessBench", cluster: "Evidence" },
  { name: "Nexus Builder", event: "openNexusBuilder", cluster: "Evidence" },
  { name: "Forms Helper", event: "openFormsHelper", cluster: "Evidence" },
  { name: "Symptom Logger", event: "openSymptomLogger", cluster: "Evidence" },
  { name: "Pain Painter", event: "openPainPainter", cluster: "Evidence" },
  {
    name: "Evidence Timeline",
    event: "openEvidenceTimeline",
    cluster: "Evidence",
  },
  { name: "FOIA Keysmith", event: "openFOIAGenerator", cluster: "Evidence" },

  // Quality Control
  { name: "Red Team", event: "openRedTeam", cluster: "QC" },
  { name: "The War Game", event: "openClaimStressTest", cluster: "QC" },
  { name: "Decision Decoder", event: "openDecisionDecoder", cluster: "QC" },
  { name: "Denials Decoder", event: "openDenialDecoder", cluster: "QC" },
  { name: "Shark Radar", event: "openSharkRadar", cluster: "QC" },
  { name: "Consistency Engine", event: "openConsistencyEngine", cluster: "QC" },
  {
    name: "Evidence Gap Finder",
    event: "openEvidenceGapVisualizer",
    cluster: "QC",
  },
  { name: "Risk Assessment", event: "openRiskAssessment", cluster: "QC" },

  // Maximize Your Rating
  { name: "TDIU Builder", event: "openTDIUBuilder", cluster: "Maximize" },
  {
    name: "State Benefit Hunter",
    event: "openStateBenefitHunter",
    cluster: "Maximize",
  },
  { name: "The Tribunal", event: "openTheTribunal", cluster: "Maximize" },
  {
    name: "Legislative Watchdog",
    event: "openLegislativeWatchdog",
    cluster: "Maximize",
  },
  {
    name: "Body Map Selector",
    event: "openBodyMapSelector",
    cluster: "Maximize",
  },

  // Appeals
  {
    name: "Nexus Quality Analyzer",
    event: "openNexusQualityAnalyzer",
    cluster: "Appeals",
  },
  {
    name: "Remand Risk Checker",
    event: "openRemandRiskChecker",
    cluster: "Appeals",
  },
  {
    name: "Appeals Lane Advisor",
    event: "openAppealsLaneAdvisor",
    cluster: "Appeals",
  },

  // Support & Resources
  { name: "VSO Finder", event: "openVSOFinder", cluster: "Support" },
  { name: "My Packet", event: "openMyPacket", cluster: "Support" },
  { name: "Knowledge Base (VKB)", event: "openVKBViewer", cluster: "Support" },
  { name: "VA Resources Hub", event: "openVAResources", cluster: "Support" },
  { name: "Field Manual", event: "openUserManual", cluster: "Support" },
  { name: "Cloud Sync", event: "openCloudSyncManager", cluster: "Support" },
  { name: "Backup Manager", event: "openBackupManager", cluster: "Support" },
  { name: "VKB Timeline", event: "openVKBTimeline", cluster: "Support" },
  {
    name: "Publications Library",
    event: "openPublicationsLibrary",
    cluster: "Support",
  },
  { name: "Record Search", event: "openRecordSearch", cluster: "Support" },
];
