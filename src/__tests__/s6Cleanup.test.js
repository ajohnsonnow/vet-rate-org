import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * C-M05 (historical): fetch-cavc / fetch-fedcir were scaffolds with placeholder
 * selectors, gated OFF behind ENABLE_SCAFFOLD_FETCHERS so the weekly cron didn't
 * scrape unverified content. Both were PROMOTED to real fetchers — fetch-m21-1
 * in S31 (KnowVA v11 JSON API), fetch-cavc + fetch-fedcir in S33 (the CAVC Atom
 * decisions feed and the CAFC WordPress REST opinions API, both plain-fetchable,
 * no placeholder selectors). The scaffold gate no longer applies to any of them
 * — see knowledge-sources.yaml (verified_status: content-verified).
 */
describe("legal-ingestion fetchers are promoted, not scaffolds (S31/S33)", () => {
  const PROMOTED = [
    {
      file: "scripts/legal-ingestion/fetch-m21-1.mjs",
      source: "/system/ws/v11/ss/",
    },
    {
      file: "scripts/legal-ingestion/fetch-cavc.mjs",
      source: "recentdecisions.rss",
    },
    {
      file: "scripts/legal-ingestion/fetch-fedcir.mjs",
      source: "/wp-json/wp/v2/posts",
    },
  ];
  for (const { file, source } of PROMOTED) {
    it(`${file} is a real fetcher (no scaffold gate) hitting its live source`, () => {
      const src = read(file);
      expect(src).not.toContain("ENABLE_SCAFFOLD_FETCHERS");
      expect(src).toContain(source);
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

/**
 * C-M06: allowOffline is a WllamaConfig field (2nd constructor arg, read via
 * this.config.allowOffline) — passing it to loadModelFromUrl silently ignored
 * it, so the offline-first cached-model load never engaged. Verified against the
 * wllama source (ngxson/wllama src/wllama.ts).
 */
describe("wllama allowOffline placement (C-M06)", () => {
  it("passes allowOffline to the WllamaClass constructor, not loadModelFromUrl", () => {
    const src = read("src/utils/wllamaService.js");
    // The `allowOffline: useCache` binding occurs exactly once, inside the
    // `new WllamaClass(...)` call (not in the loadModelFromUrl options).
    expect((src.match(/allowOffline:\s*useCache/g) || []).length).toBe(1);
    expect(src).toMatch(
      /new WllamaClass\([\s\S]{0,200}allowOffline:\s*useCache/,
    );
  });
});
