import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

// jsdom's `localStorage` differs by Node version: on some runtimes it is absent
// or lacks the Storage methods (providers that read it on mount blow up); on
// others (e.g. Node 20) it is a real `Storage` whose `setItem` is a
// non-configurable prototype method that `vi.spyOn(localStorage, "setItem")`
// cannot replace — so fault-injection tests that spy on setItem silently no-op
// (the simulated crash never fires and the operation "succeeds"). Install a
// deterministic in-memory shim unconditionally so every runtime sees the same
// spy-able localStorage. defineProperty overrides jsdom's accessor; the plain
// assignment is a fallback for runtimes where localStorage is a writable global.
{
  const store = new Map();
  const shim = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  try {
    Object.defineProperty(globalThis, "localStorage", {
      value: shim,
      writable: true,
      configurable: true,
    });
  } catch {
    globalThis.localStorage = shim;
  }
}

afterEach(() => {
  cleanup();
});
