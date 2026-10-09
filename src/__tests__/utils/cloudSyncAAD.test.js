import { describe, it, expect } from "vitest";
import {
  encryptData,
  decryptData,
  selectWriteKey,
  selectRestoreKey,
  isWeakWriteKey,
  LEGACY_DEFAULT_KEY,
} from "../../utils/cloudSync";

async function deriveLegacyAesGcmKey(password, salt, iterations) {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
}

function concatBytes(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

describe("cloudSync - VS3 magic + AAD-bound AES-GCM", () => {
  it("encrypts to VS3 envelope and roundtrips", async () => {
    const plaintext = JSON.stringify({ packet: "test", n: 7 });
    const cipher = await encryptData(plaintext, "passphrase");

    const bytes = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0));
    expect(bytes[0]).toBe(0x56); // 'V'
    expect(bytes[1]).toBe(0x53); // 'S'
    expect(bytes[2]).toBe(0x33); // '3'
    expect(bytes[3]).toBe(0x00); // \0

    const out = await decryptData(cipher, "passphrase");
    expect(out).toBe(plaintext);
  });

  it("wrong passphrase fails", async () => {
    const cipher = await encryptData("hello", "right");
    await expect(decryptData(cipher, "wrong")).rejects.toThrow();
  });

  it("tampered VS3 ciphertext fails the GCM tag check", async () => {
    const cipher = await encryptData("payload", "passphrase");
    const bytes = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0));
    bytes[bytes.length - 5] ^= 0x40;
    const tampered = btoa(String.fromCharCode(...bytes));
    await expect(decryptData(tampered, "passphrase")).rejects.toThrow();
  });

  it("downgrade attempt: flipping VS3→VS2 magic on a V3 ciphertext fails", async () => {
    const cipher = await encryptData("payload", "passphrase");
    const bytes = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0));
    bytes[2] = 0x32; // 'V','S','2','\0' - claim V2 envelope (no AAD)
    const downgraded = btoa(String.fromCharCode(...bytes));
    await expect(decryptData(downgraded, "passphrase")).rejects.toThrow();
  });

  it("legacy VS2 envelope still decrypts (regression safety)", async () => {
    // Hand-build a VS2 envelope by encrypting without AAD, prefixing VS2 magic.
    const testPassphrase = "passphrase";
    const plaintext = "legacy data";
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveLegacyAesGcmKey(testPassphrase, salt, 600_000);
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(plaintext),
    );
    const magicV2 = new Uint8Array([0x56, 0x53, 0x32, 0x00]);
    const out = concatBytes(magicV2, salt, iv, new Uint8Array(ct));
    const b64 = btoa(String.fromCharCode(...out));

    const decrypted = await decryptData(b64, testPassphrase);
    expect(decrypted).toBe(plaintext);
  });

  it("legacy V1 envelope (no magic, fixed salt, 100k iters) still decrypts (regression safety)", async () => {
    // Oldest backups: no magic prefix, fixed salt "vet-rate-salt-v1", 100k
    // iterations, no AAD - layout iv[12] || ciphertext. Pins the cloudSync.js
    // V1 fallback path before any refactor near _deriveKey.
    const testPassphrase = "passphrase";
    const plaintext = "ancient backup";
    const enc = new TextEncoder();
    const salt = enc.encode("vet-rate-salt-v1");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveLegacyAesGcmKey(testPassphrase, salt, 100_000);
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(plaintext),
    );
    const out = concatBytes(iv, new Uint8Array(ct));
    const b64 = btoa(String.fromCharCode(...out));

    const decrypted = await decryptData(b64, testPassphrase);
    expect(decrypted).toBe(plaintext);
  });
});

describe("cloudSync - key selection (S16 commit G, default-key retirement)", () => {
  it("selectWriteKey prefers the passphrase, then the account email", () => {
    expect(selectWriteKey("pp", { email: "vet@example.com" })).toBe("pp");
    expect(selectWriteKey(null, { email: "vet@example.com" })).toBe(
      "vet@example.com",
    );
  });

  it("selectWriteKey refuses the legacy default key (throws with no passphrase or email)", () => {
    expect(() => selectWriteKey(null, null)).toThrow(/passphrase|sign in/i);
    expect(() => selectWriteKey("", { email: "" })).toThrow();
    expect(() => selectWriteKey(undefined, undefined)).toThrow();
    // A user with no email must throw, never silently fall back to the constant.
    expect(() => selectWriteKey(null, {})).toThrow();
  });

  it("selectRestoreKey keeps the legacy default as a last resort", () => {
    expect(selectRestoreKey("pp", { email: "vet@example.com" })).toBe("pp");
    expect(selectRestoreKey(null, { email: "vet@example.com" })).toBe(
      "vet@example.com",
    );
    expect(selectRestoreKey(null, null)).toBe(LEGACY_DEFAULT_KEY);
    expect(selectRestoreKey(null, {})).toBe(LEGACY_DEFAULT_KEY);
  });

  it("isWeakWriteKey flags passphrase-less (email-derived) writes", () => {
    // No passphrase → the write falls back to the email-derived key: weak.
    expect(isWeakWriteKey(null)).toBe(true);
    expect(isWeakWriteKey("")).toBe(true);
    expect(isWeakWriteKey(undefined)).toBe(true);
    // A real passphrase → strong.
    expect(isWeakWriteKey("correct horse battery staple")).toBe(false);
  });
});
