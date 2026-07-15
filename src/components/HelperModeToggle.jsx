import { useState } from "react";
import { useHelperMode, TERMINOLOGY } from "../contexts/HelperModeContext";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";

/**
 * HelperModeToggle Component - "I Am Helping a Veteran"
 *
 * A prominent toggle that switches the entire app into Helper/Spouse/Caregiver mode.
 * When enabled:
 * - Military/VA jargon is replaced with plain English
 * - Tooltips explain acronyms
 * - Caregiver-relevant tools are highlighted
 */

const HelperModeToggle = ({ compact = false }) => {
  const { _t } = useLanguage();
  const {
    isHelperMode,
    toggleHelperMode,
    showHelperTooltips,
    setShowHelperTooltips,
  } = useHelperMode();
  const [showInfo, setShowInfo] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);

  // Handle button click - show explainer if first time
  const handleToggleClick = () => {
    const hasSeenExplainer = localStorage.getItem(
      "vetrate-helper-explainer-seen",
    );

    if (!hasSeenExplainer && !isHelperMode) {
      // First time clicking - show explainer
      setShowExplainer(true);
    } else {
      // Already seen or turning off - just toggle
      toggleHelperMode();
    }
  };

  // Handle confirming after reading explainer
  const handleConfirmExplainer = () => {
    localStorage.setItem("vetrate-helper-explainer-seen", "true");
    setShowExplainer(false);
    toggleHelperMode();
  };

  // Handle dismissing explainer without enabling
  const handleDismissExplainer = () => {
    localStorage.setItem("vetrate-helper-explainer-seen", "true");
    setShowExplainer(false);
  };

  if (compact) {
    // Compact version for header - more prominent with gradient and clear purpose
    return (
      <CompactToggle
        isHelperMode={isHelperMode}
        onToggleClick={handleToggleClick}
        showExplainer={showExplainer}
        onConfirmExplainer={handleConfirmExplainer}
        onDismissExplainer={handleDismissExplainer}
      />
    );
  }

  // Full version for settings or standalone
  return (
    <FullModeToggle
      isHelperMode={isHelperMode}
      onToggleClick={handleToggleClick}
      showInfo={showInfo}
      setShowInfo={setShowInfo}
      showHelperTooltips={showHelperTooltips}
      setShowHelperTooltips={setShowHelperTooltips}
      showExplainer={showExplainer}
      onConfirmExplainer={handleConfirmExplainer}
      onDismissExplainer={handleDismissExplainer}
    />
  );
};

/**
 * CompactToggle - Header pill button variant of the Helper Mode toggle
 */
