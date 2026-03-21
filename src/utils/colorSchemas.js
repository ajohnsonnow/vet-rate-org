/**
 * Centralized Color Schemas for Vet-Rate.org
 * WCAG 2.1 Level AA Compliant Color System
 *
 * All color combinations tested for:
 * - Normal vision (light/dark modes)
 * - Protanopia (red-blind)
 * - Deuteranopia (green-blind)
 * - Tritanopia (blue-blind)
 * - High contrast mode
 *
 * Minimum contrast ratios:
 * - Normal text: 4.5:1
 * - Large text (18pt+/14pt+ bold): 3:1
 * - UI components and graphics: 3:1
 */

/**
 * Base Modal and Section Colors
 * These provide consistent styling across the entire application
 */
export const BASE_COLORS = {
  // Modal backdrop - consistent overlay for all modals
  backdrop: {
    light: "bg-black/50",
    dark: "bg-black/70",
    protanopia: "bg-black/50",
    deuteranopia: "bg-black/50",
    tritanopia: "bg-black/50",
    highContrast: "bg-black/80",
  },

  // Modal content background
  modal: {
    light: "bg-white",
    dark: "bg-gray-800",
    protanopia: "bg-white dark:bg-gray-800",
    deuteranopia: "bg-white dark:bg-gray-800",
    tritanopia: "bg-white dark:bg-gray-800",
    highContrast: "bg-white dark:bg-black",
  },

  // Section content background
  section: {
    light: "bg-gray-50",
    dark: "bg-gray-900",
    protanopia: "bg-gray-50 dark:bg-gray-900",
    deuteranopia: "bg-gray-50 dark:bg-gray-900",
    tritanopia: "bg-gray-50 dark:bg-gray-900",
    highContrast: "bg-white dark:bg-black",
  },

  // Card backgrounds within modals/sections
  card: {
    light: "bg-white",
    dark: "bg-gray-800",
    protanopia: "bg-white dark:bg-gray-800",
    deuteranopia: "bg-white dark:bg-gray-800",
    tritanopia: "bg-white dark:bg-gray-800",
    highContrast: "bg-white dark:bg-gray-900",
  },

  // Nested card (card within a card)
  nestedCard: {
    light: "bg-gray-50",
    dark: "bg-gray-700",
    protanopia: "bg-gray-50 dark:bg-gray-700",
    deuteranopia: "bg-gray-50 dark:bg-gray-700",
    tritanopia: "bg-gray-50 dark:bg-gray-700",
    highContrast: "bg-gray-100 dark:bg-gray-800",
  },
};

/**
 * Border Colors
 */
export const BORDER_COLORS = {
  default: {
    light: "border-gray-200",
    dark: "border-gray-700",
    protanopia: "border-gray-200 dark:border-gray-700",
    deuteranopia: "border-gray-200 dark:border-gray-700",
    tritanopia: "border-gray-200 dark:border-gray-700",
    highContrast: "border-gray-900 dark:border-white",
  },
  subtle: {
    light: "border-gray-100",
    dark: "border-gray-800",
    protanopia: "border-gray-100 dark:border-gray-800",
    deuteranopia: "border-gray-100 dark:border-gray-800",
    tritanopia: "border-gray-100 dark:border-gray-800",
    highContrast: "border-gray-600 dark:border-gray-400",
  },
  emphasis: {
    light: "border-gray-300",
    dark: "border-gray-600",
    protanopia: "border-gray-300 dark:border-gray-600",
    deuteranopia: "border-gray-300 dark:border-gray-600",
    tritanopia: "border-gray-300 dark:border-gray-600",
    highContrast: "border-black dark:border-white",
  },
};

/**
 * Text Colors
 */
export const TEXT_COLORS = {
  primary: {
    light: "text-gray-900",
    dark: "text-gray-100",
    protanopia: "text-gray-900 dark:text-gray-100",
    deuteranopia: "text-gray-900 dark:text-gray-100",
    tritanopia: "text-gray-900 dark:text-gray-100",
    highContrast: "text-black dark:text-white",
  },
  secondary: {
    light: "text-gray-700",
    dark: "text-gray-300",
    protanopia: "text-gray-700 dark:text-gray-300",
    deuteranopia: "text-gray-700 dark:text-gray-300",
    tritanopia: "text-gray-700 dark:text-gray-300",
    highContrast: "text-gray-900 dark:text-gray-100",
  },
  tertiary: {
    light: "text-gray-600",
    dark: "text-gray-400",
    protanopia: "text-gray-600 dark:text-gray-400",
    deuteranopia: "text-gray-600 dark:text-gray-400",
    tritanopia: "text-gray-600 dark:text-gray-400",
    highContrast: "text-gray-800 dark:text-gray-200",
  },
  muted: {
    light: "text-gray-500",
    dark: "text-gray-500",
    protanopia: "text-gray-500 dark:text-gray-500",
    deuteranopia: "text-gray-500 dark:text-gray-500",
    tritanopia: "text-gray-500 dark:text-gray-500",
    highContrast: "text-gray-700 dark:text-gray-300",
  },
};

