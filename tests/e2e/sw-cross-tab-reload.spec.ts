import { createServer, Server } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { test, expect, BrowserContext, Page } from "@playwright/test";

/**
 * Cross-tab behaviour of the service worker update, against the PRODUCTION
 * build (run `npm run build` first). The worker only registers in a production
 * build, so this spec serves `dist/` itself and can change the worker script's
 * bytes between loads, which is what makes the browser install a real second
 * worker that waits behind the first.
 */
const DIST = resolve("dist");
const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;
const TEXT = "A new version is ready. Reload to update.";
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

type Rig = {
  server: Server;
  origin: string;
  setWorkerVersion: (n: number) => void;
  setWorkerDelay: (ms: number) => void;
};

async function startRig(): Promise<Rig> {
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error("dist/ is missing. Run `npm run build` before this spec.");
  }
  let workerVersion = 1;
  let workerDelay = 0;
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const send = (body: Buffer | string, type: string, status = 200) => {
      res.writeHead(status, {
        "content-type": type,
        "cache-control": "no-store",
      });
      res.end(body);
    };
    if (path === "/service-worker.js") {
      const source = readFileSync(join(DIST, "service-worker.js"), "utf-8");
      setTimeout(
        () => send(`${source}\n// test build ${workerVersion}\n`, TYPES[".js"]),
        workerDelay,
      );
      return;
    }
    const file = normalize(join(DIST, path));
    if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) {
      send(
        readFileSync(file),
        TYPES[extname(file)] ?? "application/octet-stream",
      );
      return;
    }
    if (extname(path)) {
      send("not found", "text/plain", 404);
      return;
    }
    send(readFileSync(join(DIST, "index.html")), TYPES[".html"]);
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const port = (server.address() as { port: number }).port;
  return {
    server,
    origin: `http://127.0.0.1:${port}`,
    setWorkerVersion: (n) => {
      workerVersion = n;
    },
    setWorkerDelay: (ms) => {
      workerDelay = ms;
    },
  };
}

async function seedStorage(context: BrowserContext): Promise<void> {
  await context.addInitScript((version) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", version);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
}

async function loads(page: Page): Promise<{ count: () => number }> {
  let n = 0;
  page.on("load", () => {
    n += 1;
  });
  return { count: () => n };
}

const hasController = (page: Page) =>
  page.waitForFunction(
    () => Boolean(navigator.serviceWorker.controller),
    null,
    {
      timeout: 20_000,
    },
  );

test.describe("service worker update across tabs", () => {
  let rig: Rig;
  test.beforeEach(async () => {
    rig = await startRig();
  });
  test.afterEach(async () => {
    await new Promise((ok) => rig.server.close(ok));
  });

  test("Reload in one tab leaves another tab's typing alone, then offers it the notice", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext();
    await seedStorage(context);

    const first = await context.newPage();
    await first.goto(rig.origin);
    await hasController(first);

    const a = await context.newPage();
    const b = await context.newPage();
    await Promise.all([a.goto(rig.origin), b.goto(rig.origin)]);
    await Promise.all([hasController(a), hasController(b)]);
    await first.close();
    const aLoads = await loads(a);
    const bLoads = await loads(b);

    await b.evaluate(() => {
      (window as unknown as { __alive: boolean }).__alive = true;
      const input = document.createElement("input");
      input.id = "tab-b-field";
      input.setAttribute("aria-label", "tab b field");
      document.body.appendChild(input);
    });
    await b.locator("#tab-b-field").fill("typed in tab B");
    await b.locator("#tab-b-field").focus();

    rig.setWorkerVersion(2);
    await a.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg!.update();
    });
    await expect
      .poll(() =>
        a.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          return Boolean(reg!.waiting);
        }),
      )
      .toBe(true);

    const noticeA = a.getByRole("status").filter({ hasText: TEXT });
    const noticeB = b.getByRole("status").filter({ hasText: TEXT });
    await expect(noticeA).toBeVisible();
    await expect(noticeB).toHaveCount(0);

    const aBefore = aLoads.count();
    await noticeA.getByRole("button", { name: "Reload" }).click();
    await expect.poll(() => aLoads.count()).toBe(aBefore + 1);
    await expect
      .poll(() =>
        a.evaluate(() =>
          navigator.serviceWorker.controller?.scriptURL.includes(
            "service-worker",
          ),
        ),
      )
      .toBe(true);

    await b.waitForTimeout(4000);
    expect(bLoads.count()).toBe(0);
    expect(await b.evaluate(() => (window as any).__alive)).toBe(true);
    expect(await b.locator("#tab-b-field").inputValue()).toBe("typed in tab B");
    expect(aLoads.count()).toBe(aBefore + 1);

    await b.locator("#tab-b-field").blur();
    await expect(noticeB).toHaveCount(1);
    await expect(noticeB).toBeVisible();

    await noticeB.getByRole("button", { name: "Reload" }).click();
    await expect.poll(() => bLoads.count()).toBe(1);
    await b.waitForTimeout(2000);
    expect(bLoads.count()).toBe(1);
    await context.close();
  });

  test("a first-time visitor's page is not reloaded when the first worker takes over", async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    rig.setWorkerDelay(3000);
    const context = await browser.newContext();
    await seedStorage(context);
    const page = await context.newPage();
    const started = Date.now();
    await page.goto(rig.origin);
    const seen = await loads(page);
    await page.evaluate(() => {
      (window as unknown as { __alive: boolean }).__alive = true;
    });
    await hasController(page);
    const remaining = 10_000 - (Date.now() - started);
    if (remaining > 0) await page.waitForTimeout(remaining);
    expect(seen.count()).toBe(0);
    expect(await page.evaluate(() => (window as any).__alive)).toBe(true);
    await context.close();
  });
});
