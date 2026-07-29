#!/usr/bin/env node
/**
 * Pre-build Script: Dynamic Documentation Generator
 * 
 * This script runs BEFORE the build to inject dynamic values into static files
 * (README.md, HTML files) so they reflect actual data counts, not hardcoded lies.
 * 
 * Diamond Standard: Documentation must match reality.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the actual disability data
const disabilityDataPath = path.join(__dirname, '../src/data/disabilityData.json');
const disabilityData = JSON.parse(fs.readFileSync(disabilityDataPath, 'utf8'));

// Load toolkit data for tool count
const toolkitDataPath = path.join(__dirname, '../src/data/toolkitData.js');
const toolkitDataContent = fs.readFileSync(toolkitDataPath, 'utf8');

// Compute the real counts
const DISABILITY_COUNT = disabilityData.disabilities ? disabilityData.disabilities.length : disabilityData.length;

// Parse tool count from toolkitData.js (count tools in TOOLKIT_CATEGORIES array)
const toolMatches = toolkitDataContent.match(/name:\s*['"]([^'"]+)['"]/g);
const TOOL_COUNT = toolMatches ? toolMatches.length : 39; // Fallback to 39 if parsing fails

console.log(`[pre-build] 💎 Actual disability count: ${DISABILITY_COUNT}`);
console.log(`[pre-build] 🛠️  Actual tool count: ${TOOL_COUNT}`);

// Files to update
const filesToUpdate = [
  {
    path: path.join(__dirname, '../README.md'),
    replacements: [
      {
        // Smart Search description
        pattern: /Find disabilities by condition name, diagnostic code, or synonyms across \d+ validated conditions/g,
        replacement: `Find disabilities by condition name, diagnostic code, or synonyms across ${DISABILITY_COUNT} validated conditions`
      },
      {
        // VA Disabilities feature
        pattern: /\*\*\d+ VA Disabilities\*\*: Complete coverage/g,
        replacement: `**${DISABILITY_COUNT} VA Disabilities**: Complete coverage`
      },
      {
        // File structure comment
        pattern: /disabilityData\.json\s+# \d+ disabilities/g,
        replacement: `disabilityData.json       # ${DISABILITY_COUNT} disabilities`
      },
      {
        // Features list
        pattern: /Smart Disability Search\*\*: Find any of the \d+ VA-rated conditions/g,
        replacement: `Smart Disability Search**: Find any of the ${DISABILITY_COUNT} VA-rated conditions`
      },
      {
        // Second features mention
        pattern: /\d{1,6} VA Disabilities\*\*: Complete coverage of all body systems with validated rating criteria/g,
        replacement: `${DISABILITY_COUNT} VA Disabilities**: Complete coverage of all body systems with validated rating criteria`
      },
      {
        // Data validation
        pattern: /Data Validation\*\*: \d+ disabilities verified against 38 CFR/g,
        replacement: `Data Validation**: ${DISABILITY_COUNT} disabilities verified against 38 CFR`
      },
      {
        // Cost analysis table
        pattern: /Smart Search \| [\d,]+ hrs \| [\d,]+ \| .+ \| \d+ conditions with synonym matching/g,
        replacement: `Smart Search | 520 hrs | 5,200 | 1 Senior, 1 Mid | ${DISABILITY_COUNT} conditions with synonym matching`
      },
      {
        // Tool count in meta description
        pattern: /\d{1,6} professional tools/g,
        replacement: `${TOOL_COUNT} professional tools`
      },
      {
        // Development sprint validation hours
        pattern: /Data validation \({{DYNAMIC_DISABILITY_COUNT}} disabilities/g,
        replacement: `Data validation (${DISABILITY_COUNT} disabilities`
      },
      {
        // Tool count in section header
        pattern: /The Complete Arsenal: \d+ Professional Tools/g,
        replacement: `The Complete Arsenal: ${TOOL_COUNT} Professional Tools`
      },
      {
        // Tool count in subheader
        pattern: /\*\*\d+ specialized tools\*\*/g,
        replacement: `**${TOOL_COUNT} specialized tools**`
      }
    ]
  },
  {
    path: path.join(__dirname, '../index.html'),
    replacements: [
      {
        pattern: /search \d+ conditions/g,
        replacement: `search ${DISABILITY_COUNT} conditions`
      }
    ]
  },
  {
    path: path.join(__dirname, '../public/support.html'),
    replacements: [
      {
        pattern: /<strong>\d+ validated VA conditions<\/strong>/g,
        replacement: `<strong>${DISABILITY_COUNT} validated VA conditions</strong>`
      }
    ]
  },
  {
    path: path.join(__dirname, '../public/faq.html'),
    replacements: [
      {
        pattern: /<strong>\d+ validated VA disabilities<\/strong>/g,
        replacement: `<strong>${DISABILITY_COUNT} validated VA disabilities</strong>`
      },
      {
        pattern: /database contains <strong>\d+ validated conditions<\/strong>/g,
        replacement: `database contains <strong>${DISABILITY_COUNT} validated conditions</strong>`
      }
    ]
  },
  {
    path: path.join(__dirname, '../src/data/projectStats.json'),
    replacements: [
      {
        pattern: /"validation_count": "{{DYNAMIC_DISABILITY_COUNT}}"/g,
        replacement: `"validation_count": "${DISABILITY_COUNT}"`
      },
      {
        pattern: /"validation_count_numeric": "{{DYNAMIC_DISABILITY_COUNT}}"/g,
        replacement: `"validation_count_numeric": ${DISABILITY_COUNT}`
      }
    ]
  }
];

// Apply replacements
let filesUpdated = 0;
let totalReplacements = 0;

filesToUpdate.forEach(file => {
  try {
    if (!fs.existsSync(file.path)) {
      console.log(`[pre-build] ⚠️  File not found: ${file.path}`);
      return;
    }

    let content = fs.readFileSync(file.path, 'utf8');
    let fileReplacements = 0;

    file.replacements.forEach(({ pattern, replacement }) => {
      const matches = content.match(pattern);
      if (matches) {
        content = content.replace(pattern, replacement);
        fileReplacements += matches.length;
      }
    });

    if (fileReplacements > 0) {
      fs.writeFileSync(file.path, content, 'utf8');
      console.log(`[pre-build] ✅ Updated ${path.basename(file.path)}: ${fileReplacements} replacements`);
      filesUpdated++;
      totalReplacements += fileReplacements;
    }
  } catch (error) {
    console.error(`[pre-build] ❌ Error updating ${file.path}:`, error.message);
  }
});

console.log(`\n[pre-build] 🎯 Summary: Updated ${filesUpdated} files with ${totalReplacements} dynamic values`);
console.log(`[pre-build] 💎 Diamond Standard: Documentation now matches reality (${DISABILITY_COUNT} conditions)\n`);

process.exit(0);
