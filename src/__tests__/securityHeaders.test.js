import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p) => readFileSync(join(process.cwd(), p), "utf8");

// The cloud API origins the Dropbox/OneDrive backup feature fetches (D-H11).
// Google Drive's googleapis.com was already allowed; these were missing, so the
// CSP blocked every token/upload/list call and the feature was dead in prod.
const CLOUD_ORIGINS = [
  "https://api.dropboxapi.com",
  "https://content.dropboxapi.com",
  "https://login.microsoftonline.com",
  "https://graph.microsoft.com",
];

describe("render.yaml security headers (D-H08/D-H13/D-M15/D-M16)", () => {
  const yaml = read("render.yaml");

  it("delivers a Content-Security-Policy header on both service blocks", () => {
    expect((yaml.match(/name: Content-Security-Policy/g) || []).length).toBe(2);
  });

  it("delivers HSTS on both blocks (D-M15)", () => {
    expect((yaml.match(/name: Strict-Transport-Security/g) || []).length).toBe(
      2,
    );
    expect(yaml).toMatch(/max-age=\d{7,}/);
  });

  it("no longer sends the deprecated X-XSS-Protection header (D-M16)", () => {
    // The header entry itself is gone (an explanatory comment may still name it).
    expect(yaml).not.toContain("name: X-XSS-Protection");
  });

  it("CSP sets frame-ancestors for clickjacking protection (D-H13)", () => {
    expect((yaml.match(/frame-ancestors 'self'/g) || []).length).toBe(2);
  });

  it("CSP connect-src includes the cloud backup origins (D-H11)", () => {
    for (const origin of CLOUD_ORIGINS) {
      expect(yaml, `render.yaml CSP missing ${origin}`).toContain(origin);
    }
  });
});

describe("CSP connect-src vs. actual fetch origins (D-H11)", () => {
  const indexHtml = read("index.html");
  const connectSrc = (indexHtml.match(/connect-src([^;]*);/) || [])[1] || "";

  it("the meta CSP includes the cloud backup origins", () => {
    for (const origin of CLOUD_ORIGINS) {
      expect(connectSrc, `meta connect-src missing ${origin}`).toContain(origin);
    }
  });

  it("every https host fetched by multiCloudStorage is allowed by connect-src", () => {
    const src = read("src/utils/multiCloudStorage.js");
    const re = /fetch\(\s*["'`]https:\/\/([a-z0-9.-]+)/gi;
    const hosts = [...new Set([...src.matchAll(re)].map((m) => m[1]))];
    expect(hosts.length, "fetch-host extraction returned nothing").toBeGreaterThan(
      0,
    );
    for (const host of hosts) {
      expect(
        connectSrc.includes(`https://${host}`),
        `connect-src does not allow fetched host ${host}`,
      ).toBe(true);
    }
  });
});
