import { useState, useEffect } from "react";
import { Shield, Lock, Sparkles } from "lucide-react";
import { PROJECT_STATS } from "../data/projectStats";
import { getTotalToolCount } from "../data/toolkitData";
import { useLanguage } from "../contexts/LanguageContext";
import BRAND, { getStorageKey } from "../config/branding";
import ResponsiveModal from "./common/ResponsiveModal";

const SplashHeader = ({ t }) => (
  <div className="bg-gradient-to-r from-va-blue to-green-800 dark:from-gray-700 dark:to-gray-800 p-6 text-center">
    <div className="inline-flex items-center justify-center bg-white rounded-full p-1 mb-4 overflow-hidden w-24 h-24">
      <img
        src={BRAND.logo}
        alt={`${BRAND.appName} Logo`}
        className="h-full w-full object-cover rounded-full"
        width={96}
        height={96}
        fetchPriority="high"
        decoding="async"
      />
    </div>
    <h1
      id="splash-title"
      className="text-2xl md:text-3xl font-bold text-white mb-2"
    >
      {t("splash", "welcomeVeteran")} 🎖️
    </h1>
    <p className="text-green-100 text-lg">{t("splash", "yourClaimsToolkit")}</p>
  </div>
);

const SplashFooterButton = ({ t, onAcknowledge }) => (
  <button
    onClick={onAcknowledge}
    className="w-full bg-gradient-to-r from-va-blue to-green-700 hover:from-green-700 hover:to-va-blue text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl text-lg"
  >
    {t("splash", "enterVetRate")}
  </button>
);

const SplashBetaWarning = () => (
  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-400 dark:border-amber-600 rounded-xl p-5 mb-6 shadow-lg">
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <svg
          className="w-6 h-6 text-amber-600 dark:text-amber-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
          Active Development - Beta Tools
          <span className="px-2 py-0.5 bg-amber-700 text-white text-xs font-bold rounded-full">
            BETA
          </span>
        </h3>
        <div className="space-y-2 text-sm text-amber-900 dark:text-amber-100">
          <p className="leading-relaxed">
            &quot;Monty always told me to take care of my guys... and y&apos;all
            are my guys.&quot;
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-3">
            🏗️ Every tool is marked BETA. Expect improvements, updates, and
            occasional rough edges as I build this for us. Your feedback helps
            make it better for everyone.
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-3 italic">
            💻 Thanks to Uncle Norb for sending me a 286 desktop computer when I
            was 12 years old.
          </p>
        </div>
      </div>
    </div>
  </div>
);

const SplashPersonalMessage = ({ t }) => (
  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
    <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
      <span className="font-semibold">{t("splash", "fromOneVeteran")}</span>{" "}
      {t("splash", "personalMessage")} {t("splash", "coveringEverything")} -{" "}
      <strong>
        {PROJECT_STATS.disabilitiesValidated.toLocaleString()}{" "}
        {t("splash", "ratedConditions")}
      </strong>
      , {t("splash", "advancedCalculators")} {t("splash", "allFreeNoTricks")}
    </p>
    <p className="text-blue-600 dark:text-blue-100 text-xs mt-2 italic">
      - {t("splash", "fellowDisabledVeteran")}
    </p>
  </div>
);

const SplashTrustSignals = ({ t }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
    <div className="flex flex-col items-center text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
      <Lock className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
      <span className="text-xs font-medium text-green-800 dark:text-green-200">
        {t("splash", "noLoginRequired")}
      </span>
      <span className="text-xs text-green-600 dark:text-green-400">
        {t("splash", "yourPrivacyMatters")}
      </span>
    </div>
    <div className="flex flex-col items-center text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
      <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
      <span className="text-xs font-medium text-green-800 dark:text-green-200">
        {t("splash", "hundredPercentFree")}
      </span>
      <span className="text-xs text-green-600 dark:text-green-400">
        {t("splash", "noHiddenFees")}
      </span>
    </div>
    <div className="flex flex-col items-center text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
      <Shield className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
      <span className="text-xs font-medium text-green-800 dark:text-green-200">
        {t("splash", "noDataSold")}
      </span>
      <span className="text-xs text-green-600 dark:text-green-400">
        {t("splash", "youAreNotTracked")}
      </span>
    </div>
  </div>
);

