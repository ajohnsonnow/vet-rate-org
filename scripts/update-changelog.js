#!/usr/bin/env node

/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * AUTOMATIC CHANGELOG UPDATER
 *
 * Generates changelog entries from git commits and version tags
 * Categorizes commits by type (feat, fix, docs, etc.)
 * Updates CHANGELOG.md and changelog.json automatically
 *
 * Usage:
 *   node scripts/update-changelog.js              # Generate changelog from recent commits
 *   node scripts/update-changelog.js --from v1.4.2 # Generate from specific version
 *   node scripts/update-changelog.js --preview    # Preview without writing
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const fromVersion = args.find((arg) => arg.startsWith("--from"))?.split("=")[1];
const isPreview = args.includes("--preview") || args.includes("--dry-run");

// Conventional commit types mapping
const COMMIT_TYPES = {
  feat: { label: "Added", type: "feature", emoji: "✨" },
  fix: { label: "Fixed", type: "fix", emoji: "🐛" },
  docs: { label: "Documentation", type: "documentation", emoji: "📚" },
  style: { label: "Style", type: "style", emoji: "💎" },
  refactor: { label: "Refactored", type: "refactor", emoji: "♻️" },
  perf: { label: "Performance", type: "improvement", emoji: "⚡" },
  test: { label: "Tests", type: "test", emoji: "✅" },
  build: { label: "Build", type: "build", emoji: "🔧" },
  ci: { label: "CI/CD", type: "ci", emoji: "👷" },
  chore: { label: "Chore", type: "chore", emoji: "🔨" },
  hotfix: { label: "Fixed", type: "fix", emoji: "🚨" },
  HOTFIX: { label: "Fixed", type: "fix", emoji: "🚨" },
};

// Category mapping based on file paths or keywords
const CATEGORY_PATTERNS = {
  "Local AI": /local.*ai|webgpu|faraday|mlc-ai/i,
  "AI Configuration": /ai.*settings?|ai.*modal/i,
  "DD214 Analyzer": /dd214|analyzer/i,
  "Evidence Building": /evidence|nexus|witness|symptom/i,
  Calculators: /calculator|rating|tactical/i,
  Discovery: /secondary|pact|mos|pathfinder/i,
  "Quality Control": /red.*team|stress.*test|consistency/i,
  Support: /faq|docs|guide|manual/i,
  Infrastructure: /build|deploy|stats|version/i,
  Security: /security|privacy|encrypt/i,
  "UI/UX": /modal|button|layout|theme|design/i,
};

/**
 * Get git commits since a specific version or date
 */
function getCommits(since = null) {
  try {
    // Default: commits since last version tag, not a fixed time window (avoids duplication)
    let sinceArg;
    if (since) {
      sinceArg = `--since="${since}"`;
    } else {
      try {
        const lastTag = execSync('git tag -l "v*" --sort=-version:refname', {
          encoding: "utf-8",
        })
          .trim()
          .split("\n")[0];
        sinceArg = lastTag ? `${lastTag}..HEAD` : '--since="7 days ago"';
      } catch {
        sinceArg = '--since="7 days ago"';
      }
    }
    const command = `git log ${sinceArg} --pretty=format:"%H|%s|%ad|%an" --date=short`;
    const output = execSync(command, { encoding: "utf-8" }); // nosemgrep: local.detect-child-process-strict,javascript.lang.security.detect-child-process.detect-child-process

    return output
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const [hash, message, date, author] = line.split("|");
        return { hash, message, date, author };
      });
  } catch (error) {
    console.error("Error getting git commits:", error.message);
    return [];
  }
}

/**
 * Parse commit message to extract type, scope, and description
 */
function parseCommit(message) {
  // Pattern: type(scope): description or type: description or HOTFIX: description
  const conventionalPattern =
    // eslint-disable-next-line sonarjs/slow-regex -- verified 0ms at 200k adversarial chars; operates on a single local git commit message line, always short
    /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|hotfix|HOTFIX)(?:\(([^)]+)\))?:\s*(.+)$/i;
  const match = message.match(conventionalPattern);

  if (match) {
    const [, type, scope, description] = match;
    return {
      type: type.toLowerCase(),
      scope: scope || null,
      description: description.trim(),
    };
  }

  // If not conventional format, try to extract from message
  if (message.match(/^HOTFIX/i)) {
    return {
      type: "hotfix",
      scope: null,
      description: message.replace(/^HOTFIX[:\s]*/i, "").trim(),
    };
  }

  return {
    type: "chore",
    scope: null,
    description: message,
  };
}

/**
 * Categorize commit based on description and scope
 */
function categorizeCommit(commit) {
  const text = `${commit.scope || ""} ${commit.description}`;

  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(text)) {
      return category;
    }
  }

  return "Other";
}

/**
 * Group commits by type and category
 */
