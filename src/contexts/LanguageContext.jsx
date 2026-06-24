/**
 * Vet-Rate.org - Language Context
 * Full app-wide language switching with native language UI + English form submission
 *
 * Supports: English (en), Spanish (es), Tagalog (tl), Vietnamese (vi), Korean (ko)
 *
 * Veterans see the entire app in their native language, but all VA forms
 * are still generated and submitted in English (VA requirement).
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

// Storage key for language preference
const LANGUAGE_STORAGE_KEY = "vetrate_language";

// Supported languages with metadata
// Organized by veteran population significance and military service rates
export const SUPPORTED_LANGUAGES = {
  // === PRIMARY LANGUAGES ===
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "🇺🇸",
    direction: "ltr",
    voiceCode: "en-US",
    region: "primary",
  },
  es: {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    flag: "🇲🇽",
    direction: "ltr",
    voiceCode: "es-MX",
    region: "primary",
  },

  // === PACIFIC ISLANDER (Highest per-capita military service!) ===
  ch: {
    code: "ch",
    name: "Chamorro",
    nativeName: "Chamoru",
    flag: "🇬🇺",
    direction: "ltr",
    voiceCode: "en-US", // Fallback
    region: "pacific",
    note: "Guam has the highest per-capita military service rate in the US",
  },
  sm: {
    code: "sm",
    name: "Samoan",
    nativeName: "Gagana Sāmoa",
    flag: "🇦🇸",
    direction: "ltr",
    voiceCode: "en-US", // Fallback
    region: "pacific",
    note: "American Samoa has extremely high military enlistment",
  },
  haw: {
    code: "haw",
    name: "Hawaiian",
    nativeName: "ʻŌlelo Hawaiʻi",
    flag: "🌺",
    direction: "ltr",
    voiceCode: "en-US",
    region: "pacific",
  },
  to: {
    code: "to",
    name: "Tongan",
    nativeName: "Lea Faka-Tonga",
    flag: "🇹🇴",
    direction: "ltr",
    voiceCode: "en-US",
    region: "pacific",
  },

  // === ASIAN LANGUAGES ===
  tl: {
    code: "tl",
    name: "Tagalog",
    nativeName: "Tagalog",
    flag: "🇵🇭",
    direction: "ltr",
    voiceCode: "fil-PH",
    region: "asian",
  },
  vi: {
    code: "vi",
    name: "Vietnamese",
    nativeName: "Tiếng Việt",
    flag: "🇻🇳",
    direction: "ltr",
    voiceCode: "vi-VN",
    region: "asian",
  },
  ko: {
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
    flag: "🇰🇷",
    direction: "ltr",
    voiceCode: "ko-KR",
    region: "asian",
  },
  zh: {
    code: "zh",
    name: "Chinese (Mandarin)",
    nativeName: "中文",
    flag: "🇨🇳",
    direction: "ltr",
    voiceCode: "zh-CN",
    region: "asian",
  },
  ja: {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    flag: "🇯🇵",
    direction: "ltr",
    voiceCode: "ja-JP",
    region: "asian",
  },
  hmn: {
    code: "hmn",
    name: "Hmong",
    nativeName: "Hmoob",
    flag: "🏔️",
    direction: "ltr",
    voiceCode: "en-US",
    region: "asian",
    note: "Significant veteran community from Vietnam War era",
  },
  th: {
    code: "th",
    name: "Thai",
    nativeName: "ภาษาไทย",
    flag: "🇹🇭",
    direction: "ltr",
    voiceCode: "th-TH",
    region: "asian",
  },
  km: {
    code: "km",
    name: "Khmer",
    nativeName: "ភាសាខ្មែរ",
    flag: "🇰🇭",
    direction: "ltr",
    voiceCode: "km-KH",
    region: "asian",
  },
  lo: {
    code: "lo",
    name: "Lao",
    nativeName: "ພາສາລາວ",
    flag: "🇱🇦",
    direction: "ltr",
    voiceCode: "lo-LA",
    region: "asian",
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    flag: "🇮🇳",
    direction: "ltr",
    voiceCode: "hi-IN",
    region: "asian",
  },
  pa: {
    code: "pa",
    name: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    flag: "🇮🇳",
    direction: "ltr",
    voiceCode: "pa-IN",
    region: "asian",
  },

  // === AFRICAN LANGUAGES ===
  am: {
    code: "am",
    name: "Amharic",
    nativeName: "አማርኛ",
    flag: "🇪🇹",
    direction: "ltr",
    voiceCode: "am-ET",
    region: "african",
  },
  so: {
    code: "so",
    name: "Somali",
    nativeName: "Soomaali",
    flag: "🇸🇴",
    direction: "ltr",
    voiceCode: "so-SO",
    region: "african",
    note: "Significant refugee-veteran population",
  },
  sw: {
    code: "sw",
    name: "Swahili",
    nativeName: "Kiswahili",
    flag: "🇰🇪",
    direction: "ltr",
    voiceCode: "sw-KE",
    region: "african",
  },
  ha: {
    code: "ha",
    name: "Hausa",
    nativeName: "Hausa",
    flag: "🇳🇬",
    direction: "ltr",
    voiceCode: "ha-NG",
    region: "african",
  },
  yo: {
    code: "yo",
    name: "Yoruba",
    nativeName: "Yorùbá",
    flag: "🇳🇬",
    direction: "ltr",
    voiceCode: "yo-NG",
    region: "african",
  },
  ig: {
    code: "ig",
    name: "Igbo",
    nativeName: "Igbo",
    flag: "🇳🇬",
    direction: "ltr",
    voiceCode: "ig-NG",
    region: "african",
  },
  zu: {
    code: "zu",
    name: "Zulu",
    nativeName: "isiZulu",
    flag: "🇿🇦",
    direction: "ltr",
    voiceCode: "zu-ZA",
    region: "african",
  },
  xh: {
    code: "xh",
    name: "Xhosa",
    nativeName: "isiXhosa",
    flag: "🇿🇦",
    direction: "ltr",
    voiceCode: "xh-ZA",
    region: "african",
  },

  // === MIDDLE EASTERN / ARABIC ===
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    flag: "🇸🇦",
    direction: "rtl",
    voiceCode: "ar-SA",
    region: "middle-eastern",
  },
  fa: {
    code: "fa",
    name: "Farsi (Persian)",
    nativeName: "فارسی",
    flag: "🇮🇷",
    direction: "rtl",
    voiceCode: "fa-IR",
    region: "middle-eastern",
  },
  prs: {
    code: "prs",
    name: "Dari",
    nativeName: "دری",
    flag: "🇦🇫",
    direction: "rtl",
    voiceCode: "fa-AF",
    region: "middle-eastern",
    note: "Afghan interpreters and SIV holders",
  },
  ps: {
    code: "ps",
    name: "Pashto",
    nativeName: "پښتو",
    flag: "🇦🇫",
    direction: "rtl",
    voiceCode: "ps-AF",
    region: "middle-eastern",
    note: "Afghan interpreters and SIV holders",
  },

  // === NATIVE AMERICAN (Honoring Code Talker Heritage) ===
  nv: {
    code: "nv",
    name: "Navajo (Diné)",
    nativeName: "Diné bizaad",
    flag: "🏜️",
    direction: "ltr",
    voiceCode: "en-US",
    region: "native-american",
    note: "Honoring the Navajo Code Talkers legacy",
  },
  chr: {
    code: "chr",
    name: "Cherokee",
    nativeName: "ᏣᎳᎩ",
    flag: "🪶",
    direction: "ltr",
    voiceCode: "en-US",
    region: "native-american",
  },
  lkt: {
    code: "lkt",
    name: "Lakota",
    nativeName: "Lakȟótiyapi",
    flag: "🦅",
    direction: "ltr",
    voiceCode: "en-US",
    region: "native-american",
  },

  // === CARIBBEAN ===
  ht: {
    code: "ht",
    name: "Haitian Creole",
    nativeName: "Kreyòl Ayisyen",
    flag: "🇭🇹",
    direction: "ltr",
    voiceCode: "ht-HT",
    region: "caribbean",
  },

  // === EUROPEAN ===
  de: {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    flag: "🇩🇪",
    direction: "ltr",
    voiceCode: "de-DE",
    region: "european",
  },
  fr: {
    code: "fr",
    name: "French",
    nativeName: "Français",
    flag: "🇫🇷",
    direction: "ltr",
    voiceCode: "fr-FR",
    region: "european",
  },
  pt: {
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    flag: "🇧🇷",
    direction: "ltr",
    voiceCode: "pt-BR",
    region: "european",
  },
  ru: {
    code: "ru",
    name: "Russian",
    nativeName: "Русский",
    flag: "🇷🇺",
    direction: "ltr",
    voiceCode: "ru-RU",
    region: "european",
  },
  pl: {
    code: "pl",
    name: "Polish",
    nativeName: "Polski",
    flag: "🇵🇱",
    direction: "ltr",
    voiceCode: "pl-PL",
    region: "european",
  },
  it: {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    flag: "🇮🇹",
    direction: "ltr",
    voiceCode: "it-IT",
    region: "european",
  },
  uk: {
    code: "uk",
    name: "Ukrainian",
    nativeName: "Українська",
    flag: "🇺🇦",
    direction: "ltr",
    voiceCode: "uk-UA",
    region: "european",
  },
  ro: {
    code: "ro",
    name: "Romanian",
    nativeName: "Română",
    flag: "🇷🇴",
    direction: "ltr",
    voiceCode: "ro-RO",
    region: "european",
    note: "NATO coalition partner - Afghanistan & Iraq operations",
  },
  cs: {
    code: "cs",
    name: "Czech",
    nativeName: "Čeština",
    flag: "🇨🇿",
    direction: "ltr",
    voiceCode: "cs-CZ",
    region: "european",
    note: "NATO coalition partner",
  },
  sk: {
    code: "sk",
    name: "Slovak",
    nativeName: "Slovenčina",
    flag: "🇸🇰",
    direction: "ltr",
    voiceCode: "sk-SK",
    region: "european",
    note: "NATO coalition partner",
  },
  bg: {
    code: "bg",
    name: "Bulgarian",
    nativeName: "Български",
    flag: "🇧🇬",
    direction: "ltr",
    voiceCode: "bg-BG",
    region: "european",
    note: "NATO coalition partner",
  },
  sq: {
    code: "sq",
    name: "Albanian",
    nativeName: "Shqip",
    flag: "🇦🇱",
    direction: "ltr",
    voiceCode: "sq-AL",
    region: "european",
    note: "NATO coalition partner",
  },
  ka: {
    code: "ka",
    name: "Georgian",
    nativeName: "ქართული",
    flag: "🇬🇪",
    direction: "ltr",
    voiceCode: "ka-GE",
    region: "european",
    note: "Coalition partner in Afghanistan & Iraq",
  },
  hr: {
    code: "hr",
    name: "Croatian",
    nativeName: "Hrvatski",
    flag: "🇭🇷",
    direction: "ltr",
    voiceCode: "hr-HR",
    region: "european",
    note: "NATO coalition partner",
  },
  sr: {
    code: "sr",
    name: "Serbian",
    nativeName: "Српски",
    flag: "🇷🇸",
    direction: "ltr",
    voiceCode: "sr-RS",
    region: "european",
  },
  bs: {
    code: "bs",
    name: "Bosnian",
    nativeName: "Bosanski",
    flag: "🇧🇦",
    direction: "ltr",
    voiceCode: "bs-BA",
    region: "european",
  },
  mk: {
    code: "mk",
    name: "Macedonian",
    nativeName: "Македонски",
    flag: "🇲🇰",
    direction: "ltr",
    voiceCode: "mk-MK",
    region: "european",
    note: "NATO coalition partner",
  },
  et: {
    code: "et",
    name: "Estonian",
    nativeName: "Eesti",
    flag: "🇪🇪",
    direction: "ltr",
    voiceCode: "et-EE",
    region: "european",
    note: "NATO coalition partner",
  },
  lv: {
    code: "lv",
    name: "Latvian",
    nativeName: "Latviešu",
    flag: "🇱🇻",
    direction: "ltr",
    voiceCode: "lv-LV",
    region: "european",
    note: "NATO coalition partner",
  },
  lt: {
    code: "lt",
    name: "Lithuanian",
    nativeName: "Lietuvių",
    flag: "🇱🇹",
    direction: "ltr",
    voiceCode: "lt-LT",
    region: "european",
    note: "NATO coalition partner",
  },
  da: {
    code: "da",
    name: "Danish",
    nativeName: "Dansk",
    flag: "🇩🇰",
    direction: "ltr",
    voiceCode: "da-DK",
    region: "european",
    note: "NATO coalition partner - significant Afghanistan presence",
  },
  no: {
    code: "no",
    name: "Norwegian",
    nativeName: "Norsk",
    flag: "🇳🇴",
    direction: "ltr",
    voiceCode: "no-NO",
    region: "european",
    note: "NATO coalition partner",
  },
  sv: {
    code: "sv",
    name: "Swedish",
    nativeName: "Svenska",
    flag: "🇸🇪",
    direction: "ltr",
    voiceCode: "sv-SE",
    region: "european",
    note: "Coalition partner in Afghanistan",
  },
  fi: {
    code: "fi",
    name: "Finnish",
    nativeName: "Suomi",
    flag: "🇫🇮",
    direction: "ltr",
    voiceCode: "fi-FI",
    region: "european",
    note: "Coalition partner in Afghanistan",
  },
  nl: {
    code: "nl",
    name: "Dutch",
    nativeName: "Nederlands",
    flag: "🇳🇱",
    direction: "ltr",
    voiceCode: "nl-NL",
    region: "european",
    note: "NATO coalition partner",
  },
  el: {
    code: "el",
    name: "Greek",
    nativeName: "Ελληνικά",
    flag: "🇬🇷",
    direction: "ltr",
    voiceCode: "el-GR",
    region: "european",
    note: "NATO coalition partner",
  },
  tr: {
    code: "tr",
    name: "Turkish",
    nativeName: "Türkçe",
    flag: "🇹🇷",
    direction: "ltr",
    voiceCode: "tr-TR",
    region: "european",
    note: "NATO coalition partner",
  },
  hu: {
    code: "hu",
    name: "Hungarian",
    nativeName: "Magyar",
    flag: "🇭🇺",
    direction: "ltr",
    voiceCode: "hu-HU",
    region: "european",
    note: "NATO coalition partner",
  },
  sl: {
    code: "sl",
    name: "Slovenian",
    nativeName: "Slovenščina",
    flag: "🇸🇮",
    direction: "ltr",
    voiceCode: "sl-SI",
    region: "european",
    note: "NATO coalition partner",
  },
};

// App-wide translations extracted to reduce this file's size (RT12-4).
// Import for local use (t()/getSection() reference APP_TRANSLATIONS in this module —
// a bare `export … from` re-export creates no local binding, which throws a
// ReferenceError under Vite/esbuild dev), then re-export so existing importers
// (tests, tools) don't need path changes.
import { APP_TRANSLATIONS } from "../i18n/translations";
export { APP_TRANSLATIONS };

// Create context
const LanguageContext = createContext(null);

/**
 * useLanguage hook - Access language functionality
 */
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

