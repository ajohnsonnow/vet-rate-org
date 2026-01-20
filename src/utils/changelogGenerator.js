/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * 
 * CHANGELOG GENERATOR
 * 
 * Dynamically generates changelog data from README.md
 * This ensures the What's New modal always reflects the current features
 */

import { APP_VERSION } from './version';
import { getSquashedBugsForChangelog, getSquashedBugCount, getRecentSquashedBugs } from '../data/squashedBugs';
import { PROJECT_STATS, getTotalToolCount } from '../data/projectStats';

/**
 * Parse the README.md file and extract features organized by section
 * @param {string} readmeContent - The raw README.md content
 * @returns {Array} - Array of changelog items
 */
export function parseReadmeForChangelog(readmeContent) {
  const changelog = [];
  
  // Feature patterns to extract from README
  const sectionPatterns = [
    { 
      regex: /###\s*🔍[-\s]*Core Intelligence Tools([\s\S]*?)(?=###|\n##|$)/i,
      type: 'feature',
      category: 'Core Intelligence'
    },
    { 
      regex: /###\s*💰[-\s]*Rating & Benefits Calculators([\s\S]*?)(?=###|\n##|$)/i,
      type: 'feature',
      category: 'Calculators'
    },
    { 
      regex: /###\s*🔍[-\s]*Discovery & Research Tools([\s\S]*?)(?=###|\n##|$)/i,
      type: 'feature',
      category: 'Discovery'
    },
    { 
      regex: /###\s*📝[-\s]*Evidence Building Suite([\s\S]*?)(?=###|\n##|$)/i,
      type: 'feature',
      category: 'Evidence Building'
    },
    { 
      regex: /###\s*🎯[-\s]*Quality Control Tools([\s\S]*?)(?=###|\n##|$)/i,
      type: 'improvement',
      category: 'Quality Control'
    },
    { 
      regex: /###\s*⚡[-\s]*Advanced Strategy Tools([\s\S]*?)(?=###|\n##|$)/i,
      type: 'feature',
      category: 'Strategy'
    },
    { 
      regex: /###\s*🤝[-\s]*Support & Resources([\s\S]*?)(?=###|\n##|$)/i,
      type: 'feature',
      category: 'Support'
    },
    { 
      regex: /###\s*Privacy & Security([\s\S]*?)(?=###|\n##|$)/i,
      type: 'security',
      category: 'Security'
    }
  ];

  // Extract features from each section
  sectionPatterns.forEach(({ regex, type, category }) => {
    const match = readmeContent.match(regex);
    if (match) {
      const sectionContent = match[1];
      
      // Extract bullet points with ** bold titles **
      const featureRegex = /-\s*\*\*([^*]+)\*\*[:\s]*(.+?)(?=\n-|\n\n|$)/g;
      let featureMatch;
      
      while ((featureMatch = featureRegex.exec(sectionContent)) !== null) {
        const title = featureMatch[1].trim();
        const description = featureMatch[2].trim()
          .replace(/\*\*/g, '') // Remove remaining bold markers
          .replace(/\s+/g, ' '); // Normalize whitespace
        
        // Check for NEW tag
        const isNew = title.includes('🆕') || description.includes('🆕');
        
        changelog.push({
          type: isNew ? 'feature' : type,
          title: title.replace(/🆕/g, '').trim(),
          description: description.replace(/🆕/g, '').trim(),
          category,
          isNew
        });
      }
    }
  });

  return changelog;
}

/**
 * Get highlighted features for What's New modal
 * Prioritizes new features and important updates
 * @param {Array} allChangelog - Full changelog array
 * @param {number} limit - Maximum items to show
 * @returns {Array} - Curated changelog items
 */
export function getHighlightedChangelog(allChangelog, limit = 10) {
  // Prioritize NEW features first
  const newFeatures = allChangelog.filter(item => item.isNew);
  const otherFeatures = allChangelog.filter(item => !item.isNew);
  
  // Sort others by type priority: security > feature > improvement
  const typePriority = { security: 0, feature: 1, improvement: 2, change: 3 };
  otherFeatures.sort((a, b) => (typePriority[a.type] || 3) - (typePriority[b.type] || 3));
  
  // Combine and limit
  return [...newFeatures, ...otherFeatures].slice(0, limit);
}

/**
 * Generate a curated What's New changelog
 * This is the main function to call for the modal
 * @returns {Object} - Object with version and changelog array
 */
export function generateWhatsNewChangelog() {
  // Curated changelog highlighting the most important features
  // This is manually curated for the best user experience
  // Update this array when deploying new features
  
  const curatedChangelog = [
    // NEW FEATURES - Add new releases here (mark with isNew: true)
    {
      type: 'feature',
      title: 'Retro Pay Hunter',
      description: 'Find missed backpay using historical VA pay rates from 2020-2026 with CUE pattern detection',
      isNew: true
    },
    {
      type: 'feature',
      title: 'Time Machine',
      description: 'Intent to File countdown tracker with backpay projections',
      isNew: true
    },
    {
      type: 'feature',
      title: 'The Tribunal',
      description: 'Voice-interactive mock BVA hearing simulator with real-time feedback',
      isNew: true
    },
    {
      type: 'feature',
      title: 'The Bunker',
      description: 'Export/import all your data with optional encrypted Google Drive sync',
      isNew: true
    },
    {
      type: 'improvement',
      title: 'Dynamic Stats System',
      description: 'All stats (tools count, conditions count) now update automatically across the entire app',
      isNew: true
    },
    
    // EXISTING HIGHLIGHTS
    {
      type: 'feature',
      title: `${getTotalToolCount()} Professional Tools`,
      description: 'Complete VA claims arsenal - C-File Analyzer, C&P Simulator, Secondary Scout, and more'
    },
    {
      type: 'feature',
      title: `${PROJECT_STATS.disabilitiesValidated} Validated Conditions`,
      description: 'Every condition from 38 CFR Part 4 with detailed rating criteria and diagnostic codes'
    },
    {
      type: 'feature',
      title: 'AI-Powered Analysis',
      description: 'Optional Google Gemini/Anthropic integration for statement enhancement, with explicit consent'
    },
    {
      type: 'security',
      title: '100% Client-Side Processing',
      description: 'All processing happens in YOUR browser. No accounts, no tracking, no PII storage'
    },
    {
      type: 'feature',
      title: 'Secondary Scout',
      description: 'Discover 500+ medically-recognized secondary conditions with probability ratings'
    },
    {
      type: 'feature',
      title: 'Million Dollar Dashboard',
      description: 'Calculate lifetime benefit value and retirement projections with 2026 pay rates'
    }
  ];

  // Add recent squashed bugs to changelog
  const recentBugFixes = getSquashedBugsForChangelog(5);

  return {
    version: APP_VERSION,
    date: new Date().toISOString().split('T')[0],
    changelog: curatedChangelog,
    bugFixes: recentBugFixes,
    totalBugsSquashed: getSquashedBugCount()
  };
}

/**
 * Check if user should see What's New modal
 * @param {string} lastSeenVersion - Version last seen by user
 * @returns {boolean} - True if should show modal
 */
export function shouldShowWhatsNew(lastSeenVersion) {
  if (!lastSeenVersion) return true;
  return lastSeenVersion !== APP_VERSION;
}

export default {
  parseReadmeForChangelog,
  getHighlightedChangelog,
  generateWhatsNewChangelog,
  shouldShowWhatsNew,
  getSquashedBugsForChangelog,
  getSquashedBugCount
};
