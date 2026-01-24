// ToolCardButton.jsx
// Generic, color-schema-compliant tool card button for all modes
import React from 'react';
import { getHeaderGradient } from '../utils/colorSchemas';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * ToolCardButton - Consistent button for tool cards using color schema
 * @param {object} props
 * @param {string} [props.gradientType] - Category for color schema (e.g. 'resources', 'evidence', etc.)
 * @param {string} [props.theme] - 'light' | 'dark' (optional, auto-detects if omitted)
 * @param {string} [props.colorBlindMode] - accessibility mode (optional)
 * @param {string} [props.className] - Additional classes
 * @param {React.ReactNode} props.children - Button content
 * @param {any} rest - Other button props
 */
export default function ToolCardButton({
  gradientType = 'resources',
  theme,
  colorBlindMode,
  className = '',
  children,
  ...rest
}) {
  const { t } = useLanguage();
  // Use color schema utility for gradient
  const gradientClass = getHeaderGradient(gradientType, theme, colorBlindMode);
  return (
    <button
      className={`w-full px-4 py-3 min-h-[52px] ${gradientClass} text-white rounded-lg font-bold hover:opacity-90 transition-all shadow-md hover:shadow-lg mt-auto ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
