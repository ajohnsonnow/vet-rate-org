import { beforeEach, describe, expect, it } from "vitest";
import { ACTIVE_SILO_KEY, VSO_REGISTRY_KEY } from "../../utils/siloScope";
import {
  RegistryError,
  addSilo,
  generateSiloId,
  getActiveSiloId,
  isVsoModeActive,
  readRegistry,
  removeSilo,
  siloLabel,
  updateSilo,
  writeRegistry,
} from "../../utils/vsoRegistry";

const STAMP = "2026-03-04T05:06:07.000Z";
const NOW = new Date(STAMP);

function validEntry(overrides = {}) {
  return {
    id: "0123456789ab",
    initials: "JD",
    caseRef: "CASE-1",
    createdAt: STAMP,
    lastOpenedAt: STAMP,
    authAckAt: STAMP,
    reviewBy: null,
    legacy: false,
    deleting: false,
    enc: "none",
    ...overrides,
  };
}

function plantRaw(value) {
  localStorage.setItem(VSO_REGISTRY_KEY, value);
}

function plant(silos, version = 1) {
  plantRaw(JSON.stringify({ version, silos }));
}

function add(overrides = {}) {
  return addSilo(
    {
      initials: "JD",
      caseRef: "CASE-1",
      authorizationAcknowledged: true,
      ...overrides,
    },
    NOW,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("readRegistry", () => {
  it("reports absent when nothing is stored", () => {
    expect(readRegistry()).toEqual({ state: "absent" });
    expect(isVsoModeActive()).toBe(false);
  });

  it("reads a valid registry", () => {
    plant([validEntry(), validEntry({ id: "ba9876543210", legacy: true })]);
    const result = readRegistry();
    expect(result.state).toBe("ok");
    expect(result.registry.silos).toHaveLength(2);
    expect(isVsoModeActive()).toBe(true);
  });

  it("accepts an empty silo list and every enc state", () => {
    plant([]);
    expect(readRegistry().state).toBe("ok");
    for (const enc of ["none", "migrating", "complete"]) {
      plant([validEntry({ enc })]);
      expect(readRegistry().state).toBe("ok");
    }
  });

  it("accepts a calendar-date reviewBy", () => {
    plant([validEntry({ reviewBy: "2028-02-29" })]);
    expect(readRegistry().state).toBe("ok");
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["empty string", ""],
    ["JSON null", "null"],
    ["a JSON array", "[]"],
    ["a JSON string", '"registry"'],
    ["a JSON number", "7"],
    ["a wrong version", JSON.stringify({ version: 2, silos: [] })],
    ["a missing version", JSON.stringify({ silos: [] })],
    ["silos not a list", JSON.stringify({ version: 1, silos: {} })],
    [
      "an unknown top-level field",
      JSON.stringify({ version: 1, silos: [], extra: 1 }),
    ],
  ])("reports corrupt for %s", (_name, raw) => {
    plantRaw(raw);
    const result = readRegistry();
    expect(result.state).toBe("corrupt");
    expect(typeof result.reason).toBe("string");
    expect(isVsoModeActive()).toBe(true);
  });
});

describe("readRegistry entry corruption", () => {
  it.each([
    ["a non-object entry", "x"],
    ["a null entry", null],
    ["a malformed id", validEntry({ id: "XYZ" })],
    ["an uppercase id", validEntry({ id: "0123456789AB" })],
    ["an unknown field", { ...validEntry(), note: "x" }],
    [
      "a missing field",
      (() => {
        const e = validEntry();
        delete e.enc;
        return e;
      })(),
    ],
    ["an invalid label", validEntry({ caseRef: "123-45-6789" })],
    ["a non-ISO createdAt", validEntry({ createdAt: "yesterday" })],
    ["a non-ISO lastOpenedAt", validEntry({ lastOpenedAt: 5 })],
    ["a null authAckAt", validEntry({ authAckAt: null })],
    ["a datetime reviewBy", validEntry({ reviewBy: STAMP })],
    ["an impossible reviewBy date", validEntry({ reviewBy: "2026-02-30" })],
    ["a string legacy flag", validEntry({ legacy: "yes" })],
    ["a string deleting flag", validEntry({ deleting: "no" })],
    ["an unknown enc state", validEntry({ enc: "sealed" })],
  ])("reports corrupt for an entry with %s", (_name, entryValue) => {
    plant([entryValue]);
    expect(readRegistry().state).toBe("corrupt");
  });

  it("reports corrupt for duplicate ids", () => {
    plant([validEntry(), validEntry()]);
    expect(readRegistry()).toMatchObject({
      state: "corrupt",
      reason: "duplicate id",
    });
  });

  it("reports corrupt for two legacy veterans", () => {
    plant([
      validEntry({ legacy: true }),
      validEntry({ id: "ba9876543210", legacy: true }),
    ]);
    expect(readRegistry()).toMatchObject({
      state: "corrupt",
      reason: "more than one legacy veteran",
    });
  });

  it("never puts label text in the corruption reason", () => {
    plant([validEntry({ caseRef: "Jane Roe 123-45-6789" })]);
    const result = readRegistry();
    expect(result.state).toBe("corrupt");
    expect(result.reason).not.toContain("Jane");
    expect(result.reason).not.toContain("6789");
  });
});

describe("writeRegistry", () => {
  it("round-trips a valid registry", () => {
    const registry = { version: 1, silos: [validEntry()] };
    writeRegistry(registry);
    expect(readRegistry()).toEqual({ state: "ok", registry });
  });

  it("refuses an invalid registry and leaves storage untouched", () => {
    writeRegistry({ version: 1, silos: [validEntry()] });
    const before = localStorage.getItem(VSO_REGISTRY_KEY);
    expect(() =>
      writeRegistry({ version: 1, silos: [validEntry({ enc: "bogus" })] }),
    ).toThrow(RegistryError);
    expect(localStorage.getItem(VSO_REGISTRY_KEY)).toBe(before);
  });

  it("stores only the documented fields", () => {
    add();
    const stored = JSON.parse(localStorage.getItem(VSO_REGISTRY_KEY));
    expect(Object.keys(stored).sort()).toEqual(["silos", "version"]);
    expect(Object.keys(stored.silos[0]).sort()).toEqual(
      [
        "authAckAt",
        "caseRef",
        "createdAt",
        "deleting",
        "enc",
        "id",
        "initials",
        "lastOpenedAt",
        "legacy",
        "reviewBy",
      ].sort(),
    );
  });
});

describe("addSilo", () => {
  it("creates the registry on first use and records the authorization time", () => {
    const created = add();
    expect(created).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{12}$/),
      initials: "JD",
      caseRef: "CASE-1",
      createdAt: STAMP,
      lastOpenedAt: STAMP,
      authAckAt: STAMP,
      reviewBy: null,
      legacy: false,
      deleting: false,
      enc: "none",
    });
    expect(readRegistry().registry.silos).toEqual([created]);
  });

  // AC12 (registry half): no acknowledgement, no veteran.
  it.each([undefined, false, "true", 1, null])(
    "refuses to add a veteran when authorizationAcknowledged is %j",
    (value) => {
      expect(() => add({ authorizationAcknowledged: value })).toThrow(
        expect.objectContaining({ code: "AUTH_REQUIRED" }),
      );
      expect(readRegistry()).toEqual({ state: "absent" });
    },
  );
});

