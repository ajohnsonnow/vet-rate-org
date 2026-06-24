import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * A-H10 / D-H04: the standalone legal HTML is generated from the React source by
 * scripts/sync-legal-pages.js. The privacy page renders its body through t(), so a
 * generator that fails to resolve those calls ships literal {t("...")} to the user.
 * This guards the shipped artifact directly: no unresolved i18n calls in either page.
 */
const PAGES = ["privacy-policy.html", "terms-of-service.html"];

describe("generated legal pages have no unresolved i18n calls (A-H10/D-H04)", () => {
  for (const page of PAGES) {
    it(`${page} contains no unresolved {t(...)} placeholders`, () => {
      const path = join(process.cwd(), "public", page);
      expect(existsSync(path), `${page} should exist`).toBe(true);
      const html = readFileSync(path, "utf8");
      const leaked = html.match(/\{\s*t\(/g) || [];
      expect(
        leaked.length,
        `found ${leaked.length} unresolved t() call(s) in ${page} — run "npm run sync-legal-pages"`,
      ).toBe(0);
    });
  }
});
