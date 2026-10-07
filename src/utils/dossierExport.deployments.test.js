/**
 * generateProfileSection read profile.deployments, a field nothing ever
 * writes - deployments live under getServiceHistory().deployments
 * (SERVICE_HISTORY_KEY), never on the profile object (VALID_PROFILE_FIELDS,
 * veteranProfile.js, has no "deployments" entry). Every dossier export
 * silently dropped the veteran's deployment history. Fixture values are
 * synthetic, not any real veteran's data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { generateDossierHTML } from "./dossierExport";

const PROFILE_KEY = "vet_rate_veteran_profile";
const SERVICE_HISTORY_KEY = "vet_rate_service_history";

describe("generateDossierHTML: deployments read from service history, not the profile object", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows a deployment stored under vet_rate_service_history", () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ fullName: "Jordan Sample" }),
    );
    localStorage.setItem(
      SERVICE_HISTORY_KEY,
      JSON.stringify({
        deployments: [
          {
            location: "Iraq",
            startDate: "2005-01-01",
            endDate: "2006-01-01",
            combat: true,
          },
        ],
      }),
    );

    const html = generateDossierHTML();
    expect(html).toContain("Iraq");
    expect(html).toContain("2005-01-01");
    expect(html).toContain("[Combat]");
  });

  it("omits the deployment line entirely when none are on file", () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ fullName: "Jordan Sample" }),
    );

    const html = generateDossierHTML();
    expect(html).not.toContain("Deployment:");
  });
});
