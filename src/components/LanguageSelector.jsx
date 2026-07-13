/**
 * Vet-Rate.org - Language Selector Component
 * Allows veterans to switch the entire app to their native language
 *
 * Supports 40+ languages including:
 * - Pacific Islander (Chamorro, Samoan - highest military service rates!)
 * - African languages (Amharic, Somali, Swahili, Hausa, Yoruba, Igbo, Zulu, Xhosa)
 * - Asian languages (Chinese, Japanese, Korean, Vietnamese, Tagalog, Hmong, Thai, Khmer, Lao, Hindi, Punjabi)
 * - Middle Eastern (Arabic, Farsi, Dari, Pashto)
 * - Native American (Navajo, Cherokee, Lakota - honoring Code Talker heritage)
 * - Caribbean (Haitian Creole)
 * - European (German, French, Portuguese, Russian, Polish, Italian, Ukrainian)
 *
 * Note: VA forms are still generated in English (VA requirement)
 */

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import LanguageSuggestionModal from "./LanguageSuggestionModal";
import VeteranTranslator from "./VeteranTranslator";
import UnityLanguageTutor from "./UnityLanguageTutor";
import FlagIcon from "./FlagIcon";

// Language regions for organized display
const LANGUAGE_REGIONS = [
  { id: "primary", name: "Primary", icon: "🏠" },
  {
    id: "pacific",
    name: "Pacific Islander",
    icon: "🌊",
    note: "Highest military service rates!",
  },
  { id: "asian", name: "Asian", icon: "🌏" },
  { id: "african", name: "African", icon: "🌍" },
  { id: "middle-eastern", name: "Middle Eastern", icon: "🕌" },
  {
    id: "native-american",
    name: "Native American",
    icon: "🪶",
    note: "Honoring Code Talker heritage",
  },
  { id: "caribbean", name: "Caribbean", icon: "🏝️" },
  { id: "european", name: "European", icon: "🌐" },
];

// Compact variant - just flag and code
const CompactGroupedLanguageList = ({
  getLanguagesByRegion,
  language,
  handleLanguageChange,
}) =>
  LANGUAGE_REGIONS.map((region) => {
    const regionLangs = getLanguagesByRegion(region.id);
    if (regionLangs.length === 0) return null;

    return (
      <div key={region.id}>
        <div className="px-3 py-1.5 bg-gray-800/50 text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2">
          <span>{region.icon}</span>
          <span>{region.name}</span>
          {region.note && (
            <span className="text-[10px] text-cyan-400 font-normal normal-case">
              ({region.note})
            </span>
          )}
        </div>
        {regionLangs.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-800
                       transition-colors ${language === lang.code ? "bg-cyan-900/30 text-cyan-400" : "text-gray-300"}`}
            aria-label={lang.note || `Switch to ${lang.name}`}
          >
            <span className="w-6 flex items-center justify-center">
              <FlagIcon
                langCode={lang.code}
                size="sm"
                fallbackEmoji={lang.flag}
              />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {lang.nativeName}
                </span>
                {lang.name !== lang.nativeName && (
                  <span className="text-xs text-gray-500">
                    ({lang.name})
                  </span>
                )}
              </div>
              {lang.note && (
                <span className="text-[10px] text-cyan-400 truncate block">
                  {lang.note}
                </span>
              )}
            </div>
            {language === lang.code && (
              <svg
                className="w-4 h-4 text-cyan-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    );
  });

const CompactFlatLanguageList = ({
  filteredLanguages,
  language,
  handleLanguageChange,
}) =>
  filteredLanguages.map((lang) => (
    <button
      key={lang.code}
      onClick={() => handleLanguageChange(lang.code)}
      className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-800
                 transition-colors ${language === lang.code ? "bg-cyan-900/30 text-cyan-400" : "text-gray-300"}`}
      aria-label={lang.note || `Switch to ${lang.name}`}
    >
      <FlagIcon
        langCode={lang.code}
        size="sm"
        fallbackEmoji={lang.flag}
      />
      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm font-medium">
          {lang.nativeName}
        </span>
        {lang.name !== lang.nativeName && (
          <span className="text-xs text-gray-500">
            ({lang.name})
          </span>
        )}
      </div>
      {language === lang.code && (
        <svg
          className="w-4 h-4 text-cyan-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </button>
  ));

const CompactLanguageList = ({
  groupByRegion,
  getLanguagesByRegion,
  filteredLanguages,
  language,
  handleLanguageChange,
  searchTerm,
}) => (
  <div className="overflow-y-auto flex-1">
    {groupByRegion ? (
      <CompactGroupedLanguageList
        getLanguagesByRegion={getLanguagesByRegion}
        language={language}
        handleLanguageChange={handleLanguageChange}
      />
    ) : (
      <CompactFlatLanguageList
        filteredLanguages={filteredLanguages}
        language={language}
        handleLanguageChange={handleLanguageChange}
      />
    )}

    {filteredLanguages.length === 0 && (
      <div className="px-3 py-4 text-center text-gray-500 text-sm">
        No languages found for &quot;{searchTerm}&quot;
      </div>
    )}
  </div>
);

const CompactDropdownFooter = ({
  setShowTranslator,
  setShowLanguageTutor,
  setIsOpen,
  setShowSuggestionModal,
  availableLanguages,
}) => (
  <div className="px-3 py-2 border-t border-gray-800 bg-gray-900/50 space-y-2">
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowTranslator(true);
          setIsOpen(false);
        }}
        className="px-2 py-1.5 bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/50 hover:to-orange-600/50 text-amber-300 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 border border-amber-500/30"
      >
        <span>🤝</span>
        <span>Translator</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowLanguageTutor(true);
          setIsOpen(false);
        }}
        className="px-2 py-1.5 bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/50 hover:to-purple-600/50 text-indigo-300 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 border border-indigo-500/30"
      >
        <span>🎓</span>
        <span>Learn</span>
      </button>
    </div>
    <button
      onClick={(e) => {
        e.stopPropagation();
        setShowSuggestionModal(true);
        setIsOpen(false);
      }}
      className="w-full px-2 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
    >
      <span>💡</span>
      <span>Suggest a Language</span>
    </button>
    <p className="text-[10px] text-gray-500 text-center">
      🌍 {availableLanguages.length}+ languages supported • NATO &
      Coalition Forces included • VA forms remain in English
    </p>
  </div>
);

