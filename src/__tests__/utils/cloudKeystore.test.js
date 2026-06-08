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
const VERIFIER_TAG = "vet_rate_kek_verifier_tag";

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

    expect(removed).toBe(5); // 2 wrapped + meta + verifier + verifier tag
    expect(localStorage.getItem(WRAPPED + "a")).toBeNull();
    expect(localStorage.getItem(WRAPPED + "b")).toBeNull();
    expect(localStorage.getItem(META)).toBeNull();
    expect(localStorage.getItem(VERIFIER)).toBeNull();
    expect(localStorage.getItem(VERIFIER_TAG)).toBeNull();
    expect(isDevicePassphraseEnabled()).toBe(false);
    expect(isKeystoreUnlocked()).toBe(false);
    expect(localStorage.getItem("vet_rate_app_version")).toBe("9.9.9");
  });
});

describe("cloudEncryption — keystore hardening (S16 commit F/G review)", () => {
  it("reports a corrupt verifier blob as corruption, not a wrong passphrase", async () => {
    await enableDevicePassphrase("pw");
    lockDeviceKeystore();
    localStorage.setItem(VERIFIER, btoa("too short to be an AES-KW blob"));

    await expect(unlockDeviceKeystore("pw")).rejects.toThrow(/corrupt/i);
    await expect(unlockDeviceKeystore("pw")).rejects.not.toThrow(
      /Incorrect device passphrase/,
    );
  });

  it("reports a corrupt KEK descriptor as corruption, not a raw SyntaxError", async () => {
    await enableDevicePassphrase("pw");
    lockDeviceKeystore();
    localStorage.setItem(META, "{ not valid json");

    await expect(unlockDeviceKeystore("pw")).rejects.toThrow(/corrupt/i);
    await expect(unlockDeviceKeystore("pw")).rejects.not.toThrow(/SyntaxError/);
  });

  it("rolls back a corrupt rotation marker so the old passphrase still unlocks", async () => {
    await enableDevicePassphrase("old");
    const dek = makeDEK();
    await storeLocalKey("a", dek);
    lockDeviceKeystore();

    // Non-JSON marker written AFTER a real enable+store, so the old META and
    // VERIFIER stay valid for the rollback path to recover to.
    localStorage.setItem(MARKER, "{ corrupt marker");

    await expect(unlockDeviceKeystore("old")).resolves.toBe(true);
    expect(localStorage.getItem(MARKER)).toBeNull(); // rolled back
    expect(await getLocalKey("a")).toBe(dek); // key still readable under old KEK
  });

  it("honors meta.iterations on unlock (a tampered count rejects the right passphrase)", async () => {
    await enableDevicePassphrase("pw");
    lockDeviceKeystore();
    const meta = JSON.parse(localStorage.getItem(META));
    meta.iterations = (meta.iterations || 600000) + 1; // changes the derived KEK
    localStorage.setItem(META, JSON.stringify(meta));

    await expect(unlockDeviceKeystore("pw")).rejects.toThrow(
      /Incorrect device passphrase/,
    );
  });

  it("getLocalKey throws the KEYSTORE_LOCKED sentinel when locked", async () => {
    await enableDevicePassphrase("pw");
    await storeLocalKey("a", makeDEK());
    lockDeviceKeystore();

    await expect(getLocalKey("a")).rejects.toThrow(/KEYSTORE_LOCKED/);
  });

  it("sweeps a stray plaintext DEK into wrapped during unlock (no get needed)", async () => {
    await enableDevicePassphrase("pw");
    const dek = makeDEK();
    lockDeviceKeystore();
    localStorage.setItem(PLAINTEXT + "stray", dek); // a crash-left plaintext key

    await unlockDeviceKeystore("pw");

    // Healed by the unlock sweep, before any getLocalKey read.
    expect(localStorage.getItem(PLAINTEXT + "stray")).toBeNull();
    expect(localStorage.getItem(WRAPPED + "stray")).not.toBeNull();
    expect(await getLocalKey("stray")).toBe(dek);
  });

  it("folds in a key stored concurrently during rotation (re-scan-fold)", async () => {
    await enableDevicePassphrase("old");
    await storeLocalKey("a", makeDEK());

    const injectedDEK = makeDEK();
    const realWrapKey = window.crypto.subtle.wrapKey.bind(window.crypto.subtle);
    let wrapCalls = 0;
    const spy = vi
      .spyOn(window.crypto.subtle, "wrapKey")
      .mockImplementation((...args) => {
        wrapCalls += 1;
        // Call 1 is makeVerifier (before the phase-1 snapshot). Inject on call 2
        // — the first DEK being staged — to model a sibling tab storing a key
        // after the snapshot would have been taken in the pre-fix code.
        const inject =
          wrapCalls === 2
            ? storeLocalKey("concurrent", injectedDEK)
            : Promise.resolve();
        return inject.then(() => realWrapKey(...args));
      });

    await rotateDevicePassphrase("new");
    spy.mockRestore();

    lockDeviceKeystore();
    await expect(unlockDeviceKeystore("new")).resolves.toBe(true);
    expect(await getLocalKey("concurrent")).toBe(injectedDEK);
  });

  it("preserves the old material against a shape-valid but garbage rotation marker (verify-before-commit)", async () => {
    await enableDevicePassphrase("old");
    const dek = makeDEK();
    await storeLocalKey("a", dek);
    lockDeviceKeystore();

    const metaBefore = localStorage.getItem(META);
    const verifierBefore = localStorage.getItem(VERIFIER);

    // Passes the structural shape check — 16-byte salt, 40-byte verifier — but the
    // verifier is garbage: no derivable KEK unwraps it. The pre-fix shape-only
    // check would have committed this over the intact old META/VERIFIER, deriving
    // a wrong KEK forever after → a permanent brick even for the correct old
    // passphrase. Verify-before-commit must refuse to commit it.
    localStorage.setItem(
      MARKER,
      JSON.stringify({
        meta: { v: 1, salt: btoa("0123456789abcdef"), iterations: 600000 },
        verifier: btoa("0123456789abcdef0123456789abcdef01234567"),
      }),
    );

    await expect(unlockDeviceKeystore("old")).resolves.toBe(true);
    // Old material untouched — the unconfirmed marker was never committed. (The
    // shape-valid marker legitimately lingers for a forward completion that can
    // never come; it does no harm because it is never committed.)
    expect(localStorage.getItem(META)).toBe(metaBefore);
    expect(localStorage.getItem(VERIFIER)).toBe(verifierBefore);
    expect(await getLocalKey("a")).toBe(dek);
  });

  it("rejects the OLD passphrase after a phase-2 crash instead of a false-success (keys already under the new KEK)", async () => {
    await enableDevicePassphrase("old");
    const dek = makeDEK();
    await storeLocalKey("a", dek);

    // Same fault injection as the mid-phase-2 recovery test: crash when phase 2
    // swaps in the new descriptor. The key is already promoted to WRAPPED under
    // the NEW KEK, the marker is present, old META/VERIFIER are still intact.
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
    lockDeviceKeystore();

    // The OLD passphrase verifies the intact old descriptor, but the live key is
    // under the NEW KEK — unlock must NOT return a misleading success that serves
    // a keystore it cannot read. It steers the user to the new passphrase and
    // leaves the marker for forward completion.
    await expect(unlockDeviceKeystore("old")).rejects.toThrow(
      /passphrase change is in progress/i,
    );
    expect(isKeystoreUnlocked()).toBe(false);
    expect(localStorage.getItem(MARKER)).not.toBeNull();

    // The NEW passphrase completes the rotation forward and recovers the key.
    await expect(unlockDeviceKeystore("new")).resolves.toBe(true);
    expect(localStorage.getItem(MARKER)).toBeNull();
    expect(await getLocalKey("a")).toBe(dek);
  });

  it("self-heals an invalid meta.iterations by falling back to the default", async () => {
    await enableDevicePassphrase("pw");
    lockDeviceKeystore();
    const meta = JSON.parse(localStorage.getItem(META));
    meta.iterations = -5; // not a positive int → validIterations falls back to 600k
    localStorage.setItem(META, JSON.stringify(meta));

    // Contrast with the "honors meta.iterations" test: a *valid* tampered count
    // (600001) derives a wrong KEK and rejects, but an *invalid* one self-heals.
    await expect(unlockDeviceKeystore("pw")).resolves.toBe(true);
    expect(isKeystoreUnlocked()).toBe(true);
  });

  it("reports a verifier with a mismatched integrity tag as corruption, not wrong passphrase", async () => {
    await enableDevicePassphrase("pw");
    lockDeviceKeystore();
    // The verifier bytes are valid length/format but the stored tag no longer
    // matches them — simulates accidental storage corruption of one but not
    // the other (e.g. a partial write during a browser crash).
    localStorage.setItem(
      VERIFIER_TAG,
      btoa("wrong-tag-value-intentionally-bad"),
    );

    await expect(unlockDeviceKeystore("pw")).rejects.toThrow(/corrupt/i);
    await expect(unlockDeviceKeystore("pw")).rejects.not.toThrow(
      /Incorrect device passphrase/,
    );
  });

  it("lazily writes the verifier tag on first unlock of a legacy keystore", async () => {
    await enableDevicePassphrase("pw");
    lockDeviceKeystore();
    localStorage.removeItem(VERIFIER_TAG); // simulate a keystore created before the tag was introduced

    expect(localStorage.getItem(VERIFIER_TAG)).toBeNull();
    await expect(unlockDeviceKeystore("pw")).resolves.toBe(true);
    expect(localStorage.getItem(VERIFIER_TAG)).not.toBeNull(); // healed
  });

  it("heals a good plaintext key on unlock even when a sibling plaintext blob is corrupt", async () => {
    await enableDevicePassphrase("pw");
    lockDeviceKeystore();
    // "0_bad" iterates before "good" (insertion order); without per-key isolation
    // its importKey rejection would abort the sweep and strand "good" in plaintext.
    localStorage.setItem(PLAINTEXT + "0_bad", btoa("short")); // 5 bytes → importKey rejects
    const good = makeDEK();
    localStorage.setItem(PLAINTEXT + "good", good);

    await expect(unlockDeviceKeystore("pw")).resolves.toBe(true);

    expect(localStorage.getItem(PLAINTEXT + "good")).toBeNull();
    expect(localStorage.getItem(WRAPPED + "good")).not.toBeNull();
    expect(await getLocalKey("good")).toBe(good);
  });
});

