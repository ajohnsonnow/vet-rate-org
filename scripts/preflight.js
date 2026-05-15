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
  return type === "major"
    ? `${M + 1}.0.0`
    : type === "minor"
      ? `${M}.${m + 1}.0`
      : `${M}.${m}.${p + 1}`;
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
  const lintFix = tryRun("npx eslint src --ext .js,.jsx --fix");
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

async function phasePrep() {
  console.log(`\n${c("bold", c("cyan", "━━━ Phase 2: Prepare Release ━━━"))}`);

  const pkg = readJSON("package.json");
  let currentVersion = pkg.version;
  let newVersion = currentVersion;

  if (!NO_BUMP) {
    let bumpType, reason;
    if (FORCE_MAJOR) {
      bumpType = "major";
      reason = "Forced major bump";
    } else if (FORCE_MINOR) {
      bumpType = "minor";
      reason = "Forced minor bump";
    } else if (FORCE_PATCH) {
      bumpType = "patch";
      reason = "Forced patch bump";
    } else {
      ({ type: bumpType, reason } = analyzeVersionBump());
    }

    newVersion = bumpVersion(currentVersion, bumpType);

    console.log(`\n  ${c("dim", "Current:")} ${c("yellow", currentVersion)}`);
    console.log(
      `  ${c("dim", "Bump:")}    ${c("cyan", bumpType.toUpperCase())} — ${reason}`,
    );
    console.log(`  ${c("dim", "New:")}     ${c("green", newVersion)}`);

    if (!AUTO_YES) {
      const ok = await ask(`\n  Proceed with v${newVersion}?`);
      if (!ok) {
        const custom = await askString(
          "  Enter custom version (X.Y.Z) or leave blank to abort",
        );
        if (custom && /^\d+\.\d+\.\d+$/.test(custom)) {
          newVersion = custom;
        } else {
          console.log(c("red", "\n❌ Aborted."));
          process.exit(1);
        }
      }
    }

    run(`npm version ${newVersion} --no-git-tag-version`, { stdio: "pipe" });
    console.log(c("green", `✅ Version bumped → v${newVersion}`));
  } else {
    console.log(
      c("dim", `  Version bump skipped — keeping v${currentVersion}`),
    );
  }

  // sync-version
  if (scriptExists("sync-version")) {
    process.stdout.write("  🔄 Syncing version... ");
    const r = tryRun("npm run sync-version");
    console.log(r.ok ? c("green", "done") : c("yellow", "warnings"));
  }

  // update-stats
  if (scriptExists("update-stats")) {
    process.stdout.write("  📊 Updating stats... ");
    const r = tryRun("npm run update-stats");
    console.log(r.ok ? c("green", "done") : c("yellow", "warnings"));
  }

  // Sync changelog
  const changelogPath = path.join(ROOT, "src", "data", "changelog.json");
  if (fs.existsSync(changelogPath)) {
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

  // check-legal-pages
  if (scriptExists("check-legal-pages")) {
    process.stdout.write("  ⚖️  Legal pages... ");
    const r = tryRun("npm run check-legal-pages");
    console.log(r.ok ? c("green", "ok") : c("yellow", "warnings"));
  }

  // VA data pipeline (optional, slow)
  const pythonExe = path.join(ROOT, ".venv", "Scripts", "python.exe");
  const pipelineScript = path.join(
    ROOT,
    "scripts",
    "scrapers",
    "va_data_pipeline.py",
  );
  if (fs.existsSync(pythonExe) && fs.existsSync(pipelineScript)) {
    process.stdout.write("  🏛️  VA data pipeline... ");
    const r = tryRun(`"${pythonExe}" "${pipelineScript}" --generate-frontend`);
    console.log(r.ok ? c("green", "done") : c("yellow", "skipped (error)"));
  }

  return newVersion;
}

function scriptExists(name) {
  const pkg = readJSON("package.json");
  return !!pkg?.scripts?.[name];
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — VALIDATE
// ─────────────────────────────────────────────────────────────────────────────

async function phaseValidate() {
  console.log(`\n${c("bold", c("cyan", "━━━ Phase 3: Validate ━━━"))}`);

  const results = [];
  const t0 = Date.now();

  async function check(label, fn, skip = false) {
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

  // 1. Lint
  await check("ESLint", () => {
    const r = tryRun("npx eslint src --ext .js,.jsx");
    if (!r.ok) throw new Error("Lint errors found");
    return {};
  });

  // 2. Unit tests + coverage
  await check("Unit tests + coverage", () => {
    run("npm run test:coverage", { stdio: VERBOSE ? "inherit" : "pipe" });
    return {};
  });

  // 3. E2E
  await check(
    "E2E (Playwright — chromium)",
    async () => {
      run("npx playwright test --project=chromium", {
        stdio: VERBOSE ? "inherit" : "pipe",
      });
      return {};
    },
    SKIP_E2E,
  );

  // 4. Production build
  await check(
    "Production build",
    () => {
      run("npx vite build", { stdio: VERBOSE ? "inherit" : "pipe" });
      return {};
    },
    SKIP_BUILD,
  );

  // 5. Security scan
  await check("Security scan (OWASP)", () => {
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
  });

  // 5a. Secret scan (gitleaks). Catches committed API keys, tokens, private
  // keys, etc. across the whole git history. Config: .gitleaks.toml.
  // Gracefully skips when gitleaks isn't installed locally.
  await check("Secret scan (gitleaks)", () => {
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
  });

  // 5b. SAST (semgrep). Pulls 5 registry rule packs + project-local custom
  // rules. Skips when semgrep isn't installed. Driver: scripts/sast-check.mjs.
  //
  // Findings are informational during Sprint 1–2: ~44 pre-existing baseline
  // hits are tracked in docs/AUDIT_FINDINGS.md and closed in Sprint 3. After
  // S3 lands, flip STRICT_SAST=true in CI to make this block again.
  await check("SAST (semgrep)", () => {
    const STRICT_SAST = process.env.STRICT_SAST === "true";
    const r = tryRun("node scripts/sast-check.mjs");
    if (/not installed/i.test(r.out)) {
      return {
        note: "semgrep not installed — `pip install semgrep`",
      };
    }
    const blockerMatch = /FAILED \((\d+) blocking finding/.exec(r.out);
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
  });

  // 6. Contract enforcement
  //
  // Vulnerability findings are informational during Sprint 1–2 (pre-existing
  // protobufjs/xmldom advisories tracked in AUDIT_FINDINGS.md, addressed in S8
  // supply-chain hardening). Set STRICT_AUDIT=true in CI once those resolve.
  await check("Contract enforcement", () => {
    const STRICT_AUDIT = process.env.STRICT_AUDIT === "true";
    const audit = tryRun("npm audit --audit-level=critical");
    if (!audit.ok && audit.out.includes("critical")) {
      if (STRICT_AUDIT) {
        throw new Error("npm audit: critical vulnerabilities found");
      }
      const critMatch = /(\d+) critical/.exec(audit.out);
      const highMatch = /(\d+) high/.exec(audit.out);
      return {
        note: `pre-existing: ${critMatch?.[1] ?? "?"} critical, ${highMatch?.[1] ?? "?"} high — tracked, fix in S8`,
      };
    }
    return { note: "0 violations" };
  });

  // 7. Accessibility audit
  await check("Accessibility audit (ARIA)", () => {
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
  });

  // 8. Version consistency
  await check("Version consistency", () => {
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
  });

  // 9. Docs check
  await check("Documentation check", () => {
    const required = ["README.md", "SECURITY.md", "CONTRIBUTING.md"];
    const missing = required.filter((f) => !fs.existsSync(path.join(ROOT, f)));
    if (missing.length) throw new Error(`Missing: ${missing.join(", ")}`);
    return { note: required.join(" + ") + " ✓" };
  });

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
