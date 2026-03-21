/**
 * DD214 Test Data - WILLIAMS, ROBERT LEE
 * 4 DD214s covering Basic Training through Combat Deployments
 * Use this to validate DD214 parser accuracy
 */

export const JOHNSON_DD214_TEST_DATA = {
  veteran: {
    name: "WILLIAMS, ROBERT LEE",
    ssn: "123-45-6789",
    dob: "1985-06-15",
    branch: "ARMY/ARNG",
  },

  dd214s: [
    {
      id: "basic-training",
      label: "DD214 - Basic Training",
      expected: {
        name: "WILLIAMS, ROBERT LEE",
        rank: "PV1",
        payGrade: "E1",
        branch: "ARMY/ARNG",
        mos: "92Y10",
        mosTitle: "UNIT SUPPLY SPECIALIST",

        // Box 12: Record of Service
        entryDate: "1997-09-29",
        separationDate: "1998-02-27",
        netActiveService: { years: 0, months: 4, days: 29 },
        totalPriorActive: { years: 0, months: 0, days: 0 },
        foreignService: { years: 0, months: 0, days: 0 },

        // Locations
        placeOfEntry: "PORTLAND, OR",
        homeOfRecord: "1709 SW BLANKENSHIP RD #28, WEST LINN, OR 97068",
        lastDutyAssignment: "W1D5 CO M TR TC",
        separationStation: "FORT LEE, VA 23801",
        commandTransferred: "162ND ENGR CO, CP WITHYCOMBE, CLACKAMAS, OR 97015",

        // Box 13: Awards
        awards: ["ARMY SERVICE RIBBON"],

        // Box 14: Education
        militaryEducation: ["UNIT SUPPLY SPECIALIST, 06 WEEKS, FEB 1998"],

        // Other
        sgli: 200000,
        characterOfService: null, // Not in CSV
        separationType: "RELEASE FROM ACTIVE DUTY TRAINING",
        reentryCode: "NA",
      },
    },

    {
      id: "egypt-mfo",
      label: "DD214 - Egypt (MFO)",
      expected: {
        name: "WILLIAMS, ROBERT LEE",
        rank: "SPC",
        payGrade: "E4",
        branch: "ARMY/ARNG",
        mos: "92Y10",
        mosTitle: "UNIT SUPPLY SP",

        // Box 12: Record of Service
        entryDate: "2005-02-06", // Note: CSV shows 02 | 05 | 06 which is ambiguous
        separationDate: "2006-03-04", // CSV shows 03 | 04 | 30
        netActiveService: { years: 0, months: 11, days: 25 },
        totalPriorActive: { years: 0, months: 4, days: 29 },
        foreignService: { years: 0, months: 5, days: 29 },

        // Locations
        placeOfEntry: "ASHLAND, OR",
        homeOfRecord: "100 MAIN ST, AUSTIN, TX 78701",
        lastDutyAssignment: "HHC (-) 1-186 IN (FORWARD) (WPRPT2)",
        separationStation: "SALEM, OR 97309-5047",
        commandTransferred:
          "HHC (-) 1-186 IN (WPRPT2) 1420 E MAIN ST, ASHLAND, OR 97520",

        // Box 13: Awards
        awards: [
          "ARMY ACHIEVEMENT MEDAL", // 2nd Award
          "ARMY RESERVE COMPONENTS ACHIEVEMENT MEDAL",
          "NATIONAL DEFENSE SERVICE RIBBON", // W/ M DEVICE
          "OVERSEAS SERVICE RIBBON",
          "NCO PROFESSIONAL DEVELOPMENT RIBBON",
        ],

        // Box 14: Education
        militaryEducation: ["PRIMARY LEADERSHIP DEVELOPMENT COURSE 4WK APR 03"],

        // Other
        sgli: 250000,
        characterOfService: "HONORABLE",
        separationType: null,
        reentryCode: null,
      },
    },

    {
      id: "afghanistan-tf3",
      label: "DD214 - Afghanistan (TF Pheonix III)",
      expected: {
        name: "WILLIAMS, ROBERT LEE",
        rank: "SGT",
        payGrade: "E5",
        branch: "ARMY/ARNG",
        mos: "92Y20",
        mosTitle: "UNIT SUPPLY SPECIALIST",

        // Box 12: Record of Service
        entryDate: "2004-06-22",
        separationDate: "2005-08-27",
        netActiveService: { years: 1, months: 2, days: 6 },
        totalPriorActive: { years: 1, months: 6, days: 24 },
        foreignService: { years: 0, months: 11, days: 20 },

        // Locations
        placeOfEntry: "PORTLAND, OR",
        homeOfRecord: "200 OAK ST, AUSTIN, TX 78701",
        lastDutyAssignment: "41 IN BD",
        separationStation: "CAMP ATTERBURY, INDIANA",
        commandTransferred: "REVERT TO ARNG OF OREGON",

        // Box 13: Awards - COMBAT DEPLOYMENT!
        awards: [
          "ARMY ACHIEVEMENT MEDAL", // 2nd
          "ARMY RESERVE COMPONENTS ACHIEVEMENT MEDAL", // 2nd
          "NATIONAL DEFENSE SERVICE RIBBON", // W/ M DEVICE
          "AFGHANISTAN CAMPAIGN MEDAL",
          "GLOBAL WAR ON TERRORISM EXPEDITIONARY MEDAL",
          "GLOBAL WAR ON TERRORISM SERVICE MEDAL", // 2nd
          "ARMED FORCES RESERVE MEDAL", // W/ M DEVICE, 2nd
          "NCO PROFESSIONAL DEVELOPMENT RIBBON",
          "ARMY SERVICE RIBBON",
          "OVERSEAS SERVICE RIBBON",
          "MULTINATIONAL FORCES AND OBSERVERS MEDAL",
          "COMBAT ACTION BADGE", // ⚔️ COMBAT!
        ],

        // Box 14: Education
        militaryEducation: ["COMBAT LIFE SAVER COURSE, 1 WEEK, 2004"],

        // Other
        sgli: 250000,
        characterOfService: "HONORABLE",
        separationType: "RELIEF FROM ACTIVE DUTY",
        reentryCode: null,
      },
    },

    {
      id: "afghanistan-tf5",
      label: "DD214 - Afghanistan (TF Pheonix V)",
      expected: {
        name: "WILLIAMS, ROBERT LEE",
        rank: "SGT",
        payGrade: "E05",
        branch: "ARMY/ARNG",
        mos: "92Y20",
        mosTitle: "UNIT SUPPLY SPEC",

        // Box 12: Record of Service
        entryDate: "2006-02-16",
        separationDate: "2007-06-29",
        netActiveService: { years: 1, months: 4, days: 14 },
        totalPriorActive: { years: 2, months: 4, days: 1 },
        foreignService: { years: 1, months: 0, days: 18 },

        // Locations
        placeOfEntry: "PORTLAND, OREGON",
        homeOfRecord: "1009 NE LEVERICH COURT, AUSTIN, TX 78701",
        lastDutyAssignment: "HHC/41 IN (SEP) GB",
        separationStation: "FORT CARSON, CO 80913-2965",
        commandTransferred: "ARNG OF OREGON",

        // Box 13: Awards (continued in Block 18)
        awards: [
          "ARMY ACHIEVEMENT MEDAL", // 2nd Award
          "ARMY RESERVE COMPONENTS ACHIEVEMENT MEDAL", // 2nd Award
          "NATIONAL DEFENSE SERVICE RIBBON", // W/ M DEVICE
          "AFGHANISTAN CAMPAIGN MEDAL",
          "GLOBAL WAR ON TERRORISM EXPEDITIONARY MEDAL",
          "GLOBAL WAR ON TERRORISM SERVICE MEDAL",
          "NCO PROFESSIONAL DEVELOPMENT RIBBON",
          // Note: "CONT IN BLOCK 18" - more awards listed there
        ],

        // Block 18 continuation awards (from remarks)
        block18Awards: [
          "ARMY SERVICE RIBBON",
          "ARMED FORCES RESERVE MEDAL",
          "MULTINATIONAL FORCE AND OBSERVERS MEDAL",
          "COMBAT ACTION BADGE",
        ],

        // Box 14: Education
        militaryEducation: ["NONE"],

        // Other
        sgli: 250000,
        characterOfService: "HONORABLE",
        separationType: "RELEASE FROM ACTIVE DUTY",
        reentryCode: null,
      },
    },
  ],

  // Aggregate career data
  careerSummary: {
    totalActiveServiceTime: {
      years: 3,
      months: 10,
      days: 14, // Approximate sum
    },
    totalForeignService: {
      years: 2,
      months: 5,
      days: 7, // Approximate sum
    },
    deployments: [
      {
        location: "Egypt (Sinai)",
        mission: "MFO Peacekeeping",
        year: "2005-2006",
      },
      { location: "Afghanistan", mission: "TF Pheonix III", year: "2004-2005" },
      { location: "Afghanistan", mission: "TF Pheonix V", year: "2006-2007" },
    ],
    combatIndicators: [
      "Combat Action Badge",
      "Afghanistan Campaign Medal",
      "GWOT Expeditionary Medal",
      "Imminent Danger Pay Area (Block 18)",
    ],
    finalRank: "SGT (E5)",
    mos: "92Y - Unit Supply Specialist",
    totalYearsInService: 10, // 1997-2007
  },
};

