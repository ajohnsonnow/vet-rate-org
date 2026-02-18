/**
 * VetRate Autonomous Audit — Master Runner
 * 
 * This is the "one button to rule them all" script. It orchestrates the 
 * entire audit pipeline in the correct sequence:
 *
 *   Phase 1: Static Analysis
 *     → AST mapping (parse every file)
 *     → Dependency graph (build import map)
 *     → Wiring verification (UI → function tracing)
 *
 *   Phase 2: Dynamic Testing (optional, requires Playwright)
 *     → Smoke tests (app loads?)
 *     → Component render tests (everything opens?)
 *     → Wiring tests (buttons work?)
 *     → Security tests (inputs sanitized?)
 *
 *   Phase 3: Coverage Analysis
 *     → Compare static inventory vs dynamic execution
 *     → Generate risk assessment
 *     → Produce final audit report
 *
 * Usage:
 *   node runner.js              # Full pipeline
 *   node runner.js --static-only   # Skip Playwright
 *   node runner.js --dynamic-only  # Skip static analysis (use cached)
 */

import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT_DIR = path.join(__dirname, 'reports');

// ─── CLI Arguments ────────────────────────────────────────
const args = process.argv.slice(2);
const STATIC_ONLY = args.includes('--static-only');
const DYNAMIC_ONLY = args.includes('--dynamic-only');
const VERBOSE = args.includes('--verbose');

// ─── Pretty Logging ───────────────────────────────────────
const STAGE = {
  start(name) { console.log(`\n${'='.repeat(60)}\n  STAGE: ${name}\n${'='.repeat(60)}\n`); },
  done(name, duration) { console.log(`\n  [DONE] ${name} (${duration}ms)\n`); },
  fail(name, error) { console.error(`\n  [FAIL] ${name}: ${error}\n`); },
  skip(name) { console.log(`\n  [SKIP] ${name}\n`); }
};

function timeExec(fn) {
  const start = Date.now();
  fn();
  return Date.now() - start;
}

// ─── Ensure Reports Directory ─────────────────────────────
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

// ─── Phase 1: Static Analysis ─────────────────────────────
async function runStaticAnalysis() {
  STAGE.start('STATIC ANALYSIS');

  // Step 1: AST Mapping
  try {
    const duration = timeExec(() => {
      execSync('node static-analysis/ast-mapper.js', { 
        cwd: __dirname, 
        stdio: VERBOSE ? 'inherit' : 'pipe'
      });
    });
    STAGE.done('AST Mapper', duration);
  } catch (err) {
    STAGE.fail('AST Mapper', err.message);
    console.log('  Continuing despite AST mapper error...');
  }

  // Step 2: Dependency Graph
  try {
    const duration = timeExec(() => {
      execSync('node static-analysis/dependency-graph.js', {
        cwd: __dirname,
        stdio: VERBOSE ? 'inherit' : 'pipe'
      });
    });
    STAGE.done('Dependency Graph', duration);
  } catch (err) {
    STAGE.fail('Dependency Graph', err.message);
  }

  // Step 3: Wiring Verification
  try {
    const duration = timeExec(() => {
      execSync('node static-analysis/wiring-verifier.js', {
        cwd: __dirname,
        stdio: VERBOSE ? 'inherit' : 'pipe'
      });
    });
    STAGE.done('Wiring Verifier', duration);
  } catch (err) {
    STAGE.fail('Wiring Verifier', err.message);
  }
}

