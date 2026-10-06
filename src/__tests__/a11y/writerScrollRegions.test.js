/**
 * axe "scrollable-region-focusable": anything in Forms Helper or the
 * Witness Bench that scrolls must be reachable by keyboard. This scans the
 * source for scroll containers and holds each to a tabIndex (a textarea
 * is focusable already). jsdom does no layout, so it is a source check.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const SCROLLS = /overflow-(?:[xy]-)?(?:auto|scroll)/;
const FILES = [
  "src/components/FormsHelper.jsx",
  "src/components/WitnessBench.jsx",
  "src/components/common/ChoiceDialog.jsx",
  "src/components/common/ResponsiveModal.jsx",
];

/** The opening tag (back to its "<") around a line that has a scroll class. */
function openingTag(lines, index) {
  let start = index;
  while (start > 0 && !/^\s*<[A-Za-z]/.test(lines[start])) start -= 1;
  let end = index;
  while (end < lines.length - 1 && !/>\s*$/.test(lines[end])) end += 1;
  return lines.slice(start, end + 1).join("\n");
}

describe.each(FILES)("%s", (file) => {
  const lines = readFileSync(file, "utf8").split("\n");
  const scrollers = lines
    .map((line, index) => (SCROLLS.test(line) ? openingTag(lines, index) : ""))
    .filter(Boolean);

  it("every scroll container can take keyboard focus", () => {
    const unreachable = scrollers.filter(
      (tag) => !/tabIndex=\{|<textarea/.test(tag),
    );
    expect(unreachable).toEqual([]);
  });
});

describe("the writing tools' scroll containers", () => {
  it("are the ones this test knows about", () => {
    const count = (file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => SCROLLS.test(line)).length;

    expect(FILES.map(count)).toEqual([1, 0, 0, 1]);
  });
});
