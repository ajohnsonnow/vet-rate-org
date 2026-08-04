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

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { calculateLiveStats, formatNumber } from "./calculate-live-stats.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const README_PATH = path.resolve(__dirname, "../README.md");
const OUTPUT_PATH = path.resolve(__dirname, "../src/data/projectStats.json");
const PACKAGE_PATH = path.resolve(__dirname, "../package.json");

// Read package.json for version
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf-8"));
const currentVersion = packageJson.version;

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1: Calculate Live Stats
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n📊 CALCULATING LIVE PROJECT STATISTICS...");
console.log(
  "═══════════════════════════════════════════════════════════════\n",
);

const liveStats = calculateLiveStats();

console.log(`📁 Total Files:        ${formatNumber(liveStats.totalFiles)}`);
console.log(`📝 Lines of Code:      ${formatNumber(liveStats.linesOfCode)}`);
console.log(`📦 App Size:           ${liveStats.appSizeMB} MB`);
console.log(
  `⚛️  Components:         ${liveStats.componentCount} (${liveStats.toolCount} tools + ${liveStats.supportingComponents} supporting)`,
);
console.log(`🔧 Utilities:          ${liveStats.utilityCount}`);
console.log(`🏥 Disabilities:       ${liveStats.disabilityCount}`);
console.log(`🔗 Secondary Conds:    ${liveStats.secondaryCount}+`);
console.log(`📄 VA Forms:           ${liveStats.vaFormsCount}`);
console.log(`🤖 Local AI Models:    ${liveStats.localAIModels}`);

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2: Update README.md with Live Values
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n📝 UPDATING README.md WITH LIVE VALUES...");

let readmeContent = fs.readFileSync(README_PATH, "utf-8");
let readmeUpdates = 0;

// NOTE: Dynamic patterns that depend on calculated values are added in PHASE 2B below
// Define README update patterns (static patterns that can be applied now)
const readmeReplacements = [
  // Lines of Code
  {
    pattern: /Lines of Code.{0,40}?[\d,]{1,15}\s{0,5}lines/gi,
    replacement: `Lines of Code**: ${formatNumber(liveStats.linesOfCode)} lines`,
  },
  // Total Files
  {
    pattern: /Total Files.{0,40}?[\d,]{1,15}\s{0,5}project files/gi,
    replacement: `Total Files**: ${formatNumber(liveStats.totalFiles)} project files`,
  },
  // App Size - NOW DYNAMIC
  {
    pattern: /App Size.{0,40}?[\d,.]{1,15}\s{0,5}MB/gi,
    replacement: `App Size**: ${liveStats.appSizeMB} MB`,
  },
  // Components count
  {
    pattern:
      /Components.{0,40}?[\d,]{1,15}\s{0,5}React components\s{0,5}\(\d{1,7}\s{0,5}major tools\s{0,5}\+\s{0,5}\d{1,7}\s{0,5}supporting\)/gi,
    replacement: `Components**: ${liveStats.componentCount} React components (${liveStats.toolCount} major tools + ${liveStats.supportingComponents} supporting)`,
  },
  // Utilities
  {
    pattern: /Utilities.{0,40}?[\d,]{1,15}\s{0,5}helper modules/gi,
    replacement: `Utilities**: ${liveStats.utilityCount} helper modules`,
  },
  // Data validation disability count
  {
    pattern: /Data Validation.{0,40}?[\d,]{1,15}\s{0,5}disabilities verified/gi,
    replacement: `Data Validation**: ${liveStats.disabilityCount} disabilities verified`,
  },
  // Professional tools count (matches both "professional tools" and "professional-grade tools")
  {
    pattern: /(\d{1,7})\s{0,5}(professional(?:-grade)?)\s{0,5}tools/gi,
    replacement: `${liveStats.toolCount} $2 tools`,
  },
  // Specialized tools count
  {
    pattern: /\*\*(\d+)\s*specialized tools\*\*/gi,
    replacement: `**${liveStats.toolCount} specialized tools**`,
  },
  // Arsenal header
  {
    pattern: /Complete Arsenal:\s*\d+\s*Professional Tools/gi,
    replacement: `Complete Arsenal: ${liveStats.toolCount} Professional Tools`,
  },
];

