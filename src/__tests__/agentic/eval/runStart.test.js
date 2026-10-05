import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  captureRunStart,
  gitInfo,
} from "../../../../scripts/eval/lib/runStart.js";

describe("run start facts", () => {
  it("takes the date and git facts when called, not when the run ends", () => {
    let tick = 0;
    const clock = [
      new Date("2026-10-05T01:00:00.000Z"),
      new Date("2026-10-05T01:40:00.000Z"),
    ];
    const start = captureRunStart({
      cwd: "x",
      now: () => clock[tick++],
      git: () => ({ gitCommit: "abc", gitDirty: false }),
    });
    expect(start.date).toBe("2026-10-05T01:00:00.000Z");
    expect(start.startedAt).toEqual(clock[0]);
    expect(tick).toBe(1);
    expect(start).toMatchObject({ gitCommit: "abc", gitDirty: false });
  });

  it("a tree that is clean when the run starts is not reported dirty by the run's own files", () => {
    const dir = mkdtempSync(join(tmpdir(), "golden-git-"));
    try {
      const git = (...args) => {
        const full = ["-c", "user.name=t", "-c", "user.email=t@t", ...args];
        // eslint-disable-next-line sonarjs/no-os-command-from-path -- fixture repo built with the git on PATH
        return execFileSync("git", full, { cwd: dir, encoding: "utf8" });
      };
      git("init", "-q");
      writeFileSync(join(dir, "tracked.txt"), "x");
      git("add", "tracked.txt");
      git("commit", "-q", "-m", "init");

      const atStart = captureRunStart({ cwd: dir });
      mkdirSync(join(dir, "logs"));
      writeFileSync(join(dir, "logs", "run.jsonl"), "{}");
      const atEnd = gitInfo(dir);

      expect(atStart.gitDirty).toBe(false);
      expect(atEnd.gitDirty).toBe(true);
      expect(atStart.gitCommit).toBe(atEnd.gitCommit);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
