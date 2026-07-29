#!/usr/bin/env node

/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * VERSION RELEASE SCRIPT
 *
 * Automates the complete release process:
 * 1. Bump version in package.json (patch/minor/major)
 * 2. Generate changelog from git commits
 * 3. Sync version across all files
 * 4. Update stats and legal pages
 * 5. Create git tag
 * 6. Commit changes
 * 7. Push to remote
 *
 * Usage:
 *   npm run release           # Patch version (1.4.2 -> 1.4.3)
 *   npm run release:minor     # Minor version (1.4.2 -> 1.5.0)
 *   npm run release:major     # Major version (1.4.2 -> 2.0.0)
 *   npm run release:preview   # Preview changes without committing
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const rawVersionType = args[0] || "patch";
// Sanitize: only allow known version types to prevent command injection
const ALLOWED_TYPES = ["patch", "minor", "major"];
const versionType = ALLOWED_TYPES.includes(rawVersionType)
  ? rawVersionType
  : "patch";
const isPreview = args.includes("--preview") || args.includes("--dry-run");
const skipPrompts = args.includes("-y") || args.includes("--yes");

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, silent = false) {
  // Validate command is from a known safe set (prevent injection via args)
  const allowedPrefixes = ["git ", "npm ", "node ", "npx "];
  if (!allowedPrefixes.some((prefix) => command.startsWith(prefix))) {
    log(`❌ Blocked untrusted command: ${command}`, "red");
    process.exit(1);
  }
  try {
    const output = execSync(command, { encoding: "utf-8" }); // nosemgrep: local.detect-child-process-strict,javascript.lang.security.detect-child-process.detect-child-process
    if (!silent) {
      console.log(output);
    }
    return output;
  } catch (error) {
    log(`❌ Command failed: ${command}`, "red");
    log(error.message, "red");
    process.exit(1);
  }
}

function getCurrentVersion() {
  const packagePath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
  return packageJson.version;
}

function getNextVersion(current, type) {
  const parts = current.split(".").map(Number);
  switch (type) {
    case "major":
      return `${parts[0] + 1}.0.0`;
    case "minor":
      return `${parts[0]}.${parts[1] + 1}.0`;
    case "patch":
    default:
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

function checkGitStatus() {
  const status = execCommand("git status --porcelain", true);
  if (status.trim()) {
    log("⚠️  Warning: You have uncommitted changes", "yellow");
    log(status, "yellow");
    return false;
  }
  return true;
}

async function promptUser(question) {
  if (skipPrompts) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

function runPreview(nextVersion) {
  log("📋 PREVIEW MODE - No changes will be made\n", "yellow");

  log("Would execute the following steps:", "bright");
  log("1. Bump version to " + nextVersion);
  log("2. Generate changelog from git commits");
  log("3. Sync version across files");
  log("4. Update project stats");
  log("5. Sync legal pages");
  log("6. Create git tag v" + nextVersion);
  log("7. Commit changes");
  log("8. Push to origin");
  log("");

  // Preview changelog
  log("📝 Generating changelog preview...", "cyan");
  execCommand("npm run changelog-preview");

  process.exit(0);
}

async function runReleaseSteps(nextVersion) {
  // Step 1: Bump version in package.json
  log("1️⃣ Bumping version...", "cyan");
  execCommand(`npm version ${versionType} --no-git-tag-version`);
  log(`✅ Version bumped to ${nextVersion}`, "green");

  // Step 2: Generate changelog
  log("\n2️⃣ Generating changelog...", "cyan");
  execCommand("npm run update-changelog");
  log("✅ Changelog generated", "green");

  // Step 3: Sync version across files
  log("\n3️⃣ Syncing version across files...", "cyan");
  execCommand("npm run sync-version");
  log("✅ Version synced", "green");

  // Step 4: Update project stats
  log("\n4️⃣ Updating project stats...", "cyan");
  execCommand("npm run update-stats");
  log("✅ Stats updated", "green");

  // Step 5: Sync legal pages
  log("\n5️⃣ Syncing legal pages...", "cyan");
  execCommand("npm run sync-legal-pages");
  log("✅ Legal pages synced", "green");

  // Step 6: Stage all changes
  log("\n6️⃣ Staging changes...", "cyan");
  execCommand("git add .");
  log("✅ Changes staged", "green");

  // Step 7: Commit changes
  log("\n7️⃣ Committing changes...", "cyan");
  const commitMessage = `chore: release v${nextVersion}

- Bump version to ${nextVersion}
- Update changelog from git commits
- Sync version across all files
- Update project stats and legal pages

[automated release]`;

  execCommand(`git commit -m "${commitMessage}"`);
  log("✅ Changes committed", "green");

  // Step 8: Create git tag
  log("\n8️⃣ Creating git tag...", "cyan");
  execCommand(`git tag -a v${nextVersion} -m "Release v${nextVersion}"`);
  log(`✅ Tag v${nextVersion} created`, "green");

  // Step 9: Push to remote
  log("\n9️⃣ Pushing to remote...", "cyan");
  const pushRemote = await promptUser("Push to remote repository?");
  if (pushRemote) {
    execCommand("git push origin main");
    execCommand("git push origin --tags");
    log("✅ Pushed to remote", "green");
  } else {
    log(
      "⏭️  Skipped push (run manually: git push origin main && git push origin --tags)",
      "yellow",
    );
  }
}

async function main() {
  log("\n🚀 Vet-Rate.org Release Process\n", "bright");

  // Validate version type
  if (!["patch", "minor", "major"].includes(versionType)) {
    log(`❌ Invalid version type: ${versionType}`, "red");
    log("Valid types: patch, minor, major", "yellow");
    process.exit(1);
  }

  const currentVersion = getCurrentVersion();
  const nextVersion = getNextVersion(currentVersion, versionType);

  log(`📦 Current version: ${currentVersion}`, "cyan");
  log(`📦 Next version: ${nextVersion} (${versionType})`, "green");
  log("");

  // Check git status
  const isClean = checkGitStatus();
  if (!isClean && !isPreview) {
    const proceed = await promptUser("Continue with uncommitted changes?");
    if (!proceed) {
      log("❌ Aborted", "red");
      process.exit(0);
    }
  }

  if (isPreview) {
    runPreview(nextVersion);
    return;
  }

  // Confirm release
  log("This will:", "bright");
  log(`  • Bump version from ${currentVersion} to ${nextVersion}`);
  log("  • Generate changelog from recent commits");
  log("  • Update all version references");
  log("  • Create git tag and commit");
  log("  • Push to remote repository");
  log("");

  const confirmed = await promptUser("Proceed with release?");
  if (!confirmed) {
    log("❌ Aborted", "red");
    process.exit(0);
  }

  log("\n🔧 Starting release process...\n", "bright");

  await runReleaseSteps(nextVersion);

  // Done!
  log("\n🎉 Release complete!", "bright");
  log(`\nVersion ${nextVersion} is ready!`, "green");
  log("\nNext steps:", "bright");
  log("  • Build production: npm run build");
  log("  • Deploy to hosting platform");
  log("  • Verify deployment");
  log("  • Announce release");
  log("");
}

// Run the script
main().catch((error) => {
  log(`\n❌ Release failed: ${error.message}`, "red");
  process.exit(1);
});
