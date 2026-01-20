/**
 * Version Sync Script
 * 
 * Automatically syncs version from package.json to:
 * - public/version.json
 * 
 * This runs as part of the build process to ensure version consistency.
 * 
 * Usage: node scripts/sync-version.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Read package.json
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Get current date in YYYY-MM-DD format
const today = new Date().toISOString().split('T')[0];

// ═══════════════════════════════════════════════════════════════════════════════
// Update public/version.json
// ═══════════════════════════════════════════════════════════════════════════════
const versionJsonPath = path.join(rootDir, 'public', 'version.json');

try {
  // Read existing version.json to preserve other fields
  let versionJson = {};
  if (fs.existsSync(versionJsonPath)) {
    versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
  }
  
  // Update version and date
  versionJson.version = version;
  versionJson.updateDate = today;
  
  // Ensure required fields exist
  if (!versionJson.maintenance_mode) versionJson.maintenance_mode = false;
  if (!versionJson.changelog) versionJson.changelog = [];
  
  // Write back
  fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2));
  console.log(`✅ public/version.json updated to v${version}`);
} catch (err) {
  console.error('❌ Failed to update public/version.json:', err.message);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Update src/utils/version.js LAST_UPDATE_DATE
// ═══════════════════════════════════════════════════════════════════════════════
const versionJsPath = path.join(rootDir, 'src', 'utils', 'version.js');

try {
  let versionJs = fs.readFileSync(versionJsPath, 'utf8');
  
  // Update LAST_UPDATE_DATE
  const dateRegex = /export const LAST_UPDATE_DATE = '[^']+';/;
  if (dateRegex.test(versionJs)) {
    versionJs = versionJs.replace(dateRegex, `export const LAST_UPDATE_DATE = '${today}';`);
    fs.writeFileSync(versionJsPath, versionJs);
    console.log(`✅ src/utils/version.js LAST_UPDATE_DATE updated to ${today}`);
  }
} catch (err) {
  console.error('❌ Failed to update src/utils/version.js:', err.message);
  // Don't exit - this is non-critical
}

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('        Version Sync Complete');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`📦 Version: ${version}`);
console.log(`📅 Date: ${today}`);
console.log('');
console.log('Version is now synced to:');
console.log('  • package.json (source of truth)');
console.log('  • public/version.json');
console.log('  • src/utils/version.js (via import)');
console.log('═══════════════════════════════════════════════════════════════');
