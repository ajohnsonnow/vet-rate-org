import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * C-M05: fetch-m21-1 / fetch-cavc / fetch-fedcir are scaffolds with placeholder
 * selectors but were wired into the weekly legal-ingestion cron — they failed
 * every week (false-alarm noise) and risked scraping unintended content. They
 * now default OFF behind ENABLE_SCAFFOLD_FETCHERS.
 */
describe("scaffold fetchers default off (C-M05)", () => {
  const SCAFFOLDS = [
    "scripts/legal-ingestion/fetch-m21-1.mjs",
    "scripts/legal-ingestion/fetch-cavc.mjs",
    "scripts/legal-ingestion/fetch-fedcir.mjs",
  ];
  for (const f of SCAFFOLDS) {
    it(`${f} skips unless ENABLE_SCAFFOLD_FETCHERS is set`, () => {
      const src = read(f);
      expect(src).toContain('process.env.ENABLE_SCAFFOLD_FETCHERS !== "1"');
      // The guard returns before any network/mkdir work.
      expect(src).toMatch(/ENABLE_SCAFFOLD_FETCHERS[\s\S]{0,200}?return;/);
    });
  }
});

/**
 * C-L02: webllmEngine.interruptGenerate() returns a Promise; the bare calls in
 * diamondSwarm were not awaited and the surrounding try/catch only caught a sync
 * throw, leaving a possible unhandled rejection on a pre-1.0 dep. The calls are
 * now rejection-guarded.
 */
describe("interruptGenerate rejection guard (C-L02)", () => {
  it("diamondSwarm no longer fires interruptGenerate without a rejection guard", () => {
    const src = read("src/utils/diamondSwarm.js");
    expect(src).not.toMatch(/interruptGenerate\(\);/);
    expect(src).toMatch(/interruptGenerate\(\)\?\.catch\(\(\) => \{\}\)/);
  });
});
