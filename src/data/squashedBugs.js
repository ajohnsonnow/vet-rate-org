/**
 * SQUASHED BUGS TRACKER
 * 
 * This file tracks all bugs that have been reported and squashed.
 * The visible counter encourages users to report bugs!
 * 
 * ═══════════════════════════════════════════════════════════════
 * HOW TO ADD A SQUASHED BUG (3 OPTIONS):
 * ═══════════════════════════════════════════════════════════════
 * 
 * OPTION 1: Paste bug report into GitHub Copilot chat
 *   Just paste the bug report and say "Squashed this bug"
 *   Copilot will automatically add it here!
 * 
 * OPTION 2: Run CLI script
 *   npm run squash-bug
 *   (Interactive mode walks you through it)
 * 
 * OPTION 3: Manual entry
 *   Add a new object to SQUASHED_BUGS array below
 * 
 * Categories: UI, Data, Feature, Performance, Mobile, Accessibility, Build, Search, PDF
 * ═══════════════════════════════════════════════════════════════
 */

export const SQUASHED_BUGS = [
  // === ADD NEW SQUASHED BUGS AT THE TOP ===
  {
    id: 'BUG-2026-015',
    title: 'LocalAIPanel escaped quotes causing build failure',
    description: 'Fixed escaped quotes in JSX causing Vite build to fail',
    category: 'Build',
    reportedDate: '2026-01-19',
    squashedDate: '2026-01-19',
    reportedBy: 'Internal QA',
    isRecent: true
  },
  {
    id: 'BUG-2026-014',
    title: 'Tool count showing 40+ instead of actual 39',
    description: 'Updated all references across 10+ files to show accurate tool count',
    category: 'Data',
    reportedDate: '2026-01-19',
    squashedDate: '2026-01-19',
    reportedBy: 'Internal QA',
    isRecent: true
  },
  {
    id: 'BUG-2026-013',
    title: 'Version not syncing to public/version.json',
    description: 'Created automated sync-version.js script to sync version across all files',
    category: 'Build',
    reportedDate: '2026-01-19',
    squashedDate: '2026-01-19',
    reportedBy: 'Internal QA',
    isRecent: true
  },
  {
    id: 'BUG-2026-012',
    title: 'FAQ/Support pages showing N/A for stats',
    description: 'Fixed dynamic stats injection in static HTML files',
    category: 'Data',
    reportedDate: '2026-01-19',
    squashedDate: '2026-01-19',
    reportedBy: 'Internal QA',
    isRecent: true
  },
  {
    id: 'BUG-2026-011',
    title: 'Glossary missing common VA terms',
    description: 'Added 80+ new VA-specific terms to the glossary',
    category: 'Data',
    reportedDate: '2026-01-18',
    squashedDate: '2026-01-19',
    reportedBy: 'Community',
    isRecent: true
  },
  {
    id: 'BUG-2026-010',
    title: 'Dynamic stats not updating in AboutUs',
    description: 'Implemented centralized projectStats.js for consistent stats',
    category: 'Feature',
    reportedDate: '2026-01-18',
    squashedDate: '2026-01-18',
    reportedBy: 'Internal QA'
  },
  {
    id: 'BUG-2026-009',
    title: 'Secondary Scout showing duplicate conditions',
    description: 'Added deduplication logic to secondary condition results',
    category: 'Feature',
    reportedDate: '2026-01-15',
    squashedDate: '2026-01-16',
    reportedBy: 'Community'
  },
  {
    id: 'BUG-2026-008',
    title: 'Mobile menu not closing on selection',
    description: 'Fixed mobile navigation state management',
    category: 'Mobile',
    reportedDate: '2026-01-12',
    squashedDate: '2026-01-13',
    reportedBy: 'Community'
  },
  {
    id: 'BUG-2026-007',
    title: 'PDF export cutting off text on some conditions',
    description: 'Improved PDF layout algorithm for long condition names',
    category: 'Feature',
    reportedDate: '2026-01-10',
    squashedDate: '2026-01-11',
    reportedBy: 'Community'
  },
  {
    id: 'BUG-2026-006',
    title: 'Dark mode contrast issues in calculator',
    description: 'Enhanced color contrast ratios to meet WCAG AA standards',
    category: 'Accessibility',
    reportedDate: '2026-01-08',
    squashedDate: '2026-01-09',
    reportedBy: 'Community'
  },
  {
    id: 'BUG-2026-005',
    title: 'Search not finding conditions with hyphens',
    description: 'Improved search tokenization to handle special characters',
    category: 'Feature',
    reportedDate: '2026-01-05',
    squashedDate: '2026-01-06',
    reportedBy: 'Community'
  },
  {
    id: 'BUG-2026-004',
    title: 'Bilateral factor calculation incorrect',
    description: 'Fixed bilateral factor formula per 38 CFR 4.26',
    category: 'Data',
    reportedDate: '2026-01-03',
    squashedDate: '2026-01-04',
    reportedBy: 'Community'
  },
  {
    id: 'BUG-2026-003',
    title: 'C&P Simulator skipping questions',
    description: 'Fixed state management in question flow logic',
    category: 'Feature',
    reportedDate: '2025-12-28',
    squashedDate: '2025-12-29',
    reportedBy: 'Community'
  },
  {
    id: 'BUG-2026-002',
    title: 'My Packet not saving on Safari',
    description: 'Added localStorage fallback for Safari private browsing',
    category: 'Feature',
    reportedDate: '2025-12-20',
    squashedDate: '2025-12-22',
    reportedBy: 'Community'
  },
  {
    id: 'BUG-2026-001',
    title: 'Rating criteria missing for sleep apnea',
    description: 'Added complete rating schedule from 38 CFR 4.97',
    category: 'Data',
    reportedDate: '2025-12-15',
    squashedDate: '2025-12-16',
    reportedBy: 'Community'
  }
];

/**
 * Get total count of squashed bugs
 */
export const getSquashedBugCount = () => SQUASHED_BUGS.length;

/**
 * Get recent squashed bugs (marked with isRecent: true)
 */
export const getRecentSquashedBugs = () => SQUASHED_BUGS.filter(bug => bug.isRecent);

/**
 * Get squashed bugs by category
 */
export const getSquashedBugsByCategory = (category) => 
  SQUASHED_BUGS.filter(bug => bug.category === category);

/**
 * Get stats summary
 */
export const getSquashedBugsStats = () => {
  const categories = {};
  SQUASHED_BUGS.forEach(bug => {
    categories[bug.category] = (categories[bug.category] || 0) + 1;
  });
  
  const communityReported = SQUASHED_BUGS.filter(b => b.reportedBy === 'Community').length;
  const recentCount = getRecentSquashedBugs().length;
  
  return {
    total: SQUASHED_BUGS.length,
    recentCount,
    communityReported,
    internalFound: SQUASHED_BUGS.length - communityReported,
    byCategory: categories,
    lastSquashed: SQUASHED_BUGS[0]?.squashedDate || 'N/A'
  };
};

/**
 * Format bugs for changelog display
 */
export const getSquashedBugsForChangelog = (limit = 5) => {
  return SQUASHED_BUGS.slice(0, limit).map(bug => ({
    type: 'fix',
    title: bug.title,
    description: bug.description,
    isNew: bug.isRecent,
    category: bug.category,
    squashedDate: bug.squashedDate
  }));
};
