#!/usr/bin/env node
// precommit-fast.mjs — fast pre-commit checks, target <5 seconds total
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const start = Date.now();
let warnings = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
}

function warn(label, detail) {
  console.warn(`  ⚠ ${label}${detail ? `: ${detail}` : ''}`);
  warnings++;
}

function getStagedFiles() {
  if (process.env.STAGED_FILES) {
    return process.env.STAGED_FILES.split('\n').filter(Boolean);
  }
  const result = spawnSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  return result.stdout.split('\n').filter(Boolean);
}

const staged = getStagedFiles();
const stagedTs = staged.filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.mts'));
const stagedMd = staged.filter(f => f.endsWith('.md'));
const stagedJson = staged.filter(f => f.endsWith('.json'));

// 1. Circular imports via madge (only if installed and TS files staged)
if (stagedTs.length > 0) {
  const madgeBin = join('node_modules', '.bin', 'madge');
  if (existsSync(madgeBin)) {
    const result = spawnSync(madgeBin, ['--circular', '--extensions', 'ts,tsx', 'src'], { encoding: 'utf8' });
    if (result.stdout && result.stdout.includes('Found')) {
      warn('circular imports detected', result.stdout.trim().split('\n')[0]);
    } else {
      ok('no circular imports');
    }
  } else {
    ok('madge not installed — circular import check skipped');
  }
}

// 2. TODO/FIXME in staged TS files (warning only)
if (stagedTs.length > 0) {
  const hits = [];
  for (const file of stagedTs) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/TODO|FIXME/.test(line)) {
        hits.push(`${file}:${i + 1}`);
      }
    });
  }
  if (hits.length > 0) {
    warn(`TODO/FIXME found in staged files`, hits.slice(0, 3).join(', ') + (hits.length > 3 ? ` (+${hits.length - 3} more)` : ''));
  } else {
    ok('no TODO/FIXME in staged TS files');
  }
}

// 3. Validate guides.json if staged
const guidesJsonStaged = stagedJson.find(f => f === 'guides.json' || f.endsWith('/guides.json'));
if (guidesJsonStaged) {
  try {
    JSON.parse(readFileSync(guidesJsonStaged, 'utf8'));
    ok('guides.json is valid JSON');
  } catch (e) {
    warn('guides.json parse error', e.message);
  }
}

// 4. Frontmatter validation in staged .md files
if (stagedMd.length > 0) {
  const required = ['title', 'description'];
  const missing = [];
  for (const file of stagedMd) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf8');
    if (!content.startsWith('---')) continue; // no frontmatter block, skip
    const end = content.indexOf('---', 3);
    if (end === -1) {
      missing.push(`${file} (unclosed frontmatter)`);
      continue;
    }
    const frontmatter = content.slice(3, end);
    for (const field of required) {
      if (!new RegExp(`^${field}:`, 'm').test(frontmatter)) {
        missing.push(`${file} (missing: ${field})`);
      }
    }
  }
  if (missing.length > 0) {
    warn('frontmatter missing required fields', missing.slice(0, 3).join(', '));
  } else {
    ok('frontmatter valid in staged .md files');
  }
}

// 5. console.log in staged TS files (warning only, allow console.error/warn)
if (stagedTs.length > 0) {
  const hits = [];
  for (const file of stagedTs) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // Match console.log but not console.error or console.warn
      if (/console\.log\s*\(/.test(line)) {
        hits.push(`${file}:${i + 1}`);
      }
    });
  }
  if (hits.length > 0) {
    warn('console.log found in staged TS files', hits.slice(0, 3).join(', ') + (hits.length > 3 ? ` (+${hits.length - 3} more)` : ''));
  } else {
    ok('no console.log in staged TS files');
  }
}

const elapsed = ((Date.now() - start) / 1000).toFixed(2);
if (warnings > 0) {
  console.warn(`\n  precommit-fast: ${warnings} warning(s) — ${elapsed}s`);
} else {
  console.log(`\n  precommit-fast: all checks passed — ${elapsed}s`);
}
