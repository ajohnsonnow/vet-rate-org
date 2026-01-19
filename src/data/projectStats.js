/**
 * Project Statistics - Single Source of Truth
 * 
 * Update these values when project stats change.
 * Used by: AboutUs.jsx, and referenced in README.md
 * 
 * To update: Run stats collection command and update values here:
 * $stats = @{}; $stats.files = (Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch 'node_modules|\.git|dist|build|archive' } | Measure-Object).Count; ...
 */

export const PROJECT_STATS = {
  // Project Scale
  totalFiles: 1135,
  linesOfCode: 111440,
  appSizeMB: 104.05,
  components: 111,
  majorTools: 40,
  supportingComponents: 71,
  utilities: 47,
  disabilitiesValidated: 751,
  
  // Tool Categories (for dynamic references)
  // Matches categories in toolkitData.js
  toolCounts: {
    ratingCalculators: 5,    // Calculate Your Rating (Blue)
    discoveryResearch: 6,    // Discover Your Claims (Teal)
    evidenceBuilding: 10,    // Build Your Evidence (Violet)
    qualityControl: 8,       // Quality Control (Rose)
    maximizeStrategy: 4,     // Maximize Your Rating (Amber)
    supportResources: 6,     // Support & Resources (Sky)
  },
  
  // Development Time
  traditionalHours: 7200,
  traditionalYears: 4,
  actualHours: '50-55',
  actualDays: 4.5,
  productivityMultiplier: 131,
  
  // Time Breakdown (traditional equivalent)
  breakdown: {
    coding: 5572,
    dataEntry: 250,
    testing: 500,
    uiux: 300,
    documentation: 150,
    research: 150,
    deployment: 278,
  },
  
  // Git Stats
  git: {
    firstCommitDate: 'January 15, 2026',
    firstCommitTime: '8:05 PM',
    latestCommitDate: 'January 19, 2026',
    latestCommitTime: '12:00 PM',
    totalCommits: 52,
    activeSessions: 18,
    linesAdded: 125000,
    linesRemoved: 13560,
    dailyCommits: {
      'Jan 15': 13,
      'Jan 16': 2,
      'Jan 17': 16,
      'Jan 18': 15,
      'Jan 19': 6,
    }
  },
  
  // Last Updated
  lastUpdated: '2026-01-19',
};

// Helper to format numbers with commas
export const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Helper to get total tool count from categories
export const getTotalToolCount = () => {
  const counts = PROJECT_STATS.toolCounts;
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
};

// Pre-formatted values for easy use
export const FORMATTED_STATS = {
  totalFiles: formatNumber(PROJECT_STATS.totalFiles),
  linesOfCode: formatNumber(PROJECT_STATS.linesOfCode),
  appSize: `${PROJECT_STATS.appSizeMB} MB`,
  components: `${PROJECT_STATS.components} React components (${PROJECT_STATS.majorTools} major tools + ${PROJECT_STATS.supportingComponents} supporting)`,
  utilities: `${PROJECT_STATS.utilities} helper modules`,
  traditionalHours: `~${formatNumber(PROJECT_STATS.traditionalHours)} hours`,
  traditionalYears: `≈${PROJECT_STATS.traditionalYears} years full-time equivalent`,
  actualTime: `${PROJECT_STATS.actualHours} hours over ${PROJECT_STATS.actualDays} days`,
  multiplier: `${PROJECT_STATS.productivityMultiplier}x`,
  commits: `${PROJECT_STATS.git.totalCommits} commits across ${PROJECT_STATS.git.activeSessions} active coding sessions`,
  linesChanged: `+${formatNumber(PROJECT_STATS.git.linesAdded)} lines added, -${formatNumber(PROJECT_STATS.git.linesRemoved)} lines removed`,
};

export default PROJECT_STATS;
