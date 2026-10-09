import { describe, expect, it } from "vitest";
import {
  calendarDay,
  dropSupersededConditions,
  extractPriorConditionNames,
  findRatedConditionMatch,
  isOlderDecision,
  isSupersededName,
  matchConditionToKnownKey,
  normalizeConditionName,
  primaryConditionKey,
} from "../../utils/conditionName";

const byName = (r) => r.name;

describe("extractPriorConditionNames", () => {
  it("reads a nested 'formerly evaluated as' parenthetical", () => {
    expect(
      extractPriorConditionNames(
        "Irritable bowel syndrome (formerly evaluated as spastic colon and functional dyspepsia not otherwise specified (NOS))",
      ),
    ).toEqual([
      "spastic colon and functional dyspepsia not otherwise specified",
    ]);
  });

  it("reads 'previously rated as'", () => {
    expect(
      extractPriorConditionNames(
        "cervical strain, degenerative disc disease (previously rated as neck sprain)",
      ),
    ).toEqual(["neck sprain"]);
  });

  it("tolerates a truncated, unclosed parenthetical", () => {
    expect(
      extractPriorConditionNames("cervical strain (previously rated as neck s"),
    ).toEqual(["neck s"]);
  });

  it("does not treat 'also claimed as' as a rename", () => {
    expect(
      extractPriorConditionNames("Neck sprain (also claimed as stiff neck)"),
    ).toEqual([]);
  });

  it("returns [] for plain names and non-strings", () => {
    expect(extractPriorConditionNames("tinnitus")).toEqual([]);
    expect(extractPriorConditionNames(null)).toEqual([]);
  });
});

describe("findRatedConditionMatch", () => {
  const rows = [
    {
      name: "Spastic colon and functional dyspepsia not otherwise specified (NOS)",
    },
    {
      name: "Neck sprain (also claimed as stiff neck and straightening cervical curve)",
    },
    { name: "Tinnitus" },
  ];

  it("matches the same condition by normalized name", () => {
    expect(findRatedConditionMatch(rows, "TINNITUS.", byName)).toBe(rows[2]);
  });

  it("matches a renamed condition to the row it replaces", () => {
    expect(
      findRatedConditionMatch(
        rows,
        "Irritable bowel syndrome (formerly evaluated as spastic colon and functional dyspepsia not otherwise specified (NOS))",
        byName,
      ),
    ).toBe(rows[0]);
    expect(
      findRatedConditionMatch(
        rows,
        "cervical strain (previously rated as neck sprain)",
        byName,
      ),
    ).toBe(rows[1]);
  });

  it("matches an older name to a row that already records it as former", () => {
    const newer = [{ name: "IBS (formerly evaluated as spastic colon)" }];
    expect(findRatedConditionMatch(newer, "Spastic colon", byName)).toBe(
      newer[0],
    );
  });

  it("returns null for an unrelated condition", () => {
    expect(findRatedConditionMatch(rows, "rhinitis", byName)).toBeNull();
  });

  it("matches a code sheet name that spells out the secondary link", () => {
    const saved = [
      { name: "radiculopathy, left lower extremity (sciatic)" },
      { name: "radiculopathy, right lower extremity (sciatic)" },
    ];
    expect(
      findRatedConditionMatch(
        saved,
        "Radiculopathy, right lower extremity (sciatic) associated with cervical strain, degenerative disc disease",
        byName,
      ),
    ).toBe(saved[1]);
  });

  it("keeps sides apart when only the secondary link differs", () => {
    const saved = [{ name: "Right shoulder restricted rotation" }];
    expect(
      findRatedConditionMatch(
        saved,
        "Left shoulder restricted rotation associated with cervical strain",
        byName,
      ),
    ).toBeNull();
  });
});

describe("primaryConditionKey", () => {
  it("drops an 'associated with' or 'secondary to' link", () => {
    expect(
      primaryConditionKey(
        "Tinnitus secondary to bilateral hearing loss (claimed as ringing)",
      ),
    ).toBe("tinnitus");
    expect(
      primaryConditionKey(
        "Right shoulder restricted elevation associated with cervical strain",
      ),
    ).toBe("right shoulder restricted elevation");
    expect(primaryConditionKey("Rhinitis")).toBe("rhinitis");
  });
});

describe("normalizeConditionName with a truncated parenthetical", () => {
  it("drops the unclosed tail so a later complete letter matches", () => {
    expect(
      normalizeConditionName("cervical strain (previously rated as neck s"),
    ).toBe(
      normalizeConditionName(
        "Cervical strain (previously rated as neck sprain)",
      ),
    );
  });
});

