import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory idb-keyval stub — keeps tests deterministic and isolated.
const store = new Map();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (k) => store.get(k)),
  set: vi.fn(async (k, v) => {
    store.set(k, JSON.parse(JSON.stringify(v)));
  }),
  del: vi.fn(async (k) => {
    store.delete(k);
  }),
  keys: vi.fn(async () => [...store.keys()]),
  clear: vi.fn(async () => {
    store.clear();
  }),
}));

const {
  logModelCall,
  logModelCallWithDigests,
  getRecentLogs,
  verifyLogChain,
  exportLogs,
  clearLogs,
  getLogCount,
} = await import("../../utils/aiAuditLog");

beforeEach(() => {
  store.clear();
});

describe("logModelCall — basic append", () => {
  it("returns seq=1 and a hash for the first entry", async () => {
    const { seq, hash } = await logModelCall({
      tag: "test",
      model: "stub",
    });
    expect(seq).toBe(1);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("increments seq monotonically", async () => {
    const a = await logModelCall({ tag: "a", model: "x" });
    const b = await logModelCall({ tag: "b", model: "x" });
    const c = await logModelCall({ tag: "c", model: "x" });
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);
    expect(c.seq).toBe(3);
  });

  it("chains hashes — prevHash of entry n+1 equals hash of entry n", async () => {
    await logModelCall({ tag: "a", model: "x" });
    await logModelCall({ tag: "b", model: "x" });
    const [latest, prior] = await getRecentLogs(2);
    expect(latest.prevHash).toBe(prior.hash);
  });

  it("genesis prevHash is 64 zeros", async () => {
    await logModelCall({ tag: "first", model: "x" });
    const [entry] = await getRecentLogs(1);
    expect(entry.prevHash).toBe("0".repeat(64));
  });

  it("defaults missing fields safely", async () => {
    const { seq } = await logModelCall({});
    expect(seq).toBe(1);
    const [entry] = await getRecentLogs(1);
    expect(entry.tag).toBe("unknown");
    expect(entry.model).toBe("unknown");
  });
});

describe("logModelCallWithDigests", () => {
  it("computes promptDigest and outputDigest", async () => {
    await logModelCallWithDigests({
      tag: "dual-llm/extract",
      model: "gemini",
      prompt: "hello",
      output: "world",
    });
    const [entry] = await getRecentLogs(1);
    expect(entry.promptDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.outputDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.promptLength).toBe(5);
    expect(entry.outputLength).toBe(5);
  });

  it("digests are reproducible for the same input", async () => {
    await logModelCallWithDigests({
      tag: "a",
      model: "x",
      prompt: "abc",
      output: "def",
    });
    await logModelCallWithDigests({
      tag: "b",
      model: "x",
      prompt: "abc",
      output: "def",
    });
    const logs = await getRecentLogs(2);
    expect(logs[0].promptDigest).toBe(logs[1].promptDigest);
    expect(logs[0].outputDigest).toBe(logs[1].outputDigest);
  });
});

describe("getRecentLogs — ordering", () => {
  it("returns newest first", async () => {
    await logModelCall({ tag: "first", model: "x" });
    await logModelCall({ tag: "second", model: "x" });
    await logModelCall({ tag: "third", model: "x" });
    const logs = await getRecentLogs(10);
    expect(logs.map((l) => l.tag)).toEqual(["third", "second", "first"]);
  });

  it("respects n limit", async () => {
    for (let i = 0; i < 5; i++) {
      await logModelCall({ tag: `t${i}`, model: "x" });
    }
    const logs = await getRecentLogs(2);
    expect(logs).toHaveLength(2);
    expect(logs[0].tag).toBe("t4");
  });

  it("returns empty array on an empty log", async () => {
    const logs = await getRecentLogs(10);
    expect(logs).toEqual([]);
  });
});

describe("verifyLogChain — tamper detection", () => {
  it("returns ok=true for a clean chain", async () => {
    await logModelCall({ tag: "a", model: "x" });
    await logModelCall({ tag: "b", model: "x" });
    await logModelCall({ tag: "c", model: "x" });
    const result = await verifyLogChain();
    expect(result.ok).toBe(true);
    expect(result.totalChecked).toBe(3);
  });

  it("detects a tampered entry (content mutation)", async () => {
    await logModelCall({ tag: "a", model: "x" });
    await logModelCall({ tag: "b", model: "x" });
    await logModelCall({ tag: "c", model: "x" });

    // Mutate entry 2's tag without updating its hash.
    const target = store.get("ailog:2");
    target.tag = "TAMPERED";
    store.set("ailog:2", target);

    const result = await verifyLogChain();
    expect(result.ok).toBe(false);
    expect(result.badSeq).toBe(2);
    expect(result.reason).toBe("hash");
  });

  it("detects a missing entry mid-chain", async () => {
    await logModelCall({ tag: "a", model: "x" });
    await logModelCall({ tag: "b", model: "x" });
    await logModelCall({ tag: "c", model: "x" });

    store.delete("ailog:2");

    const result = await verifyLogChain();
    expect(result.ok).toBe(false);
    expect(result.badSeq).toBe(2);
    expect(result.reason).toBe("missing");
  });

  it("detects a broken prevHash link", async () => {
    await logModelCall({ tag: "a", model: "x" });
    await logModelCall({ tag: "b", model: "x" });

    // Replace entry 2's prevHash with a bogus value (but leave its own hash).
    const target = store.get("ailog:2");
    target.prevHash = "f".repeat(64);
    store.set("ailog:2", target);

    const result = await verifyLogChain();
    expect(result.ok).toBe(false);
    expect(result.badSeq).toBe(2);
    expect(result.reason).toBe("prevHash");
  });
});

describe("exportLogs / getLogCount", () => {
  it("exportLogs returns meta + ordered entries", async () => {
    await logModelCall({ tag: "a", model: "x" });
    await logModelCall({ tag: "b", model: "x" });
    const dump = await exportLogs();
    expect(dump.meta.totalEntries).toBe(2);
    expect(dump.entries).toHaveLength(2);
    expect(dump.entries[0].seq).toBe(1);
    expect(dump.entries[1].seq).toBe(2);
  });

  it("getLogCount tracks total entries", async () => {
    expect(await getLogCount()).toBe(0);
    await logModelCall({ tag: "a", model: "x" });
    expect(await getLogCount()).toBe(1);
    await logModelCall({ tag: "b", model: "x" });
    expect(await getLogCount()).toBe(2);
  });
});

describe("clearLogs", () => {
  it("clears all entries", async () => {
    await logModelCall({ tag: "a", model: "x" });
    await logModelCall({ tag: "b", model: "x" });
    await clearLogs();
    // clearLogs itself appends a single 'audit:cleared' entry.
    expect(await getLogCount()).toBe(1);
    const [entry] = await getRecentLogs(1);
    expect(entry.tag).toBe("audit:cleared");
  });

  it("resets the chain — new genesis prevHash is zeros", async () => {
    await logModelCall({ tag: "a", model: "x" });
    await clearLogs();
    const [entry] = await getRecentLogs(1);
    expect(entry.prevHash).toBe("0".repeat(64));
  });

  it("chain verification passes after clear", async () => {
    await logModelCall({ tag: "a", model: "x" });
    await logModelCall({ tag: "b", model: "x" });
    await clearLogs();
    await logModelCall({ tag: "fresh", model: "x" });
    const result = await verifyLogChain();
    expect(result.ok).toBe(true);
  });
});
