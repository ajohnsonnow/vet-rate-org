import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  logger,
  getLogs,
  getLogCount,
  clearLogs,
  exportLogs,
  setLevel,
  getLevel,
  setConsolePassthrough,
  setPersistEnabled,
  isPersistEnabled,
  getPersistedLogs,
  clearPersistedLogs,
  __resetForTests,
} from "../../utils/logger";

describe("logger — ring buffer + levels", () => {
  beforeEach(() => {
    __resetForTests();
    setConsolePassthrough(false);
  });

  it("captures entries through the level API", () => {
    logger.info("hello");
    logger.warn("careful");
    logger.error("boom");
    const logs = getLogs();
    expect(logs).toHaveLength(3);
    expect(logs.map((e) => e.level)).toEqual(["info", "warn", "error"]);
    expect(logs.map((e) => e.msg)).toEqual(["hello", "careful", "boom"]);
  });

  it("drops entries below the minimum level", () => {
    setLevel("warn");
    logger.debug("noisy");
    logger.info("quieter");
    logger.warn("audible");
    expect(getLogs().map((e) => e.level)).toEqual(["warn"]);
  });

  it("default level is info — debug is silent unless opted in", () => {
    expect(getLevel()).toBe("info");
    logger.debug("hidden");
    expect(getLogs()).toHaveLength(0);
  });

  it("setLevel accepts numeric values", () => {
    setLevel(40); // error
    logger.warn("dropped");
    logger.error("kept");
    expect(getLogs()).toHaveLength(1);
    expect(getLogs()[0].msg).toBe("kept");
  });

  it("each entry has seq + ts + level + msg", () => {
    logger.info("first");
    logger.info("second");
    const [a, b] = getLogs();
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);
    expect(typeof a.ts).toBe("number");
    expect(a.level).toBe("info");
    expect(a.msg).toBe("first");
  });

  it("attaches optional fields object", () => {
    logger.info("with context", { userId: "anon", tool: "rater" });
    const [entry] = getLogs();
    expect(entry.fields).toEqual({ userId: "anon", tool: "rater" });
  });

  it("clearLogs empties the buffer and resets head", () => {
    logger.info("a");
    logger.info("b");
    expect(getLogCount()).toBe(2);
    clearLogs();
    expect(getLogCount()).toBe(0);
    expect(getLogs()).toEqual([]);
  });

  it("ring wraps once size is exceeded (FIFO eviction)", () => {
    // We don't expose RING_SIZE; just push enough to force a wrap.
    for (let i = 1; i <= 510; i++) logger.info(`m${i}`);
    const logs = getLogs();
    expect(logs.length).toBe(500);
    expect(logs[0].msg).toBe("m11"); // oldest 10 evicted
    expect(logs[logs.length - 1].msg).toBe("m510");
  });
});

describe("logger — export shape", () => {
  beforeEach(() => {
    __resetForTests();
    setConsolePassthrough(false);
  });

  it("exportLogs returns metadata + ordered entries", () => {
    logger.info("a");
    logger.warn("b");
    const dump = exportLogs();
    expect(dump).toMatchObject({
      count: 2,
      level: "info",
      entries: expect.any(Array),
    });
    expect(dump.entries).toHaveLength(2);
    expect(typeof dump.exportedAt).toBe("string");
    expect(() => new Date(dump.exportedAt).toISOString()).not.toThrow();
  });
});

describe("logger — console passthrough", () => {
  beforeEach(() => {
    __resetForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setConsolePassthrough(false);
  });

  it("forwards to console.info when passthrough is on", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    setConsolePassthrough(true);
    logger.info("hi");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("hi");
  });

  it("does not forward when passthrough is off", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    setConsolePassthrough(false);
    logger.info("silent");
    expect(spy).not.toHaveBeenCalled();
  });

  it("routes by level — error goes to console.error", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    setConsolePassthrough(true);
    logger.error("boom");
    logger.warn("careful");
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe("logger — persistence opt-in", () => {
  beforeEach(() => {
    __resetForTests();
    setConsolePassthrough(false);
    setPersistEnabled(false);
  });

  afterEach(() => {
    setPersistEnabled(false);
  });

  it("opt-in flag is off by default", () => {
    expect(isPersistEnabled()).toBe(false);
  });

  it("setPersistEnabled flips the flag and is queryable", () => {
    setPersistEnabled(true);
    expect(isPersistEnabled()).toBe(true);
    setPersistEnabled(false);
    expect(isPersistEnabled()).toBe(false);
  });

  it("getPersistedLogs returns [] when flag is off (even after log calls)", async () => {
    logger.info("not-persisted");
    const persisted = await getPersistedLogs();
    expect(persisted).toEqual([]);
  });

  it("clearPersistedLogs is a no-op-safe call", async () => {
    await expect(clearPersistedLogs()).resolves.not.toThrow();
  });
});