function groupCommits(commits) {
  const grouped = {};

  commits.forEach((commit) => {
    const parsed = parseCommit(commit.message);
    const typeInfo = COMMIT_TYPES[parsed.type] || COMMIT_TYPES.chore;
    const category = categorizeCommit(parsed);

    const label = typeInfo.label;
    if (!grouped[label]) {
      grouped[label] = [];
    }

    grouped[label].push({
      ...commit,
      parsed,
      category,
      typeInfo,
      type: typeInfo.type,
    });
  });

  return grouped;
}

/**
 * Generate markdown changelog section
 */
function generateMarkdownChangelog(version, date, commits) {
  const grouped = groupCommits(commits);
  let markdown = `## [${version}] - ${date}\n\n`;

  // Order sections
  const sectionOrder = [
    "Added",
    "Changed",
    "Fixed",
    "Documentation",
    "Security",
    "Deprecated",
    "Removed",
  ];

  sectionOrder.forEach((section) => {
    if (grouped[section]) {
      markdown += `### ${section}\n\n`;
      grouped[section].forEach((commit) => {
        const { category, parsed, typeInfo } = commit;
        const prefix = category !== "Other" ? `**${category}**: ` : "";
        markdown += `- ${typeInfo.emoji} ${prefix}${parsed.description}\n`;
      });
      markdown += "\n";
    }
  });

  return markdown;
}

/**
 * Generate JSON changelog entries
 */
function generateJsonChangelog(version, date, commits) {
  const entries = commits.map((commit) => {
    const parsed = parseCommit(commit.message);
    const typeInfo = COMMIT_TYPES[parsed.type] || COMMIT_TYPES.chore;
    const category = categorizeCommit(commit);

    return {
      type: typeInfo.type,
      category,
      title: parsed.description.split(" - ")[0].trim(),
      description: parsed.description,
    };
  });

  return {
    version,
    date,
    isFirstRelease: false,
    releaseTitle: `Bug Fixes & Improvements - v${version}`,
    changelog: entries,
  };
}

/**
 * Read current package.json version
 */
function getCurrentVersion() {
  const packagePath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
  return packageJson.version;
}

/**
 * Update CHANGELOG.md file
 */
function updateMarkdownChangelog(version, date, newSection) {
  const changelogPath = path.join(__dirname, "..", "CHANGELOG.md");
  let content = fs.readFileSync(changelogPath, "utf-8");

  // Skip if this version already has an entry — prevents duplicate sections on repeated runs
  if (content.includes(`## [${version}]`)) {
    console.log(
      `ℹ️  CHANGELOG.md already has a [${version}] entry — skipping insert.`,
    );
    return;
  }

  // Insert after "## [Unreleased]"
  const unreleasedPattern = /## \[Unreleased\]\s*\n/;
  content = content.replace(
    unreleasedPattern,
    `## [Unreleased]\n\n${newSection}`,
  );

  fs.writeFileSync(changelogPath, content, "utf-8");
  console.log(`✅ Updated CHANGELOG.md with v${version}`);
}

/**
 * Update changelog.json file
 */
function updateJsonChangelog(newEntry) {
  const changelogPath = path.join(
    __dirname,
    "..",
    "src",
    "data",
    "changelog.json",
  );
  const changelog = JSON.parse(fs.readFileSync(changelogPath, "utf-8"));

  // Update version and lastUpdated
  changelog.version = newEntry.version;
  changelog.lastUpdated = newEntry.date;

  // Add new entry at the beginning
  changelog.updates.unshift(newEntry);

  // Keep only last 10 versions
  changelog.updates = changelog.updates.slice(0, 10);

  fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2), "utf-8");
  console.log(`✅ Updated changelog.json with v${newEntry.version}`);
}

/**
 * Main execution
 */
function main() {
  console.log("🔍 Analyzing git commits...\n");

  const version = getCurrentVersion();
  const date = new Date().toISOString().split("T")[0];
  const commits = getCommits(fromVersion);

  if (commits.length === 0) {
    console.log("ℹ️ No commits found to generate changelog from.");
    return;
  }

  console.log(`Found ${commits.length} commits for v${version}:\n`);
  commits.forEach((commit) => {
    console.log(`  - ${commit.message.substring(0, 70)}...`);
  });
  console.log("");

  // Generate changelog content
  const markdownSection = generateMarkdownChangelog(version, date, commits);
  const jsonEntry = generateJsonChangelog(version, date, commits);

  if (isPreview) {
    console.log("📋 PREVIEW MODE - No files will be modified\n");
    console.log("=== MARKDOWN CHANGELOG ===\n");
    console.log(markdownSection);
    console.log("\n=== JSON CHANGELOG ===\n");
    console.log(JSON.stringify(jsonEntry, null, 2));
  } else {
    // Update files
    updateMarkdownChangelog(version, date, markdownSection);
    updateJsonChangelog(jsonEntry);
    console.log("\n✅ Changelog updated successfully!");
    console.log(`\nVersion: ${version}`);
    console.log(`Commits: ${commits.length}`);
  }
}

// Run the script
main();