for (const { pattern, replacement } of readmeReplacements) {
  const matches = readmeContent.match(pattern);
  if (matches) {
    readmeContent = readmeContent.replace(pattern, replacement);
    readmeUpdates += matches.length;
  }
}

// Don't write yet - we'll add more dynamic patterns after calculations
// fs.writeFileSync(README_PATH, readmeContent);
// console.log(`   ✅ Updated ${readmeUpdates} values in README.md`);

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3: Calculate Development Metrics
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n⏱️  CALCULATING DEVELOPMENT METRICS...");

// Constants for calculation (industry-verified benchmarks)
const BLENDED_LOC_PER_HOUR = 9.77; // Blended team rate (from COST_ANALYSIS.md)
const TRADITIONAL_SENIOR_RATE = 135; // Traditional senior developer market rate
const ACTUAL_HOURLY_RATE = 420; // Your actual content engineering rate (senior full-stack + DevOps + domain expertise)
const TESTING_PERCENT = 0.15; // Testing is 15% of coding time

// Get actual git stats FIRST (needed for actual hours calculation)
let actualCommits = 141;
let actualCodingDays = 10;
try {
  actualCommits = parseInt(
    execSync("git log --oneline", { encoding: "utf-8" }).trim().split("\n")
      .length,
    10,
  );
  actualCodingDays = execSync('git log --format="%ad" --date=short', {
    encoding: "utf-8",
  })
    .trim()
    .split("\n")
    .filter((v, i, a) => a.indexOf(v) === i).length;
  console.log(
    `   📊 Git stats: ${actualCommits} commits over ${actualCodingDays} active days`,
  );
} catch (e) {
  console.error("   ⚠️ Could not read git stats, using defaults:", e.message);
}

// Estimate actual hours: ~8-12 hours per active day (conservative estimate)
const HOURS_PER_DAY = 10; // Average focused coding hours per day
const actualHoursEstimate = actualCodingDays * HOURS_PER_DAY;

// Override: Use confirmed 150 hours if available (user-verified actual time)
const CONFIRMED_ACTUAL_HOURS = 150;
const actualHours = CONFIRMED_ACTUAL_HOURS || actualHoursEstimate;

// Calculate coding hours from actual LOC
const codingHours = Math.round(liveStats.linesOfCode / BLENDED_LOC_PER_HOUR);
const testingHours = Math.round(codingHours * TESTING_PERCENT);

// Other hours are fixed estimates (not extracted from README)
const validationHours = 250; // Data validation
const uiuxHours = 400; // UI/UX design
const documentationHours = 200; // Documentation
const researchHours = 150; // Research
const deploymentHours = 73; // Deployment

// Calculate totals
const totalTraditionalHours =
  codingHours +
  validationHours +
  testingHours +
  uiuxHours +
  documentationHours +
  researchHours +
  deploymentHours;
const traditionalCost = totalTraditionalHours * TRADITIONAL_SENIOR_RATE; // What a traditional team would cost

// Actual development metrics (dynamically calculated with user-confirmed hours)
const actualCost = actualHours * ACTUAL_HOURLY_RATE; // What it actually cost at your rate
const costSavings = traditionalCost - actualCost;
const savingsPercent = ((1 - actualCost / traditionalCost) * 100).toFixed(1);
const productivityMultiplier = Math.round(totalTraditionalHours / actualHours);
const yearsEquivalent = (totalTraditionalHours / 2080).toFixed(1);

console.log(
  `   Coding hours: ${formatNumber(liveStats.linesOfCode)} LOC ÷ ${BLENDED_LOC_PER_HOUR} = ${formatNumber(codingHours)} hrs`,
);
console.log(`   Testing hours: ${testingHours} hrs (15% of coding)`);
console.log(
  `   Total traditional: ${formatNumber(totalTraditionalHours)} hrs (${yearsEquivalent} years FTE)`,
);
console.log(`   Traditional cost: $${formatNumber(traditionalCost)}`);
console.log(`   Productivity: ${productivityMultiplier}x multiplier`);

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2B: Apply Dynamic Patterns (now that calculations are complete)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n📝 APPLYING DYNAMIC STAT UPDATES TO README.md...");

