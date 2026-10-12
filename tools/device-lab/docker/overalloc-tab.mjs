// Deliberately allocates and touches memory inside a Chromium tab until the
// cgroup limit kills the renderer, and reports what Playwright saw.
import { chromium } from "@playwright/test";

const out = (line) =>
  process.stdout.write(`${line}
`);

const WAIT_MS = 180_000;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("about:blank");

const crashed = new Promise((resolve) => {
  page.on("crash", () => {
    out("tab event: crash");
    resolve("tab crashed (renderer killed)");
  });
});

const allocating = page
  .evaluate(async () => {
    const STEP = 64 * 1024 * 1024;
    const held = [];
    for (;;) {
      const chunk = new Uint8Array(STEP);
      chunk.fill(1);
      held.push(chunk);
      await new Promise((r) => setTimeout(r, 5));
    }
  })
  .then(
    () => "evaluate returned",
    (e) => `evaluate rejected: ${String(e.message).split("\n")[0]}`,
  );

const timeout = new Promise((resolve) =>
  setTimeout(() => resolve(`no crash within ${WAIT_MS / 1000} s`), WAIT_MS),
);

out(`tab outcome: ${await Promise.race([crashed, allocating, timeout])}`);
out(`browser still connected: ${browser.isConnected()}`);
await browser.close().catch(() => {});
process.exit(0);
