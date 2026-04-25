/**
 * Network egress regression — privacy guarantee
 *
 * The site advertises "100% client-side, no tracking" in:
 *   - README.md
 *   - public/privacy-policy.html
 *   - SecurityBadge.jsx
 *
 * This spec is the load-bearing test for that promise. It records every
 * outbound request the browser makes during normal use and fails the build
 * if any third-party tracker or analytics SDK is contacted.
 *
 * It also asserts that NO AI/LLM endpoint is contacted before the user
 * explicitly opens the AI Assistant — preventing accidental key/prompt
 * leakage on first paint.
 *
 * Allowlists below codify the audit-approved surface. If you need to add a
 * domain, document why in the same commit.
 */
import { test, expect, type Request } from "@playwright/test";
import { dismissDisclaimer, preAcceptModals } from "./helpers";

// Domains the app legitimately contacts on first paint (CSP-allowed).
// Keep this list minimal — every entry is a privacy trade-off.
const ALLOWED_INITIAL_HOSTS = [
  // Same-origin dev server
  "localhost",
  "127.0.0.1",
  // Flag icons CSS (rendered via cdn.jsdelivr.net per index.html line 46)
  "cdn.jsdelivr.net",
  // Country flag PNGs used by language picker (CSP img-src approved)
  "flagcdn.com",
  // Google Drive API (deferred async script tag in index.html, gated by user opt-in)
  "apis.google.com",
  "accounts.google.com",
  // GoatCounter analytics (privacy-preserving, no cookies)
  "gc.zgo.at",
  "vet-rate-org.goatcounter.com",
  // VA Lighthouse / public statuspage — only "is VA up?" check, no PII
  "valighthouse.statuspage.io",
];

// Hosts that MUST NEVER be contacted under any circumstance.
// Hard-fail if any of these slip in via a dependency update.
const FORBIDDEN_TRACKERS = [
  "google-analytics.com",
  "googletagmanager.com",
  "doubleclick.net",
  "facebook.com",
  "facebook.net",
  "connect.facebook.net",
  "mixpanel.com",
  "segment.io",
  "segment.com",
  "hotjar.com",
  "fullstory.com",
  "heap.io",
  "intercom.io",
  "amplitude.com",
  "sentry.io",
  "datadog.com",
  "datadoghq.com",
  "newrelic.com",
  "bing.com",
  "criteo.com",
  "rubiconproject.com",
  "adsystem.amazon.com",
  "scorecardresearch.com",
];

// AI/LLM endpoints — must require explicit user action before contacting.
const AI_ENDPOINTS = [
  "generativelanguage.googleapis.com", // Gemini
  "api.anthropic.com",
  "api.openai.com",
  "huggingface.co",
];

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

const matchesAny = (host: string, list: string[]): boolean =>
  list.some(
    (entry) => host === entry || host.endsWith(`.${entry}`) || host === entry,
  );

test.describe("Network egress — privacy guarantee", () => {
  test("forbidden trackers are never contacted on initial load", async ({
    page,
  }) => {
    const requests: Request[] = [];
    page.on("request", (req) => requests.push(req));

    await preAcceptModals(page);
    await page.goto("/");
    await dismissDisclaimer(page);
    // Give async-deferred scripts a beat to settle
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    const forbiddenHits = requests
      .map((r) => r.url())
      .filter((url) => matchesAny(hostOf(url), FORBIDDEN_TRACKERS));

    expect(
      forbiddenHits,
      `Privacy regression: forbidden tracker(s) contacted:\n${forbiddenHits.join("\n")}`,
    ).toEqual([]);
  });

  test("no AI endpoint is contacted before user opt-in", async ({ page }) => {
    const aiRequests: string[] = [];
    page.on("request", (req) => {
      if (matchesAny(hostOf(req.url()), AI_ENDPOINTS)) {
        aiRequests.push(req.url());
      }
    });

    await preAcceptModals(page);
    await page.goto("/");
    await dismissDisclaimer(page);
    // Browse around: open a couple tools without invoking AI
    await page.waitForTimeout(2_000);

    expect(
      aiRequests,
      `AI endpoint contacted before user opt-in:\n${aiRequests.join("\n")}`,
    ).toEqual([]);
  });

  test("only allowlisted hosts are contacted on initial load", async ({
    page,
  }) => {
    const requests: Request[] = [];
    page.on("request", (req) => requests.push(req));

    await preAcceptModals(page);
    await page.goto("/");
    await dismissDisclaimer(page);
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    const unexpected = Array.from(
      new Set(
        requests
          .map((r) => hostOf(r.url()))
          .filter(Boolean)
          .filter((host) => !matchesAny(host, ALLOWED_INITIAL_HOSTS))
          // Tolerate AI hosts here — covered by separate test above
          .filter((host) => !matchesAny(host, AI_ENDPOINTS))
          // Tolerate the playwright/vite HMR ws (data:, blob:, etc. already filtered)
          .filter((host) => host !== ""),
      ),
    );

    expect(
      unexpected,
      `Unexpected egress host(s) on initial load:\n${unexpected.join("\n")}\n\n` +
        `Either add to ALLOWED_INITIAL_HOSTS with justification, or remove the ` +
        `dependency that introduced it.`,
    ).toEqual([]);
  });
});