// Dynamic patterns that require calculated values
const dynamicPatterns = [
  // Traditional Solo Development line
  {
    pattern:
      /Traditional Solo Development.{0,40}?[\d,]{1,15}\s{0,5}hours\s{0,5}\([\d.]{1,10}\s{0,5}years full-time\)\s{0,5}@\s{0,5}\$[\d,]{1,15}\/hr\s{0,5}=\s{0,5}\$[\d,]{1,15}/gi,
    replacement: `Traditional Solo Development**: ${formatNumber(totalTraditionalHours)} hours (${yearsEquivalent} years full-time) @ $${TRADITIONAL_SENIOR_RATE}/hr = $${formatNumber(traditionalCost)}`,
  },
  // Actual AI-Assisted Development line (flexible patterns)
  {
    pattern:
      /Actual AI-Assisted Development.{0,40}?[\d,]{1,15}\s{0,5}hours.{0,60}?=\s{0,5}\$[\d,]{1,15}/gi,
    replacement: `Actual AI-Assisted Development**: ${actualHours} hours over ${actualCodingDays} days = $${formatNumber(actualCost)}`,
  },
  // Productivity Multiplier
  {
    pattern: /Productivity Multiplier.{0,40}?[\d,]{1,15}x/gi,
    replacement: `Productivity Multiplier**: ${productivityMultiplier}x`,
  },
  // Option C: Solo Senior Developer cost
  {
    pattern:
      /1 Senior Developer:\s*\$[\d,]+\s*\n-\s*\*\*Total:\s*\$[\d,]+\*\*\s*\|\s*Timeline:\s*[\d.]+\s*years/gi,
    replacement: `1 Senior Developer: $${formatNumber(traditionalCost)}\n- **Total: $${formatNumber(traditionalCost)}** | Timeline: ${yearsEquivalent} years`,
  },
  // Option D: AI-Assisted actual cost
  {
    pattern: /1 Senior Developer \+ AI Tools:\s*\$[\d,]+/gi,
    replacement: `1 Senior Developer + AI Tools: $${formatNumber(actualCost)}`,
  },
  // The 280x line (update to actual multiplier)
  {
    pattern: /This\s+[\d,]+x\s+productivity multiplier/gi,
    replacement: `This ${productivityMultiplier}x productivity multiplier`,
  },
  // AI-Assisted actual line at bottom
  {
    pattern:
      /Actual AI-Assisted.*?\(2026\):\s*\*\*\$[\d,]+\s*over\s*[\d.]+\s*days\*\*/gi,
    replacement: `Actual AI-Assisted** (2026): **$${formatNumber(actualCost)} over ${actualCodingDays} days**`,
  },
  // Total hours in development breakdown
  {
    pattern: /Total:\s*[\d,]+\s*hours\*\*\s*\([\d.]+\s*years solo/gi,
    replacement: `Total: ${formatNumber(totalTraditionalHours)} hours** (${yearsEquivalent} years solo`,
  },
];

for (const { pattern, replacement } of dynamicPatterns) {
  const matches = readmeContent.match(pattern);
  if (matches) {
    readmeContent = readmeContent.replace(pattern, replacement);
    readmeUpdates += matches.length;
  }
}

// Now write updated README
fs.writeFileSync(README_PATH, readmeContent);
console.log(`   ✅ Updated ${readmeUpdates} values in README.md`);

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2C: Update AGENTIC_VALUE_PROPOSITION.md
// ═══════════════════════════════════════════════════════════════════════════════

const AGENTIC_PATH = path.resolve(__dirname, "../AGENTIC_VALUE_PROPOSITION.md");
if (fs.existsSync(AGENTIC_PATH)) {
  console.log("\n📝 UPDATING AGENTIC_VALUE_PROPOSITION.md...");
  let agenticContent = fs.readFileSync(AGENTIC_PATH, "utf-8");
  let agenticUpdates = 0;

  const agenticPatterns = [
    // Executive summary timeline
    {
      pattern: /Timeline.{0,40}?[\d.]{1,10}\s{0,5}years\s{0,5}\(solo\)/gi,
      replacement: `Timeline** | ${yearsEquivalent} years (solo)`,
    },
    // Executive summary cost
    {
      pattern: /\*\*Cost\*\*\s*\|\s*\$[\d,]+/gi,
      replacement: `**Cost** | $${formatNumber(traditionalCost)}`,
    },
    // Agentic cost
    { pattern: /\$63,000/g, replacement: `$${formatNumber(actualCost)}` },
    // Lines of code count
    {
      pattern: /\*\*Lines of Code\*\*\s*\|\s*[\d,]+/gi,
      replacement: `**Lines of Code** | ${formatNumber(liveStats.linesOfCode)}`,
    },
    // Total files
    {
      pattern: /\*\*Total Files\*\*\s*\|\s*[\d,]+/gi,
      replacement: `**Total Files** | ${formatNumber(liveStats.totalFiles)}`,
    },
    // React Components
    {
      pattern: /\*\*React Components\*\*\s*\|\s*[\d,]+/gi,
      replacement: `**React Components** | ${liveStats.componentCount}`,
    },
    // Disabilities Database
    {
      pattern: /\*\*Disabilities Database\*\*\s*\|\s*[\d,]+/gi,
      replacement: `**Disabilities Database** | ${liveStats.disabilityCount}`,
    },
    // Secondary Conditions
    {
      pattern: /\*\*Secondary Conditions\*\*\s*\|\s*[\d,]+\+?/gi,
      replacement: `**Secondary Conditions** | ${liveStats.secondaryCount}`,
    },
    // VA Forms Supported
    {
      pattern: /\*\*VA Forms Supported\*\*\s*\|\s*[\d,]+/gi,
      replacement: `**VA Forms Supported** | ${liveStats.vaFormsCount}`,
    },
    // Local AI Models
    {
      pattern: /\*\*Local AI Models\*\*\s*\|\s*[\d,]+/gi,
      replacement: `**Local AI Models** | ${liveStats.localAIModels}`,
    },
    // Utility Modules
    {
      pattern: /\*\*Utility Modules\*\*\s*\|\s*[\d,]+/gi,
      replacement: `**Utility Modules** | ${liveStats.utilityCount}`,
    },
    // Tool count
    {
      pattern: /\d{1,7}\s{0,5}major tools/gi,
      replacement: `${liveStats.toolCount} major tools`,
    },
    // Supporting components
    {
      pattern: /\d{1,7}\s{0,5}supporting/gi,
      replacement: `${liveStats.supportingComponents} supporting`,
    },
    // Local AI models inline
    {
      pattern: /\*\*\d+\s*local AI models\*\*/gi,
      replacement: `**${liveStats.localAIModels} local AI models**`,
    },
    // Production tools bullet
    {
      pattern: /\*\*\d+\s*production tools\*\*/gi,
      replacement: `**${liveStats.toolCount} production tools**`,
    },
    // Validated conditions bullet
    {
      pattern: /\*\*\d+\s*validated conditions\*\*/gi,
      replacement: `**${liveStats.disabilityCount} validated conditions**`,
    },
    // Traditional hours
    { pattern: /23,884/g, replacement: formatNumber(totalTraditionalHours) },
    // Actual hours
    { pattern: /150 hours/g, replacement: `${actualHours} hours` },
    // Productivity multiplier
    { pattern: /159x/g, replacement: `${productivityMultiplier}x` },
    // Years equivalent
    { pattern: /11\.5 years/g, replacement: `${yearsEquivalent} years` },
    // Traditional cost $3.2M etc
    {
      pattern: /\$3,224,340/g,
      replacement: `$${formatNumber(traditionalCost)}`,
    },
    {
      pattern: /\$3\.2 million/gi,
      replacement: `$${(traditionalCost / 1000000).toFixed(1)} million`,
    },
    // Days count
    { pattern: /22 days/g, replacement: `${actualCodingDays} days` },
    // App size
    { pattern: /353 MB/g, replacement: `${liveStats.appSizeMB} MB` },
    // Git commits
    { pattern: /241 commits/gi, replacement: `${actualCommits} commits` },
    // LOC per hour
    {
      pattern: /1,292 LOC\/hour/gi,
      replacement: `${formatNumber(Math.round(liveStats.linesOfCode / actualHours))} LOC/hour`,
    },
    // Cost savings
    { pattern: /\$3,161,340/g, replacement: `$${formatNumber(costSavings)}` },
    // Savings percent
    { pattern: /98%/g, replacement: `${savingsPercent}%` },
  ];

  for (const { pattern, replacement } of agenticPatterns) {
    const matches = agenticContent.match(pattern);
    if (matches) {
      agenticContent = agenticContent.replace(pattern, replacement);
      agenticUpdates += matches.length;
    }
  }

  // Update version and date
  agenticContent = agenticContent.replace(
    /\*Version:\s*[\d.]+\*/gi,
    `*Version: ${currentVersion}*`,
  );
  agenticContent = agenticContent.replace(
    /\*Document generated:.*?\*/gi,
    `*Document generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}*`,
  );

  fs.writeFileSync(AGENTIC_PATH, agenticContent);
  console.log(
    `   ✅ Updated ${agenticUpdates} values in AGENTIC_VALUE_PROPOSITION.md`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4: Generate projectStats.json
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n💾 GENERATING projectStats.json...");

// Get component table hours from README
const componentTableRegex =
  /\|\s{0,5}([^|]{1,300})\s{0,5}\|\s{0,5}(\d{1,7})\s{0,5}hrs\s{0,5}\|/g;
let componentHoursTotal = 0;
let componentCountFromTable = 0;
let match;

while ((match = componentTableRegex.exec(readmeContent)) !== null) {
  const hours = parseInt(match[2], 10);
  componentHoursTotal += hours;
  componentCountFromTable++;
}

// Calculate days dynamically from first commit to now
const FIRST_COMMIT_DATE = new Date("2026-01-15T20:05:00");
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
  hourly_rate: String(ACTUAL_HOURLY_RATE), // Your actual rate

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
    deployment: deploymentHours,
  },

  // Project timeline (dynamically calculated)
  days_dev: String(daysDev),
  productivity_multiplier: String(productivityMultiplier),
  total_commits: String(actualCommits),

  // AI Tools
  ai_tools: {
    planning: "Gemini 3",
    coding: ["Claude 4.5 Opus", "Claude 4.5 Sonnet", "Claude 4.5 Haiku"],
    ide: "VS Code",
    frameworks: ["React 18", "Vite", "Tailwind CSS"],
  },

  // Metadata
  first_commit: "January 15, 2026",
  last_updated: new Date().toLocaleDateString("en-CA"),
  version: new Date().toLocaleDateString("en-CA").replace(/-/g, ""),

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
    calculatedAt: liveStats.calculatedAt,
  },
};

