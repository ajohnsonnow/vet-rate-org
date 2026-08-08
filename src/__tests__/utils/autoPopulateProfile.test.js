/**
 * FIX-9: profile never auto-populated. Two root causes —
 * (1) applyServiceRecordToProfileUpdates read entryDate/separationDate/
 *     characterOfService while parseServiceRecord emits serviceStartDate/
 *     serviceEndDate/dischargeType, so every conditional was false.
 * (2) processFormationDocument (single-document path) never called
 *     autoPopulateProfile at all.
 * Also covers the "don't clobber the user" overwrite semantics:
 * fill-if-empty, document may keep refining, but a user-edited field is
 * never silently overwritten — a conflict is surfaced instead.
 */
import { describe, it, expect, beforeEach } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { autoPopulateProfile } = await import("../../utils/musterCallProcessor");
const { getVeteranProfile, saveVeteranProfile } =
  await import("../../utils/veteranProfile");

const serviceRecordResult = (overrides = {}) => ({
  filename: "dd214.pdf",
  status: "complete",
  extractedData: {
    type: "service_record",
    branch: "Army",
    serviceStartDate: "06/01/2010",
    serviceEndDate: "05/30/2015",
    dischargeType: "HONORABLE",
    mos: "11B",
    ...overrides,
  },
});

describe("FIX-9: autoPopulateProfile field-name mismatch fix", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("fills an empty profile from parseServiceRecord's field names (serviceStartDate/serviceEndDate/dischargeType)", async () => {
    const result = await autoPopulateProfile([serviceRecordResult()]);
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);

    const profile = getVeteranProfile();
    expect(profile.branch).toBe("Army");
    expect(profile.serviceStartDate).toBe("06/01/2010");
    expect(profile.serviceEndDate).toBe("05/30/2015");
    expect(profile.characterOfService).toBe("HONORABLE");
    expect(profile.mos).toBe("11B");
  });

  it("also accepts dd214FieldExtractor's naming (entryDate/separationDate/characterOfService)", async () => {
    const result = await autoPopulateProfile([
      serviceRecordResult({
        serviceStartDate: undefined,
        serviceEndDate: undefined,
        dischargeType: undefined,
        entryDate: "01/01/2008",
        separationDate: "01/01/2012",
        characterOfService: "GENERAL",
      }),
    ]);
    expect(result.success).toBe(true);

    const profile = getVeteranProfile();
    expect(profile.serviceStartDate).toBe("01/01/2008");
    expect(profile.serviceEndDate).toBe("01/01/2012");
    expect(profile.characterOfService).toBe("GENERAL");
  });
});

describe("FIX-17: autoPopulateProfile maps extracted name fields onto the profile", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("fills firstName/lastName/middleName/fullName from veteranName/lastName/firstName/middleName", async () => {
    const result = await autoPopulateProfile([
      serviceRecordResult({
        veteranName: "WILLIAMS, ROBERT LEE",
        lastName: "WILLIAMS",
        firstName: "ROBERT",
        middleName: "LEE",
      }),
    ]);
    expect(result.success).toBe(true);

    const profile = getVeteranProfile();
    expect(profile.fullName).toBe("WILLIAMS, ROBERT LEE");
    expect(profile.firstName).toBe("ROBERT");
    expect(profile.lastName).toBe("WILLIAMS");
    expect(profile.middleName).toBe("LEE");
  });

  it("never overwrites a manually-entered name, and surfaces a conflict instead", async () => {
    saveVeteranProfile({
      firstName: "Robert",
      lastName: "Williams",
      profileFieldSources: { firstName: "user", lastName: "user" },
    });

    const result = await autoPopulateProfile([
      serviceRecordResult({
        lastName: "SMITH",
        firstName: "JOHN",
      }),
    ]);

    const profile = getVeteranProfile();
    expect(profile.firstName).toBe("Robert");
    expect(profile.lastName).toBe("Williams");
    expect(result.conflicts.map((c) => c.field)).toEqual(
      expect.arrayContaining(["firstName", "lastName"]),
    );
  });
});

describe("FIX-9: overwrite semantics — never clobber a user-edited field", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("fills an empty field and marks its source as document", async () => {
    await autoPopulateProfile([serviceRecordResult()]);
    const profile = getVeteranProfile();
    expect(profile.profileFieldSources.branch).toBe("document");
  });

  it("lets a later document refine a field that was only ever document-sourced", async () => {
    await autoPopulateProfile([serviceRecordResult({ branch: "Army" })]);
    await autoPopulateProfile([
      serviceRecordResult({ branch: "Army National Guard" }),
    ]);

    const profile = getVeteranProfile();
    expect(profile.branch).toBe("Army National Guard");
  });

  it("never overwrites a field the user manually edited, and surfaces a conflict instead", async () => {
    // Simulate the Profile tab's save handler marking a field user-edited
    saveVeteranProfile({
      branch: "Marine Corps",
      profileFieldSources: { branch: "user" },
    });

    const result = await autoPopulateProfile([
      serviceRecordResult({ branch: "Army" }),
    ]);

    const profile = getVeteranProfile();
    expect(profile.branch).toBe("Marine Corps");
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      field: "branch",
      profileValue: "Marine Corps",
      documentValue: "Army",
    });
  });
});
