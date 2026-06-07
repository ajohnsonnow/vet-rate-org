import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  storeLocalKey,
  getLocalKey,
  enableDevicePassphrase,
  unlockDeviceKeystore,
  lockDeviceKeystore,
  rotateDevicePassphrase,
  wipeLocalKeystore,
  isDevicePassphraseEnabled,
  isKeystoreUnlocked,
} from "../../utils/cloudEncryption";

// Stable storage keys the keystore writes (asserted directly so a rename here
// would surface as a test break, not a silent custody regression).
const PLAINTEXT = "vet_rate_backup_key_";
const WRAPPED = "vet_rate_wrapped_key_";
const META = "vet_rate_kek_meta";
const VERIFIER = "vet_rate_kek_verifier";
const MARKER = "vet_rate_kek_rotating";

// A base64 raw 256-bit DEK, the exact shape encryptForCloud emits as keyExport.
const makeDEK = () => {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of raw) bin += String.fromCharCode(b);
  return btoa(bin);
};

beforeEach(() => {
  localStorage.clear();
  lockDeviceKeystore();
});

describe("cloudEncryption — device keystore (S16 commit F)", () => {
  it("wraps a DEK on store and unwraps it on get (roundtrip)", async () => {
    await enableDevicePassphrase("hunter2");
    const dek = makeDEK();
    await storeLocalKey("dropbox_file1", dek);

    expect(localStorage.getItem(PLAINTEXT + "dropbox_file1")).toBeNull();
    expect(localStorage.getItem(WRAPPED + "dropbox_file1")).not.toBeNull();
    expect(await getLocalKey("dropbox_file1")).toBe(dek);
  });

  it("rejects a wrong passphrase on unlock, accepts the right one", async () => {
    await enableDevicePassphrase("correct-horse");
    lockDeviceKeystore();
    await expect(unlockDeviceKeystore("battery-staple")).rejects.toThrow(
      /Incorrect device passphrase/,
    );
    await expect(unlockDeviceKeystore("correct-horse")).resolves.toBe(true);
    expect(isKeystoreUnlocked()).toBe(true);
  });

  it("migrates pre-existing plaintext keys to wrapped on enable", async () => {
    const dek = makeDEK();
    await storeLocalKey("onedrive_x", dek); // disabled → plaintext
    expect(localStorage.getItem(PLAINTEXT + "onedrive_x")).toBe(dek);

    await enableDevicePassphrase("pw");

    expect(localStorage.getItem(PLAINTEXT + "onedrive_x")).toBeNull();
    expect(localStorage.getItem(WRAPPED + "onedrive_x")).not.toBeNull();
    expect(await getLocalKey("onedrive_x")).toBe(dek);
  });

  it("passes legacy plaintext through untouched when disabled", async () => {
    const dek = makeDEK();
    await storeLocalKey("p", dek);
    expect(isDevicePassphraseEnabled()).toBe(false);
    expect(await getLocalKey("p")).toBe(dek);
    expect(localStorage.getItem(PLAINTEXT + "p")).toBe(dek); // not migrated
  });

  it("lazily migrates a leftover plaintext key on get (verify, then delete)", async () => {
    await enableDevicePassphrase("pw"); // unlocked, no keys yet
    const dek = makeDEK();
    localStorage.setItem(PLAINTEXT + "legacy", dek); // simulate a leftover

    expect(await getLocalKey("legacy")).toBe(dek);
    expect(localStorage.getItem(PLAINTEXT + "legacy")).toBeNull();
    expect(localStorage.getItem(WRAPPED + "legacy")).not.toBeNull();
    expect(await getLocalKey("legacy")).toBe(dek); // now served from wrapped
  });

  it("storeLocalKey refuses to write while the keystore is locked", async () => {
    await enableDevicePassphrase("pw");
    lockDeviceKeystore();
    await expect(storeLocalKey("y", makeDEK())).rejects.toThrow(/locked/);
  });

  it("rotates the passphrase atomically (old fails, new opens every key)", async () => {
    await enableDevicePassphrase("old");
    const dekA = makeDEK();
    const dekB = makeDEK();
    await storeLocalKey("a", dekA);
    await storeLocalKey("b", dekB);

    await rotateDevicePassphrase("new");

    expect(localStorage.getItem(MARKER)).toBeNull(); // committed
    lockDeviceKeystore();
    await expect(unlockDeviceKeystore("old")).rejects.toThrow();
    await expect(unlockDeviceKeystore("new")).resolves.toBe(true);
    expect(await getLocalKey("a")).toBe(dekA);
    expect(await getLocalKey("b")).toBe(dekB);
  });

  it("recovers a rotation interrupted mid phase-2 (forward-only completion)", async () => {
    await enableDevicePassphrase("old");
    const dek = makeDEK();
    await storeLocalKey("a", dek);

    // Inject a crash exactly when phase 2 tries to swap in the new KEK
    // descriptor — temp slots are already promoted, marker still present.
    const originalSetItem = localStorage.setItem;
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation((k, v) => {
      if (k === META && localStorage.getItem(MARKER)) {
        throw new Error("simulated crash during rotation phase 2");
      }
      originalSetItem(k, v);
    });

    await expect(rotateDevicePassphrase("new")).rejects.toThrow(
      /simulated crash/,
    );
    spy.mockRestore();

    // Interim broken state: marker present, key already re-wrapped under the new
    // KEK, but the session still holds the old KEK → the key is unreadable.
    expect(localStorage.getItem(MARKER)).not.toBeNull();
    await expect(getLocalKey("a")).rejects.toThrow();

    // Forward recovery: unlocking with the NEW passphrase completes the rotation.
    await expect(unlockDeviceKeystore("new")).resolves.toBe(true);
    expect(localStorage.getItem(MARKER)).toBeNull();
    expect(await getLocalKey("a")).toBe(dek);

    lockDeviceKeystore();
    await expect(unlockDeviceKeystore("old")).rejects.toThrow();
  });

  it("wipeLocalKeystore erases all key material but spares other storage", async () => {
    await enableDevicePassphrase("pw");
    await storeLocalKey("a", makeDEK());
    await storeLocalKey("b", makeDEK());
    localStorage.setItem("vet_rate_app_version", "9.9.9"); // unrelated

    const removed = wipeLocalKeystore();

    expect(removed).toBe(4); // 2 wrapped + meta + verifier
    expect(localStorage.getItem(WRAPPED + "a")).toBeNull();
    expect(localStorage.getItem(WRAPPED + "b")).toBeNull();
    expect(localStorage.getItem(META)).toBeNull();
    expect(localStorage.getItem(VERIFIER)).toBeNull();
    expect(isDevicePassphraseEnabled()).toBe(false);
    expect(isKeystoreUnlocked()).toBe(false);
    expect(localStorage.getItem("vet_rate_app_version")).toBe("9.9.9");
  });
});
