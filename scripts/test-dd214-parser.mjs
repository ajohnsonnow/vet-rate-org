/**
 * DD214 Parser Test Script
 * Tests the parser against Johnson's known DD214 data
 * 
 * Usage: node --experimental-vm-modules scripts/test-dd214-parser.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Expected data from Johnson's DD214s
const EXPECTED_DATA = {
  name: "JOHNSON, ANTHONY DANIEL",
  branch: "Army",
  component: "National Guard",
  mos: "92Y",
  
  dd214s: [
    {
      label: "Basic Training",
      rank: "PV1",
      payGrade: "E-1",
      dates: { entry: "1997-09-29", separation: "1998-02-27" }
    },
    {
      label: "Egypt MFO",
      rank: "SPC",
      payGrade: "E-4",
      dates: { entry: "2005-02-06", separation: "2006-03-04" }
    },
    {
      label: "Afghanistan TF III",
      rank: "SGT",
      payGrade: "E-5",
      dates: { entry: "2004-06-22", separation: "2005-08-27" }
    },
    {
      label: "Afghanistan TF V",
      rank: "SGT",
      payGrade: "E-5",
      dates: { entry: "2006-02-16", separation: "2007-06-29" }
    }
  ],
  
  expectedAwards: [
    "ARMY SERVICE RIBBON",
    "ARMY ACHIEVEMENT MEDAL",
    "ARMY RESERVE COMPONENTS ACHIEVEMENT MEDAL",
    "NATIONAL DEFENSE SERVICE RIBBON",
    "OVERSEAS SERVICE RIBBON",
    "NCO PROFESSIONAL DEVELOPMENT RIBBON",
    "AFGHANISTAN CAMPAIGN MEDAL",
    "GLOBAL WAR ON TERRORISM EXPEDITIONARY MEDAL",
    "GLOBAL WAR ON TERRORISM SERVICE MEDAL",
    "ARMED FORCES RESERVE MEDAL",
    "MULTINATIONAL FORCE AND OBSERVERS MEDAL",
    "COMBAT ACTION BADGE"
  ]
};

// Sample DD214 text (simulating OCR output) for testing
// In production, this would come from PDF parsing
const SAMPLE_DD214_TEXT = `
CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY

1. NAME (Last, First, Middle)
JOHNSON, ANTHONY DANIEL

2. DEPARTMENT, COMPONENT AND BRANCH
ARMY/ARNG

3. SOCIAL SECURITY NUMBER
544-23-5706

4a. GRADE, RATE, OR RANK
SGT

4b. PAY GRADE
E5

5. DATE OF BIRTH
19780419

6. RESERVE OBLIG. TERM. DATE
00000000

7a. PLACE OF ENTRY INTO ACTIVE DUTY
PORTLAND, OR

7b. HOME OF RECORD AT TIME OF ENTRY
1009 N E LEVERICH COURT
VANCOUVER, WA 98663

8a. LAST DUTY ASSIGNMENT AND MAJOR COMMAND
41 IN BD

8b. STATION WHERE SEPARATED
CAMP ATTERBURY, INDIANA

9. COMMAND TO WHICH TRANSFERRED
REVERT TO ARNG OF OREGON

10. SGLI COVERAGE
250,000

11. PRIMARY SPECIALTY
92Y20 UNIT SUPPLY SPECIALIST -- 07 YRS -- 06 MOS//NOTHING FOLLOWS

12. RECORD OF SERVICE
12a. DATE ENTERED AD THIS PERIOD: 2004 | 06 | 22
12b. SEPARATION DATE THIS PERIOD: 2005 | 08 | 27
12c. NET ACTIVE SERVICE THIS PERIOD: 01 | 02 | 06
12d. TOTAL PRIOR ACTIVE SERVICE: 01 | 06 | 24
12e. TOTAL PRIOR INACTIVE SERVICE: 05 | 05 | 28
12f. FOREIGN SERVICE: 00 | 11 | 20
12g. SEA SERVICE: 00 | 00 | 00
12h. EFFECTIVE DATE OF PAY GRADE: 2004 | 03 | 01

13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED
ARMY ACHIEVEMENT MEDAL-2//ARMY RESERVE COMPONENTS ACHIEVMENT MEDAL-2//NATIONAL DEFENSE SERVICE RIBBON W/ M DEVICE//AFGHANISTAN CAMPAIGN MEDAL//GLOBAL WAR ON TERRORISM EXPEDITIONARY MEDAL//GLOBAL WAR ON TERRORISM SERVICE MEDAL-2//ARMED FORCES RESERVE MEDAL W/ 'M' DEVICE-2//NCO PROFESSIONAL DEVELOPMENT RIBBON//ARMY SERVICE RIBBON//OVERSEAS SERVICE RIBBON//MULTINATIONAL FORCES AND OBSERVERS MEDAL//COMBAT ACTION BADGE//NOTHING FOLLOWS

14. MILITARY EDUCATION
COMBAT LIFE SAVER COURSE, 1 WEEK, 2004 // NOTHING FOLLOWS

15. MEMBER CONTRIBUTED TO POST-VIETNAM ERA VETERANS EDUCATION ASSISTANCE PROGRAM
X (NO)

15b. HIGH SCHOOL GRADUATE OR EQUIVALENT
X (YES)

16. DAYS ACCRUED LEAVE PAID
NONE

17. MEMBER WAS PROVIDED DENTAL CARE
X (NO)

SECTION 5: REMARKS AND SIGNATURES

18. REMARKS
DATA HEREIN SUBJECT TO COMPUTER MATCHING WITHIN DOD OR WITH OTHER AGENCY FOR VERIFICATION PURPOSES AND DETERMINING ELIGIBILITY OR COMPLIANCE FOR FEDERAL BENEFITS // SOLDIER HAS COMPLETED FULL TERM OF SERVICE//PERIODS OF SERVICE IN NFG FORM 22 WILL BE ADDED//ORDERED TO ACTIVE DUTY IN SUPPORT OF OPERATION ENDURING FREEDOM//1AW 10 USC 12302// SERVICE IN AFGHANISTAN FROM 20040908 TO 20050827 COMPLETED

23. TYPE OF SEPARATION
RELIEF FROM ACTIVE DUTY

24. CHARACTER OF SERVICE
HONORABLE
`;

// Simplified parser for testing (mimics the real one)
function parseDD214Test(text) {
  const data = {
    veteranName: null,
    lastName: null,
    firstName: null,
    middleName: null,
    branch: null,
    component: null,
    rank: null,
    payGrade: null,
    mos: null,
    mosTitle: null,
    serviceStartDate: null,
    serviceEndDate: null,
    awards: [],
    dischargeType: null
  };
  
  // Clean the text - remove parenthetical content
  let cleanedText = text.replace(/\([^)]*\)/g, ' ');
  
  // Remove lowercase words (instructions)
  cleanedText = cleanedText.replace(/[a-z]{3,}/g, ' ');
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
  
  const upperText = text.toUpperCase();
  
  // === NAME ===
  const nameMatch = text.match(/1\.\s*NAME[^\n]*\n\s*([A-Z]{2,}),?\s+([A-Z]+)(?:\s+([A-Z]+))?/i);
  if (nameMatch) {
    data.lastName = nameMatch[1]?.trim().toUpperCase();
    data.firstName = nameMatch[2]?.trim().toUpperCase();
    data.middleName = nameMatch[3]?.trim().toUpperCase() || null;
    data.veteranName = `${data.lastName}, ${data.firstName}${data.middleName ? ' ' + data.middleName : ''}`;
  }
  
  // === BRANCH ===
  if (upperText.includes('ARMY') || upperText.includes('ARNG')) {
    data.branch = 'Army';
  }
  if (upperText.includes('ARNG') || upperText.includes('GUARD')) {
    data.component = 'National Guard';
  }
  
  // === RANK ===
  const rankMatch = text.match(/4[aA]?\.\s*GRADE.*?RANK\s*\n?\s*([A-Z]{2,4})/i);
  if (rankMatch) {
    const validRanks = ['PVT','PV2','PFC','SPC','CPL','SGT','SSG','SFC','MSG','1SG','SGM','CSM'];
    if (validRanks.includes(rankMatch[1])) {
      data.rank = rankMatch[1];
    }
  }
  
  // === PAY GRADE ===
  const payMatch = text.match(/4[bB]?\.\s*PAY\s+GRADE\s*\n?\s*([EO]-?\d)/i);
  if (payMatch) {
    data.payGrade = payMatch[1].replace(/([EO])(\d)/, '$1-$2');
  }
  
  // === MOS ===
  const mosMatch = text.match(/PRIMARY\s+SPECIALTY\s*\n?\s*(\d{2}[A-Z]\d{2})\s+([A-Z\s]+?)(?:--|\/\/|\d)/i);
  if (mosMatch) {
    data.mos = mosMatch[1];
    data.mosTitle = mosMatch[2]?.trim();
  }
  
  // === SERVICE DATES ===
  const entryMatch = text.match(/12[aA]\..*?DATE.*?ENTERED.*?(\d{4})\s*\|\s*(\d{2})\s*\|\s*(\d{2})/i);
  if (entryMatch) {
    data.serviceStartDate = `${entryMatch[1]}-${entryMatch[2]}-${entryMatch[3]}`;
  }
  
  const sepMatch = text.match(/12[bB]\..*?SEPARATION.*?DATE.*?(\d{4})\s*\|\s*(\d{2})\s*\|\s*(\d{2})/i);
  if (sepMatch) {
    data.serviceEndDate = `${sepMatch[1]}-${sepMatch[2]}-${sepMatch[3]}`;
  }
  
  // === AWARDS ===
  const awardsMatch = text.match(/13\.\s*DECORATIONS.*?\n([\s\S]*?)(?:14\.|$)/i);
  if (awardsMatch) {
    const awardsText = awardsMatch[1]
      .replace(/\([^)]*\)/g, ' ')  // Remove parentheses
      .replace(/NOTHING\s+FOLLOWS/gi, '')
      .replace(/W\/\s*'?M'?\s*DEVICE/gi, '')  // Remove device notations for base award matching
      .replace(/-\d+/g, '')  // Remove quantity markers like -2
      .replace(/\/\//g, ', ')
      .toUpperCase();
    
    const awardNames = [
      'ARMY SERVICE RIBBON',
      'ARMY ACHIEVEMENT MEDAL',
      'ARMY RESERVE COMPONENTS ACHIEVEMENT MEDAL',
      'ARMY RESERVE COMPONENTS ACHIEVMENT MEDAL', // Typo variant
      'NATIONAL DEFENSE SERVICE RIBBON',
      'NATIONAL DEFENSE SERVICE MEDAL',
      'OVERSEAS SERVICE RIBBON',
      'NCO PROFESSIONAL DEVELOPMENT RIBBON',
      'NONCOMMISSIONED OFFICERS PROFESSIONAL DEVELOPMENT RIBBON',
      'AFGHANISTAN CAMPAIGN MEDAL',
      'GLOBAL WAR ON TERRORISM EXPEDITIONARY MEDAL',
      'GLOBAL WAR ON TERRORISM SERVICE MEDAL',
      'GWOT EXPEDITIONARY MEDAL',
      'GWOT SERVICE MEDAL',
      'ARMED FORCES RESERVE MEDAL',
      'MULTINATIONAL FORCES AND OBSERVERS MEDAL',
      'MULTINATIONAL FORCE AND OBSERVERS MEDAL',
      'MFO MEDAL',
      'COMBAT ACTION BADGE',
      'COMBAT INFANTRYMAN BADGE',
      'EXPERT INFANTRYMAN BADGE'
    ];
    
    for (const award of awardNames) {
      if (awardsText.includes(award)) {
        // Normalize names
        let normalizedAward = award
          .replace('ACHIEVMENT', 'ACHIEVEMENT')
          .replace('NONCOMMISSIONED OFFICERS PROFESSIONAL', 'NCO PROFESSIONAL')
          .replace('MULTINATIONAL FORCES', 'MULTINATIONAL FORCE');
        
        if (!data.awards.includes(normalizedAward)) {
          data.awards.push(normalizedAward);
        }
      }
    }
  }
  
  // === DISCHARGE TYPE ===
  const dischargeMatch = text.match(/24\.\s*CHARACTER.*?SERVICE\s*\n?\s*([A-Z]+)/i);
  if (dischargeMatch) {
    data.dischargeType = dischargeMatch[1];
  }
  
  return data;
}

// Run the test
console.log('\n🎖️ DD214 PARSER TEST - JOHNSON, ANTHONY DANIEL');
console.log('='.repeat(60));

const result = parseDD214Test(SAMPLE_DD214_TEXT);

console.log('\n📋 PARSED RESULTS:');
console.log('-'.repeat(40));
console.log(`Name:        ${result.veteranName || '❌ NOT FOUND'}`);
console.log(`Branch:      ${result.branch || '❌ NOT FOUND'}`);
console.log(`Component:   ${result.component || '❌ NOT FOUND'}`);
console.log(`Rank:        ${result.rank || '❌ NOT FOUND'}`);
console.log(`Pay Grade:   ${result.payGrade || '❌ NOT FOUND'}`);
console.log(`MOS:         ${result.mos || '❌ NOT FOUND'} - ${result.mosTitle || ''}`);
console.log(`Entry Date:  ${result.serviceStartDate || '❌ NOT FOUND'}`);
console.log(`Sep Date:    ${result.serviceEndDate || '❌ NOT FOUND'}`);
console.log(`Discharge:   ${result.dischargeType || '❌ NOT FOUND'}`);

console.log('\n🎖️ AWARDS FOUND:');
console.log('-'.repeat(40));
if (result.awards.length > 0) {
  result.awards.forEach((award, i) => console.log(`  ${i+1}. ${award}`));
} else {
  console.log('  ❌ No awards parsed');
}

// Validate against expected
console.log('\n✅ VALIDATION:');
console.log('-'.repeat(40));

const checks = [
  { 
    name: 'Name', 
    passed: result.veteranName?.includes('JOHNSON'), 
    expected: EXPECTED_DATA.name,
    actual: result.veteranName 
  },
  { 
    name: 'Branch', 
    passed: result.branch === EXPECTED_DATA.branch, 
    expected: EXPECTED_DATA.branch,
    actual: result.branch 
  },
  { 
    name: 'Component', 
    passed: result.component === EXPECTED_DATA.component, 
    expected: EXPECTED_DATA.component,
    actual: result.component 
  },
  { 
    name: 'MOS', 
    passed: result.mos?.includes(EXPECTED_DATA.mos), 
    expected: `${EXPECTED_DATA.mos}xx`,
    actual: result.mos 
  },
  { 
    name: 'Rank (TF III)', 
    passed: result.rank === 'SGT', 
    expected: 'SGT',
    actual: result.rank 
  },
  { 
    name: 'Combat Action Badge', 
    passed: result.awards.some(a => a.includes('COMBAT ACTION BADGE')), 
    expected: 'Present',
    actual: result.awards.find(a => a.includes('COMBAT')) || 'Not found' 
  },
  { 
    name: 'Afghanistan Campaign', 
    passed: result.awards.some(a => a.includes('AFGHANISTAN')), 
    expected: 'Present',
    actual: result.awards.find(a => a.includes('AFGHANISTAN')) || 'Not found' 
  }
];

let passCount = 0;
for (const check of checks) {
  const status = check.passed ? '✅' : '❌';
  console.log(`${status} ${check.name}: ${check.passed ? 'PASS' : 'FAIL'}`);
  if (!check.passed) {
    console.log(`     Expected: ${check.expected}`);
    console.log(`     Actual:   ${check.actual}`);
  }
  if (check.passed) passCount++;
}

console.log('\n' + '='.repeat(60));
console.log(`SCORE: ${passCount}/${checks.length} checks passed (${Math.round(passCount/checks.length*100)}%)`);

// Check for garbage data
console.log('\n🔍 GARBAGE DATA CHECK:');
console.log('-'.repeat(40));
const garbagePatterns = [
  /DEPARTMENT.*COMPONENT/i,
  /Last.*first.*middle/i,
  /e\.g\./i,
  /\(Silver Star/i,
  /Your rank at/i,
  /decorations.*awarded.*such/i
];

let garbageFound = false;
for (const pattern of garbagePatterns) {
  if (pattern.test(result.veteranName || '')) {
    console.log(`❌ Garbage in name: matches "${pattern}"`);
    garbageFound = true;
  }
  for (const award of result.awards) {
    if (pattern.test(award)) {
      console.log(`❌ Garbage in awards: "${award}" matches "${pattern}"`);
      garbageFound = true;
    }
  }
}

if (!garbageFound) {
  console.log('✅ No garbage data detected!');
}

console.log('\n🏁 TEST COMPLETE\n');
