/**
 * DD214 Parser Test Script
 * Tests the parser against a synthetic veteran's known DD214 data
 *
 * Usage: node --experimental-vm-modules scripts/test-dd214-parser.mjs
 */

// Expected data from the synthetic veteran's DD214s
const EXPECTED_DATA = {
  name: "WILLIAMS, ROBERT LEE",
  branch: "Army",
  component: "National Guard",
  mos: "92Y",

  dd214s: [
    {
      label: "Basic Training",
      rank: "PV1",
      payGrade: "E-1",
      dates: { entry: "1994-09-29", separation: "1995-02-27" }
    },
    {
      label: "Egypt MFO",
      rank: "SPC",
      payGrade: "E-4",
      dates: { entry: "2002-02-06", separation: "2003-03-04" }
    },
    {
      label: "Afghanistan TF III",
      rank: "SGT",
      payGrade: "E-5",
      dates: { entry: "2001-06-22", separation: "2002-08-27" }
    },
    {
      label: "Afghanistan TF V",
      rank: "SGT",
      payGrade: "E-5",
      dates: { entry: "2003-02-16", separation: "2004-06-29" }
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
WILLIAMS, ROBERT LEE

2. DEPARTMENT, COMPONENT AND BRANCH
ARMY/ARNG

3. SOCIAL SECURITY NUMBER
123-45-6789

4a. GRADE, RATE, OR RANK
SGT

4b. PAY GRADE
E5

5. DATE OF BIRTH
19850615

6. RESERVE OBLIG. TERM. DATE
00000000

7a. PLACE OF ENTRY INTO ACTIVE DUTY
AUSTIN, TX

7b. HOME OF RECORD AT TIME OF ENTRY
200 OAK ST
DALLAS, TX 75201

8a. LAST DUTY ASSIGNMENT AND MAJOR COMMAND
41 IN BD

8b. STATION WHERE SEPARATED
CAMP ATTERBURY, INDIANA

9. COMMAND TO WHICH TRANSFERRED
REVERT TO ARNG OF TEXAS

10. SGLI COVERAGE
250,000

11. PRIMARY SPECIALTY
92Y20 UNIT SUPPLY SPECIALIST -- 07 YRS -- 06 MOS//NOTHING FOLLOWS

12. RECORD OF SERVICE
12a. DATE ENTERED AD THIS PERIOD: 2001 | 06 | 22
12b. SEPARATION DATE THIS PERIOD: 2002 | 08 | 27
12c. NET ACTIVE SERVICE THIS PERIOD: 01 | 02 | 06
12d. TOTAL PRIOR ACTIVE SERVICE: 01 | 06 | 24
12e. TOTAL PRIOR INACTIVE SERVICE: 05 | 05 | 28
12f. FOREIGN SERVICE: 00 | 11 | 20
12g. SEA SERVICE: 00 | 00 | 00
12h. EFFECTIVE DATE OF PAY GRADE: 2001 | 03 | 01

13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED
ARMY ACHIEVEMENT MEDAL-2//ARMY RESERVE COMPONENTS ACHIEVMENT MEDAL-2//NATIONAL DEFENSE SERVICE RIBBON W/ M DEVICE//AFGHANISTAN CAMPAIGN MEDAL//GLOBAL WAR ON TERRORISM EXPEDITIONARY MEDAL//GLOBAL WAR ON TERRORISM SERVICE MEDAL-2//ARMED FORCES RESERVE MEDAL W/ 'M' DEVICE-2//NCO PROFESSIONAL DEVELOPMENT RIBBON//ARMY SERVICE RIBBON//OVERSEAS SERVICE RIBBON//MULTINATIONAL FORCES AND OBSERVERS MEDAL//COMBAT ACTION BADGE//NOTHING FOLLOWS

14. MILITARY EDUCATION
COMBAT LIFE SAVER COURSE, 1 WEEK, 2001 // NOTHING FOLLOWS

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
DATA HEREIN SUBJECT TO COMPUTER MATCHING WITHIN DOD OR WITH OTHER AGENCY FOR VERIFICATION PURPOSES AND DETERMINING ELIGIBILITY OR COMPLIANCE FOR FEDERAL BENEFITS // SOLDIER HAS COMPLETED FULL TERM OF SERVICE//PERIODS OF SERVICE IN NFG FORM 22 WILL BE ADDED//ORDERED TO ACTIVE DUTY IN SUPPORT OF OPERATION ENDURING FREEDOM//1AW 10 USC 12302// SERVICE IN AFGHANISTAN FROM 20010908 TO 20020827 COMPLETED

23. TYPE OF SEPARATION
RELIEF FROM ACTIVE DUTY

24. CHARACTER OF SERVICE
HONORABLE
`;

function extractName(text) {
  const nameMatch = text.match(/1\.\s*NAME[^\n]*\n\s*([A-Z]{2,}),?\s+([A-Z]+)(?:\s+([A-Z]+))?/i);
  if (!nameMatch) {
    return { lastName: null, firstName: null, middleName: null, veteranName: null };
  }
  const lastName = nameMatch[1]?.trim().toUpperCase();
  const firstName = nameMatch[2]?.trim().toUpperCase();
  const middleName = nameMatch[3]?.trim().toUpperCase() || null;
  const veteranName = `${lastName}, ${firstName}${middleName ? ' ' + middleName : ''}`;
  return { lastName, firstName, middleName, veteranName };
}

function extractBranchAndComponent(upperText) {
  const branch = (upperText.includes('ARMY') || upperText.includes('ARNG')) ? 'Army' : null;
  const component = (upperText.includes('ARNG') || upperText.includes('GUARD')) ? 'National Guard' : null;
  return { branch, component };
}

function extractRank(text) {
  const rankMatch = text.match(/4a?\.\s*GRADE.*?RANK\s*\n?\s*([A-Z]{2,4})/i);
  if (!rankMatch) return null;
  const validRanks = ['PVT','PV2','PFC','SPC','CPL','SGT','SSG','SFC','MSG','1SG','SGM','CSM'];
  return validRanks.includes(rankMatch[1]) ? rankMatch[1] : null;
}

function extractPayGrade(text) {
  const payMatch = text.match(/4b?\.\s*PAY\s+GRADE\s*\n?\s*([EO]-?\d)/i);
  if (!payMatch) return null;
  return payMatch[1].replace(/([EO])(\d)/, '$1-$2');
}

function extractMOS(text) {
  const mosMatch = text.match(/PRIMARY\s+SPECIALTY\s*\n?\s*(\d{2}[A-Z]\d{2})\s+([A-Z\s]+?)(?:--|\/\/|\d)/i);
  if (!mosMatch) return { mos: null, mosTitle: null };
  return { mos: mosMatch[1], mosTitle: mosMatch[2]?.trim() };
}

function extractServiceDates(text) {
  const entryMatch = text.match(/12a\..*?DATE.*?ENTERED.*?(\d{4})\s*\|\s*(\d{2})\s*\|\s*(\d{2})/i);
  const serviceStartDate = entryMatch ? `${entryMatch[1]}-${entryMatch[2]}-${entryMatch[3]}` : null;

  const sepMatch = text.match(/12b\..*?SEPARATION.*?DATE.*?(\d{4})\s*\|\s*(\d{2})\s*\|\s*(\d{2})/i);
  const serviceEndDate = sepMatch ? `${sepMatch[1]}-${sepMatch[2]}-${sepMatch[3]}` : null;

  return { serviceStartDate, serviceEndDate };
}

function extractAwards(text) {
  const awards = [];
  const awardsMatch = text.match(/13\.\s*DECORATIONS.*?\n([\s\S]*?)(?:14\.|$)/i);
  if (!awardsMatch) return awards;

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
    if (!awardsText.includes(award)) continue;
    // Normalize names
    const normalizedAward = award
      .replace('ACHIEVMENT', 'ACHIEVEMENT')
      .replace('NONCOMMISSIONED OFFICERS PROFESSIONAL', 'NCO PROFESSIONAL')
      .replace('MULTINATIONAL FORCES', 'MULTINATIONAL FORCE');

    if (!awards.includes(normalizedAward)) {
      awards.push(normalizedAward);
    }
  }

  return awards;
}

function extractDischargeType(text) {
  const dischargeMatch = text.match(/24\.\s*CHARACTER.*?SERVICE\s*\n?\s*([A-Z]+)/i);
  return dischargeMatch ? dischargeMatch[1] : null;
}

// Simplified parser for testing (mimics the real one)
function parseDD214Test(text) {
  const upperText = text.toUpperCase();

  const { lastName, firstName, middleName, veteranName } = extractName(text);
  const { branch, component } = extractBranchAndComponent(upperText);
  const rank = extractRank(text);
  const payGrade = extractPayGrade(text);
  const { mos, mosTitle } = extractMOS(text);
  const { serviceStartDate, serviceEndDate } = extractServiceDates(text);
  const awards = extractAwards(text);
  const dischargeType = extractDischargeType(text);

  return {
    veteranName,
    lastName,
    firstName,
    middleName,
    branch,
    component,
    rank,
    payGrade,
    mos,
    mosTitle,
    serviceStartDate,
    serviceEndDate,
    awards,
    dischargeType
  };
}

// Run the test
console.log('\n🎖️ DD214 PARSER TEST - WILLIAMS, ROBERT LEE');
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
    passed: result.veteranName?.includes('WILLIAMS'),
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
