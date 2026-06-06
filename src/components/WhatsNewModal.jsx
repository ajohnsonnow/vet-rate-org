/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See COPYRIGHT.js for full license terms.
 */

/**
 * WHAT'S NEW MODAL - "The Briefing"
 *
 * Shows changelog after an update.
 * Only appears once per version.
 *
 * DEPLOYMENT UPDATE PROCESS:
 * 1. Edit src/utils/changelogGenerator.js
 * 2. Add new features to the curatedChangelog array
 * 3. Update the APP_VERSION in src/utils/version.js
 * 4. Deploy - modal will automatically show for users
 */

import React, { useEffect, useState } from "react";
import {
  X,
  Sparkles,
  CheckCircle,
  Wrench,
  Shield,
  Zap,
  Star,
  Rocket,
  Gift,
  Bug,
} from "lucide-react";
import ResponsiveModal from "./common/ResponsiveModal";
import { generateWhatsNewChangelog } from "../utils/changelogGenerator";
import { useLanguage } from "../contexts/LanguageContext";

const WhatsNewModal = ({
  changelog: propChangelog,
  version: propVersion,
  onClose,
}) => {
  const { t } = useLanguage();

  // Use dynamic changelog if not provided via props
  const [dynamicData, setDynamicData] = useState(null);

  useEffect(() => {
    if (!propChangelog || propChangelog.length === 0) {
      const data = generateWhatsNewChangelog();
      setDynamicData(data);
    }
  }, [propChangelog]);

  const changelog =
    propChangelog?.length > 0 ? propChangelog : dynamicData?.changelog || [];
  const version = propVersion || dynamicData?.version || "1.0.0";
  const bugFixes = dynamicData?.bugFixes || [];
  const totalBugsSquashed = dynamicData?.totalBugsSquashed || 0;

  // Separate NEW features from existing
  const newFeatures = changelog.filter((item) => item.isNew);
  const existingFeatures = changelog.filter((item) => !item.isNew);

  // Icon mapping for different update types
  const getIcon = (type, isNew) => {
    if (isNew) return <Rocket className="w-5 h-5 text-emerald-500" />;
    switch (type) {
      case "feature":
        return (
          <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
        );
      case "fix":
        return <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case "security":
        return <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case "improvement":
        return <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
      default:
        return (
          <CheckCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        );
    }
  };

  const getTypeLabel = (type, isNew) => {
    if (isNew) return t("whatsNew", "labelNew");
    const labels = {
      feature: t("whatsNew", "labelFeature"),
      fix: t("whatsNew", "labelBugFix"),
      security: t("whatsNew", "labelSecurity"),
      improvement: t("whatsNew", "labelImprovement"),
      change: t("whatsNew", "labelChange"),
    };
    return labels[type] || t("whatsNew", "labelUpdate");
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

  const handleClose = () => {
    // Dispatch event so tour knows What's New has closed
    window.dispatchEvent(new CustomEvent("whatsNewClosed"));
    onClose();
  };

  return (
    <ResponsiveModal
      isOpen
      onClose={handleClose}
      labelledBy="whats-new-title"
      size="lg"
      zIndex={50}
      footer={
        <div className="text-center">
          <button
            onClick={handleClose}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-3 rounded-xl font-bold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {t("whatsNew", "rogerThat")}
          </button>
        </div>
      }
      header={
        <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-6 overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>

          <div className="flex items-start justify-between relative">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur">
                  <Gift className="w-7 h-7" />
                </div>
                <div>
                  <h2 id="whats-new-title" className="text-2xl font-bold">
                    {t("whatsNew", "title")}{" "}
                    <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
                      {t("common", "beta")}
                    </span>
                  </h2>
                  <p className="text-emerald-100 text-sm">
                    {t("whatsNew", "version")} {version} •{" "}
                    {t("whatsNew", "freshIntel")}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label={t("common", "close")}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      }
    >
      <div data-whats-new-modal="true">
        {/* NEW FEATURES SECTION */}
        {newFeatures.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {t("whatsNew", "justDeployed")}
              </h3>
            </div>
            <div className="space-y-3">
              {newFeatures.map((item, index) => (
                <div
                  key={`new-${index}`}
                  className="flex gap-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:shadow-md transition-all"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(item.type, true)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${getTypeBadgeColor(item.type, true)}`}
                      >
                        {getTypeLabel(item.type, true)}
                      </span>
                    </div>
                    <p className="text-gray-900 dark:text-white font-semibold mb-1">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EXISTING FEATURES SECTION */}
        {existingFeatures.length > 0 && (
          <div>
            {newFeatures.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">
                  {t("whatsNew", "platformHighlights")}
                </h3>
              </div>
            )}
            <div className="space-y-3">
              {existingFeatures.map((item, index) => (
                <div
                  key={`existing-${index}`}
                  className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(item.type, false)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getTypeBadgeColor(item.type, false)}`}
                      >
                        {getTypeLabel(item.type, false)}
                      </span>
                    </div>
                    <p className="text-gray-900 dark:text-white font-medium mb-1">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {changelog.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>{t("whatsNew", "noChangelog")}</p>
          </div>
        )}

        {/* BUGS SQUASHED SECTION */}
        {bugFixes.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {t("whatsNew", "bugsSquashed")}
                </h3>
              </div>
              <span className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                {totalBugsSquashed} {t("common", "total")}
              </span>
            </div>
            <div className="space-y-2">
              {bugFixes.map((bug, index) => (
                <div
                  key={`bug-${index}`}
                  className="flex gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <Wrench className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {bug.isNew && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">
                          {t("whatsNew", "justFixed")}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {bug.category}
                      </span>
                    </div>
                    <p className="text-gray-800 dark:text-gray-200 font-medium text-sm">
                      {bug.title}
                    </p>
                    {bug.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {bug.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
              {t("whatsNew", "foundBug")}
            </p>
          </div>
        )}

        {/* Footer Message */}
        <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <p className="text-sm text-emerald-900 dark:text-emerald-100">
            <strong>{t("whatsNew", "missionReadyTitle")}</strong>{" "}
            {t("whatsNew", "missionReadyMessage")}
          </p>
        </div>
      </div>
    </ResponsiveModal>
  );
};

export default WhatsNewModal;