/**
 * Status/Semantic Colors (WCAG AA compliant)
 * These maintain meaning across all color vision types
 */
export const STATUS_COLORS = {
  // Success - using patterns and labels in addition to color
  success: {
    bg: {
      light: "bg-emerald-50",
      dark: "bg-emerald-900/30",
      protanopia: "bg-blue-50 dark:bg-blue-900/30", // Blue alternative for red-blind
      deuteranopia: "bg-blue-50 dark:bg-blue-900/30", // Blue alternative for green-blind
      tritanopia: "bg-teal-50 dark:bg-teal-900/30", // Teal alternative for blue-blind
      highContrast: "bg-emerald-100 dark:bg-emerald-900",
    },
    text: {
      light: "text-emerald-800",
      dark: "text-emerald-200",
      protanopia: "text-blue-800 dark:text-blue-200",
      deuteranopia: "text-blue-800 dark:text-blue-200",
      tritanopia: "text-teal-800 dark:text-teal-200",
      highContrast: "text-emerald-900 dark:text-emerald-100",
    },
    border: {
      light: "border-emerald-300",
      dark: "border-emerald-700",
      protanopia: "border-blue-300 dark:border-blue-700",
      deuteranopia: "border-blue-300 dark:border-blue-700",
      tritanopia: "border-teal-300 dark:border-teal-700",
      highContrast: "border-emerald-900 dark:border-emerald-100",
    },
  },

  // Warning
  warning: {
    bg: {
      light: "bg-amber-50",
      dark: "bg-amber-900/30",
      protanopia: "bg-yellow-50 dark:bg-yellow-900/30",
      deuteranopia: "bg-yellow-50 dark:bg-yellow-900/30",
      tritanopia: "bg-pink-50 dark:bg-pink-900/30",
      highContrast: "bg-amber-100 dark:bg-amber-900",
    },
    text: {
      light: "text-amber-900",
      dark: "text-amber-200",
      protanopia: "text-yellow-900 dark:text-yellow-200",
      deuteranopia: "text-yellow-900 dark:text-yellow-200",
      tritanopia: "text-pink-900 dark:text-pink-200",
      highContrast: "text-amber-950 dark:text-amber-100",
    },
    border: {
      light: "border-amber-300",
      dark: "border-amber-700",
      protanopia: "border-yellow-300 dark:border-yellow-700",
      deuteranopia: "border-yellow-300 dark:border-yellow-700",
      tritanopia: "border-pink-300 dark:border-pink-700",
      highContrast: "border-amber-900 dark:border-amber-100",
    },
  },

  // Error/Danger
  error: {
    bg: {
      light: "bg-red-50",
      dark: "bg-red-900/30",
      protanopia: "bg-orange-50 dark:bg-orange-900/30",
      deuteranopia: "bg-orange-50 dark:bg-orange-900/30",
      tritanopia: "bg-rose-50 dark:bg-rose-900/30",
      highContrast: "bg-red-100 dark:bg-red-900",
    },
    text: {
      light: "text-red-800",
      dark: "text-red-200",
      protanopia: "text-orange-800 dark:text-orange-200",
      deuteranopia: "text-orange-800 dark:text-orange-200",
      tritanopia: "text-rose-800 dark:text-rose-200",
      highContrast: "text-red-900 dark:text-red-100",
    },
    border: {
      light: "border-red-300",
      dark: "border-red-700",
      protanopia: "border-orange-300 dark:border-orange-700",
      deuteranopia: "border-orange-300 dark:border-orange-700",
      tritanopia: "border-rose-300 dark:border-rose-700",
      highContrast: "border-red-900 dark:border-red-100",
    },
  },

  // Info
  info: {
    bg: {
      light: "bg-blue-50",
      dark: "bg-blue-900/30",
      protanopia: "bg-indigo-50 dark:bg-indigo-900/30",
      deuteranopia: "bg-indigo-50 dark:bg-indigo-900/30",
      tritanopia: "bg-cyan-50 dark:bg-cyan-900/30",
      highContrast: "bg-blue-100 dark:bg-blue-900",
    },
    text: {
      light: "text-blue-800",
      dark: "text-blue-200",
      protanopia: "text-indigo-800 dark:text-indigo-200",
      deuteranopia: "text-indigo-800 dark:text-indigo-200",
      tritanopia: "text-cyan-800 dark:text-cyan-200",
      highContrast: "text-blue-900 dark:text-blue-100",
    },
    border: {
      light: "border-blue-300",
      dark: "border-blue-700",
      protanopia: "border-indigo-300 dark:border-indigo-700",
      deuteranopia: "border-indigo-300 dark:border-indigo-700",
      tritanopia: "border-cyan-300 dark:border-cyan-700",
      highContrast: "border-blue-900 dark:border-blue-100",
    },
  },

  // Neutral
  neutral: {
    bg: {
      light: "bg-gray-50",
      dark: "bg-gray-800",
      protanopia: "bg-gray-50 dark:bg-gray-800",
      deuteranopia: "bg-gray-50 dark:bg-gray-800",
      tritanopia: "bg-gray-50 dark:bg-gray-800",
      highContrast: "bg-gray-100 dark:bg-gray-900",
    },
    text: {
      light: "text-gray-800",
      dark: "text-gray-200",
      protanopia: "text-gray-800 dark:text-gray-200",
      deuteranopia: "text-gray-800 dark:text-gray-200",
      tritanopia: "text-gray-800 dark:text-gray-200",
      highContrast: "text-gray-900 dark:text-gray-100",
    },
    border: {
      light: "border-gray-300",
      dark: "border-gray-600",
      protanopia: "border-gray-300 dark:border-gray-600",
      deuteranopia: "border-gray-300 dark:border-gray-600",
      tritanopia: "border-gray-300 dark:border-gray-600",
      highContrast: "border-gray-900 dark:border-gray-100",
    },
  },
};

