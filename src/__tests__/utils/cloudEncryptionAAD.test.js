import { describe, it, expect } from "vitest";
import {
  encryptForCloud,
  decryptFromCloud,
  isEncryptedBackup,
} from "../../utils/cloudEncryption";

describe("cloudEncryption - VR_ENC_V3 (AAD-bound)", () => {
  it("encrypts to V3 envelope and roundtrips with a passphrase", async () => {
    const data = { veteran: "redacted", evidence: ["lay-stmt", "dbq"] };
    const { encryptedPackage, keyExport } = await encryptForCloud(
      data,
      "correct horse battery staple",
    );

    expect(encryptedPackage.version).toBe("VR_ENC_V3");
    expect(encryptedPackage.hasPassphrase).toBe(true);
    expect(keyExport).toBeNull();

    const out = await decryptFromCloud(
      encryptedPackage,
      "correct horse battery staple",
      true,
    );
    expect(out).toEqual(data);
  });

  it("encrypts to V3 envelope and roundtrips with a random key (no passphrase)", async () => {
    const data = { foo: "bar", n: 42 };
    const { encryptedPackage, keyExport } = await encryptForCloud(data);

    expect(encryptedPackage.version).toBe("VR_ENC_V3");
    expect(encryptedPackage.hasPassphrase).toBe(false);
    expect(typeof keyExport).toBe("string");

    const out = await decryptFromCloud(encryptedPackage, keyExport, false);
    expect(out).toEqual(data);
  });

  it("AAD binding: a V3 ciphertext relabeled as V2 fails to decrypt", async () => {
    const { encryptedPackage } = await encryptForCloud(
      { secret: 1 },
      "passphrase",
    );

    const tampered = { ...encryptedPackage, version: "VR_ENC_V2" };

    await expect(
      decryptFromCloud(tampered, "passphrase", true),
    ).rejects.toThrow(/Decryption failed/);
  });

  it("AAD binding: tampering the ciphertext fails", async () => {
    const { encryptedPackage } = await encryptForCloud(
      { secret: 1 },
      "passphrase",
    );
    const flipped = { ...encryptedPackage };
    const bytes = atob(encryptedPackage.data);
    const arr = Array.from(bytes).map((c) => c.charCodeAt(0));
    arr[arr.length - 5] ^= 0x80;
    flipped.data = btoa(String.fromCharCode(...arr));

    await expect(decryptFromCloud(flipped, "passphrase", true)).rejects.toThrow(
      /Decryption failed/,
    );
  });

  it("isEncryptedBackup recognizes V1, V2, V3 envelopes; rejects unknown", () => {
    expect(isEncryptedBackup({ version: "VR_ENC_V1", encrypted: true })).toBe(
      true,
    );
    expect(isEncryptedBackup({ version: "VR_ENC_V2", encrypted: true })).toBe(
      true,
    );
    expect(isEncryptedBackup({ version: "VR_ENC_V3", encrypted: true })).toBe(
      true,
    );
    expect(isEncryptedBackup({ version: "VR_ENC_V4", encrypted: true })).toBe(
      false,
    );
    expect(isEncryptedBackup({ encrypted: true })).toBeFalsy();
    expect(isEncryptedBackup(null)).toBeFalsy();
  });
});
