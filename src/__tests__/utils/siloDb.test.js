import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_SILO_KEY, VSO_REGISTRY_KEY } from "../../utils/siloScope";

const LEGACY_ID = "aaaaaaaaaaaa";
const OTHER_ID = "bbbbbbbbbbbb";
const STAMP = "2026-01-01T00:00:00.000Z";

function entry(id, legacy) {
  return {
    id,
    initials: "JD",
    caseRef: "CASE-1",
    createdAt: STAMP,
    lastOpenedAt: STAMP,
    authAckAt: STAMP,
    reviewBy: null,
    legacy,
    deleting: false,
    enc: "none",
  };
}

function plant({ active, silos }) {
  localStorage.setItem(VSO_REGISTRY_KEY, JSON.stringify({ version: 1, silos }));
  if (active !== undefined) localStorage.setItem(ACTIVE_SILO_KEY, active);
}

const SHARED_DB_NAMES = ["VetRate_DKB", "vet-rate-dbq-cache"];
const MODEL_CACHE_NAMES = [
  "vetrate-ai-models",
  "vetrate-vectors",
  "voy-vectors",
  "transformers-cache",
  "onnx-models",
  "webllm-cache",
  "vet-rate-cache",
  "vetrate-storage",
];

// siloDb resolves the active veteran once at import, so each case imports a
// fresh copy of the module after planting its storage state.
async function loadSiloDb() {
  vi.resetModules();
  return import("../../utils/siloDb");
}

beforeEach(() => {
  localStorage.clear();
});

describe("siloDbName", () => {
  it("returns the plain base name when there is no registry", async () => {
    const { siloDbName } = await loadSiloDb();
    expect(siloDbName("VetRateMyPacket")).toBe("VetRateMyPacket");
    expect(siloDbName("keyval-store")).toBe("keyval-store");
  });

  it("ignores a stray active-silo key when there is no registry", async () => {
    localStorage.setItem(ACTIVE_SILO_KEY, OTHER_ID);
    const { siloDbName } = await loadSiloDb();
    expect(siloDbName("VetRateVKB")).toBe("VetRateVKB");
  });

  it("returns the unsuffixed base name for the legacy veteran", async () => {
    plant({
      active: LEGACY_ID,
      silos: [entry(LEGACY_ID, true), entry(OTHER_ID, false)],
    });
    const { siloDbName } = await loadSiloDb();
    expect(siloDbName("VetRateMyPacket")).toBe("VetRateMyPacket");
  });

  it("suffixes every database name for a non-legacy veteran", async () => {
    plant({
      active: OTHER_ID,
      silos: [entry(LEGACY_ID, true), entry(OTHER_ID, false)],
    });
    const { siloDbName } = await loadSiloDb();
    expect(siloDbName("VetRateMyPacket")).toBe(
      `VetRateMyPacket__s_${OTHER_ID}`,
    );
    expect(siloDbName("keyval-store")).toBe(`keyval-store__s_${OTHER_ID}`);
  });

  it("suffixes a veteran when no legacy veteran exists", async () => {
    plant({ active: OTHER_ID, silos: [entry(OTHER_ID, false)] });
    const { siloDbName } = await loadSiloDb();
    expect(siloDbName("VetRateVKB")).toBe(`VetRateVKB__s_${OTHER_ID}`);
  });

  it("reads the active veteran once, when the module loads", async () => {
    plant({
      active: OTHER_ID,
      silos: [entry(LEGACY_ID, true), entry(OTHER_ID, false)],
    });
    const { siloDbName } = await loadSiloDb();
    localStorage.setItem(ACTIVE_SILO_KEY, LEGACY_ID);
    expect(siloDbName("VetRateVKB")).toBe(`VetRateVKB__s_${OTHER_ID}`);
  });

  it("fails on use, not on import, when the registry exists but no veteran is active", async () => {
    plant({ silos: [entry(LEGACY_ID, true)] });
    const { siloDbName, SiloScopeError } = await loadSiloDb();
    expect(() => siloDbName("VetRateVKB")).toThrow(SiloScopeError);
  });

  it("refuses to fall back to the legacy names for an active id the registry does not list", async () => {
    plant({ active: "cccccccccccc", silos: [entry(LEGACY_ID, true)] });
    const { siloDbName, SiloScopeError } = await loadSiloDb();
    expect(() => siloDbName("VetRateVKB")).toThrow(SiloScopeError);
  });

  it("refuses to fall back to the legacy names when the registry is corrupt", async () => {
    localStorage.setItem(VSO_REGISTRY_KEY, "{not json");
    localStorage.setItem(ACTIVE_SILO_KEY, OTHER_ID);
    const { siloDbName, SiloScopeError } = await loadSiloDb();
    expect(() => siloDbName("VetRateVKB")).toThrow(SiloScopeError);
  });

  it("does not put the registry contents in the error message", async () => {
    plant({ active: "cccccccccccc", silos: [entry(LEGACY_ID, true)] });
    const { siloDbName } = await loadSiloDb();
    let message = "";
    try {
      siloDbName("VetRateVKB");
    } catch (error) {
      message = error.message;
    }
    expect(message).not.toContain("CASE-1");
    expect(message).not.toContain("cccccccccccc");
  });
});

