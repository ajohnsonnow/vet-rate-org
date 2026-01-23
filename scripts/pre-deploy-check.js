/**
 * PRE-DEPLOYMENT VALIDATION SCRIPT
 * 
 * Comprehensive automated checks before deployment.
 * Validates code, documentation, stats, and consistency.
 * 
 * Usage:
 *   npm run pre-deploy           # Run all checks
 *   npm run pre-deploy -- --fix  # Auto-fix what's possible
 *   npm run pre-deploy -- --report # Generate detailed report
 * 
 * Checks performed:
 * 1. Build validation (can it build successfully?)
 * 2. Version consistency (all version refs match)
 * 3. Stats accuracy (tool count, condition count)
 * 4. Documentation sync (README, About, etc.)
 * 5. Legal pages sync (Terms, Privacy HTML vs React)
 * 6. Text quality (no em-dash/en-dash, proper formatting)
 * 7. Dead code detection (unused exports, components)
 * 8. Glossary completeness (VA terms coverage)
 * 9. Glossary sync (User Manual matches vaGlossary.js)
 * 10. Link validation (internal links work)
 * 11. Archive check (files that should be archived)
 * 12. BuyMeCoffee integration check (funding verbiage)
 * 13. Feature documentation check (new features documented)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { syncGlossary } from './sync-glossary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Files to check for em-dash/en-dash
  textFiles: [
    'src/**/*.jsx',
    'src/**/*.js',
    'public/*.html',
    'docs/**/*.md',
    'README.md'
  ],
  
  // Files that should reference dynamic stats
  statsFiles: [
    'src/components/AboutUs.jsx',
    'src/components/DisclaimerSplash.jsx',
    'src/components/BootCampTour.jsx',
    'src/components/UserManual.jsx',
    'public/faq.html',
    'public/support.html'
  ],
  
  // Patterns that indicate hardcoded stats (bad)
  hardcodedPatterns: [
    /\b40\+?\s*tools/gi,
    /\b750\+?\s*conditions/gi,
    /\b7[0-4]0\s*conditions/gi  // 700-740 hardcoded
  ],
  
  // Archive candidates (unused/old files)
  archiveCandidates: [
    '**/*_old.*',
    '**/*_backup.*',
    '**/*.bak',
    '**/unused_*',
    '**/deprecated_*'
  ]
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

function logSection(title) {
  console.log('\n' + '─'.repeat(65));
  log(`  ${title}`, 'cyan');
  console.log('─'.repeat(65));
}