describe("cloudEncryption — Web Locks rotation serialization (S16 deferred)", () => {
  it("routes operations through navigator.locks.request when available", async () => {
    const mockRequest = vi.fn((_name, fn) => fn());
    const origDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks");
    Object.defineProperty(navigator, "locks", {
      value: { request: mockRequest },
      configurable: true,
      writable: true,
    });
    try {
      await enableDevicePassphrase("pw");
      expect(mockRequest).toHaveBeenCalledWith(
        "vet_rate_keystore_rotation",
        expect.any(Function),
      );
    } finally {
      if (origDescriptor !== undefined) {
        Object.defineProperty(navigator, "locks", origDescriptor);
      } else {
        Object.defineProperty(navigator, "locks", {
          value: undefined,
          configurable: true,
          writable: true,
        });
      }
    }
  });

  it("serializes two consecutive rotations (second reads the first's updated KEK)", async () => {
    await enableDevicePassphrase("first");
    const dek = makeDEK();
    await storeLocalKey("k", dek);

    await rotateDevicePassphrase("second");
    await rotateDevicePassphrase("third");

    lockDeviceKeystore();
    await expect(unlockDeviceKeystore("third")).resolves.toBe(true);
    expect(await getLocalKey("k")).toBe(dek);
    lockDeviceKeystore();
    await expect(unlockDeviceKeystore("second")).rejects.toThrow();
  });
});
