/**
 * Badge Parser Test Script
 * ========================
 * 
 * Tests the badge detection system against Johnson's DD214 data
 * Validates that Combat Action Badge and other skill badges are detected
 * 
 * Run: node scripts/test-badge-parser.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ============================================================================
// INLINE BADGE DATABASE (subset for testing)
// ============================================================================

const ARMY_BADGES = [
  {
    id: 'combat-infantryman-badge',
    name: 'Combat Infantryman Badge',
    shortName: 'CIB',
    aliases: ['CIB', 'COMBAT INFANTRYMAN BADGE', 'COMBAT INFANTRY BADGE'],
    combatIndicator: true,
    branch: ['Army'],
  },
  {
    id: 'combat-action-badge',
    name: 'Combat Action Badge',
    shortName: 'CAB',
    aliases: ['CAB', 'COMBAT ACTION BADGE'],
    combatIndicator: true,
    branch: ['Army'],
  },
  {
    id: 'combat-medical-badge',
    name: 'Combat Medical Badge',
    shortName: 'CMB',
    aliases: ['CMB', 'COMBAT MEDICAL BADGE', 'COMBAT MEDIC BADGE'],
    combatIndicator: true,
    branch: ['Army'],
  },
  {
    id: 'parachutist-badge',
    name: 'Parachutist Badge',
    shortName: 'Jump Wings',
    aliases: ['PARACHUTIST', 'JUMP WINGS', 'AIRBORNE', 'BASIC PARACHUTIST', 'PARACHUTIST BADGE'],
    combatIndicator: false,
    branch: ['Army', 'Air Force', 'Navy', 'Marines'],
  },
  {
    id: 'air-assault-badge',
    name: 'Air Assault Badge',
    shortName: 'Air Assault',
    aliases: ['AIR ASSAULT', 'AIR ASSAULT BADGE', 'AASLT'],
    combatIndicator: false,
    branch: ['Army'],
  },
  {
    id: 'ranger-tab',
    name: 'Ranger Tab',
    shortName: 'Ranger',
    aliases: ['RANGER', 'RANGER TAB', 'RGR'],
    group: 'tab',
    combatIndicator: false,
    branch: ['Army'],
  },
  {
    id: 'special-forces-tab',
    name: 'Special Forces Tab',
    shortName: 'SF Tab',
    aliases: ['SPECIAL FORCES', 'SF TAB', 'GREEN BERET'],
    group: 'tab',
    combatIndicator: false,
    branch: ['Army'],
  },
  {
    id: 'expert-marksmanship-rifle',
    name: 'Expert Marksmanship Badge (Rifle)',
    shortName: 'Expert Rifle',
    aliases: ['EXPERT RIFLE', 'EXPERT MARKSMAN RIFLE', 'RIFLE EXPERT'],
    group: 'marksmanship',
    combatIndicator: false,
    branch: ['Army'],
  },
];

// ============================================================================
// BADGE PARSER FUNCTION
// ============================================================================

function parseDD214Badges(rawText, branch = 'Army') {
  if (!rawText || typeof rawText !== 'string') {
    return { badges: [], combatIndicators: [] };
  }
  
  // Clean the text
  let cleanedText = rawText
    .replace(/\([^)]*\)/g, ' ')  // Remove parenthetical
    .replace(/[a-z]{3,}/g, ' ')  // Remove lowercase words
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  
  const foundBadges = [];
  const combatIndicators = [];
  const processedIds = new Set();
  
  // Search all badges
  for (const badge of ARMY_BADGES) {
    // Check if badge applies to this branch
    if (!badge.branch.includes(branch)) continue;
    
    let matched = false;
    
    // Check main name
    if (cleanedText.includes(badge.name.toUpperCase())) {
      matched = true;
    }
    
    // Check aliases
    if (!matched && badge.aliases) {
      for (const alias of badge.aliases) {
        if (cleanedText.includes(alias)) {
          matched = true;
          break;
        }
      }
    }
    
    if (matched && !processedIds.has(badge.id)) {
      processedIds.add(badge.id);
      foundBadges.push(badge);
      
      if (badge.combatIndicator) {
        combatIndicators.push(badge.name);
      }
    }
  }
  
  return {
    badges: foundBadges,
    combatIndicators,
  };
}

// ============================================================================
// TEST DATA - Johnson's Afghanistan DD214 Awards
// ============================================================================

const JOHNSON_TF3_AWARDS = `
ARMY ACHIEVEMENT MEDAL
ARMY RESERVE COMPONENTS ACHIEVEMENT MEDAL
NATIONAL DEFENSE SERVICE RIBBON
AFGHANISTAN CAMPAIGN MEDAL
GLOBAL WAR ON TERRORISM EXPEDITIONARY MEDAL
GLOBAL WAR ON TERRORISM SERVICE MEDAL
ARMED FORCES RESERVE MEDAL
NCO PROFESSIONAL DEVELOPMENT RIBBON
ARMY SERVICE RIBBON
OVERSEAS SERVICE RIBBON
MULTINATIONAL FORCES AND OBSERVERS MEDAL
COMBAT ACTION BADGE
`;

const JOHNSON_TF5_AWARDS = `
ARMY ACHIEVEMENT MEDAL
ARMY RESERVE COMPONENTS ACHIEVEMENT MEDAL
NATIONAL DEFENSE SERVICE RIBBON
AFGHANISTAN CAMPAIGN MEDAL
GLOBAL WAR ON TERRORISM EXPEDITIONARY MEDAL
GLOBAL WAR ON TERRORISM SERVICE MEDAL
NCO PROFESSIONAL DEVELOPMENT RIBBON
ARMY SERVICE RIBBON
ARMED FORCES RESERVE MEDAL
MULTINATIONAL FORCE AND OBSERVERS MEDAL
COMBAT ACTION BADGE
`;

// Test with fake "full resume" veteran awards
const SPECIAL_OPS_AWARDS = `
COMBAT INFANTRYMAN BADGE
RANGER TAB
SPECIAL FORCES TAB
PARACHUTIST BADGE
AIR ASSAULT BADGE
EXPERT RIFLE MARKSMAN
BRONZE STAR MEDAL
`;

// ============================================================================
// RUN TESTS
// ============================================================================

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║       BADGE PARSER TEST - Johnson DD214 Badge Detection          ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

// Test 1: TF Phoenix III (Afghanistan)
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ TEST 1: Johnson TF Phoenix III (Afghanistan Combat Deployment)   │');
console.log('└──────────────────────────────────────────────────────────────────┘');

const tf3Results = parseDD214Badges(JOHNSON_TF3_AWARDS, 'Army');

console.log('\n📋 Awards Text (cleaned):');
console.log('   ' + JOHNSON_TF3_AWARDS.replace(/\n/g, ', ').substring(0, 100) + '...');

console.log('\n🎖️  Badges Detected:');
tf3Results.badges.forEach(b => {
  const combat = b.combatIndicator ? ' ⚔️ COMBAT' : '';
  console.log(`   - ${b.name} (${b.shortName})${combat}`);
});

console.log('\n⚔️  Combat Indicators:', tf3Results.combatIndicators);

const tf3HasCAB = tf3Results.badges.some(b => b.id === 'combat-action-badge');
console.log(`\n✅ Combat Action Badge Detected: ${tf3HasCAB ? 'YES ✓' : 'NO ✗'}`);

// Test 2: TF Phoenix V (Afghanistan)
console.log('\n┌──────────────────────────────────────────────────────────────────┐');
console.log('│ TEST 2: Johnson TF Phoenix V (Second Afghanistan Deployment)     │');
console.log('└──────────────────────────────────────────────────────────────────┘');

const tf5Results = parseDD214Badges(JOHNSON_TF5_AWARDS, 'Army');

console.log('\n🎖️  Badges Detected:');
tf5Results.badges.forEach(b => {
  const combat = b.combatIndicator ? ' ⚔️ COMBAT' : '';
  console.log(`   - ${b.name} (${b.shortName})${combat}`);
});

const tf5HasCAB = tf5Results.badges.some(b => b.id === 'combat-action-badge');
console.log(`\n✅ Combat Action Badge Detected: ${tf5HasCAB ? 'YES ✓' : 'NO ✗'}`);

// Test 3: Full Special Ops Resume (comprehensive test)
console.log('\n┌──────────────────────────────────────────────────────────────────┐');
console.log('│ TEST 3: Comprehensive Badge Detection (All Badge Types)          │');
console.log('└──────────────────────────────────────────────────────────────────┘');

const specialOpsResults = parseDD214Badges(SPECIAL_OPS_AWARDS, 'Army');

console.log('\n🎖️  Badges Detected:');
specialOpsResults.badges.forEach(b => {
  const combat = b.combatIndicator ? ' ⚔️ COMBAT' : '';
  const tab = b.group === 'tab' ? ' 📛 TAB' : '';
  const marks = b.group === 'marksmanship' ? ' 🎯 MARKSMANSHIP' : '';
  console.log(`   - ${b.name} (${b.shortName})${combat}${tab}${marks}`);
});

const expectedBadges = ['combat-infantryman-badge', 'ranger-tab', 'special-forces-tab', 'parachutist-badge', 'air-assault-badge'];
const detectedIds = new Set(specialOpsResults.badges.map(b => b.id));
const missingBadges = expectedBadges.filter(id => !detectedIds.has(id));

console.log('\n📊 Detection Results:');
console.log(`   Expected: ${expectedBadges.length} badges`);
console.log(`   Detected: ${specialOpsResults.badges.length} badges`);
console.log(`   Missing:  ${missingBadges.length} badges`);

if (missingBadges.length > 0) {
  console.log(`   ❌ Missing: ${missingBadges.join(', ')}`);
} else {
  console.log('   ✅ All expected badges detected!');
}

// Summary
console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║                         TEST SUMMARY                              ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');

const tests = [
  { name: 'TF Phoenix III CAB Detection', passed: tf3HasCAB },
  { name: 'TF Phoenix V CAB Detection', passed: tf5HasCAB },
  { name: 'Comprehensive Badge Detection', passed: missingBadges.length === 0 },
  { name: 'Combat Indicators Flagged', passed: tf3Results.combatIndicators.length > 0 },
];

let passed = 0;
let failed = 0;

tests.forEach(test => {
  const status = test.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${test.name}`);
  if (test.passed) passed++;
  else failed++;
});

console.log(`\n📊 SCORE: ${passed}/${tests.length} tests passed (${Math.round(passed/tests.length*100)}%)`);

if (failed === 0) {
  console.log('\n🎉 ALL BADGE PARSER TESTS PASSED!');
  console.log('   Combat Action Badge detection is working correctly.');
  console.log('   Tabs (Ranger, SF) are being detected.');
  console.log('   Combat indicators are being flagged for VA claims.');
} else {
  console.log(`\n⚠️  ${failed} test(s) failed. Review badge aliases.`);
  process.exit(1);
}

console.log('\n');
