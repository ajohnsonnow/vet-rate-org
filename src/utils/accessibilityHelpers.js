/**
 * Accessibility Helper Utilities
 * "The Blind Spot" Solution
 * 
 * Purpose: Ensure visual dashboards (War Room, Pathfinder) are screen reader friendly.
 * 
 * The Problem:
 * Our "War Room" and "Pathfinder" dashboards use colors (Red/Green/Blue) to convey status.
 * This is invisible to screen readers and colorblind users.
 * 
 * The Fix:
 * Ensure every visual state has:
 * 1. Text equivalent (sr-only spans)
 * 2. Correct ARIA labels
 * 3. Semantic HTML roles
 * 4. Colorblind-friendly patterns
 * 
 * Usage:
 *   import { getStatusARIA, getColorClasses } from './accessibilityHelpers';
 *   
 *   <div {...getStatusARIA('HIGH_RISK')} className={getColorClasses('HIGH_RISK')}>
 *     <span className="sr-only">High Risk Claim</span>
 *     {visualContent}
 *   </div>
 */

// ========================================
// ARIA LABEL GENERATORS
// ========================================

/**
 * Status level definitions with full accessibility metadata
 */
export const STATUS_LEVELS = {
  // War Game / Red Team Statuses
  GRANT: {
    label: 'Approved - Ready to Submit',
    ariaLabel: 'Status: Grant - Claim is ready for submission with high approval likelihood',
    role: 'status',
    icon: '✅',
    shortLabel: 'Grant'
  },
  DENIED: {
    label: 'Denied - Critical Weaknesses Found',
    ariaLabel: 'Status: Denied - Claim has critical weaknesses that must be addressed',
    role: 'alert',
    icon: '❌',
    shortLabel: 'Denied'
  },
  HIGH_RISK: {
    label: 'High Risk - Major Issues',
    ariaLabel: 'Status: High Risk - Claim has major issues requiring immediate attention',
    role: 'alert',
    icon: '⚠️',
    shortLabel: 'High Risk'
  },
  DEVELOPMENT_NEEDED: {
    label: 'Development Needed',
    ariaLabel: 'Status: Development Needed - Claim requires additional evidence before submission',
    role: 'status',
    icon: '🔧',
    shortLabel: 'Needs Work'
  },

  // Pathfinder Score Tiers
  QUICK_WIN: {
    label: 'Quick Win (90%+ Success)',
    ariaLabel: 'Claim priority: Quick Win - 90% or higher probability of approval',
    role: 'status',
    icon: '🎯',
    shortLabel: 'Quick Win'
  },
  STRATEGIC: {
    label: 'Strategic Assault (70-89% Success)',
    ariaLabel: 'Claim priority: Strategic - 70 to 89 percent probability of approval',
    role: 'status',
    icon: '⚔️',
    shortLabel: 'Strategic'
  },
  LONG_GAME: {
    label: 'Long Game (40-69% Success)',
    ariaLabel: 'Claim priority: Long Game - 40 to 69 percent probability, requires patience',
    role: 'status',
    icon: '♟️',
    shortLabel: 'Long Game'
  },
  RISK_WATCH: {
    label: 'Risk Watch (<40% Success)',
    ariaLabel: 'Claim priority: Risk Watch - Less than 40 percent probability, high risk',
    role: 'status',
    icon: '👁️',
    shortLabel: 'Risk Watch'
  }
};

/**
 * Get ARIA attributes for a given status
 * 
 * @param {string} statusKey - Key from STATUS_LEVELS
 * @returns {Object} ARIA attributes to spread on element
 */
export const getStatusARIA = (statusKey) => {
  const status = STATUS_LEVELS[statusKey];
  
  if (!status) {
    console.warn(`[A11y] Unknown status key: ${statusKey}`);
    return {
      role: 'status',
      'aria-label': statusKey
    };
  }

  return {
    role: status.role,
    'aria-label': status.ariaLabel
  };
};

/**
 * Get screen-reader-only text for a status
 * 
 * @param {string} statusKey - Key from STATUS_LEVELS
 * @returns {string} Text for sr-only span
 */
export const getStatusSRText = (statusKey) => {
  const status = STATUS_LEVELS[statusKey];
  return status ? status.label : statusKey;
};

// ========================================
// COLOR CLASSES (WITH PATTERNS)
// ========================================

