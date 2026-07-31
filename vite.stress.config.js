import baseConfig from "./vite.config.js";

/**
 * Dev-server variant for the WS-1 stress harness only. Never used by the app,
 * the e2e suite, or CI.
 *
 * The stress run takes ~9h against the real C-File while a second Claude Code
 * session edits the same source files in the same VS Code instance. Two things
 * have to be true for those to coexist:
 *
 *   1. A dedicated port. playwright.config.ts (e2e) owns 5197 with
 *      reuseExistingServer:false, so sharing it means whichever run starts
 *      second dies on EADDRINUSE — or the first run's teardown kills the
 *      second's server mid-flight.
 *
 *   2. HMR off. Both dev servers read the same files from disk, so a save in
 *      the other session hot-reloads THIS browser mid-analysis, against a
 *      module graph the running job holds live references to. Disabling HMR
 *      means an edit lands on disk but never reaches the loaded page.
 *
 * A production `vite preview` build would isolate more completely, but the
 * harness injects dev-only module paths (`import("/src/utils/...")` in
 * tests/stress/helpers.ts), which a hashed production bundle does not serve.
 */
export default {
  ...baseConfig,
  server: {
    ...baseConfig.server,
    port: 5198,
    strictPort: true,
    hmr: false,
    watch: null,
  },
};
