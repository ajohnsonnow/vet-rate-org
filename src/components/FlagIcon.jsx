/**
 * Vet-Rate.org - FlagIcon Component
 * 
 * Renders country/region flags using flag-icons CSS library or fallback text.
 * Solves the issue where Windows browsers display emoji flags like 🇺🇸 as "US" letters.
 * 
 * Uses the open-source flag-icons library (https://flagicons.lipis.dev/)
 * Falls back to language code badges for regions without flags (like Hmong, Hawaiian)
 */

import React from 'react';

// Map language/region codes to their flag-icons country codes
// Some languages don't have country flags, so we use alternatives
const FLAG_CODE_MAP = {
  // Primary
  'en': 'us',
  'es': 'mx',
  
  // Pacific Islander
  'ch': 'gu',     // Chamorro → Guam
  'sm': 'as',     // Samoan → American Samoa
  'haw': null,    // Hawaiian - no flag, use flower emoji
  'to': 'to',     // Tongan → Tonga
  
  // Asian
  'tl': 'ph',     // Tagalog → Philippines
  'vi': 'vn',     // Vietnamese → Vietnam
  'ko': 'kr',     // Korean → South Korea
  'zh': 'cn',     // Chinese → China
  'ja': 'jp',     // Japanese → Japan
  'hmn': null,    // Hmong - no flag, use mountain emoji
  'th': 'th',     // Thai → Thailand
  'km': 'kh',     // Khmer → Cambodia
  'lo': 'la',     // Lao → Laos
  'hi': 'in',     // Hindi → India
  'pa': 'in',     // Punjabi → India
  
  // African
  'am': 'et',     // Amharic → Ethiopia
  'so': 'so',     // Somali → Somalia
  'sw': 'ke',     // Swahili → Kenya
  'ha': 'ng',     // Hausa → Nigeria
  'yo': 'ng',     // Yoruba → Nigeria
  'ig': 'ng',     // Igbo → Nigeria
  'zu': 'za',     // Zulu → South Africa
  'xh': 'za',     // Xhosa → South Africa
  
  // Middle Eastern
  'ar': 'sa',     // Arabic → Saudi Arabia
  'fa': 'ir',     // Farsi → Iran
  'prs': 'af',    // Dari → Afghanistan
  'ps': 'af',     // Pashto → Afghanistan
  
  // Native American
  'nv': null,     // Navajo - use feather
  'chr': null,    // Cherokee - use feather
  'lkt': null,    // Lakota - use feather
  
  // Caribbean
  'ht': 'ht',     // Haitian Creole → Haiti
  
  // European
  'de': 'de',     // German → Germany
  'fr': 'fr',     // French → France
  'pt': 'br',     // Portuguese → Brazil
  'ru': 'ru',     // Russian → Russia
  'pl': 'pl',     // Polish → Poland
  'it': 'it',     // Italian → Italy
  'uk': 'ua',     // Ukrainian → Ukraine
};

// Fallback icons for languages without country flags
const FALLBACK_ICONS = {
  'haw': '🌺',    // Hawaiian - hibiscus flower
  'hmn': '🏔️',   // Hmong - mountain (diaspora from highlands)
  'nv': '🪶',     // Navajo - feather
  'chr': '🪶',    // Cherokee - feather
  'lkt': '🪶',    // Lakota - feather
};

/**
 * FlagIcon - Displays a country flag using CSS or fallback
 * 
 * @param {string} langCode - The language code (e.g., 'en', 'es', 'tl')
 * @param {string} size - Size variant: 'xs', 'sm', 'md', 'lg', 'xl' (default: 'md')
 * @param {string} className - Additional CSS classes
 * @param {boolean} rounded - Whether to show rounded corners (default: true)
 * @param {string} fallbackEmoji - Emoji to show if no flag available (from language data)
 */
const FlagIcon = ({ langCode, size = 'md', className = '', rounded = true, fallbackEmoji }) => {
  const countryCode = FLAG_CODE_MAP[langCode];
  const fallback = fallbackEmoji || FALLBACK_ICONS[langCode];
  
  // Size mappings for the flag container
  const sizeClasses = {
    'xs': 'w-4 h-3 text-xs',
    'sm': 'w-5 h-4 text-sm',
    'md': 'w-6 h-4 text-base',
    'lg': 'w-8 h-6 text-lg',
    'xl': 'w-10 h-7 text-xl',
  };
  
  // Emoji size mappings
  const emojiSizes = {
    'xs': 'text-sm',
    'sm': 'text-base',
    'md': 'text-lg',
    'lg': 'text-xl',
    'xl': 'text-2xl',
  };
  
  // If no country code, show fallback emoji or language badge
  if (!countryCode) {
    if (fallback) {
      return (
        <span 
          className={`inline-flex items-center justify-center ${emojiSizes[size]} ${className}`}
          role="img"
          aria-label={`${langCode} flag`}
        >
          {fallback}
        </span>
      );
    }
    
    // Last resort: show language code in a badge
    return (
      <span 
        className={`inline-flex items-center justify-center ${sizeClasses[size]} 
                    bg-gray-600 text-white font-bold uppercase text-[8px] 
                    ${rounded ? 'rounded-sm' : ''} ${className}`}
        aria-label={`${langCode} language`}
      >
        {langCode}
      </span>
    );
  }
  
  // Use flag-icons CSS class
  // This requires the flag-icons CSS to be imported in index.css or loaded via CDN
  return (
    <span 
      className={`fi fi-${countryCode} inline-block ${sizeClasses[size]} 
                  ${rounded ? 'rounded-sm overflow-hidden' : ''} 
                  bg-cover bg-center border border-gray-400/20 ${className}`}
      role="img"
      aria-label={`${countryCode.toUpperCase()} flag`}
      style={{
        // Fallback inline styles in case flag-icons isn't loaded
        backgroundImage: `url(https://flagcdn.com/w40/${countryCode}.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  );
};

/**
 * Utility to check if flag-icons CSS is loaded
 */
export const isFlagIconsLoaded = () => {
  // Check if the flag-icons CSS is available
  const testEl = document.createElement('span');
  testEl.className = 'fi fi-us';
  testEl.style.position = 'absolute';
  testEl.style.visibility = 'hidden';
  document.body.appendChild(testEl);
  
  const hasStyles = getComputedStyle(testEl).backgroundImage !== 'none';
  document.body.removeChild(testEl);
  
  return hasStyles;
};

export default FlagIcon;
