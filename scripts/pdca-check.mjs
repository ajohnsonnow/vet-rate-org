#!/usr/bin/env node
/**
 * PDCA Check — Plan · Do · Check · Act
 *
 * Automated test pipeline for vet-rate-org-official.
 * Runs vitest (unit) and Playwright (e2e), parses results,
 * and writes a dated PDCA report to audit/pdca-reports/.
 *
 * Usage:
 *   node scripts/pdca-check.mjs               # full run
 *   node scripts/pdca-check.mjs --unit-only   # vitest only
 *   node scripts/pdca-check.mjs --e2e-only    # playwright only
 *   node scripts/pdca-check.mjs --fast        # unit + chromium only
 *
 * The script exits 0 when all required gates pass, 1 when any fail.
 * Warnings (non-blocking) are printed but do not fail the exit code.
 */

import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const REPORT_DIR = join(ROOT, "audit", "pdca-reports");
const now = new Date();
const TIMESTAMP = now.toISOString().replace(/[:T]/g, "-").slice(0, 16);

const args = process.argv.slice(2);
const FLAG_UNIT_ONLY = args.includes("--unit-only");
const FLAG_E2E_ONLY = args.includes("--e2e-only");
const FLAG_FAST = args.includes("--fast");
const FLAG_CI = args.includes("--ci") || !!process.env.CI;

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};
const ok = (s) => `${C.green}✓${C.reset} ${s}`;
const fail = (s) => `${C.red}✗${C.reset} ${s}`;
const warn = (s) => `${C.yellow}⚠${C.reset} ${s}`;
const info = (s) => `${C.cyan}→${C.reset} ${s}`;