describe("addSilo label and bookkeeping", () => {
  it("rejects labels the validator blocks, without storing them", () => {
    expect(() => add({ caseRef: "123-45-6789" })).toThrow(
      expect.objectContaining({ code: "INVALID" }),
    );
    expect(() => add({ initials: "TOOLONG" })).toThrow(RegistryError);
    expect(readRegistry()).toEqual({ state: "absent" });
  });

  it("does not echo the rejected label in the error", () => {
    let message = "";
    try {
      add({ caseRef: "123-45-6789" });
    } catch (error) {
      message = error.message;
    }
    expect(message).not.toContain("123-45-6789");
  });

  it("stores the trimmed, normalised label", () => {
    const created = add({ initials: "  J.D. ", caseRef: "  CASE 9 " });
    expect(created.initials).toBe("J.D.");
    expect(created.caseRef).toBe("CASE 9");
  });

  it("accepts a name-like reference, because that is only a warning", () => {
    expect(add({ caseRef: "Jane Roe" }).caseRef).toBe("Jane Roe");
  });

  it("validates and stores reviewBy", () => {
    expect(add({ reviewBy: "2027-01-31" }).reviewBy).toBe("2027-01-31");
    expect(() => add({ reviewBy: "31/01/2027" })).toThrow(RegistryError);
    expect(() => add({ reviewBy: "2027-02-30" })).toThrow(RegistryError);
  });

  it("allows a reviewBy date that has already passed", () => {
    expect(add({ reviewBy: "2020-01-01" }).reviewBy).toBe("2020-01-01");
  });

  it("appends and gives every veteran a distinct id", () => {
    const ids = Array.from({ length: 25 }, () => add().id);
    expect(new Set(ids).size).toBe(25);
    expect(readRegistry().registry.silos).toHaveLength(25);
  });

  it("allows one legacy veteran and refuses a second", () => {
    expect(add({ legacy: true }).legacy).toBe(true);
    expect(() => add({ legacy: true })).toThrow(
      expect.objectContaining({ code: "DUPLICATE_LEGACY" }),
    );
    expect(add().legacy).toBe(false);
  });

  it("defaults the timestamp to now", () => {
    const before = Date.now();
    const created = addSilo({
      initials: "JD",
      caseRef: "C1",
      authorizationAcknowledged: true,
    });
    expect(Date.parse(created.createdAt)).toBeGreaterThanOrEqual(before);
  });

  it("refuses to overwrite a corrupt registry and leaves it as found", () => {
    plantRaw("{not json");
    expect(() => add()).toThrow(expect.objectContaining({ code: "CORRUPT" }));
    expect(localStorage.getItem(VSO_REGISTRY_KEY)).toBe("{not json");
  });
});