// Write to JSON file
const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(stats, null, 2), "utf-8");

console.log(`   ✅ Saved to: ${OUTPUT_PATH}`);

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════

console.log(
  "\n═══════════════════════════════════════════════════════════════",
);
console.log("✅ PROJECT STATS UPDATED SUCCESSFULLY!");
console.log("═══════════════════════════════════════════════════════════════");
console.log("\n📋 Development Breakdown:");
console.log(
  `   • Coding: ${formatNumber(codingHours)} hrs (${formatNumber(liveStats.linesOfCode)} LOC ÷ ${BLENDED_LOC_PER_HOUR})`,
);
console.log(`   • Testing: ${formatNumber(testingHours)} hrs (15% of coding)`);
console.log(`   • Validation: ${formatNumber(validationHours)} hrs`);
console.log(`   • UI/UX: ${formatNumber(uiuxHours)} hrs`);
console.log(`   • Documentation: ${formatNumber(documentationHours)} hrs`);
console.log(`   • Research: ${formatNumber(researchHours)} hrs`);
console.log(`   • Deployment: ${formatNumber(deploymentHours)} hrs`);
console.log(`   ─────────────────────────────`);
console.log(
  `   • TOTAL: ${formatNumber(totalTraditionalHours)} hrs (${yearsEquivalent} years FTE)`,
);
console.log("\n💰 Cost Analysis:");
console.log(
  `   • Traditional: $${formatNumber(traditionalCost)} (${formatNumber(totalTraditionalHours)} hrs × $${TRADITIONAL_SENIOR_RATE}/hr)`,
);
console.log(
  `   • Actual: $${formatNumber(actualCost)} (${actualHours} hrs × $${ACTUAL_HOURLY_RATE}/hr AI-assisted)`,
);
console.log(`   • Savings: $${formatNumber(costSavings)} (${savingsPercent}%)`);
console.log(`   • Productivity: ${productivityMultiplier}x multiplier`);
console.log(`\n📅 Last Updated: ${stats.last_updated}`);
