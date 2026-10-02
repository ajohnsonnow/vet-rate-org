/**
 * Minimal in-memory IndexedDB for fault-injection tests: real keyed storage
 * (put/get/getAll per object store, transactions that fire oncomplete once
 * their requests settle), plus switches that reproduce the two ways a real
 * browser leaves a caller waiting forever - a write transaction that never
 * completes, and an open that is blocked and never settles.
 */

// A full device: the write request itself succeeds, then the commit fails and
// the transaction aborts with QuotaExceededError, the way a browser reports it.
function finishTransaction(tx, control) {
  if (tx.wrote && control.quotaFull) {
    tx.error = new DOMException(
      "The quota has been exceeded.",
      "QuotaExceededError",
    );
    tx.onabort?.();
    return;
  }
  tx.oncomplete?.();
}

function makeRequest(run, tx, stalls, control) {
  const request = {};
  tx.pending++;
  queueMicrotask(() => {
    if (stalls()) return;
    request.result = run();
    request.onsuccess?.();
    tx.pending--;
    if (tx.pending === 0) queueMicrotask(() => finishTransaction(tx, control));
  });
  return request;
}

function makeStore(records, tx, control) {
  const writes = () => control.stallWrites;
  const reads = () => false;
  return {
    get: (key) =>
      makeRequest(() => structuredClone(records.get(key)), tx, reads, control),
    getAll: () =>
      makeRequest(
        () => [...records.values()].map((v) => structuredClone(v)),
        tx,
        reads,
        control,
      ),
    put: (value) =>
      makeRequest(
        () => {
          tx.wrote = true;
          if (!control.quotaFull) records.set(value.id, structuredClone(value));
          return value.id;
        },
        tx,
        writes,
        control,
      ),
    delete: (key) =>
      makeRequest(() => records.delete(key) && undefined, tx, writes, control),
  };
}

function makeConnection(stores, control) {
  return {
    objectStoreNames: { contains: (name) => stores.has(name) },
    createObjectStore: (name) => {
      stores.set(name, new Map());
      return { createIndex: () => {} };
    },
    transaction: (names) => {
      const tx = { pending: 0 };
      const inScope = Array.isArray(names) ? names : [names];
      tx.objectStore = (name) => {
        if (!inScope.includes(name)) throw new Error("store not in scope");
        return makeStore(stores.get(name), tx, control);
      };
      return tx;
    },
    close: () => {},
  };
}

export function createFakeIndexedDB() {
  const databases = new Map();
  const control = { stallWrites: false, blockOpen: false, quotaFull: false };

  const indexedDB = {
    open: (name) => {
      const request = {};
      queueMicrotask(() => {
        if (control.blockOpen) {
          request.onblocked?.();
          return;
        }
        const isNew = !databases.has(name);
        if (isNew) databases.set(name, new Map());
        request.result = makeConnection(databases.get(name), control);
        if (isNew) request.onupgradeneeded?.({ target: request });
        request.onsuccess?.();
      });
      return request;
    },
  };

  return {
    indexedDB,
    control,
    records: (database, store) => [
      ...(databases.get(database)?.get(store)?.values() ?? []),
    ],
  };
}
