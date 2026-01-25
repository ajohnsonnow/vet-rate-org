/**
 * Update Project Statistics
 * 
 * PHASE 1: Calculates LIVE stats from actual codebase
 * PHASE 2: Updates README.md with real values
 * PHASE 3: Generates projectStats.json for UI components
 * 
 * Run during build: npm run update-stats
 * 
 * DIAMOND STANDARD: Stats must reflect reality, not wishes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { calculateLiveStats, formatNumber } from './calculate-live-stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const README_PATH = path.resolve(__dirname, '../README.md');
const OUTPUT_PATH = path.resolve(__dirname, '../src/data/projectStats.json');

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1: Calculate Live Stats
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n📊 CALCULATING LIVE PROJECT STATISTICS...');
console.log('═══════════════════════════════════════════════════════════════\n');

const liveStats = calculateLiveStats();

console.log(`📁 Total Files:        ${formatNumber(liveStats.totalFiles)}`);
console.log(`📝 Lines of Code:      ${formatNumber(liveStats.linesOfCode)}`);
console.log(`📦 App Size:           ${liveStats.appSizeMB} MB`);
console.log(`⚛️  Components:         ${liveStats.componentCount} (${liveStats.toolCount} tools + ${liveStats.supportingComponents} supporting)`);
console.log(`🔧 Utilities:          ${liveStats.utilityCount}`);
console.log(`🏥 Disabilities:       ${liveStats.disabilityCount}`);
console.log(`🔗 Secondary Conds:    ${liveStats.secondaryCount}+`);
console.log(`📄 VA Forms:           ${liveStats.vaFormsCount}`);
console.log(`🤖 Local AI Models:    ${liveStats.localAIModels}`);

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2: Update README.md with Live Values
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n📝 UPDATING README.md WITH LIVE VALUES...');

let readmeContent = fs.readFileSync(README_PATH, 'utf-8');
let readmeUpdates = 0;

// Define README update patterns
const readmeReplacements = [
  // Lines of Code
  {
    pattern: /Lines of Code.*?[\d,]+\s*lines/gi,
    replacement: `Lines of Code**: ${formatNumber(liveStats.linesOfCode)} lines`
  },
  // Total Files
  {
    pattern: /Total Files.*?[\d,]+\s*project files/gi,
    replacement: `Total Files**: ${formatNumber(liveStats.totalFiles)} project files`
  },
  // App Size (keep existing since it's calculated differently)
  // Components count
  {
    pattern: /Components.*?[\d,]+\s*React components\s*\(\d+\s*major tools\s*\+\s*\d+\s*supporting\)/gi,
    replacement: `Components**: ${liveStats.componentCount} React components (${liveStats.toolCount} major tools + ${liveStats.supportingComponents} supporting)`
  },
  // Utilities
  {
    pattern: /Utilities.*?[\d,]+\s*helper modules/gi,
    replacement: `Utilities**: ${liveStats.utilityCount} helper modules`
  },
  // Data validation disability count
  {
    pattern: /Data Validation.*?[\d,]+\s*disabilities verified/gi,
    replacement: `Data Validation**: ${liveStats.disabilityCount} disabilities verified`
  },
  // Professional tools count
  {
    pattern: /(\d+)\s*professional tools/gi,
    replacement: `${liveStats.toolCount} professional tools`
  },
  // Specialized tools count  
  {
    pattern: /\*\*(\d+)\s*specialized tools\*\*/gi,
    replacement: `**${liveStats.toolCount} specialized tools**`
  },
  // Arsenal header
  {
    pattern: /Complete Arsenal:\s*\d+\s*Professional Tools/gi,
    replacement: `Complete Arsenal: ${liveStats.toolCount} Professional Tools`
  }
];

for (const { pattern, replacement } of readmeReplacements) {
  const matches = readmeContent.match(pattern);
  if (matches) {
    readmeContent = readmeContent.replace(pattern, replacement);
    readmeUpdates += matches.length;
  }
}

fs.writeFileSync(README_PATH, readmeContent);
console.log(`   ✅ Updated ${readmeUpdates} values in README.md`);

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3: Calculate Development Metrics
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n⏱️  CALCULATING DEVELOPMENT METRICS...');

// Constants for calculation
const BLENDED_LOC_PER_HOUR = 9.77;  // Blended team rate
const HOURLY_RATE = 135;             // Senior developer rate
const TESTING_PERCENT = 0.15;        // Testing is 15% of coding time

