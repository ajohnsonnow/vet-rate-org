import React, { useState, useRef, useEffect } from 'react';
import { useTheme, THEME_MODES, COLOR_BLIND_MODES } from '../contexts/ThemeContext';

export default function AccessibilityMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  
  const {
    theme,
    toggleTheme,
    isDark,
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
      if (menuRef.current && !menuRef.current.contains(event.target) && 
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const colorBlindOptions = [
    { value: COLOR_BLIND_MODES.NONE, label: 'Default Colors', description: 'Standard color palette' },
    { value: COLOR_BLIND_MODES.PROTANOPIA, label: 'Protanopia', description: 'Red-blind friendly' },
    { value: COLOR_BLIND_MODES.DEUTERANOPIA, label: 'Deuteranopia', description: 'Green-blind friendly' },
    { value: COLOR_BLIND_MODES.TRITANOPIA, label: 'Tritanopia', description: 'Blue-blind friendly' },
    { value: COLOR_BLIND_MODES.HIGH_CONTRAST, label: 'High Contrast', description: 'Maximum visibility' },
  ];

  const fontSizeOptions = [
    { value: 'small', label: 'Small', size: '14px' },
    { value: 'normal', label: 'Normal', size: '16px' },
    { value: 'large', label: 'Large', size: '18px' },
    { value: 'xlarge', label: 'Extra Large', size: '20px' },
  ];

  return (
    <div className="relative static sm:relative">
      {/* Accessibility Toggle Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-va-blue"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Accessibility settings menu"
        title="Accessibility Settings"
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
        <span className="hidden md:inline text-sm font-medium">Accessibility</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              ♿ Accessibility Settings
            </h3>
            <p className="text-sm text-green-100 dark:text-gray-300">Section 508 Compliant</p>
          </div>

          <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Dark Mode Toggle */}
            <div className="space-y-2">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-medium">
                  {isDark ? (
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  )}
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </span>
                <button
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-va-blue focus:ring-offset-2 ${
                    isDark ? 'bg-va-gold' : 'bg-gray-300'
                  }`}
                  role="switch"
                  aria-checked={isDark}
                  aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                      isDark ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                Reduce eye strain in low-light conditions
              </p>
            </div>

            <hr className="border-gray-200 dark:border-gray-600" />

            {/* Color Vision Settings */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-va-blue dark:text-va-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Color Vision Settings
              </h4>
              <div className="space-y-2">
                {colorBlindOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      colorBlindMode === option.value
                        ? 'bg-va-blue/10 dark:bg-va-gold/20 border-2 border-va-blue dark:border-va-gold'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
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
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      colorBlindMode === option.value
                        ? 'border-va-blue dark:border-va-gold bg-va-blue dark:bg-va-gold'
                        : 'border-gray-400'
                    }`}>
                      {colorBlindMode === option.value && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{option.label}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <hr className="border-gray-200 dark:border-gray-600" />

            {/* Font Size */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-va-blue dark:text-va-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
                Text Size
              </h4>
              <div className="flex gap-2">
                {fontSizeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFontSize(option.value)}
                    className={`flex-1 py-2 px-3 rounded-lg text-center transition-colors focus:outline-none focus:ring-2 focus:ring-va-blue ${
                      fontSize === option.value
                        ? 'bg-va-blue dark:bg-va-gold text-white font-semibold'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                <svg className="w-5 h-5 text-va-blue dark:text-va-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Reduce Motion
              </span>
              <button
                onClick={() => setReducedMotion(!reducedMotion)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-va-blue focus:ring-offset-2 ${
                  reducedMotion ? 'bg-va-blue dark:bg-va-gold' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={reducedMotion}
                aria-label="Toggle reduced motion"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                    reducedMotion ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            {/* Reset Button */}
            <button
              onClick={() => {
                setColorBlindMode(COLOR_BLIND_MODES.NONE);
                setFontSize('normal');
                setReducedMotion(false);
              }}
              className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-sm focus:outline-none focus:ring-2 focus:ring-va-blue"
            >
              Reset to Defaults
            </button>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              🏛️ Section 508 & WCAG 2.1 AA Compliant
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