describe("updateSilo", () => {
  it("renames under the same label rules", () => {
    const { id } = add();
    const updated = updateSilo(id, { initials: "AB", caseRef: "CASE-2" });
    expect(siloLabel(updated)).toBe("AB · CASE-2");
    expect(readRegistry().registry.silos[0]).toEqual(updated);
  });

  it("validates a rename against the unchanged other field", () => {
    const { id } = add();
    expect(updateSilo(id, { caseRef: "CASE-3" }).initials).toBe("JD");
    expect(() => updateSilo(id, { initials: "C12345678" })).toThrow(
      expect.objectContaining({ code: "INVALID" }),
    );
    expect(() => updateSilo(id, { caseRef: "000-00-0000" })).toThrow(
      RegistryError,
    );
    expect(readRegistry().registry.silos[0].caseRef).toBe("CASE-3");
  });

  it.each(["123.45.6789", "1 2 3 4 5 6 7 8 9", "C 1234 5678", "123​456789"])(
    "applies the identifier block on rename too: %j",
    (caseRef) => {
      const { id } = add();
      expect(() => updateSilo(id, { caseRef })).toThrow(
        expect.objectContaining({ code: "INVALID" }),
      );
      expect(readRegistry().registry.silos[0].caseRef).toBe("CASE-1");
    },
  );

  it("stores the NFKC-normalised label on rename", () => {
    const { id } = add();
    expect(updateSilo(id, { initials: "ＡＢ" }).initials).toBe("AB");
  });

  it("updates reviewBy, lastOpenedAt, deleting and enc", () => {
    const { id } = add();
    const later = "2026-05-06T07:08:09.000Z";
    const updated = updateSilo(id, {
      reviewBy: "2027-06-01",
      lastOpenedAt: later,
      deleting: true,
      enc: "migrating",
    });
    expect(updated).toMatchObject({
      reviewBy: "2027-06-01",
      lastOpenedAt: later,
      deleting: true,
      enc: "migrating",
    });
    expect(updateSilo(id, { reviewBy: null }).reviewBy).toBeNull();
  });

  it.each([
    ["id", { id: "ffffffffffff" }],
    ["legacy", { legacy: true }],
    ["createdAt", { createdAt: STAMP }],
    ["authAckAt", { authAckAt: STAMP }],
    ["an unknown field", { note: "x" }],
  ])("refuses to change %s", (_name, patch) => {
    const { id } = add();
    expect(() => updateSilo(id, patch)).toThrow(
      expect.objectContaining({ code: "INVALID" }),
    );
  });

  it.each([
    ["enc", { enc: "sealed" }],
    ["deleting", { deleting: "yes" }],
    ["lastOpenedAt", { lastOpenedAt: "soon" }],
    ["reviewBy", { reviewBy: "tomorrow" }],
  ])("refuses an invalid %s", (_name, patch) => {
    const { id } = add();
    expect(() => updateSilo(id, patch)).toThrow(RegistryError);
    expect(readRegistry().registry.silos[0].enc).toBe("none");
  });
});

