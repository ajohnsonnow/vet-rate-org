#!/usr/bin/env node
/**
 * Hardcoded Number Validator
 * 
 * Scans codebase for suspicious hardcoded numbers that should be dynamic.
 * Run this before commits to ensure Diamond Standard compliance.
 * 
 * Usage: node scripts/validate-no-hardcodes.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load actual data to compare against
const disabilityDataPath = path.join(__dirname, '../src/data/disabilityData.json');
const disabilityData = JSON.parse(fs.readFileSync(disabilityDataPath, 'utf8'));
const ACTUAL_DISABILITY_COUNT = disabilityData.disabilities ? disabilityData.disabilities.length : disabilityData.length;

// Patterns that indicate hardcoded counts that should be dynamic
const SUSPICIOUS_PATTERNS = [
  {
    pattern: /\b(74\d|75\d)\s+(condition|disability|disabilities)/gi,
    name: 'Disability Count',
    actual: ACTUAL_DISABILITY_COUNT,
    exemptions: [
      'disabilityCount.js', // The utility itself
      'update-docs.js',     // Build script
      'HARDCODED_NUMBERS_AUDIT.md', // This audit document
      'README.md',           // Managed by build script
      'index.html',          // Managed by build script
      'support.html',        // Managed by build script
      'faq.html'             // Managed by build script
    ]
  },
  {
    pattern: /\b(3\d|4\d)\s+(tool|professional tool)/gi,
    name: 'Tool Count',
    actual: 'DYNAMIC (getTotalToolCount())',
    exemptions: [
      'toolkitData.js',
      'update-docs.js',
      'HARDCODED_NUMBERS_AUDIT.md',
      'README.md',           // Managed by build script
      'index.html',          // Managed by build script
      'support.html',        // Managed by build script
      'faq.html'             // Managed by build script
    ]
  },
  {
    pattern: /\b(1[5-9]|20)\s+FORMS?\b/gi,
    name: 'Forms Count',
    actual: 'DYNAMIC (getFormsCount())',
    exemptions: [
      'formsCount.js',
      'HARDCODED_NUMBERS_AUDIT.md',
      'Oral-Dental.pdf'     // Binary file, text extraction artifact
    ]
  },
  {
    pattern: /\b(4\d{2}|5\d{2})\s+secondary/gi,
    name: 'Secondary Conditions Count',
    actual: 'DYNAMIC (should use getSecondaryCount())',
    exemptions: [
      'HARDCODED_NUMBERS_AUDIT.md'
    ]
  }
];

// Files to scan
const SCAN_PATHS = [
  'src/components',
  'src/utils',
  'src/data',
  'public',
  'README.md',
  'index.html'
];

// Files to always skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.backup/,
  /\.json$/,  // JSON data files are source of truth
  /llm-compiler/,
  /archive/,
  /dist/,
  /\.min\./
];

const violations = [];
let filesScanned = 0;

function scanFile(filePath) {
  if (SKIP_PATTERNS.some(pattern => pattern.test(filePath))) {
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    filesScanned++;

    SUSPICIOUS_PATTERNS.forEach(({ pattern, name, actual, exemptions }) => {
      // Skip if file is exempted
      if (exemptions.some(exempt => filePath.includes(exempt))) {
        return;
      }

      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          violations.push({
            file: filePath,
            issue: name,
            found: match,
            expected: `Use dynamic function (actual: ${actual})`,
            line: getLineNumber(content, match)
          });
        });
      }
    });
  } catch (error) {
    // Skip files that can't be read
  }
}

function getLineNumber(content, searchString) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(searchString)) {
      return i + 1;
    }
  }
  return '?';
}

function scanDirectory(dirPath) {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  
  items.forEach(item => {
    const fullPath = path.join(dirPath, item.name);
    
    if (item.isDirectory()) {
      scanDirectory(fullPath);
    } else {
      scanFile(fullPath);
    }
  });
}

// Run the scan
console.log('🔍 Scanning for hardcoded numbers that should be dynamic...\n');

SCAN_PATHS.forEach(scanPath => {
  const fullPath = path.join(__dirname, '..', scanPath);
  if (fs.existsSync(fullPath)) {
    if (fs.statSync(fullPath).isDirectory()) {
      scanDirectory(fullPath);
    } else {
      scanFile(fullPath);
    }
  }
});

// Report results
console.log(`📊 Scanned ${filesScanned} files\n`);

if (violations.length === 0) {
  console.log('✅ No hardcoded numbers found! Diamond Standard maintained.\n');
  process.exit(0);
} else {
  console.log(`❌ Found ${violations.length} hardcoded number(s):\n`);
  
  violations.forEach((v, i) => {
    console.log(`${i + 1}. ${v.file}:${v.line}`);
    console.log(`   Issue: ${v.issue}`);
    console.log(`   Found: "${v.found}"`);
    console.log(`   Expected: ${v.expected}\n`);
  });
  
  console.log('💡 Fix these before committing. See HARDCODED_NUMBERS_AUDIT.md for guidance.\n');
  process.exit(1);
}
