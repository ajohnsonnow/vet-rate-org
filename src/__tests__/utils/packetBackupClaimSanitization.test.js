/**
 * Characterization coverage for packetBackup's internal sanitizeClaimField
 * (exercised via the exported exportPacketData), added while splitting it
 * into helpers to satisfy sonarjs/cognitive-complexity. No existing test
 * exercised this function directly, despite it being the XSS/injection
 * boundary for every imported/exported claim field.
 */
import { describe, it, expect } from "vitest";
import { exportPacketData } from "../../utils/packetBackup";

const exportOneClaim = (claim) => exportPacketData([claim], {}).data.claims[0];

describe("packetBackup: sanitizeClaimField - id/conditionName/status/date", () => {
  it("id: sanitizes and truncates like any other string field", () => {
    const claim = {
      id: "claim<script>alert(1)</script>_1",
      conditionName: "PTSD",
    };
    expect(exportOneClaim(claim).id).toBe("claim_1");
  });

  it("conditionName/parentCondition: sanitized when present, null when falsy", () => {
    const claim = {
      conditionName: "PTSD<script>alert(1)</script>",
      parentCondition: "",
    };
    const result = exportOneClaim(claim);
    expect(result.conditionName).toBe("PTSD");
    expect(result.parentCondition).toBeNull();
  });

  it("status: falls back to 'Drafting' for an invalid value, keeps a valid one", () => {
    const invalid = exportOneClaim({
      conditionName: "PTSD",
      status: "BogusStatus",
    });
    expect(invalid.status).toBe("Drafting");

    const valid = exportOneClaim({ conditionName: "PTSD", status: "Filed" });
    expect(valid.status).toBe("Filed");
  });

  it("dateSaved/dateUpdated: a valid date round-trips to its ISO form", () => {
    const claim = {
      conditionName: "PTSD",
      dateSaved: "2026-01-15T00:00:00.000Z",
      dateUpdated: "2026-02-20T00:00:00.000Z",
    };
    const result = exportOneClaim(claim);
    expect(result.dateSaved).toBe("2026-01-15T00:00:00.000Z");
    expect(result.dateUpdated).toBe("2026-02-20T00:00:00.000Z");
  });

  it("dateSaved: an invalid date is replaced with a fresh ISO timestamp, not dropped", () => {
    const result = exportOneClaim({
      conditionName: "PTSD",
      dateSaved: "not-a-date",
    });
    expect(result.dateSaved).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("packetBackup: sanitizeClaimField - integer/notes/unlisted fields", () => {
  it("diagnosticCode/selectedRating: parsed as an in-range integer", () => {
    const result = exportOneClaim({
      conditionName: "PTSD",
      diagnosticCode: "5237",
      selectedRating: "70",
    });
    expect(result.diagnosticCode).toBe(5237);
    expect(result.selectedRating).toBe(70);
  });

  it("diagnosticCode/selectedRating: an out-of-range or non-numeric value is dropped entirely", () => {
    const result = exportOneClaim({
      conditionName: "PTSD",
      diagnosticCode: "999999",
      selectedRating: "not-a-number",
    });
    expect(result).not.toHaveProperty("diagnosticCode");
    expect(result).not.toHaveProperty("selectedRating");
  });

  it("notes: sanitized, and an absent value becomes an empty string rather than being dropped", () => {
    const result = exportOneClaim({
      conditionName: "PTSD",
      notes: "line one\0with a null byte",
    });
    expect(result.notes).toBe("line onewith a null byte");
  });

  it("an unlisted string field (e.g. claimType) falls through to the generic string sanitizer", () => {
    const result = exportOneClaim({
      conditionName: "PTSD",
      claimType: "Increase<script>alert(1)</script>",
    });
    expect(result.claimType).toBe("Increase");
  });

  it("an unlisted non-string field is dropped entirely", () => {
    const result = exportOneClaim({
      conditionName: "PTSD",
      claimType: 12345,
    });
    expect(result).not.toHaveProperty("claimType");
  });
});