/**
 * Get Tailwind classes for a status that work for colorblind users
 * Uses patterns (borders, backgrounds) in addition to color
 * 
 * @param {string} statusKey - Key from STATUS_LEVELS
 * @param {string} variant - 'bg' | 'border' | 'text' | 'full'
 * @returns {string} Tailwind class string
 */
export const getColorClasses = (statusKey, variant = 'full') => {
  const colorMaps = {
    GRANT: {
      bg: 'bg-green-900/30',
      border: 'border-green-500',
      text: 'text-green-300',
      full: 'bg-green-900/30 border-2 border-green-500 text-green-300'
    },
    DENIED: {
      bg: 'bg-red-900/30',
      border: 'border-red-500 border-dashed', // Dashed for colorblind distinction
      text: 'text-red-300',
      full: 'bg-red-900/30 border-2 border-red-500 border-dashed text-red-300'
    },
    HIGH_RISK: {
      bg: 'bg-orange-900/30',
      border: 'border-orange-500 border-dotted', // Dotted for colorblind distinction
      text: 'text-orange-300',
      full: 'bg-orange-900/30 border-2 border-orange-500 border-dotted text-orange-300'
    },
    DEVELOPMENT_NEEDED: {
      bg: 'bg-amber-900/30',
      border: 'border-amber-500',
      text: 'text-amber-300',
      full: 'bg-amber-900/30 border-2 border-amber-500 text-amber-300'
    },
    QUICK_WIN: {
      bg: 'bg-emerald-900/30',
      border: 'border-emerald-500',
      text: 'text-emerald-300',
      full: 'bg-emerald-900/30 border-2 border-emerald-500 text-emerald-300'
    },
    STRATEGIC: {
      bg: 'bg-blue-900/30',
      border: 'border-blue-500',
      text: 'text-blue-300',
      full: 'bg-blue-900/30 border-2 border-blue-500 text-blue-300'
    },
    LONG_GAME: {
      bg: 'bg-purple-900/30',
      border: 'border-purple-500',
      text: 'text-purple-300',
      full: 'bg-purple-900/30 border-2 border-purple-500 text-purple-300'
    },
    RISK_WATCH: {
      bg: 'bg-gray-900/30',
      border: 'border-gray-500',
      text: 'text-gray-300',
      full: 'bg-gray-900/30 border-2 border-gray-500 text-gray-300'
    }
  };

  const classes = colorMaps[statusKey];
  if (!classes) {
    console.warn(`[A11y] No color classes for status: ${statusKey}`);
    return 'bg-slate-900/30 border-slate-500 text-slate-300';
  }

  return classes[variant] || classes.full;
};

// ========================================
// INTERACTIVE ELEMENTS (Buttons, Links)
// ========================================

/**
 * Generate ARIA attributes for expandable/collapsible sections
 * 
 * @param {boolean} isExpanded - Whether section is expanded
 * @param {string} controlsId - ID of controlled element
 * @param {string} label - Descriptive label
 * @returns {Object} ARIA attributes
 */
export const getExpandableARIA = (isExpanded, controlsId, label) => {
  return {
    'aria-expanded': isExpanded,
    'aria-controls': controlsId,
    'aria-label': `${isExpanded ? 'Collapse' : 'Expand'} ${label}`
  };
};

/**
 * Generate ARIA attributes for progress meters/scores
 * 
 * @param {number} value - Current value (0-100)
 * @param {string} label - What is being measured
 * @returns {Object} ARIA attributes
 */
export const getProgressARIA = (value, label) => {
  return {
    role: 'progressbar',
    'aria-valuenow': value,
    'aria-valuemin': 0,
    'aria-valuemax': 100,
    'aria-label': `${label}: ${value} percent`
  };
};

/**
 * Generate ARIA attributes for tabs
 * 
 * @param {boolean} isSelected - Whether tab is active
 * @param {string} panelId - ID of associated panel
 * @param {string} label - Tab label
 * @returns {Object} ARIA attributes
 */
export const getTabARIA = (isSelected, panelId, label) => {
  return {
    role: 'tab',
    'aria-selected': isSelected,
    'aria-controls': panelId,
    'aria-label': label,
    tabIndex: isSelected ? 0 : -1
  };
};

