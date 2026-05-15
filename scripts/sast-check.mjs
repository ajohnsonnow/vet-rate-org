#!/usr/bin/env node
/**
 * sast-check.mjs — Semgrep SAST wrapper for VS_Studio projects.
 *
 * Detects whether semgrep is installed, locates the toolkit rule pack, runs
 * the scan, and prints clickable file:line findings. Exits non-zero when any
 * finding has severity ERROR or WARNING.
 *
 * Usage:
 *   node scripts/sast-check.mjs [--strict] [--config <path>]
 *
 * Flags:
 *   --strict       Exit 1 when semgrep is not installed (default: exit 0).
 *   --config <p>   Override the semgrep config path (file or directory).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Registry rule packs ──────────────────────────────────────────────────────
// Semgrep registry packs to load on every run, in addition to the local
// .semgrep.yml + .semgrep/custom-rules/ contents. Override per-project by
// editing this list and re-running the propagator, or pass --no-registry to
// run with the local config only.
const REGISTRY_PACKS = [
  "p/javascript",
  "p/owasp-top-ten",
  "p/security-audit",
  "p/nodejs",
  "p/expressjs",
];

// Registry rule IDs that produce false positives the toolkit replaces with
// stricter local rules (see templates/semgrep/custom-rules/). Each entry MUST
// be paired with a local replacement of equal or stricter scope so the
// security signal isn't lost. Pass --no-rule-overrides to disable.
const RULE_OVERRIDES = [
  // Upstream rule flags every HTML template literal even when escapeHtml is
  // applied. Replaced by local.raw-html-format-strict which recognizes
  // escapeHtml/safeHtml as sanitizers.
  "javascript.express.security.injection.raw-html-format.raw-html-format",
  // Upstream rule flags every non-literal child_process call, including
  // preflight scripts that exec hardcoded npm/git/node commands. Replaced by
  // local.detect-child-process-strict which excludes scripts/preflight*,
  // pre-*, sast-check.mjs, propagate-*.mjs (CI infrastructure with no HTTP
  // input path) while still catching application-code violations.
  "javascript.lang.security.detect-child-process.detect-child-process",
];

// ── Argument parsing ──────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const NO_REGISTRY = argv.includes('--no-registry');
const NO_RULE_OVERRIDES = argv.includes('--no-rule-overrides');

let configOverride = null;
const cfgIdx = argv.indexOf('--config');
if (cfgIdx !== -1 && argv[cfgIdx + 1]) {
  configOverride = path.resolve(argv[cfgIdx + 1]);
}

// ── Locate semgrep binary ─────────────────────────────────────────────────────

function probe(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: 10_000 });
  return result.status === 0;
}

function findSemgrep() {
  if (probe('semgrep', ['--version'])) return 'semgrep';
  if (probe('python', ['-m', 'semgrep', '--version'])) return 'python -m semgrep';
  if (probe('python3', ['-m', 'semgrep', '--version'])) return 'python3 -m semgrep';
  if (probe('py', ['-m', 'semgrep', '--version'])) return 'py -m semgrep';
  return null;
}

// ── Locate rule pack ──────────────────────────────────────────────────────────

/**
 * Returns an object { mainConfig, customRulesDir } where:
 *   mainConfig     — path to .semgrep.yml (file)
 *   customRulesDir — path to custom-rules/ directory, or null if absent
 *
 * Search order (first match wins):
 *   1. --config flag override
 *   2. Sibling toolkit (script copied into a consumer project)
 *   3. Toolkit-internal run
 *   4. Propagated local copies at <project>/.semgrep.yml + <project>/.semgrep/custom-rules/
 */
function locateRulePack() {
  if (configOverride) {
    // --config may point to a file or a directory.
    const isDir = existsSync(configOverride) && statSync(configOverride).isDirectory();
    if (isDir) {
      const mainConfig = path.join(configOverride, '.semgrep.yml');
      const customRulesDir = path.join(configOverride, 'custom-rules');
      return {
        mainConfig: existsSync(mainConfig) ? mainConfig : configOverride,
        customRulesDir: existsSync(customRulesDir) ? customRulesDir : null,
      };
    }
    return { mainConfig: configOverride, customRulesDir: null };
  }

  // Toolkit directory candidates (directory form).
  const toolkitCandidates = [
    // Consumer project: scripts/sast-check.mjs → ../../best-practices-toolkit/templates/semgrep
    path.resolve(__dirname, '..', '..', 'best-practices-toolkit', 'templates', 'semgrep'),
    // Toolkit-internal: scripts/sast-check.mjs → ../templates/semgrep
    path.resolve(__dirname, '..', 'templates', 'semgrep'),
  ];

  for (const dir of toolkitCandidates) {
    const mainConfig = path.join(dir, '.semgrep.yml');
    if (existsSync(mainConfig)) {
      const customRulesDir = path.join(dir, 'custom-rules');
      return {
        mainConfig,
        customRulesDir: existsSync(customRulesDir) ? customRulesDir : null,
      };
    }
  }

  // Propagated local copies: <project root>/.semgrep.yml + <project root>/.semgrep/custom-rules/
  // __dirname is <project>/scripts/ when copied in, so project root is one level up.
  const projectRoot = path.resolve(__dirname, '..');
  const localConfig = path.join(projectRoot, '.semgrep.yml');
  if (existsSync(localConfig)) {
    const customRulesDir = path.join(projectRoot, '.semgrep', 'custom-rules');
    return {
      mainConfig: localConfig,
      customRulesDir: existsSync(customRulesDir) ? customRulesDir : null,
    };
  }

  return null;
}

