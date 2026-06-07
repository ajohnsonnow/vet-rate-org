import { useState, useEffect, useRef } from "react";
import AccessibilityMenu from "./AccessibilityMenu";
import LanguageSelector from "./LanguageSelector";
import HelperModeToggle from "./HelperModeToggle";
import KnowledgeBaseStatus from "./KnowledgeBaseStatus";
import VersionDropdown from "./VersionDropdown";
// ConsistencyBadge removed from header - accessed via Tools menu
import { AIStatusBadge } from "./AIModeSelector";
import { useTheme } from "../contexts/ThemeContext";
import { useHelperMode } from "../contexts/HelperModeContext";
import { hasUnsavedChanges } from "../utils/dataPersistence";
import { useColorSchemas } from "../hooks/useColorSchemas";
import useFocusTrap from "../hooks/useFocusTrap";
import { useBodyScrollLock } from "../utils/useBodyScrollLock";
import { useLanguage } from "../contexts/LanguageContext";

function Header({
  // Core Navigation
  onMyPacketClick,
  onKnowledgeBaseClick,
  onVKBTimelineClick,
  onUserManualClick,
  onVAResourcesClick,
  // Calculate Your Rating (Blue)
  onTacticalCalculatorClick,
  onMillionDollarDashboardClick,
  onWhatIfSandboxClick,
  onRetroPayHunterClick,
  onTimeMachineClick,
  // Discover Your Claims (Teal)
  onSecondaryScoutClick,
  onCAPSimulatorClick,
  // ExamPrepRoom merged into CAPSimulator
  onPathfinderClick,
  onClaimNavigatorClick,
  onMOSHazardMatcherClick,
  onPACTActNavigatorClick,
  onWebOfConditionsClick,
  onBDDBuilderClick,
  // Build Your Evidence (Violet)
  onCFileAnalyzerClick,
  onBlueButtonXRayClick,
  onRecordSearchClick,
  onWitnessBenchClick,
  onNexusBuilderClick,
  onFormsHelperClick,
  onSymptomLoggerClick,
  onPainPainterClick,
  onEvidenceTimelineClick,
  onFOIAGeneratorClick,
  // Quality Control (Rose)
  onRedTeamClick,
  onClaimStressTestClick,
  onDecisionDecoderClick,
  onDenialDecoderClick,
  onSharkRadarClick,
  onConsistencyEngineClick,
  onEvidenceGapVisualizerClick,
  onRiskAssessmentClick,
  // Maximize Your Rating (Amber)
  onTDIUBuilderClick,
  onStateBenefitHunterClick,
  onTheTribunalClick,
  onLegislativeWatchdogClick,
  // Support & Resources (Sky)
  onVSOFinderClick,
  onVaIntegrationDemoClick,
  onBackupManagerClick,
  onCloudSyncClick,
  onAISettingsClick,
  // Onboarding & Guides
  onWorkflowGuideClick,
  // Feature Request & Roadmap
  onFeatureRequestClick,
  onCommunityRoadmapClick,
}) {
  const { isDark, toggleTheme } = useTheme();
  const { isHelperMode } = useHelperMode();
  const { getDropdownClasses, getColorClass, colors } = useColorSchemas();
  const { t, language } = useLanguage(); // Include language to force re-render on change
  const dropdownClasses = getDropdownClasses();

  const [showResourcesMenu, setShowResourcesMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [shouldPulseBackup, setShouldPulseBackup] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef(null);

  // The mobile drawer is a modal overlay, so lock background scroll and trap
  // focus while it is open (ESC closes it). The desktop Tools/Resources menus
  // are disclosure dropdowns (aria-expanded + click-away), not trapped.
  useBodyScrollLock(showMobileMenu);
  useFocusTrap(mobileMenuRef, {
    active: showMobileMenu,
    onEscape: () => setShowMobileMenu(false),
  });

  // Check for unsaved changes periodically
  useEffect(() => {
    const checkForChanges = () => {
      setShouldPulseBackup(hasUnsavedChanges());
    };

    // Check immediately
    checkForChanges();

    // Check every 10 seconds
    const interval = setInterval(checkForChanges, 10000);

    return () => clearInterval(interval);
  }, []);

  const veteranResources = [
    // CRISIS - Always first
    {
      name: "🆘 Veterans Crisis Line",
      url: "https://www.veteranscrisisline.net/",
      description: "Call 988, Press 1 | Text 838255",
      urgent: true,
    },
    // HEALTH & MEDICAL
    {
      name: "🏥 VA Health Care",
      url: "https://www.va.gov/health-care/",
      description: "Apply for VA health benefits",
    },
    {
      name: "🧠 Mental Health & PTSD",
      url: "https://www.ptsd.va.gov/",
      description: "PTSD treatment & resources",
    },
    {
      name: "⚠️ PACT Act Benefits",
      url: "https://www.va.gov/resources/the-pact-act-and-your-va-benefits/",
      description: "New presumptive conditions & eligibility",
      highlight: true,
    },
    {
      name: "🧪 Toxic Exposure Assessment",
      url: "https://www.publichealth.va.gov/MEEA/index.asp",
      description: "Free MEEA evaluations",
    },
    // SPECIALIZED VETERAN POPULATIONS
    {
      name: "👩 Women Veterans",
      url: "https://www.va.gov/womenvet/",
      description: "Resources for women Veterans",
    },
    {
      name: "🏳️‍🌈 LGBTQ+ Veterans",
      url: "https://www.patientcare.va.gov/lgbt/",
      description: "LGBTQ+ Veteran Care Coordinators at every VA",
    },
    {
      name: "🏠 Homeless Veterans",
      url: "https://www.va.gov/homeless/",
      description: "Call 1-877-4AID-VET (1-877-424-3838)",
    },
    // BENEFITS & SERVICES
    {
      name: "🎓 GI Bill Benefits",
      url: "https://www.va.gov/education/",
      description: "Education & training benefits",
    },
    {
      name: "💼 Veteran Jobs",
      url: "https://www.va.gov/careers-employment/",
      description: "Employment resources & training",
    },
    {
      name: "🏡 VA Home Loans",
      url: "https://www.va.gov/housing-assistance/",
      description: "Home loan & housing assistance",
    },
    {
      name: "👨‍👩‍👧‍👦 Caregiver Support",
      url: "https://www.caregiver.va.gov/",
      description: "Support for veteran caregivers",
    },
    // APPEALS & COMPREHENSIVE RESOURCES
    {
      name: "⚖️ Board of Veterans Appeals",
      url: "https://www.bva.va.gov/",
      description: "Appeal your VA decision",
    },
    {
      name: "📚 National Resource Directory",
      url: "https://nrd.gov/",
      description: "Database of vetted resources & services",
      highlight: true,
    },
  ];

  return (
    <header
      className="bg-gradient-to-r from-va-blue to-green-900 dark:from-emerald-900 dark:to-emerald-950 text-white shadow-lg"
      role="banner"
    >
      {/* Skip Link for Screen Readers */}
      <a href="#main-content" className="skip-link sr-only focus:not-sr-only">
        Skip to main content
      </a>

      {/* Crisis Line Banner - Always Visible */}
      <div className="bg-red-700 dark:bg-red-900 text-white text-center py-1.5 px-4 text-sm">
        <a
          href="https://www.veteranscrisisline.net/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline font-medium"
        >
          🆘 Veterans Crisis Line: <strong>Call 988, Press 1</strong> | Text
          838255 | Chat online 24/7
        </a>
      </div>

      <div className="container mx-auto px-4 py-4 md:py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-center items-center gap-3 md:gap-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="rounded-full h-14 w-14 md:h-16 md:w-16 lg:h-20 lg:w-20 flex-shrink-0 overflow-hidden shadow-md">
              <img
                src="/images/Vet-Rate-org-logo-official.png"
                alt="Vet-Rate.org Logo"
                className="h-full w-full object-cover"
                width={80}
                height={80}
                fetchPriority="high"
                decoding="async"
              />
            </div>
            <div className="flex-shrink-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
                Vet-Rate.org
              </h1>
              <p className="text-green-100 dark:text-gray-300 text-xs sm:text-sm md:text-base">
                {t("header", "subtitle")}
              </p>
            </div>
          </div>

          {/* Desktop Navigation - Hidden on mobile - DOUBLE STACKED */}
          <nav
            className="hidden md:flex flex-col gap-1 items-center"
            role="navigation"
            aria-label="Main navigation"
          >
            {/* ROW 1: Quick actions */}
            <div className="flex flex-wrap justify-center gap-2 lg:gap-3 items-center">
              {/* Quick Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-1 focus:ring-va-gold text-[10px] font-medium"
                aria-label={
                  isDark
                    ? t("header", "switchToLight")
                    : t("header", "switchToDark")
                }
              >
                {isDark ? (
                  <>
                    <span>☀️</span>
                    <span>Light</span>
                  </>
                ) : (
                  <>
                    <span>🌙</span>
                    <span>Dark</span>
                  </>
                )}
              </button>

              {/* Legislative Watchdog */}
              <button
                onClick={onLegislativeWatchdogClick}
                className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/40 transition-colors focus:outline-none focus:ring-1 focus:ring-va-gold text-[10px] font-medium relative"
                aria-label={t("tools", "legislativeWatchdog")}
              >
                <span>📡</span>
                <span>Watch</span>
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
              </button>

              {/* Help */}
              <button
                id="tour-help-btn"
                onClick={onUserManualClick}
                className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-1.5 py-0.5 text-sm whitespace-nowrap"
                aria-label={t("common", "help")}
              >
                ❓{" "}
                <span className="hidden lg:inline">{t("common", "help")}</span>
              </button>

              {/* Missions */}
              <button
                id="tour-workflow-guide-btn"
                onClick={onWorkflowGuideClick}
                className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-1.5 py-0.5 text-sm flex items-center gap-1 whitespace-nowrap"
                aria-label={t("tools", "missions")}
              >
                🗺️{" "}
                <span className="hidden lg:inline">
                  {t("tools", "missions")}
                </span>
                <span className="px-1 py-0.5 bg-va-gold text-gray-900 text-[9px] font-bold rounded">
                  {t("common", "new").toUpperCase()}
                </span>
              </button>
            </div>

            {/* ROW 2: Main nav items */}
            <div className="flex flex-wrap justify-center gap-2 lg:gap-3 items-center">
              {/* My Packet */}
              <button
                id="tour-my-packet-btn"
                onClick={onMyPacketClick}
                className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-1.5 lg:px-2 py-1 text-sm lg:text-base whitespace-nowrap"
                aria-label={t("tools", "myPacket")}
              >
                📁{" "}
                <span className="hidden lg:inline">
                  {t("tools", "myPacket")}
                </span>
              </button>

              {/* Tools Dropdown - Main feature tools */}
              <div id="tour-tools-dropdown" className="relative sm:relative">
                <button
                  onClick={() => setShowToolsMenu(!showToolsMenu)}
                  onBlur={() => setTimeout(() => setShowToolsMenu(false), 200)}
                  className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-1.5 lg:px-2 py-1 text-sm lg:text-base flex items-center gap-1 whitespace-nowrap"
                  aria-label={t("common", "tools")}
                  aria-expanded={showToolsMenu}
                  aria-haspopup="true"
                >
                  🛠️{" "}
                  <span className="hidden lg:inline">
                    {t("common", "tools")}
                  </span>
                  <svg
                    className={`w-3 h-3 lg:w-4 lg:h-4 transition-transform ${showToolsMenu ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showToolsMenu && (
                  <div
                    className={`fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 mt-2 sm:w-96 rounded-lg shadow-xl z-50 overflow-hidden max-h-[80vh] overflow-y-auto ${dropdownClasses.menu.replace("absolute mt-2", "")}`}
                  >
                    <div className="p-2">
                      {/* CALCULATE - Blue Theme */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-2 mb-2">
                        <p className="text-xs text-blue-700 dark:text-blue-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          📊 {t("toolsMenu", "calculateYourRating")}
                        </p>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onTacticalCalculatorClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/40 bg-white/50 dark:bg-blue-800/30"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🧮 {t("tools", "tacticalCalculator")}
                            <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">
                              {t("common", "core").toUpperCase()}
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "tacticalCalculatorDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onMillionDollarDashboardClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            💰 {t("tools", "millionDollarDashboard")}
                            <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded animate-pulse">
                              WOW
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "millionDollarDashboardDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onWhatIfSandboxClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🎯 {t("tools", "whatIfSandbox")}
                            <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded">
                              DRAG&DROP
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "whatIfSandboxDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onRetroPayHunterClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            ⏰ {t("tools", "retroPayHunter")}
                            <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded">
                              💰
                            </span>
                            <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded">
                              AI
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "retroPayHunterDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onTimeMachineClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            📅 {t("tools", "timeMachine")}
                            <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">
                              ITF
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "timeMachineDesc")}
                          </p>
                        </button>
                      </div>

                      {/* DISCOVER - Teal Theme */}
                      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 rounded-lg p-2 mb-2">
                        <p className="text-xs text-teal-700 dark:text-teal-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
                          <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                          🔍 {t("toolsMenu", "discoverYourClaims")}
                        </p>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onSecondaryScoutClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🔍 {t("tools", "secondaryScout")}
                            <span className="px-1.5 py-0.5 bg-teal-600 text-white text-[10px] font-bold rounded">
                              INSTANT
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "secondaryScoutDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onCAPSimulatorClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            ✅ {t("tools", "capSimulator")}
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "capSimulatorDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onPathfinderClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🧭 {t("tools", "pathfinder")}
                            <span className="px-1.5 py-0.5 bg-teal-600 text-white text-[10px] font-bold rounded">
                              AI
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "pathfinderDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onClaimNavigatorClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40 bg-white/50 dark:bg-teal-800/30"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🗺️ {t("tools", "claimNavigator")}
                            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded animate-pulse">
                              {t("common", "new").toUpperCase()}
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-teal-600 dark:text-teal-400">
                            {t("tools", "claimNavigatorDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onMOSHazardMatcherClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🎖️ {t("tools", "mosHazardMatcher")}
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "mosHazardMatcherDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onPACTActNavigatorClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40 bg-white/50 dark:bg-teal-800/30"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            ☢️ {t("tools", "pactActNavigator")}
                            <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded">
                              HOT
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-teal-700 dark:text-teal-400">
                            {t("tools", "pactActNavigatorDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onWebOfConditionsClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🕸️ {t("tools", "webOfConditions")}
                            <span className="px-1.5 py-0.5 bg-teal-500 text-white text-[10px] font-bold rounded">
                              INTERACTIVE
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "webOfConditionsDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onBDDBuilderClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🎖️ BDD Builder
                            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
                              NEW
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            Pre-discharge claims planner for active duty
                          </p>
                        </button>
                      </div>

                      {/* BUILD YOUR EVIDENCE - Violet Theme */}
                      <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-lg p-2 mb-2">
                        <p className="text-xs text-violet-700 dark:text-violet-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
                          <span className="w-2 h-2 bg-violet-500 rounded-full"></span>
                          📋 {t("toolsMenu", "buildYourEvidence")}
                        </p>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onCFileAnalyzerClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40 bg-white/50 dark:bg-violet-800/30"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🔬 {t("tools", "cFileAnalyzer")}
                            <span className="px-1.5 py-0.5 bg-violet-600 text-white text-[10px] font-bold rounded">
                              AI
                            </span>
                            <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded">
                              {t("common", "free").toUpperCase()}
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-violet-600 dark:text-violet-400">
                            {t("tools", "cFileAnalyzerDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onBlueButtonXRayClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            💙 {t("tools", "blueButtonXRay")}
                            <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded">
                              AI
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "blueButtonXRayDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onRecordSearchClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🔍 {t("tools", "recordSearch")}
                            <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded">
                              {t("common", "new").toUpperCase()}
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "recordSearchDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onWitnessBenchClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            👥 {t("tools", "witnessBench")}
                            <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded">
                              AI
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "witnessBenchDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onNexusBuilderClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🔗 {t("tools", "nexusBuilder")}
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "nexusBuilderDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onFormsHelperClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            ✏️ {t("tools", "formsHelper")}
                            <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded">
                              16+
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "formsHelperDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onSymptomLoggerClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            📝 {t("tools", "symptomLogger")}
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "symptomLoggerDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onPainPainterClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🎯 {t("tools", "somaticTarget")}
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "somaticTargetDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onEvidenceTimelineClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🧵 {t("tools", "evidenceTimeline")}
                            <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded">
                              {t("common", "new").toUpperCase()}
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "evidenceTimelineDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onFOIAGeneratorClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🔑 {t("tools", "foiaKeysmith")}
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "foiaKeysmithDesc")}
                          </p>
                        </button>
                      </div>

                      {/* QUALITY CONTROL - Rose Theme */}
                      <div className="bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 rounded-lg p-2 mb-2">
                        <p className="text-xs text-rose-700 dark:text-rose-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
                          <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                          ✅ {t("toolsMenu", "qualityControl")}
                        </p>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onRedTeamClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🔴 {t("tools", "redTeam")}
                            <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded">
                              AI
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "redTeamDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onClaimStressTestClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            ⚔️ {t("tools", "theWarGame")}
                            <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded">
                              AI
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "theWarGameDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onDecisionDecoderClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            📄 {t("tools", "decisionDecoder")}
                            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded">
                              AI
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "decisionDecoderDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onDenialDecoderClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40 bg-white/50 dark:bg-rose-800/30"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🔍 {t("tools", "denialsDecoder")}
                            <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded">
                              AI
                            </span>
                            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded">
                              {t("common", "new").toUpperCase()}
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-rose-600 dark:text-rose-400">
                            {t("tools", "denialsDecoderDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onSharkRadarClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🦈 {t("tools", "sharkRadar")}
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "sharkRadarDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onConsistencyEngineClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🔍 {t("tools", "consistencyEngine")}
                            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded">
                              AI
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "consistencyEngineDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onEvidenceGapVisualizerClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🔗 {t("tools", "evidenceGapFinder")}
                            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded">
                              {t("common", "new").toUpperCase()}
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "evidenceGapFinderDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onRiskAssessmentClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🐻 {t("tools", "riskAssessment")}
                            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded">
                              DEFENSE
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "riskAssessmentDesc")}
                          </p>
                        </button>
                      </div>

                      {/* MAXIMIZE YOUR RATING - Amber Theme */}
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-2 mb-2">
                        <p className="text-xs text-amber-700 dark:text-amber-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
                          <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                          💰 {t("toolsMenu", "maximizeYourRating")}
                        </p>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onTDIUBuilderClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-amber-100 dark:hover:bg-amber-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            💼 {t("tools", "tdiuBuilder")}
                            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
                              100%
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "tdiuBuilderDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onStateBenefitHunterClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-amber-100 dark:hover:bg-amber-800/40 bg-white/50 dark:bg-amber-800/30"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            💵 {t("tools", "stateBenefitHunter")}
                            <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded animate-pulse">
                              $$$
                            </span>
                            <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded">
                              AI
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-amber-600 dark:text-amber-400">
                            {t("tools", "stateBenefitHunterDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onTheTribunalClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-amber-100 dark:hover:bg-amber-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            ⚖️ {t("tools", "theTribunal")}
                            <span className="px-1.5 py-0.5 bg-amber-600 text-white text-[10px] font-bold rounded">
                              VOICE
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "theTribunalDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onLegislativeWatchdogClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-amber-100 dark:hover:bg-amber-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            📡 {t("tools", "legislativeWatchdog")}
                            <span className="px-1.5 py-0.5 bg-amber-600 text-white text-[10px] font-bold rounded animate-pulse">
                              LIVE
                            </span>
                            <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded">
                              AI
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "legislativeWatchdogDesc")}
                          </p>
                        </button>
                      </div>

                      {/* SUPPORT & RESOURCES - Sky Theme */}
                      <div className="bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-lg p-2">
                        <p className="text-xs text-sky-700 dark:text-sky-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
                          <span className="w-2 h-2 bg-sky-500 rounded-full"></span>
                          🤝 {t("toolsMenu", "supportResources")}
                        </p>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onVSOFinderClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-sky-100 dark:hover:bg-sky-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🤝 {t("tools", "vsoFinder")}
                            <span className="px-1.5 py-0.5 bg-sky-600 text-white text-[10px] font-bold rounded">
                              {t("common", "free").toUpperCase()}
                            </span>
                            <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded">
                              AI
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "vsoFinderDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onBackupManagerClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-sky-100 dark:hover:bg-sky-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🏰 {t("tools", "theBunker")}
                            <span className="px-1.5 py-0.5 bg-sky-500 text-white text-[10px] font-bold rounded">
                              {t("common", "new").toUpperCase()}
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "theBunkerDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onCloudSyncClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-sky-100 dark:hover:bg-sky-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            📤 {t("tools", "googleDriveBackup")}
                            <span className="px-1.5 py-0.5 bg-sky-500 text-white text-[10px] font-bold rounded">
                              {t("common", "new").toUpperCase()}
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "googleDriveBackupDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onVaIntegrationDemoClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-sky-100 dark:hover:bg-sky-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            🔗 {t("tools", "vaIntegration")}
                            <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded">
                              DEMO
                            </span>
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("tools", "vaIntegrationDesc")}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setShowToolsMenu(false);
                            onUserManualClick?.();
                          }}
                          className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-sky-100 dark:hover:bg-sky-800/40"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            📖 {t("header", "userManual")}
                          </span>
                          <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                            {t("header", "userManualDesc")}
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Veteran Resources Dropdown */}
              <div className="relative sm:relative">
                <button
                  onClick={() => setShowResourcesMenu(!showResourcesMenu)}
                  onBlur={() =>
                    setTimeout(() => setShowResourcesMenu(false), 200)
                  }
                  className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-1.5 lg:px-2 py-1 text-sm lg:text-base flex items-center gap-1 whitespace-nowrap"
                  aria-label={t("header", "veteranResources")}
                  aria-expanded={showResourcesMenu}
                  aria-haspopup="true"
                >
                  🎖️{" "}
                  <span className="hidden lg:inline">
                    {t("header", "resources")}
                  </span>
                  <svg
                    className={`w-3 h-3 lg:w-4 lg:h-4 transition-transform ${showResourcesMenu ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showResourcesMenu && (
                  <div
                    className={`fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 mt-2 sm:w-72 rounded-lg shadow-xl z-50 overflow-hidden max-h-[70vh] sm:max-h-[80vh] overflow-y-auto ${dropdownClasses.menu.replace("absolute mt-2", "")}`}
                  >
                    <div className="p-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1 font-semibold uppercase tracking-wide">
                        {t("header", "veteranResources")}
                      </p>

                      {/* Official VA Links - TOP OF DROPDOWN */}
                      <a
                        href="https://www.va.gov/disability/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-3 py-2 rounded-md transition-colors bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border-l-4 border-blue-600 mb-1"
                      >
                        <span className="font-medium text-blue-700 dark:text-blue-100 flex items-center gap-2">
                          🏛️ {t("header", "disabilityBenefits")}
                          <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded">
                            VA.GOV
                          </span>
                        </span>
                        <p className="text-xs mt-0.5 text-blue-600 dark:text-blue-400">
                          Official VA disability benefits portal
                        </p>
                      </a>

                      <a
                        href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-3 py-2 rounded-md transition-colors bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border-l-4 border-indigo-600 mb-2"
                      >
                        <span className="font-medium text-indigo-700 dark:text-indigo-100 flex items-center gap-2">
                          ⚖️ {t("header", "ratingSchedule")}
                          <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[9px] font-bold rounded">
                            38 CFR
                          </span>
                        </span>
                        <p className="text-xs mt-0.5 text-indigo-600 dark:text-indigo-400">
                          Official rating criteria & diagnostic codes
                        </p>
                      </a>

                      <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>

                      {/* VA Resources Hub Button */}
                      <button
                        onClick={() => {
                          setShowResourcesMenu(false);
                          onVAResourcesClick();
                        }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border-l-4 border-green-600 mb-2"
                      >
                        <span className="font-medium text-green-700 dark:text-green-100">
                          🌐 {t("header", "vaResourcesHub")}
                        </span>
                        <p className="text-xs mt-0.5 text-green-600 dark:text-green-400">
                          {t("header", "vaResourcesHubDesc")}
                        </p>
                      </button>

                      <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>

                      {veteranResources.map((resource, index) => (
                        <a
                          key={index}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`block px-3 py-2 rounded-md transition-colors ${
                            resource.urgent
                              ? "bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 border-l-4 border-red-500"
                              : resource.highlight
                                ? "bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border-l-4 border-amber-500"
                                : "hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          <span
                            className={`font-medium ${
                              resource.urgent
                                ? "text-red-700 dark:text-red-100"
                                : resource.highlight
                                  ? "text-amber-700 dark:text-amber-100"
                                  : "text-gray-800 dark:text-gray-200"
                            }`}
                          >
                            {resource.name}
                          </span>
                          <p
                            className={`text-xs mt-0.5 ${
                              resource.urgent
                                ? "text-red-600 dark:text-red-400"
                                : resource.highlight
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {resource.description}
                          </p>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* End ROW 2 */}
          </nav>

          {/* Mobile Menu Button - Shows below md (768px) */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-2.5 rounded-lg bg-va-blue/10 dark:bg-gray-700 hover:bg-va-blue/20 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-va-gold flex-shrink-0"
            aria-label="Toggle menu"
            aria-expanded={showMobileMenu}
          >
            {showMobileMenu ? (
              <svg
                className="w-6 h-6"
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
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Lower Header Row - Status badges and quick actions */}
        <div className="hidden md:flex items-center justify-center gap-3 mt-3 pt-3 border-t border-white/20">
          <KnowledgeBaseStatus compact />
          <VersionDropdown />
          <AIStatusBadge showLabel={false} onClick={onAISettingsClick} />

          {/* Divider */}
          <div className="h-6 w-px bg-white/30"></div>

          {/* Helper Mode Toggle (Spouse/Caregiver Mode) */}
          <HelperModeToggle compact />

          {/* Language Selector */}
          <LanguageSelector variant="compact" />

          {/* Accessibility Menu */}
          <AccessibilityMenu />

          {/* Community Roadmap Button */}
          <button
            onClick={onCommunityRoadmapClick}
            className="inline-flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 hover:scale-105 text-white px-2 lg:px-3 py-1.5 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-xs whitespace-nowrap min-w-[70px]"
            aria-label="Community Roadmap"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
            <span>Roadmap</span>
          </button>

          {/* Feature Request Button */}
          <button
            onClick={onFeatureRequestClick}
            className="inline-flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 hover:scale-105 text-white px-2 lg:px-3 py-1.5 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-xs whitespace-nowrap min-w-[70px]"
            aria-label={t("buttons", "featureRequest")}
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <span>{t("header", "ideas")}</span>
          </button>
        </div>

        {/* Mobile Menu Drawer - Full screen overlay */}
        {showMobileMenu && (
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/50"
            onClick={() => setShowMobileMenu(false)}
          >
            <div
              ref={mobileMenuRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-menu-title"
              className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white dark:bg-gray-800 shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile Menu Header */}
              <div className="sticky top-0 bg-gradient-to-r from-va-blue to-blue-700 dark:from-gray-800 dark:to-gray-900 text-white p-4 flex justify-between items-center shadow-md z-10">
                <div>
                  <h2 id="mobile-menu-title" className="text-lg font-bold">
                    Menu
                  </h2>
                  <p className="text-xs text-white/80">39 Pro Tools</p>
                </div>
                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Close menu"
                >
                  <svg
                    className="w-6 h-6"
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

              {/* Mobile Menu Content */}
              <div className="p-4 space-y-2">
                {/* Core Navigation */}
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    onUserManualClick?.();
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <span className="text-xl">❓</span>
                  <span className="font-medium">{t("common", "help")}</span>
                </button>

                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    onWorkflowGuideClick?.();
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <span className="text-xl">🗺️</span>
                  <span className="font-medium">{t("tools", "missions")}</span>
                  <span className="ml-auto px-2 py-0.5 bg-va-gold text-gray-900 text-[10px] font-bold rounded">
                    {t("common", "new").toUpperCase()}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    onMyPacketClick?.();
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <span className="text-xl">📁</span>
                  <span className="font-medium">{t("tools", "myPacket")}</span>
                </button>

                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    onKnowledgeBaseClick?.();
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <span className="text-xl">📚</span>
                  <span className="font-medium">Knowledge Base</span>
                  <span className="ml-auto px-2 py-0.5 bg-va-gold text-gray-900 text-[10px] font-bold rounded">
                    NEW
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    onVKBTimelineClick?.();
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <span className="text-xl">📅</span>
                  <span className="font-medium">Document Timeline</span>
                  <span className="ml-auto px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">
                    v4
                  </span>
                </button>

                {/* Tools Section */}
                <div className="pt-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2">
                    🛠️ {t("common", "tools")}
                  </p>

                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      onTacticalCalculatorClick?.();
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors min-h-[44px]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🧮</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {t("tools", "tacticalCalculator")}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("tools", "tacticalCalculatorDesc")}
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      onMillionDollarDashboardClick?.();
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors min-h-[44px]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💰</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {t("tools", "millionDollarDashboard")}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("tools", "millionDollarDashboardDesc")}
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      onSecondaryScoutClick?.();
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-800/30 transition-colors min-h-[44px]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🔍</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {t("tools", "secondaryScout")}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("tools", "secondaryScoutDesc")}
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      onCAPSimulatorClick?.();
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-800/30 transition-colors min-h-[44px]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">✅</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {t("tools", "capSimulator")}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("tools", "capSimulatorDesc")}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Resources Section */}
                <div className="pt-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2">
                    📚 {t("common", "resources")}
                  </p>

                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      onVAResourcesClick?.();
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
                  >
                    <span className="text-xl">🎖️</span>
                    <span className="font-medium">
                      {t("resources", "vaResources")}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      onBackupManagerClick?.();
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
                  >
                    <span className="text-xl">💾</span>
                    <span className="font-medium">
                      {t("tools", "backupManager")}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      onCloudSyncClick?.();
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
                  >
                    <span className="text-xl">☁️</span>
                    <span className="font-medium">
                      {t("tools", "cloudSync")}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      onAISettingsClick?.();
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
                  >
                    <span className="text-xl">⚙️</span>
                    <span className="font-medium">
                      {t("tools", "aiSettings")}
                    </span>
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 space-y-2 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      onCommunityRoadmapClick?.();
                    }}
                    className="w-full px-4 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold shadow-md flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                      />
                    </svg>
                    Roadmap
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      onFeatureRequestClick?.();
                    }}
                    className="w-full px-4 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-semibold shadow-md flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    {t("header", "ideas")}
                  </button>
                </div>

                {/* Bottom padding for safe area */}
                <div className="h-4"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
