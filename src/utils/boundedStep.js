/**
 * Vet-Rate.org - Bounded import steps
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * An import step that waits on IndexedDB, a GPU engine or a vision worker can
 * wait forever: a transaction that never completes, a blocked database
 * upgrade, a promise held by a disposed engine. A JavaScript promise cannot be
 * cancelled, so the only safe guarantee is to stop WAITING for it. This races
 * any step against a timer and reports which step ran out of time, so the
 * caller can tell the veteran plainly instead of freezing at a progress
 * percentage.
 */

export class StepTimeoutError extends Error {
  constructor(step, timeoutMs) {
    super(`${step} did not finish within ${Math.round(timeoutMs / 1000)}s`);
    this.name = "StepTimeoutError";
    this.step = step;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * @param {() => Promise<any>} run - starts the step (a throw is captured too)
 * @param {string} step - neutral step name (never a file name)
 * @param {number} timeoutMs
 * @returns {Promise<any>} the step's result, or rejects with StepTimeoutError
 */
export function withStepTimeout(run, step, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new StepTimeoutError(step, timeoutMs)),
      timeoutMs,
    );
  });
  let started;
  try {
    started = Promise.resolve(run());
  } catch (err) {
    clearTimeout(timer);
    return Promise.reject(err);
  }
  return Promise.race([started, timeout]).finally(() => clearTimeout(timer));
}