describe("dbNameForSilo", () => {
  it("maps legacy to the base name and others to a suffixed name", async () => {
    const { dbNameForSilo } = await loadSiloDb();
    expect(dbNameForSilo("VetRateVKB", { id: LEGACY_ID, legacy: true })).toBe(
      "VetRateVKB",
    );
    expect(dbNameForSilo("VetRateVKB", { id: OTHER_ID, legacy: false })).toBe(
      `VetRateVKB__s_${OTHER_ID}`,
    );
  });
});

describe("PER_VETERAN_DB_BASES", () => {
  it("lists exactly the nine per-veteran databases of spec section 2", async () => {
    const { PER_VETERAN_DB_BASES } = await loadSiloDb();
    expect([...PER_VETERAN_DB_BASES].sort()).toEqual(
      [
        "VetRateAutoBackup",
        "VetRateBugSquasher",
        "VetRateFeatureRequests",
        "VetRateMyPacket",
        "VetRateVKB",
        "VetRate_CFileStream",
        "VetRate_SiloSnapshot",
        "VetRate_UserDocVectors",
        "keyval-store",
      ].sort(),
    );
  });

  it("excludes every shared database and model cache", async () => {
    const { PER_VETERAN_DB_BASES } = await loadSiloDb();
    for (const shared of [...SHARED_DB_NAMES, ...MODEL_CACHE_NAMES]) {
      expect(PER_VETERAN_DB_BASES).not.toContain(shared);
    }
  });

  it("has no duplicates and no already-suffixed names", async () => {
    const { PER_VETERAN_DB_BASES, SILO_DB_SEPARATOR } = await loadSiloDb();
    expect(new Set(PER_VETERAN_DB_BASES).size).toBe(
      PER_VETERAN_DB_BASES.length,
    );
    for (const base of PER_VETERAN_DB_BASES) {
      expect(base).not.toContain(SILO_DB_SEPARATOR);
    }
  });

  it("is frozen", async () => {
    const { PER_VETERAN_DB_BASES } = await loadSiloDb();
    expect(Object.isFrozen(PER_VETERAN_DB_BASES)).toBe(true);
  });

  it("gives no two (veteran, database) pairs the same name", async () => {
    const { PER_VETERAN_DB_BASES, dbNameForSilo } = await loadSiloDb();
    const silos = [
      { id: LEGACY_ID, legacy: true },
      { id: OTHER_ID, legacy: false },
      { id: "cccccccccccc", legacy: false },
    ];
    const names = silos.flatMap((silo) =>
      PER_VETERAN_DB_BASES.map((base) => dbNameForSilo(base, silo)),
    );
    expect(new Set(names).size).toBe(names.length);
  });
});