/**
 * Award mapping for ribbon rack display
 * Maps DD214 text to ribbon rack IDs
 */
export const JOHNSON_AWARD_MAPPINGS = {
  "ARMY SERVICE RIBBON": "army-service-ribbon",
  "ARMY ACHIEVEMENT MEDAL": "army-achievement-medal",
  "ARMY RESERVE COMPONENTS ACHIEVEMENT MEDAL":
    "army-reserve-components-achievement-medal",
  "NATIONAL DEFENSE SERVICE RIBBON": "national-defense-service-medal",
  "OVERSEAS SERVICE RIBBON": "overseas-service-ribbon",
  "NCO PROFESSIONAL DEVELOPMENT RIBBON": "nco-professional-development-ribbon",
  "AFGHANISTAN CAMPAIGN MEDAL": "afghanistan-campaign-medal",
  "GLOBAL WAR ON TERRORISM EXPEDITIONARY MEDAL": "gwot-expeditionary-medal",
  "GLOBAL WAR ON TERRORISM SERVICE MEDAL": "gwot-service-medal",
  "ARMED FORCES RESERVE MEDAL": "armed-forces-reserve-medal",
  "MULTINATIONAL FORCES AND OBSERVERS MEDAL":
    "multinational-force-observers-medal",
  "COMBAT ACTION BADGE": "combat-action-badge",
};