const CompactModals = ({
  showSuggestionModal,
  setShowSuggestionModal,
  onReportBug,
  showTranslator,
  setShowTranslator,
  showLanguageTutor,
  setShowLanguageTutor,
}) => (
  <>
    <LanguageSuggestionModal
      isOpen={showSuggestionModal}
      onClose={() => setShowSuggestionModal(false)}
      onReportBug={onReportBug}
    />
    <VeteranTranslator
      isOpen={showTranslator}
      onClose={() => setShowTranslator(false)}
      onReportBug={onReportBug}
    />
    <UnityLanguageTutor
      isOpen={showLanguageTutor}
      onClose={() => setShowLanguageTutor(false)}
    />
  </>
);

const CompactToggleButton = ({
  setIsOpen,
  isOpen,
  t,
  showFlag,
  language,
  currentLang,
}) => (
  <button
    onClick={() => setIsOpen(!isOpen)}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500
                 border border-cyan-400/50 hover:border-cyan-300 transition-all shadow-md hover:shadow-lg group"
    aria-label={t("language", "selectLanguage")}
  >
    {showFlag && (
      <FlagIcon
        langCode={language}
        size="sm"
        fallbackEmoji={currentLang.flag}
      />
    )}
    <span className="text-sm font-semibold text-white uppercase">
      {language}
    </span>
    <svg
      className="w-3 h-3 text-cyan-200 group-hover:text-white transition-colors"
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

const CompactSearchInput = ({ searchTerm, setSearchTerm }) => (
  <div className="p-2 border-b border-gray-800">
    <input
      type="text"
      placeholder="Search languages..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white
                   placeholder-gray-500 focus:outline-none focus:border-cyan-500"
      /* eslint-disable-next-line jsx-a11y/no-autofocus */
      autoFocus
    />
  </div>
);

const CompactVariant = ({
  dropdownRef,
  className,
  isOpen,
  setIsOpen,
  t,
  showFlag,
  language,
  currentLang,
  searchTerm,
  setSearchTerm,
  groupByRegion,
  getLanguagesByRegion,
  filteredLanguages,
  handleLanguageChange,
  availableLanguages,
  setShowTranslator,
  setShowLanguageTutor,
  setShowSuggestionModal,
  showSuggestionModal,
  showTranslator,
  showLanguageTutor,
  onReportBug,
}) => {
  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <CompactToggleButton
        setIsOpen={setIsOpen}
        isOpen={isOpen}
        t={t}
        showFlag={showFlag}
        language={language}
        currentLang={currentLang}
      />

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-1 py-1 bg-gray-900 border border-gray-700
                          rounded-lg shadow-xl z-50 min-w-[280px] max-h-[400px] overflow-hidden flex flex-col"
        >
          {/* Search input */}
          <CompactSearchInput
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />

          {/* Language list */}
          <CompactLanguageList
            groupByRegion={groupByRegion}
            getLanguagesByRegion={getLanguagesByRegion}
            filteredLanguages={filteredLanguages}
            language={language}
            handleLanguageChange={handleLanguageChange}
            searchTerm={searchTerm}
          />

          {/* Footer note */}
          <CompactDropdownFooter
            setShowTranslator={setShowTranslator}
            setShowLanguageTutor={setShowLanguageTutor}
            setIsOpen={setIsOpen}
            setShowSuggestionModal={setShowSuggestionModal}
            availableLanguages={availableLanguages}
          />
        </div>
      )}

      {/* Modals */}
      <CompactModals
        showSuggestionModal={showSuggestionModal}
        setShowSuggestionModal={setShowSuggestionModal}
        onReportBug={onReportBug}
        showTranslator={showTranslator}
        setShowTranslator={setShowTranslator}
        showLanguageTutor={showLanguageTutor}
        setShowLanguageTutor={setShowLanguageTutor}
      />
    </div>
  );
};

