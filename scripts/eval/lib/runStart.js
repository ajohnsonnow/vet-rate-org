import { execFileSync } from "node:child_process";

export function gitInfo(cwd) {
  const run = (args) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  return {
    gitCommit: run(["rev-parse", "HEAD"]),
    gitDirty: run(["status", "--porcelain"]).length > 0,
  };
}

/**
 * The facts the run summary reports about the moment the run began: the time,
 * the commit, and whether the tree already had uncommitted changes. Take this
 * before the run writes anything. Read later, the date is the end of the run
 * and the tree is dirty with the run's own transcript.
 */
export function captureRunStart({
  cwd,
  now = () => new Date(),
  git = gitInfo,
}) {
  const startedAt = now();
  return { startedAt, date: startedAt.toISOString(), ...git(cwd) };
}