/**
 * Test function to validate parser output against expected data
 */
export function validateParserOutput(parsedDD214, expectedDD214Id) {
  const expected = JOHNSON_DD214_TEST_DATA.dd214s.find(
    (d) => d.id === expectedDD214Id,
  );
  if (!expected) {
    return { valid: false, error: `Unknown DD214 ID: ${expectedDD214Id}` };
  }

  const errors = [];
  const exp = expected.expected;

  // Validate name
  if (parsedDD214.name && !parsedDD214.name.includes("JOHNSON")) {
    errors.push(
      `Name mismatch: got "${parsedDD214.name}", expected contains "JOHNSON"`,
    );
  }

  // Validate rank
  if (parsedDD214.rank && parsedDD214.rank !== exp.rank) {
    errors.push(
      `Rank mismatch: got "${parsedDD214.rank}", expected "${exp.rank}"`,
    );
  }

  // Validate MOS
  if (parsedDD214.mos && !parsedDD214.mos.includes("92Y")) {
    errors.push(
      `MOS mismatch: got "${parsedDD214.mos}", expected contains "92Y"`,
    );
  }

  // Check for garbage data (known bad patterns)
  const garbagePatterns = [
    /DEPARTMENT.*COMPONENT/i,
    /Last.*first.*middle/i,
    /e\.g\./i,
    /\(Silver Star/i,
    /Your rank at/i,
  ];

  for (const pattern of garbagePatterns) {
    if (parsedDD214.name && pattern.test(parsedDD214.name)) {
      errors.push(
        `Garbage in name: "${parsedDD214.name}" matches instruction pattern`,
      );
    }
    if (parsedDD214.awards) {
      for (const award of parsedDD214.awards) {
        if (pattern.test(award)) {
          errors.push(
            `Garbage in awards: "${award}" matches instruction pattern`,
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    expected: exp,
    parsed: parsedDD214,
  };
}

export default JOHNSON_DD214_TEST_DATA;
