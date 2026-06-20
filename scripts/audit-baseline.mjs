#!/usr/bin/env node
// audit-baseline.mjs — capture baseline project metrics to docs/audit-pipeline/
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const cwd = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = join(cwd, 'docs', 'audit-pipeline');

function run(cmd, args = [], opts = {}) {
  const fullCmd = [cmd, ...args].join(' ');
  try {
    const stdout = execSync(fullCmd, { encoding: 'utf8', cwd, stdio: ['pipe', 'pipe', 'pipe'], ...opts });
    return { stdout: stdout.trim(), stderr: '', status: 0 };
  } catch (e) {
    // execSync throws on non-zero exit; stdout still has content (e.g. npm audit with vulns)
    return { stdout: (e.stdout || '').trim(), stderr: (e.stderr || '').trim(), status: e.status || 1 };
  }
}

function countFilesRecursive(dir, predicate) {
  let count = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
      if (entry.isFile() && predicate(entry.name)) count++;
    }
  } catch {
    // ignore inaccessible dirs
  }
  return count;
}

// Detect project type
const projectTypes = [];
if (existsSync(join(cwd, 'package.json'))) projectTypes.push('node/js');
if (existsSync(join(cwd, 'go.mod'))) projectTypes.push('go');
if (readdirSync(cwd).some(f => f.endsWith('.csproj'))) projectTypes.push('dotnet');
if (existsSync(join(cwd, 'requirements.txt')) || existsSync(join(cwd, 'pyproject.toml'))) projectTypes.push('python');
if (projectTypes.length === 0) projectTypes.push('unknown');

console.log(`\nProject type: ${projectTypes.join(', ')}`);
console.log('Gathering baseline metrics...\n');

const metrics = {};

// File counts
metrics.totalFiles = countFilesRecursive(cwd, () => true);
metrics.tsFiles = countFilesRecursive(cwd, f => f.endsWith('.ts') || f.endsWith('.tsx'));
metrics.testFiles = countFilesRecursive(cwd, f => /\.(test|spec)\.(ts|tsx|js|mjs)$/.test(f));
metrics.mdFiles = countFilesRecursive(cwd, f => f.endsWith('.md'));

// Git log
const gitLog = run('git', ['log', '--oneline', '-10']);
metrics.recentCommits = gitLog.stdout || '(no commits)';

// JS-specific metrics
let npmAuditSummary = 'n/a';
let npmOutdatedCount = 'n/a';
let buildStatus = 'n/a';

if (projectTypes.includes('node/js')) {
  // npm audit
  const auditResult = run('npm', ['audit', '--json']);
  if (auditResult.stdout) {
    try {
      const auditJson = JSON.parse(auditResult.stdout);
      const vulns = auditJson.metadata?.vulnerabilities || {};
      const total = Object.values(vulns).reduce((s, n) => s + n, 0);
      npmAuditSummary = total === 0
        ? '0 vulnerabilities'
        : `${total} total — critical: ${vulns.critical || 0}, high: ${vulns.high || 0}, moderate: ${vulns.moderate || 0}, low: ${vulns.low || 0}`;
    } catch {
      npmAuditSummary = 'parse error';
    }
  }

  // npm outdated
  const outdatedResult = run('npm', ['outdated', '--json']);
  try {
    const outdatedJson = JSON.parse(outdatedResult.stdout || '{}');
    const count = Object.keys(outdatedJson).length;
    npmOutdatedCount = `${count} outdated package(s)`;
  } catch {
    npmOutdatedCount = 'parse error';
  }

  // npm run build
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  if (pkg.scripts?.build) {
    const buildResult = run('npm', ['run', 'build', '--if-present']);
    buildStatus = buildResult.status === 0 ? 'success' : `failed (exit ${buildResult.status})`;
  } else {
    buildStatus = 'no build script';
  }
}

// Print console table
const tableData = [
  ['Metric', 'Value'],
  ['Project type', projectTypes.join(', ')],
  ['Total files', String(metrics.totalFiles)],
  ['TypeScript files', String(metrics.tsFiles)],
  ['Test files', String(metrics.testFiles)],
  ['Markdown files', String(metrics.mdFiles)],
  ['npm audit', npmAuditSummary],
  ['npm outdated', npmOutdatedCount],
  ['Build', buildStatus],
];

const colW = tableData.reduce((max, [k]) => Math.max(max, k.length), 0) + 2;
const valW = tableData.reduce((max, [, v]) => Math.max(max, v.length), 0) + 2;
console.log('┌' + '─'.repeat(colW) + '┬' + '─'.repeat(valW) + '┐');
for (const [k, v] of tableData) {
  console.log('│ ' + k.padEnd(colW - 2) + ' │ ' + v.padEnd(valW - 2) + ' │');
  if (k === 'Metric') console.log('├' + '─'.repeat(colW) + '┼' + '─'.repeat(valW) + '┤');
}
console.log('└' + '─'.repeat(colW) + '┴' + '─'.repeat(valW) + '┘');

// Write baseline markdown
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `BASELINE-${timestamp}.md`);

const md = `---
title: Audit Baseline — ${timestamp.replace('T', ' ')}
project_type: ${projectTypes.join(', ')}
captured: ${new Date().toISOString()}
---

# Audit Baseline

Captured: ${new Date().toISOString()}

## File Counts

| Metric | Value |
|---|---|
| Total files | ${metrics.totalFiles} |
| TypeScript files | ${metrics.tsFiles} |
| Test files | ${metrics.testFiles} |
| Markdown files | ${metrics.mdFiles} |

## Dependency Health

| Check | Result |
|---|---|
| npm audit | ${npmAuditSummary} |
| npm outdated | ${npmOutdatedCount} |
| Build | ${buildStatus} |

## Recent Commits

\`\`\`
${metrics.recentCommits}
\`\`\`
`;

writeFileSync(outFile, md, 'utf8');
console.log(`\nBaseline written to: ${outFile}`);
