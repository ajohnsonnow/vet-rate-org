/**
 * D14-3: Tooltip.jsx has no viewport clamping - a trigger near the left/
 * right/top/bottom edge renders its bubble partly off-screen (first word
 * cut off). This proves the root-cause fix (clampTooltipToViewport) actually
 * pulls an overflowing bubble back fully inside the viewport, at the same
 * kind of narrow width the real regression was hit at (320px).
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Tooltip from "../../../components/common/Tooltip.jsx";

const VIEWPORT_WIDTH = 320;
const VIEWPORT_HEIGHT = 568;

function stubViewport() {
  window.innerWidth = VIEWPORT_WIDTH;
  window.innerHeight = VIEWPORT_HEIGHT;
}

/**
 * jsdom never lays elements out for real - every real rect is 0x0/at-origin
 * unless stubbed. Simulates a tooltip bubble that would render 34px past
 * the left edge (the exact regression QA measured at 320/390px) by mocking
 * both the trigger's rect (near the left edge, driving Tailwind's
 * `left-1/2 -translate-x-1/2` centring) and the tooltip's own rect (the
 * result of that centring, already overflowing left).
 */
function mockOverflowingRect(el, { left, right, top, bottom }) {
  el.getBoundingClientRect = () => ({
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    x: left,
    y: top,
    toJSON() {
      return this;
    },
  });
}

describe("Tooltip viewport clamping", () => {
  it("shifts a left-overflowing bubble fully inside the viewport", async () => {
    stubViewport();
    render(
      <Tooltip content="AI is warming up..." placement="bottom">
        <button>trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "trigger" });
    fireEvent.focus(trigger);

    const bubble = await screen.findByRole("tooltip");
    // Overflows 34px past the left edge, matching QA's measured regression.
    mockOverflowingRect(bubble, { left: -34, right: 66, top: 40, bottom: 64 });

    fireEvent(window, new Event("resize"));

    expect(bubble.style.transform).not.toBe("");
    expect(bubble.style.transform).toContain("+ 38px");
  });

  it("does not touch transform when the bubble is already fully on-screen", async () => {
    stubViewport();
    render(
      <Tooltip content="Cloud AI" placement="bottom">
        <button>trigger2</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "trigger2" });
    fireEvent.focus(trigger);

    const bubble = await screen.findByRole("tooltip");
    mockOverflowingRect(bubble, { left: 120, right: 200, top: 40, bottom: 64 });

    fireEvent(window, new Event("resize"));

    expect(bubble.style.transform).toBe("");
  });
});
