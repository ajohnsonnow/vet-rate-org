/**
 * 🛫 Pre-Flight Check — Unified Push Pipeline
 *
 * Does everything needed before pushing to GitHub:
 *   Phase 1 — FIX:      auto-fix lint, format, clear cache
 *   Phase 2 — PREPARE:  version bump, sync version, update stats,
 *                        sync changelog, legal pages, VA data pipeline
 *   Phase 3 — VALIDATE: lint, unit tests+coverage, E2E, build,
 *                        security, contracts, a11y, docs
 *   Phase 4 — SHIP:     git commit, tag, push (or show commands)
 *
 * Usage:
 *   npm run preflight                   # Full run (interactive version bump)
 *   npm run preflight -- --patch        # Force patch bump
 *   npm run preflight -- --minor        # Force minor bump
 *   npm run preflight -- --major        # Force major bump
 *   npm run preflight -- --no-bump      # Skip version bump
 *   npm run preflight -- --push         # Auto-push after all checks pass
 *   npm run preflight -- --skip-e2e     # Skip Playwright E2E
 *   npm run preflight -- --skip-build   # Skip production build
 *   npm run preflight -- --fast         # --skip-e2e + --skip-build + --no-bump
 *   npm run preflight -- --yes -y       # Non-interactive (no prompts)
 *   npm run preflight -- --report       # Write preflight-report.json
 *   npm run preflight -- --verbose      # Show subprocess output
 *
 * Exit codes: 0 = all good, 1 = something failed
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ─────────────────────────────────────────────────────────────────────────────
// Args
// ─────────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const FLAG = (f) => argv.includes(f);

const FAST = FLAG("--fast");
const SKIP_E2E = FAST || FLAG("--skip-e2e");
const SKIP_BUILD = FAST || FLAG("--skip-build");
const NO_BUMP = FAST || FLAG("--no-bump");
const AUTO_YES = FLAG("--yes") || FLAG("-y");
const AUTO_PUSH = FLAG("--push");
const REPORT = FLAG("--report");
const VERBOSE = FLAG("--verbose");

const FORCE_PATCH = FLAG("--patch");
const FORCE_MINOR = FLAG("--minor");
const FORCE_MAJOR = FLAG("--major");

// ─────────────────────────────────────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};
const c = (color, msg) => `${C[color]}${msg}${C.reset}`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
  return execSync(cmd, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: VERBOSE || opts.inherit ? "inherit" : "pipe",
    ...opts,
  });
}

function tryRun(cmd, opts = {}) {
  try {
    return { ok: true, out: run(cmd, { ...opts, stdio: "pipe" }) };
  } catch (e) {
    return { ok: false, out: e.stdout || "", err: e.stderr || e.message };
  }
}

function readJSON(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

function writeJSON(rel, data) {
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(data, null, 2));
}

async function ask(question) {
  if (AUTO_YES) return true;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (ans) => {
      rl.close();
      resolve(ans.toLowerCase() === "y");
    });
  });
}

async function askString(question) {
  if (AUTO_YES) return "";
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${question}: `, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Version helpers
// ─────────────────────────────────────────────────────────────────────────────

function analyzeVersionBump() {
  const majorKw = [
    "BREAKING CHANGE",
    "BREAKING:",
    "!:",
    "removed",
    "schema change",
  ];
  const minorKw = ["feat:", "feat(", "feature:", "add:", "new:", "implement:"];
  let commits = "";
  try {
    const lastTag = tryRun('git tag -l "v*" --sort=-version:refname').out.split(
      "\n",
    )[0];
    commits = lastTag
      ? tryRun(`git log ${lastTag}..HEAD --oneline`).out || ""
      : tryRun("git log --oneline -50").out || "";
  } catch {}
  const lines = commits.toLowerCase().split("\n").filter(Boolean);
  if (lines.some((l) => majorKw.some((k) => l.includes(k.toLowerCase()))))
    return { type: "major", reason: "Breaking changes detected" };
  if (lines.some((l) => minorKw.some((k) => l.includes(k.toLowerCase()))))
    return { type: "minor", reason: "New features detected" };
  return { type: "patch", reason: "Bug fixes and improvements" };
}

function bumpVersion(ver, type) {
  const [M, m, p] = ver.split(".").map(Number);
  if (type === "major") return `${M + 1}.0.0`;
  if (type === "minor") return `${M}.${m + 1}.0`;
  return `${M}.${m}.${p + 1}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — FIX
// ─────────────────────────────────────────────────────────────────────────────

async function phaseFix() {
  console.log(`\n${c("bold", c("cyan", "━━━ Phase 1: Fix & Clean ━━━"))}`);

  // Clear Vite cache
  const viteCache = path.join(ROOT, "node_modules", ".vite");
  if (fs.existsSync(viteCache)) {
    fs.rmSync(viteCache, { recursive: true, force: true });
    console.log(c("green", "✅ Vite cache cleared"));
  }

  // ESLint --fix
  process.stdout.write("  🔧 ESLint --fix... ");
  const lintFix = tryRun("npx eslint src --fix");
  console.log(
    lintFix.ok ? c("green", "done") : c("yellow", "done (some issues remain)"),
  );
  if (!lintFix.ok && VERBOSE) console.log(c("dim", lintFix.err));

  // Prettier
  process.stdout.write("  🎨 Prettier format... ");
  const fmt = tryRun(
    'npx prettier --write "src/**/*.{js,jsx,css,json}" --log-level warn',
  );
  console.log(fmt.ok ? c("green", "done") : c("yellow", "done (warnings)"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — PREPARE
// ─────────────────────────────────────────────────────────────────────────────

function resolveBumpType() {
  if (FORCE_MAJOR) return { type: "major", reason: "Forced major bump" };
  if (FORCE_MINOR) return { type: "minor", reason: "Forced minor bump" };
  if (FORCE_PATCH) return { type: "patch", reason: "Forced patch bump" };
  return analyzeVersionBump();
}

async function confirmVersionBump(proposedVersion) {
  if (AUTO_YES) return proposedVersion;

  const ok = await ask(`\n  Proceed with v${proposedVersion}?`);
  if (ok) return proposedVersion;

  const custom = await askString(
    "  Enter custom version (X.Y.Z) or leave blank to abort",
  );
  if (custom && /^\d+\.\d+\.\d+$/.test(custom)) return custom;

  console.log(c("red", "\n❌ Aborted."));
  process.exit(1);
}

async function bumpVersionStep(currentVersion) {
  const { type: bumpType, reason } = resolveBumpType();
  let newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`\n  ${c("dim", "Current:")} ${c("yellow", currentVersion)}`);
  console.log(
    `  ${c("dim", "Bump:")}    ${c("cyan", bumpType.toUpperCase())} — ${reason}`,
  );
  console.log(`  ${c("dim", "New:")}     ${c("green", newVersion)}`);

  newVersion = await confirmVersionBump(newVersion);

  run(`npm version ${newVersion} --no-git-tag-version`, { stdio: "pipe" });
  console.log(c("green", `✅ Version bumped → v${newVersion}`));
  return newVersion;
}

function syncChangelogVersion(newVersion) {
  const changelogPath = path.join(ROOT, "src", "data", "changelog.json");
  if (!fs.existsSync(changelogPath)) return;
  try {
    const cl = readJSON("src/data/changelog.json");
    cl.version = newVersion;
    cl.lastUpdated = new Date().toISOString().split("T")[0];
    if (cl.updates?.length && cl.updates[0].version !== newVersion) {
      cl.updates[0].version = newVersion;
      cl.updates[0].date = cl.lastUpdated;
    }
    writeJSON("src/data/changelog.json", cl);
    console.log(c("green", `✅ Changelog synced → v${newVersion}`));
  } catch (e) {
    console.log(c("yellow", `⚠️  Changelog sync warning: ${e.message}`));
  }
}

function runOptionalNpmStep(scriptName, label, okWord = "done") {
  if (!scriptExists(scriptName)) return;
  process.stdout.write(`  ${label}... `);
  const r = tryRun(`npm run ${scriptName}`);
  console.log(r.ok ? c("green", okWord) : c("yellow", "warnings"));
}

function runVaDataPipeline() {
  const pythonExe = path.join(ROOT, ".venv", "Scripts", "python.exe");
  const pipelineScript = path.join(
    ROOT,
    "scripts",
    "scrapers",
    "va_data_pipeline.py",
  );
  if (!fs.existsSync(pythonExe) || !fs.existsSync(pipelineScript)) return;
  process.stdout.write("  🏛️  VA data pipeline... ");
  const r = tryRun(`"${pythonExe}" "${pipelineScript}" --generate-frontend`);
  console.log(r.ok ? c("green", "done") : c("yellow", "skipped (error)"));
}

async function phasePrep() {
  console.log(`\n${c("bold", c("cyan", "━━━ Phase 2: Prepare Release ━━━"))}`);

  const pkg = readJSON("package.json");
  const currentVersion = pkg.version;
  let newVersion = currentVersion;

  if (!NO_BUMP) {
    newVersion = await bumpVersionStep(currentVersion);
  } else {
    console.log(
      c("dim", `  Version bump skipped — keeping v${currentVersion}`),
    );
  }

  runOptionalNpmStep("sync-version", "🔄 Syncing version");
  runOptionalNpmStep("update-stats", "📊 Updating stats");
  syncChangelogVersion(newVersion);
  runOptionalNpmStep("check-legal-pages", "⚖️  Legal pages", "ok");
  runVaDataPipeline();

  return newVersion;
}

function scriptExists(name) {
  const pkg = readJSON("package.json");
  return !!pkg?.scripts?.[name];
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — VALIDATE
// ─────────────────────────────────────────────────────────────────────────────

async function check(results, label, fn, skip = false) {
  if (skip) {
    results.push({ label, skipped: true });
    console.log(`  ${c("dim", "⏭  " + label + " (skipped)")}`);
    return;
  }
  process.stdout.write(`  ⏳ ${label}...`);
  const start = Date.now();
  try {
    const result = await fn();
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    const note = result?.note ? c("dim", "  " + result.note) : "";
    console.log(
      `\r  ${c("green", "✅")} ${label.padEnd(42)} ${c("dim", dur + "s")}${note}`,
    );
    results.push({ label, ok: true, duration: dur, note: result?.note });
  } catch (e) {
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `\r  ${c("red", "❌")} ${label.padEnd(42)} ${c("dim", dur + "s")}`,
    );
    if (VERBOSE) console.log(c("red", "     " + e.message));
    results.push({ label, ok: false, duration: dur, error: e.message });
  }
}

function checkEslint() {
  const r = tryRun("npx eslint src");
  if (!r.ok) throw new Error("Lint errors found");
  return {};
}

function checkUnitTests() {
  run("npm run test:coverage", { stdio: VERBOSE ? "inherit" : "pipe" });
  return {};
}

async function checkE2E() {
  run("npx playwright test --project=chromium", {
    stdio: VERBOSE ? "inherit" : "pipe",
  });
  return {};
}

function checkProductionBuild() {
  run("npx vite build", { stdio: VERBOSE ? "inherit" : "pipe" });
  return {};
}

function checkSecurityScan() {
  const critical = [];
  const warnings = [];
  const critPatterns = [
    { id: "CTK-002", name: "eval()", pattern: "eval(" },
    { id: "CTK-005", name: "Hardcoded cert", pattern: "-----BEGIN" },
    { id: "CTK-005", name: "Hardcoded key", pattern: "sk-ant-" },
    { id: "SEC-007", name: "new Function()", pattern: "new Function(" },
  ];
  const warnPatterns = [
    {
      id: "SEC-004",
      name: "XSS (dangerouslySetInnerHTML)",
      pattern: "dangerouslySetInnerHTML",
    },
  ];
  const srcDir = path.join(ROOT, "src");
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        scan(fp);
        continue;
      }
      if (!entry.isFile() || !/\.(js|jsx)$/.test(entry.name)) continue;
      if (/\.(test|spec)\.|preflight/.test(entry.name)) continue;
      const lines = fs.readFileSync(fp, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*(\/\/|\*)/.test(line)) continue;
        const rel = path.relative(ROOT, fp).replace(/\\/g, "/");
        critPatterns.forEach((p) => {
          if (line.includes(p.pattern))
            critical.push(`[${p.id}] ${p.name} — ${rel}:${i + 1}`);
        });
        warnPatterns.forEach((p) => {
          if (line.includes(p.pattern))
            warnings.push(`[${p.id}] WARN ${p.name} — ${rel}:${i + 1}`);
        });
      }
    }
  }
  if (fs.existsSync(srcDir)) scan(srcDir);
  warnings.forEach((w) => console.log(`\n     ${c("yellow", w)}`));
  if (critical.length > 0) {
    critical.forEach((v) => console.log(`\n     ${c("red", v)}`));
    throw new Error(`${critical.length} critical security violation(s)`);
  }
  return { note: `0 critical, ${warnings.length} warning(s)` };
}

