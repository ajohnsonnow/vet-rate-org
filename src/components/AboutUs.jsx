import { useState, useRef, useEffect } from "react";
import ReportBugLink from "./ReportBugLink";
import { useBodyScrollLock } from "../utils/useBodyScrollLock";
import useFocusTrap from "../hooks/useFocusTrap";
import {
  PROJECT_STATS,
  FORMATTED_STATS,
  formatNumber,
} from "../data/projectStats";
import { TOOLKIT_CATEGORIES, getTotalToolCount } from "../data/toolkitData";
import { useColorSchemas } from "../hooks/useColorSchemas";
import {
  ChevronUp,
  Sparkles,
  Wrench,
  Shield,
  Zap,
  CheckCircle,
  Rocket,
} from "lucide-react";
import { generateWhatsNewChangelog } from "../utils/changelogGenerator";
import { useLanguage } from "../contexts/LanguageContext";

// Version DropUp Component - Opens upward for footer placement
const VersionDropUp = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [changelogData, setChangelogData] = useState(null);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const data = generateWhatsNewChangelog();
    setChangelogData(data);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    // ESC closes the disclosure and returns focus to its trigger (APG
    // disclosure pattern — informational popup, not a menu/dialog, so no trap).
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const getIcon = (type, isNew) => {
    if (isNew) return <Rocket className="w-4 h-4 text-emerald-500" />;
    switch (type) {
      case "feature":
        return (
          <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />
        );
      case "fix":
        return <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case "security":
        return <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case "improvement":
        return <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
      default:
        return (
          <CheckCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        );
    }
  };

  const getTypeBadgeColor = (type, isNew) => {
    if (isNew)
      return "bg-gradient-to-r from-emerald-500 to-green-500 text-white";
    const colors = {
      feature:
        "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
      fix: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
      security: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
      improvement:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
    };
    return (
      colors[type] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
    );
  };

  const getTypeLabel = (type, isNew) => {
    if (isNew) return "🆕 NEW";
    const labels = {
      feature: "Feature",
      fix: "Bug Fix",
      security: "Security",
      improvement: "Improvement",
      change: "Change",
    };
    return labels[type] || "Update";
  };

  if (!changelogData) {
    return (
      <button
        className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 text-xs rounded border border-emerald-500/40 transition-colors"
        aria-label="Loading version information..."
      >
        v1.0.0
      </button>
    );
  }

  const { version, changelog } = changelogData;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 text-xs rounded border border-emerald-500/40 transition-colors flex items-center gap-1"
        aria-label="View version changelog"
        aria-expanded={isOpen}
      >
        v{version}
        <ChevronUp
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-[100] max-h-[400px] overflow-y-auto">
          {/* Footer - at top since it's flipped */}
          <div className="border-b border-gray-200 dark:border-gray-700 p-3 text-center bg-gray-50 dark:bg-gray-900 rounded-t-lg sticky top-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              © 2024-2026 Anthony Johnson
            </p>
          </div>

          {/* Changelog Items */}
          <div className="p-3 space-y-3">
            {changelog.map((item, index) => (
              <div
                key={index}
                className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 py-1"
              >
                <div className="flex items-start gap-2 mb-1">
                  {getIcon(item.type, item.isNew)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeBadgeColor(item.type, item.isNew)}`}
                      >
                        {getTypeLabel(item.type, item.isNew)}
                      </span>
                      {item.category && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-0.5">
                      {item.title}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Header - at bottom since it's flipped */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 rounded-b-lg sticky bottom-0">
            <h3 className="font-bold text-lg">What&apos;s New</h3>
            <p className="text-emerald-100 text-xs">Version {version}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const AboutUs = ({ onClose, onReportBug }) => {
  // Lock body scroll when modal is open
  useBodyScrollLock(true);

  // Trap focus inside the dialog, close on ESC, restore focus on teardown.
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, { active: true, onEscape: onClose });

  // Get color schemas
  const { getModalClasses, getColorClass, colors } = useColorSchemas();
  const modalClasses = getModalClasses();

  // Get translation function
  const { t } = useLanguage();

  // Easter egg state
  const [showZonkMessage, setShowZonkMessage] = useState(false);

  const handleZonk = () => {
    setShowZonkMessage(true);
    // Note: Audio removed due to CSP restrictions (data URIs not allowed in media-src)
    // Easter egg message shows visual feedback instead
    setTimeout(() => setShowZonkMessage(false), 3000);
  };

  return (
    <div
      ref={dialogRef}
      className={modalClasses.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-us-title"
    >
      <div className={`${modalClasses.content} max-w-4xl my-8`}>
        <div
          className={`sticky top-0 border-b px-6 py-4 flex justify-between items-center rounded-t-lg z-10 ${getColorClass(colors.base.modal)} ${getColorClass(colors.border.default)}`}
        >
          <h2
            id="about-us-title"
            className={`text-2xl font-bold ${getColorClass(colors.text.primary)}`}
          >
            ℹ️ {t("about", "aboutVetRate")}
          </h2>
          <div className="flex items-center gap-3">
            {onReportBug && (
              <ReportBugLink
                onClick={onReportBug}
                variant="dark"
                moduleName="About Us"
              />
            )}
            <button
              onClick={onClose}
              className={`h-11 w-11 flex items-center justify-center rounded text-3xl font-bold leading-none ${getColorClass(colors.text.tertiary)} hover:${getColorClass(colors.text.secondary)}`}
              aria-label="Close About Us"
            >
              ×
            </button>
          </div>
        </div>

        <div
          className="overflow-y-auto overflow-x-hidden px-6 py-6"
          style={{ maxHeight: "calc(100vh - 240px)" }}
        >
          {/* THE VET-RATE PROMISE - Trust Beacon */}
          <section className="mb-8 bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-900 dark:to-gray-950 rounded-xl p-6 border-2 border-va-gold/30">
            <div className="text-center mb-4">
              <h3 className="text-2xl font-bold text-va-gold mb-2">
                🎖️ {t("about", "theVetRatePromise")}
              </h3>
              <div className="w-20 h-1 bg-va-gold mx-auto rounded"></div>
            </div>

            <div className="font-mono text-gray-300 space-y-4 text-sm leading-relaxed">
              <p className="text-center text-lg text-white font-semibold">
                &quot;{t("about", "builtByVeteranForVeterans")}&quot;
              </p>

              <p>{t("about", "promiseIntro")}</p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-gray-800/50 rounded-lg p-4 text-center border border-green-500/30">
                  <span className="text-3xl block mb-2">💵</span>
                  <span className="text-green-400 font-bold">
                    {t("about", "zeroCost")}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {t("about", "zeroCostDesc")}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center border border-blue-500/30">
                  <span className="text-3xl block mb-2">🛡️</span>
                  <span className="text-blue-400 font-bold">
                    {t("about", "hundredPercentPrivate")}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {t("about", "privateDesc")}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center border border-red-500/30">
                  <span className="text-3xl block mb-2">🚫</span>
                  <span className="text-red-400 font-bold">
                    {t("about", "noTracking")}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {t("about", "noTrackingDesc")}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center border border-purple-500/30">
                  <span className="text-3xl block mb-2">🤖</span>
                  <span className="text-purple-400 font-bold">
                    {PROJECT_STATS.localAIModels} {t("about", "localAiModels")}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {t("about", "localAiDesc")}
                  </p>
                </div>
              </div>

              <p className="text-center italic text-gray-400 mt-4 text-xs">
                {t("about", "toolToEmpower")}
              </p>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">
              🎯 {t("about", "myMission")}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              <strong>Vet-Rate.org</strong> {t("about", "missionDescription")} (
              {getTotalToolCount()}+{" "}
              {t("about", "professionalTools")?.toLowerCase() ||
                "professional tools"}
              )
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">
              🛠️ {t("about", "completeClaimsArsenal")} - {getTotalToolCount()}+{" "}
              {t("about", "professionalTools")}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              {t("about", "arsenalDescription")}
            </p>

            <div className="space-y-4">
              {TOOLKIT_CATEGORIES.map((category) => (
                <div key={category.id}>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">
                    {category.emoji} {category.title} ({category.tools.length}{" "}
                    tools)
                  </h4>
                  <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 ml-4 space-y-1">
                    {category.tools.map((tool, index) => (
                      <li key={index}>
                        <strong>{tool.name}:</strong> {tool.description}
                        {tool.isNew && (
                          <span className="ml-1 px-1.5 py-0.5 bg-green-500 text-white text-xs rounded">
                            NEW
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-4 bg-gradient-to-r from-va-gold/20 to-green-600/20 border-l-4 border-va-gold rounded p-3">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                🎖️ {getTotalToolCount()}+ {t("about", "arsenalHighlight")}
              </p>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">
              {t("about", "dataSources")}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              {t("about", "dataSourcesIntro")}
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mb-3 ml-4">
              <li>
                <strong>{t("about", "cfrPart3Verified")}</strong>{" "}
                {t("about", "cfrPart3Desc")}
              </li>
              <li>
                <strong>{t("about", "cfrPart4Verified")}</strong>{" "}
                {t("about", "cfrPart4Desc")}
              </li>
              <li>
                <strong>
                  {PROJECT_STATS.disabilitiesValidated}{" "}
                  {t("about", "vaDisabilitiesCompleteCoverage")}
                </strong>{" "}
                {t("about", "allBodySystems")}
              </li>
              <li>
                <strong>{t("about", "ratingCriteriaValidated")}</strong>{" "}
                {t("about", "ratingCriteriaDesc")}
              </li>
              <li>
                <strong>{t("about", "secondaryConditionsDatabase")}</strong>{" "}
                {t("about", "secondaryConditionsDesc")}
              </li>
            </ul>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-2 italic">
              {t("about", "lastValidated")} January 2026{" "}
              {t("about", "againstEcfr")}
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">
              {t("about", "whyIBuiltThis")}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              {t("about", "whyIBuiltThisDesc1")} ({getTotalToolCount()}+{" "}
              {t("about", "tools")})
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              {t("about", "whyIBuiltThisDesc2")}
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              <strong>{t("about", "whyIBuiltThisDesc3")}</strong>
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">
              {t("about", "whoIAm")}
            </h3>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-shrink-0">
                <img
                  src="/images/Anth.jpg"
                  alt="Veteran in military uniform"
                  className="w-48 h-auto rounded-lg shadow-lg border-2 border-gray-300 dark:border-gray-600"
                  width={435}
                  height={604}
                  loading="lazy"
                  decoding="async"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2 italic">
                  SGT Johnson, 92Y20
                </p>
              </div>
              <div className="flex-1">
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  {t("about", "whoIAmDesc1")}
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  {t("about", "whoIAmDesc2")}
                </p>
                <p className="text-gray-600 dark:text-gray-400 italic text-left mt-4">
                  ~ Anth
                </p>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">
              🐱 {t("about", "developmentTeam")}
            </h3>
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {t("about", "developmentTeamIntro")}
              </p>
              {/* Luna and Midnight - 2 column grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🐱</span>
                    <h4 className="font-bold text-gray-800 dark:text-gray-200">
                      Luna
                    </h4>
                    <span className="text-xs bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-full">
                      aka Sweet Baby Kitty Cat
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {t("about", "chiefMoraleOfficer")}.{" "}
                    {t("about", "lunaDescription")}
                  </p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-pink-600 hover:text-pink-800 font-medium">
                      📸 {t("about", "viewGallery")}
                    </summary>
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      <div>
                        <img
                          src="/images/ReadyForHerCloseup.jpg"
                          alt="Luna the calico cat - portrait"
                          className="w-full h-auto rounded-lg shadow-md border-2 border-pink-200 dark:border-pink-700"
                          width={1750}
                          height={2048}
                          loading="lazy"
                          decoding="async"
                        />
                        <p className="text-center text-gray-500 dark:text-gray-400 mt-2 text-xs">
                          Ready for her closeup 📷
                        </p>
                      </div>
                      <div>
                        <img
                          src="/images/Kitty_Coder.jpg"
                          alt="Luna supervising coding at the workstation"
                          className="w-full h-auto rounded-lg shadow-md border-2 border-pink-200 dark:border-pink-700"
                          width={2048}
                          height={1536}
                          loading="lazy"
                          decoding="async"
                        />
                        <p className="text-center text-gray-500 dark:text-gray-400 mt-2 text-xs">
                          Supervising the code 💻
                        </p>
                      </div>
                      <div>
                        <img
                          src="/images/NaptimeLuna.jpg"
                          alt="Luna taking a well-deserved nap"
                          className="w-full h-auto rounded-lg shadow-md border-2 border-pink-200 dark:border-pink-700"
                          width={2048}
                          height={1536}
                          loading="lazy"
                          decoding="async"
                        />
                        <p className="text-center text-gray-500 dark:text-gray-400 mt-2 text-xs">
                          Quality assurance testing 😴
                        </p>
                      </div>
                    </div>
                  </details>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🖥️</span>
                    <h4 className="font-bold text-gray-800 dark:text-gray-200">
                      Midnight
                    </h4>
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                      {t("about", "theWorkstation")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {t("about", "midnightDescription")}
                  </p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                      🔧 {t("about", "viewSpecs")}
                    </summary>
                    <div className="mt-2 bg-gray-50 dark:bg-gray-900/50 rounded p-3 space-y-1 text-gray-600 dark:text-gray-400">
                      <p>
                        <strong>CPU:</strong> AMD Ryzen 9 7950X3D 4.2 GHz
                        16-Core
                      </p>
                      <p>
                        <strong>Cooler:</strong> Asus ProArt LC 420 107 CFM
                        Liquid
                      </p>
                      <p>
                        <strong>Motherboard:</strong> Asus ProArt X670E-CREATOR
                        WIFI ATX AM5
                      </p>
                      <p>
                        <strong>Memory:</strong> Corsair Vengeance 128 GB (4 x
                        32 GB) DDR5-5600 CL40
                      </p>
                      <p>
                        <strong>Primary SSD:</strong> MSI SPATIUM M570 HS 2 TB
                        PCIe 5.0 X4 NVMe
                      </p>
                      <p>
                        <strong>Storage:</strong> 2 x Silicon Power UD90 4 TB
                        PCIe 4.0 X4 NVMe
                      </p>
                      <p>
                        <strong>GPU:</strong> Asus ProArt OC GeForce RTX 4080
                        SUPER 16 GB (top slot); Asus ProArt OC RTX 4070 Ti SUPER
                        16 GB (middle slot)
                      </p>
                      <p>
                        <strong>Case:</strong> Asus ProArt PA602 ATX Mid Tower
                      </p>
                      <p>
                        <strong>PSU:</strong> be quiet! Dark Power Pro 13 1300W
                        80+ Titanium
                      </p>
                      <p>
                        <strong>Displays:</strong> Asus ProArt PA329CV 32&quot;
                        4K + PA279CRV 27&quot; 4K + Caperave CU17 17.3&quot; 4K
                      </p>
                      <p className="pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                        <strong>eGPU:</strong> Asus Dual GeForce RTX 5060 Ti OC
                        16GB in Sonnet Breakaway Box 850 T5
                      </p>
                      <p>
                        <strong>eGPU:</strong> Asus Dual RTX 4060 Ti EVO OC 16
                        GB in Sonnet Breakaway Box 750ex
                      </p>
                    </div>
                  </details>
                </div>
              </div>

              {/* The Codebase - Full width */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">⚡</span>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200">
                    {t("about", "theCodebase")}
                  </h4>
                  <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                    {t("about", "builtWithLove")} 💚
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {t("about", "codebaseDescription")}
                </p>
                <details className="text-xs">
                  <summary className="cursor-pointer text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium">
                    📊 {t("about", "viewCodebaseStats")}
                  </summary>
                  <div className="mt-2 bg-gray-50 dark:bg-gray-900/50 rounded p-3 text-gray-600 dark:text-gray-400">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left Column */}
                      <div className="space-y-3">
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            📐 Project Scale
                          </p>
                          <p>
                            <strong>Total Files:</strong>{" "}
                            {FORMATTED_STATS.totalFiles} project files
                          </p>
                          <p>
                            <strong>Lines of Code:</strong>{" "}
                            {FORMATTED_STATS.linesOfCode} lines
                          </p>
                          <p>
                            <strong>App Size:</strong> {FORMATTED_STATS.appSize}
                          </p>
                        </div>
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            📦 Core Components
                          </p>
                          <p>
                            <strong>React Components:</strong>{" "}
                            {FORMATTED_STATS.components}
                          </p>
                          <p>
                            <strong>Utility Modules:</strong>{" "}
                            {FORMATTED_STATS.utilities}
                          </p>
                          <p>
                            <strong>VA Forms:</strong> {FORMATTED_STATS.vaForms}
                          </p>
                        </div>
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            🗂️ Data Files
                          </p>
                          <p>
                            <strong>Disabilities Database:</strong>{" "}
                            {PROJECT_STATS.disabilitiesValidated} rated
                            conditions
                          </p>
                          <p>
                            <strong>Secondary Conditions:</strong>{" "}
                            {FORMATTED_STATS.secondaryConditions}
                          </p>
                          <p>
                            <strong>Regulations:</strong> 38 CFR Parts 3 & 4
                          </p>
                          <p>
                            <strong>PACT Act Data:</strong> Toxic exposure
                            coverage
                          </p>
                          <p>
                            <strong>DBQ Logic Map:</strong> C&P exam question
                            bank
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            ⚙️ Tech Stack
                          </p>
                          <p>
                            <strong>Framework:</strong> React 18 + Vite
                          </p>
                          <p>
                            <strong>Styling:</strong> Tailwind CSS
                          </p>
                          <p>
                            <strong>PDF Generation:</strong> jsPDF + html2canvas
                          </p>
                          <p>
                            <strong>Cloud AI:</strong> Google Gemini API
                          </p>
                        </div>
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            🤖 Local AI Arsenal
                          </p>
                          <p>
                            <strong>Engine:</strong> WebLLM (WebGPU)
                          </p>
                          <p>
                            <strong>Local Models:</strong>{" "}
                            {PROJECT_STATS.localAIModels} Warrant Council agents
                          </p>
                          <p>
                            <strong>Base Models:</strong> Qwen 2.5 (fine-tuned
                            for VA claims)
                          </p>
                          <p>
                            <strong>Privacy:</strong> 100% in-browser, zero data
                            leaves device
                          </p>
                        </div>
                        {/* Warrant Council Architecture */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                          <p className="font-semibold text-amber-600 dark:text-amber-400 mb-1">
                            🎖️ The Warrant Council
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            Our specialized 3-agent AI architecture, each with
                            military expertise:
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                            <div className="bg-blue-50 dark:bg-blue-900/30 rounded p-2">
                              <p className="font-bold text-blue-700 dark:text-blue-300">
                                🔍 CW5 Auditor
                              </p>
                              <p className="text-gray-600 dark:text-gray-400">
                                Reviews claims for accuracy, compliance, and
                                completeness against 38 CFR
                              </p>
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900/30 rounded p-2">
                              <p className="font-bold text-purple-700 dark:text-purple-300">
                                ✍️ CW4 Writer
                              </p>
                              <p className="text-gray-600 dark:text-gray-400">
                                Crafts compelling personal statements and nexus
                                letters
                              </p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/30 rounded p-2">
                              <p className="font-bold text-green-700 dark:text-green-300">
                                🧮 CW3 Rater
                              </p>
                              <p className="text-gray-600 dark:text-gray-400">
                                Calculates VA disability ratings with bilateral
                                factor precision
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                            🎖️ Fine-tuned on official VA regulations for Diamond
                            Standard accuracy
                          </p>
                        </div>
                      </div>
                      {/* Right Column */}
                      <div className="space-y-3">
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            ⏱️ Development Time
                          </p>
                          <p>
                            <strong>Traditional Equivalent:</strong>{" "}
                            {FORMATTED_STATS.traditionalHours}
                          </p>
                          <p className="text-xs mt-1 italic">
                            • {formatNumber(PROJECT_STATS.breakdown.coding)} hrs
                            coding (128k lines @ 9.77 LOC/hr blended team rate)
                            <br />• {PROJECT_STATS.breakdown.dataValidation} hrs
                            data validation (
                            {PROJECT_STATS.disabilitiesValidated} disabilities
                            against 38 CFR)
                            <br />•{" "}
                            {formatNumber(PROJECT_STATS.breakdown.testing)} hrs
                            testing & QA (15% of dev time)
                            <br />• {PROJECT_STATS.breakdown.uiux} hrs UI/UX
                            design & iterations
                            <br />• {PROJECT_STATS.breakdown.documentation} hrs
                            documentation & field manual
                            <br />• {PROJECT_STATS.breakdown.research} hrs
                            research (38 CFR regulations)
                            <br />• {PROJECT_STATS.breakdown.deployment} hrs
                            deployment & optimization
                          </p>
                          <p className="text-xs mt-1 font-medium text-amber-600 dark:text-amber-400">
                            {FORMATTED_STATS.traditionalYears} for one developer
                          </p>
                          <hr className="my-2 border-gray-300 dark:border-gray-600" />
                          <p>
                            <strong>Actual Time Invested:</strong>{" "}
                            {FORMATTED_STATS.actualTime}
                          </p>
                          <p className="text-xs mt-1 italic">
                            • First commit: {PROJECT_STATS.git.firstCommitDate}{" "}
                            at {PROJECT_STATS.git.firstCommitTime}
                            <br />• Latest commit:{" "}
                            {PROJECT_STATS.git.latestCommitDate} at{" "}
                            {PROJECT_STATS.git.latestCommitTime}
                            <br />• {FORMATTED_STATS.commits}
                            <br />• {FORMATTED_STATS.linesChanged}
                          </p>
                          <p className="text-xs mt-1 text-amber-600 dark:text-amber-400 italic">
                            📚 Plot twist: I spent 5 days before that first
                            commit figuring out how to do it <em>wrong</em>{" "}
                            before I figured out how to do it right. The clock
                            starts AFTER the learning curve! 😅
                          </p>
                          <p className="text-xs mt-1 font-medium text-green-600 dark:text-green-400">
                            🚀 {FORMATTED_STATS.multiplier} productivity
                            multiplier (AI-assisted development)
                          </p>
                          <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                            <strong>Traditional Cost:</strong> The{" "}
                            {formatNumber(PROJECT_STATS.traditionalHours)}-hour
                            estimate would cost $
                            {(
                              PROJECT_STATS.professionalTeamCostMin / 1000000
                            ).toFixed(1)}
                            M-$
                            {(
                              PROJECT_STATS.professionalTeamCostMax / 1000000
                            ).toFixed(1)}
                            M with a professional team (12-24 months).{" "}
                            <strong>AI-Assisted Reality:</strong> Built in{" "}
                            {PROJECT_STATS.actualHours} hours @ $
                            {PROJECT_STATS.hourlyRate}/hour = $
                            {formatNumber(PROJECT_STATS.actualCost)} total
                            investment using Visual Studio Code with Claude 4.5
                            (Opus &amp; Sonnet), Gemini 3 for planning &amp;
                            prompt generation, and Roo Code - enabling us to
                            offer everything FREE to veterans forever.
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Full-width Component Development Breakdown */}
                    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
                      <details className="cursor-pointer">
                        <summary className="font-semibold text-gray-700 dark:text-gray-300 mb-1 hover:text-va-gold">
                          🛠️ Component Development Breakdown (Click to expand)
                        </summary>
                        <div className="mt-2 ml-2 text-xs space-y-1">
                          <p className="font-medium text-gray-600 dark:text-gray-400 mb-2">
                            Major Tool Development Hours & Lines:
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 text-gray-700 dark:text-gray-300">
                            <p>
                              • <strong>C-File AI Analyzer:</strong> 680 hrs /
                              9,200 lines
                            </p>
                            <p>
                              • <strong>C&P Exam Simulator:</strong> 520 hrs /
                              7,800 lines
                            </p>
                            <p>
                              • <strong>Tactical Calculator:</strong> 450 hrs /
                              8,500 lines
                            </p>
                            <p>
                              • <strong>Forms Helper:</strong> 410 hrs / 6,800
                              lines
                            </p>
                            <p>
                              • <strong>Blue Button X-Ray:</strong> 380 hrs /
                              5,100 lines
                            </p>
                            <p>
                              • <strong>Secondary Scout:</strong> 380 hrs /
                              6,200 lines
                            </p>
                            <p>
                              • <strong>Decision Decoder:</strong> 350 hrs /
                              4,900 lines
                            </p>
                            <p>
                              • <strong>Smart Search:</strong> 340 hrs / 5,200
                              lines
                            </p>
                            <p>
                              • <strong>Nexus Builder:</strong> 320 hrs / 5,400
                              lines
                            </p>
                            <p>
                              • <strong>Million Dollar Dashboard:</strong> 310
                              hrs / 4,500 lines
                            </p>
                            <p>
                              • <strong>My Packet:</strong> 290 hrs / 4,200
                              lines
                            </p>
                            <p>
                              • <strong>Web of Conditions:</strong> 290 hrs /
                              4,100 lines
                            </p>
                            <p>
                              • <strong>Red Team Simulator:</strong> 280 hrs /
                              3,800 lines
                            </p>
                            <p>
                              • <strong>State Benefit Hunter:</strong> 270 hrs /
                              3,900 lines
                            </p>
                            <p>
                              • <strong>PACT Act Navigator:</strong> 260 hrs /
                              3,700 lines
                            </p>
                            <p>
                              • <strong>Witness Bench:</strong> 240 hrs / 3,600
                              lines
                            </p>
                            <p>
                              • <strong>MOS Hazard Matcher:</strong> 230 hrs /
                              3,300 lines
                            </p>
                            <p>
                              • <strong>TDIU Builder:</strong> 220 hrs / 3,100
                              lines
                            </p>
                            <p>
                              • <strong>Pathfinder:</strong> 210 hrs / 3,200
                              lines
                            </p>
                            <p>
                              • <strong>Risk Assessment:</strong> 190 hrs /
                              2,800 lines
                            </p>
                            <p>
                              • <strong>Symptom Logger:</strong> 180 hrs / 2,400
                              lines
                            </p>
                            <p>
                              • <strong>FOIA Generator:</strong> 170 hrs / 2,500
                              lines
                            </p>
                            <p>
                              • <strong>Shark Radar:</strong> 160 hrs / 2,200
                              lines
                            </p>
                            <p>
                              • <strong>VA Resources Hub:</strong> 150 hrs /
                              2,100 lines
                            </p>
                            <p>
                              • <strong>VSO Finder:</strong> 140 hrs / 1,900
                              lines
                            </p>
                            <p>
                              • <strong>Accessibility Features:</strong> 120 hrs
                              / 1,600 lines
                            </p>
                            <p>
                              • <strong>Field Manual:</strong> 100 hrs / 1,800
                              lines
                            </p>
                          </div>
                          <p className="mt-2 text-amber-600 dark:text-amber-400 font-medium">
                            Plus 200 hours validating 15,000 lines of disability
                            data against 38 CFR
                          </p>
                        </div>
                      </details>
                    </div>
                    <p className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2 text-center italic text-green-600 dark:text-green-400">
                      Built with determination and fueled by veteran spirit 🎖️
                    </p>
                  </div>
                </details>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">
              💻 {t("about", "howThisWasBuilt")}
            </h3>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                {t("about", "howBuiltIntro")}
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">📖</span>
                  <span>
                    <strong>{t("about", "dataSource")}</strong>{" "}
                    {t("about", "dataSourceDesc")} (
                    <a
                      href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      eCFR
                    </a>
                    )
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">🛠️</span>
                  <span>
                    <strong>{t("about", "developmentEnvironment")}</strong>{" "}
                    Visual Studio Code with Claude 4.5 integration
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">🤖</span>
                  <span>
                    <strong>{t("about", "aiAssistedDevelopment")}</strong>{" "}
                    Claude 4.5 (Opus &amp; Sonnet), Gemini 3 (planning &amp;
                    prompt generation), Roo Code
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-600 mt-1">⚡</span>
                  <span>
                    <strong>{t("about", "modernStack")}</strong> React 18, Vite,
                    Tailwind CSS
                  </span>
                </li>
              </ul>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 italic">
                {t("about", "aiDevelopmentNote")}
              </p>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">
              {t("about", "importantDisclaimers")}
            </h3>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-4 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>⚠️ {t("about", "notLegalOrMedicalAdvice")}</strong>{" "}
                {t("about", "notLegalOrMedicalAdviceDesc")}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>💼 {t("about", "notAffiliatedWithVA")}</strong>{" "}
                {t("about", "notAffiliatedWithVADesc")}
              </p>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">
              {t("about", "myCommitmentToVeterans")}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              {t("about", "commitmentIntro")}
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mb-3 ml-4">
              <li>
                ✅ {t("about", "commitment1")} ({getTotalToolCount()}+)
              </li>
              <li>✅ {t("about", "commitment2")}</li>
              <li>✅ {t("about", "commitment3")}</li>
              <li>✅ {t("about", "commitment4")}</li>
              <li>✅ {t("about", "commitment5")}</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">
              {t("about", "contactFeedback")}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              {t("about", "contactPageLink")}
            </p>
          </section>

          <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 p-4 mt-6">
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>{t("about", "thankYouForService")}</strong>
              <br />
              {t("about", "thankYouMessage")} ({getTotalToolCount()}+{" "}
              {t("about", "tools")})
            </p>
          </div>
        </div>

        <div className="border-t dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-4">
              <VersionDropUp />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                • {t("about", "builtWithLoveForVeterans")}
              </span>

              {/* The Zonk Button - Easter Egg */}
              <button
                onClick={handleZonk}
                className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded hover:from-amber-600 hover:to-orange-600 transition-all transform hover:scale-105 shadow-sm"
                aria-label="Zonk! (Click me)"
              >
                {t("about", "dismissed")}
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Zonk Message Overlay */}
      {showZonkMessage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white px-8 py-6 rounded-xl shadow-2xl transform animate-bounce">
            <div className="text-6xl mb-2 text-center">🎖️</div>
            <div className="text-3xl font-bold text-center mb-2">ZONK!</div>
            <div className="text-lg text-center">
              {t("about", "zonkMessage")}
            </div>
            <div className="text-sm text-center mt-2 text-white/80">
              ({t("about", "zonkThanks")})
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AboutUs;
