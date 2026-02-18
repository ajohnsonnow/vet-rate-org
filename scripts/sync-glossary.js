/**
 * GLOSSARY SYNC SCRIPT
 * 
 * Automatically synchronizes VA glossary terms from vaGlossary.js 
 * to UserManual.jsx glossary section.
 * 
 * This ensures the User Manual stays up-to-date with all VA terminology
 * as new terms are added to the codebase.
 * 
 * Usage:
 *   node scripts/sync-glossary.js          # Preview changes
 *   node scripts/sync-glossary.js --write  # Apply changes
 * 
 * Runs automatically as part of pre-deploy-check.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

// Try active path first, then deprecated path
const GLOSSARY_SOURCE_ACTIVE = path.join(rootDir, 'src/utils/vaGlossary.js');
const GLOSSARY_SOURCE_DEPRECATED = path.join(rootDir, 'src/_deprecated/utils/vaGlossary.js');
const GLOSSARY_SOURCE = fs.existsSync(GLOSSARY_SOURCE_ACTIVE) ? GLOSSARY_SOURCE_ACTIVE : GLOSSARY_SOURCE_DEPRECATED;
const USER_MANUAL_PATH = path.join(rootDir, 'src/components/UserManual.jsx');

// Terms to exclude (duplicates or alternate forms already handled)
const EXCLUDE_TERMS = [
  'C&P Exam',     // Same as C&P
  'Nexus',        // Same as NEXUS
  'IU',           // Same as TDIU
];

// Category mappings for alphabetical organization
const getCategoryLetter = (term) => {
  const first = term.charAt(0).toUpperCase();
  if (/[A-C]/.test(first) || term.startsWith('C&P') || term.startsWith('CFR')) return 'A-C';
  if (/[D-I]/.test(first)) return 'D-I';
  if (/[J-M]/.test(first)) return 'J-M';
  if (/[N-S]/.test(first)) return 'N-S';
  if (/[T-Z]/.test(first) || /^\d/.test(term)) return 'T-Z';
  return 'Other';
};

// ═══════════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════════

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse VA_GLOSSARY from vaGlossary.js
 * @returns {Map<string, string>} Term -> Definition map
 */
function parseGlossarySource() {
  const content = fs.readFileSync(GLOSSARY_SOURCE, 'utf8');
  const glossary = new Map();
  
  // Match all 'Term': 'Definition' patterns
  const regex = /'([^']+)':\s*['"`]([^'"`]+)['"`]/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const term = match[1];
    const definition = match[2];
    
    // Skip excluded terms
    if (EXCLUDE_TERMS.includes(term)) continue;
    
    // Skip if we already have this term (handle duplicates)
    if (!glossary.has(term)) {
      glossary.set(term, definition);
    }
  }
  
  return glossary;
}

/**
 * Generate markdown glossary content organized alphabetically
 * @param {Map<string, string>} glossary 
 * @returns {string} Markdown content
 */
function generateGlossaryMarkdown(glossary) {
  // Organize by category
  const categories = {
    'A-C': [],
    'D-I': [],
    'J-M': [],
    'N-S': [],
    'T-Z': [],
  };
  
  for (const [term, definition] of glossary) {
    const category = getCategoryLetter(term);
    if (categories[category]) {
      // Truncate long definitions for readability
      const shortDef = definition.length > 120 
        ? definition.substring(0, 117) + '...'
        : definition;
      categories[category].push({ term, definition: shortDef });
    }
  }
  
  // Sort each category alphabetically
  for (const cat of Object.keys(categories)) {
    categories[cat].sort((a, b) => a.term.localeCompare(b.term));
  }
  
  // Generate markdown
  let markdown = `Common VA claims terminology. Auto-generated from vaGlossary.js (${glossary.size} terms).

`;
  
  for (const [category, terms] of Object.entries(categories)) {
    if (terms.length === 0) continue;
    
    markdown += `## ${category}\n\n`;
    
    for (const { term, definition } of terms) {
      markdown += `- **${term}** - ${definition}\n`;
    }
    
    markdown += '\n';
  }
  
  // Add note about full glossary
  markdown += `## Full Glossary

For the complete glossary with ${glossary.size}+ terms, hover over highlighted VA terms throughout the app to see tooltips.
`;
  
  return markdown;
}

