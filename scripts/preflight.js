/**
 * 🛫 PRE-FLIGHT CHECK
 *
 * Unified validation script — runs before every push or deploy.
 * Combines lint, tests, E2E, build, security, contracts, a11y, version, and docs checks.
 *
 * Usage:
 *   npm run preflight              # Full check (all 9 checks)
 *   npm run preflight:fast         # Skip E2E + build (~30s)
 *   npm run preflight:full         # Full check + write preflight-report.json
 *   npm run preflight -- --verbose # Show all subprocess output
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const ARGS = process.argv.slice(2);
const SKIP_E2E = ARGS.includes("--skip-e2e");
const SKIP_BUILD = ARGS.includes("--skip-build");
const VERBOSE = ARGS.includes("--verbose");
const REPORT = ARGS.includes("--report");

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

// ─── Run a shell command ──────────────────────────────────────────────────────
function run(cmd, options = {}) {
  const start = Date.now();
  try {
    const output = execSync(cmd, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: VERBOSE ? "inherit" : "pipe",
      timeout: options.timeout || 180_000,
    });
    return {
      ok: true,
      duration: (Date.now() - start) / 1000,
      output: output || "",
      note: "",
    };
  } catch (err) {
    if (!VERBOSE) {
      const out = (err.stdout || "") + (err.stderr || "");
      if (out) console.error(out.slice(-3000));
    }
    return {
      ok: false,
      duration: (Date.now() - start) / 1000,
      output: (err.stdout || "") + (err.stderr || ""),
      note: err.message?.split("\n")[0] || "",
    };
  }
}

// ─── Inline: Security scan (OWASP Top 10 patterns) ───────────────────────────
function runSecurityScan() {
  const start = Date.now();
  const checks = [
    {
      id: "SEC-001",
      name: "Hardcoded credentials",
      pattern: /password\s*=\s*['"][^'"]{6,}/gi,
      block: true,
    },
    {
      id: "SEC-004",
      name: "XSS (dangerouslySetInnerHTML)",
      pattern: /dangerouslySetInnerHTML/g,
      block: false,
    },
    {
      id: "SEC-007",
      name: "eval() usage",
      pattern: /\beval\s*\(/g,
      block: true,
    },
    {
      id: "SEC-007",
      name: "new Function()",
      pattern: /new\s+Function\s*\(/g,
      block: true,
    },
    {
      id: "CTK-005",
      name: "Hardcoded secrets",
      pattern: /-----BEGIN|sk-ant-|sk-proj-/g,
      block: true,
    },
  ];
  const issues = [];
  const warnings = [];

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules"
      ) {
        scanDir(full);
      } else if (entry.isFile() && /\.(js|jsx)$/.test(entry.name)) {
        const content = fs.readFileSync(full, "utf8");
        const lines = content.split("\n");
        for (const check of checks) {
          check.pattern.lastIndex = 0;
          let m;
          while ((m = check.pattern.exec(content)) !== null) {
            const lineNum = content.slice(0, m.index).split("\n").length;
            const line = lines[lineNum - 1] || "";
            if (line.trim().startsWith("//") || line.trim().startsWith("*"))
              continue;
            const rel = path.relative(ROOT, full);
            if (
              rel.includes(".test.") ||
              rel.includes(".spec.") ||
              rel.includes("preflight")
            )
              continue;
            if (check.block)
              issues.push(`[${check.id}] ${check.name} — ${rel}:${lineNum}`);
            else
              warnings.push(
                `[${check.id}] WARN ${check.name} — ${rel}:${lineNum}`,
              );
          }
        }
      }
    }
  }
  scanDir(path.join(ROOT, "src"));

  const ok = issues.length === 0;
  const warnCount = warnings.length;
  const note = ok
    ? warnCount
      ? `0 critical, ${warnCount} warning(s)`
      : "0 findings"
    : `${issues.length} critical finding(s)`;
  if (!ok && !VERBOSE)
    issues.forEach((i) => console.error(`  ${C.red}${i}${C.reset}`));
  if (warnCount && !VERBOSE)
    warnings.forEach((w) => console.warn(`  ${C.yellow}${w}${C.reset}`));
  return { ok, duration: (Date.now() - start) / 1000, note };
}

// ─── Inline: Contract enforcement ────────────────────────────────────────────
function runContractCheck() {
  const start = Date.now();
  const banned = ["eval(", "-----BEGIN", "sk-ant-", "new Function("];
  const violations = [];

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules"
      ) {
        scanDir(full);
      } else if (entry.isFile() && /\.(js|jsx)$/.test(entry.name)) {
        const lines = fs.readFileSync(full, "utf8").split("\n");
        lines.forEach((line, i) => {
          if (line.trim().startsWith("//") || line.trim().startsWith("*"))
            return;
          const rel = path.relative(ROOT, full);
          if (
            rel.includes(".test.") ||
            rel.includes(".spec.") ||
            rel.includes("preflight")
          )
            return;
          banned.forEach((b) => {
            if (line.includes(b)) violations.push(`${rel}:${i + 1} — ${b}`);
          });
        });
      }
    }
  }
  scanDir(path.join(ROOT, "src"));

  const ok = violations.length === 0;
  const note = ok ? "0 violations" : `${violations.length} violation(s)`;
  if (!ok && !VERBOSE)
    violations.forEach((v) => console.error(`  ${C.red}${v}${C.reset}`));
  return { ok, duration: (Date.now() - start) / 1000, note };
}

// ─── Inline: Accessibility audit (ARIA pattern check) ────────────────────────
function runA11yAudit() {
  const start = Date.now();
  const compDir = path.join(ROOT, "src", "components");
  if (!fs.existsSync(compDir))
    return { ok: true, duration: 0, note: "no components dir" };

  const files = fs.readdirSync(compDir).filter((f) => f.endsWith(".jsx"));
  let ariaCount = 0;
  for (const f of files) {
    const content = fs.readFileSync(path.join(compDir, f), "utf8");
    if (/aria-/.test(content)) ariaCount++;
  }
  const pct = Math.round((ariaCount / files.length) * 100);
  const ok = pct >= 40;
  return {
    ok,
    duration: (Date.now() - start) / 1000,
    note: `${ariaCount}/${files.length} components (${pct}%)`,
  };
}

// ─── Inline: Version consistency ─────────────────────────────────────────────
function runVersionCheck() {
  const start = Date.now();
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
    );
    const vFile = path.join(ROOT, "public", "version.json");
    if (!fs.existsSync(vFile))
      return { ok: true, duration: 0, note: "no version.json (ok)" };
    const vJson = JSON.parse(fs.readFileSync(vFile, "utf8"));
    const ok = vJson.version === pkg.version;
    return {
      ok,
      duration: (Date.now() - start) / 1000,
      note: ok
        ? `v${pkg.version}`
        : `pkg=${pkg.version} vs file=${vJson.version}`,
    };
  } catch (e) {
    return { ok: false, duration: 0, note: e.message };
  }
}

// ─── Inline: Documentation check ─────────────────────────────────────────────
function runDocsCheck() {
  const start = Date.now();
  const issues = [];
  const readme = path.join(ROOT, "README.md");
  if (!fs.existsSync(readme)) {
    issues.push("README.md missing");
  } else {
    const content = fs.readFileSync(readme, "utf8");
    if (content.length < 1000)
      issues.push(`README.md too short (${content.length} chars)`);
  }
  if (!fs.existsSync(path.join(ROOT, "SECURITY.md")))
    issues.push("SECURITY.md missing");
  if (!fs.existsSync(path.join(ROOT, "CONTRIBUTING.md")))
    issues.push("CONTRIBUTING.md missing");

  const ok = issues.length === 0;
  const note = ok ? "README + SECURITY + CONTRIBUTING ✓" : issues.join(", ");
  if (!ok && !VERBOSE)
    issues.forEach((i) => console.error(`  ${C.yellow}${i}${C.reset}`));
  return { ok, duration: (Date.now() - start) / 1000, note };
}

// ─── Summary box ─────────────────────────────────────────────────────────────
const WIDTH = 62;
const pad = (s, n) => s.padEnd(n);
const dur = (d) => `${d.toFixed(1)}s`.padStart(5);

function printBox(lines) {
  const top = "╔" + "═".repeat(WIDTH) + "╗";
  const bottom = "╚" + "═".repeat(WIDTH) + "╝";
  const div = "╠" + "═".repeat(WIDTH) + "╣";
  // Strip ANSI codes for padding calculation
  const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
  const row = (s) => {
    const visible = stripAnsi(s);
    const padding = Math.max(0, WIDTH - 2 - visible.length);
    return "║  " + s + " ".repeat(padding) + "║";
  };
  console.log("\n" + top);
  for (const l of lines) {
    if (l === "---") console.log(div);
    else console.log(row(l));
  }
  console.log(bottom + "\n");
}

// ─── CUSTOMIZE: add your own checks to the CHECKS array below ────────────────

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
  );
  const projectName = pkg.name || "project";

  console.log(
    `\n${C.bold}${C.cyan}🛫 Pre-Flight Check — ${projectName}${C.reset}`,
  );
  if (SKIP_E2E) console.log(`${C.dim}  --skip-e2e active${C.reset}`);
  if (SKIP_BUILD) console.log(`${C.dim}  --skip-build active${C.reset}`);
  console.log("");

  const CHECKS = [
    { id: "lint", label: "ESLint", fn: () => run("npm run lint") },
    {
      id: "test",
      label: "Unit tests + coverage",
      fn: () => run("npm run test:coverage", { timeout: 120_000 }),
    },
    {
      id: "e2e",
      label: "E2E tests (Playwright)",
      fn: () =>
        run("npx playwright test --project=chromium", { timeout: 180_000 }),
      skip: SKIP_E2E,
    },
    {
      id: "build",
      label: "Production build",
      fn: () => run("npx vite build", { timeout: 180_000 }),
      skip: SKIP_BUILD,
    },
    { id: "security", label: "Security scan (OWASP)", fn: runSecurityScan },
    { id: "contracts", label: "Contract enforcement", fn: runContractCheck },
    { id: "a11y", label: "Accessibility audit (ARIA)", fn: runA11yAudit },
    { id: "versions", label: "Version consistency", fn: runVersionCheck },
    { id: "docs", label: "Documentation check", fn: runDocsCheck },
  ];

  const results = [];

  for (const check of CHECKS) {
    if (check.skip) {
      console.log(`${C.dim}  ⏭  ${check.label} (skipped)${C.reset}`);
      results.push({
        ...check,
        skipped: true,
        ok: true,
        duration: 0,
        note: "skipped",
      });
      continue;
    }
    process.stdout.write(`  ⏳ ${check.label}...`);
    const result = check.fn();
    const icon = result.ok ? `${C.green}✅${C.reset}` : `${C.red}❌${C.reset}`;
    process.stdout.write(
      `\r  ${icon} ${pad(check.label, 40)} ${C.dim}${dur(result.duration)}${C.reset}\n`,
    );
    results.push({ ...check, ...result });
  }

  // Summary
  const passed = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.ok).length;
  const total = results.filter((r) => !r.skipped).length;

  const lines = [
    `${C.bold}🛫 PRE-FLIGHT — ${projectName}${C.reset}`,
    "---",
    ...results.map((r) => {
      const icon = r.skipped
        ? "⏭ "
        : r.ok
          ? `${C.green}✅${C.reset}`
          : `${C.red}❌${C.reset}`;
      const time = r.skipped ? "     " : dur(r.duration);
      const note = r.note ? `  ${C.dim}${r.note}${C.reset}` : "";
      return `${icon}  ${pad(r.label, 36)} ${C.dim}${time}${C.reset}${note}`;
    }),
    "---",
    failed === 0
      ? `${C.green}${C.bold}✅  ALL CHECKS PASSED (${passed}/${total}) — READY TO SHIP 🚀${C.reset}`
      : `${C.red}${C.bold}❌  ${failed} CHECK(S) FAILED (${passed}/${total}) — FIX BEFORE PUSHING${C.reset}`,
  ];

  printBox(lines);

  if (REPORT) {
    const report = {
      date: new Date().toISOString(),
      project: projectName,
      summary: { passed, failed, skipped, total },
      checks: results.map((r) => ({
        id: r.id,
        label: r.label,
        ok: r.ok,
        duration: r.duration,
        note: r.note,
        skipped: r.skipped || false,
      })),
    };
    fs.writeFileSync(
      path.join(ROOT, "preflight-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      `${C.cyan}📄 Report written: preflight-report.json${C.reset}\n`,
    );
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