// Secret scan (gitleaks). Catches committed API keys, tokens, private
// keys, etc. across the whole git history. Config: .gitleaks.toml.
// Gracefully skips when gitleaks isn't installed locally.
function checkSecretScan() {
  const probe = tryRun("gitleaks version");
  if (!probe.ok) {
    return {
      note: "gitleaks not installed — `go install github.com/gitleaks/gitleaks/v8@latest` or download from github.com/gitleaks/gitleaks",
    };
  }
  const reportPath = path.join(ROOT, ".gitleaks-preflight-report.json");
  const r = tryRun(
    `gitleaks detect --no-banner --redact --config .gitleaks.toml --report-format json --report-path "${reportPath}"`,
  );
  let findings = 0;
  if (fs.existsSync(reportPath)) {
    try {
      findings = JSON.parse(fs.readFileSync(reportPath, "utf8")).length;
    } catch {}
    fs.unlinkSync(reportPath);
  }
  if (findings > 0) {
    throw new Error(`${findings} secret(s) detected — see gitleaks output`);
  }
  if (!r.ok && !/no leaks found/i.test(r.out)) {
    // gitleaks exits 1 on findings, 0 otherwise. A non-zero exit with no
    // parsed findings means a scan-level failure (e.g., corrupt repo state).
    throw new Error("gitleaks scan failed — see verbose output");
  }
  return { note: "0 secrets" };
}

