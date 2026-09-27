/**
 * fix/dossier-and-vkb-periods: generateProfileSection read profile.startDate/
 * profile.endDate, fields nothing ever writes - the profile stores
 * serviceStartDate/serviceEndDate (see veteranProfile.js) - so every exported
 * dossier showed "Service Dates: ? - ?" regardless of what the veteran had
 * entered. Fixture values are synthetic.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { generateDossierHTML } from "./dossierExport";

const PROFILE_KEY = "vet_rate_veteran_profile";

describe("generateDossierHTML: Service Dates reads the real profile field names", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the veteran's saved serviceStartDate/serviceEndDate", () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        fullName: "Jordan Sample",
        serviceStartDate: "2002-05-06",
        serviceEndDate: "2007-06-29",
      }),
    );

    const html = generateDossierHTML();
    expect(html).toContain("2002-05-06");
    expect(html).toContain("2007-06-29");
    expect(html).not.toContain("? - ?");
  });

  it('falls back to "?" when no profile dates are saved', () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ fullName: "Jordan Sample" }),
    );

    const html = generateDossierHTML();
    expect(html).toContain("? - ?");
  });

  it('marks a calculated start date as "(calculated from net service)", matching every other AI-facing context', () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        fullName: "Jordan Sample",
        serviceStartDate: "2002-03-05",
        serviceStartDateDerived: true,
        serviceEndDate: "2010-06-15",
      }),
    );

    const html = generateDossierHTML();
    expect(html).toContain(
      "2002-03-05 (calculated from net service) - 2010-06-15",
    );
  });

  it("does not mark a genuinely printed start date as calculated", () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        fullName: "Jordan Sample",
        serviceStartDate: "2002-03-05",
        serviceEndDate: "2010-06-15",
      }),
    );

    const html = generateDossierHTML();
    expect(html).not.toContain("calculated from net service");
  });
});
