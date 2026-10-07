import { closeSync, existsSync, openSync, readSync } from "node:fs";

const POINTER_PREFIX = "version https://git-lfs.github.com/spec/v1";

function startsAsPointer(path) {
  const fd = openSync(path, "r");
  try {
    const head = Buffer.alloc(POINTER_PREFIX.length);
    const read = readSync(fd, head, 0, head.length, 0);
    return head.toString("utf8", 0, read) === POINTER_PREFIX;
  } finally {
    closeSync(fd);
  }
}

function unavailableReason(path) {
  if (!existsSync(path)) return `${path} does not exist`;
  return startsAsPointer(path)
    ? `${path} is a Git LFS pointer, not the real file (run \`git lfs pull\`)`
    : null;
}

/**
 * Whether a Git LFS tracked file is really there. A checkout that did not
 * fetch LFS (CI, a fresh worktree) holds a three-line pointer in its place,
 * which a test would otherwise read as the data. Use it to skip, and wrap
 * the test's name with `name()` so the report says why it was skipped:
 *
 *   const ecfr = lfsFile("public/legal-index/v0.1.0/chunks/ecfr.jsonl");
 *   it.skipIf(!ecfr.available)(ecfr.name("quotes the regulation"), () => {});
 */
export function lfsFile(path) {
  const reason = unavailableReason(path);
  return {
    path,
    available: reason === null,
    reason,
    name: (testName) =>
      reason === null ? testName : `${testName} [skipped: ${reason}]`,
  };
}