describe("updateSilo targeting and failures", () => {
  it("only changes the targeted veteran", () => {
    const first = add();
    const second = add({ caseRef: "CASE-2" });
    updateSilo(second.id, { deleting: true });
    const [a, b] = readRegistry().registry.silos;
    expect(a).toEqual(first);
    expect(b.deleting).toBe(true);
  });

  it("reports an unknown veteran", () => {
    add();
    expect(() => updateSilo("ffffffffffff", { enc: "none" })).toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
  });

  it("refuses to update a corrupt registry", () => {
    plantRaw("[]");
    expect(() => updateSilo("0123456789ab", { enc: "none" })).toThrow(
      expect.objectContaining({ code: "CORRUPT" }),
    );
    expect(localStorage.getItem(VSO_REGISTRY_KEY)).toBe("[]");
  });
});

describe("removeSilo", () => {
  it("removes only the named veteran", () => {
    const first = add();
    const second = add({ caseRef: "CASE-2" });
    removeSilo(second.id);
    expect(readRegistry().registry.silos).toEqual([first]);
  });

  it("refuses to remove the active veteran", () => {
    const { id } = add();
    localStorage.setItem(ACTIVE_SILO_KEY, id);
    expect(() => removeSilo(id)).toThrow(
      expect.objectContaining({ code: "ACTIVE_SILO" }),
    );
    expect(readRegistry().registry.silos).toHaveLength(1);
  });

  it("reports an unknown veteran", () => {
    add();
    expect(() => removeSilo("ffffffffffff")).toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
  });

  it("refuses to touch a corrupt registry", () => {
    plantRaw("{");
    expect(() => removeSilo("0123456789ab")).toThrow(
      expect.objectContaining({ code: "CORRUPT" }),
    );
    expect(localStorage.getItem(VSO_REGISTRY_KEY)).toBe("{");
  });
});

describe("helpers", () => {
  it("reads the active veteran id", () => {
    expect(getActiveSiloId()).toBeNull();
    localStorage.setItem(ACTIVE_SILO_KEY, "0123456789ab");
    expect(getActiveSiloId()).toBe("0123456789ab");
  });

  it("generates 12 hex characters and avoids taken ids", () => {
    const id = generateSiloId();
    expect(id).toMatch(/^[0-9a-f]{12}$/);
    expect(generateSiloId([id])).not.toBe(id);
  });

  it("gives up if it can only generate taken ids", () => {
    const original = crypto.randomUUID;
    crypto.randomUUID = () => "01234567-89ab-cdef-0123-456789abcdef";
    try {
      expect(() => generateSiloId(["0123456789ab"])).toThrow(RegistryError);
    } finally {
      crypto.randomUUID = original;
    }
  });

  it("derives the label from the fields and never stores it", () => {
    const created = add({ initials: "J.D.", caseRef: "CASE-1" });
    expect(siloLabel(created)).toBe("J.D. · CASE-1");
    expect(localStorage.getItem(VSO_REGISTRY_KEY)).not.toContain("·");
  });
});
