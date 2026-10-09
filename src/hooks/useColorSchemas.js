/**
 * Custom hook for accessing color schemas
 * Provides easy access to WCAG-compliant, color-blind-friendly colors
 * throughout the application
 */

import { useTheme } from "../contexts/ThemeContext";

/**
 * Hook to access centralized color schemas
 * @returns {Object} Color utilities and classes
 */
export function useColorSchemas() {
  const {
    theme,
    colorBlindMode,
    getModalClasses,
    getSectionClasses,
    getHeaderGradient,
    getDropdownClasses,
    getColorClass,
    colors,
  } = useTheme();

  return {
    theme,
    colorBlindMode,
    // Utility functions
    getModalClasses,
    getSectionClasses,
    getHeaderGradient,
    getDropdownClasses,
    getColorClass,
    // Direct color access
    colors,
    // Convenience shortcuts
    isDark: theme === "dark",
    isLight: theme === "light",
    isColorBlind: colorBlindMode !== "none",
    isHighContrast: colorBlindMode === "high-contrast",
  };
}

export default useColorSchemas;