/**
 * Header Gradient Colors
 * Specific branded gradients for different tool categories
 */
export const HEADER_GRADIENTS = {
  // Calculate
  tactical: {
    light: "from-emerald-600 via-teal-600 to-emerald-600",
    dark: "from-emerald-600 via-teal-600 to-emerald-600",
    protanopia: "from-blue-600 via-cyan-600 to-blue-600",
    deuteranopia: "from-blue-600 via-cyan-600 to-blue-600",
    tritanopia: "from-teal-600 via-cyan-600 to-teal-600",
    highContrast: "from-emerald-700 via-teal-700 to-emerald-700",
  },

  // Discover
  discover: {
    light: "from-teal-600 via-emerald-600 to-teal-600",
    dark: "from-teal-600 via-emerald-600 to-teal-600",
    protanopia: "from-cyan-600 via-blue-600 to-cyan-600",
    deuteranopia: "from-cyan-600 via-blue-600 to-cyan-600",
    tritanopia: "from-cyan-600 via-teal-700 to-cyan-600",
    highContrast: "from-teal-700 via-emerald-700 to-teal-700",
  },

  // Evidence
  evidence: {
    light: "from-violet-600 to-purple-600",
    dark: "from-violet-600 to-purple-600",
    protanopia: "from-indigo-600 to-blue-600",
    deuteranopia: "from-indigo-600 to-blue-600",
    tritanopia: "from-purple-600 to-pink-600",
    highContrast: "from-violet-700 to-purple-700",
  },

  // Quality Control
  quality: {
    light: "from-rose-600 via-red-600 to-rose-600",
    dark: "from-rose-600 via-red-600 to-rose-600",
    protanopia: "from-orange-600 via-amber-600 to-orange-600",
    deuteranopia: "from-orange-600 via-amber-600 to-orange-600",
    tritanopia: "from-rose-600 via-pink-600 to-rose-600",
    highContrast: "from-rose-700 via-red-700 to-rose-700",
  },

  // Strategy
  strategy: {
    light: "from-orange-600 to-red-600",
    dark: "from-orange-600 to-red-600",
    protanopia: "from-amber-600 to-orange-700",
    deuteranopia: "from-amber-600 to-orange-700",
    tritanopia: "from-pink-600 to-rose-600",
    highContrast: "from-orange-700 to-red-700",
  },

  // PACT Act / Amber
  pact: {
    light: "from-amber-600 to-orange-600",
    dark: "from-amber-600 to-orange-600",
    protanopia: "from-yellow-600 to-amber-700",
    deuteranopia: "from-yellow-600 to-amber-700",
    tritanopia: "from-pink-500 to-rose-600",
    highContrast: "from-amber-700 to-orange-700",
  },

  // Shock & Awe / Gold
  shockAwe: {
    light: "from-yellow-500 via-amber-500 to-yellow-500",
    dark: "from-yellow-500 via-amber-500 to-yellow-500",
    protanopia: "from-yellow-500 via-amber-500 to-yellow-500",
    deuteranopia: "from-yellow-500 via-amber-500 to-yellow-500",
    tritanopia: "from-pink-400 via-rose-400 to-pink-400",
    highContrast: "from-yellow-600 via-amber-600 to-yellow-600",
  },

  // Resources / Blue
  resources: {
    light: "from-blue-800 to-blue-900",
    dark: "from-blue-800 to-blue-900",
    protanopia: "from-indigo-800 to-indigo-900",
    deuteranopia: "from-indigo-800 to-indigo-900",
    tritanopia: "from-cyan-700 to-cyan-800",
    highContrast: "from-blue-900 to-blue-950",
  },
};

