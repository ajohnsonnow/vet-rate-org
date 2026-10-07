import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import AssistantMarkdown from "./AssistantMarkdown";
import recorded from "../__tests__/utils/fixtures/assistant4bAnswers.json";

const view = (content) =>
  render(
    <div data-testid="root">
      <AssistantMarkdown content={content} spacingClass="mb-1" />
    </div>,
  );

describe("recorded Qwen3.5-4B answers render without raw markdown", () => {
  it.each(recorded.answers.map((a) => [`${a.id} (${a.run.slice(4, 24)})`, a]))(
    "%s shows no literal ** or leading * bullet",
    (_name, answer) => {
      const { container } = view(answer.response);
      const text = container.textContent;
      expect(text).not.toContain("**");
      expect(text.trim().startsWith("* ")).toBe(false);
      expect(text).not.toContain("### ");
      expect(
        container.querySelectorAll("strong, .font-bold").length,
      ).toBeGreaterThan(0);
    },
  );

  it("keeps every word of the answer", () => {
    for (const { response } of recorded.answers) {
      const { container, unmount } = view(response);
      const strip = (s) =>
        s
          .split("\n")
          .map((line) => line.trim().replace(/^([*•-]|\d{1,3}[.)]) +/, ""))
          .join("")
          .replace(/[*#`\s]/g, "");
      expect(strip(container.textContent)).toBe(strip(response));
      unmount();
    }
  });
});

describe("the shapes the 4B writes", () => {
  it("bold inside a star bullet", () => {
    const { container } = view(
      "*   **38 CFR § 4.16(a)** states that TDIU applies.",
    );
    const li = container.querySelector("ul > li");
    expect(li.querySelector("strong").textContent).toBe("38 CFR § 4.16(a)");
    expect(li.textContent).toBe("38 CFR § 4.16(a) states that TDIU applies.");
  });

  it("bold inside a numbered item keeps the numbering", () => {
    const { container } = view(
      "1.  **Your DD214** (to verify).\n2.  **Your C-File**.",
    );
    const ol = container.querySelector("ol");
    expect(ol.querySelectorAll("li")).toHaveLength(2);
    expect(ol.querySelector("strong").textContent).toBe("Your DD214");
  });

  it("a numbered list that continues from a later number starts there", () => {
    const { container } = view("3. Third\n4. Fourth");
    expect(container.querySelector("ol").getAttribute("start")).toBe("3");
  });

  it("inline bold in a paragraph, with a colon", () => {
    const { container } = view(
      "**Current Status:** You hold a **70% combined rating**.",
    );
    expect(
      [...container.querySelectorAll("strong")].map((s) => s.textContent),
    ).toEqual(["Current Status:", "70% combined rating"]);
  });

  it("an indented bullet nests under the item above", () => {
    const { container } = view("*   Parent\n    *   Child with **bold**");
    const inner = container.querySelector("ul ul");
    expect(inner.textContent).toBe("Child with bold");
  });

  it("a heading becomes a bold line, not hash marks", () => {
    const { container } = view("### 1. Immediate Action");
    expect(container.textContent).toBe("1. Immediate Action");
    expect(container.querySelector("strong, .font-bold")).toBeTruthy();
  });

  it("italics and inline code lose their markers", () => {
    const { container } = view("*(Note: file first.)* Use `VA Form 21-0966`.");
    expect(container.textContent).toBe(
      "(Note: file first.) Use VA Form 21-0966.",
    );
    expect(container.querySelector("em")).toBeTruthy();
    expect(container.querySelector("code").textContent).toBe("VA Form 21-0966");
  });

  it("leaves a lone asterisk and unmatched markers alone", () => {
    const { container } = view("5 * 3 = 15 and **unclosed");
    expect(container.textContent).toBe("5 * 3 = 15 and **unclosed");
  });
});

describe("model text is never rendered as HTML", () => {
  it("shows tags and script as text, and builds no element or link from them", () => {
    const { container } = view(
      "<script>alert(1)</script> **bold** <img src=x onerror=alert(1)> [click](javascript:alert(1))",
    );
    expect(container.querySelector("script, img, a")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(container.textContent).toContain("[click](javascript:alert(1))");
    expect(container.querySelector("strong").textContent).toBe("bold");
  });
});
