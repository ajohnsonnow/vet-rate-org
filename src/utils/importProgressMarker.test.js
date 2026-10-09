/**
 * A tab the browser kills cannot show a message, so a small marker (neutral
 * labels and counts only) is kept in local storage while an import runs, with
 * an owner heartbeat, and read back on the next load in any tab. Quick Exit,
 * Atomic Wipe and Clear All Data must remove it, so the real wipe functions
 * are exercised here, not a copy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  IMPORT_MARKER_KEY,
  IMPORT_MARKER_KEY_PREFIX,
  HEARTBEAT_INTERVAL_MS,
  STALE_AFTER_MS,
  LIVENESS_TIMEOUT_MS,
  startImportMarker,
  recordDocumentSaved,
  clearImportMarker,
  clearAllImportMarkers,
  completeImportMarker,
  dismissInterruptedImport,
  findInterruptedImport,
  describeInterruptedImport,
} from "./importProgressMarker";
import { triggerPanicRedirect } from "./safetyRedirect";
import { wipeAllLocalData } from "../components/AtomicWipe";

const LABELS = [
  "document 1 (DD214)",
  "document 2 (UNKNOWN)",
  "document 3 (DBQ)",
];

const loadVkb = vi.hoisted(() => vi.fn());
vi.mock("./veteranKnowledgeBase", () => ({
  loadVKB: (...args) => loadVkb(...args),
  raceVkb: (promise) => promise,
}));

const markerKeys = () =>
  Array.from({ length: localStorage.length }, (_, i) =>
    localStorage.key(i),
  ).filter((key) => key.startsWith(IMPORT_MARKER_KEY_PREFIX));

function seedOtherTabMarker(id, { ageMs, saved = 1, total = 3 }) {
  localStorage.setItem(
    `${IMPORT_MARKER_KEY_PREFIX}${id}`,
    JSON.stringify({
      id,
      total,
      saved,
      labels: LABELS,
      owner: "another-tab",
      heartbeat: Date.now() - ageMs,
    }),
  );
}

beforeEach(() => {
  loadVkb.mockReset();
  loadVkb.mockRejectedValue(new Error("no store in this test"));
  vi.stubGlobal("BroadcastChannel", undefined);
  sessionStorage.clear();
  localStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  clearAllImportMarkers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the import marker", () => {
  it("lives in local storage and holds neutral labels and counts only", async () => {
    startImportMarker(LABELS);

    const [key] = markerKeys();
    const stored = localStorage.getItem(key);
    expect(markerKeys()).toHaveLength(1);
    expect(JSON.parse(stored)).toEqual({
      total: 3,
      saved: 0,
      labels: LABELS,
      id: expect.any(String),
      owner: expect.any(String),
      heartbeat: expect.any(Number),
      started: expect.any(Number),
    });
    expect(key).toBe(`${IMPORT_MARKER_KEY_PREFIX}${JSON.parse(stored).id}`);
    expect(stored).not.toMatch(/\.pdf|\.txt|\.docx/i);
    expect(sessionStorage.getItem(IMPORT_MARKER_KEY)).toBeNull();
  });

  it("counts documents as they are saved", async () => {
    startImportMarker(LABELS);
    recordDocumentSaved();
    recordDocumentSaved();

    const marker = JSON.parse(localStorage.getItem(markerKeys()[0]));
    expect(marker).toMatchObject({ saved: 2, total: 3 });
  });

  it("never counts past the total", async () => {
    startImportMarker(["document 1 (DD214)"]);
    recordDocumentSaved();
    recordDocumentSaved();

    const marker = JSON.parse(localStorage.getItem(markerKeys()[0]));
    expect(marker).toMatchObject({ saved: 1, total: 1 });
  });

  it("is gone once the import finishes or is cancelled", async () => {
    startImportMarker(LABELS);
    clearImportMarker();

    expect(markerKeys()).toHaveLength(0);
  });

  it("is not started for an empty import", async () => {
    startImportMarker([]);

    expect(markerKeys()).toHaveLength(0);
  });

  it("is not recreated by a save after the marker was removed", async () => {
    startImportMarker(LABELS);
    clearAllImportMarkers();

    recordDocumentSaved();

    expect(markerKeys()).toHaveLength(0);
  });
});

describe("telling a live import from an interrupted one", () => {
  it("shows a killed browser's marker once its heartbeat has gone stale", async () => {
    seedOtherTabMarker("killed", { ageMs: STALE_AFTER_MS + 1000, saved: 2 });

    expect(await findInterruptedImport()).toEqual({
      saved: 2,
      total: 3,
      id: "killed",
    });
  });

  it("never reports an import this tab is running", async () => {
    startImportMarker(LABELS);

    expect(await findInterruptedImport()).toBeNull();
  });

  it("never reports another tab's import while its heartbeat is fresh", async () => {
    seedOtherTabMarker("live-elsewhere", { ageMs: 1000 });

    expect(await findInterruptedImport()).toBeNull();
  });

  it("keeps a running import's heartbeat fresh so it never goes stale", async () => {
    vi.useFakeTimers();
    startImportMarker(LABELS);
    const key = markerKeys()[0];
    const started = JSON.parse(localStorage.getItem(key)).heartbeat;

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);

    expect(JSON.parse(localStorage.getItem(key)).heartbeat).toBeGreaterThan(
      started,
    );
  });

  it("stops beating once the marker is gone and does not bring it back", async () => {
    vi.useFakeTimers();
    startImportMarker(LABELS);
    localStorage.removeItem(markerKeys()[0]);

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);

    expect(markerKeys()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes an unreadable marker instead of reporting a wrong count", async () => {
    localStorage.setItem(`${IMPORT_MARKER_KEY_PREFIX}bad`, "{not json");

    expect(await findInterruptedImport()).toBeNull();
    expect(markerKeys()).toHaveLength(0);
  });

  it("rejects a marker whose counts do not add up", async () => {
    seedOtherTabMarker("bad-counts", { ageMs: STALE_AFTER_MS + 1, saved: 5 });

    expect(await findInterruptedImport()).toBeNull();
  });
});

describe("one tab never clears another tab's live import", () => {
  it("leaves a live marker alone when asked to clear it by id", async () => {
    seedOtherTabMarker("live-elsewhere", { ageMs: 1000 });

    clearImportMarker("live-elsewhere");

    expect(markerKeys()).toHaveLength(1);
  });

  it("leaves another tab's marker alone when clearing its own", async () => {
    seedOtherTabMarker("live-elsewhere", { ageMs: 1000 });
    startImportMarker(LABELS);

    clearImportMarker();

    expect(markerKeys()).toEqual([`${IMPORT_MARKER_KEY_PREFIX}live-elsewhere`]);
  });

  it("dismissing a stale marker removes it", async () => {
    seedOtherTabMarker("killed", { ageMs: STALE_AFTER_MS + 1000 });

    expect(await dismissInterruptedImport("killed")).toBe(true);

    expect(markerKeys()).toHaveLength(0);
    expect(await findInterruptedImport()).toBeNull();
  });
});

describe("the notice text", () => {
  it("says what happened, how many were saved and what to do", async () => {
    expect(describeInterruptedImport({ saved: 2, total: 5 })).toBe(
      "Your last import was interrupted before it finished. 2 of 5 documents were saved. Add the same files again to finish - nothing will be duplicated.",
    );
  });

  it("reads correctly for a single document", async () => {
    expect(describeInterruptedImport({ saved: 0, total: 1 })).toContain(
      "0 of 1 document was saved.",
    );
  });
});

describe("wiping", () => {
  it("Quick Exit (the panic redirect) removes every marker, live or not", async () => {
    vi.stubGlobal("location", { replace: vi.fn(), href: "" });
    startImportMarker(LABELS);
    seedOtherTabMarker("live-elsewhere", { ageMs: 1000 });
    sessionStorage.setItem(IMPORT_MARKER_KEY, "{}");

    triggerPanicRedirect();

    expect(markerKeys()).toHaveLength(0);
    expect(sessionStorage.getItem(IMPORT_MARKER_KEY)).toBeNull();
  });

  it("Atomic Wipe and every Clear All Data path remove every marker", async () => {
    startImportMarker(LABELS);
    seedOtherTabMarker("live-elsewhere", { ageMs: 1000 });

    await wipeAllLocalData();

    expect(markerKeys()).toHaveLength(0);
  });
});

describe("a browser without crypto.randomUUID", () => {
  it.each([
    ["only getRandomValues", { getRandomValues: (a) => a.fill(7) }],
    ["no crypto at all", undefined],
  ])("loads and keeps a marker with %s", async (_name, fakeCrypto) => {
    vi.stubGlobal("crypto", fakeCrypto);
    vi.resetModules();

    const marker = await import("./importProgressMarker");
    marker.startImportMarker(LABELS);

    const [key] = markerKeys();
    expect(JSON.parse(localStorage.getItem(key)).id).toMatch(/^[0-9a-f]+$/);
    marker.clearAllImportMarkers();
  });
});

const PREFIX = IMPORT_MARKER_KEY_PREFIX;
const LABELS_8 = Array.from({ length: 8 }, (_, i) => `document ${i + 1} (DBQ)`);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function loadPage() {
  vi.resetModules();
  return import("./importProgressMarker");
}

// A page's process dying releases its Web Locks; nothing else about it runs.
function installFakeLocks() {
  const held = new Set();
  const locks = {
    request(name, a, b) {
      const options = typeof a === "function" ? {} : a;
      const callback = typeof a === "function" ? a : b;
      if (held.has(name)) {
        return options.ifAvailable
          ? Promise.resolve(callback(null))
          : new Promise(() => {});
      }
      held.add(name);
      const done = Promise.resolve(callback({ name }));
      done.finally(() => held.delete(name));
      return done;
    },
    query: () =>
      Promise.resolve({
        held: Array.from(held, (name) => ({ name })),
        pending: [],
      }),
  };
  Object.defineProperty(navigator, "locks", {
    value: locks,
    configurable: true,
  });
  return { killEveryPage: () => held.clear() };
}

function installFakeChannel() {
  const open = new Set();
  class FakeChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      open.add(this);
    }

    postMessage(data) {
      for (const other of open) {
        if (other !== this && other.name === this.name) {
          queueMicrotask(() => other.onmessage?.({ data }));
        }
      }
    }

    close() {
      open.delete(this);
    }
  }
  vi.stubGlobal("BroadcastChannel", FakeChannel);
  return { killEveryPage: () => open.clear() };
}

function backdate(id, { heartbeat = false } = {}) {
  const key = `${PREFIX}${id}`;
  const marker = JSON.parse(localStorage.getItem(key));
  marker.started = Date.now() - 10 * 60 * 1000;
  if (heartbeat) marker.heartbeat = marker.started;
  localStorage.setItem(key, JSON.stringify(marker));
}

const onlyMarkerId = () => markerKeys()[0].slice(PREFIX.length);

afterEach(() => {
  Reflect.deleteProperty(navigator, "locks");
});

describe("a hard-stopped import is told apart from a live one by asking its owner", () => {
  it("is reported at once although its heartbeat is fresh", async () => {
    const { killEveryPage } = installFakeLocks();
    const stopped = await loadPage();
    stopped.startImportMarker(LABELS);
    stopped.recordDocumentSaved();
    backdate(onlyMarkerId());
    killEveryPage();

    const restarted = await loadPage();

    expect(await restarted.findInterruptedImport()).toMatchObject({
      saved: 1,
      total: 3,
    });
    stopped.clearAllImportMarkers();
  });

  it("is reported to two tabs checking at the same instant, and to a Dismiss that collides with a check", async () => {
    const { killEveryPage } = installFakeLocks();
    const stopped = await loadPage();
    stopped.startImportMarker(LABELS);
    backdate(onlyMarkerId());
    killEveryPage();
    const first = await loadPage();
    const second = await loadPage();

    const [a, b] = await Promise.all([
      first.findInterruptedImport(),
      second.findInterruptedImport(),
    ]);
    expect(a).toMatchObject({ total: 3 });
    expect(b).toMatchObject({ total: 3 });

    const [, dismissed] = await Promise.all([
      first.findInterruptedImport(),
      second.dismissInterruptedImport(onlyMarkerId()),
    ]);
    expect(dismissed).toBe(true);
    expect(markerKeys()).toHaveLength(0);
    stopped.clearAllImportMarkers();
  });

  it("is never reported while its owner lives, however old its heartbeat", async () => {
    installFakeLocks();
    const running = await loadPage();
    running.startImportMarker(LABELS);
    backdate(onlyMarkerId(), { heartbeat: true });

    const other = await loadPage();

    expect(await other.findInterruptedImport()).toBeNull();
    expect(markerKeys()).toHaveLength(1);
    running.clearAllImportMarkers();
  });

  it("is not judged in the first moments after it starts", async () => {
    const { killEveryPage } = installFakeLocks();
    const starting = await loadPage();
    starting.startImportMarker(LABELS);
    killEveryPage();

    const other = await loadPage();

    expect(await other.findInterruptedImport()).toBeNull();
    starting.clearAllImportMarkers();
  });

  it("does not report the import the restarted page is itself running", async () => {
    const { killEveryPage } = installFakeLocks();
    const stopped = await loadPage();
    stopped.startImportMarker(LABELS);
    backdate(onlyMarkerId());
    killEveryPage();

    const restarted = await loadPage();
    restarted.startImportMarker(LABELS);

    expect(await restarted.findInterruptedImport()).toBeNull();
    await vi.waitFor(() => expect(markerKeys()).toHaveLength(1));
    restarted.clearAllImportMarkers();
    stopped.clearAllImportMarkers();
  });
});

describe("a tab opened from the importing tab", () => {
  it("does not inherit the owner, so it neither reports nor dismisses the live import", async () => {
    installFakeLocks();
    const importing = await loadPage();
    importing.startImportMarker(LABELS);
    const { owner } = JSON.parse(localStorage.getItem(markerKeys()[0]));
    backdate(onlyMarkerId());

    const duplicate = await loadPage();

    const kept = Array.from({ length: sessionStorage.length }, (_, i) =>
      sessionStorage.getItem(sessionStorage.key(i)),
    );
    expect(kept).not.toContain(owner);
    expect(await duplicate.findInterruptedImport()).toBeNull();
    expect(await duplicate.dismissInterruptedImport(onlyMarkerId())).toBe(
      false,
    );
    duplicate.clearImportMarker(onlyMarkerId());
    expect(markerKeys()).toHaveLength(1);
    importing.clearAllImportMarkers();
  });

  it("dismisses a marker once its owner is confirmed gone", async () => {
    const { killEveryPage } = installFakeLocks();
    const stopped = await loadPage();
    stopped.startImportMarker(LABELS);
    backdate(onlyMarkerId());
    killEveryPage();

    const restarted = await loadPage();

    expect(await restarted.dismissInterruptedImport(onlyMarkerId())).toBe(true);
    expect(markerKeys()).toHaveLength(0);
    stopped.clearAllImportMarkers();
  });
});

describe("with no Web Locks, the owner is pinged over a channel", () => {
  it("never reports an import whose page answers, however old its heartbeat", async () => {
    installFakeChannel();
    const running = await loadPage();
    running.startImportMarker(LABELS);
    backdate(onlyMarkerId(), { heartbeat: true });

    const other = await loadPage();

    expect(await other.findInterruptedImport()).toBeNull();
    running.clearAllImportMarkers();
  });

  it("reports an import whose page no longer answers after a short timeout", async () => {
    const { killEveryPage } = installFakeChannel();
    const stopped = await loadPage();
    stopped.startImportMarker(LABELS);
    stopped.recordDocumentSaved();
    backdate(onlyMarkerId());
    killEveryPage();
    const restarted = await loadPage();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const pending = restarted.findInterruptedImport();
    await vi.advanceTimersByTimeAsync(LIVENESS_TIMEOUT_MS + 50);

    expect(await pending).toMatchObject({ saved: 1, total: 3 });
    stopped.clearAllImportMarkers();
  });
});

describe("finishing the import that an interrupted one left undone", () => {
  it("does not bring the old notice back once the new import completes", async () => {
    seedOtherTabMarker("killed", { ageMs: STALE_AFTER_MS + 1000, saved: 1 });

    startImportMarker(LABELS);
    recordDocumentSaved();
    recordDocumentSaved();
    recordDocumentSaved();
    await completeImportMarker();

    expect(markerKeys()).toHaveLength(0);
    expect(await findInterruptedImport()).toBeNull();
  });

  it("leaves another tab's live import alone when a new one starts", async () => {
    seedOtherTabMarker("live-elsewhere", { ageMs: 1000 });

    startImportMarker(LABELS);
    await flush();

    expect(markerKeys()).toHaveLength(2);
  });

  it("clears a dead marker for the same documents when the import completes", async () => {
    const { killEveryPage } = installFakeLocks();
    const first = await loadPage();
    first.startImportMarker(LABELS);
    backdate(onlyMarkerId());
    const second = await loadPage();
    second.startImportMarker(LABELS);
    await flush();
    expect(markerKeys()).toHaveLength(2);

    killEveryPage();
    await second.completeImportMarker();

    expect(markerKeys()).toHaveLength(0);
    first.clearAllImportMarkers();
  });

  it("keeps a dead marker for different documents", async () => {
    installFakeLocks();
    startImportMarker(LABELS);
    await flush();
    seedOtherTabMarker("other-set", { ageMs: STALE_AFTER_MS + 1000 });
    const other = JSON.parse(localStorage.getItem(`${PREFIX}other-set`));
    localStorage.setItem(
      `${PREFIX}other-set`,
      JSON.stringify({ ...other, labels: LABELS_8, total: 8 }),
    );

    await completeImportMarker();

    expect(markerKeys()).toEqual([`${PREFIX}other-set`]);
  });
});

describe("the saved count is what is stored when the notice is drawn", () => {
  const storedAt = (minutesAgo) =>
    new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

  async function stoppedAfterFourMarkerWrites() {
    const { killEveryPage } = installFakeLocks();
    const stopped = await loadPage();
    stopped.startImportMarker(LABELS_8);
    for (let i = 0; i < 4; i += 1) stopped.recordDocumentSaved();
    backdate(onlyMarkerId());
    killEveryPage();
    return stopped;
  }

  const filedNow = (n) => ({
    documentation: {
      dd214s: [{ uploadDate: storedAt(60 * 24) }],
      otherEvidence: Array.from({ length: n }, () => ({
        uploadDate: storedAt(1),
      })),
    },
  });

  it("counts the document filed just before the tab died, read fresh from storage", async () => {
    const stopped = await stoppedAfterFourMarkerWrites();
    loadVkb.mockResolvedValue(filedNow(5));

    const restarted = await loadPage();

    expect(await restarted.findInterruptedImport()).toMatchObject({
      saved: 5,
      total: 8,
    });
    expect(loadVkb).toHaveBeenCalledWith(
      expect.objectContaining({ fresh: true }),
    );
    stopped.clearAllImportMarkers();
  });

  it("falls back to the marker's own count when the store cannot be read", async () => {
    const stopped = await stoppedAfterFourMarkerWrites();

    const restarted = await loadPage();

    expect(await restarted.findInterruptedImport()).toMatchObject({
      saved: 4,
      total: 8,
    });
    stopped.clearAllImportMarkers();
  });

  it("still reports an import when other saves have filled the store to its total", async () => {
    const stopped = await stoppedAfterFourMarkerWrites();
    loadVkb.mockResolvedValue(filedNow(8));

    const restarted = await loadPage();

    expect(await restarted.findInterruptedImport()).toMatchObject({
      saved: 7,
      total: 8,
    });
    expect(markerKeys()).toHaveLength(1);
    stopped.clearAllImportMarkers();
  });

  it("drops a marker that itself counts every document", async () => {
    const { killEveryPage } = installFakeLocks();
    const stopped = await loadPage();
    stopped.startImportMarker(LABELS);
    for (let i = 0; i < 3; i += 1) stopped.recordDocumentSaved();
    backdate(onlyMarkerId());
    killEveryPage();

    const restarted = await loadPage();

    expect(await restarted.findInterruptedImport()).toBeNull();
    expect(markerKeys()).toHaveLength(0);
    stopped.clearAllImportMarkers();
  });
});

describe("a marker on disk that lags the store by many writes", () => {
  const LABELS_20 = Array.from(
    { length: 20 },
    (_, i) => `document ${i + 1} (DBQ)`,
  );
  const storedAt = (minutesAgo) =>
    new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
  const filed = (recent, older = 1) => ({
    documentation: {
      dd214s: Array.from({ length: older }, () => ({
        uploadDate: storedAt(60 * 24),
      })),
      otherEvidence: Array.from({ length: recent }, () => ({
        uploadDate: storedAt(1),
      })),
    },
  });

  async function killedAfterMarkerWrites(markerWrites) {
    const { killEveryPage } = installFakeLocks();
    const stopped = await loadPage();
    stopped.startImportMarker(LABELS_20);
    for (let i = 0; i < markerWrites; i += 1) stopped.recordDocumentSaved();
    backdate(onlyMarkerId());
    killEveryPage();
    return stopped;
  }

  it.each([
    ["every stored document, not the marker's figure plus one", 15, 1, 15],
    ["one under the total when every document is stored", 20, 1, 19],
    ["only documents filed since the import began", 9, 12, 9],
    ["no fewer than the marker's own count", 2, 1, 6],
  ])("reports %s", async (_name, recent, older, expected) => {
    const stopped = await killedAfterMarkerWrites(6);
    loadVkb.mockResolvedValue(filed(recent, older));

    const restarted = await loadPage();

    expect(await restarted.findInterruptedImport()).toMatchObject({
      saved: expected,
      total: 20,
    });
    stopped.clearAllImportMarkers();
  });

  it("says the stored count in the notice", async () => {
    const stopped = await killedAfterMarkerWrites(6);
    loadVkb.mockResolvedValue(filed(15));

    const restarted = await loadPage();
    const found = await restarted.findInterruptedImport();

    expect(restarted.describeInterruptedImport(found)).toContain(
      "15 of 20 documents were saved.",
    );
    stopped.clearAllImportMarkers();
  });
});
