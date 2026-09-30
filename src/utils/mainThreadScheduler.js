/**
 * Vet-Rate.org - Main-thread time-slicing helper
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * D19-7: a handful of C-File import steps (segmentation, boundary detection,
 * code-sheet parsing) are pure, synchronous, CPU-bound passes over a multi-
 * megabyte string. Run end-to-end they land as a single main-thread task
 * long enough to make Quick Exit/the panic key visibly unresponsive. This
 * gives those call sites a cheap way to check a time budget between units of
 * work they already iterate over, and to yield one macrotask when the
 * budget is spent - without changing what each unit of work computes.
 */

const DEFAULT_BUDGET_MS = 40;

const nowMs = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

// setTimeout (not a microtask/Promise.resolve) - input events and other
// macrotasks (a keydown, a click) are only dispatched between macrotasks, so
// only this actually gives Quick Exit/the panic key a chance to run.
const yieldToMainThread = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

/**
 * @param {number} budgetMs - max time to run before yielding once
 * @returns {{ maybeYield: () => Promise<void> }}
 */
export function createTimeSlicer(budgetMs = DEFAULT_BUDGET_MS) {
  let sliceStart = nowMs();
  return {
    async maybeYield() {
      if (nowMs() - sliceStart < budgetMs) return;
      await yieldToMainThread();
      sliceStart = nowMs();
    },
  };
}

export { yieldToMainThread, DEFAULT_BUDGET_MS };