// Inline variant - horizontal button group (shows top 8)
const InlineVariant = ({
  className,
  SUPPORTED_LANGUAGES,
  language,
  handleLanguageChange,
  showFlag,
  showNativeName,
  isOpen,
  setIsOpen,
}) => {
  const topLanguages = ["en", "es", "ch", "sm", "tl", "vi", "ar", "am"]
    .map((code) => SUPPORTED_LANGUAGES[code])
    .filter(Boolean);

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {topLanguages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => handleLanguageChange(lang.code)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
                       ${
                         language === lang.code
                           ? "bg-cyan-900/30 border-cyan-500 text-cyan-300"
                           : "bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                       }`}
        >
          {showFlag && (
            <FlagIcon
              langCode={lang.code}
              size="sm"
              fallbackEmoji={lang.flag}
            />
          )}
          <span className="text-sm font-medium">
            {showNativeName ? lang.nativeName : lang.name}
          </span>
        </button>
      ))}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-700 text-gray-400
                     hover:border-gray-600 hover:text-gray-300 transition-all"
      >
        <span className="text-sm">More...</span>
        <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded">40+</span>
      </button>
    </div>
  );
};

// Default dropdown variant (full-featured)
const DefaultToggleButton = ({
  setIsOpen,
  isOpen,
  t,
  showFlag,
  language,
  currentLang,
  showNativeName,
}) => (
  <button
    onClick={() => setIsOpen(!isOpen)}
    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/50 hover:bg-gray-700/50
               border border-gray-700 hover:border-cyan-500/50 transition-all w-full"
    aria-label={t("language", "selectLanguage")}
  >
    {showFlag && (
      <FlagIcon
        langCode={language}
        size="lg"
        fallbackEmoji={currentLang.flag}
      />
    )}
    <div className="flex-1 text-left">
      <div className="text-white font-medium">{currentLang.nativeName}</div>
      {showNativeName && currentLang.name !== currentLang.nativeName && (
        <div className="text-xs text-gray-400">{currentLang.name}</div>
      )}
    </div>
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
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

const DefaultSearchHeader = ({ searchTerm, setSearchTerm, t }) => (
  <div className="p-3 border-b border-gray-800">
    <input
      type="text"
      placeholder="Search 40+ languages..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white
                 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
      /* eslint-disable-next-line jsx-a11y/no-autofocus */
      autoFocus
    />
    <p className="text-xs text-gray-500 mt-2">
      {t("language", "languageNote")}
    </p>
  </div>
);

const DefaultLanguageButton = ({ lang, language, handleLanguageChange }) => (
  <button
    onClick={() => handleLanguageChange(lang.code)}
    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800
               transition-colors ${language === lang.code ? "bg-cyan-900/20" : ""}`}
  >
    <FlagIcon
      langCode={lang.code}
      size="lg"
      fallbackEmoji={lang.flag}
    />
    <div className="flex-1">
      <div
        className={`font-medium ${language === lang.code ? "text-cyan-400" : "text-white"}`}
      >
        {lang.nativeName}
      </div>
      {lang.name !== lang.nativeName && (
        <div className="text-xs text-gray-500">
          {lang.name}
        </div>
      )}
      {lang.note && (
        <div className="text-xs text-amber-400/70 mt-0.5">
          💡 {lang.note}
        </div>
      )}
    </div>
    {language === lang.code && (
      <svg
        className="w-5 h-5 text-cyan-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
    )}
  </button>
);

const DefaultLanguageList = ({
  getLanguagesByRegion,
  filteredLanguages,
  language,
  handleLanguageChange,
  searchTerm,
}) => (
  <div className="overflow-y-auto flex-1">
    {LANGUAGE_REGIONS.map((region) => {
      const regionLangs = getLanguagesByRegion(region.id);
      if (regionLangs.length === 0) return null;

      return (
        <div key={region.id} className="mb-1">
          <div
            className="px-4 py-2 bg-gradient-to-r from-gray-800/80 to-gray-800/40 text-sm font-bold text-gray-300
                          uppercase tracking-wide flex items-center gap-2 sticky top-0"
          >
            <span>{region.icon}</span>
            <span>{region.name}</span>
            {region.note && (
              <span className="text-xs text-cyan-400 font-normal normal-case ml-auto">
                ✨ {region.note}
              </span>
            )}
          </div>
          {regionLangs.map((lang) => (
            <DefaultLanguageButton
              key={lang.code}
              lang={lang}
              language={language}
              handleLanguageChange={handleLanguageChange}
            />
          ))}
        </div>
      );
    })}

    {filteredLanguages.length === 0 && (
      <div className="px-4 py-8 text-center text-gray-500">
        No languages found for &quot;{searchTerm}&quot;
      </div>
    )}
  </div>
);

const DefaultDropdownFooter = ({
  setShowTranslator,
  setShowLanguageTutor,
  setShowSuggestionModal,
  setIsOpen,
  availableLanguages,
}) => (
  <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/80 space-y-3">
    <div className="grid grid-cols-3 gap-2">
      <button
        onClick={() => {
          setShowTranslator(true);
          setIsOpen(false);
        }}
        className="px-3 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
      >
        <span>🤝</span>
        <span>Translator</span>
      </button>
      <button
        onClick={() => {
          setShowLanguageTutor(true);
          setIsOpen(false);
        }}
        className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
      >
        <span>🎓</span>
        <span>Learn</span>
      </button>
      <button
        onClick={() => {
          setShowSuggestionModal(true);
          setIsOpen(false);
        }}
        className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
      >
        <span>💡</span>
        <span>Suggest</span>
      </button>
    </div>
    <p className="text-xs text-gray-500 text-center">
      🎖️ Supporting {availableLanguages.length}+ languages for ALL
      service members • NATO & Coalition Forces • Built by veterans, for
      veterans
    </p>
  </div>
);

const DefaultModals = ({
  showSuggestionModal,
  setShowSuggestionModal,
  onReportBug,
  showTranslator,
  setShowTranslator,
  showLanguageTutor,
  setShowLanguageTutor,
}) => (
  <>
    <LanguageSuggestionModal
      isOpen={showSuggestionModal}
      onClose={() => setShowSuggestionModal(false)}
      onReportBug={onReportBug}
    />
    <VeteranTranslator
      isOpen={showTranslator}
      onClose={() => setShowTranslator(false)}
      onReportBug={onReportBug}
    />
    <UnityLanguageTutor
      isOpen={showLanguageTutor}
      onClose={() => setShowLanguageTutor(false)}
    />
    <VeteranTranslator
      isOpen={showTranslator}
      onClose={() => setShowTranslator(false)}
      onReportBug={onReportBug}
    />
  </>
);

const DefaultDropdownVariant = ({
  dropdownRef,
  className,
  isOpen,
  setIsOpen,
  t,
  showFlag,
  language,
  currentLang,
  showNativeName,
  searchTerm,
  setSearchTerm,
  getLanguagesByRegion,
  filteredLanguages,
  handleLanguageChange,
  availableLanguages,
  setShowTranslator,
  setShowLanguageTutor,
  setShowSuggestionModal,
  showSuggestionModal,
  showTranslator,
  showLanguageTutor,
  onReportBug,
}) => {
  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <DefaultToggleButton
        setIsOpen={setIsOpen}
        isOpen={isOpen}
        t={t}
        showFlag={showFlag}
        language={language}
        currentLang={currentLang}
        showNativeName={showNativeName}
      />

      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700
                        rounded-xl shadow-xl z-50 max-h-[70vh] overflow-hidden flex flex-col"
        >
          {/* Header with search */}
          <DefaultSearchHeader
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            t={t}
          />

          {/* Language list grouped by region */}
          <DefaultLanguageList
            getLanguagesByRegion={getLanguagesByRegion}
            filteredLanguages={filteredLanguages}
            language={language}
            handleLanguageChange={handleLanguageChange}
            searchTerm={searchTerm}
          />

          {/* Footer */}
          <DefaultDropdownFooter
            setShowTranslator={setShowTranslator}
            setShowLanguageTutor={setShowLanguageTutor}
            setShowSuggestionModal={setShowSuggestionModal}
            setIsOpen={setIsOpen}
            availableLanguages={availableLanguages}
          />
        </div>
      )}

      {/* Modals */}
      <DefaultModals
        showSuggestionModal={showSuggestionModal}
        setShowSuggestionModal={setShowSuggestionModal}
        onReportBug={onReportBug}
        showTranslator={showTranslator}
        setShowTranslator={setShowTranslator}
        showLanguageTutor={showLanguageTutor}
        setShowLanguageTutor={setShowLanguageTutor}
      />
    </div>
  );
};

function useCloseDropdownOnOutsideClick(dropdownRef, setIsOpen, setSearchTerm) {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef, setIsOpen, setSearchTerm]);
}

function filterLanguagesBySearch(availableLanguages, searchTerm) {
  return availableLanguages.filter(
    (lang) =>
      lang.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchTerm.toLowerCase()),
  );
}

/**
 * LanguageSelector - Dropdown to switch app language
 * @param {string} variant - 'dropdown' | 'inline' | 'compact'
 * @param {boolean} showFlag - Show flag emoji
 * @param {boolean} showNativeName - Show native language name
 * @param {boolean} groupByRegion - Group languages by region (default true for dropdown)
 * @param {string} className - Additional CSS classes
 * @param {function} onReportBug - Handler for bug reporting (passed to child modals)
 */
function useLanguageSelectorState({ className, showFlag, onReportBug }) {
  const {
    language,
    setLanguage,
    getCurrentLanguage,
    getAvailableLanguages,
    t,
    SUPPORTED_LANGUAGES,
  } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [showTranslator, setShowTranslator] = useState(false);
  const [showLanguageTutor, setShowLanguageTutor] = useState(false);
  const dropdownRef = useRef(null);
  const currentLang = getCurrentLanguage();
  const availableLanguages = getAvailableLanguages();

  // Close dropdown when clicking outside
  useCloseDropdownOnOutsideClick(dropdownRef, setIsOpen, setSearchTerm);

  // Handle language change
  const handleLanguageChange = (langCode) => {
    setLanguage(langCode);
    setIsOpen(false);
    setSearchTerm("");
  };

  // Filter languages by search term
  const filteredLanguages = filterLanguagesBySearch(
    availableLanguages,
    searchTerm,
  );

  // Group languages by region
  const getLanguagesByRegion = (regionId) => {
    return filteredLanguages.filter((lang) => lang.region === regionId);
  };

  return {
    SUPPORTED_LANGUAGES,
    isOpen,
    setIsOpen,
    sharedVariantProps: {
      dropdownRef,
      className,
      isOpen,
      setIsOpen,
      t,
      showFlag,
      language,
      currentLang,
      searchTerm,
      setSearchTerm,
      getLanguagesByRegion,
      filteredLanguages,
      handleLanguageChange,
      availableLanguages,
      setShowTranslator,
      setShowLanguageTutor,
      setShowSuggestionModal,
      showSuggestionModal,
      showTranslator,
      showLanguageTutor,
      onReportBug,
    },
    language,
    handleLanguageChange,
  };
}

const LanguageSelector = ({
  variant = "dropdown",
  showFlag = true,
  showNativeName = true,
  groupByRegion = true,
  className = "",
  onReportBug,
}) => {
  const { SUPPORTED_LANGUAGES, isOpen, setIsOpen, sharedVariantProps, language, handleLanguageChange } =
    useLanguageSelectorState({ className, showFlag, onReportBug });

  if (variant === "compact") {
    return (
      <CompactVariant {...sharedVariantProps} groupByRegion={groupByRegion} />
    );
  }

  if (variant === "inline") {
    return (
      <InlineVariant
        className={className}
        SUPPORTED_LANGUAGES={SUPPORTED_LANGUAGES}
        language={language}
        handleLanguageChange={handleLanguageChange}
        showFlag={showFlag}
        showNativeName={showNativeName}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />
    );
  }

  return (
    <DefaultDropdownVariant
      {...sharedVariantProps}
      showNativeName={showNativeName}
    />
  );
};

export default LanguageSelector;
