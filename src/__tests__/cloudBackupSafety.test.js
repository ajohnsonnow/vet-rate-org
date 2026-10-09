import { describe, it, expect, vi, afterEach } from "vitest";
import { saveToDropbox, saveToOneDrive } from "../utils/multiCloudStorage";

// Minimal object that isEncryptedBackup() recognizes (encrypted + known version).
const ENCRYPTED_PACKAGE = {
  encrypted: true,
  version: "VR_ENC_V1",
  data: "ZmFrZQ==",
};

describe("cloud backup double-encryption guard (D-H10)", () => {
  it("saveToDropbox refuses an already-encrypted package", async () => {
    await expect(saveToDropbox(ENCRYPTED_PACKAGE, "f.json")).rejects.toThrow(
      /double-encrypt/i,
    );
  });

  it("saveToOneDrive refuses an already-encrypted package", async () => {
    await expect(saveToOneDrive(ENCRYPTED_PACKAGE, "f.json")).rejects.toThrow(
      /double-encrypt/i,
    );
  });
});

// The provider client IDs are read from import.meta.env at module load, and
// connect*() throws "...not configured" before the popup if they're unset. Stub
// the env and re-import so the flow reaches window.open and hits the null-guard.
describe("OAuth popup null-guard (D-H12)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("connectDropbox rejects clearly when the pop-up is blocked", async () => {
    vi.stubEnv("VITE_DROPBOX_APP_KEY", "test-app-key");
    vi.resetModules();
    const { connectDropbox } = await import("../utils/multiCloudStorage");
    const orig = window.open;
    window.open = () => null;
    try {
      await expect(connectDropbox()).rejects.toThrow(/pop-?up blocked/i);
    } finally {
      window.open = orig;
    }
  });

  it("connectOneDrive rejects clearly when the pop-up is blocked", async () => {
    vi.stubEnv("VITE_ONEDRIVE_CLIENT_ID", "test-client-id");
    vi.resetModules();
    const { connectOneDrive } = await import("../utils/multiCloudStorage");
    const orig = window.open;
    window.open = () => null;
    try {
      await expect(connectOneDrive()).rejects.toThrow(/pop-?up blocked/i);
    } finally {
      window.open = orig;
    }
  });
});
