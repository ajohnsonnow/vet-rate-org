import http from "node:http";
import type { AddressInfo } from "node:net";
import { expect } from "@playwright/test";
import { test } from "../fixtures";
import { applyProfile, contextOptionsFor } from "../apply-profile";
import { getProfile } from "../profiles";
import {
  assertNoHorizontalScroll,
  assertProfileApplied,
} from "../spec-helpers";
import type { DeviceProfile } from "../types";

const PAGE =
  '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>lab</title><body>lab</body>';
const WIDE =
  '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><body><div style="width:5000px;height:10px"></div></body>';

let server: http.Server;
let origin: string;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/big") {
      res.writeHead(200, {
        "content-type": "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(Buffer.alloc(400 * 1024));
    } else {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(req.url === "/wide" ? WIDE : PAGE);
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(() => server.close());

const loop = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const start = performance.now();
    let x = 0;
    for (let i = 0; i < 3e7; i++) x += i;
    return performance.now() - start + x * 0;
  });

test("the profile's values read back in the page", async ({
  page,
  profile,
}) => {
  await page.goto(origin);
  await assertProfileApplied(page, profile);
});

test("the values survive a second navigation", async ({ page, profile }) => {
  await page.goto(origin);
  await page.goto(`${origin}/?again`);
  await assertProfileApplied(page, profile);
});

test("assertNoHorizontalScroll passes a fitting page and fails a wide one", async ({
  page,
}) => {
  await page.goto(origin);
  await assertNoHorizontalScroll(page);
  await page.goto(`${origin}/wide`);
  await expect(assertNoHorizontalScroll(page)).rejects.toThrow(
    /scrolls sideways/,
  );
});

test("a null adapter profile exposes navigator.gpu that resolves null", async ({
  browser,
}) => {
  const base = getProfile("desktop-high");
  const nullAdapter: DeviceProfile = { ...base, gpu: { adapter: null } };
  const context = await browser.newContext(contextOptionsFor(base));
  const page = await context.newPage();
  await applyProfile(page, nullAdapter);
  await page.goto(origin);
  await assertProfileApplied(page, nullAdapter);
  await context.close();
});

test("profile adapters refuse to create a device", async ({
  page,
  profile,
}) => {
  test.skip(!profile.gpu?.adapter, "profile has no adapter");
  await page.goto(origin);
  const message = await page.evaluate(async () => {
    const adapter = await (navigator as any).gpu.requestAdapter();
    return adapter.requestDevice().then(
      () => "created",
      (e: Error) => e.message,
    );
  });
  expect(message).toMatch(/cannot create a GPU device/);
});

test("CPU throttling slows a busy loop and survives navigation", async ({
  page,
  profile,
}) => {
  test.skip(profile.name !== "phone-android-mid", "one profile is enough");
  await page.goto(origin);
  const throttled = await loop(page);
  await page.goto(`${origin}/?again`);
  const throttledAfterNav = await loop(page);

  const context = await page.context().browser()!.newContext();
  const plain = await context.newPage();
  await plain.goto(origin);
  const baseline = await loop(plain);
  await context.close();

  expect(profile.cpuThrottleRate).toBe(4);
  expect(throttled / baseline).toBeGreaterThan(2);
  expect(throttledAfterNav / baseline).toBeGreaterThan(2);
});

test("network conditions slow a download", async ({ page, profile }) => {
  test.skip(profile.name !== "phone-android-mid", "one profile is enough");
  await page.goto(origin);
  const ms = await page.evaluate(async () => {
    const start = performance.now();
    const r = await fetch("/big", { cache: "no-store" });
    await r.arrayBuffer();
    return performance.now() - start;
  });
  // 400 KiB at 1.6 Mbps is about 2.0 s on the wire.
  expect(ms).toBeGreaterThan(1500);
});

test("a profile without a network spec is not throttled", async ({
  page,
  profile,
}) => {
  test.skip(profile.name !== "desktop-high", "one profile is enough");
  await page.goto(origin);
  const ms = await page.evaluate(async () => {
    const start = performance.now();
    const r = await fetch("/big", { cache: "no-store" });
    await r.arrayBuffer();
    return performance.now() - start;
  });
  expect(ms).toBeLessThan(500);
});
