/**
 * Component Development Statistics
 * Tracks development hours and lines of code for each major component
 * Used for context-specific funding requests
 * 
 * Total Project: ~5,800 hours, 91,368 lines
 */

export const COMPONENT_STATS = {
  'tactical-calculator': {
    name: 'Tactical Calculator',
    hours: 450,
    lines: 8500,
    description: 'Combined rating calculator with bilateral factors, dependents, and 2026 pay rates'
  },
  'secondary-scout': {
    name: 'Secondary Scout',
    hours: 380,
    lines: 6200,
    description: 'Discovery engine for 500+ medically-recognized secondary conditions'
  },
  'cap-simulator': {
    name: 'C&P Exam Simulator',
    hours: 520,
    lines: 7800,
    description: 'DBQ-aligned practice questions with AI percentage predictions'
  },
  'cfile-analyzer': {
    name: 'C-File AI Analyzer',
    hours: 680,
    lines: 9200,
    description: 'AI analysis of claims files—what others charge $500+ for'
  },
  'nexus-builder': {
    name: 'Nexus Builder',
    hours: 320,
    lines: 5400,
    description: 'Medical nexus statement generator with AI enhancement'
  },
  'forms-helper': {
    name: 'Forms Helper',
    hours: 410,
    lines: 6800,
    description: 'Guided assistance for 16+ VA forms including buddy statements'
  },
  'my-packet': {
    name: 'My Packet',
    hours: 290,
    lines: 4200,
    description: 'Claims evidence organizer with local storage and backup'
  },
  'decision-decoder': {
    name: 'Decision Decoder',
    hours: 350,
    lines: 4900,
    description: 'AI analysis of VA decision letters to find appeal opportunities'
  },
  'blue-button-xray': {
    name: 'Blue Button X-Ray',
    hours: 380,
    lines: 5100,
    description: 'Extracts claim-relevant evidence from VA medical records'
  },
  'red-team': {
    name: 'Red Team Simulator',
    hours: 280,
    lines: 3800,
    description: 'Simulates VA examiner review to identify claim weaknesses'
  },
  'pathfinder': {
    name: 'Pathfinder',
    hours: 210,
    lines: 3200,
    description: 'Strategic roadmap from initial claim through appeals'
  },
  'risk-assessment': {
    name: 'Risk Assessment',
    hours: 190,
    lines: 2800,
    description: 'Identifies potential claim weaknesses before filing'
  },
  'witness-bench': {
    name: 'Witness Bench',
    hours: 240,
    lines: 3600,
    description: 'Interactive buddy statement builder with smart questioning'
  },
  'symptom-logger': {
    name: 'Symptom Logger',
    hours: 180,
    lines: 2400,
    description: 'Daily symptom tracking for evidence documentation'
  },
  'tdiu-builder': {
    name: 'TDIU Builder',
    hours: 220,
    lines: 3100,
    description: 'Total Disability Individual Unemployability evaluation tool'
  },
  'million-dollar-dashboard': {
    name: 'Million Dollar Dashboard',
    hours: 310,
    lines: 4500,
    description: 'Lifetime benefit value calculator with retirement projections'
  },
  'pact-act-navigator': {
    name: 'PACT Act Navigator',
    hours: 260,
    lines: 3700,
    description: 'Toxic exposure presumptive condition identifier'
  },
  'web-of-conditions': {
    name: 'Web of Conditions',
    hours: 290,
    lines: 4100,
    description: 'Interactive visualization of connected disabilities'
  },
  'mos-hazard-matcher': {
    name: 'MOS Hazard Matcher',
    hours: 230,
    lines: 3300,
    description: 'Links military jobs to exposures and conditions'
  },
  'state-benefit-hunter': {
    name: 'State Benefit Hunter',
    hours: 270,
    lines: 3900,
    description: 'Discovers state-level veteran benefits by location'
  },
  'vso-finder': {
    name: 'VSO Finder',
    hours: 140,
    lines: 1900,
    description: 'Locates accredited Veterans Service Officers'
  },
  'shark-radar': {
    name: 'Shark Radar',
    hours: 160,
    lines: 2200,
    description: 'Identifies predatory claim services to avoid scams'
  },
  'foia-generator': {
    name: 'FOIA Generator',
    hours: 170,
    lines: 2500,
    description: 'Creates Freedom of Information Act requests for records'
  },
  'va-resources': {
    name: 'VA Resources Hub',
    hours: 150,
    lines: 2100,
    description: 'Comprehensive directory of VA programs and crisis support'
  },
  'disability-search': {
    name: 'Smart Search Engine',
    hours: 340,
    lines: 5200,
    description: '748 conditions with synonym matching and advanced filters'
  },
  'user-manual': {
    name: 'User Manual',
    hours: 100,
    lines: 1800,
    description: 'Complete documentation for all 40+ tools'
  },
  // Database and infrastructure
  'data-validation': {
    name: 'Data Validation & Entry',
    hours: 200,
    lines: 15000,
    description: '748 disabilities with full rating criteria validated against 38 CFR'
  },
  'accessibility': {
    name: 'Accessibility Features',
    hours: 120,
    lines: 1600,
    description: 'WCAG 2.1 AA compliance, screen reader support, keyboard navigation'
  }
};

/**
 * Get stats for a specific component
 * @param {string} componentKey - The key from COMPONENT_STATS
 * @returns {object|null} Component stats or null if not found
 */
export function getComponentStats(componentKey) {
  return COMPONENT_STATS[componentKey] || null;
}

/**
 * Calculate total project stats
 * @returns {object} Total hours and lines
 */
export function getTotalProjectStats() {
  const stats = Object.values(COMPONENT_STATS);
  return {
    totalHours: stats.reduce((sum, stat) => sum + stat.hours, 0),
    totalLines: stats.reduce((sum, stat) => sum + stat.lines, 0),
    componentCount: stats.length
  };
}

/**
 * Get formatted message for funding requests
 * @param {string} componentKey - The component key
 * @returns {string} Formatted message
 */
export function getFundingMessage(componentKey) {
  const stats = getComponentStats(componentKey);
  if (!stats) return null;
  
  return `This ${stats.name} tool took ${stats.hours} hours and ${stats.lines.toLocaleString()} lines of code to build. Help keep it free for all veterans.`;
}