describe("isSupersededName", () => {
  it("treats a name the saved row replaced as older", () => {
    expect(
      isSupersededName(
        "IBS (formerly evaluated as spastic colon)",
        "Spastic colon",
      ),
    ).toBe(true);
    expect(isSupersededName("Tinnitus", "Tinnitus")).toBe(false);
  });
});

describe("matchConditionToKnownKey", () => {
  const knownConditions = [
    { key: "ibs", label: "IBS" },
    { key: "copd", label: "COPD" },
    { key: "radiculopathy", label: "Radiculopathy (Sciatic Nerve)" },
    { key: "tinnitus", label: "Tinnitus" },
    { key: "cervical_strain", label: "Cervical Strain / Neck Condition" },
  ];

  it("maps a fully-worded re-characterized IBS name via the IBS/irritable-bowel-syndrome alias", () => {
    expect(
      matchConditionToKnownKey(
        "Irritable bowel syndrome (formerly evaluated as spastic colon and functional dyspepsia not otherwise specified (NOS))",
        knownConditions,
      ),
    ).toBe("ibs");
  });

  it("maps a chronic-obstructive-pulmonary-disease letter name to the COPD key via the alias group, not cervical", () => {
    expect(
      matchConditionToKnownKey(
        "emphysema, chronic obstructive pulmonary disease (claimed as breathing problem)",
        knownConditions,
      ),
    ).toBe("copd");
  });

  it("maps sided radiculopathy names by plain word overlap, no alias needed", () => {
    expect(
      matchConditionToKnownKey(
        "radiculopathy, left lower extremity (sciatic)",
        knownConditions,
      ),
    ).toBe("radiculopathy");
    expect(
      matchConditionToKnownKey(
        "radiculopathy, right lower extremity (sciatic)",
        knownConditions,
      ),
    ).toBe("radiculopathy");
  });

  it("maps a plain tinnitus name exactly", () => {
    expect(matchConditionToKnownKey("Tinnitus", knownConditions)).toBe(
      "tinnitus",
    );
  });

  it("returns null for a condition name the tool's data doesn't support", () => {
    expect(
      matchConditionToKnownKey(
        "Plantar fasciitis with calcaneal spur, right foot",
        knownConditions,
      ),
    ).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(matchConditionToKnownKey("", knownConditions)).toBeNull();
    expect(matchConditionToKnownKey(null, knownConditions)).toBeNull();
  });
});

describe("isOlderDecision", () => {
  it("compares ISO and prose dates", () => {
    expect(isOlderDecision("2002-10-22", "2017-12-31")).toBe(true);
    expect(isOlderDecision("December 31, 2017", "2002-10-22")).toBe(false);
  });

  it("is false when either date is missing", () => {
    expect(isOlderDecision(null, "2017-12-31")).toBe(false);
    expect(isOlderDecision("2017-12-31", undefined)).toBe(false);
  });
});

describe("dropSupersededConditions", () => {
  it("removes a rating another row says it replaced", () => {
    const rows = [
      { name: "Spastic colon and functional dyspepsia (NOS)" },
      {
        name: "Irritable bowel syndrome (formerly evaluated as spastic colon and functional dyspepsia (NOS))",
      },
      { name: "Neck sprain" },
      { name: "Cervical strain (previously rated as neck sprain)" },
      { name: "Tinnitus" },
    ];
    expect(dropSupersededConditions(rows, byName)).toBe(2);
    expect(rows.map((r) => r.name)).toEqual([
      "Irritable bowel syndrome (formerly evaluated as spastic colon and functional dyspepsia (NOS))",
      "Cervical strain (previously rated as neck sprain)",
      "Tinnitus",
    ]);
  });

  it("leaves unrelated rows alone", () => {
    const rows = [{ name: "Tinnitus" }, { name: "Rhinitis" }];
    expect(dropSupersededConditions(rows, byName)).toBe(0);
    expect(rows).toHaveLength(2);
  });
});

describe("calendarDay and same-day decisions", () => {
  it("reads ISO and prose dates as the same calendar day", () => {
    expect(calendarDay("2017-08-22")).toBe("2017-08-22");
    expect(calendarDay("August 22, 2017")).toBe("2017-08-22");
    expect(calendarDay("08/22/2017")).toBe("2017-08-22");
    expect(calendarDay("not a date")).toBeNull();
    expect(calendarDay(null)).toBeNull();
  });

  it("does not call the same day in another format older", () => {
    expect(isOlderDecision("2017-08-22", "August 22, 2017")).toBe(false);
    expect(isOlderDecision("August 22, 2017", "2017-08-22")).toBe(false);
  });
});
