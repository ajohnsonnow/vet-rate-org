/**
 * Extract Project Statistics from README.md
 * Generates src/data/projectStats.json for dynamic UI content
 * Run this script during build or manually when stats change
 * 
 * DYNAMIC CALCULATIONS:
 * - Component hours: Summed from the Major Component table
 * - Coding hours: LOC ÷ blended team rate (9.77 LOC/hr)
 * - Traditional cost: total hours × hourly rate ($135/hr)
 * - Cost savings: traditional - actual
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const README_PATH = path.resolve(__dirname, '../README.md');
const OUTPUT_PATH = path.resolve(__dirname, '../src/data/projectStats.json');

// Read README.md
const readmeContent = fs.readFileSync(README_PATH, 'utf-8');

// ========== HELPER FUNCTIONS ==========

// Helper function to extract numbers with commas
const extractNumber = (text) => {
  const match = text.match(/[\d,]+/);
  return match ? match[0] : '0';
};

// Helper to extract first number occurrence
const extractFirstNumber = (regex, defaultValue = '0') => {
  const match = readmeContent.match(regex);
  return match ? extractNumber(match[1] || match[0]) : defaultValue;
};

// Helper to calculate full-time equivalent years from hours
const calculateYears = (hours) => {
  const hoursPerYear = 2080; // Standard full-time work year
  return (hours / hoursPerYear).toFixed(1);
};

// Helper to format currency with commas
const formatCurrency = (amount) => {
  return `$${amount.toLocaleString('en-US')}`;
};

// Helper to calculate savings percentage
const calculateSavingsPercent = (traditional, actual) => {
  return ((1 - (actual / traditional)) * 100).toFixed(1);
};

// Helper to format number with commas
const formatNumber = (num) => {
  return num.toLocaleString('en-US');
};

// ========== DYNAMIC CALCULATIONS ==========

// Constants for calculation
const BLENDED_LOC_PER_HOUR = 9.77;  // Blended team rate from README
const HOURLY_RATE = 135;            // Senior developer rate
const TESTING_PERCENT = 0.15;       // Testing is 15% of coding time

// Extract Lines of Code (this drives coding hours calculation)
const locMatch = readmeContent.match(/Lines of Code.*?([\d,]+)\s*lines/i);
const linesOfCode = locMatch ? parseInt(locMatch[1].replace(/,/g, ''), 10) : 128477;

// Calculate coding hours dynamically from LOC
const codingHours = Math.round(linesOfCode / BLENDED_LOC_PER_HOUR);

// Extract component hours from the Major Component table
const componentTableRegex = /\|\s*([^|]+)\s*\|\s*(\d+)\s*hrs\s*\|/g;
let componentHoursTotal = 0;
let componentCount = 0;
let match;

while ((match = componentTableRegex.exec(readmeContent)) !== null) {
  const hours = parseInt(match[2], 10);
  componentHoursTotal += hours;
  componentCount++;
}

console.log(`📊 Found ${componentCount} components totaling ${formatNumber(componentHoursTotal)} hours`);

// Extract other breakdown hours (non-coding categories)
const validationHours = parseInt(extractFirstNumber(/Data validation.*?([\d,]+)\s*hrs/i, '250').replace(/,/g, ''), 10);
const testingHours = Math.round(codingHours * TESTING_PERCENT);
const uiuxHours = parseInt(extractFirstNumber(/UI\/UX.*?([\d,]+)\s*hrs/i, '400').replace(/,/g, ''), 10);
const documentationHours = parseInt(extractFirstNumber(/Documentation.*?([\d,]+)\s*hrs/i, '200').replace(/,/g, ''), 10);
const researchHours = parseInt(extractFirstNumber(/Research.*?([\d,]+)\s*hrs/i, '150').replace(/,/g, ''), 10);
const deploymentHours = parseInt(extractFirstNumber(/Deployment.*?([\d,]+)\s*hrs/i, '73').replace(/,/g, ''), 10);

// Calculate total traditional hours
const totalTraditionalHours = codingHours + validationHours + testingHours + uiuxHours + documentationHours + researchHours + deploymentHours;

// Calculate traditional cost from hours
const traditionalCost = totalTraditionalHours * HOURLY_RATE;

// Extract actual hours and cost
const actualHours = parseInt(extractFirstNumber(/Actual AI-Assisted Development.*?(\d+)\s*hours/i, '55'), 10);
const actualCost = parseInt(extractFirstNumber(/Actual AI-Assisted Development.*?=\s*\$([\d,]+)/i, '7425').replace(/,/g, ''), 10);

// Calculate cost savings
const costSavings = traditionalCost - actualCost;
const savingsPercent = calculateSavingsPercent(traditionalCost, actualCost);

// Calculate productivity multiplier
const productivityMultiplier = Math.round(totalTraditionalHours / actualHours);

console.log(`\n📈 Dynamic Calculations:`);
console.log(`   Coding hours (${formatNumber(linesOfCode)} LOC ÷ ${BLENDED_LOC_PER_HOUR} LOC/hr) = ${formatNumber(codingHours)} hrs`);
console.log(`   Testing hours (${TESTING_PERCENT * 100}% of coding) = ${formatNumber(testingHours)} hrs`);
console.log(`   Total traditional hours = ${formatNumber(totalTraditionalHours)} hrs`);
console.log(`   Traditional cost (${formatNumber(totalTraditionalHours)} × $${HOURLY_RATE}/hr) = ${formatCurrency(traditionalCost)}`);
console.log(`   Productivity multiplier = ${productivityMultiplier}x`);

// ========== BUILD STATS OBJECT ==========

// ========== BUILD STATS OBJECT ==========

const stats = {
  // Core metrics - DYNAMICALLY CALCULATED
  total_hours: formatNumber(totalTraditionalHours),
  coding_hours: formatNumber(codingHours),
  actual_hours: String(actualHours),
  coding_sessions: extractFirstNumber(/(\d+)\s*active coding sessions/i, '18'),
  years_dev: calculateYears(totalTraditionalHours),
  loc_count: formatNumber(linesOfCode),
  
  // Cost metrics - DYNAMICALLY CALCULATED
  traditional_cost: formatNumber(traditionalCost),
  actual_cost: formatNumber(actualCost),
  cost_savings: formatCurrency(costSavings),
  savings_percent: savingsPercent,
  hourly_rate: String(HOURLY_RATE),
  
  // Component breakdown - DYNAMICALLY SUMMED
  component_hours_total: formatNumber(componentHoursTotal),
  component_count_from_table: componentCount,
  
  // Development breakdown - DYNAMICALLY CALCULATED
  breakdown: {
    coding: codingHours,
    validation: validationHours,
    testing: testingHours,
    uiux: uiuxHours,
    documentation: documentationHours,
    research: researchHours,
    deployment: deploymentHours
  },
  
  // Research and validation (extracted)
  research_hours: String(researchHours),
  validation_hours: String(validationHours),
  validation_count: extractFirstNumber(/(\d+)\s*disabilities.*?verified/i, '751'),
  validation_lines: extractFirstNumber(/validating\s*([\d,]+)\+?\s*lines/i, '15,000'),
  
  // Project metrics (extracted)
  total_files: extractFirstNumber(/Total Files.*?([\d,]+)\s*project files/i, '1,135'),
  total_commits: extractFirstNumber(/Total Commits.*?(\d+)\s*commits/i, '52'),
  component_count: extractFirstNumber(/(\d+)\s*React components/i, '111'),
  major_tools: extractFirstNumber(/(\d+)\+?\s*major tools/i, '40'),
  utility_count: extractFirstNumber(/(\d+)\s*helper modules/i, '47'),
  
  // Project timeline
  days_dev: extractFirstNumber(/([\d.]+)\s*days.*?\(Jan/i, '4.5'),
  productivity_multiplier: String(productivityMultiplier),
  
  // Features and conditions
  secondary_conditions: extractFirstNumber(/(\d+)\+?\s*medically-recognized secondary/i, '500'),
  forms_supported: extractFirstNumber(/(\d+)\+?\s*VA forms/i, '16'),
  
  // Financial
  market_value: `$${Math.round(totalTraditionalHours * 50 / 1000)}K`,
  competitor_price: extractFirstNumber(/\$(\d+)\+?\s*per use/i, '500'),
  
  // AI Tools Used (for dynamic reference)
  ai_tools: {
    planning: 'Gemini 3',
    coding: ['Claude 4.5 Opus', 'Claude 4.5 Sonnet', 'Claude 4.5 Haiku'],
    ide: 'VS Code',
    frameworks: ['React 18', 'Vite', 'Tailwind CSS']
  },
  
  // Date metadata - Use LOCAL timezone, not UTC
  first_commit: 'January 15, 2026',
  last_updated: new Date().toLocaleDateString('en-CA'),
  version: new Date().toLocaleDateString('en-CA').replace(/-/g, '')
};

// Add numeric versions for programmatic use
const formattedStats = {
  ...stats,
  total_hours_numeric: totalTraditionalHours,
  coding_hours_numeric: codingHours,
  loc_count_numeric: linesOfCode,
  validation_count_numeric: parseInt(stats.validation_count.replace(/,/g, ''), 10),
  traditional_cost_numeric: traditionalCost,
  actual_cost_numeric: actualCost,
  cost_savings_numeric: costSavings,
  coding_sessions_numeric: parseInt(stats.coding_sessions, 10),
  productivity_multiplier_numeric: productivityMultiplier,
  component_hours_numeric: componentHoursTotal
};

// Create output directory if it doesn't exist
const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write to JSON file
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(formattedStats, null, 2), 'utf-8');

console.log('\n✅ Project stats updated successfully!');
console.log(`📊 Stats extracted from: ${README_PATH}`);
console.log(`💾 Stats saved to: ${OUTPUT_PATH}`);
console.log('\n📋 Development Breakdown (Dynamically Calculated):');
console.log(`   • Coding: ${formatNumber(codingHours)} hrs (${formatNumber(linesOfCode)} LOC ÷ ${BLENDED_LOC_PER_HOUR})`);
console.log(`   • Testing: ${formatNumber(testingHours)} hrs (15% of coding)`);
console.log(`   • Validation: ${formatNumber(validationHours)} hrs`);
console.log(`   • UI/UX: ${formatNumber(uiuxHours)} hrs`);
console.log(`   • Documentation: ${formatNumber(documentationHours)} hrs`);
console.log(`   • Research: ${formatNumber(researchHours)} hrs`);
console.log(`   • Deployment: ${formatNumber(deploymentHours)} hrs`);
console.log(`   ─────────────────────────────`);
console.log(`   • TOTAL: ${formatNumber(totalTraditionalHours)} hrs (${calculateYears(totalTraditionalHours)} years FTE)`);
console.log('\n💰 Cost Analysis (Dynamically Calculated):');
console.log(`   • Traditional: ${formatCurrency(traditionalCost)} (${formatNumber(totalTraditionalHours)} hrs × $${HOURLY_RATE}/hr)`);
console.log(`   • Actual: ${formatCurrency(actualCost)} (${actualHours} hrs AI-assisted)`);
console.log(`   • Savings: ${formatCurrency(costSavings)} (${savingsPercent}%)`);
console.log(`   • Productivity: ${productivityMultiplier}x multiplier`);
console.log(`\n📅 Last Updated: ${stats.last_updated}`);
