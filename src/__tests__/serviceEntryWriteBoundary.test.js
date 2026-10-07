/**
 * ADR-007: servicePeriods[] is the one authoritative store; every other
 * copy of the service entry date (the flat profile mirror, dd214Data, the
 * VKB's service-entry subset) is a PROJECTION. This is enforced at review
 * time by this static scan, not by a runtime warning nobody reads - any
 * future write path must route through setServiceEntryDate/
 * updateServicePeriod/addServicePeriod (veteranProfile.js) instead of
 * assigning the mirrored fields directly. Same readFileSync pattern as
 * s6Cleanup.test.js.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(process.cwd(), "src");

const DIRECT_WRITE_RE =
  /\b(profile|veteranProfile|dd214Data|dd214|serviceHistory|sh)\.(serviceStartDate|serviceStartDateDerived|entryDate|entryDateDerived)\s*=(?!=)/;

const STORAGE_KEY_WRITE_RE =
  /localStorage\.setItem\(\s*["'](vet_rate_veteran_profile|vet_rate_service_history)["']/;

const DIRECT_WRITE_ALLOWED = new Set([
  "src/utils/veteranProfile.js",
  "src/utils/veteranKnowledgeBase.js",
  "src/utils/serviceEntryView.js",
  // Dormant shape-3 (VA API) writer, flagged as a follow-up (ADR-007 §15
  // / vaDataPersistence.js:123) - out of scope for this brief (boundaries:
  // "Do not modify vaDataPersistence.js in this brief").
  "src/utils/vaDataPersistence.js",
]);

const STORAGE_KEY_ALLOWED = new Set([
  "src/utils/veteranProfile.js",
  "src/utils/persistentStorage.js",
  "src/components/DemoDataLoader.jsx",
]);

// DIRECT_WRITE_RE only catches `obj.field =` assignment syntax - the real
// bypasses this feature actually had (an object-literal spread passed
// straight to one of the chokepoint sinks: FormsHelper's
// saveVeteranProfile(profileData), VKBViewer's saveVKB(fresh) built from
// edited state, DocumentIntelligenceBriefing's verifiedData) never assign
// with `=` at all. This catches a mirrored field written as an object-
// literal key anywhere within a call to one of those three sinks, outside
// the sinks' own implementation files.
const SINK_CALLS = ["saveVeteranProfile(", "updateVeteranProfile(", "saveVKB("];
const SINK_FIELD_KEY_RE =
  /\b(serviceStartDate|serviceStartDateDerived|entryDate|entryDateDerived)\s*:/;
const SINK_CALL_ALLOWED = new Set([
  "src/utils/veteranProfile.js",
  "src/utils/veteranKnowledgeBase.js",
]);

function _sinkCallArgSlices(src) {
  const slices = [];
  for (const call of SINK_CALLS) {
    let idx = src.indexOf(call);
    while (idx !== -1) {
      slices.push(src.slice(idx, idx + 400));
      idx = src.indexOf(call, idx + call.length);
    }
  }
  return slices;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (/\.(js|jsx)$/.test(entry) && !/\.test\./.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function relPath(full) {
  return relative(process.cwd(), full).split("\\").join("/");
}

describe("service-entry write boundary: no direct write outside the projection's own files", () => {
  it("the DIRECT_WRITE regex actually catches a violation (self-check)", () => {
    expect(DIRECT_WRITE_RE.test("profile.serviceStartDate = value;")).toBe(
      true,
    );
    expect(DIRECT_WRITE_RE.test("dd214Data.entryDate = value;")).toBe(true);
    expect(DIRECT_WRITE_RE.test("sh.entryDateDerived = value;")).toBe(true);
    // Never a false positive on a comparison or a differently-named field.
    expect(DIRECT_WRITE_RE.test("profile.serviceStartDate === value")).toBe(
      false,
    );
    expect(
      DIRECT_WRITE_RE.test("profile.serviceStartDateSource = value;"),
    ).toBe(false);
  });

  it("the STORAGE_KEY regex actually catches a violation (self-check)", () => {
    expect(
      STORAGE_KEY_WRITE_RE.test(
        'localStorage.setItem("vet_rate_veteran_profile", JSON.stringify(x))',
      ),
    ).toBe(true);
    expect(
      STORAGE_KEY_WRITE_RE.test("localStorage.setItem(SOME_OTHER_KEY, x)"),
    ).toBe(false);
  });

  it("no file outside the allowlist assigns a mirrored service-entry field directly", () => {
    const offenders = [];
    for (const full of walk(SRC_ROOT)) {
      const rel = relPath(full);
      if (DIRECT_WRITE_ALLOWED.has(rel)) continue;
      const src = readFileSync(full, "utf8");
      if (DIRECT_WRITE_RE.test(src)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("no file outside the allowlist writes vet_rate_veteran_profile/vet_rate_service_history directly", () => {
    const offenders = [];
    for (const full of walk(SRC_ROOT)) {
      const rel = relPath(full);
      if (STORAGE_KEY_ALLOWED.has(rel)) continue;
      const src = readFileSync(full, "utf8");
      if (STORAGE_KEY_WRITE_RE.test(src)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("the SINK_FIELD_KEY regex actually catches a violation (self-check)", () => {
    expect(
      SINK_FIELD_KEY_RE.test("saveVeteranProfile({ serviceStartDate: x })"),
    ).toBe(true);
    expect(SINK_FIELD_KEY_RE.test("saveVeteranProfile({ fullName: x })")).toBe(
      false,
    );
  });

  it("no editor outside the allowlist spreads a mirrored field into a chokepoint sink call", () => {
    const offenders = [];
    for (const full of walk(SRC_ROOT)) {
      const rel = relPath(full);
      if (SINK_CALL_ALLOWED.has(rel)) continue;
      const src = readFileSync(full, "utf8");
      const hit = _sinkCallArgSlices(src).some((slice) =>
        SINK_FIELD_KEY_RE.test(slice),
      );
      if (hit) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
