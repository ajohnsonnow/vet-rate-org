import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import AssistantMarkdown from "./AssistantMarkdown";

describe("AssistantMarkdown", () => {
  it("puts consecutive bullet lines inside one list", () => {
    const { container } = render(
      <div>
        <AssistantMarkdown
          content={"Intro\n• First\n• Second\n- Third\nAfter"}
          spacingClass="mb-1"
        />
      </div>,
    );
    const lists = container.querySelectorAll("ul");
    expect(lists).toHaveLength(1);
    expect([...lists[0].children].map((li) => li.textContent)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
    for (const li of container.querySelectorAll("li")) {
      expect(li.parentElement.tagName).toBe("UL");
    }
  });

  it("starts a new list after a gap", () => {
    const { container } = render(
      <div>
        <AssistantMarkdown content={"• A\ntext\n• B"} spacingClass="" />
      </div>,
    );
    expect(container.querySelectorAll("ul")).toHaveLength(2);
  });

  it("keeps bold lines and plain lines as paragraphs", () => {
    const { container } = render(
      <div>
        <AssistantMarkdown content={"**Title**\nPlain"} spacingClass="mb-1" />
      </div>,
    );
    expect(container.querySelector("p.font-bold").textContent).toBe("Title");
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelector("li")).toBeNull();
  });
});