// SAST (semgrep). Pulls 5 registry rule packs + project-local custom
// rules. Skips when semgrep isn't installed. Driver: scripts/sast-check.mjs.
//
// Findings are informational during Sprint 1–2: ~44 pre-existing baseline
// hits are tracked in docs/AUDIT_FINDINGS.md and closed in Sprint 3. After
// S3 lands, flip STRICT_SAST=true in CI to make this block again.
function checkSast() {
  const STRICT_SAST = process.env.STRICT_SAST === "true";
  const r = tryRun("node scripts/sast-check.mjs");
  if (/not installed/i.test(r.out)) {
    return {
      note: "semgrep not installed — `pip install semgrep`",
    };
  }
  // eslint-disable-next-line sonarjs/slow-regex -- trusted local semgrep CLI output, never attacker-controlled length
  const blockerMatch = /FAILED \((\d+) blocking finding/.exec(r.out);
  // eslint-disable-next-line sonarjs/slow-regex -- trusted local semgrep CLI output, never attacker-controlled length
  const findingMatch = /(\d+) finding/.exec(r.out);
  if (!r.ok && STRICT_SAST) {
    throw new Error(
      blockerMatch
        ? `${blockerMatch[1]} blocking SAST finding(s) — see audit output`
        : "semgrep scan failed",
    );
  }
  if (blockerMatch) {
    return {
      note: `${blockerMatch[1]} pre-existing finding(s) — tracked in AUDIT_FINDINGS.md, fix in S3`,
    };
  }
  return {
    note: findingMatch ? `${findingMatch[1]} info finding(s)` : "0 findings",
  };
}

// Bundle budget (Sprint 5). Non-blocking until App.jsx feature-region
// split (S4.5) brings the initial chunk under 300 KB gz. Flip
// STRICT_BUNDLE=true in CI after that lands.
function checkBundleBudget() {
  const distExists = fs.existsSync(path.join(ROOT, "dist"));
  if (!distExists) {
    return { note: "dist/ missing — skipped (run after build)" };
  }
  const r = tryRun("node scripts/check-bundle-budget.mjs");
  // eslint-disable-next-line sonarjs/slow-regex -- trusted local budget-check CLI output, never attacker-controlled length
  const breachMatch = /(\d+) budget breach/.exec(r.out);
  if (breachMatch && breachMatch[1] !== "0") {
    return {
      note: `${breachMatch[1]} pre-existing breach(es) — tracked, fix in S4.5/S5`,
    };
  }
  return { note: "all budgets met" };
}

// Contract enforcement (blocking as of S8)
//
// S8 closed the protobufjs/xmldom advisories via npm `overrides`. This step
// is now blocking on high+ production advisories. Opt-out via
// STRICT_AUDIT=false only when diagnosing a newly-published CVE that the
// dependency tree hasn't caught up to yet.
function checkContractEnforcement() {
  const STRICT_AUDIT = process.env.STRICT_AUDIT !== "false";
  const audit = tryRun("npm audit --omit=dev --audit-level=high");
  if (!audit.ok) {
    // eslint-disable-next-line sonarjs/slow-regex -- trusted local npm-audit CLI output, never attacker-controlled length
    const critMatch = /(\d+) critical/.exec(audit.out);
    // eslint-disable-next-line sonarjs/slow-regex -- trusted local npm-audit CLI output, never attacker-controlled length
    const highMatch = /(\d+) high/.exec(audit.out);
    const summary = `${critMatch?.[1] ?? "0"} critical, ${highMatch?.[1] ?? "0"} high`;
    if (STRICT_AUDIT) {
      throw new Error(`npm audit (prod): ${summary}`);
    }
    return { note: `non-strict mode: ${summary}` };
  }
  return { note: "0 high+ in production deps" };
}

function checkAccessibility() {
  const compDir = path.join(ROOT, "src", "components");
  if (!fs.existsSync(compDir)) return { note: "no components dir" };
  let total = 0,
    covered = 0;
  function scanA11y(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanA11y(fp);
        continue;
      }
      if (!/\.jsx?$/.test(entry.name) || /\.(test|spec)\./.test(entry.name))
        continue;
      total++;
      const src = fs.readFileSync(fp, "utf8");
      if (
        /aria-|role=|<(button|input|label|nav|main|header|footer|section|article|aside|h[1-6])/i.test(
          src,
        )
      )
        covered++;
    }
  }
  scanA11y(compDir);
  const pct = total ? Math.round((covered / total) * 100) : 0;
  return { note: `${covered}/${total} components (${pct}%)` };
}