// ========================================
// SCORE/RATING CONVERSION
// ========================================

/**
 * Convert numeric score to status tier
 * 
 * @param {number} score - Score (0-100)
 * @returns {string} Status key from STATUS_LEVELS
 */
export const scoreToTier = (score) => {
  if (score >= 90) return 'QUICK_WIN';
  if (score >= 70) return 'STRATEGIC';
  if (score >= 40) return 'LONG_GAME';
  return 'RISK_WATCH';
};

/**
 * Convert War Game verdict to status tier
 * 
 * @param {string} verdict - 'GRANT' | 'DENIED' | 'HIGH RISK' | 'DEVELOPMENT NEEDED'
 * @returns {string} Status key from STATUS_LEVELS
 */
export const verdictToTier = (verdict) => {
  const normalized = verdict.toUpperCase().replace(/\s+/g, '_');
  if (STATUS_LEVELS[normalized]) return normalized;
  
  // Fallback mapping
  if (verdict.includes('GRANT')) return 'GRANT';
  if (verdict.includes('DENIED')) return 'DENIED';
  if (verdict.includes('RISK')) return 'HIGH_RISK';
  return 'DEVELOPMENT_NEEDED';
};

// ========================================
// UTILITY COMPONENTS (JSX Helpers)
// ========================================

/**
 * Generate sr-only span JSX
 * 
 * @param {string} text - Screen reader text
 * @returns {string} JSX class name
 */
export const SR_ONLY_CLASS = 'sr-only';

/**
 * Keyboard navigation helper: Handle Enter/Space as click
 * 
 * @param {Function} onClick - Click handler
 * @returns {Function} onKeyDown handler
 */
export const handleKeyboardClick = (onClick) => {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };
};

/**
 * Focus management: Trap focus within modal
 * 
 * @param {HTMLElement} container - Modal container element
 */
export const trapFocus = (container) => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTabKey = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab: Move backwards
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: Move forwards
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  container.addEventListener('keydown', handleTabKey);
  
  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
};

// ========================================
// AUDIT HELPERS
// ========================================

/**
 * Check if element has proper ARIA labels
 * (For development/testing use)
 * 
 * @param {HTMLElement} element - Element to check
 * @returns {Object} Audit results
 */
export const auditElement = (element) => {
  const results = {
    hasRole: !!element.getAttribute('role'),
    hasAriaLabel: !!element.getAttribute('aria-label') || !!element.getAttribute('aria-labelledby'),
    isKeyboardAccessible: element.tabIndex >= 0 || element.tagName === 'BUTTON' || element.tagName === 'A',
    warnings: []
  };

  if (element.onclick && !results.isKeyboardAccessible) {
    results.warnings.push('Element has click handler but is not keyboard accessible');
  }

  if (element.style.color && !element.getAttribute('aria-label')) {
    results.warnings.push('Element uses color but has no ARIA label');
  }

  return results;
};

/**
 * Log accessibility audit for a component (development only)
 * 
 * @param {string} componentName - Name of component
 * @param {HTMLElement} rootElement - Root element of component
 */
export const auditComponent = (componentName, rootElement) => {
  if (process.env.NODE_ENV !== 'development') return;

  console.group(`[A11y Audit] ${componentName}`);
  
  const buttons = rootElement.querySelectorAll('button, [role="button"]');
  const links = rootElement.querySelectorAll('a');
  const images = rootElement.querySelectorAll('img');
  const inputs = rootElement.querySelectorAll('input, select, textarea');

  console.log(`Buttons: ${buttons.length}`);
  buttons.forEach((btn, i) => {
    const audit = auditElement(btn);
    if (audit.warnings.length > 0) {
      console.warn(`Button ${i}:`, audit.warnings);
    }
  });

  console.log(`Links: ${links.length}`);
  console.log(`Images: ${images.length} (${Array.from(images).filter(img => !img.alt).length} missing alt text)`);
  console.log(`Form Inputs: ${inputs.length}`);

  console.groupEnd();
};

export default {
  STATUS_LEVELS,
  getStatusARIA,
  getStatusSRText,
  getColorClasses,
  getExpandableARIA,
  getProgressARIA,
  getTabARIA,
  scoreToTier,
  verdictToTier,
  handleKeyboardClick,
  trapFocus,
  auditElement,
  auditComponent
};
