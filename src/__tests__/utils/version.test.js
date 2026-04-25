import { describe, it, expect } from "vitest";
import {
  APP_VERSION,
  SCHEMA_VERSION,
  UPDATE_CHECK_INTERVAL,
  VERSION_STORAGE_KEY,
} from "../../utils/version";

describe("APP_VERSION", () => {
  it("is defined", () => {
    expect(APP_VERSION).toBeDefined();
  });

  it("follows semver", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("is a string", () => {
    expect(typeof APP_VERSION).toBe("string");
  });
});

describe("SCHEMA_VERSION", () => {
  it("is defined", () => {
    expect(SCHEMA_VERSION).toBeDefined();
  });

  it("follows semver (strict)", () => {
    expect(SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("UPDATE_CHECK_INTERVAL", () => {
  it("equals 15 minutes in ms", () => {
    expect(UPDATE_CHECK_INTERVAL).toBe(15 * 60 * 1000);
  });

  it("is positive", () => {
    expect(UPDATE_CHECK_INTERVAL).toBeGreaterThan(0);
  });
});

describe("Storage keys", () => {
  it("VERSION_STORAGE_KEY is non-empty", () => {
    expect(VERSION_STORAGE_KEY).toBeTruthy();
    expect(VERSION_STORAGE_KEY.length).toBeGreaterThan(5);
  });
});
