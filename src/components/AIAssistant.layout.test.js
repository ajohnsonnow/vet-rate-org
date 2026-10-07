import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (...parts) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("assistant layout at 390px (class and rule checks; not a render)", () => {
  const assistant = read("src", "components", "AIAssistant.jsx");

  it("the docked window never exceeds the viewport width", () => {
    expect(assistant).toMatch(/fixed z-50 w-96 max-w-\[calc\(100vw-2rem\)\]/);
  });

  it("the drag bounds use the real width, not a fixed 384", () => {
    expect(assistant).not.toMatch(/isMinimized \? 72 : 384/);
    expect(assistant).toMatch(/dockedWidth\(\)/);
  });

  it("the header keeps its controls on screen on a phone", () => {
    expect(assistant).toMatch(/flex shrink-0 items-center gap-1 sm:gap-2/);
  });

  it("the docked window marks itself so the floating privacy badge steps aside on phones", () => {
    expect(assistant).toMatch(/data-docked-assistant/);
    const css = read("src", "index.css");
    expect(css).toMatch(
      /@media \(width <= 767px\)\s*\{\s*body:has\(\[data-docked-assistant\]\) \.above-mobile-nav/,
    );
  });
});

describe("assistant header keeps its title (class checks; not a render)", () => {
  const assistant = read("src", "components", "AIAssistant.jsx");
  const header = assistant.slice(
    assistant.indexOf("function DockedHeader("),
    assistant.indexOf("function ExpandedFooter("),
  );

  it("the title block and avatar keep their size at every width", () => {
    expect(header).toMatch(/flex shrink-0 items-center gap-2/);
    expect(header).not.toMatch(/hidden sm:flex w-10/);
    expect(header).toMatch(/whitespace-nowrap text-lg font-bold/);
    const buttonRow = header.slice(header.indexOf('pointer-events-auto">'));
    expect(buttonRow).not.toContain("AIStatusBadge");
  });

  it("the status sits under the title, not in the button row, and the drag hint is dropped when it is shown", () => {
    expect(header).toContain("onOpenAISettings ? (");
    expect(header.indexOf("dragToMove")).toBeGreaterThan(
      header.indexOf(") : ("),
    );
  });

  it("the status is a labelled button on its own row", () => {
    expect(header).toContain("<AssistantStatusButton");
  });
});
