import { Shield, BookOpen, Lock } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import BRAND from "../config/branding";

// Enhanced inline disclaimer focused on trust, education, and privacy
const DisclaimerCompact = ({ t }) => (
  <div className="mt-8 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2">
          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h4 className="font-semibold text-gray-800 dark:text-gray-200">
          {t("disclaimer", "educationalResource")}
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("disclaimer", "notLegalAdvice")}
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-2">
          <Lock className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <h4 className="font-semibold text-gray-800 dark:text-gray-200">
          {t("disclaimer", "yourPrivacy")}
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("disclaimer", "noDataCollected")}
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-full p-2">
          <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <h4 className="font-semibold text-gray-800 dark:text-gray-200">
          {t("disclaimer", "veteranBuilt")}
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("disclaimer", "byServiceDisabledVet")}
        </p>
      </div>
    </div>
    <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
      {t("disclaimer", "consultVSO")}
    </p>
  </div>
);

function Disclaimer({ compact = false }) {
  const { t } = useLanguage();

  if (compact) {
    return <DisclaimerCompact t={t} />;
  }

  return (
    <div className="max-w-4xl mx-auto mb-8">
      <div
        className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 rounded-xl shadow-sm p-6"
        role="alert"
        aria-labelledby="disclaimer-title"
      >
        <div className="flex flex-col items-center text-center">
          {/* Warning Icon */}
          <div className="bg-amber-100 dark:bg-amber-800/50 rounded-full p-3 mb-4">
            <svg
              className="h-8 w-8 text-amber-600 dark:text-amber-400"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {/* Title */}
          <h3
            id="disclaimer-title"
            className="text-lg font-bold text-amber-800 dark:text-amber-200 mb-3 tracking-wide"
          >
            ⚠️ {t("disclaimer", "importantDisclaimer")}
          </h3>

          {/* Content */}
          <div className="text-amber-700 dark:text-amber-100 space-y-3 max-w-2xl">
            <p>
              <strong className="text-amber-800 dark:text-amber-200">
                {BRAND.appName}
              </strong>{" "}
              {t("disclaimer", "informationalOnly")}.
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {t("disclaimer", "consultVSO")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Disclaimer;
