/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * A deliberately dependency-free leaf module. dataPersistence.js registers
 * the remover for the one `beforeunload` listener it owns here, and
 * safetyRedirect.js (the always-must-work panic key) calls it back through
 * this module instead of importing dataPersistence.js directly.
 *
 * That indirection matters: dataPersistence.js imports persistentStorage.js,
 * which imports migrationManager.js, which imports version.js, which does
 * `import packageJson from "../../package.json"` - a bare JSON import with
 * no import attribute. Vite handles that at build/dev time, but Playwright's
 * test runner loads spec files (and everything they import) with Node's
 * native ESM loader, which throws on it. tests/e2e/panic-escape.spec.ts
 * imports a constant from safetyRedirect.js, so that one throw aborted
 * collection of every e2e spec file, not just this one - `playwright test
 * --list` went from 1042 tests in 26 files to 0 tests in 0 files. Keeping
 * safetyRedirect.js's only import pointed at a true leaf (zero imports of
 * its own) means it can never again drag in that chain, regardless of what
 * dataPersistence.js or its dependencies do in the future.
 */

let remover = null;

/**
 * Called by dataPersistence.js whenever it (re)registers its own
 * `beforeunload` listener, so there is always exactly one remover to call -
 * calling it twice, or before anything has registered, is a safe no-op.
 * @param {() => void} removeFn
 */
export function setBeforeUnloadRemover(removeFn) {
  remover = removeFn;
}

/**
 * Disable whatever `beforeunload` guard is currently registered, if any.
 */
export function clearBeforeUnloadWarning() {
  remover?.();
}
