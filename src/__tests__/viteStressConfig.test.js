import { describe, it, expect } from "vitest";
import { loadConfigFromFile } from "vite";
import { join } from "node:path";

/**
 * vite.config.js's default export is `defineConfig(({ mode }) => ({...}))` -
 * a function, so the e2e-mode web-llm alias can read `mode`. vite.stress.
 * config.js used to do `{ ...baseConfig, server: { ...baseConfig.server } }`;
 * spreading a function yields `{}`, so the WS-1 stress harness dev server
 * silently booted with no plugins, no dompurify alias, and no COOP/COEP
 * headers (the WebGPU/SharedArrayBuffer paths need those). This resolves the
 * real config the way Vite itself does, via loadConfigFromFile, so it can't
 * be fooled by re-implementing the merge logic under test.
 */
describe("vite.stress.config.js", () => {
  it("carries over vite.config.js's plugins, alias and COOP/COEP headers", async () => {
    const root = process.cwd();
    const result = await loadConfigFromFile(
      { command: "serve", mode: "development" },
      join(root, "vite.stress.config.js"),
      root,
    );

    expect(result).not.toBeNull();
    const { config } = result;

    expect((config.plugins || []).length).toBeGreaterThan(0);
    expect(Object.keys(config.resolve?.alias || {})).toContain("dompurify");
    expect(Object.keys(config.server?.headers || {})).toEqual(
      expect.arrayContaining([
        "Cross-Origin-Opener-Policy",
        "Cross-Origin-Embedder-Policy",
      ]),
    );
    expect(config.server?.port).toBe(5198);
  });
});
