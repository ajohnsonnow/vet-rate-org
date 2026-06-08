import { useState, useRef, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  useTheme,
  THEME_MODES,
  COLOR_BLIND_MODES,
} from "../contexts/ThemeContext";

// LocalStorage key for Gemini API key (BYOK)
const GEMINI_KEY_STORAGE = "vetrate_gemini_key";

export default function AccessibilityMenu() {
  const { t } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // API Key state
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const {
    theme,
    setTheme,
    _toggleTheme,
    _isDark,
    isTbiComfort,
    isAaaContrast,
    colorBlindMode,
    setColorBlindMode,
    reducedMotion,
    setReducedMotion,
    fontSize,
    setFontSize,
  } = useTheme();

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  // Load API key on mount
  useEffect(() => {
    const savedKey = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (savedKey) {
      setApiKey(savedKey);
      setApiKeySaved(true);
    }
  }, []);

  // Save API key
  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem(GEMINI_KEY_STORAGE, apiKey.trim());
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2000);
    }
  };

  // Clear API key
  const handleClearApiKey = () => {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
    setApiKey("");
    setApiKeySaved(false);
  };

  const colorBlindOptions = [
    {
      value: COLOR_BLIND_MODES.NONE,
      label: t("accessibility", "defaultColors"),
      description: t("accessibility", "standardPalette"),
    },
    {
      value: COLOR_BLIND_MODES.PROTANOPIA,
      label: t("accessibility", "protanopia"),
      description: t("accessibility", "redBlindFriendly"),
    },
    {
      value: COLOR_BLIND_MODES.DEUTERANOPIA,
      label: t("accessibility", "deuteranopia"),
      description: t("accessibility", "greenBlindFriendly"),
    },
    {
      value: COLOR_BLIND_MODES.TRITANOPIA,
      label: t("accessibility", "tritanopia"),
      description: t("accessibility", "blueBlindFriendly"),
    },
    {
      value: COLOR_BLIND_MODES.HIGH_CONTRAST,
      label: t("accessibility", "highContrast"),
      description: t("accessibility", "maximumVisibility"),
    },
  ];

  const fontSizeOptions = [
    { value: "small", label: t("accessibility", "small"), size: "14px" },
    { value: "normal", label: t("accessibility", "normal"), size: "16px" },
    { value: "large", label: t("accessibility", "large"), size: "18px" },
    { value: "xlarge", label: t("accessibility", "extraLarge"), size: "20px" },
  ];

  // AAAAA Theme Mode Options (Diamond Standard)
  const themeModeOptions = [
    {
      value: THEME_MODES.LIGHT,
      label: "Light Mode",
      description: "Standard bright interface",
      icon: "☀️",
    },
    {
      value: THEME_MODES.DARK,
      label: "Dark Mode",
      description: "Reduced eye strain for night ops",
      icon: "🌙",
    },
    {
      value: THEME_MODES.TBI_COMFORT,
      label: "TBI Comfort",
      description: "Warm amber tones for light sensitivity",
      icon: "🧠",
    },
    {
      value: THEME_MODES.AAA_CONTRAST,
      label: "AAA High Contrast",
      description: "7:1 contrast ratio for low vision",
      icon: "👁️",
    },
  ];

  return (
    <div className="relative sm:relative">
      {/* Accessibility Toggle Button */}
      <button
        ref={buttonRef}
        id="accessibility-menu"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-va-blue"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={t("accessibility", "settingsMenuAria")}
      >
        {/* Accessibility Icon */}
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        <span className="hidden md:inline text-sm font-medium">
          {t("accessibility", "title")}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-auto mt-2 sm:w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="accessibility-menu"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-va-blue to-green-800 dark:from-gray-700 dark:to-gray-600 text-white px-4 py-3">
            <h3 className="font-bold text-lg flex items-center gap-2">
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              ♿ {t("accessibility", "settingsTitle")}
            </h3>
            <p className="text-sm text-green-100 dark:text-gray-300">
              {t("accessibility", "complianceNote")}
            </p>
          </div>

          {/* Accessibility Features Summary */}
          <div className="px-4 pt-3 pb-2 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <span className="text-lg">✨</span>
              <div className="text-xs text-blue-700 dark:text-blue-300">
                <strong>{t("accessibility", "builtForAllVeterans")}</strong>{" "}
                {t("accessibility", "featuresSummary")}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Theme Mode Selector - AAAAA Diamond Standard */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-va-blue dark:text-va-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                  />
                </svg>
                Display Mode
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {themeModeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-va-blue ${
                      theme === option.value
                        ? "bg-va-blue/10 dark:bg-va-gold/20 border-2 border-va-blue dark:border-va-gold ring-2 ring-va-blue/30 dark:ring-va-gold/30"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-gray-200 dark:border-gray-600"
                    }`}
                    aria-pressed={theme === option.value}
                    aria-label={`${option.label}: ${option.description}`}
                  >
                    <span className="text-2xl" aria-hidden="true">
                      {option.icon}
                    </span>
                    <span
                      className={`text-xs font-medium text-center ${
                        theme === option.value
                          ? "text-va-blue dark:text-va-gold"
                          : "text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
              {/* TBI Comfort Info */}
              {isTbiComfort && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    🧠 <strong>TBI Comfort Mode Active</strong> - Warm amber
                    tones reduce visual stress for veterans with light
                    sensitivity or traumatic brain injury.
                  </p>
                </div>
              )}
              {/* AAA Contrast Info */}
              {isAaaContrast && (
                <div className="bg-gray-900 border border-yellow-400 rounded-lg p-2">
                  <p className="text-xs text-yellow-400">
                    👁️ <strong>AAA High Contrast Active</strong> - Maximum 7:1
                    contrast ratio for low vision. WCAG 2.2 AAA compliant.
                  </p>
                </div>
              )}
            </div>

            <hr className="border-gray-200 dark:border-gray-600" />

            {/* Color Vision Settings */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-va-blue dark:text-va-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                {t("accessibility", "colorVisionSettings")}
              </h4>
              <div className="space-y-2">
                {colorBlindOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      colorBlindMode === option.value
                        ? "bg-va-blue/10 dark:bg-va-gold/20 border-2 border-va-blue dark:border-va-gold"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="colorBlindMode"
                      value={option.value}
                      checked={colorBlindMode === option.value}
                      onChange={(e) => setColorBlindMode(e.target.value)}
                      className="sr-only"
                    />
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        colorBlindMode === option.value
                          ? "border-va-blue dark:border-va-gold bg-va-blue dark:bg-va-gold"
                          : "border-gray-400"
                      }`}
                    >
                      {colorBlindMode === option.value && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </span>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {option.label}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {option.description}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <hr className="border-gray-200 dark:border-gray-600" />

            {/* Font Size */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-va-blue dark:text-va-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16m-7 6h7"
                  />
                </svg>
                {t("accessibility", "textSize")}
              </h4>
              <div className="flex gap-2">
                {fontSizeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFontSize(option.value)}
                    className={`flex-1 py-2 px-3 rounded-lg text-center transition-colors focus:outline-none focus:ring-2 focus:ring-va-blue ${
                      fontSize === option.value
                        ? "bg-va-blue dark:bg-va-gold text-white font-semibold"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                    aria-pressed={fontSize === option.value}
                  >
                    <span className="text-xs">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-gray-200 dark:border-gray-600" />

            {/* Reduced Motion */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-medium">
                <svg
                  className="w-5 h-5 text-va-blue dark:text-va-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {t("accessibility", "reduceMotion")}
              </span>
              <button
                onClick={() => setReducedMotion(!reducedMotion)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-va-blue focus:ring-offset-2 ${
                  reducedMotion ? "bg-va-blue dark:bg-va-gold" : "bg-gray-300"
                }`}
                role="switch"
                aria-checked={reducedMotion}
                aria-label={t("accessibility", "toggleReducedMotion")}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                    reducedMotion ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>

            <hr className="border-gray-200 dark:border-gray-600" />

            {/* AI Settings */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-purple-600 dark:text-purple-400"
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
                {t("accessibility", "aiFeatures")}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("accessibility", "aiDescription")}
              </p>{" "}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-2">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>💡 {t("accessibility", "tip")}</strong>{" "}
                  {t("accessibility", "geminiTip")}
                </p>
              </div>{" "}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t("accessibility", "enterApiKey")}
                    className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label={
                      showApiKey
                        ? t("accessibility", "hideApiKey")
                        : t("accessibility", "showApiKey")
                    }
                  >
                    {showApiKey ? (
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
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveApiKey}
                    disabled={!apiKey.trim()}
                    className="flex-1 py-2 px-3 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {apiKeySaved
                      ? t("accessibility", "saved")
                      : t("accessibility", "saveKey")}
                  </button>
                  {apiKey && (
                    <button
                      onClick={handleClearApiKey}
                      className="py-2 px-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      {t("accessibility", "clear")}
                    </button>
                  )}
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  {t("accessibility", "getFreeApiKey")}
                </a>
              </div>
            </div>

            {/* Reset Button */}
            <button
              onClick={() => {
                setTheme(THEME_MODES.LIGHT);
                setColorBlindMode(COLOR_BLIND_MODES.NONE);
                setFontSize("normal");
                setReducedMotion(false);
              }}
              className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-sm focus:outline-none focus:ring-2 focus:ring-va-blue"
            >
              {t("accessibility", "resetToDefaults")}
            </button>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              🏛️ {t("accessibility", "complianceFooter")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
