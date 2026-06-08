import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

interface FixtureClaim {
  id: string;
  conditionName: string;
  selectedRating: number;
  diagnosticCode: number;
  claimType: string;
  status: string;
}

interface Fixture {
  version: string;
  source: string;
  data: { claims: FixtureClaim[] };
}

const FIXTURE: Fixture = JSON.parse(
  readFileSync("tests/fixtures/redacted-packet.json", "utf-8"),
);
const FIXTURE_CLAIMS = FIXTURE.data.claims;

test.describe("C-File packet — claims load and persist", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ appVersion, claimsJson }) => {
        localStorage.setItem("vet-rate-tos-accepted", "true");
        localStorage.setItem("vet_rate_last_seen_version", appVersion);
        localStorage.setItem("vetrate-tour-completed", "true");
        localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
        localStorage.setItem("vet_rate_saved_claims", claimsJson);
      },
      { appVersion: APP_VERSION, claimsJson: JSON.stringify(FIXTURE_CLAIMS) },
    );
  });

  test("fixture is a valid v2.0 packet with 9 conditions", () => {
    expect(FIXTURE.version).toBe("2.0");
    expect(FIXTURE.source).toBe("Vet-Rate.org");
    expect(FIXTURE_CLAIMS).toHaveLength(9);

    const ptsd = FIXTURE_CLAIMS.find((c) => c.conditionName.includes("PTSD"));
    expect(ptsd).toBeDefined();
    expect(ptsd!.selectedRating).toBe(50);
    expect(ptsd!.diagnosticCode).toBe(9411);

    const ratings = FIXTURE_CLAIMS.map((c) => c.selectedRating).sort(
      (a, b) => b - a,
    );
    expect(ratings[0]).toBe(50);
    const secondaries = FIXTURE_CLAIMS.filter(
      (c) => c.claimType === "Secondary",
    );
    expect(secondaries).toHaveLength(2);
  });

  test("claims are present in localStorage after app boot", async ({
    page,
  }) => {
    await page.goto("/");
    await dismissDisclaimer(page);

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("vet_rate_saved_claims");
      return raw ? (JSON.parse(raw) as FixtureClaim[]) : null;
    });

    expect(stored).not.toBeNull();
    expect(stored!.length).toBe(FIXTURE_CLAIMS.length);

    const ptsd = stored!.find((c) => c.conditionName.includes("PTSD"));
    expect(ptsd).toBeDefined();
    expect(ptsd!.selectedRating).toBe(50);
  });

  test("claims persist across page reload", async ({ page }) => {
    await page.goto("/");
    await dismissDisclaimer(page);
    await page.reload();

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("vet_rate_saved_claims");
      return raw ? (JSON.parse(raw) as FixtureClaim[]) : null;
    });

    expect(stored).not.toBeNull();
    expect(stored!.length).toBe(FIXTURE_CLAIMS.length);

    const ids = stored!.map((c) => c.id);
    expect(ids).toContain("claim-fixture-001");
    expect(ids).toContain("claim-fixture-009");
  });

  test("app boots without crashing with 9 pre-loaded claims", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await dismissDisclaimer(page);

    await expect(page.locator("body")).toBeVisible();
    expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
  });
});