function CompactToggle({
  isHelperMode,
  onToggleClick,
  showExplainer,
  onConfirmExplainer,
  onDismissExplainer,
}) {
  return (
    <>
      <button
        onClick={onToggleClick}
        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 shadow-md hover:shadow-lg group ${
          isHelperMode
            ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white border border-pink-300"
            : "bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-900/50 dark:to-rose-900/50 text-pink-700 dark:text-pink-300 border border-pink-300/50 dark:border-pink-600/50 hover:from-pink-200 hover:to-rose-200 dark:hover:from-pink-800/60 dark:hover:to-rose-800/60"
        }`}
        aria-label={
          isHelperMode
            ? "Helper Mode Active - Jargon translated to plain English"
            : "I'm helping a veteran - Click for simplified language"
        }
      >
        <span className="text-lg">{isHelperMode ? "💝" : "🤝"}</span>
        <span className="hidden sm:inline">
          {isHelperMode ? "Helper ON" : "Helping"}
        </span>
        {!isHelperMode && (
          <span className="hidden lg:inline text-[10px] px-1 py-0.5 bg-pink-600 text-white rounded font-bold group-hover:animate-pulse">
            Caregiver?
          </span>
        )}
      </button>

      {/* Explainer Modal */}
      {showExplainer && (
        <ExplainerModal
          onConfirm={onConfirmExplainer}
          onDismiss={onDismissExplainer}
        />
      )}
    </>
  );
}

/**
 * FullModeToggle - Full card variant of the Helper Mode toggle, used in
 * settings or as a standalone panel
 */
function FullModeToggle({
  isHelperMode,
  onToggleClick,
  showInfo,
  setShowInfo,
  showHelperTooltips,
  setShowHelperTooltips,
  showExplainer,
  onConfirmExplainer,
  onDismissExplainer,
}) {
  return (
    <>
      <div className="bg-gradient-to-r from-pink-50 via-rose-50 to-purple-50 dark:from-pink-900/30 dark:via-rose-900/30 dark:to-purple-900/30 border border-pink-200 dark:border-pink-700 rounded-xl p-4">
        <div className="flex items-start gap-4">
          <HelperModeIcon isHelperMode={isHelperMode} />

          <div className="flex-1">
            <HelperModeHeader
              isHelperMode={isHelperMode}
              onToggleClick={onToggleClick}
            />

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              <strong>&quot;I am helping a Veteran.&quot;</strong> Enable this
              mode to simplify military/VA jargon into plain English. Perfect
              for spouses, family members, or caregivers navigating the claims
              process.
            </p>

            {/* Info toggle */}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="text-sm text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1"
            >
              <span>{showInfo ? "▼" : "▶"}</span>
              What changes in Helper Mode?
            </button>

            {showInfo && (
              <HelperModeInfoPanel
                showHelperTooltips={showHelperTooltips}
                setShowHelperTooltips={setShowHelperTooltips}
              />
            )}
          </div>
        </div>

        {/* Active indicator banner */}
        {isHelperMode && <HelperModeActiveBanner />}
      </div>

      {/* Explainer Modal */}
      {showExplainer && (
        <ExplainerModal
          onConfirm={onConfirmExplainer}
          onDismiss={onDismissExplainer}
        />
      )}
    </>
  );
}

/**
 * HelperModeIcon - Icon badge showing current Helper Mode state
 */
function HelperModeIcon({ isHelperMode }) {
  return (
    <div className="flex-shrink-0">
      <div
        className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
          isHelperMode
            ? "bg-pink-500 text-white"
            : "bg-white dark:bg-gray-800 border-2 border-pink-200 dark:border-pink-700"
        }`}
      >
        <span className="text-2xl">{isHelperMode ? "💝" : "🤝"}</span>
      </div>
    </div>
  );
}

/**
 * HelperModeHeader - Title row with the Helper Mode toggle switch
 */