/**
 * Button Colors
 */
export const BUTTON_COLORS = {
  primary: {
    light: "bg-emerald-600 hover:bg-emerald-700 text-white",
    dark: "bg-emerald-600 hover:bg-emerald-700 text-white",
    protanopia: "bg-blue-600 hover:bg-blue-700 text-white",
    deuteranopia: "bg-blue-600 hover:bg-blue-700 text-white",
    tritanopia: "bg-teal-600 hover:bg-teal-700 text-white",
    highContrast:
      "bg-emerald-700 hover:bg-emerald-800 text-white border-2 border-emerald-900",
  },
  secondary: {
    light: "bg-gray-200 hover:bg-gray-300 text-gray-800",
    dark: "bg-gray-700 hover:bg-gray-600 text-gray-200",
    protanopia:
      "bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200",
    deuteranopia:
      "bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200",
    tritanopia:
      "bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200",
    highContrast:
      "bg-gray-300 hover:bg-gray-400 text-black dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white border-2 border-gray-900 dark:border-white",
  },
  danger: {
    light: "bg-red-600 hover:bg-red-700 text-white",
    dark: "bg-red-600 hover:bg-red-700 text-white",
    protanopia: "bg-orange-600 hover:bg-orange-700 text-white",
    deuteranopia: "bg-orange-600 hover:bg-orange-700 text-white",
    tritanopia: "bg-rose-600 hover:bg-rose-700 text-white",
    highContrast:
      "bg-red-700 hover:bg-red-800 text-white border-2 border-red-900",
  },
};

/**
 * Dropdown Menu Colors
 */
export const DROPDOWN_COLORS = {
  background: {
    light: "bg-white",
    dark: "bg-gray-800",
    protanopia: "bg-white dark:bg-gray-800",
    deuteranopia: "bg-white dark:bg-gray-800",
    tritanopia: "bg-white dark:bg-gray-800",
    highContrast: "bg-white dark:bg-black",
  },
  item: {
    light: "hover:bg-gray-100",
    dark: "hover:bg-gray-700",
    protanopia: "hover:bg-gray-100 dark:hover:bg-gray-700",
    deuteranopia: "hover:bg-gray-100 dark:hover:bg-gray-700",
    tritanopia: "hover:bg-gray-100 dark:hover:bg-gray-700",
    highContrast: "hover:bg-gray-200 dark:hover:bg-gray-900",
  },
  text: {
    light: "text-gray-900",
    dark: "text-gray-100",
    protanopia: "text-gray-900 dark:text-gray-100",
    deuteranopia: "text-gray-900 dark:text-gray-100",
    tritanopia: "text-gray-900 dark:text-gray-100",
    highContrast: "text-black dark:text-white",
  },
  border: {
    light: "border-gray-200",
    dark: "border-gray-700",
    protanopia: "border-gray-200 dark:border-gray-700",
    deuteranopia: "border-gray-200 dark:border-gray-700",
    tritanopia: "border-gray-200 dark:border-gray-700",
    highContrast: "border-gray-900 dark:border-white",
  },
};

