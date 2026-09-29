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

/**
 * Simulates a bubble whose rendered width shrinks once `max-width` +
 * `white-space:normal` are applied (the real browser wraps text onto a
 * second line) - `natural` is the pre-wrap rect a bubble too wide for its
 * safe box would otherwise measure at.
 */
function mockWrappingRect(el, natural) {
  el.getBoundingClientRect = () => {
    const maxWidth = parseFloat(el.style.maxWidth);
    const width =
      Number.isFinite(maxWidth) && maxWidth > 0
        ? Math.min(natural.right - natural.left, maxWidth)
        : natural.right - natural.left;
    const left = natural.left;
    const right = left + width;
    return {
      left,
      right,
      top: natural.top,
      bottom: natural.bottom,
      width,
      height: natural.bottom - natural.top,
      x: left,
      y: natural.top,
      toJSON() {
        return this;
      },
    };
  };
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

describe("Tooltip clamping against a clipping ancestor or a too-wide bubble", () => {
  it("clamps to the nearest overflow-clipping dialog panel, not just the viewport", async () => {
    window.innerWidth = 640;
    window.innerHeight = 800;
    render(
      <div data-testid="modal-content" style={{ overflow: "hidden" }}>
        <Tooltip content="No AI configured" placement="bottom">
          <button>trigger</button>
        </Tooltip>
      </div>,
    );

    const panel = screen.getByTestId("modal-content");
    // ResponsiveModal's `.modal-content` at 640px: narrower than the window.
    panel.getBoundingClientRect = () => ({
      left: 16,
      right: 624,
      top: 0,
      bottom: 800,
      width: 608,
      height: 800,
      x: 16,
      y: 0,
      toJSON() {
        return this;
      },
    });

    const trigger = screen.getByRole("button", { name: "trigger" });
    fireEvent.focus(trigger);

    const bubble = await screen.findByRole("tooltip");
    // Matches QA's measured D14-3 regression at 640px: inside the window,
    // but clipped by the narrower dialog panel.
    mockOverflowingRect(bubble, {
      left: 4,
      right: 202.3,
      top: 100,
      bottom: 124,
    });

    fireEvent(window, new Event("resize"));

    expect(bubble.style.transform).toContain("+ 16px");
  });

  it("caps a bubble wider than its safe box with a max-width and lets it wrap", async () => {
    window.innerWidth = 320;
    window.innerHeight = 568;
    render(
      <Tooltip content="Warrant Council - 100% Private" placement="bottom">
        <button>trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "trigger" });
    fireEvent.focus(trigger);

    const bubble = await screen.findByRole("tooltip");
    // 346px-wide bubble (the real "Warrant Council" string at 320px) - wider
    // than the 312px safe width (320 - 2*4px pad), so a translate alone
    // can never fit it.
    mockWrappingRect(bubble, { left: -20, right: 326, top: 40, bottom: 64 });

    fireEvent(window, new Event("resize"));

    expect(bubble.style.maxWidth).toBe("312px");
    expect(bubble.style.whiteSpace).toBe("normal");
    expect(bubble.style.transform).toContain("+ 24px");
  });
});

describe("Tooltip re-clamping when its content changes while open", () => {
  it("re-clamps when the AI status badge's polled text changes while the tooltip is still open", async () => {
    window.innerWidth = 320;
    window.innerHeight = 568;
    const { rerender } = render(
      <Tooltip content="No AI configured" placement="bottom">
        <button>trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "trigger" });
    fireEvent.focus(trigger);

    const bubble = await screen.findByRole("tooltip");
    mockOverflowingRect(bubble, { left: 100, right: 180, top: 40, bottom: 64 });
    fireEvent(window, new Event("resize"));
    expect(bubble.style.transform).toBe("");

    // The 1s AI status poll swaps the tooltip text while it's still open -
    // the new text renders wider and now overflows.
    mockOverflowingRect(bubble, { left: -30, right: 290, top: 40, bottom: 64 });
    rerender(
      <Tooltip content="Warrant Council - 100% Private" placement="bottom">
        <button>trigger</button>
      </Tooltip>,
    );

    expect(bubble.style.transform).not.toBe("");
  });
});
