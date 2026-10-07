/**
 * ADR-007 [G5]: myPacketManager's "Entry:" AI-context line is now a
 * projection of the canonical resolver (getServiceEntryForDocument), not
 * the document's own raw extractedData - so a veteran's correction, or a
 * later document's higher-precedence date, shows here with honest
 * provenance instead of silently disagreeing with every other consumer.
 * Fixture values are synthetic, not any real veteran's data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { _formatServiceRecordBasics } from "./myPacketManager";
import { upsertServicePeriod, setServiceEntryDate } from "./veteranProfile";

const PROFILE_KEY = "vet_rate_veteran_profile";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ fullName: "Jordan Sample" }),
  );
});

describe("_formatServiceRecordBasics: the Entry line", () => {
  it("shows the calculated marker for an unproven NGB-22 entry date", () => {
    upsertServicePeriod(
      {
        serviceStartDate: "2002-01-10",
        serviceStartDateDerived: true,
        serviceEndDate: "2010-06-15",
        formType: "NGB22",
      },
      { sourceDocument: "ngb22-synthetic.pdf", confidence: 60 },
    );
    const out = _formatServiceRecordBasics(
      { entryDate: "2002-01-10", entryDateDerived: true },
      "ngb22-synthetic.pdf",
    );
    expect(out).toContain("Entry: 2002-01-10 (calculated from net service)");
  });

  it("shows the effective (corrected) date and the veteran-corrected note", () => {
    const id = upsertServicePeriod(
      {
        serviceStartDate: "2002-01-10",
        serviceStartDateDerived: true,
        serviceEndDate: "2010-06-15",
        formType: "NGB22",
      },
      { sourceDocument: "ngb22-synthetic.pdf", confidence: 60 },
    );
    setServiceEntryDate({
      date: "2001-11-01",
      via: "muster_review",
      periodId: id,
    });

    const out = _formatServiceRecordBasics(
      { entryDate: "2002-01-10", entryDateDerived: true },
      "ngb22-synthetic.pdf",
    );
    expect(out).toContain("Entry: 2001-11-01");
    expect(out).toContain("veteran-corrected; this document shows 2002-01-10");
    expect(out).not.toContain("(calculated from net service)");
  });

  it("falls back to the document's own value when no period is linked to this file", () => {
    const out = _formatServiceRecordBasics(
      { entryDate: "1990-01-01", entryDateDerived: false },
      "unlinked.pdf",
    );
    expect(out).toContain("Entry: 1990-01-01\n");
  });

  it("prints nothing when the document states no entry date at all", () => {
    const out = _formatServiceRecordBasics({ branch: "Army" }, "some.pdf");
    expect(out).not.toContain("Entry:");
  });
});

describe("_formatServiceRecordBasics: the Entry line after a later document merges onto the corrected period", () => {
  it("names THIS document's own value, not a later code sheet's", () => {
    const id = upsertServicePeriod(
      {
        serviceStartDate: "2002-03-05",
        serviceStartDateDerived: true,
        serviceEndDate: "2010-06-15",
        formType: "NGB22",
      },
      { sourceDocument: "ngb22-synthetic.pdf", confidence: 60 },
    );
    setServiceEntryDate({
      date: "2002-08-01",
      via: "my_packet",
      periodId: id,
    });

    // Merges onto the same period (its start is within the correction
    // alias tolerance of the NGB-22's original documentDate) and, being a
    // veteran-owned period, never moves serviceStartDate - it only
    // refreshes startDateCorrection.documentDate/documentSource.
    upsertServicePeriod(
      {
        serviceStartDate: "2002-03-01",
        serviceEndDate: "2010-06-15",
        formType: "Code Sheet",
      },
      {
        sourceDocument: "codesheet-synthetic.pdf",
        confidence: 100,
        authoritativeDates: true,
      },
    );

    const out = _formatServiceRecordBasics(
      { entryDate: "2002-03-05", entryDateDerived: true },
      "ngb22-synthetic.pdf",
    );
    expect(out).toContain("Entry: 2002-08-01");
    expect(out).toContain("veteran-corrected; this document shows 2002-03-05");
    expect(out).not.toContain("2002-03-01");
  });
});
