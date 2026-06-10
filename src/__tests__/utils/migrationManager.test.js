import { describe, it, expect, vi, afterEach } from "vitest";
import {
  migratePacket,
  CURRENT_PACKET_VERSION,
} from "../../utils/migrationManager";
import { importPacketData } from "../../utils/packetBackup";
import { ensureQuota } from "../../utils/storage";

const makeV1Packet = () => ({
  version: "1.0",
  exportDate: "2025-03-01T00:00:00.000Z",
  source: "Vet-Rate.org",
  disclaimer:
    "This backup contains personal claim data. Keep it secure and private.",
  data: {
    claims: [
      {
        id: "claim_test_1",
        conditionName: "Tinnitus",
        dateSaved: "2025-03-01T00:00:00.000Z",
        status: "Drafting",
        diagnosticCode: 6260,
        selectedRating: 10,
      },
    ],
    statements: {
      claim_test_1: {
        statement: "Ringing in both ears began during service.",
        savedDate: "2025-03-01T00:00:00.000Z",
      },
    },
  },
});

describe("CURRENT_PACKET_VERSION", () => {
  it("is 2.0.0", () => {
    expect(CURRENT_PACKET_VERSION).toBe("2.0.0");
  });
});

describe("migratePacket", () => {
  it("upgrades a v1.0 packet to 2.0.0 preserving claims and statements", () => {
    const migrated = migratePacket(makeV1Packet());

    expect(migrated.version).toBe("2.0.0");
    expect(migrated.source).toBe("Vet-Rate.org");
    expect(migrated.data.claims).toHaveLength(1);
    expect(migrated.data.claims[0].conditionName).toBe("Tinnitus");
    expect(migrated.data.statements.claim_test_1.statement).toMatch(/Ringing/);
  });

  it("guarantees claims array and statements object even when absent", () => {
    const migrated = migratePacket({
      version: "1.0",
      source: "Vet-Rate.org",
      data: {},
    });

    expect(migrated.version).toBe("2.0.0");
    expect(migrated.data.claims).toEqual([]);
    expect(migrated.data.statements).toEqual({});
  });

  it("does not fabricate optional sections that imports treat as overwrites", () => {
    const migrated = migratePacket(makeV1Packet());

    expect(migrated.data).not.toHaveProperty("serviceHistory");
    expect(migrated.data).not.toHaveProperty("myRatings");
    expect(migrated.data).not.toHaveProperty("savedForms");
    expect(migrated.data).not.toHaveProperty("veteranProfile");
  });

  it("is idempotent — migrating a 2.0.0 packet is a no-op", () => {
    const once = migratePacket(makeV1Packet());
    const twice = migratePacket(once);

    expect(twice).toEqual(once);
  });

  it("passes a v2.0.0 complete packet through unchanged", () => {
    const v2 = {
      version: "2.0.0",
      source: "Vet-Rate.org",
      data: {
        claims: [],
        statements: {},
        veteranProfile: { firstName: "John" },
        serviceHistory: { deployments: [], awards: [], dd214Data: null },
        myRatings: [{ id: "rating_1", name: "Tinnitus", rating: 10 }],
      },
    };

    expect(migratePacket(v2)).toBe(v2);
  });

  it("is pure — does not mutate the input packet", () => {
    const input = makeV1Packet();
    const snapshot = JSON.parse(JSON.stringify(input));

    migratePacket(input);

    expect(input).toEqual(snapshot);
  });

  it("returns non-object input unchanged", () => {
    expect(migratePacket(null)).toBe(null);
    expect(migratePacket(undefined)).toBe(undefined);
    expect(migratePacket([1, 2])).toEqual([1, 2]);
  });
});

describe("importPacketData version-aware import", () => {
  it("accepts a v1.0 backup and upgrades it in memory", () => {
    const result = importPacketData(JSON.stringify(makeV1Packet()));

    expect(result.success).toBe(true);
    expect(result.meta.version).toBe("2.0.0");
    expect(result.data.claims).toHaveLength(1);
    expect(result.data.claims[0].conditionName).toBe("Tinnitus");
    expect(Object.keys(result.data.statements)).toHaveLength(1);
  });
});

describe("ensureQuota", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok when navigator.storage is missing", async () => {
    vi.stubGlobal("navigator", {});

    const result = await ensureQuota(1024);

    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(null);
  });

  it("returns ok when there is enough quota", async () => {
    vi.stubGlobal("navigator", {
      storage: { estimate: async () => ({ usage: 100, quota: 1_000_000 }) },
    });

    const result = await ensureQuota(1024);

    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(999_900);
  });

  it("flags insufficient quota with an actionable message", async () => {
    vi.stubGlobal("navigator", {
      storage: { estimate: async () => ({ usage: 90, quota: 100 }) },
    });

    const result = await ensureQuota(1024);

    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(10);
    expect(result.message).toMatch(/backup/i);
  });

  it("never throws — resolves ok when estimate fails", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: async () => {
          throw new Error("estimate unavailable");
        },
      },
    });

    await expect(ensureQuota(1024)).resolves.toMatchObject({ ok: true });
  });
});
