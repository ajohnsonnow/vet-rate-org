import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  getModalClasses, 
  getSectionClasses, 
  getHeaderGradient, 
  getDropdownClasses,
  getColorClass,
  BASE_COLORS,
  TEXT_COLORS,
  STATUS_COLORS,
  BUTTON_COLORS,
  BORDER_COLORS,
} from '../utils/colorSchemas';

const ThemeContext = createContext();

export const THEME_MODES = {
  LIGHT: 'light',
  DARK: 'dark',
};

export const COLOR_BLIND_MODES = {
  NONE: 'none',
  PROTANOPIA: 'protanopia',      // Red-blind
  DEUTERANOPIA: 'deuteranopia',  // Green-blind
  TRITANOPIA: 'tritanopia',      // Blue-blind
  HIGH_CONTRAST: 'high-contrast',
};

export function ThemeProvider({ children }) {
  // Initialize from localStorage or default to dark mode
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('vet-rate-theme');
    if (saved) return saved;
    // Default to dark theme instead of checking system preference
    return THEME_MODES.DARK;
  });

  const [colorBlindMode, setColorBlindMode] = useState(() => {
    return localStorage.getItem('vet-rate-color-blind-mode') || COLOR_BLIND_MODES.NONE;
  });

  const [reducedMotion, setReducedMotion] = useState(() => {
    const saved = localStorage.getItem('vet-rate-reduced-motion');
    if (saved) return saved === 'true';
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem('vet-rate-font-size') || 'normal';
  });

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    
    // Remove all color blind classes
    Object.values(COLOR_BLIND_MODES).forEach(mode => {
      root.classList.remove(`cb-${mode}`);
    });
    if (colorBlindMode !== COLOR_BLIND_MODES.NONE) {
      root.classList.add(`cb-${colorBlindMode}`);
    }

    // Reduced motion
    if (reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    // Font size
    root.classList.remove('font-small', 'font-normal', 'font-large', 'font-xlarge');
    root.classList.add(`font-${fontSize}`);

    // Save to localStorage
    localStorage.setItem('vet-rate-theme', theme);
    localStorage.setItem('vet-rate-color-blind-mode', colorBlindMode);
    localStorage.setItem('vet-rate-reduced-motion', reducedMotion.toString());
    localStorage.setItem('vet-rate-font-size', fontSize);
  }, [theme, colorBlindMode, reducedMotion, fontSize]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!localStorage.getItem('vet-rate-theme')) {
        setTheme(e.matches ? THEME_MODES.DARK : THEME_MODES.LIGHT);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === THEME_MODES.LIGHT ? THEME_MODES.DARK : THEME_MODES.LIGHT);
  };

  const isDark = theme === THEME_MODES.DARK;

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark,
    colorBlindMode,
    setColorBlindMode,
    reducedMotion,
    setReducedMotion,
    fontSize,
    setFontSize,
    // Color utility functions
    getModalClasses: () => getModalClasses(theme, colorBlindMode),
    getSectionClasses: () => getSectionClasses(theme, colorBlindMode),
    getHeaderGradient: (type) => getHeaderGradient(type, theme, colorBlindMode),
    getDropdownClasses: () => getDropdownClasses(theme, colorBlindMode),
    getColorClass: (colorObj) => getColorClass(colorObj, theme, colorBlindMode),
    // Direct color access
    colors: {
      base: BASE_COLORS,
      text: TEXT_COLORS,
      status: STATUS_COLORS,
      button: BUTTON_COLORS,
      border: BORDER_COLORS,
    },
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
