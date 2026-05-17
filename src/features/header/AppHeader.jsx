import Header from "../../components/Header";
import { isVaApiEnabled } from "../../config/vaAuth";

/**
 * AppHeader — wires the Header component's long list of nav-item
 * callbacks to window CustomEvent dispatches. Nothing depends on
 * App.jsx state, so this wrapper has no props and pulls the VA-API
 * gate from config directly.
 *
 * Extracted from App.jsx (audit #35, B64). Replaces ~159 LOC of
 * pass-through prop wiring with a single `<AppHeader />`.
 */
const dispatch = (name) => () => window.dispatchEvent(new CustomEvent(name));

export default function AppHeader() {
  return (
    <Header
      // Core Navigation
      onMyPacketClick={dispatch("openMyPacket")}
      onKnowledgeBaseClick={dispatch("openVKBViewer")}
      onVKBTimelineClick={dispatch("openVKBTimeline")}
      onUserManualClick={dispatch("openUserManual")}
      onVAResourcesClick={dispatch("openVAResources")}
      // Calculate
      onTacticalCalculatorClick={dispatch("openTacticalCalculator")}
      onMillionDollarDashboardClick={dispatch("openMillionDollarDashboard")}
      onWhatIfSandboxClick={dispatch("openWhatIfSandbox")}
      onRetroPayHunterClick={dispatch("openRetroPayHunter")}
      onTimeMachineClick={dispatch("openTimeMachine")}
      // Discover
      onSecondaryScoutClick={dispatch("openSecondaryScoutLauncher")}
      onCAPSimulatorClick={dispatch("openCAPSimulator")}
      onPathfinderClick={dispatch("openPathfinder")}
      onClaimNavigatorClick={dispatch("openClaimNavigator")}
      onMOSHazardMatcherClick={dispatch("openMOSHazardMatcher")}
      onPACTActNavigatorClick={dispatch("openPACTActNavigator")}
      onWebOfConditionsClick={dispatch("openWebOfConditions")}
      onBDDBuilderClick={dispatch("openBDDBuilder")}
      // Build Evidence
      onCFileAnalyzerClick={dispatch("openCFileAnalyzer")}
      onBlueButtonXRayClick={dispatch("openBlueButtonXRay")}
      onRecordSearchClick={dispatch("openRecordSearch")}
      onWitnessBenchClick={dispatch("openWitnessBench")}
      onNexusBuilderClick={dispatch("openNexusBuilder")}
      onFormsHelperClick={dispatch("openFormsHelper")}
      onSymptomLoggerClick={dispatch("openSymptomLogger")}
      onPainPainterClick={dispatch("openPainPainter")}
      onEvidenceTimelineClick={dispatch("openEvidenceTimeline")}
      onFOIAGeneratorClick={dispatch("openFOIAGenerator")}
      // Quality Control
      onRedTeamClick={dispatch("openRedTeam")}
      onClaimStressTestClick={dispatch("openClaimStressTest")}
      onDecisionDecoderClick={dispatch("openDecisionDecoder")}
      onDenialDecoderClick={dispatch("openDenialDecoder")}
      onSharkRadarClick={dispatch("openSharkRadar")}
      onConsistencyEngineClick={dispatch("openConsistencyEngine")}
      onEvidenceGapVisualizerClick={dispatch("openEvidenceGapVisualizer")}
      onRiskAssessmentClick={dispatch("openRiskAssessment")}
      // Maximize Your Rating
      onTDIUBuilderClick={dispatch("openTDIUBuilder")}
      onStateBenefitHunterClick={dispatch("openStateBenefitHunter")}
      onTheTribunalClick={dispatch("openTheTribunal")}
      onLegislativeWatchdogClick={dispatch("openLegislativeWatchdog")}
      // Support & Resources
      onVSOFinderClick={dispatch("openVSOFinder")}
      onVaIntegrationDemoClick={
        isVaApiEnabled() ? dispatch("openVaIntegrationDemo") : undefined
      }
      onBackupManagerClick={dispatch("openBackupManager")}
      onCloudSyncClick={dispatch("openCloudSyncManager")}
      onAISettingsClick={dispatch("openAISettings")}
      // Onboarding & Guides
      onWorkflowGuideClick={dispatch("openWorkflowGuide")}
      // Feature Request & Community Roadmap — handled by FeedbackHub
      onFeatureRequestClick={dispatch("openFeatureRequest")}
      onCommunityRoadmapClick={dispatch("openCommunityRoadmap")}
    />
  );
}