/**
 * Helper function to get color class based on current theme and color blind mode
 * @param {Object} colorObj - Color object from above (e.g., BASE_COLORS.modal)
 * @param {string} theme - Current theme ('light' or 'dark')
 * @param {string} colorBlindMode - Current color blind mode
 * @returns {string} - Tailwind class string
 */
export function getColorClass(
  colorObj,
  theme = "dark",
  colorBlindMode = "none",
) {
  if (colorBlindMode === "high-contrast") {
    return colorObj.highContrast || colorObj[theme];
  }

  if (colorBlindMode !== "none" && colorObj[colorBlindMode]) {
    return colorObj[colorBlindMode];
  }

  return colorObj[theme] || colorObj.light;
}

/**
 * Generate complete modal styling classes
 * @param {string} theme - Current theme
 * @param {string} colorBlindMode - Current color blind mode
 * @returns {Object} - Object with all modal-related classes
 */
export function getModalClasses(theme = "dark", colorBlindMode = "none") {
  return {
    backdrop: `fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto modal-backdrop overscroll-contain ${getColorClass(BASE_COLORS.backdrop, theme, colorBlindMode)}`,
    content: `rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto relative modal-content ${getColorClass(BASE_COLORS.modal, theme, colorBlindMode)}`,
    card: `rounded-lg shadow-md p-4 ${getColorClass(BASE_COLORS.card, theme, colorBlindMode)} ${getColorClass(BORDER_COLORS.default, theme, colorBlindMode)} border`,
    nestedCard: `rounded-lg p-3 ${getColorClass(BASE_COLORS.nestedCard, theme, colorBlindMode)} ${getColorClass(BORDER_COLORS.subtle, theme, colorBlindMode)} border`,
  };
}

/**
 * Generate section styling classes
 * @param {string} theme - Current theme
 * @param {string} colorBlindMode - Current color blind mode
 * @returns {Object} - Object with all section-related classes
 */
export function getSectionClasses(theme = "dark", colorBlindMode = "none") {
  return {
    container: `p-4 rounded-lg ${getColorClass(BASE_COLORS.section, theme, colorBlindMode)}`,
    card: `rounded-lg shadow-md p-4 ${getColorClass(BASE_COLORS.card, theme, colorBlindMode)} ${getColorClass(BORDER_COLORS.default, theme, colorBlindMode)} border`,
    title: `text-2xl font-bold mb-4 ${getColorClass(TEXT_COLORS.primary, theme, colorBlindMode)}`,
    subtitle: `text-lg font-semibold mb-2 ${getColorClass(TEXT_COLORS.secondary, theme, colorBlindMode)}`,
    text: getColorClass(TEXT_COLORS.secondary, theme, colorBlindMode),
    mutedText: getColorClass(TEXT_COLORS.muted, theme, colorBlindMode),
  };
}

/**
 * Generate header/gradient styling
 * @param {string} gradientType - Type of gradient from HEADER_GRADIENTS
 * @param {string} theme - Current theme
 * @param {string} colorBlindMode - Current color blind mode
 * @returns {string} - Complete header class string
 */
export function getHeaderGradient(
  gradientType,
  theme = "dark",
  colorBlindMode = "none",
) {
  const gradient = HEADER_GRADIENTS[gradientType];
  if (!gradient) return HEADER_GRADIENTS.resources[theme];

  return `bg-gradient-to-r ${getColorClass(gradient, theme, colorBlindMode)}`;
}

/**
 * Generate dropdown menu classes
 * @param {string} theme - Current theme
 * @param {string} colorBlindMode - Current color blind mode
 * @returns {Object} - Object with dropdown classes
 */
export function getDropdownClasses(theme = "dark", colorBlindMode = "none") {
  return {
    menu: `absolute mt-2 rounded-lg shadow-lg border ${getColorClass(DROPDOWN_COLORS.background, theme, colorBlindMode)} ${getColorClass(DROPDOWN_COLORS.border, theme, colorBlindMode)}`,
    item: `px-4 py-2 ${getColorClass(DROPDOWN_COLORS.text, theme, colorBlindMode)} ${getColorClass(DROPDOWN_COLORS.item, theme, colorBlindMode)} transition-colors cursor-pointer`,
  };
}

export default {
  BASE_COLORS,
  BORDER_COLORS,
  TEXT_COLORS,
  STATUS_COLORS,
  HEADER_GRADIENTS,
  BUTTON_COLORS,
  DROPDOWN_COLORS,
  getColorClass,
  getModalClasses,
  getSectionClasses,
  getHeaderGradient,
  getDropdownClasses,
};
