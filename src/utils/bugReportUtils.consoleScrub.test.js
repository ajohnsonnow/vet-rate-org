/* eslint-disable no-console -- the interceptor under test wraps the console methods */
/**
 * D20-4: the bug-report console interceptor captured console lines that can
 * contain the veteran's identifiers. Every captured line must be scrubbed
 * (pattern scrubber plus known-value redaction) before it is stored or
 * returned for a report, and what is kept must be capped.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";

const PLANTED = {
  fullName: "Zebulon Quillfeather",
  surname: "Quillfeather",
  ssn: "512-34-9876",
  street: "4417 Marigold Lane",
  city: "Springfield",
  fileNumber: "C-000777123",
  claimNumber: "8675309",
};
const PLANTED_VALUES = [
  PLANTED.fullName,
  PLANTED.surname,
  PLANTED.ssn,
  PLANTED.street,
  PLANTED.fileNumber,
  PLANTED.claimNumber,
];
const PLANTED_PROFILE = {
  fullName: PLANTED.fullName,
  ssn: PLANTED.ssn,
  vaFileNumber: PLANTED.fileNumber,
  street: PLANTED.street,
  city: PLANTED.city,
};

let mockProfile = {};
vi.mock("./veteranProfile", () => ({
  readVeteranProfileQuiet: () => ({
    status: "ok",
    ok: true,
    profile: mockProfile,
    raw: JSON.stringify(mockProfile),
    code: null,
  }),
}));

const {
  initializeErrorCapture,
  getConsoleErrors,
  logConsoleError,
  refreshKnownIdentifiers,
  setKnownIdentifiersForConsoleScrub,
} = await import("./bugReportUtils.js");

const STORAGE_KEY = "vet_rate_console_logs";
const realConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log,
  info: console.info,
};

const rawStored = () => sessionStorage.getItem(STORAGE_KEY) || "";

function expectNoPlantedValue(text) {
  for (const value of PLANTED_VALUES) {
    expect(text).not.toContain(value);
  }
}

// What the profile module announces when the veteran's profile is saved.
function profileSaved(profile) {
  mockProfile = profile;
  window.dispatchEvent(new CustomEvent("vetrate:profile-changed"));
}

async function loadProfile(profile) {
  mockProfile = profile;
  await refreshKnownIdentifiers();
}

beforeAll(() => {
  initializeErrorCapture();
});

afterAll(() => {
  Object.assign(console, realConsole);
});

beforeEach(async () => {
  sessionStorage.clear();
  setKnownIdentifiersForConsoleScrub({}, [PLANTED.claimNumber]);
  await loadProfile(PLANTED_PROFILE);
});

describe("console interceptor: identifiers never reach storage or a report", () => {
  it("scrubs a name and SSN written with console.error", () => {
    console.error(
      `Profile save failed for ${PLANTED.fullName} SSN ${PLANTED.ssn}`,
    );

    expectNoPlantedValue(rawStored());
    expectNoPlantedValue(JSON.stringify(getConsoleErrors()));
    expect(getConsoleErrors()[0].message).toContain("Profile save failed");
  });

  it("scrubs identifiers inside an object argument to console.warn", () => {
    console.warn("lookup", {
      owner: PLANTED.fullName,
      file: PLANTED.fileNumber,
    });

    expectNoPlantedValue(rawStored());
    expect(getConsoleErrors()).toHaveLength(1);
  });

  it("scrubs an address and claim number in a keyword-matched console.log", () => {
    console.log(
      `request failed at ${PLANTED.street} for claim ${PLANTED.claimNumber}`,
    );

    expectNoPlantedValue(rawStored());
    expect(getConsoleErrors()[0].message).toContain("request failed");
  });

  it("scrubs the stack and page url of a logged entry too", () => {
    logConsoleError({
      type: "error",
      message: "boom",
      stack: `Error: boom for ${PLANTED.fullName}\n    at x (app.js:1:1)`,
      url: `https://example.test/?name=${PLANTED.surname}`,
    });

    const [entry] = getConsoleErrors();
    expectNoPlantedValue(JSON.stringify(entry));
    expectNoPlantedValue(rawStored());
  });

  it("keeps a line that holds no identifier intact", () => {
    console.error("Failed to load module chunk-abc.js");

    expect(getConsoleErrors()[0].message).toBe(
      "Failed to load module chunk-abc.js",
    );
  });

  it("does not throw when a logged object is circular", () => {
    const circular = {};
    circular.self = circular;

    expect(() => console.warn("cycle", circular)).not.toThrow();
    expect(getConsoleErrors()).toHaveLength(1);
  });
});

describe("console interceptor: known values loaded after capture", () => {
  const earlyEntry = {
    type: "error",
    message: `early line for ${PLANTED.fullName}`,
    stack: null,
    url: "https://example.test/",
  };

  it("re-scrubs entries stored before the known values were loaded, on read", async () => {
    await loadProfile({});
    setKnownIdentifiersForConsoleScrub({}, []);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([earlyEntry]));

    setKnownIdentifiersForConsoleScrub({ fullName: PLANTED.fullName }, []);

    expectNoPlantedValue(JSON.stringify(getConsoleErrors()));
    expect(rawStored()).toContain(PLANTED.fullName);
  });

  it("rewrites stored entries in place once the saved profile loads", async () => {
    await loadProfile({});
    setKnownIdentifiersForConsoleScrub({}, []);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([earlyEntry]));
    expect(rawStored()).toContain(PLANTED.fullName);

    await loadProfile(PLANTED_PROFILE);

    expectNoPlantedValue(rawStored());
  });
});

describe("console interceptor: what is kept is capped", () => {
  it("keeps only the last 50 entries", () => {
    for (let i = 0; i < 60; i++) {
      logConsoleError({ type: "error", message: `entry ${i}` });
    }

    const logs = getConsoleErrors();
    expect(logs).toHaveLength(50);
    expect(logs[0].message).toBe("entry 10");
    expect(logs[49].message).toBe("entry 59");
  });

  it("clips an oversized message and keeps the clip stable across reads", () => {
    console.error("x".repeat(10000));

    const [first] = getConsoleErrors();
    expect(first.message.length).toBeLessThanOrEqual(2000);
    expect(first.message.endsWith("[truncated]")).toBe(true);
    expect(getConsoleErrors()[0].message).toBe(first.message);
  });

  it("clips an oversized stack", () => {
    logConsoleError({ type: "error", message: "m", stack: "s".repeat(9000) });

    expect(getConsoleErrors()[0].stack.length).toBeLessThanOrEqual(1500);
  });
});

describe("console interceptor: a profile saved after the last refresh", () => {
  it("redacts a name saved moments ago from the stored line and the report", () => {
    const saved = {
      fullName: "Ottoline Brightwater",
      homeOfRecord: "Wahpeton, ND",
    };
    profileSaved(saved);

    console.error("Profile saved for Ottoline Brightwater of Wahpeton, ND");

    const reported = JSON.stringify(getConsoleErrors());
    for (const value of ["Ottoline", "Brightwater", "Wahpeton"]) {
      expect(rawStored()).not.toContain(value);
      expect(reported).not.toContain(value);
    }
  });

  it("redacts a name saved after the line was stored, when the report is read", () => {
    mockProfile = {};
    console.error("Profile saved for Ottoline Brightwater");
    mockProfile = { fullName: "Ottoline Brightwater" };

    expect(JSON.stringify(getConsoleErrors())).not.toContain("Brightwater");
  });
});

describe("console interceptor: every saved-profile identifier is redacted", () => {
  it("redacts home of record, birthplace, spouse, emergency contact, claim and account numbers", () => {
    profileSaved({
      ...PLANTED_PROFILE,
      homeOfRecord: "Wahpeton, ND",
      placeOfBirth: "Kalispell, MT",
      spouseName: "Ottoline Brightwater",
      emergencyContactName: "Barnaby Thistlewood",
      claimNumber: "8675309",
      accountNumber: "000123456789",
    });

    console.error(
      "save failed home Wahpeton, ND born Kalispell, MT spouse Ottoline Brightwater contact Barnaby Thistlewood claim 8675309 acct 000123456789",
    );

    const reported = JSON.stringify(getConsoleErrors());
    for (const value of [
      "Wahpeton",
      "Kalispell",
      "Ottoline",
      "Brightwater",
      "Barnaby",
      "Thistlewood",
      "8675309",
      "000123456789",
    ]) {
      expect(rawStored()).not.toContain(value);
      expect(reported).not.toContain(value);
    }
  });
});
