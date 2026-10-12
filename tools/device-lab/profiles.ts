import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Basis, DeviceProfile } from "./types";

const BASES: Basis[] = ["measured", "documented", "estimate"];
const REQUIRED_BASIS = [
  "screen",
  "userAgent",
  "memoryAndCores",
  "gpu",
  "cpuThrottleRate",
] as const;

function defaultDir(): string {
  const here =
    typeof __dirname === "string"
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "profiles");
}

function fail(file: string, message: string): never {
  throw new Error(`device-lab profile ${file}: ${message}`);
}

function validate(file: string, p: DeviceProfile): void {
  if (path.basename(file, ".json") !== p.name) {
    fail(file, `"name" (${p.name}) must equal the file name`);
  }
  if (!p.source || typeof p.source !== "string") fail(file, "missing source");
  for (const key of REQUIRED_BASIS) {
    if (!p.basis?.[key]) fail(file, `basis.${key} is required`);
  }
  for (const [key, value] of Object.entries(p.basis)) {
    if (!BASES.includes(value as Basis)) {
      fail(file, `basis.${key} must be one of ${BASES.join(", ")}`);
    }
  }
  if (p.network && !p.basis.network) fail(file, "basis.network is required");
  if (!(p.viewport?.width > 0 && p.viewport?.height > 0)) {
    fail(file, "viewport must have positive width and height");
  }
  if (!(p.screen?.width > 0 && p.screen?.height > 0)) {
    fail(file, "screen must have positive width and height");
  }
  if (!(p.cpuThrottleRate >= 1)) fail(file, "cpuThrottleRate must be >= 1");
  if (p.gpu?.adapter && !(p.gpu.adapter.limits?.maxBufferSize > 0)) {
    fail(file, "gpu.adapter.limits.maxBufferSize is required");
  }
}

export function loadProfiles(dir: string = defaultDir()): DeviceProfile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const full = path.join(dir, f);
      const profile = JSON.parse(readFileSync(full, "utf-8")) as DeviceProfile;
      validate(full, profile);
      return profile;
    });
}

export function getProfile(
  name: string,
  dir: string = defaultDir(),
): DeviceProfile {
  const found = loadProfiles(dir).find((p) => p.name === name);
  if (!found) throw new Error(`device-lab: no profile named "${name}"`);
  return found;
}