/**
 * Update UserManual.jsx with new glossary content
 * @param {string} newGlossaryContent 
 * @param {boolean} write - Actually write to file
 * @returns {object} { changed: boolean, oldCount: number, newCount: number }
 */
function updateUserManual(newGlossaryContent, write = false) {
  const content = fs.readFileSync(USER_MANUAL_PATH, 'utf8');
  
  // Find the glossary section in pageContent
  const glossaryRegex = /(glossary:\s*\{\s*title:\s*'Glossary',\s*content:\s*`)([^`]*?)(`\s*,?\s*\})/s;
  const match = content.match(glossaryRegex);
  
  if (!match) {
    log('❌ Could not find glossary section in UserManual.jsx', 'red');
    return { changed: false, error: 'Section not found' };
  }
  
  const oldContent = match[2];
  const oldTermCount = (oldContent.match(/\*\*[A-Za-z0-9&\s-]+\*\*/g) || []).length;
  const newTermCount = (newGlossaryContent.match(/\*\*[A-Za-z0-9&\s-]+\*\*/g) || []).length;
  
  // Check if content changed (normalize whitespace for comparison)
  const normalizeWs = (s) => s.replace(/\s+/g, ' ').trim();
  const changed = normalizeWs(oldContent) !== normalizeWs(newGlossaryContent);
  
  if (!changed) {
    return { changed: false, oldCount: oldTermCount, newCount: newTermCount };
  }
  
  if (write) {
    const newContent = content.replace(
      glossaryRegex,
      `$1\n${newGlossaryContent}    $3`
    );
    fs.writeFileSync(USER_MANUAL_PATH, newContent, 'utf8');
    log(`✅ Updated glossary in UserManual.jsx (${oldTermCount} → ${newTermCount} terms)`, 'green');
  }
  
  return { changed: true, oldCount: oldTermCount, newCount: newTermCount };
}

/**
 * Main sync function
 * @param {boolean} write - Actually write changes
 * @returns {object} Result object for pre-deploy integration
 */
export function syncGlossary(write = false) {
  log('\n📚 Glossary Sync Check', 'cyan');
  log('─'.repeat(50));
  
  try {
    // Parse source glossary
    const glossary = parseGlossarySource();
    log(`   Found ${glossary.size} terms in vaGlossary.js`);
    
    // Generate markdown
    const markdown = generateGlossaryMarkdown(glossary);
    
    // Update user manual
    const result = updateUserManual(markdown, write);
    
    if (result.error) {
      return { success: false, error: result.error };
    }
    
    if (result.changed) {
      if (write) {
        log(`   ✅ Glossary updated: ${result.oldCount} → ${result.newCount} terms`, 'green');
      } else {
        log(`   ⚠️  Glossary needs update: ${result.oldCount} → ${result.newCount} terms`, 'yellow');
        log(`   Run with --write to apply changes`, 'yellow');
      }
    } else {
      log(`   ✅ Glossary is up-to-date (${result.newCount} terms)`, 'green');
    }
    
    return {
      success: true,
      changed: result.changed,
      sourceTerms: glossary.size,
      manualTerms: result.newCount,
    };
    
  } catch (error) {
    log(`   ❌ Error syncing glossary: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI Entry Point
// ═══════════════════════════════════════════════════════════════════════════════

if (process.argv[1].includes('sync-glossary')) {
  const write = process.argv.includes('--write');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('        📚 VA GLOSSARY SYNC');
  console.log('        Vet-Rate.org User Manual Updater');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const result = syncGlossary(write);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  
  if (result.success) {
    if (result.changed && !write) {
      log('  ⚠️  GLOSSARY OUT OF SYNC - run with --write to update', 'yellow');
      process.exit(1);
    } else {
      log('  ✅ GLOSSARY SYNC COMPLETE', 'green');
    }
  } else {
    log(`  ❌ GLOSSARY SYNC FAILED: ${result.error}`, 'red');
    process.exit(1);
  }
  
  console.log('═══════════════════════════════════════════════════════════════\n');
}
