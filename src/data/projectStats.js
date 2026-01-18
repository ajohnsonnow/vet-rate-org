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
  totalFiles: 978,
  linesOfCode: 93389,
  appSizeMB: 43.41,
  components: 52,
  majorTools: 28,
  supportingComponents: 24,
  utilities: 19,
  disabilitiesValidated: 748,
  
  // Development Time
  traditionalHours: 5800,
  traditionalYears: 3,
  actualHours: '40-45',
  actualDays: 3.5,
  productivityMultiplier: 130,
  
  // Time Breakdown (traditional equivalent)
  breakdown: {
    coding: 4666,
    dataEntry: 200,
    testing: 400,
    uiux: 200,
    documentation: 100,
    research: 100,
    deployment: 230,
  },
  
  // Git Stats
  git: {
    firstCommitDate: 'January 15, 2026',
    firstCommitTime: '8:05 PM',
    latestCommitDate: 'January 18, 2026',
    latestCommitTime: '3:15 AM',
    totalCommits: 46,
    activeSessions: 15,
    linesAdded: 113792,
    linesRemoved: 9235,
    dailyCommits: {
      'Jan 15': 13,
      'Jan 16': 2,
      'Jan 17': 16,
      'Jan 18': 15,
    }
  },
  
  // Last Updated
  lastUpdated: '2026-01-18',
};

// Helper to format numbers with commas
export const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