function HelperModeHeader({ isHelperMode, onToggleClick }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
        Helper Mode
        <span className="px-2 py-0.5 bg-pink-500 text-white text-xs font-bold rounded-full">
          FOR CAREGIVERS
        </span>
      </h3>

      {/* Toggle Switch */}
      <button
        onClick={onToggleClick}
        className={`relative w-14 h-7 rounded-full transition-colors ${
          isHelperMode ? "bg-pink-500" : "bg-gray-300 dark:bg-gray-600"
        }`}
        role="switch"
        aria-checked={isHelperMode}
        aria-label={
          isHelperMode ? "Turn off Helper Mode" : "Turn on Helper Mode"
        }
      >
        <span
          className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
            isHelperMode ? "translate-x-8" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

/**
 * HelperModeInfoPanel - Expanded "What changes in Helper Mode?" panel
 */
function HelperModeInfoPanel({ showHelperTooltips, setShowHelperTooltips }) {
  return (
    <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg space-y-3">
      {/* Example translations */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          📝 Term Simplifications (examples):
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {Object.entries(TERMINOLOGY)
            .slice(0, 6)
            .map(([term, info]) => (
              <div key={term} className="flex items-center gap-2">
                <span className="text-gray-400 dark:text-gray-500 line-through">
                  {term}
                </span>
                <span className="text-gray-400">→</span>
                <span className="text-pink-600 dark:text-pink-400 font-medium">
                  {info.simple}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Highlighted tools */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          ⭐ Highlighted Tools for Caregivers:
        </p>
        <div className="flex flex-wrap gap-1">
          {[
            "Witness Bench",
            "State Benefit Hunter",
            "Symptom Logger",
            "Forms Helper",
            "VSO Finder",
          ].map((tool) => (
            <span
              key={tool}
              className="px-2 py-0.5 bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 text-xs rounded-full"
            >
              {tool}
            </span>
          ))}
        </div>
      </div>

      {/* Tooltips toggle */}
      <div className="flex items-center justify-between pt-2 border-t dark:border-gray-700">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Show explanatory tooltips on hover
        </span>
        <button
          onClick={() => setShowHelperTooltips(!showHelperTooltips)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            showHelperTooltips ? "bg-pink-500" : "bg-gray-300 dark:bg-gray-600"
          }`}
          role="switch"
          aria-checked={showHelperTooltips}
          aria-label="Show explanatory tooltips on hover"
        >
          <span
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${
              showHelperTooltips ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

/**
 * HelperModeActiveBanner - Confirmation banner shown while Helper Mode is on
 */
function HelperModeActiveBanner() {
  return (
    <div className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-lg text-center">
      <p className="text-sm font-medium">
        ✨ Helper Mode Active - Simplified language is now being used throughout
        the app
      </p>
    </div>
  );
}

/**
 * ExplainerModal - First-time explanation of Helper Mode
 */
const ExplainerModal = ({ onConfirm, onDismiss }) => {
  const footer = (
    <ExplainerFooter onDismiss={onDismiss} onConfirm={onConfirm} />
  );

  return (
    <ResponsiveModal
      isOpen
      onClose={onDismiss}
      size="lg"
      zIndex={9999}
      labelledBy="helper-explainer-title"
      footer={footer}
      header={<ExplainerHeaderBanner />}
    >
      <div className="space-y-6">
        <ExplainerWhoSection />
        <ExplainerChangesSection />
        <ExplainerPrivacySection />

        {/* Dismissal note */}
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          This message will only appear once. You can enable Helper Mode anytime
          from the header.
        </p>
      </div>
    </ResponsiveModal>
  );
};

/**
 * ExplainerFooter - Confirm / dismiss actions for the explainer modal
 */
function ExplainerFooter({ onDismiss, onConfirm }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        onClick={onDismiss}
        className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold transition-colors"
      >
        Not Right Now
      </button>
      <button
        onClick={onConfirm}
        className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
      >
        ✨ Enable Helper Mode
      </button>
    </div>
  );
}

/**
 * ExplainerHeaderBanner - Gradient header banner for the explainer modal
 */
function ExplainerHeaderBanner() {
  return (
    <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 p-6 text-white">
      <div className="flex items-center gap-3">
        <span className="text-4xl">💝</span>
        <div>
          <h2 id="helper-explainer-title" className="text-2xl font-bold">
            Helper Mode
          </h2>
          <p className="text-pink-100 text-sm">
            For Spouses, Family Members & Caregivers
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * ExplainerWhoSection - "Who Is This For?" explainer section
 */
function ExplainerWhoSection() {
  return (
    <div className="bg-pink-50 dark:bg-pink-900/20 border-2 border-pink-200 dark:border-pink-700 rounded-xl p-4">
      <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
        <span>👥</span> Who Is This For?
      </h3>
      <p className="text-gray-700 dark:text-gray-300">
        <strong>&quot;I am helping a Veteran.&quot;</strong> Many veterans rely
        on spouses, adult children, or caregivers to help navigate the VA claims
        process. This mode makes the site easier for non-veterans to use.
      </p>
    </div>
  );
}

/**
 * ExplainerChangesSection - "What Changes When Enabled" explainer section
 */
function ExplainerChangesSection() {
  return (
    <div>
      <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
        <span>✨</span> What Changes When Enabled:
      </h3>
      <div className="space-y-3">
        <LanguageSimplificationFeature />
        <TooltipsFeature />
        <CaregiverToolsFeature />
      </div>
    </div>
  );
}

/**
 * LanguageSimplificationFeature - Feature 1: Simplified Language
 */
function LanguageSimplificationFeature() {
  return (
    <div className="flex items-start gap-3">
      <span className="text-2xl flex-shrink-0">📝</span>
      <div>
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
          Simplified Language
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Military/VA jargon is translated into plain English:
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 line-through">C&P Exam</span>
            <span className="text-gray-400">→</span>
            <span className="text-pink-600 dark:text-pink-400 font-medium">
              Disability Evaluation Exam
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 line-through">Nexus Letter</span>
            <span className="text-gray-400">→</span>
            <span className="text-pink-600 dark:text-pink-400 font-medium">
              Medical Connection Letter
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 line-through">VSO</span>
            <span className="text-gray-400">→</span>
            <span className="text-pink-600 dark:text-pink-400 font-medium">
              Free Claims Helper
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TooltipsFeature - Feature 2: Helpful Tooltips
 */
function TooltipsFeature() {
  return (
    <div className="flex items-start gap-3">
      <span className="text-2xl flex-shrink-0">💡</span>
      <div>
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
          Helpful Tooltips
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Hover over terms to see explanations of military acronyms and VA
          terminology.
        </p>
      </div>
    </div>
  );
}

/**
 * CaregiverToolsFeature - Feature 3: Caregiver-Relevant Tools Highlighted
 */
function CaregiverToolsFeature() {
  return (
    <div className="flex items-start gap-3">
      <span className="text-2xl flex-shrink-0">⭐</span>
      <div>
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
          Caregiver-Relevant Tools Highlighted
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Priority tools for helpers:
        </p>
        <div className="flex flex-wrap gap-1">
          {[
            "Witness Bench",
            "State Benefit Hunter",
            "Symptom Logger",
            "Forms Helper",
            "VSO Finder",
          ].map((tool) => (
            <span
              key={tool}
              className="px-2 py-1 bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 text-xs rounded-full font-medium"
            >
              {tool}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * ExplainerPrivacySection - "100% Private" explainer section
 */
function ExplainerPrivacySection() {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">🔒</span>
        <h3 className="font-bold text-gray-900 dark:text-gray-100">
          100% Private
        </h3>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        This preference is saved in your browser only. No data is sent to any
        server. You can turn it on/off anytime.
      </p>
    </div>
  );
}

/**
 * HelperTooltip - Wrap terms to show tooltips in Helper Mode
 */
export const HelperTooltip = ({ term, children }) => {
  const { isHelperMode, showHelperTooltips, getTerm, getTooltip } =
    useHelperMode();
  const [showTooltip, setShowTooltip] = useState(false);

  const tooltip = getTooltip(term);
  const displayTerm = isHelperMode ? getTerm(term) : term;

  if (!isHelperMode || !showHelperTooltips || !tooltip) {
    return <>{children || displayTerm}</>;
  }

  const handleTooltipKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setShowTooltip((prev) => !prev);
    }
  };

  return (
    <span
      className="relative inline-block"
      role="button"
      tabIndex={0}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      onKeyDown={handleTooltipKeyDown}
    >
      <span className="border-b border-dotted border-pink-400 cursor-help">
        {children || displayTerm}
      </span>
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg">
          {tooltip}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
};

/**
 * Smart Term - Automatically translates terms in Helper Mode
 */
export const SmartTerm = ({ term }) => {
  const { getTerm } = useHelperMode();
  return <HelperTooltip term={term}>{getTerm(term)}</HelperTooltip>;
};

export default HelperModeToggle;