// Get actual git stats FIRST (needed for actual hours calculation)
let actualCommits = 141;
let actualCodingDays = 10;
try {
  actualCommits = parseInt(execSync('git log --oneline', { encoding: 'utf-8' }).trim().split('\n').length, 10);
  actualCodingDays = execSync('git log --format="%ad" --date=short', { encoding: 'utf-8' })
    .trim().split('\n').filter((v, i, a) => a.indexOf(v) === i).length;
  console.log(`   📊 Git stats: ${actualCommits} commits over ${actualCodingDays} active days`);
} catch (e) {
  console.log('   ⚠️ Could not read git stats, using defaults');
}

// Estimate actual hours: ~8-12 hours per active day (conservative estimate)
const HOURS_PER_DAY = 10; // Average focused coding hours per day
const actualHoursEstimate = actualCodingDays * HOURS_PER_DAY;

// Calculate coding hours from actual LOC
const codingHours = Math.round(liveStats.linesOfCode / BLENDED_LOC_PER_HOUR);
const testingHours = Math.round(codingHours * TESTING_PERCENT);

// Extract other hours from README (these are estimates)
const extractHours = (pattern, defaultVal) => {
  const match = readmeContent.match(pattern);
  return match ? parseInt(match[1].replace(/,/g, ''), 10) : defaultVal;
};

const validationHours = 250;      // Data validation
const uiuxHours = 400;            // UI/UX design
const documentationHours = 200;   // Documentation
const researchHours = 150;        // Research
const deploymentHours = 73;       // Deployment

// Calculate totals
const totalTraditionalHours = codingHours + validationHours + testingHours + uiuxHours + documentationHours + researchHours + deploymentHours;
const traditionalCost = totalTraditionalHours * HOURLY_RATE;

// Actual development metrics (now dynamically calculated)
const actualHours = actualHoursEstimate;
const actualCost = actualHours * HOURLY_RATE;
const costSavings = traditionalCost - actualCost;
const savingsPercent = ((1 - (actualCost / traditionalCost)) * 100).toFixed(1);
const productivityMultiplier = Math.round(totalTraditionalHours / actualHours);
const yearsEquivalent = (totalTraditionalHours / 2080).toFixed(1);

console.log(`   Coding hours: ${formatNumber(liveStats.linesOfCode)} LOC ÷ ${BLENDED_LOC_PER_HOUR} = ${formatNumber(codingHours)} hrs`);
console.log(`   Testing hours: ${testingHours} hrs (15% of coding)`);
console.log(`   Total traditional: ${formatNumber(totalTraditionalHours)} hrs (${yearsEquivalent} years FTE)`);
console.log(`   Traditional cost: $${formatNumber(traditionalCost)}`);
console.log(`   Productivity: ${productivityMultiplier}x multiplier`);

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4: Generate projectStats.json
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n💾 GENERATING projectStats.json...');

// Get component table hours from README
const componentTableRegex = /\|\s*([^|]+)\s*\|\s*(\d+)\s*hrs\s*\|/g;
let componentHoursTotal = 0;
let componentCountFromTable = 0;
let match;

while ((match = componentTableRegex.exec(readmeContent)) !== null) {
  const hours = parseInt(match[2], 10);
  componentHoursTotal += hours;
  componentCountFromTable++;
}

// Calculate days dynamically from first commit to now
const FIRST_COMMIT_DATE = new Date('2026-01-15T20:05:00');
const now = new Date();
const daysDev = Math.ceil((now - FIRST_COMMIT_DATE) / (1000 * 60 * 60 * 24));