function sourceFiles(dir) {
  const files = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (dirent.name !== "__tests__") files.push(...sourceFiles(path));
    } else if (
      /\.(?:[cm]?[jt]sx?)$/.test(dirent.name) &&
      !/\.(?:test|spec)\./.test(dirent.name)
    ) {
      files.push(path);
    }
  }
  return files;
}

function codeLines(file) {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:\/\/|\/?\*)/.test(line));
}

describe("PER_VETERAN_DB_BASES drift guard", () => {
  // Drift guard: scan every source file under src/ for a database being
  // opened, so a database opened in a new file fails here instead of leaking
  // between veterans unnoticed. A file that opens one must be listed below
  // with the pattern that declares its name, and that name must be on exactly
  // one of the per-veteran and shared lists.
  const DECLARATIONS = {
    "src/utils/autoBackup.js": /DB_NAME:\s*"([^"]+)"/,
    "src/utils/bugReportStorage.js": /const DB_NAME = "([^"]+)"/,
    "src/utils/featureRequestStorage.js": /const DB_NAME = "([^"]+)"/,
    "src/utils/myPacketManager.js": /const PACKET_DB_NAME = "([^"]+)"/,
    "src/utils/pdfExtractor.js": /const CFILE_DB_NAME = "([^"]+)"/,
    "src/utils/userDocSemanticIndex.js": /const USERDOC_DB_NAME = "([^"]+)"/,
    "src/utils/veteranKnowledgeBase.js": /const VKB_DB_NAME = "([^"]+)"/,
    "src/utils/dkbIndexedDB.js": /const DB_NAME = "([^"]+)"/,
    "src/utils/dbqOfflineStorage.js": /const DB_NAME = "([^"]+)"/,
  };
  const KEYVAL_IMPORTERS = [
    "src/utils/aiAuditLog.js",
    "src/utils/logger.js",
    "src/utils/storage.js",
  ];
  const KEYVAL_IMPORT =
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']idb-keyval["']/;
  const INDEXEDDB_OPEN = /\bindexedDB\s*\.\s*open\s*\(/;

  const found = { open: [], keyval: [] };
  for (const file of sourceFiles("src")) {
    const path = file.replaceAll("\\", "/");
    const lines = codeLines(file);
    if (lines.some((line) => INDEXEDDB_OPEN.test(line))) found.open.push(path);
    if (lines.some((line) => KEYVAL_IMPORT.test(line))) {
      found.keyval.push(path);
    }
  }

  it("finds every file under src/ that opens a database directly", () => {
    expect([...found.open].sort()).toEqual(Object.keys(DECLARATIONS).sort());
  });

  it("finds every file under src/ that imports idb-keyval", () => {
    expect([...found.keyval].sort()).toEqual([...KEYVAL_IMPORTERS].sort());
  });

  it("accounts for the database name declared in every file that opens one", async () => {
    const { PER_VETERAN_DB_BASES } = await loadSiloDb();
    const shared = new Set(SHARED_DB_NAMES);
    for (const file of found.open) {
      const pattern = DECLARATIONS[file];
      expect(
        pattern,
        `${file} opens a database but is not listed`,
      ).toBeDefined();
      const match = pattern.exec(readFileSync(file, "utf8"));
      expect(
        match,
        `${file} no longer declares a database name`,
      ).not.toBeNull();
      const name = match[1];
      expect(
        PER_VETERAN_DB_BASES.includes(name) !== shared.has(name),
        `${file} opens "${name}", which must be on exactly one of the per-veteran and shared lists`,
      ).toBe(true);
    }
  });

  it("puts the idb-keyval default database on the per-veteran list", async () => {
    const { PER_VETERAN_DB_BASES } = await loadSiloDb();
    expect(PER_VETERAN_DB_BASES).toContain("keyval-store");
  });
});
