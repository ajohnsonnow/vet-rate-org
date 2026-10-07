import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Decision B: the Clear All Data guarantee is that it wipes everything the
 * AI can see, not that it wipes nothing. The published manual (docs/mkdocs.yml
 * includes this page in the nav) previously said "it deletes no veteran data
 * anywhere the AI can see" - read literally, that tells a veteran the button
 * deletes nothing, the opposite of the destructive-action guarantee.
 */
const text = readFileSync(
  join(process.cwd(), "docs/resources-tools/vkb-viewer.md"),
  "utf8",
);

describe("vkb-viewer.md Clear All Data wording (decision B)", () => {
  it("never tells a veteran the wipe deletes no data", () => {
    expect(text).not.toMatch(/deletes\s+\*\*no veteran data anywhere\*\*/);
  });

  it("states the guarantee as leaving no veteran data behind", () => {
    expect(text).toMatch(/leaves\s+\*\*no veteran data anywhere\*\*/);
  });
});
