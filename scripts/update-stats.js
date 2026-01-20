/**
 * Extract Project Statistics from README.md
 * Generates src/data/projectStats.json for dynamic UI content
 * Run this script during build or manually when stats change
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
  const numericHours = parseInt(hours.replace(/,/g, ''), 10);
  return (numericHours / hoursPerYear).toFixed(1);
};

// Helper to calculate market value ($50/hr consulting rate)
const calculateMarketValue = (hours) => {
  const numericHours = parseInt(hours.replace(/,/g, ''), 10);
  const value = numericHours * 50;
  return `$${(value / 1000).toFixed(0)}K`;
};

// Extract statistics using regex patterns
const stats = {
  // Core metrics
  total_hours: extractFirstNumber(/Total Development Time.*?~?([\d,]+)\s*hours/i, '7,200'),
  actual_hours: extractFirstNumber(/Actual Time Invested.*?([\d-]+)\s*hours/i, '50-55'),
  years_dev: '', // Will be calculated
  loc_count: extractFirstNumber(/Lines of Code.*?([\d,]+)\s*lines/i, '111,440'),
  
  // Research and validation
  research_hours: extractFirstNumber(/Research.*?([\d,]+)\s*hrs/i, '150'),
  validation_hours: extractFirstNumber(/validating.*?([\d,]+)\s*hours/i, '250'),
  validation_count: extractFirstNumber(/(\d+)\s*disabilities.*?verified/i, '751'),
  validation_lines: extractFirstNumber(/validating\s*([\d,]+)\+?\s*lines/i, '15,000'),
  
  // Project metrics
  total_files: extractFirstNumber(/Total Files.*?([\d,]+)\s*project files/i, '1,135'),
  total_commits: extractFirstNumber(/Total Commits.*?(\d+)\s*commits/i, '52'),
  component_count: extractFirstNumber(/(\d+)\s*React components/i, '111'),
  major_tools: extractFirstNumber(/(\d+)\+?\s*major tools/i, '40'),
  utility_count: extractFirstNumber(/(\d+)\s*helper modules/i, '47'),
  
  // Project timeline
  days_dev: extractFirstNumber(/([\d.]+)\s*days.*?\(Jan/i, '4.5'),
  productivity_multiplier: extractFirstNumber(/Productivity Multiplier.*?(\d+)x/i, '131'),
  
  // Features and conditions
  secondary_conditions: extractFirstNumber(/(\d+)\+?\s*medically-recognized secondary/i, '500'),
  forms_supported: extractFirstNumber(/(\d+)\+?\s*VA forms/i, '16'),
  
  // Financial
  market_value: '', // Will be calculated
  competitor_price: extractFirstNumber(/\$(\d+)\+?\s*per use/i, '500'),
  
  // Date metadata
  first_commit: 'January 15, 2026',
  last_updated: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  version: new Date().toISOString().split('T')[0].replace(/-/g, '') // YYYYMMDD
};

// Calculate derived values
stats.years_dev = calculateYears(stats.total_hours);
stats.market_value = calculateMarketValue(stats.total_hours);

// Format for display (with commas and proper formatting)
const formattedStats = {
  ...stats,
  // Ensure all numeric fields are properly formatted
  total_hours_numeric: parseInt(stats.total_hours.replace(/,/g, ''), 10),
  loc_count_numeric: parseInt(stats.loc_count.replace(/,/g, ''), 10),
  validation_count_numeric: parseInt(stats.validation_count.replace(/,/g, ''), 10)
};

// Create output directory if it doesn't exist
const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write to JSON file
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(formattedStats, null, 2), 'utf-8');

console.log('✅ Project stats updated successfully!');
console.log(`📊 Stats extracted from: ${README_PATH}`);
console.log(`💾 Stats saved to: ${OUTPUT_PATH}`);
console.log('\nCurrent Statistics:');
console.log(`  • Total Development: ${stats.total_hours} hours (${stats.years_dev} years FTE)`);
console.log(`  • Lines of Code: ${stats.loc_count}`);
console.log(`  • Validated Conditions: ${stats.validation_count}`);
console.log(`  • Market Value: ${stats.market_value}`);
console.log(`  • Last Updated: ${stats.last_updated}`);
