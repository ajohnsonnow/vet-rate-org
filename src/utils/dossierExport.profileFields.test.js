/**
 * fix/dossier-and-vkb-periods (QA follow-up): generateProfileSection read
 * profile.name and profile.currentRating, fields nothing ever writes -
 * saveVeteranProfile's VALID_PROFILE_FIELDS whitelist (veteranProfile.js)
 * only ever stores fullName and currentCombinedRating. Every real dossier
 * export showed "Name: Not provided" and "Current Combined Rating: 0%" even
 * for a fully rated veteran. Fixture values are synthetic.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { generateDossierHTML } from "./dossierExport";

const PROFILE_KEY = "vet_rate_veteran_profile";

describe("generateDossierHTML: profile section reads the real field names", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the veteran's saved fullName and currentCombinedRating", () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        fullName: "Jordan Sample",
        branch: "Army",
        currentCombinedRating: 70,
        serviceStartDate: "2002-05-06",
        serviceEndDate: "2007-06-29",
      }),
    );

    const html = generateDossierHTML();
    expect(html).toContain("Jordan Sample");
    expect(html).toContain("70%");
    expect(html).not.toContain("Not provided");
  });

  it('falls back to "Not provided" and "0%" when neither field is saved', () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ serviceStartDate: "2002-05-06" }),
    );

    const html = generateDossierHTML();
    expect(html).toContain("Not provided");
    expect(html).toContain("0%");
  });
});
