import { describe, it, expect } from "vitest";
import { isIOSDevice } from "./isIOSDevice";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145.0 Safari/537.36";

const check = (userAgent, maxTouchPoints) =>
  isIOSDevice({ userAgent, maxTouchPoints }, {});

describe("isIOSDevice", () => {
  it("is true for an iPhone", () => expect(check(IPHONE, 5)).toBe(true));
  it("is true for an iPad token", () => expect(check(IPAD, 5)).toBe(true));
  it("is true for iPadOS Safari (Macintosh user agent with touch)", () =>
    expect(check(MAC, 5)).toBe(true));
  it("is false for a Mac with no touch screen", () =>
    expect(check(MAC, 0)).toBe(false));
  it("is false for a touch-screen Windows laptop", () =>
    expect(check(WINDOWS, 10)).toBe(false));
  it("is false when MSStream is present", () =>
    expect(isIOSDevice({ userAgent: IPHONE }, { MSStream: {} })).toBe(false));
});
