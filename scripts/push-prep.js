/**
 * PUSH PREP SCRIPT - "Ready to Deploy"
 *
 * Comprehensive script that prepares everything for pushing to GitHub.
 * Runs all checks, bumps version, builds, and gives you the push command.
 *
 * Usage:
 *   npm run push-prep              # Full prep with smart version bump
 *   npm run push-prep -- --patch   # Force patch version bump
 *   npm run push-prep -- --minor   # Force minor version bump
 *   npm run push-prep -- --major   # Force major version bump
 *   npm run push-prep -- --no-bump # Skip version bump (just build)
 *
 * What this script does:
 * 1. Kills any running Node processes
 * 2. Clears Vite cache
 * 3. Runs pre-deployment validation checks
 * 4. Smart version bump (analyzes commits)
 * 5. Syncs version everywhere
 * 6. Updates stats
 * 7. Checks legal pages
 * 8. Production build
 * 9. Shows git status and push command
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// ═══════════════════════════════════════════════════════════════════════════════
// Colors & Utilities
// ═══════════════════════════════════════════════════════════════════════════════

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logStep(step, total, msg) {
  console.log(
    `\n${colors.cyan}[${step}/${total}]${colors.reset} ${colors.bold}${msg}${colors.reset}`,
  );
}

function logSuccess(msg) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function logError(msg) {
  console.log(`${colors.red}❌ ${msg}${colors.reset}`);
}

function logWarning(msg) {
  console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
}

function exec(cmd, options = {}) {
  try {
    // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
    return execSync(cmd, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: options.silent ? "pipe" : "inherit",
      ...options,
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

function readFile(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, "utf8");
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Parse Arguments
// ═══════════════════════════════════════════════════════════════════════════════

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    forcePatch: args.includes("--patch"),
    forceMinor: args.includes("--minor"),
    forceMajor: args.includes("--major"),
    noBump: args.includes("--no-bump"),
    skipChecks: args.includes("--skip-checks"),
    autoConfirm: args.includes("--yes") || args.includes("-y"),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Version Analysis (from smart-version.js)
// ═══════════════════════════════════════════════════════════════════════════════

function analyzeVersionBump() {
  const majorKeywords = [
    "BREAKING CHANGE",
    "BREAKING:",
    "!:",
    "removed",
    "schema change",
  ];
  const minorKeywords = [
    "feat:",
    "feat(",
    "feature:",
    "add:",
    "new:",
    "implement:",
  ];

  // Get commits since last tag or all commits
  let commits = "";
  try {
    const lastTag = exec('git tag -l "v*" --sort=-version:refname', {
      silent: true,
    })?.split("\n")[0];
    if (lastTag) {
      commits =
        exec(`git log ${lastTag}..HEAD --oneline`, { silent: true }) || "";
    } else {
      commits = exec("git log --oneline -50", { silent: true }) || "";
    }
  } catch {
    commits = "";
  }

  const lines = commits
    .toLowerCase()
    .split("\n")
    .filter((l) => l.trim());

  // Check for major
  if (
    lines.some((l) => majorKeywords.some((k) => l.includes(k.toLowerCase())))
  ) {
    return { type: "major", reason: "Breaking changes detected" };
  }

  // Check for minor
  if (
    lines.some((l) => minorKeywords.some((k) => l.includes(k.toLowerCase())))
  ) {
    return { type: "minor", reason: "New features detected" };
  }

  // Default to patch
  return { type: "patch", reason: "Bug fixes and improvements" };
}

function bumpVersion(currentVersion, bumpType) {
  const [major, minor, patch] = currentVersion.split(".").map(Number);
  switch (bumpType) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Script
// ═══════════════════════════════════════════════════════════════════════════════

// Step 1: Clear cache (don't kill node - that would kill this script!)
function clearViteCache() {
  try {
    const viteCachePath = path.join(rootDir, "node_modules", ".vite");
    if (fs.existsSync(viteCachePath)) {
      fs.rmSync(viteCachePath, { recursive: true, force: true });
      logSuccess("Cleared Vite cache");
    } else {
      logSuccess("Vite cache already clean");
    }
  } catch (err) {
    logWarning("Could not clear Vite cache: " + err.message);
  }
}

// Step 2: Run pre-deployment checks (quick mode)
async function runPreDeployChecks() {
  try {
    exec("node scripts/pre-deploy-check.js --skip-build", { silent: false });
    logSuccess("All pre-deployment checks passed");
  } catch {
    logError("Pre-deployment checks failed!");
    const proceed = await prompt("\n⚠️  Continue anyway? (y/n): ");
    if (proceed.toLowerCase() !== "y") {
      log("\n❌ Push prep aborted. Fix issues and try again.", "red");
      process.exit(1);
    }
  }
}

function resolveBumpType(args) {
  if (args.forcePatch)
    return { bumpType: "patch", reason: "Forced patch bump" };
  if (args.forceMinor)
    return { bumpType: "minor", reason: "Forced minor bump" };
  if (args.forceMajor)
    return { bumpType: "major", reason: "Forced major bump" };
  const analysis = analyzeVersionBump();
  return { bumpType: analysis.type, reason: analysis.reason };
}

async function confirmVersionBump(proposedVersion, autoConfirm) {
  if (autoConfirm) return proposedVersion;

  const confirm = await prompt(
    `\n   Proceed with version ${proposedVersion}? (y/n): `,
  );
  if (confirm.toLowerCase() === "y") return proposedVersion;

  const customVersion = await prompt(
    "   Enter custom version (or press Enter to cancel): ",
  );
  if (customVersion && /^\d+\.\d+\.\d+$/.test(customVersion))
    return customVersion;
  if (customVersion) {
    logError("Invalid version format. Use X.Y.Z");
    process.exit(1);
  }
  log("\n❌ Push prep aborted.", "red");
  process.exit(1);
}

// Step 3: Version bump
async function bumpVersionStep(args, currentVersion) {
  const { bumpType, reason } = resolveBumpType(args);
  let newVersion = bumpVersion(currentVersion, bumpType);

  console.log(
    `\n   Current version: ${colors.yellow}${currentVersion}${colors.reset}`,
  );
  console.log(
    `   Bump type:       ${colors.cyan}${bumpType.toUpperCase()}${colors.reset}`,
  );
  console.log(`   Reason:          ${reason}`);
  console.log(
    `   New version:     ${colors.green}${newVersion}${colors.reset}`,
  );

  newVersion = await confirmVersionBump(newVersion, args.autoConfirm);

  // Update package.json
  exec(`npm version ${newVersion} --no-git-tag-version`, { silent: true });
  logSuccess(`Version bumped to ${newVersion}`);
  return newVersion;
}

// Step 5.5: Update VA Data Pipeline (BVA decisions, workload reports)
function runVaDataPipelineStep() {
  try {
    // Check if Python and dependencies are available
    const pythonPath = path.join(rootDir, ".venv", "Scripts", "python.exe");
    const pipelineScript = path.join(
      rootDir,
      "scripts",
      "scrapers",
      "va_data_pipeline.py",
    );

    if (fs.existsSync(pythonPath) && fs.existsSync(pipelineScript)) {
      // Run with --generate-frontend to update JS from existing data (fast)
      // Use --full-update for comprehensive scrape (slow, optional)
      exec(`"${pythonPath}" "${pipelineScript}" --generate-frontend`, {
        silent: false,
      });
      logSuccess("VA data pipeline updated");
    } else {
      logWarning(
        "VA data pipeline not available (missing Python venv or script)",
      );
      log("   Run: pip install -r scripts/scrapers/requirements.txt", "cyan");
    }
  } catch (error) {
    logWarning("VA data pipeline failed: " + error.message);
    logWarning("Continuing without VA data update...");
  }
}

// Step 5.6: Sync changelog with current version
function syncChangelogStep(newVersion) {
  try {
    // Read changelog.json and update version
    const changelogPath = path.join(rootDir, "src", "data", "changelog.json");
    const changelog = JSON.parse(fs.readFileSync(changelogPath, "utf8"));

    // Update version and lastUpdated
    changelog.version = newVersion;
    changelog.lastUpdated = new Date().toISOString().split("T")[0];

    // Check if there's already an entry for this version
    const hasEntry = changelog.updates?.some((u) => u.version === newVersion);
    if (!hasEntry && changelog.updates?.length > 0) {
      // Update the first entry's version if it doesn't match
      if (changelog.updates[0].version !== newVersion) {
        log(
          `   Updating first changelog entry from ${changelog.updates[0].version} to ${newVersion}`,
          "cyan",
        );
        changelog.updates[0].version = newVersion;
        changelog.updates[0].date = changelog.lastUpdated;
      }
    }

    fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2));
    logSuccess(`Changelog synced to v${newVersion}`);
  } catch (error) {
    logWarning("Could not auto-sync changelog: " + error.message);
    logWarning('Run "npm run update-changelog" manually if needed');
  }
}

function scanFileForCriticalPatterns(fullPath, criticalPatterns, violations) {
  const content = fs.readFileSync(fullPath, "utf8");
  const lines = content.split("\n");
  for (const cp of criticalPatterns) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
      if (line.includes(cp.pattern)) {
        violations.push({
          id: cp.id,
          name: cp.name,
          file: path.relative(rootDir, fullPath),
          line: i + 1,
        });
      }
    }
  }
}

function scanDirForCriticalPatterns(dir, criticalPatterns, violations) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      scanDirForCriticalPatterns(fullPath, criticalPatterns, violations);
    } else if (entry.isFile() && /\.(js|jsx)$/.test(entry.name)) {
      scanFileForCriticalPatterns(fullPath, criticalPatterns, violations);
    }
  }
}

// Contract Enforcement Gate (claude-toolkit) — hard-fail on critical violations before build
function contractEnforcementGate() {
  const criticalPatterns = [
    { id: "CTK-002", name: "eval() usage", pattern: "eval(" },
    { id: "CTK-005", name: "Hardcoded secrets", pattern: "-----BEGIN" },
    { id: "CTK-005", name: "Hardcoded API key", pattern: "sk-ant-" },
    { id: "SEC-007", name: "new Function()", pattern: "new Function(" },
  ];

  const srcDir = path.join(rootDir, "src");
  const criticalViolations = [];

  if (fs.existsSync(srcDir)) {
    scanDirForCriticalPatterns(srcDir, criticalPatterns, criticalViolations);
  }

  if (criticalViolations.length > 0) {
    logError(
      `Found ${criticalViolations.length} critical contract violation(s):`,
    );
    criticalViolations.forEach((v) => {
      log(`   [${v.id}] ${v.name} — ${v.file}:${v.line}`, "red");
    });
    logError("Build blocked. Fix critical violations before deploying.");
    process.exit(1);
  } else {
    logSuccess("No critical contract violations found");
  }
}

function productionBuildStep() {
  try {
    exec("npx vite build");
    logSuccess("Production build complete");
  } catch {
    logError("Build failed!");
    process.exit(1);
  }
}

// Summary & Git Commands
function printSummary(currentVersion, newVersion) {
  console.log("\n" + "═".repeat(65));
  log("        ✅ PUSH PREP COMPLETE", "green");
  console.log("═".repeat(65));

  // Show git status
  console.log("\n📋 Git Status:");
  exec("git status --short");

  // Count changes
  let changedFiles = 0;
  try {
    const status = exec("git status --porcelain", { silent: true });
    changedFiles = status?.split("\n").filter((l) => l.trim()).length || 0;
  } catch {}

  console.log(`\n   Changed files: ${changedFiles}`);
  console.log(`   New version:   ${colors.green}${newVersion}${colors.reset}`);

  // Git commands
  console.log("\n" + "─".repeat(65));
  log("📤 READY TO PUSH - Run these commands:", "cyan");
  console.log("─".repeat(65));

  const commitMsg =
    newVersion !== currentVersion
      ? `chore: release v${newVersion}`
      : `chore: update build`;

  console.log(`
${colors.yellow}# Stage all changes${colors.reset}
git add -A

${colors.yellow}# Commit with version${colors.reset}
git commit -m "${commitMsg}"

${colors.yellow}# Tag the release (optional but recommended)${colors.reset}
git tag v${newVersion}

${colors.yellow}# Push to GitHub${colors.reset}
git push origin main
git push origin v${newVersion}  ${colors.cyan}# Push the tag${colors.reset}
`);

  console.log("─".repeat(65));
  log("💡 Or copy this one-liner (PowerShell compatible):", "cyan");
  console.log("─".repeat(65));
  console.log(
    `\n${colors.green}git add -A; git commit -m "${commitMsg}"; git tag v${newVersion}; git push origin main; git push origin v${newVersion}${colors.reset}\n`,
  );

  console.log("═".repeat(65));
  log("        🎯 Vet-Rate.org is ready to ship!", "magenta");
  console.log("═".repeat(65));

  // Community acknowledgment
  console.log("\n" + "─".repeat(65));
  log("        💜 THANK YOU TO OUR COMMUNITY TESTERS", "magenta");
  console.log("─".repeat(65));
  console.log(`
   Reddit: ${colors.cyan}r/VAClaims${colors.reset} community`);
  console.log(
    `   Facebook: ${colors.cyan}Veteran Claims Assistance Group${colors.reset}`,
  );
  console.log(
    "\n   Your feedback makes Vet-Rate.org better for all veterans! 🇺🇸",
  );
  console.log("─".repeat(65) + "\n");
}

async function main() {
  const args = parseArgs();
  const totalSteps = args.noBump ? 9 : 10; // +1 for contract enforcement gate
  let currentStep = 0;

  console.log("\n" + "═".repeat(65));
  console.log(
    colors.bold +
      colors.magenta +
      "        🚀 PUSH PREP - Ready to Deploy" +
      colors.reset,
  );
  console.log(
    colors.bold +
      colors.magenta +
      "        Vet-Rate.org Deployment Pipeline" +
      colors.reset,
  );
  console.log("═".repeat(65));
  console.log(`\n📅 Date: ${new Date().toISOString().split("T")[0]}`);
  console.log(`📁 Project: ${rootDir}`);

  logStep(++currentStep, totalSteps, "Cleaning up Vite cache...");
  clearViteCache();

  if (!args.skipChecks) {
    logStep(++currentStep, totalSteps, "Running pre-deployment validation...");
    await runPreDeployChecks();
  } else {
    logStep(
      ++currentStep,
      totalSteps,
      "Skipping pre-deployment checks (--skip-checks)",
    );
  }

  const packageJson = JSON.parse(readFile("package.json"));
  const currentVersion = packageJson.version;
  let newVersion = currentVersion;

  if (!args.noBump) {
    logStep(++currentStep, totalSteps, "Determining version bump...");
    newVersion = await bumpVersionStep(args, currentVersion);
  } else {
    log(
      `\n   Keeping version: ${colors.yellow}${currentVersion}${colors.reset} (--no-bump)`,
    );
  }

  logStep(++currentStep, totalSteps, "Syncing version across all files...");
  exec("npm run sync-version");
  logSuccess("Version synced to all files");

  logStep(++currentStep, totalSteps, "Updating project stats...");
  exec("npm run update-stats");
  logSuccess("Project stats updated");

  logStep(++currentStep, totalSteps, "Running VA data pipeline update...");
  runVaDataPipelineStep();

  logStep(
    ++currentStep,
    totalSteps,
    "Syncing changelog with current version...",
  );
  syncChangelogStep(newVersion);

  logStep(++currentStep, totalSteps, "Checking legal pages...");
  exec("npm run check-legal-pages");
  logSuccess("Legal pages verified");

  logStep(++currentStep, totalSteps, "Contract enforcement gate...");
  contractEnforcementGate();

  logStep(++currentStep, totalSteps, "Creating production build...");
  productionBuildStep();

  printSummary(currentVersion, newVersion);
}

main().catch((error) => {
  logError(`Push prep failed: ${error.message}`);
  process.exit(1);
});