// ── Run semgrep ───────────────────────────────────────────────────────────────

function runSemgrep(semgrepCmd, { mainConfig, customRulesDir }) {
  const args = ['scan'];

  if (!NO_REGISTRY) {
    for (const pack of REGISTRY_PACKS) {
      args.push('--config', pack);
    }
  }

  args.push('--config', mainConfig);

  if (customRulesDir) {
    args.push('--config', customRulesDir);
  }

  if (!NO_RULE_OVERRIDES) {
    for (const ruleId of RULE_OVERRIDES) {
      args.push('--exclude-rule', ruleId);
    }
  }

  args.push('--json', '--error', '--quiet', '--metrics=off');

  let cmd, cmdArgs;
  if (semgrepCmd.includes(' ')) {
    const parts = semgrepCmd.split(' ');
    cmd = parts[0];
    cmdArgs = [...parts.slice(1), ...args];
  } else {
    cmd = semgrepCmd;
    cmdArgs = args;
  }

  return spawnSync(cmd, cmdArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 5 * 60 * 1000,
    maxBuffer: 50 * 1024 * 1024,
  });
}

// ── Format findings ───────────────────────────────────────────────────────────

function formatFindings(jsonOutput) {
  let parsed;
  try {
    parsed = JSON.parse(jsonOutput);
  } catch {
    return { findings: [], parseError: true };
  }

  const results = parsed.results ?? [];
  const findings = results.map((r) => {
    const filePath = r.path ?? '';
    const line = r.start?.line ?? 0;
    const ruleId = r.check_id ?? 'unknown';
    const message = r.extra?.message ?? '';
    const severity = (r.extra?.severity ?? 'INFO').toUpperCase();
    const link = `${filePath}#L${line}`;
    return { filePath, line, ruleId, message, severity, link };
  });

  return { findings, parseError: false };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const semgrepCmd = findSemgrep();

if (!semgrepCmd) {
  console.error(
    'Semgrep not installed. Install with: `pip install semgrep` (Python 3.8+) or run via Docker:\n' +
    '  docker run --rm -v "$(pwd):/src" semgrep/semgrep semgrep --config auto /src',
  );
  process.exit(STRICT ? 1 : 0);
}

const rulePack = locateRulePack();

if (!rulePack) {
  console.error(
    'Semgrep config not found. Expected one of:\n' +
    '  - ../../best-practices-toolkit/templates/semgrep/.semgrep.yml\n' +
    '  - ../templates/semgrep/.semgrep.yml\n' +
    '  - .semgrep.yml (propagated local copy)\n' +
    'Run `node scripts/propagate-security-rules.mjs` to copy the rule pack here,\n' +
    'or pass --config <path> to specify a config explicitly.',
  );
  process.exit(STRICT ? 1 : 0);
}

const configDesc = rulePack.customRulesDir
  ? `${rulePack.mainConfig} + ${rulePack.customRulesDir}`
  : rulePack.mainConfig;
console.log(`Running Semgrep SAST (config: ${configDesc}) ...`);

const result = runSemgrep(semgrepCmd, rulePack);

if (result.error) {
  console.error(`Semgrep process error: ${result.error.message}`);
  process.exit(1);
}

const rawOutput = result.stdout ?? '';
const { findings, parseError } = formatFindings(rawOutput);

if (parseError) {
  // semgrep printed non-JSON; forward stderr as-is.
  if (result.stderr) process.stderr.write(result.stderr);
  if (rawOutput) process.stdout.write(rawOutput);
  console.error('\nSemgrep output was not valid JSON. Treating as failure.');
  process.exit(1);
}

if (findings.length === 0) {
  console.log('Semgrep SAST: 0 findings. All checks passed.');
  process.exit(0);
}

console.log(`\nSemgrep SAST: ${findings.length} finding(s):\n`);

let hasBlocker = false;
for (const f of findings) {
  const label = `[${f.ruleId}] ${f.message}`;
  // Clickable link format understood by VS Code integrated terminal.
  console.log(`  [${f.filePath}:${f.line}](${f.link}) — ${label}`);
  if (f.severity === 'ERROR' || f.severity === 'WARNING') {
    hasBlocker = true;
  }
}

console.log('');
if (hasBlocker) {
  console.error(`Semgrep SAST: FAILED (${findings.filter((f) => f.severity === 'ERROR' || f.severity === 'WARNING').length} blocking finding(s))`);
  process.exit(1);
} else {
  console.log('Semgrep SAST: PASSED (INFO-only findings — no blockers)');
  process.exit(0);
}