// ── Result accumulator ────────────────────────────────────────────────────────
const results = {
  unit: null,   // { passed, failed, skipped, duration, failures: [] }
  e2e: null,    // { passed, failed, skipped, duration, failures: [] }
  gitleaks: null, // { clean: bool }
  startTime: Date.now(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  try {
    const out = execSync(cmd, {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      ...opts,
    });
    return { code: 0, stdout: out, stderr: "" };
  } catch (err) {
    return {
      code: err.status ?? 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

function parseVitestJson(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    const failures = [];
    let passed = 0, failed = 0, skipped = 0;

    for (const suite of data.testResults ?? []) {
      for (const test of suite.assertionResults ?? []) {
        if (test.status === "passed") passed++;
        else if (test.status === "failed") {
          failed++;
          failures.push({
            name: `${suite.testFilePath?.replace(ROOT, "")} > ${test.fullName}`,
            message: test.failureMessages?.[0]?.slice(0, 300) ?? "no message",
          });
        } else skipped++;
      }
    }
    return { passed, failed, skipped, failures };
  } catch {
    return { passed: 0, failed: 0, skipped: 0, failures: [] };
  }
}

function parsePlaywrightJson(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    const failures = [];
    let passed = 0, failed = 0, skipped = 0;

    function walk(suites) {
      for (const suite of suites ?? []) {
        walk(suite.suites);
        for (const spec of suite.specs ?? []) {
          for (const test of spec.tests ?? []) {
            const status = test.results?.[0]?.status ?? "skipped";
            if (status === "passed") passed++;
            else if (status === "failed" || status === "timedOut") {
              failed++;
              const err = test.results?.[0]?.error;
              failures.push({
                name: `${spec.file} > ${spec.title}`,
                message: (err?.message ?? err?.value ?? "no message").slice(0, 300),
              });
            } else skipped++;
          }
        }
      }
    }

    walk(data.suites);
    return { passed, failed, skipped, failures };
  } catch {
    return { passed: 0, failed: 0, skipped: 0, failures: [] };
  }
}

// ── PLAN ──────────────────────────────────────────────────────────────────────
console.log(`\n${C.bold}${C.cyan}PDCA Check — ${TIMESTAMP}${C.reset}`);
console.log(info("PLAN: Define what we're testing"));
console.log("  • Unit tests (Vitest): routing logic, security, calculators, AI safety");
console.log("  • E2E tests (Playwright): UI pipeline, tool interactions, packet persistence");
console.log("  • Security scan: gitleaks for secrets");
console.log("  • Success criteria: 0 unit failures, 0 e2e failures, 0 leaks\n");

// ── DO ────────────────────────────────────────────────────────────────────────
console.log(`${C.bold}${C.cyan}DO: Run the tests${C.reset}`);

// 1. Vitest unit tests
if (!FLAG_E2E_ONLY) {
  console.log(info("Running Vitest unit tests..."));
  const jsonOut = join(ROOT, ".pdca-vitest-results.json");
  const vitestResult = run(
    `npx vitest run --reporter=json --outputFile="${jsonOut}"`,
  );

  if (existsSync(jsonOut)) {
    const parsed = parseVitestJson(readFileSync(jsonOut, "utf-8"));
    results.unit = { ...parsed, duration: 0 };
    const status = parsed.failed === 0 ? ok : fail;
    console.log(
      `  ${status(`Vitest: ${parsed.passed} passed, ${parsed.failed} failed, ${parsed.skipped} skipped`)}`,
    );
    if (parsed.failures.length > 0) {
      for (const f of parsed.failures.slice(0, 10)) {
        console.log(`    ${C.red}•${C.reset} ${f.name}`);
        if (f.message) console.log(`      ${f.message}`);
      }
    }
    // Clean up temp file
    try { execSync(`node -e "require('fs').unlinkSync('${jsonOut}')"`, { cwd: ROOT, stdio: "pipe" }); } catch {}
  } else {
    // Fall back to parsing stdout
    const lines = vitestResult.stdout + vitestResult.stderr;
    const passMatch = lines.match(/(\d+) passed/);
    const failMatch = lines.match(/(\d+) failed/);
    results.unit = {
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : (vitestResult.code !== 0 ? 1 : 0),
      skipped: 0,
      failures: [],
    };
    const status = results.unit.failed === 0 ? ok : fail;
    console.log(`  ${status(`Vitest: ${results.unit.passed} passed, ${results.unit.failed} failed`)}`);
    if (vitestResult.code !== 0) {
      console.log(`    Output: ${lines.slice(-500)}`);
    }
  }
}

// 2. Playwright E2E tests
if (!FLAG_UNIT_ONLY) {
  const e2eJsonOut = join(ROOT, ".pdca-playwright-results.json");
  const playwrightArgs = FLAG_FAST
    ? `"tests/e2e/*.spec.ts" --project=chromium`
    : `"tests/e2e/*.spec.ts"`;

  console.log(info(`Running Playwright E2E tests (${FLAG_FAST ? "chromium only" : "all browsers"})...`));
  console.log(info("  Starting dev server on port 5197..."));

  const pwResult = run(
    `npx playwright test ${playwrightArgs} --reporter=json`,
    { timeout: 300_000 }, // 5 min max
  );

  // Playwright writes JSON to stdout when --reporter=json
  const pwJson = pwResult.stdout;
  if (pwJson && pwJson.trim().startsWith("{")) {
    // Write to file so we can also save it
    writeFileSync(e2eJsonOut, pwJson);
    const parsed = parsePlaywrightJson(pwJson);
    results.e2e = { ...parsed, duration: 0 };
    const status = parsed.failed === 0 ? ok : fail;
    console.log(
      `  ${status(`Playwright: ${parsed.passed} passed, ${parsed.failed} failed, ${parsed.skipped} skipped`)}`,
    );
    if (parsed.failures.length > 0) {
      for (const f of parsed.failures.slice(0, 15)) {
        console.log(`    ${C.red}•${C.reset} ${f.name}`);
        if (f.message) console.log(`      ${f.message.split("\n")[0]}`);
      }
    }
  } else {
    // Parse from exit code + stderr summary line
    const lines = pwResult.stdout + pwResult.stderr;
    const passMatch = lines.match(/(\d+) passed/);
    const failMatch = lines.match(/(\d+) failed/);
    results.e2e = {
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : (pwResult.code !== 0 ? 1 : 0),
      skipped: 0,
      failures: [],
    };
    const status = results.e2e.failed === 0 ? ok : fail;
    console.log(`  ${status(`Playwright: ${results.e2e.passed} passed, ${results.e2e.failed} failed`)}`);
    // Print last 600 chars of output for diagnostics
    if (pwResult.code !== 0) {
      const tail = (lines).slice(-600);
      console.log(`    ${C.yellow}Tail:${C.reset}\n${tail}`);
    }
  }
}

// 3. gitleaks
console.log(info("Running gitleaks (secret scan)..."));
const glResult = run("gitleaks detect --source . --no-banner --exit-code 1");
results.gitleaks = { clean: glResult.code === 0 };
console.log(`  ${results.gitleaks.clean ? ok("gitleaks: 0 secrets") : fail("gitleaks: SECRETS FOUND — see output above")}`);

// ── CHECK ─────────────────────────────────────────────────────────────────────
console.log(`\n${C.bold}${C.cyan}CHECK: Evaluate results${C.reset}`);

const unitPass = results.unit === null || results.unit.failed === 0;
const e2ePass = results.e2e === null || results.e2e.failed === 0;
const leaksPass = results.gitleaks.clean;

const gates = [
  { name: "Vitest unit tests", pass: unitPass, required: !FLAG_E2E_ONLY },
  { name: "Playwright E2E tests", pass: e2ePass, required: !FLAG_UNIT_ONLY },
  { name: "gitleaks secret scan", pass: leaksPass, required: true },
];

let allPassed = true;
for (const gate of gates) {
  if (!gate.required) {
    console.log(`  ${C.yellow}–${C.reset} ${gate.name} (skipped)`);
    continue;
  }
  if (gate.pass) {
    console.log(`  ${ok(gate.name)}`);
  } else {
    console.log(`  ${fail(gate.name)}`);
    allPassed = false;
  }
}

// ── ACT ───────────────────────────────────────────────────────────────────────
console.log(`\n${C.bold}${C.cyan}ACT: Write report and determine next steps${C.reset}`);

// Collect known gaps for the report
const knownOpenItems = [
  "F5-1: DC 8620 ratingCriteria empty (sciatic nerve neuritis no % breakdown)",
  "F3-4/F3-5: ClaimNavigator + DenialDecoder — focus trap + aria-modal pending (no focus trap yet)",
  "F6-1: RAG coverage gap — 38 CFR Parts 3/19/20, M21-1, CAVC not ingested",
  "F6-2: Firefox Tab focus cycle test (pre-existing DIV in tabindex)",
  "F6-3: mobile-chrome axe home-page violation (pre-existing)",
  "NexusBuilder: may not render with pre-loaded conditions (data binding gap — see tool-with-packet spec)",
  "Local LLM (WebGPU/Wllama): cannot be automated in CI — requires real GPU + model download",
  "Real C-File processing: not testable in CI due to PII constraint (use redacted fixture only)",
];

// Build report markdown
const duration = ((Date.now() - results.startTime) / 1000).toFixed(0);
const unitSummary = results.unit
  ? `${results.unit.passed} passed / ${results.unit.failed} failed / ${results.unit.skipped} skipped`
  : "skipped";
const e2eSummary = results.e2e
  ? `${results.e2e.passed} passed / ${results.e2e.failed} failed / ${results.e2e.skipped} skipped`
  : "skipped";

const unitFailList = results.unit?.failures?.length
  ? results.unit.failures.map((f) => `  - \`${f.name}\`\n    ${f.message}`).join("\n")
  : "  None";
const e2eFailList = results.e2e?.failures?.length
  ? results.e2e.failures.map((f) => `  - \`${f.name}\`\n    ${f.message}`).join("\n")
  : "  None";

const overallStatus = allPassed ? "PASS" : "FAIL";

const report = `# PDCA Check — ${TIMESTAMP}

> **Overall:** ${overallStatus}
> **Duration:** ${duration}s
> **Branch:** \`${run("git rev-parse --abbrev-ref HEAD").stdout.trim()}\`
> **Commit:** \`${run("git rev-parse --short HEAD").stdout.trim()}\`

---

## PLAN

Automated test pipeline covering:
- Vitest unit tests: routing logic, security, calculators, AI safety contracts
- Playwright E2E: AI mode detection, tool interactions, packet persistence
- gitleaks: secret leak prevention
- Success criteria: 0 unit failures, 0 e2e failures, 0 leaks

---

## DO (results)

| Gate | Result | Detail |
|---|---|---|
| Vitest unit | ${unitPass ? "✅ PASS" : "❌ FAIL"} | ${unitSummary} |
| Playwright E2E | ${e2ePass ? "✅ PASS" : "❌ FAIL"} | ${e2eSummary} |
| gitleaks | ${leaksPass ? "✅ PASS" : "❌ FAIL"} | ${leaksPass ? "0 secrets" : "SECRETS FOUND"} |

---

## CHECK (failures)

### Unit test failures
${unitFailList}

### E2E failures
${e2eFailList}

---

## ACT (next steps)

### Immediate (fix before next commit)
${allPassed ? "- No blocking failures." : "- Fix failing tests listed above."}

### Known open items (documented, not blocking)
${knownOpenItems.map((i) => `- ${i}`).join("\n")}

### Cannot automate (manual verification required)
- **Local LLM (WebGPU / Diamond Swarm)**: requires Chrome with WebGPU enabled + downloaded GGUF models.
  Test manually: open app in Chrome, load auditor model, run C-File Analyzer with redacted fixture.
- **Wllama (browser WASM)**: requires model download on first use. Test manually in Chrome/Firefox.
- **Real C-File processing**: PII constraint — only the redacted synthetic fixture may be used in CI.
  Manual path: use \`E:\\Williams_C-FIle\` docs with DevTools open, confirm no PII in network requests.
- **Gemini API round-trip**: FAKE_GEMINI_KEY used in tests rejects at the API level.
  Manual path: set real key, run C-File Analyzer, verify cited output with no hallucinated DOIs.

---

*Generated by \`scripts/pdca-check.mjs\` on ${now.toUTCString()}*
`;

mkdirSync(REPORT_DIR, { recursive: true });
const reportPath = join(REPORT_DIR, `PDCA-${TIMESTAMP}.md`);
writeFileSync(reportPath, report, "utf-8");
console.log(info(`Report written to audit/pdca-reports/PDCA-${TIMESTAMP}.md`));

// ── Exit ──────────────────────────────────────────────────────────────────────
if (allPassed) {
  console.log(`\n${C.bold}${C.green}All required gates passed.${C.reset}\n`);
  process.exit(0);
} else {
  console.log(
    `\n${C.bold}${C.red}One or more required gates failed.${C.reset} See report for details.\n`,
  );
  process.exit(1);
}
