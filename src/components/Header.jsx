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

const VETERAN_RESOURCES = [
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

// Resolves which of the 3 visual variants a veteran resource link uses,
// replacing a triple-nested ternary with a single lookup.
function getResourceVariant(resource) {
  if (resource.urgent) return "urgent";
  if (resource.highlight) return "highlight";
  return "default";
}

const RESOURCE_LINK_CLASSES = {
  urgent:
    "bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 border-l-4 border-red-500",
  highlight:
    "bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border-l-4 border-amber-500",
  default: "hover:bg-gray-100 dark:hover:bg-gray-700",
};

const RESOURCE_NAME_CLASSES = {
  urgent: "text-red-700 dark:text-red-100",
  highlight: "text-amber-700 dark:text-amber-100",
  default: "text-gray-800 dark:text-gray-200",
};

const RESOURCE_DESC_CLASSES = {
  urgent: "text-red-600 dark:text-red-400",
  highlight: "text-amber-600 dark:text-amber-400",
  default: "text-gray-500 dark:text-gray-400",
};

// Periodically checks for unsaved changes to drive the (currently unused)
// backup-pulse state; isolated so it doesn't inflate Header's own line count.
function useUnsavedChangesPulse() {
  const [shouldPulseBackup, setShouldPulseBackup] = useState(false);

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

  return shouldPulseBackup;
}

const SkipLink = () => (
  <a href="#main-content" className="skip-link sr-only focus:not-sr-only">
    Skip to main content
  </a>
);

const CrisisLineBanner = () => (
  <div className="bg-red-700 dark:bg-red-900 text-white text-center py-1.5 px-4 text-sm">
    <a
      href="https://www.veteranscrisisline.net/"
      target="_blank"
      rel="noopener noreferrer"
      className="hover:underline font-medium"
    >
      🆘 Veterans Crisis Line: <strong>Call 988, Press 1</strong> | Text 838255
      | Chat online 24/7
    </a>
  </div>
);

const HeaderBrand = ({ t }) => (
  <div className="flex items-center gap-3 md:gap-4">
    <div className="rounded-full h-14 w-14 md:h-16 md:w-16 lg:h-20 lg:w-20 flex-shrink-0 overflow-hidden shadow-md">
      {/* Lowercase "fetchpriority" is intentional -- see the same note on
          the logo <img> in DisclaimerSplash.jsx: react-dom 18.3.1 doesn't
          recognize the camelCase "fetchPriority" DOM prop. */}
      <img
        src="/images/Vet-Rate-org-logo-official.png"
        alt="Vet-Rate.org Logo"
        className="h-full w-full object-cover"
        width={80}
        height={80}
        fetchpriority="high"
        decoding="async"
      />
    </div>
    <div className="flex-shrink-0">
      {/* Site branding, not the page's semantic h1 - each routed page owns
          its own h1 (e.g. HomeMain's "Your VA Claims Command Center"). */}
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">
        Vet-Rate.org
      </h2>
      <p className="text-green-100 dark:text-gray-300 text-xs sm:text-sm md:text-base">
        {t("header", "subtitle")}
      </p>
    </div>
  </div>
);

const QuickActionsRow = ({
  t,
  isDark,
  toggleTheme,
  onLegislativeWatchdogClick,
  onUserManualClick,
  onWorkflowGuideClick,
}) => (
  <div className="flex flex-wrap justify-center gap-2 lg:gap-3 items-center">
    {/* Quick Dark Mode Toggle */}
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-1 focus:ring-va-gold text-[10px] font-medium"
      aria-label={
        isDark ? t("header", "switchToLight") : t("header", "switchToDark")
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
      type="button"
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
      type="button"
      id="tour-help-btn"
      onClick={onUserManualClick}
      className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-1.5 py-0.5 text-sm whitespace-nowrap"
      aria-label={t("common", "help")}
    >
      ❓ <span className="hidden lg:inline">{t("common", "help")}</span>
    </button>

    {/* Missions */}
    <button
      type="button"
      id="tour-workflow-guide-btn"
      onClick={onWorkflowGuideClick}
      className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-1.5 py-0.5 text-sm flex items-center gap-1 whitespace-nowrap"
      aria-label={t("tools", "missions")}
    >
      🗺️ <span className="hidden lg:inline">{t("tools", "missions")}</span>
      <span className="px-1 py-0.5 bg-va-gold text-gray-900 text-[9px] font-bold rounded">
        {t("common", "new").toUpperCase()}
      </span>
    </button>
  </div>
);

const MyPacketButton = ({ t, onMyPacketClick }) => (
  <button
    type="button"
    id="tour-my-packet-btn"
    onClick={onMyPacketClick}
    className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-1.5 lg:px-2 py-1 text-sm lg:text-base whitespace-nowrap"
    aria-label={t("tools", "myPacket")}
  >
    📁 <span className="hidden lg:inline">{t("tools", "myPacket")}</span>
  </button>
);

const ToolsMenuTrigger = ({ t, showToolsMenu, setShowToolsMenu }) => (
  <button
    type="button"
    onClick={() => setShowToolsMenu(!showToolsMenu)}
    className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-1.5 lg:px-2 py-1 text-sm lg:text-base flex items-center gap-1 whitespace-nowrap"
    aria-label={t("common", "tools")}
    aria-expanded={showToolsMenu}
    aria-haspopup="true"
  >
    🛠️ <span className="hidden lg:inline">{t("common", "tools")}</span>
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
);

const CalculateButtonsA = ({
  t,
  setShowToolsMenu,
  onTacticalCalculatorClick,
  onMillionDollarDashboardClick,
  onWhatIfSandboxClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
      type="button"
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
  </>
);

const CalculateButtonsB = ({
  t,
  setShowToolsMenu,
  onRetroPayHunterClick,
  onTimeMachineClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
  </>
);

const CalculateSection = (props) => (
  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-2 mb-2">
    <p className="text-xs text-blue-700 dark:text-blue-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
      📊 {props.t("toolsMenu", "calculateYourRating")}
    </p>
    <CalculateButtonsA {...props} />
    <CalculateButtonsB {...props} />
  </div>
);

const DiscoverButtonsA = ({
  t,
  setShowToolsMenu,
  onSecondaryScoutClick,
  onCAPSimulatorClick,
  onPathfinderClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
      type="button"
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
  </>
);

const DiscoverButtonsB = ({
  t,
  setShowToolsMenu,
  onClaimNavigatorClick,
  onMOSHazardMatcherClick,
  onPACTActNavigatorClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
      type="button"
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
  </>
);

const DiscoverButtonsC = ({
  t,
  setShowToolsMenu,
  onWebOfConditionsClick,
  onBDDBuilderClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
      onClick={() => {
        setShowToolsMenu(false);
        onBDDBuilderClick?.();
      }}
      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40"
    >
      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
        🎖️ {t("tools", "bddBuilder")}
        <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
          NEW
        </span>
      </span>
      <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
        Pre-discharge claims planner for active duty
      </p>
    </button>
  </>
);

const DiscoverSection = (props) => (
  <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 rounded-lg p-2 mb-2">
    <p className="text-xs text-teal-700 dark:text-teal-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
      <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
      🔍 {props.t("toolsMenu", "discoverYourClaims")}
    </p>
    <DiscoverButtonsA {...props} />
    <DiscoverButtonsB {...props} />
    <DiscoverButtonsC {...props} />
  </div>
);

const BuildEvidenceButtonsA = ({
  t,
  setShowToolsMenu,
  onCFileAnalyzerClick,
  onBlueButtonXRayClick,
  onRecordSearchClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
      type="button"
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
  </>
);

const BuildEvidenceButtonsB = ({
  t,
  setShowToolsMenu,
  onWitnessBenchClick,
  onNexusBuilderClick,
  onFormsHelperClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
      type="button"
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
  </>
);

const BuildEvidenceButtonsC = ({
  t,
  setShowToolsMenu,
  onSymptomLoggerClick,
  onPainPainterClick,
  onEvidenceTimelineClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
      type="button"
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
  </>
);

const BuildEvidenceButtonsD = ({
  t,
  setShowToolsMenu,
  onFOIAGeneratorClick,
}) => (
  <button
    type="button"
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
);

const BuildEvidenceSection = (props) => (
  <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-lg p-2 mb-2">
    <p className="text-xs text-violet-700 dark:text-violet-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
      <span className="w-2 h-2 bg-violet-500 rounded-full"></span>
      📋 {props.t("toolsMenu", "buildYourEvidence")}
    </p>
    <BuildEvidenceButtonsA {...props} />
    <BuildEvidenceButtonsB {...props} />
    <BuildEvidenceButtonsC {...props} />
    <BuildEvidenceButtonsD {...props} />
  </div>
);

const QualityControlButtonsA = ({
  t,
  setShowToolsMenu,
  onRedTeamClick,
  onClaimStressTestClick,
  onDecisionDecoderClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
      type="button"
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
  </>
);

const QualityControlButtonsB = ({
  t,
  setShowToolsMenu,
  onDenialDecoderClick,
  onSharkRadarClick,
  onConsistencyEngineClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
      type="button"
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
  </>
);

const QualityControlButtonsC = ({
  t,
  setShowToolsMenu,
  onEvidenceGapVisualizerClick,
  onRiskAssessmentClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
  </>
);

const QualityControlSection = (props) => (
  <div className="bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 rounded-lg p-2 mb-2">
    <p className="text-xs text-rose-700 dark:text-rose-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
      <span className="w-2 h-2 bg-rose-500 rounded-full"></span>✅{" "}
      {props.t("toolsMenu", "qualityControl")}
    </p>
    <QualityControlButtonsA {...props} />
    <QualityControlButtonsB {...props} />
    <QualityControlButtonsC {...props} />
  </div>
);

const MaximizeButtonsA = ({
  t,
  setShowToolsMenu,
  onTDIUBuilderClick,
  onStateBenefitHunterClick,
  onAppealsLaneAdvisorClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
      type="button"
      onClick={() => {
        setShowToolsMenu(false);
        onAppealsLaneAdvisorClick?.();
      }}
      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-amber-100 dark:hover:bg-amber-800/40"
    >
      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
        🧭 {t("tools", "appealsLaneAdvisor")}
        <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
          NEW
        </span>
      </span>
      <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
        {t("tools", "appealsLaneAdvisorDesc")}
      </p>
    </button>
  </>
);

const MaximizeButtonsB = ({
  t,
  setShowToolsMenu,
  onTheTribunalClick,
  onRemandRiskCheckerClick,
  onLegislativeWatchdogClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
      onClick={() => {
        setShowToolsMenu(false);
        onRemandRiskCheckerClick?.();
      }}
      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-amber-100 dark:hover:bg-amber-800/40"
    >
      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
        🛡️ {t("tools", "remandRiskChecker")}
        <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
          NEW
        </span>
      </span>
      <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
        {t("tools", "remandRiskCheckerDesc")}
      </p>
    </button>
    <button
      type="button"
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
  </>
);

const MaximizeSection = (props) => (
  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-2 mb-2">
    <p className="text-xs text-amber-700 dark:text-amber-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
      <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
      💰 {props.t("toolsMenu", "maximizeYourRating")}
    </p>
    <MaximizeButtonsA {...props} />
    <MaximizeButtonsB {...props} />
  </div>
);

const SupportResourcesButtonsA = ({
  t,
  setShowToolsMenu,
  onVSOFinderClick,
  onBackupManagerClick,
  onCloudSyncClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
      type="button"
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
  </>
);

const SupportResourcesButtonsB = ({
  t,
  setShowToolsMenu,
  onVaIntegrationDemoClick,
  onKnowledgeBaseClick,
  onUserManualClick,
}) => (
  <>
    <button
      type="button"
      onClick={() => {
        setShowToolsMenu(false);
        onKnowledgeBaseClick?.();
      }}
      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-sky-100 dark:hover:bg-sky-800/40"
    >
      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
        📚 {t("tools", "knowledgeBase")}
        <span className="px-1.5 py-0.5 bg-sky-500 text-white text-[10px] font-bold rounded">
          {t("common", "new").toUpperCase()}
        </span>
      </span>
      <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
        {t("tools", "knowledgeBaseDesc")}
      </p>
    </button>
    <button
      type="button"
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
      type="button"
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
  </>
);

const SupportResourcesSection = (props) => (
  <div className="bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-lg p-2">
    <p className="text-xs text-sky-700 dark:text-sky-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
      <span className="w-2 h-2 bg-sky-500 rounded-full"></span>
      🤝 {props.t("toolsMenu", "supportResources")}
    </p>
    <SupportResourcesButtonsA {...props} />
    <SupportResourcesButtonsB {...props} />
  </div>
);

const ToolsMenuPanel = (props) => (
  <div
    className={`fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 mt-2 sm:w-96 rounded-lg shadow-xl z-50 overflow-hidden max-h-[80vh] overflow-y-auto ${props.dropdownClasses.menu.replace("absolute mt-2", "")}`}
  >
    <div className="p-2">
      <CalculateSection {...props} />
      <DiscoverSection {...props} />
      <BuildEvidenceSection {...props} />
      <QualityControlSection {...props} />
      <MaximizeSection {...props} />
      <SupportResourcesSection {...props} />
    </div>
  </div>
);

const ToolsDropdown = (props) => (
  <div /* eslint-disable-line jsx-a11y/no-static-element-interactions -- onBlur only closes the disclosure menu when focus leaves it; the div itself isn't interactive */
    id="tour-tools-dropdown"
    className="relative sm:relative"
    onBlur={(e) => {
      // B-H05: close only when focus actually leaves the menu (button
      // or items), not on a blind timer that can race keyboard focus
      // landing inside the menu on slow/stressed devices.
      if (!e.currentTarget.contains(e.relatedTarget))
        props.setShowToolsMenu(false);
    }}
  >
    <ToolsMenuTrigger {...props} />

    {props.showToolsMenu && <ToolsMenuPanel {...props} />}
  </div>
);

const OfficialVaLinks = ({ t }) => (
  <>
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
  </>
);

const VaResourcesHubButton = ({
  t,
  setShowResourcesMenu,
  onVAResourcesClick,
}) => (
  <button
    type="button"
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
);

const VeteranResourceLink = ({ resource }) => {
  const variant = getResourceVariant(resource);

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block px-3 py-2 rounded-md transition-colors ${RESOURCE_LINK_CLASSES[variant]}`}
    >
      <span className={`font-medium ${RESOURCE_NAME_CLASSES[variant]}`}>
        {resource.name}
      </span>
      <p className={`text-xs mt-0.5 ${RESOURCE_DESC_CLASSES[variant]}`}>
        {resource.description}
      </p>
    </a>
  );
};

const ResourcesMenuPanel = (props) => (
  <div
    className={`fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 mt-2 sm:w-72 rounded-lg shadow-xl z-50 overflow-hidden max-h-[70vh] sm:max-h-[80vh] overflow-y-auto ${props.dropdownClasses.menu.replace("absolute mt-2", "")}`}
  >
    <div className="p-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1 font-semibold uppercase tracking-wide">
        {props.t("header", "veteranResources")}
      </p>

      <OfficialVaLinks t={props.t} />

      <VaResourcesHubButton
        t={props.t}
        setShowResourcesMenu={props.setShowResourcesMenu}
        onVAResourcesClick={props.onVAResourcesClick}
      />

      <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>

      {VETERAN_RESOURCES.map((resource, index) => (
        <VeteranResourceLink key={index} resource={resource} />
      ))}
    </div>
  </div>
);

const ResourcesMenuTrigger = ({
  t,
  showResourcesMenu,
  setShowResourcesMenu,
}) => (
  <button
    type="button"
    onClick={() => setShowResourcesMenu(!showResourcesMenu)}
    className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-1.5 lg:px-2 py-1 text-sm lg:text-base flex items-center gap-1 whitespace-nowrap"
    aria-label={t("header", "veteranResources")}
    aria-expanded={showResourcesMenu}
    aria-haspopup="true"
  >
    🎖️ <span className="hidden lg:inline">{t("header", "resources")}</span>
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
);

const ResourcesDropdown = (props) => (
  <div /* eslint-disable-line jsx-a11y/no-static-element-interactions -- onBlur only closes the disclosure menu when focus leaves it; the div itself isn't interactive */
    className="relative sm:relative"
    onBlur={(e) => {
      // B-H05: close only when focus actually leaves the menu, not on
      // a blind timer that can race keyboard focus landing inside.
      if (!e.currentTarget.contains(e.relatedTarget))
        props.setShowResourcesMenu(false);
    }}
  >
    <ResourcesMenuTrigger {...props} />

    {props.showResourcesMenu && <ResourcesMenuPanel {...props} />}
  </div>
);

const MainNavRow = (props) => (
  <div className="flex flex-wrap justify-center gap-2 lg:gap-3 items-center">
    {/* My Packet */}
    <MyPacketButton {...props} />

    {/* Tools Dropdown - Main feature tools */}
    <ToolsDropdown {...props} />

    {/* Veteran Resources Dropdown */}
    <ResourcesDropdown {...props} />
  </div>
);

const DesktopNav = (props) => (
  <nav
    className="hidden md:flex flex-col gap-1 items-center"
    role="navigation"
    aria-label="Main navigation"
  >
    {/* ROW 1: Quick actions */}
    <QuickActionsRow {...props} />

    {/* ROW 2: Main nav items */}
    <MainNavRow {...props} />
  </nav>
);

const MobileMenuButton = ({ showMobileMenu, setShowMobileMenu }) => (
  <button
    type="button"
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
);

const LowerHeaderRow = ({
  t,
  onAISettingsClick,
  onCommunityRoadmapClick,
  onFeatureRequestClick,
}) => (
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
      type="button"
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
      type="button"
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
);

const MobileMenuHeader = ({ setShowMobileMenu }) => (
  <div className="sticky top-0 bg-gradient-to-r from-va-blue to-blue-700 dark:from-gray-800 dark:to-gray-900 text-white p-4 flex justify-between items-center shadow-md z-10">
    <div>
      <h2 id="mobile-menu-title" className="text-lg font-bold">
        Menu
      </h2>
      <p className="text-xs text-white/80">39 Pro Tools</p>
    </div>
    <button
      type="button"
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
);

const MobileMenuCoreNav = ({
  t,
  setShowMobileMenu,
  onUserManualClick,
  onWorkflowGuideClick,
  onMyPacketClick,
  onKnowledgeBaseClick,
  onVKBTimelineClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
      type="button"
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
      type="button"
      onClick={() => {
        setShowMobileMenu(false);
        onKnowledgeBaseClick?.();
      }}
      className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
    >
      <span className="text-xl">📚</span>
      <span className="font-medium">{t("tools", "knowledgeBase")}</span>
      <span className="ml-auto px-2 py-0.5 bg-va-gold text-gray-900 text-[10px] font-bold rounded">
        NEW
      </span>
    </button>

    <button
      type="button"
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
  </>
);

const MobileMenuToolsButtonsA = ({
  t,
  setShowMobileMenu,
  onTacticalCalculatorClick,
  onMillionDollarDashboardClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
  </>
);

const MobileMenuToolsButtonsB = ({
  t,
  setShowMobileMenu,
  onSecondaryScoutClick,
  onCAPSimulatorClick,
}) => (
  <>
    <button
      type="button"
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
      type="button"
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
  </>
);

const MobileMenuToolsSection = (props) => (
  <div className="pt-4">
    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2">
      🛠️ {props.t("common", "tools")}
    </p>

    <MobileMenuToolsButtonsA {...props} />
    <MobileMenuToolsButtonsB {...props} />
  </div>
);

const MobileMenuResourcesSection = ({
  t,
  setShowMobileMenu,
  onVAResourcesClick,
  onBackupManagerClick,
  onCloudSyncClick,
  onAISettingsClick,
}) => (
  <div className="pt-4">
    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2">
      📚 {t("common", "resources")}
    </p>

    <button
      type="button"
      onClick={() => {
        setShowMobileMenu(false);
        onVAResourcesClick?.();
      }}
      className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
    >
      <span className="text-xl">🎖️</span>
      <span className="font-medium">{t("resources", "vaResources")}</span>
    </button>

    <button
      type="button"
      onClick={() => {
        setShowMobileMenu(false);
        onBackupManagerClick?.();
      }}
      className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
    >
      <span className="text-xl">💾</span>
      <span className="font-medium">{t("tools", "backupManager")}</span>
    </button>

    <button
      type="button"
      onClick={() => {
        setShowMobileMenu(false);
        onCloudSyncClick?.();
      }}
      className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
    >
      <span className="text-xl">☁️</span>
      <span className="font-medium">{t("tools", "cloudSync")}</span>
    </button>

    <button
      type="button"
      onClick={() => {
        setShowMobileMenu(false);
        onAISettingsClick?.();
      }}
      className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3 min-h-[44px]"
    >
      <span className="text-xl">⚙️</span>
      <span className="font-medium">{t("tools", "aiSettings")}</span>
    </button>
  </div>
);

const MobileMenuActionButtons = ({
  t,
  setShowMobileMenu,
  onCommunityRoadmapClick,
  onFeatureRequestClick,
}) => (
  <div className="pt-4 space-y-2 border-t border-gray-200 dark:border-gray-700">
    <button
      type="button"
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
      type="button"
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
);

const MobileMenuDrawer = (props) => {
  if (!props.showMobileMenu) return null;

  return (
    <div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
      className="md:hidden fixed inset-0 z-50 bg-black/50"
      onClick={() => props.setShowMobileMenu(false)}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={props.mobileMenuRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-menu-title"
        className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white dark:bg-gray-800 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <MobileMenuHeader setShowMobileMenu={props.setShowMobileMenu} />

        <div className="p-4 space-y-2">
          <MobileMenuCoreNav {...props} />
          <MobileMenuToolsSection {...props} />
          <MobileMenuResourcesSection {...props} />
          <MobileMenuActionButtons {...props} />

          {/* Bottom padding for safe area */}
          <div className="h-4"></div>
        </div>
      </div>
    </div>
  );
};

function Header(props) {
  const { isDark, toggleTheme } = useTheme();
  const { _isHelperMode } = useHelperMode();
  const { getDropdownClasses, _getColorClass, _colors } = useColorSchemas();
  const { t, _language } = useLanguage(); // Include language to force re-render on change
  const dropdownClasses = getDropdownClasses();

  const [showResourcesMenu, setShowResourcesMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
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

  useUnsavedChangesPulse();

  return (
    <header className="bg-va-blue text-white shadow-lg" role="banner">
      {/* Skip Link for Screen Readers */}
      <SkipLink />

      {/* Crisis Line Banner - Always Visible */}
      <CrisisLineBanner />

      <div className="container mx-auto px-4 py-4 md:py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-center items-center gap-3 md:gap-6">
          <HeaderBrand t={t} />

          {/* Desktop Navigation - Hidden on mobile - DOUBLE STACKED */}
          <DesktopNav
            {...props}
            t={t}
            isDark={isDark}
            toggleTheme={toggleTheme}
            dropdownClasses={dropdownClasses}
            showToolsMenu={showToolsMenu}
            setShowToolsMenu={setShowToolsMenu}
            showResourcesMenu={showResourcesMenu}
            setShowResourcesMenu={setShowResourcesMenu}
          />

          {/* Mobile Menu Button - Shows below md (768px) */}
          <MobileMenuButton
            showMobileMenu={showMobileMenu}
            setShowMobileMenu={setShowMobileMenu}
          />
        </div>

        {/* Lower Header Row - Status badges and quick actions */}
        <LowerHeaderRow {...props} t={t} />

        {/* Mobile Menu Drawer - Full screen overlay */}
        <MobileMenuDrawer
          {...props}
          t={t}
          showMobileMenu={showMobileMenu}
          setShowMobileMenu={setShowMobileMenu}
          mobileMenuRef={mobileMenuRef}
        />
      </div>
    </header>
  );
}

export default Header;