const SplashArsenalList = ({ t }) => (
  <div className="mb-6">
    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
      {t("splash", "yourClaimsArsenal")}
    </h2>
    <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm">
      <li className="flex items-start gap-2">
        <span className="text-green-600 font-bold">✓</span>
        <span>
          <strong>
            {PROJECT_STATS.disabilitiesValidated.toLocaleString()}{" "}
            {t("splash", "conditionsWithCriteria")}
          </strong>
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-green-600 font-bold">✓</span>
        <span>
          <strong>{t("splash", "tacticalCalculator")}</strong> -{" "}
          {t("splash", "tacticalCalculatorDesc")}
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-green-600 font-bold">✓</span>
        <span>
          <strong>{t("splash", "secondaryScout")}</strong> -{" "}
          {t("splash", "secondaryScoutDesc")}
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-green-600 font-bold">✓</span>
        <span>
          <strong>{t("splash", "cpExamSimulator")}</strong> -{" "}
          {t("splash", "cpExamSimulatorDesc")}
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-green-600 font-bold">✓</span>
        <span>
          <strong>{t("splash", "cFileAiAnalyzer")}</strong> -{" "}
          {t("splash", "cFileAiAnalyzerDesc")}
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-green-600 font-bold">✓</span>
        <span>
          <strong>{t("splash", "formsHelperEvidence")}</strong> -{" "}
          {t("splash", "formsHelperEvidenceDesc")}
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-green-600 font-bold">✓</span>
        <span>
          <strong>{t("splash", "strategicTools")}</strong> -{" "}
          {t("splash", "strategicToolsDesc")}
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-green-600 font-bold">✓</span>
        <span>
          <strong>{t("splash", "myPacket")}</strong> -{" "}
          {t("splash", "myPacketDesc")}
        </span>
      </li>
    </ul>
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 italic text-center">
      🎖️ {getTotalToolCount()} {t("splash", "professionalToolsFooter")}
    </p>
  </div>
);

const SplashImportantNote = ({ t }) => (
  <>
    <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4 text-sm">
      <p className="text-gray-600 dark:text-gray-300">
        <span className="font-medium">{t("splash", "quickNote")}</span>{" "}
        {t("splash", "notVSOOrLawFirm")}
      </p>
    </div>

    <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
      {t("splash", "thankYouForService")}
    </p>
  </>
);

const SplashBody = ({ t }) => (
  <>
    {/* Beta Development Warning - Personal Message */}
    <SplashBetaWarning />

    {/* Personal Message */}
    <SplashPersonalMessage t={t} />

    {/* Trust Signals */}
    <SplashTrustSignals t={t} />

    {/* What You Can Do Here */}
    <SplashArsenalList t={t} />

    {/* Important Note - Softened */}
    <SplashImportantNote t={t} />
  </>
);

function DisclaimerSplash({ onAcknowledge }) {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    // Check if user has already acknowledged
    const hasAcknowledged = localStorage.getItem(
      getStorageKey("disclaimer-acknowledged"),
    );
    if (!hasAcknowledged) {
      setIsVisible(true);
    } else {
      onAcknowledge?.();
    }
  }, [onAcknowledge]);

  const handleAcknowledge = () => {
    localStorage.setItem(getStorageKey("disclaimer-acknowledged"), "true");
    setIsVisible(false);
    onAcknowledge?.();
  };

  return (
    <ResponsiveModal
      isOpen={isVisible}
      onClose={handleAcknowledge}
      dismissable={false}
      showClose={false}
      zIndex={100}
      size="lg"
      labelledBy="splash-title"
      backdropClassName="bg-gradient-to-br from-va-blue/95 to-green-900/95"
      header={<SplashHeader t={t} />}
      footer={<SplashFooterButton t={t} onAcknowledge={handleAcknowledge} />}
    >
      <SplashBody t={t} />
    </ResponsiveModal>
  );
}

export default DisclaimerSplash;
