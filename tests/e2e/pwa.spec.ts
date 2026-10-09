import { test, expect, Page } from "@playwright/test";

/**
 * PWA + SEO gate (audit cycle S9–S17, Sprint 15). Proves the installable-app
 * surface and the social/search metadata are correct and load:
 *
 *   - The web app manifest is linked, parses, and every icon it declares
 *     resolves to a real PNG (directly guards the S15 fix for the previously
 *     broken icon / screenshot references).
 *   - The SEO + Open Graph + Twitter meta are present, brand-correct for the
 *     default (vet-rate) build the dev server serves, and carry no PII.
 *   - The hand-rolled service worker (public/service-worker.js) serves the app
 *     shell when the network is gone.
 *
 * Honest scope notes:
 *   - The app only registers the SW under import.meta.env.PROD (src/main.jsx),
 *     so it does NOT auto-register on the Vite dev server this spec runs
 *     against. The offline test therefore registers it manually — it is
 *     exercising the SW's own caching contract, not the app's registration glue.
 *   - robots.txt / sitemap.xml are emitted at build by seoFilesPlugin
 *     (vite.config.js) and do not exist on the dev server, so their validity is
 *     verified from the build output in docs/audit/S15_WORKLIST.md, not here.
 */

type ManifestIcon = {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
};
type Manifest = {
  name?: string;
  short_name?: string;
  start_url?: string;
  display?: string;
  icons?: ManifestIcon[];
};

// Conservative email matcher — the PII guard fails if any address leaks into a
// crawler-visible meta tag (the support address intentionally lives only in the
// FAQ/support page *content*, never in <head>).
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

async function metaContent(
  page: Page,
  selector: string,
): Promise<string | null> {
  const loc = page.locator(selector);
  if ((await loc.count()) === 0) return null;
  return loc.first().getAttribute("content");
}

test.describe("PWA manifest + icons", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("manifest is linked from the document head", async ({ page }) => {
    const href = await page
      .locator('link[rel="manifest"]')
      .first()
      .getAttribute("href");
    expect(href).toBe("/manifest.json");
  });

  test("manifest parses and declares the installability fields", async ({
    request,
  }) => {
    const res = await request.get("/manifest.json");
    expect(res.status()).toBe(200);

    const m = (await res.json()) as Manifest;
    expect(m.name, "name is required for install").toBeTruthy();
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(Array.isArray(m.icons) && m.icons.length).toBeTruthy();
  });

  test("every manifest icon resolves to a real PNG", async ({ request }) => {
    const m = (await request
      .get("/manifest.json")
      .then((r) => r.json())) as Manifest;
    const icons = m.icons ?? [];

    for (const icon of icons) {
      const res = await request.get(icon.src);
      expect(res.status(), `icon ${icon.src} should load`).toBe(200);
      expect(
        res.headers()["content-type"],
        `icon ${icon.src} should be a PNG`,
      ).toContain("image/png");
    }

    // Install + maskable coverage: Android/Chrome want both a plain ("any")
    // icon and a maskable one at the 192 and 512 install sizes.
    const purposes = new Set(icons.map((i) => i.purpose));
    const sizes = new Set(icons.map((i) => i.sizes));
    expect(purposes.has("any")).toBe(true);
    expect(purposes.has("maskable")).toBe(true);
    expect(sizes.has("192x192")).toBe(true);
    expect(sizes.has("512x512")).toBe(true);
  });

  test("apple-touch-icon and favicon resolve", async ({ page, request }) => {
    const apple = await page
      .locator('link[rel="apple-touch-icon"]')
      .first()
      .getAttribute("href");
    expect(apple).toBeTruthy();
    const appleRes = await request.get(apple as string);
    expect(appleRes.status()).toBe(200);
    expect(appleRes.headers()["content-type"]).toContain("image/png");

    const favRes = await request.get("/favicon.ico");
    expect(favRes.status()).toBe(200);
  });
});

test.describe("SEO + social meta", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("canonical, robots, Open Graph and Twitter tags are present and brand-correct", async ({
    page,
  }) => {
    // The dev server serves the default (vet-rate) brand, so the brandingPlugin
    // leaves the origin as https://vet-rate.org.
    const canonical = await page
      .locator('link[rel="canonical"]')
      .first()
      .getAttribute("href");
    expect(canonical).toBe("https://vet-rate.org/");

    expect(await metaContent(page, 'meta[name="robots"]')).toBe(
      "index, follow",
    );

    expect(await metaContent(page, 'meta[property="og:type"]')).toBe("website");
    expect(await metaContent(page, 'meta[property="og:url"]')).toBe(
      "https://vet-rate.org/",
    );
    expect(await metaContent(page, 'meta[property="og:title"]')).toBeTruthy();
    expect(
      await metaContent(page, 'meta[property="og:description"]'),
    ).toBeTruthy();
    expect(await metaContent(page, 'meta[property="og:image"]')).toBe(
      "https://vet-rate.org/images/Vet-Rate-org-logo-official.png",
    );

    // index.html:48-49: the brand logo is square (1644×1645), which the
    // "summary" card fits better than "summary_large_image" (a wide-crop card).
    expect(await metaContent(page, 'meta[name="twitter:card"]')).toBe(
      "summary",
    );
    expect(await metaContent(page, 'meta[name="twitter:title"]')).toBeTruthy();
    expect(
      await metaContent(page, 'meta[name="twitter:description"]'),
    ).toBeTruthy();
    expect(await metaContent(page, 'meta[name="twitter:image"]')).toBeTruthy();
  });

  test("no PII leaks into crawler-visible meta", async ({ page }) => {
    const haystack = await page.evaluate(() => {
      const contents = Array.from(document.querySelectorAll("meta")).map(
        (m) => m.getAttribute("content") ?? "",
      );
      return [document.title, ...contents].join("\n");
    });
    expect(haystack).not.toMatch(EMAIL_RE);
  });
});

test.describe("service worker offline shell", () => {
  test("serves the app shell when the network is gone", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Service worker offline behavior is verified on Chromium",
    );

    await page.goto("/");

    // The app registers the SW only in PROD; register it manually here so the
    // dev server can exercise the worker's caching contract. Wait until the
    // active worker controls this page (activate() calls clients.claim()).
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/service-worker.js");
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => resolve(),
            { once: true },
          );
          setTimeout(resolve, 3000);
        });
      }
    });

    // Cut the network and reload: the navigation must come back from the SW
    // cache, not the browser's native offline error page.
    await page.context().setOffline(true);
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#root")).toBeAttached();
      expect(await page.title()).not.toBe("");
    } finally {
      await page.context().setOffline(false);
    }
  });
});
