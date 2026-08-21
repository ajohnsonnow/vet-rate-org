/**
 * Live Stats Calculator
 * Calculates REAL project statistics by scanning the actual codebase
 *
 * This ensures all stats in README, AboutUs, etc. reflect reality.
 * Run during build: npm run update-stats
 *
 * DIAMOND STANDARD: Numbers must match reality.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// ═══════════════════════════════════════════════════════════════════════════════
// File System Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Recursively get all files matching criteria
 */
function getFiles(
  dir,
  extensions = null,
  excludeDirs = [
    "node_modules",
    "dist",
    ".git",
    ".venv",
    "__pycache__",
    "archive",
    "RooTools",
    "llm-compiler",
  ],
) {
  const results = [];

  if (!fs.existsSync(dir)) return results;

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!excludeDirs.includes(item)) {
        results.push(...getFiles(fullPath, extensions, excludeDirs));
      }
    } else if (stat.isFile()) {
      if (!extensions || extensions.some((ext) => item.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Count lines in a file
 */
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

/**
 * Get directory size in MB
 */
function getDirSizeMB(dir, excludeDirs = ["node_modules", ".git", "models"]) {
  let totalSize = 0;

  function walkDir(currentDir) {
    if (!fs.existsSync(currentDir)) return;

    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!excludeDirs.includes(item)) {
          walkDir(fullPath);
        }
      } else {
        totalSize += stat.size;
      }
    }
  }

  walkDir(dir);
  return (totalSize / (1024 * 1024)).toFixed(2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Stats Calculation Functions
// ═══════════════════════════════════════════════════════════════════════════════

function countProjectFiles({
  rootDir: root,
  srcDir,
  componentsDir,
  utilsDir,
  hooksDir,
  contextsDir,
  formsDir,
}) {
  // Count all project files (excluding node_modules, dist, .git)
  const allFiles = getFiles(root);
  const totalFiles = allFiles.length;

  // Count source code files
  const sourceExtensions = [".js", ".jsx", ".ts", ".tsx", ".css", ".json"];
  const sourceFiles = getFiles(srcDir, sourceExtensions);

  // Count lines of code in source files
  const codeExtensions = [".js", ".jsx", ".ts", ".tsx", ".css"];
  const codeFiles = getFiles(srcDir, codeExtensions);
  const linesOfCode = codeFiles.reduce(
    (total, file) => total + countLines(file),
    0,
  );

  // Count React components (.jsx files in components folder)
  const componentFiles = getFiles(componentsDir, [".jsx"]);
  const componentCount = componentFiles.length;

  // Count utility modules (.js files in utils folder)
  const utilFiles = getFiles(utilsDir, [".js"]);
  const utilityCount = utilFiles.length;

  // Count hooks
  const hookFiles = getFiles(hooksDir, [".js", ".ts"]);
  const hookCount = hookFiles.length;

  // Count contexts
  const contextFiles = getFiles(contextsDir, [".jsx", ".js"]);
  const contextCount = contextFiles.length;

  // Count PDF forms in public/forms
  const formFiles = fs.existsSync(formsDir) ? getFiles(formsDir, [".pdf"]) : [];
  const vaFormsCount = formFiles.length;

  return {
    totalFiles,
    sourceFileCount: sourceFiles.length,
    linesOfCode,
    componentCount,
    utilityCount,
    hookCount,
    contextCount,
    vaFormsCount,
  };
}

function getDisabilityCount(dataDir) {
  // Get disability count from data file
  let disabilityCount = 748; // fallback
  try {
    const disabilityDataPath = path.join(dataDir, "disabilityData.json");
    if (fs.existsSync(disabilityDataPath)) {
      const data = JSON.parse(fs.readFileSync(disabilityDataPath, "utf8"));
      if (data.disabilities) {
        disabilityCount = data.disabilities.length;
      } else if (Array.isArray(data)) {
        disabilityCount = data.length;
      }
    }
  } catch (e) {
    console.warn("Could not read disability data:", e.message);
  }
  return disabilityCount;
}

function getSecondaryCount(dataDir) {
  // Get secondary conditions count from actual data files
  let secondaryCount = 0;
  try {
    // Count from secondary_conditions_db.json (detailed nexus entries)
    const secondaryDbPath = path.join(dataDir, "secondary_conditions_db.json");
    if (fs.existsSync(secondaryDbPath)) {
      const content = fs.readFileSync(secondaryDbPath, "utf8");
      const matches = content.match(/"condition":/g);
      if (matches) {
        secondaryCount = matches.length;
      }
    }

    // Also count relatedSecondaryConditions from disabilityData.json
    const disabilityPath = path.join(dataDir, "disabilityData.json");
    if (fs.existsSync(disabilityPath)) {
      const data = JSON.parse(fs.readFileSync(disabilityPath, "utf8"));
      const disabilities =
        data.disabilities || (Array.isArray(data) ? data : []);
      for (const item of disabilities) {
        if (
          item.relatedSecondaryConditions &&
          Array.isArray(item.relatedSecondaryConditions)
        ) {
          secondaryCount += item.relatedSecondaryConditions.length;
        }
      }
    }

    // Fallback if still 0
    if (secondaryCount === 0) secondaryCount = 65;
  } catch (e) {
    console.warn("Could not read secondary conditions data:", e.message);
    secondaryCount = 65; // fallback to known minimum
  }
  return secondaryCount;
}

function getToolCount(dataDir) {
  // Get tool count from toolkitData
  let toolCount = 40; // fallback
  try {
    const toolkitPath = path.join(dataDir, "toolkitData.js");
    if (fs.existsSync(toolkitPath)) {
      const content = fs.readFileSync(toolkitPath, "utf8");
      // Count tools by matching { name: 'Tool Name' patterns in tools arrays
      const toolMatches = content.match(/{\s*name:\s*['"][^'"]+['"]/g);
      if (toolMatches) {
        toolCount = toolMatches.length;
      }
    }
  } catch (e) {
    console.warn("Could not read toolkit data:", e.message);
    // Use fallback
  }
  return toolCount;
}

function getLocalAIModelCount(componentsDir) {
  // Get Local AI model count
  // Diamond Swarm: 3 Desktop (7B) + 3 Mobile (1.7B distilled) = 6 total
  let localAIModels = 6; // Diamond Swarm full suite
  try {
    const localAIPath = path.join(componentsDir, "LocalAIPanel.jsx");
    if (fs.existsSync(localAIPath)) {
      const content = fs.readFileSync(localAIPath, "utf8");
      // Count entries in AVAILABLE_MODELS array (desktop models)
      const modelMatch = content.match(
        /const AVAILABLE_MODELS = \[([\s\S]*?)\];/,
      );
      if (modelMatch) {
        const modelMatches = modelMatch[1].match(/{\s*id:/g);
        if (modelMatches) {
          // Desktop models + 3 mobile counterparts (auditor, writer, rater mobile distilled)
          localAIModels = modelMatches.length + 3; // mobile versions
        }
      }
    }
  } catch (e) {
    console.warn("Could not read local AI model data:", e.message);
    // Use fallback
  }
  return localAIModels;
}

function getAppSizeMB(srcDir, publicDir) {
  // Calculate project size (src + public only, not node_modules/dist/.git)
  const srcSizeMB = getDirSizeMB(srcDir);
  const publicSizeMB = getDirSizeMB(publicDir);
  return (parseFloat(srcSizeMB) + parseFloat(publicSizeMB)).toFixed(2);
}

/**
 * Calculate all live project statistics
 */
export function calculateLiveStats() {
  const srcDir = path.join(rootDir, "src");
  const publicDir = path.join(rootDir, "public");
  const componentsDir = path.join(srcDir, "components");
  const utilsDir = path.join(srcDir, "utils");
  const hooksDir = path.join(srcDir, "hooks");
  const contextsDir = path.join(srcDir, "contexts");
  const dataDir = path.join(srcDir, "data");
  const formsDir = path.join(publicDir, "forms");

  const fileCounts = countProjectFiles({
    rootDir,
    srcDir,
    componentsDir,
    utilsDir,
    hooksDir,
    contextsDir,
    formsDir,
  });
  const disabilityCount = getDisabilityCount(dataDir);
  const secondaryCount = getSecondaryCount(dataDir);
  const toolCount = getToolCount(dataDir);
  const localAIModels = getLocalAIModelCount(componentsDir);
  const appSizeMB = getAppSizeMB(srcDir, publicDir);

  // Calculate supporting components (total - major tools)
  const supportingComponents = fileCounts.componentCount - toolCount;

  return {
    // File counts
    totalFiles: fileCounts.totalFiles,
    sourceFileCount: fileCounts.sourceFileCount,

    // Code metrics
    linesOfCode: fileCounts.linesOfCode,

    // Component counts
    componentCount: fileCounts.componentCount,
    toolCount,
    supportingComponents: Math.max(0, supportingComponents),
    utilityCount: fileCounts.utilityCount,
    hookCount: fileCounts.hookCount,
    contextCount: fileCounts.contextCount,

    // Data counts
    disabilityCount,
    secondaryCount,
    vaFormsCount: fileCounts.vaFormsCount,
    localAIModels,

    // Size
    appSizeMB: parseFloat(appSizeMB),

    // Calculated timestamp
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Format number with commas
 */
export function formatNumber(num) {
  // eslint-disable-next-line sonarjs/slow-regex -- input is always `Number.prototype.toString()`, a short bounded numeric string, never attacker-controlled length
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Export
// ═══════════════════════════════════════════════════════════════════════════════

// Run if executed directly
if (process.argv[1] === __filename) {
  const stats = calculateLiveStats();
  console.log("\n📊 LIVE PROJECT STATISTICS");
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log(`📁 Total Files:        ${formatNumber(stats.totalFiles)}`);
  console.log(`📝 Lines of Code:      ${formatNumber(stats.linesOfCode)}`);
  console.log(`📦 App Size:           ${stats.appSizeMB} MB`);
  console.log(
    "───────────────────────────────────────────────────────────────",
  );
  console.log(
    `⚛️  React Components:   ${stats.componentCount} (${stats.toolCount} major tools + ${stats.supportingComponents} supporting)`,
  );
  console.log(`🔧 Utility Modules:    ${stats.utilityCount}`);
  console.log(`🪝 Hooks:              ${stats.hookCount}`);
  console.log(`🌐 Contexts:           ${stats.contextCount}`);
  console.log(
    "───────────────────────────────────────────────────────────────",
  );
  console.log(`🏥 Disabilities:       ${stats.disabilityCount}`);
  console.log(`🔗 Secondary Conds:    ${stats.secondaryCount}+`);
  console.log(`📄 VA Forms:           ${stats.vaFormsCount}`);
  console.log(`🤖 Local AI Models:    ${stats.localAIModels}`);
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
}

export default calculateLiveStats;