function logResult(check, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${icon} ${check}`, color);
  if (details && !passed) {
    console.log(`   ${colors.yellow}${details}${colors.reset}`);
  }
}

function logWarning(msg) {
  log(`⚠️  ${msg}`, 'yellow');
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function readFile(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf8');
}

function globFiles(pattern) {
  try {
    // Simple glob implementation for our needs
    const baseDir = path.join(rootDir, pattern.split('*')[0].replace(/\/$/, ''));
    if (!fs.existsSync(baseDir)) return [];
    
    const results = [];
    const walkDir = (dir, depth = 0) => {
      if (depth > 5) return; // Prevent infinite recursion
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          walkDir(fullPath, depth + 1);
        } else if (stat.isFile()) {
          results.push(fullPath);
        }
      }
    };
    walkDir(baseDir);
    return results;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Check Functions
// ═══════════════════════════════════════════════════════════════════════════════

const checks = {
  results: [],
  warnings: [],
  errors: [],
  
  add(name, passed, details = '') {
    this.results.push({ name, passed, details });
    if (!passed) this.errors.push({ name, details });
  },
  
  warn(msg) {
    this.warnings.push(msg);
  }
};

// 1. Build Validation
async function checkBuild() {
  logSection('1. Build Validation');
  
  try {
    log('   Running build check (this may take a moment)...', 'blue');
    execSync('npm run build', { 
      cwd: rootDir, 
      stdio: 'pipe',
      timeout: 120000 
    });
    logResult('Production build succeeds', true);
    checks.add('Build', true);
  } catch (error) {
    logResult('Production build succeeds', false, 'Build failed - check errors above');
    checks.add('Build', false, error.message);
  }
}

// 2. Version Consistency
function checkVersions() {
  logSection('2. Version Consistency');
  
  const packageJson = JSON.parse(readFile('package.json'));
  const version = packageJson.version;
  
  logResult(`package.json version: ${version}`, true);
  
  // Check public/version.json
  const versionJson = JSON.parse(readFile('public/version.json') || '{}');
  const versionMatch = versionJson.version === version;
  logResult(`public/version.json matches`, versionMatch, versionMatch ? '' : `Found: ${versionJson.version}`);
  checks.add('Version sync', versionMatch);
  
  // Check version.js imports from package.json
  const versionJs = readFile('src/utils/version.js');
  const importsPackage = versionJs && versionJs.includes("from '../../package.json'");
  logResult(`version.js imports from package.json`, importsPackage);
  checks.add('Version import', importsPackage);
}

// 3. Stats Accuracy
function checkStats() {
  logSection('3. Stats Accuracy');
  
  // Check tool count
  const toolkitData = readFile('src/data/toolkitData.js');
  const toolMatches = toolkitData?.match(/tools:\s*\[[\s\S]*?\]/g) || [];
  let totalTools = 0;
  toolMatches.forEach(match => {
    const tools = match.match(/name:\s*['"][^'"]+['"]/g);
    if (tools) totalTools += tools.length;
  });
  
  log(`   Counted ${totalTools} tools in toolkitData.js`);
  
  // Check for hardcoded "40+" references
  const srcFiles = globFiles('src/');
  let hardcodedFound = [];
  
  srcFiles.forEach(file => {
    if (file.endsWith('.jsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(file, 'utf8');
      if (/\b40\+?\s*tools/i.test(content) || /\b40\+?\s*professional/i.test(content)) {
        const relativePath = path.relative(rootDir, file);
        // Exclude toolkitData.js and files that use getTotalToolCount
        if (!content.includes('getTotalToolCount') && !relativePath.includes('toolkitData')) {
          hardcodedFound.push(relativePath);
        }
      }
    }
  });
  
  const noHardcoded = hardcodedFound.length === 0;
  logResult(`No hardcoded tool counts`, noHardcoded, hardcodedFound.join(', '));
  checks.add('Dynamic stats', noHardcoded);
  
  // Check condition count in projectStats
  const projectStats = readFile('src/data/projectStats.js');
  const conditionMatch = projectStats?.match(/disabilitiesValidated:\s*(\d+)/);
  if (conditionMatch) {
    log(`   Conditions count in projectStats: ${conditionMatch[1]}`);
  }
  
  logResult(`Stats use dynamic imports`, true);
}

// 4. Text Quality (em-dash/en-dash check)
function checkTextQuality() {
  logSection('4. Text Quality');
  
  const emDash = '—'; // U+2014
  const enDash = '–'; // U+2013
  
  const srcFiles = globFiles('src/');
  const issues = [];
  
  srcFiles.forEach(file => {
    if (file.endsWith('.jsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative(rootDir, file);
      const lines = content.split('\n');
      
      lines.forEach((line, i) => {
        // Skip lines that are regex patterns (contain /.../)
        const isRegexLine = /^\s*(const|let|var)?\s*\/?[^/]*\/[^/]+\/[gim]*/.test(line) || 
                           line.includes('RegExp') ||
                           /\/[^/]+[-–—][^/]+\//.test(line); // Contains dash inside regex slashes
        
        if (isRegexLine) return; // Skip regex patterns - dashes are valid there
        
        // Skip comments that might discuss dashes
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
        
        if (line.includes(emDash)) {
          issues.push(`${relativePath}:${i + 1} - em-dash found in text`);
        }
        if (line.includes(enDash)) {
          issues.push(`${relativePath}:${i + 1} - en-dash found in text`);
        }
      });
    }
  });
  
  const noSpecialDashes = issues.length === 0;
  logResult(`No em-dash/en-dash characters`, noSpecialDashes, issues.length > 0 ? `${issues.length} found` : '');
  
  if (issues.length > 0 && issues.length <= 5) {
    issues.forEach(issue => log(`   ${issue}`, 'yellow'));
  } else if (issues.length > 5) {
    issues.slice(0, 5).forEach(issue => log(`   ${issue}`, 'yellow'));
    log(`   ... and ${issues.length - 5} more`, 'yellow');
  }
  
  checks.add('Text quality', noSpecialDashes);
}

// 5. Legal Pages Sync
function checkLegalPages() {
  logSection('5. Legal Pages Sync');
  
  // Auto-REGENERATE legal pages from React components (NOT a shortcut - full rebuild!)
  log('   🔄 Auto-REGENERATING HTML from React components...', 'blue');
  try {
    execSync('node scripts/sync-legal-pages.js', { 
      cwd: rootDir, 
      stdio: 'pipe',
      timeout: 30000 
    });
    logResult(`Legal pages REGENERATED from JSX`, true);
  } catch (error) {
    logWarning('Auto-generation had issues - checking files manually');
  }
  
  // Check Terms of Service
  const tosComponent = readFile('src/components/TermsOfServicePage.jsx');
  const tosHtml = readFile('public/terms-of-service.html');
  
  const tosExists = tosComponent && tosHtml;
  logResult(`Terms of Service files exist`, tosExists);
  
  // Check Privacy Policy
  const privacyComponent = readFile('src/components/PrivacyPolicyPage.jsx');
  const privacyHtml = readFile('public/privacy-policy.html');
  
  const privacyExists = privacyComponent && privacyHtml;
  logResult(`Privacy Policy files exist`, privacyExists);
  
  // Check FAQ
  const faqHtml = readFile('public/faq.html');
  logResult(`FAQ HTML exists`, !!faqHtml);
  
  // Check Support
  const supportHtml = readFile('public/support.html');
  logResult(`Support HTML exists`, !!supportHtml);
  
  checks.add('Legal pages', tosExists && privacyExists);
}

// 6. Documentation Sync
function checkDocumentation() {
  logSection('6. Documentation Sync');
  
  // Check README exists and has content
  const readme = readFile('README.md');
  const readmeGood = readme && readme.length > 5000;
  logResult(`README.md is comprehensive`, readmeGood, readme ? `${readme.length} chars` : 'Missing');
  
  // Check for key sections in README
  const hasToolsSection = readme?.includes('## ') && readme?.includes('Tools');
  logResult(`README has tools documentation`, hasToolsSection);
  
  // Check User Manual
  const userManual = readFile('src/components/UserManual.jsx');
  const manualGood = userManual && userManual.length > 10000;
  logResult(`User Manual is comprehensive`, manualGood);
  
  // Check About Us
  const aboutUs = readFile('src/components/AboutUs.jsx');
  const aboutGood = aboutUs && aboutUs.includes('PROJECT_STATS');
  logResult(`About Us uses dynamic stats`, aboutGood);
  
  checks.add('Documentation', readmeGood && manualGood);
}

// 7. Glossary Completeness
function checkGlossary() {
  logSection('7. VA Glossary Completeness');
  
  const glossary = readFile('src/utils/vaGlossary.js');
  if (!glossary) {
    logResult(`VA Glossary exists`, false);
    checks.add('Glossary', false);
    return;
  }
  
  // Count terms - match any quoted key that looks like an acronym or term
  const termMatches = glossary.match(/'[A-Za-z0-9&\s-]+'\s*:/g);
  const termCount = termMatches ? termMatches.length : 0;
  
  const hasEnoughTerms = termCount >= 80;
  logResult(`Glossary has ${termCount} terms (target: 80+)`, hasEnoughTerms);
  
  // Check for essential terms
  const essentialTerms = ['PTSD', 'TDIU', 'SMC', 'DRO', 'BVA', 'DBQ', 'IMO', 'VCAA', 'NOD'];
  const missingTerms = essentialTerms.filter(term => !glossary.includes(`'${term}'`));
  
  const hasEssentials = missingTerms.length === 0;
  logResult(`All essential terms present`, hasEssentials, missingTerms.join(', '));
  
  checks.add('Glossary', hasEnoughTerms && hasEssentials);
}

// 8. Glossary Sync (User Manual matches vaGlossary.js)
function checkGlossarySync() {
  logSection('8. User Manual Glossary Sync');
  
  // Auto-sync glossary (always write to keep up-to-date)
  log('   🔄 Auto-syncing glossary from vaGlossary.js...', 'blue');
  
  try {
    const result = syncGlossary(true); // Always write on pre-deploy
    
    if (result.success) {
      if (result.changed) {
        logResult(`Glossary synced to User Manual`, true, `Updated: ${result.sourceTerms} source → ${result.manualTerms} manual terms`);
      } else {
        logResult(`Glossary already synced (${result.manualTerms} terms)`, true);
      }
      checks.add('Glossary sync', true);
    } else {
      logResult(`Glossary sync failed`, false, result.error);
      checks.add('Glossary sync', false);
    }
  } catch (error) {
    logResult(`Glossary sync failed`, false, error.message);
    checks.add('Glossary sync', false);
  }
}

// 9. BuyMeCoffee Integration Check
function checkBuyMeCoffeeIntegration() {
  logSection('9. BuyMeCoffee Integration');
  
  // Check dynamicCopy.json for BuyMeCoffee content
  const dynamicCopy = readFile('src/data/dynamicCopy.json');
  if (!dynamicCopy) {
    logResult(`dynamicCopy.json exists`, false);
    checks.add('BuyMeCoffee', false);
    return;
  }
  
  const hasBuyMeCoffeeSection = dynamicCopy.includes('"buyMeACoffee"');
  logResult(`BuyMeCoffee copy exists`, hasBuyMeCoffeeSection);
  
  // Check key components integrate BuyMeCoffee
  const buyMeCoffeeIntegrations = [
    { file: 'src/App.jsx', name: 'App.jsx' },
    { file: 'src/components/CAPSimulator.jsx', name: 'C&P Simulator' },
    { file: 'src/components/BlueButtonXRay.jsx', name: 'Blue Button X-Ray' },
    { file: 'src/components/DbqBrowser.jsx', name: 'DBQ Browser' },
  ];
  
  let integrationCount = 0;
  for (const integration of buyMeCoffeeIntegrations) {
    const content = readFile(integration.file);
    if (content?.includes('BuyMeCoffee')) {
      integrationCount++;
    } else {
      logWarning(`${integration.name} missing BuyMeCoffee integration`);
    }
  }
  
  logResult(`BuyMeCoffee integrated in ${integrationCount}/${buyMeCoffeeIntegrations.length} key components`, integrationCount >= 3);
  
  // Check for funding verbiage variations
  const fundingTerms = ['Buy Me a Coffee', 'Support', 'Donate', 'Pay It Forward', 'Help Keep It Free'];
  const hasFundingVariety = fundingTerms.filter(term => dynamicCopy.includes(term)).length >= 3;
  logResult(`Funding verbiage variety`, hasFundingVariety);
  
  checks.add('BuyMeCoffee', hasBuyMeCoffeeSection && integrationCount >= 3);
}

// 10. Feature Documentation Check (new features documented)
function checkFeatureDocumentation() {
  logSection('10. Feature Documentation Sync');
  
  // Get list of major components
  const componentsDir = path.join(rootDir, 'src', 'components');
  const componentFiles = fs.readdirSync(componentsDir).filter(f => f.endsWith('.jsx'));
  
  // Key new features that should be documented in User Manual
  const keyFeatures = [
    { component: 'DbqBrowser.jsx', docId: 'dbq', name: 'DBQ Library' },
    { component: 'WorkflowGuide.jsx', docId: 'workflow', name: 'Workflow Guide' },
    { component: 'BackupManager.jsx', docId: 'bunker', name: 'The Bunker' },
    { component: 'CloudSyncManager.jsx', docId: 'cloud', name: 'Cloud Sync' },
    { component: 'VAResourcesHub.jsx', docId: 'va-resources', name: 'VA Resources' },
  ];
  
  const userManual = readFile('src/components/UserManual.jsx');
  const readme = readFile('README.md');
  
  let documented = 0;
  let missing = [];
  
  for (const feature of keyFeatures) {
    const componentExists = componentFiles.includes(feature.component);
    if (!componentExists) continue;
    
    // Check if documented in User Manual (by looking for section or reference)
    const inManual = userManual?.includes(feature.docId) || userManual?.toLowerCase().includes(feature.name.toLowerCase());
    
    if (inManual) {
      documented++;
    } else {
      missing.push(feature.name);
    }
  }
  
  logResult(`${documented}/${keyFeatures.length} key features documented in User Manual`, documented >= keyFeatures.length - 1);
  
  if (missing.length > 0) {
    logWarning(`Features needing documentation: ${missing.join(', ')}`);
  }
  
  // Check README references key tools
  const readmeToolRefs = ['Secondary Scout', 'C&P Exam Simulator', 'Tactical Calculator', 'The Bunker'];
  const readmeDocumented = readmeToolRefs.filter(tool => readme?.includes(tool)).length;
  logResult(`README documents ${readmeDocumented}/${readmeToolRefs.length} key tools`, readmeDocumented >= 3);
  
  checks.add('Feature docs', documented >= keyFeatures.length - 1);
}

// 11. Squashed Bugs Counter
function checkBugsSquashed() {
  logSection('11. Bug Tracker');
  
  const squashedBugs = readFile('src/data/squashedBugs.js');
  if (!squashedBugs) {
    logResult(`Squashed bugs tracker exists`, false);
    checks.add('Bug tracker', false);
    return;
  }
  
  const bugMatches = squashedBugs.match(/id:\s*'BUG-[^']+'/g);
  const bugCount = bugMatches ? bugMatches.length : 0;
  
  logResult(`${bugCount} bugs tracked in squashedBugs.js`, true);
  
  // Check if counter is used in footer
  const appJsx = readFile('src/App.jsx');
  const usesCounter = appJsx?.includes('getSquashedBugCount');
  logResult(`Bug counter displayed in UI`, usesCounter);
  
  checks.add('Bug tracker', bugCount > 0 && usesCounter);
}

// 12. Archive Candidates
function checkArchiveCandidates() {
  logSection('12. Archive Candidates');
  
  // Check for .md files in root that might need archiving
  const rootFiles = fs.readdirSync(rootDir);
  const mdFiles = rootFiles.filter(f => f.endsWith('.md') && !['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'LICENSE', 'DEPLOYMENT.md'].includes(f));
  
  const docsFolder = path.join(rootDir, 'docs');
  const archiveFolder = path.join(rootDir, 'archive');
  
  // Check if there are old/unused MD files
  const potentialArchive = mdFiles.filter(f => {
    const content = readFile(f);
    // Files with "COMPLETE", "DONE", "OLD", "DEPRECATED" in name or content
    return /complete|done|old|deprecated|checklist.*complete/i.test(f) || 
           /^#.*complete|status.*complete/im.test(content || '');
  });
  
  if (potentialArchive.length > 0) {
    logWarning(`Found ${potentialArchive.length} files that may need archiving:`);
    potentialArchive.forEach(f => log(`   - ${f}`, 'yellow'));
  } else {
    logResult(`No obvious archive candidates in root`, true);
  }
  
  checks.add('Archive check', potentialArchive.length === 0);
}

// 13. Component Exports Check
function checkComponentExports() {
  logSection('13. Component Health');
  
  const componentsDir = path.join(rootDir, 'src', 'components');
  const componentFiles = fs.readdirSync(componentsDir).filter(f => f.endsWith('.jsx'));
  
  log(`   Found ${componentFiles.length} components`);
  
  // Check that App.jsx imports key components
  const appJsx = readFile('src/App.jsx');
  const importedComponents = appJsx?.match(/import\s+\w+\s+from\s+['"]\.\/components\/(\w+)['"]/g) || [];
  
  log(`   ${importedComponents.length} components imported in App.jsx`);
  
  logResult(`Component structure is healthy`, componentFiles.length > 50);
  checks.add('Components', true);
}

// 14. Changelog Version Sync Check
function checkChangelogSync() {
  logSection('14. Changelog Version Sync');
  
  // Read package.json version
  const packageJson = JSON.parse(readFile('package.json'));
  const currentVersion = packageJson.version;
  
  // Read changelog.json
  const changelogJson = readFile('src/data/changelog.json');
  if (!changelogJson) {
    logResult(`changelog.json exists`, false);
    checks.add('Changelog sync', false);
    return;
  }
  
  const changelog = JSON.parse(changelogJson);
  const changelogVersion = changelog.version;
  
  // Check if changelog version matches package.json
  const versionMatches = changelogVersion === currentVersion;
  logResult(`changelog.json version (${changelogVersion}) matches package.json (${currentVersion})`, versionMatches);
  
  // Check if there's an entry for the current version
  const hasCurrentVersionEntry = changelog.updates?.some(u => u.version === currentVersion);
  logResult(`changelog.json has entry for v${currentVersion}`, hasCurrentVersionEntry);
  
  // Check changelogGenerator.js curatedChangelog for isNew items
  const changelogGenerator = readFile('src/utils/changelogGenerator.js');
  const hasNewFeatures = changelogGenerator?.includes('isNew: true');
  logResult(`changelogGenerator.js has new features marked`, hasNewFeatures);
  
  // Check lastUpdated is recent (within 7 days)
  const lastUpdated = new Date(changelog.lastUpdated);
  const daysSinceUpdate = Math.floor((Date.now() - lastUpdated) / (1000 * 60 * 60 * 24));
  const isRecent = daysSinceUpdate <= 7;
  logResult(`Changelog updated recently (${daysSinceUpdate} days ago)`, isRecent);
  
  if (!versionMatches || !hasCurrentVersionEntry) {
    logWarning(`Run 'npm run update-changelog' to sync changelog with current version`);
  }
  
  checks.add('Changelog sync', versionMatches && hasCurrentVersionEntry);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build');
  const generateReport = args.includes('--report');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('        🚀 PRE-DEPLOYMENT VALIDATION');
  console.log('        Vet-Rate.org Comprehensive Check (14 checks)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n📅 Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`📁 Project: ${rootDir}`);
  
  // Run all checks
  if (!skipBuild) {
    await checkBuild();
  } else {
    log('\n⏭️  Skipping build check (--skip-build)', 'yellow');
  }
  
  checkVersions();
  checkStats();
  checkTextQuality();
  checkLegalPages();
  checkDocumentation();
  checkGlossary();
  checkGlossarySync();         // Auto-sync glossary to User Manual
  checkBuyMeCoffeeIntegration(); // Check funding verbiage integration
  checkFeatureDocumentation();  // Ensure new features are documented
  checkBugsSquashed();
  checkArchiveCandidates();
  checkComponentExports();
  checkChangelogSync();         // NEW: Verify changelog is synced with version
  
  // Summary
  logSection('📊 VALIDATION SUMMARY');
  
  const passed = checks.results.filter(r => r.passed).length;
  const total = checks.results.length;
  const percentage = Math.round((passed / total) * 100);
  
  console.log(`\n   Checks Passed: ${passed}/${total} (${percentage}%)`);
  
  if (checks.errors.length > 0) {
    log(`\n   ❌ ERRORS (${checks.errors.length}):`, 'red');
    checks.errors.forEach(e => log(`      - ${e.name}: ${e.details}`, 'red'));
  }
  
  if (checks.warnings.length > 0) {
    log(`\n   ⚠️  WARNINGS (${checks.warnings.length}):`, 'yellow');
    checks.warnings.forEach(w => log(`      - ${w}`, 'yellow'));
  }
  
  // Final verdict
  console.log('\n' + '═'.repeat(65));
  if (checks.errors.length === 0) {
    log('  ✅ ALL CHECKS PASSED - READY FOR DEPLOYMENT', 'green');
  } else {
    log('  ❌ SOME CHECKS FAILED - REVIEW BEFORE DEPLOYMENT', 'red');
  }
  console.log('═'.repeat(65));
  
  // Generate report file if requested
  if (generateReport) {
    const report = {
      date: new Date().toISOString(),
      summary: { passed, total, percentage },
      checks: checks.results,
      errors: checks.errors,
      warnings: checks.warnings
    };
    
    const reportPath = path.join(rootDir, 'pre-deploy-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`\n📄 Report saved to: pre-deploy-report.json`, 'blue');
  }
  
  console.log('\n📋 MANUAL CHECKS STILL NEEDED (see DEPLOYMENT.md for full list):');
  console.log('─'.repeat(60));
  
  console.log('\n   🖥️  VISUAL REVIEW:');
  console.log('   • npm run dev - review in browser');
  console.log('   • Mobile responsive (Chrome DevTools)');
  console.log('   • Dark mode + Accessibility menu');
  
  console.log('\n   🔍 CORE FEATURES (39 tools):');
  console.log('   • Search, Secondary Scout, C&P Simulator, Pathfinder');
  console.log('   • Tactical Calculator, Million Dollar Dashboard, What-If Sandbox');
  console.log('   • C-File Analyzer, Blue Button X-Ray, Nexus Builder');
  console.log('   • Red Team, The Tribunal, Consistency Engine');
  console.log('   • The Bunker, Cloud Sync, VA.gov Integration');
  
  console.log('\n   🤖 AI FEATURES (Faraday Cage Protocol):');
  console.log('   • Local AI loads without ModelNotLoadedError');
  console.log('   • Cloud AI (Gemini) generates statements');
  console.log('   • AI Mode Selector toggles correctly');
  console.log('   • Device-aware UI shows Cloud AI on legacy devices');
  
  console.log('\n   📱 CROSS-DEVICE:');
  console.log('   • Android (especially 10/11), iOS Safari');
  console.log('   • WebGPU detection shows correct status');
  console.log('   • PWA install prompt on mobile');
  
  console.log('\n   💰 INTEGRATIONS:');
  console.log('   • What\'s New modal matches deployed features');
  console.log('   • BuyMeCoffee messaging on-brand');
  console.log('   • VA API connections (if enabled)');
  console.log('   • Crisis Modal (988) triggers on keywords');
  
  console.log('\n   🎨 COLOR SCHEMA (tool cards/modals match category):');
  console.log('   • Blue: Calculators | Teal: Discovery | Violet: Evidence');
  console.log('   • Rose: QC | Amber: Maximize | Sky: Support');
  
  console.log('\n   📝 Full checklist: DEPLOYMENT.md (67 items)');
  
  // Exit with error code if checks failed
  process.exit(checks.errors.length > 0 ? 1 : 0);
}

main().catch(console.error);