/**
 * LanguageProvider Component
 * Provides app-wide language switching
 */
export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    // Try to get saved language, default to English
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES[saved]) {
      return saved;
    }
    // Try to detect browser language
    const browserLang = navigator.language?.split("-")[0];
    if (browserLang && SUPPORTED_LANGUAGES[browserLang]) {
      return browserLang;
    }
    return "en";
  });

  // Update language and save to storage
  const setLanguage = useCallback((newLang) => {
    if (SUPPORTED_LANGUAGES[newLang]) {
      setLanguageState(newLang);
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      // Update document lang attribute for accessibility
      document.documentElement.lang = newLang;
      document.documentElement.dir = SUPPORTED_LANGUAGES[newLang].direction;
      // eslint-disable-next-line no-console
      console.log(
        `🌐 Language changed to: ${SUPPORTED_LANGUAGES[newLang].nativeName}`,
      );
    }
  }, []);

  // Get translation for a key
  // Supports both t('section', 'key') and t('section.key') formats
  // Also supports interpolation: t('section.key', { param: value })
  const t = useCallback(
    (sectionOrPath, keyOrParams, params) => {
      let section = sectionOrPath;
      let actualKey = keyOrParams;
      let interpolationParams = params;

      // Handle dot-notation format: t('section.key') or t('section.key', { params })
      if (typeof sectionOrPath === "string" && sectionOrPath.includes(".")) {
        // Check if second param is interpolation object (not a string key)
        if (
          keyOrParams === undefined ||
          (typeof keyOrParams === "object" && keyOrParams !== null)
        ) {
          const parts = sectionOrPath.split(".");
          section = parts[0];
          actualKey = parts.slice(1).join("."); // Support nested keys like 'section.sub.key'
          interpolationParams = keyOrParams; // Second param is interpolation params
        }
      }

      // Handle empty or invalid keys silently
      if (
        !section ||
        !actualKey ||
        (typeof actualKey === "string" && actualKey.trim() === "")
      ) {
        return actualKey || sectionOrPath || "";
      }

      const sectionData = APP_TRANSLATIONS[section];
      if (!sectionData) {
        console.warn(`Translation section not found: ${sectionOrPath}`);
        return typeof actualKey === "string" ? actualKey : sectionOrPath;
      }
      const keyData = sectionData[actualKey];
      if (!keyData) {
        console.warn(`Translation key not found: ${section}.${actualKey}`);
        return typeof actualKey === "string" ? actualKey : sectionOrPath;
      }
      // Get translation for current language, fallback to English
      let result = keyData[language] || keyData.en || actualKey;

      // Handle interpolation: replace {placeholder} with values from params
      if (interpolationParams && typeof interpolationParams === "object") {
        for (const [paramKey, paramValue] of Object.entries(
          interpolationParams,
        )) {
          result = result.replace(
            new RegExp(`\\{${paramKey}\\}`, "g"),
            String(paramValue),
          );
        }
      }

      return result;
    },
    [language],
  );

  // Get all translations for a section
  const getSection = useCallback(
    (section) => {
      const sectionData = APP_TRANSLATIONS[section];
      if (!sectionData) {
        return {};
      }
      const result = {};
      for (const [key, translations] of Object.entries(sectionData)) {
        result[key] = translations[language] || translations.en || key;
      }
      return result;
    },
    [language],
  );

  // Get current language metadata
  const getCurrentLanguage = useCallback(() => {
    return SUPPORTED_LANGUAGES[language];
  }, [language]);

  // Get all available languages
  const getAvailableLanguages = useCallback(() => {
    return Object.values(SUPPORTED_LANGUAGES);
  }, []);

  // Check if current language is English
  const isEnglish = language === "en";

  // Set document language on mount
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = SUPPORTED_LANGUAGES[language].direction;
  }, [language]);

  const value = {
    language,
    setLanguage,
    t,
    getSection,
    getCurrentLanguage,
    getAvailableLanguages,
    isEnglish,
    SUPPORTED_LANGUAGES,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageProvider;