// ─── Phase 2: Dynamic Testing ─────────────────────────────
async function runDynamicTesting() {
  STAGE.start('DYNAMIC TESTING (Playwright)');

  // Check if Playwright is installed
  try {
    execSync('npx playwright --version', { cwd: __dirname, stdio: 'pipe' });
  } catch {
    console.log('  Playwright not installed. Installing...');
    try {
      execSync('npm install @playwright/test', { cwd: __dirname, stdio: 'pipe' });
      execSync('npx playwright install chromium', { cwd: __dirname, stdio: 'pipe' });
    } catch (err) {
      STAGE.fail('Playwright Installation', err.message);
      console.log('  Skipping dynamic tests. Install manually: npm install @playwright/test && npx playwright install chromium');
      return;
    }
  }

  // Run Playwright tests
  try {
    const duration = timeExec(() => {
      execSync(
        'npx playwright test --config=dynamic-testing/playwright.config.js --reporter=json',
        {
          cwd: __dirname,
          stdio: VERBOSE ? 'inherit' : 'pipe',
          env: {
            ...process.env,
            PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(REPORT_DIR, 'playwright-results.json')
          },
          timeout: 300_000 // 5 minute max
        }
      );
    });
    STAGE.done('Playwright Tests', duration);
  } catch (err) {
    // Playwright exits with non-zero on test failures — that's expected
    console.log('  Playwright tests completed (some may have failed — see report)');
    
    // Check if the results file was generated
    const resultsPath = path.join(REPORT_DIR, 'playwright-results.json');
    if (fs.existsSync(resultsPath)) {
      console.log('  Results captured successfully');
    }
  }
}

// ─── Phase 3: Coverage Analysis ───────────────────────────
async function runCoverageAnalysis() {
  STAGE.start('COVERAGE ANALYSIS');

  try {
    const duration = timeExec(() => {
      execSync('node coverage/coverage-analyzer.js', {
        cwd: __dirname,
        stdio: 'inherit'
      });
    });
    STAGE.done('Coverage Analyzer', duration);
  } catch (err) {
    STAGE.fail('Coverage Analyzer', err.message);
  }
}

// ─── Pipeline Orchestration ───────────────────────────────
async function main() {
  console.log('\n');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   VetRate Autonomous Codebase Audit v1.0    ║');
  console.log('  ║   Full-Coverage Static + Dynamic Pipeline   ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log(`\n  Mode: ${STATIC_ONLY ? 'Static Only' : DYNAMIC_ONLY ? 'Dynamic Only' : 'Full Pipeline'}`);
  console.log(`  Time: ${new Date().toISOString()}`);

  const startTime = Date.now();

  // Phase 1
  if (!DYNAMIC_ONLY) {
    await runStaticAnalysis();
  } else {
    STAGE.skip('Static Analysis (--dynamic-only flag)');
  }

  // Phase 2
  if (!STATIC_ONLY) {
    await runDynamicTesting();
  } else {
    STAGE.skip('Dynamic Testing (--static-only flag)');
  }

  // Phase 3 — always run
  await runCoverageAnalysis();

  // Final summary
  const totalDuration = Date.now() - startTime;
  console.log('\n');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║             AUDIT COMPLETE                   ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log(`\n  Total time: ${Math.round(totalDuration / 1000)}s`);
  console.log(`  Reports:    ${REPORT_DIR}/`);
  console.log('');

  // List generated reports
  if (fs.existsSync(REPORT_DIR)) {
    const files = fs.readdirSync(REPORT_DIR).filter(f => !f.startsWith('.'));
    console.log('  Generated reports:');
    for (const file of files) {
      const stats = fs.statSync(path.join(REPORT_DIR, file));
      const size = Math.round(stats.size / 1024);
      console.log(`    ${file} (${size}KB)`);
    }
  }

  // Read and display final score if available
  const scorePath = path.join(REPORT_DIR, 'coverage-report.json');
  if (fs.existsSync(scorePath)) {
    try {
      const score = JSON.parse(fs.readFileSync(scorePath, 'utf-8'));
      console.log(`\n  AUDIT SCORE: ${score.overallScore}/100 (Grade: ${score.riskAssessment?.grade})`);
    } catch {
      // Score not available
    }
  }

  console.log('');
}

main().catch(err => {
  console.error('Pipeline fatal error:', err);
  process.exit(1);
});