function checkVersionConsistency() {
  const pkg = readJSON("package.json");
  const ver = pkg.version;
  const checks = [
    ["public/version.json", (d) => d.version === ver],
    ["src/data/changelog.json", (d) => d.version === ver],
  ];
  for (const [rel, test] of checks) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      if (!test(data)) throw new Error(`Version mismatch in ${rel}`);
    }
  }
  return { note: `v${ver}` };
}

function checkDocumentation() {
  const required = ["README.md", "SECURITY.md", "CONTRIBUTING.md"];
  const missing = required.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (missing.length) throw new Error(`Missing: ${missing.join(", ")}`);
  return { note: required.join(" + ") + " ✓" };
}

async function phaseValidate() {
  console.log(`\n${c("bold", c("cyan", "━━━ Phase 3: Validate ━━━"))}`);

  const results = [];

  await check(results, "ESLint", checkEslint);
  await check(results, "Unit tests + coverage", checkUnitTests);
  await check(results, "E2E (Playwright — chromium)", checkE2E, SKIP_E2E);
  await check(results, "Production build", checkProductionBuild, SKIP_BUILD);
  await check(results, "Security scan (OWASP)", checkSecurityScan);
  await check(results, "Secret scan (gitleaks)", checkSecretScan);
  await check(results, "SAST (semgrep)", checkSast);
  await check(results, "Bundle budget", checkBundleBudget);
  await check(
    results,
    "Contract enforcement (prod audit)",
    checkContractEnforcement,
  );
  await check(results, "Accessibility audit (ARIA)", checkAccessibility);
  await check(results, "Version consistency", checkVersionConsistency);
  await check(results, "Documentation check", checkDocumentation);

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — SHIP
// ─────────────────────────────────────────────────────────────────────────────

async function phaseShip(newVersion, validateResults) {
  console.log(`\n${c("bold", c("cyan", "━━━ Phase 4: Ship ━━━"))}`);

  const failed = validateResults.filter((r) => r.ok === false);
  if (failed.length) {
    console.log(
      c(
        "red",
        `\n❌ ${failed.length} validation check(s) failed — not shipping.`,
      ),
    );
    failed.forEach((r) =>
      console.log(c("red", `   • ${r.label}: ${r.error || ""}`)),
    );
    return false;
  }

  // Stage all changes
  run("git add -A", { stdio: "pipe" });

  // Check if there's anything to commit
  const status = tryRun("git status --porcelain").out.trim();
  if (!status) {
    console.log(c("dim", "  Nothing to commit — working tree clean"));
    return true;
  }

  const pkg = readJSON("package.json");
  const ver = pkg.version;
  const commitMsg = `chore: release v${ver}

- Pre-flight: fix, prepare, validate, ship
- Auto-fix lint + format applied
- Version synced across all files
- All checks passed (lint, tests, security, contracts, a11y, docs)

[preflight]`;

  // Commit
  run(`git commit -m "${commitMsg}"`, { stdio: "pipe" });
  console.log(c("green", `✅ Committed v${ver}`));

  // Tag (skip if already exists)
  const tagExists = tryRun(`git tag -l v${ver}`).out.trim() === `v${ver}`;
  if (!tagExists) {
    tryRun(`git tag -a v${ver} -m "Release v${ver}"`);
    console.log(c("green", `✅ Tagged v${ver}`));
  } else {
    console.log(c("dim", `  Tag v${ver} already exists — skipping`));
  }

  if (AUTO_PUSH) {
    process.stdout.write("  🚀 Pushing to origin... ");
    run("git push origin main", { stdio: "pipe" });
    run("git push origin --tags", { stdio: "pipe" });
    console.log(c("green", "done"));
  } else {
    const push = await ask(`\n  Push v${ver} to origin now?`);
    if (push) {
      run("git push origin main");
      run("git push origin --tags");
      console.log(c("green", "✅ Pushed to GitHub"));
    } else {
      const cmd = `git push origin main; git push origin v${ver}`;
      console.log(`\n  ${c("dim", "Run when ready:")} ${c("cyan", cmd)}`);
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary box
// ─────────────────────────────────────────────────────────────────────────────

function printSummary(newVersion, validateResults) {
  const W = 66;
  const line = "═".repeat(W);
  const pad = (s, n) => s + " ".repeat(Math.max(0, n - stripAnsi(s).length));
  // eslint-disable-next-line no-control-regex -- ANSI escape (\x1b) is intentional: strips terminal color codes
  const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

  console.log(`\n╔${line}╗`);
  const title = `🛫 PRE-FLIGHT — veteran-disability-search v${newVersion}`;
  console.log(
    `║  ${c("bold", title)}${" ".repeat(Math.max(0, W - 2 - stripAnsi(title).length))}║`,
  );
  console.log(`╠${line}╣`);

  for (const r of validateResults) {
    if (r.skipped) {
      const row = `  ⏭   ${r.label}`;
      console.log(`║${pad(row, W)}  ${c("dim", "skipped")}   ║`);
    } else if (r.ok) {
      const dur = r.duration ? c("dim", r.duration + "s") : "";
      const note = r.note ? c("dim", "  " + r.note) : "";
      const row = `  ${c("green", "✅")}  ${r.label.padEnd(36)} ${dur}${note}`;
      console.log(`║${pad(row, W + 14)}║`);
    } else {
      const row = `  ${c("red", "❌")}  ${r.label}  ${c("red", r.error || "")}`;
      console.log(`║${pad(row, W + 14)}║`);
    }
  }

  console.log(`╠${line}╣`);
  const failed = validateResults.filter((r) => r.ok === false).length;
  const total = validateResults.filter((r) => !r.skipped).length;
  if (failed === 0) {
    const msg = c(
      "green",
      c("bold", `✅  ALL CHECKS PASSED (${total}/${total}) — READY TO SHIP 🚀`),
    );
    console.log(
      `║  ${msg}${" ".repeat(Math.max(0, W - 2 - stripAnsi(msg).length + 18))}║`,
    );
  } else {
    const msg = c(
      "red",
      c("bold", `❌  ${failed} CHECK(S) FAILED — NOT READY`),
    );
    console.log(
      `║  ${msg}${" ".repeat(Math.max(0, W - 2 - stripAnsi(msg).length + 14))}║`,
    );
  }
  console.log(`╚${line}╝\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const pkg = readJSON("package.json");

  console.log(
    `\n${c("bold", c("magenta", "🛫 Pre-Flight Check — " + pkg.name))}`,
  );
  if (FAST)
    console.log(c("dim", "  --fast active (skip E2E, build, version bump)"));
  if (SKIP_E2E) console.log(c("dim", "  --skip-e2e active"));
  if (SKIP_BUILD) console.log(c("dim", "  --skip-build active"));
  if (NO_BUMP) console.log(c("dim", "  --no-bump active"));
  if (AUTO_PUSH) console.log(c("dim", "  --push active"));

  await phaseFix();
  const newVersion = await phasePrep();
  const results = await phaseValidate();

  printSummary(newVersion, results);

  const failed = results.filter((r) => r.ok === false);
  if (failed.length === 0) {
    await phaseShip(newVersion, results);
  } else {
    console.log(c("red", "❌ Fix the issues above, then re-run preflight."));
  }

  if (REPORT) {
    const report = {
      timestamp: new Date().toISOString(),
      version: newVersion,
      results,
      passed: failed.length === 0,
    };
    fs.writeFileSync(
      path.join(ROOT, "preflight-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(c("dim", "  Report written → preflight-report.json"));
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(c("red", `\n❌ Pre-flight crashed: ${e.message}`));
  process.exit(1);
});