const stats = {
  // === LIVE CALCULATED VALUES (from codebase scan) ===
  total_files: formatNumber(liveStats.totalFiles),
  loc_count: formatNumber(liveStats.linesOfCode),
  component_count: String(liveStats.componentCount),
  major_tools: String(liveStats.toolCount),
  utility_count: String(liveStats.utilityCount),
  validation_count: String(liveStats.disabilityCount),
  secondary_conditions: String(liveStats.secondaryCount),
  forms_supported: String(liveStats.vaFormsCount),
  local_ai_models: String(liveStats.localAIModels),
  
  // === CALCULATED DEVELOPMENT METRICS ===
  total_hours: formatNumber(totalTraditionalHours),
  coding_hours: formatNumber(codingHours),
  actual_hours: String(actualHours),
  coding_sessions: String(actualCodingDays),
  years_dev: yearsEquivalent,
  
  // Cost metrics
  traditional_cost: formatNumber(traditionalCost),
  actual_cost: formatNumber(actualCost),
  cost_savings: `$${formatNumber(costSavings)}`,
  savings_percent: savingsPercent,
  hourly_rate: String(HOURLY_RATE),
  
  // Component breakdown from README table
  component_hours_total: formatNumber(componentHoursTotal),
  component_count_from_table: componentCountFromTable,
  
  // Development breakdown
  breakdown: {
    coding: codingHours,
    validation: validationHours,
    testing: testingHours,
    uiux: uiuxHours,
    documentation: documentationHours,
    research: researchHours,
    deployment: deploymentHours
  },
  
  // Project timeline (dynamically calculated)
  days_dev: String(daysDev),
  productivity_multiplier: String(productivityMultiplier),
  total_commits: String(actualCommits),
  
  // AI Tools
  ai_tools: {
    planning: 'Gemini 3',
    coding: ['Claude 4.5 Opus', 'Claude 4.5 Sonnet', 'Claude 4.5 Haiku'],
    ide: 'VS Code',
    frameworks: ['React 18', 'Vite', 'Tailwind CSS']
  },
  
  // Metadata
  first_commit: 'January 15, 2026',
  last_updated: new Date().toLocaleDateString('en-CA'),
  version: new Date().toLocaleDateString('en-CA').replace(/-/g, ''),
  
  // Numeric versions for programmatic use
  total_hours_numeric: totalTraditionalHours,
  coding_hours_numeric: codingHours,
  loc_count_numeric: liveStats.linesOfCode,
  validation_count_numeric: liveStats.disabilityCount,
  traditional_cost_numeric: traditionalCost,
  actual_cost_numeric: actualCost,
  cost_savings_numeric: costSavings,
  coding_sessions_numeric: actualCodingDays,
  productivity_multiplier_numeric: productivityMultiplier,
  component_hours_numeric: componentHoursTotal,
  
  // === NEW: Live stats for direct reference ===
  live: {
    totalFiles: liveStats.totalFiles,
    linesOfCode: liveStats.linesOfCode,
    componentCount: liveStats.componentCount,
    toolCount: liveStats.toolCount,
    supportingComponents: liveStats.supportingComponents,
    utilityCount: liveStats.utilityCount,
    hookCount: liveStats.hookCount,
    contextCount: liveStats.contextCount,
    disabilityCount: liveStats.disabilityCount,
    secondaryCount: liveStats.secondaryCount,
    vaFormsCount: liveStats.vaFormsCount,
    localAIModels: liveStats.localAIModels,
    appSizeMB: liveStats.appSizeMB,
    calculatedAt: liveStats.calculatedAt
  }
};

// Write to JSON file
const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(stats, null, 2), 'utf-8');

console.log(`   ✅ Saved to: ${OUTPUT_PATH}`);

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('✅ PROJECT STATS UPDATED SUCCESSFULLY!');
console.log('═══════════════════════════════════════════════════════════════');
console.log('\n📋 Development Breakdown:');
console.log(`   • Coding: ${formatNumber(codingHours)} hrs (${formatNumber(liveStats.linesOfCode)} LOC ÷ ${BLENDED_LOC_PER_HOUR})`);
console.log(`   • Testing: ${formatNumber(testingHours)} hrs (15% of coding)`);
console.log(`   • Validation: ${formatNumber(validationHours)} hrs`);
console.log(`   • UI/UX: ${formatNumber(uiuxHours)} hrs`);
console.log(`   • Documentation: ${formatNumber(documentationHours)} hrs`);
console.log(`   • Research: ${formatNumber(researchHours)} hrs`);
console.log(`   • Deployment: ${formatNumber(deploymentHours)} hrs`);
console.log(`   ─────────────────────────────`);
console.log(`   • TOTAL: ${formatNumber(totalTraditionalHours)} hrs (${yearsEquivalent} years FTE)`);
console.log('\n💰 Cost Analysis:');
console.log(`   • Traditional: $${formatNumber(traditionalCost)} (${formatNumber(totalTraditionalHours)} hrs × $${HOURLY_RATE}/hr)`);
console.log(`   • Actual: $${formatNumber(actualCost)} (${actualHours} hrs AI-assisted)`);
console.log(`   • Savings: $${formatNumber(costSavings)} (${savingsPercent}%)`);
console.log(`   • Productivity: ${productivityMultiplier}x multiplier`);
console.log(`\n📅 Last Updated: ${stats.last_updated}`);
