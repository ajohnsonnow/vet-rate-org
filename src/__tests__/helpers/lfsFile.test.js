import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lfsFile } from "./lfsFile";

const dir = mkdtempSync(join(tmpdir(), "lfs-file-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const write = (name, content) => {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
};

describe("lfsFile", () => {
  it("reports a Git LFS pointer as unavailable, with the reason", () => {
    const path = write(
      "pointer.jsonl",
      "version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 2210597\n",
    );
    const file = lfsFile(path);
    expect(file.available).toBe(false);
    expect(file.reason).toBe(
      `${path} is a Git LFS pointer, not the real file (run \`git lfs pull\`)`,
    );
  });

  it("reports a missing file as unavailable, with the reason", () => {
    const path = join(dir, "absent.jsonl");
    expect(lfsFile(path)).toMatchObject({
      available: false,
      reason: `${path} does not exist`,
    });
  });

  it("reports a real file as available", () => {
    const path = write("real.jsonl", '{"citation":"38 CFR § 4.16"}\n');
    expect(lfsFile(path)).toMatchObject({ available: true, reason: null });
  });

  it("puts the reason in the test name only when the test will be skipped", () => {
    const pointer = lfsFile(
      write("p.bin", "version https://git-lfs.github.com/spec/v1\n"),
    );
    const real = lfsFile(write("r.bin", "data"));
    expect(pointer.name("reads the index")).toBe(
      `reads the index [skipped: ${pointer.reason}]`,
    );
    expect(real.name("reads the index")).toBe("reads the index");
  });
});
