/**
 * Smart Version Bump Script
 *
 * Automatically determines the correct version bump (major, minor, patch)
 * based on git commits and file changes since the last version tag.
 *
 * Follows Semantic Versioning (SemVer) and Conventional Commits:
 * - MAJOR: Breaking changes, data structure changes, removed features
 * - MINOR: New features, new components, new tools, enhancements
 * - PATCH: Bug fixes, documentation, refactoring, small tweaks
 *
 * Usage:
 *   node scripts/smart-version.js           # Auto-detect and bump
 *   node scripts/smart-version.js --dry-run # Preview without changing
 *   node scripts/smart-version.js --force patch|minor|major # Override
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Keywords that indicate MAJOR version bump (breaking changes)
  majorKeywords: [
    "BREAKING CHANGE",
    "BREAKING:",
    "breaking:",
    "!:", // Conventional commits breaking indicator
    "removed",
    "deleted feature",
    "data migration required",
    "schema change",
    "api change",
    "incompatible",
  ],

  // Keywords that indicate MINOR version bump (new features)
  minorKeywords: [
    "feat:",
    "feat(",
    "feature:",
    "feature(",
    "add:",
    "added:",
    "new:",
    "implement:",
    "enhancement:",
    "enhance:",
  ],

  // Keywords that indicate PATCH version bump (bug fixes, small changes)
  patchKeywords: [
    "fix:",
    "fix(",
    "bugfix:",
    "hotfix:",
    "patch:",
    "docs:",
    "style:",
    "refactor:",
    "perf:",
    "test:",
    "chore:",
    "typo",
    "cleanup",
    "update readme",
    "update docs",
  ],

  // File patterns that indicate feature additions (MINOR)
  featureFilePatterns: [
    /src\/components\/[A-Z][^/]+\.jsx$/, // New component files
    /src\/utils\/[a-z][^/]+\.js$/, // New utility files
    /src\/hooks\/[a-z][^/]+\.js$/, // New hooks
    /src\/data\/[a-z][^/]+\.(js|json)$/, // New data files
  ],

  // File patterns that indicate breaking changes (MAJOR)
  breakingFilePatterns: [
    /src\/data\/.*schema/i, // Schema changes
    /migrations?\//, // Migration files
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Git Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function execGit(command) {
  try {
    return execSync(`git ${command}`, {
      // nosemgrep: local.detect-child-process-strict
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (_err) {
    // Command failed (e.g. no matching tags yet) - treat as no result
    return "";
  }
}

function getLastVersionTag() {
  // Get the most recent version tag
  const tags = execGit('tag -l "v*" --sort=-version:refname');
  if (!tags) return null;
  return tags.split("\n")[0];
}

function getCommitsSinceTag(tag) {
  if (!tag) {
    // No tags, get all commits
    return execGit("log --oneline --no-decorate");
  }
  return execGit(`log ${tag}..HEAD --oneline --no-decorate`);
}

function getChangedFilesSinceTag(tag) {
  if (!tag) {
    // No tags, get all tracked files
    return execGit("ls-files");
  }
  return execGit(`diff --name-only ${tag}..HEAD`);
}

function getStagedFiles() {
  return execGit("diff --cached --name-only");
}

function getUnstagedChanges() {
  return execGit("diff --name-only");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Analysis Functions
// ═══════════════════════════════════════════════════════════════════════════════

function analyzeCommits(commits) {
  const lines = commits.split("\n").filter((line) => line.trim());

  const analysis = {
    major: [],
    minor: [],
    patch: [],
    unknown: [],
  };

  for (const line of lines) {
    const message = line.toLowerCase();

    // Check for MAJOR indicators
    if (CONFIG.majorKeywords.some((kw) => message.includes(kw.toLowerCase()))) {
      analysis.major.push(line);
      continue;
    }

    // Check for MINOR indicators
    if (CONFIG.minorKeywords.some((kw) => message.includes(kw.toLowerCase()))) {
      analysis.minor.push(line);
      continue;
    }

    // Check for PATCH indicators
    if (CONFIG.patchKeywords.some((kw) => message.includes(kw.toLowerCase()))) {
      analysis.patch.push(line);
      continue;
    }

    // Unknown - will default to patch
    analysis.unknown.push(line);
  }

  return analysis;
}

function analyzeFiles(files) {
  const lines = files.split("\n").filter((line) => line.trim());

  const analysis = {
    newComponents: [],
    newUtils: [],
    newHooks: [],
    schemaChanges: [],
    other: [],
  };

  for (const file of lines) {
    // Check for new components
    if (/src\/components\/[A-Z][^/]+\.jsx$/.test(file)) {
      analysis.newComponents.push(file);
      continue;
    }

    // Check for new utilities
    if (/src\/utils\/[a-z][^/]+\.js$/.test(file)) {
      analysis.newUtils.push(file);
      continue;
    }

    // Check for new hooks
    if (/src\/hooks\/[a-z][^/]+\.js$/.test(file)) {
      analysis.newHooks.push(file);
      continue;
    }

    // Check for schema/data structure changes
    if (/schema|migration/i.test(file)) {
      analysis.schemaChanges.push(file);
      continue;
    }

    analysis.other.push(file);
  }

  return analysis;
}

function determineVersionBump(commitAnalysis, fileAnalysis) {
  // Priority: MAJOR > MINOR > PATCH

  // MAJOR: Breaking changes detected
  if (
    commitAnalysis.major.length > 0 ||
    fileAnalysis.schemaChanges.length > 0
  ) {
    return {
      type: "major",
      reason: "Breaking changes detected",
      evidence: [
        ...commitAnalysis.major.map((c) => `Commit: ${c}`),
        ...fileAnalysis.schemaChanges.map((f) => `Schema change: ${f}`),
      ],
    };
  }

  // MINOR: New features detected
  const hasNewFeatures =
    commitAnalysis.minor.length > 0 ||
    fileAnalysis.newComponents.length > 0 ||
    fileAnalysis.newUtils.length > 0 ||
    fileAnalysis.newHooks.length > 0;

  if (hasNewFeatures) {
    return {
      type: "minor",
      reason: "New features or components detected",
      evidence: [
        ...commitAnalysis.minor.map((c) => `Commit: ${c}`),
        ...fileAnalysis.newComponents.map((f) => `New component: ${f}`),
        ...fileAnalysis.newUtils.map((f) => `New utility: ${f}`),
        ...fileAnalysis.newHooks.map((f) => `New hook: ${f}`),
      ],
    };
  }

  // PATCH: Bug fixes, docs, refactoring, or unknown commits
  const hasPatchChanges =
    commitAnalysis.patch.length > 0 || commitAnalysis.unknown.length > 0;

  if (hasPatchChanges) {
    return {
      type: "patch",
      reason: "Bug fixes, documentation, or minor improvements",
      evidence: [
        ...commitAnalysis.patch.map((c) => `Commit: ${c}`),
        ...(commitAnalysis.unknown.length > 0
          ? [`${commitAnalysis.unknown.length} other commits`]
          : []),
      ],
    };
  }

  // Default to patch if nothing detected
  return {
    type: "patch",
    reason: "Default to patch (no specific indicators found)",
    evidence: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Version Bumping
// ═══════════════════════════════════════════════════════════════════════════════

function getCurrentVersion() {
  const packageJsonPath = path.join(rootDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  return packageJson.version;
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

function applyVersionBump(newVersion, dryRun = false) {
  if (dryRun) {
    console.log(`\n🔍 DRY RUN - Would update to version ${newVersion}`);
    return;
  }

  // Use npm version to update package.json and create git tag
  try {
    execSync(`npm version ${newVersion} --no-git-tag-version`, {
      // nosemgrep: local.detect-child-process-strict
      cwd: rootDir,
      stdio: "inherit",
    });
    console.log(`\n✅ Version updated to ${newVersion}`);
    console.log("\n📋 Next steps:");
    console.log("   1. Review changes: git diff package.json");
    console.log("   2. Run build: npm run build");
    console.log(
      '   3. Commit: git add -A && git commit -m "chore: bump version to ' +
        newVersion +
        '"',
    );
    console.log("   4. Tag: git tag v" + newVersion);
  } catch (err) {
    console.error("❌ Failed to update version:", err.message);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Script
// ═══════════════════════════════════════════════════════════════════════════════

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const forceIndex = args.indexOf("--force");
  const forceType = forceIndex !== -1 ? args[forceIndex + 1] : null;

  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("        Smart Version Bump - Semantic Versioning Analysis");
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );

  // Get current version
  const currentVersion = getCurrentVersion();
  console.log(`\n📦 Current version: ${currentVersion}`);

  // Get last version tag
  const lastTag = getLastVersionTag();
  console.log(`🏷️  Last version tag: ${lastTag || "(none)"}`);

  // If force flag is used, skip analysis
  if (forceType && ["major", "minor", "patch"].includes(forceType)) {
    console.log(`\n⚡ Force mode: ${forceType}`);
    const newVersion = bumpVersion(currentVersion, forceType);
    applyVersionBump(newVersion, dryRun);
    return;
  }

  // Analyze commits
  console.log("\n📝 Analyzing commits...");
  const commits = getCommitsSinceTag(lastTag);
  const commitAnalysis = analyzeCommits(commits);

  console.log(`   • Major indicators: ${commitAnalysis.major.length}`);
  console.log(`   • Minor indicators: ${commitAnalysis.minor.length}`);
  console.log(`   • Patch indicators: ${commitAnalysis.patch.length}`);
  console.log(`   • Unclassified: ${commitAnalysis.unknown.length}`);

  // Analyze changed files
  console.log("\n📁 Analyzing changed files...");
  const changedFiles = getChangedFilesSinceTag(lastTag);
  const fileAnalysis = analyzeFiles(changedFiles);

  console.log(`   • New components: ${fileAnalysis.newComponents.length}`);
  console.log(`   • New utilities: ${fileAnalysis.newUtils.length}`);
  console.log(`   • New hooks: ${fileAnalysis.newHooks.length}`);
  console.log(`   • Schema changes: ${fileAnalysis.schemaChanges.length}`);

  // Also check staged/unstaged changes
  const staged = getStagedFiles();
  const unstaged = getUnstagedChanges();
  if (staged || unstaged) {
    console.log("\n⚠️  Uncommitted changes detected:");
    if (staged)
      console.log(
        `   • Staged: ${staged.split("\n").filter((f) => f).length} files`,
      );
    if (unstaged)
      console.log(
        `   • Unstaged: ${unstaged.split("\n").filter((f) => f).length} files`,
      );
  }

  // Determine version bump
  const recommendation = determineVersionBump(commitAnalysis, fileAnalysis);

  console.log("\n" + "─".repeat(65));
  console.log(
    `\n🎯 RECOMMENDATION: ${recommendation.type.toUpperCase()} version bump`,
  );
  console.log(`   Reason: ${recommendation.reason}`);

  if (recommendation.evidence.length > 0) {
    console.log("\n   Evidence:");
    recommendation.evidence
      .slice(0, 5)
      .forEach((e) => console.log(`   • ${e}`));
    if (recommendation.evidence.length > 5) {
      console.log(`   • ... and ${recommendation.evidence.length - 5} more`);
    }
  }

  const newVersion = bumpVersion(currentVersion, recommendation.type);
  console.log(`\n📦 ${currentVersion} → ${newVersion}`);

  // Apply the version bump
  applyVersionBump(newVersion, dryRun);

  console.log(
    "\n═══════════════════════════════════════════════════════════════",
  );
}

main();
