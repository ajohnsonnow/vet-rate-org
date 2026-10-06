import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HeaderCloseSlot from "./HeaderCloseSlot";

describe("HeaderCloseSlot keeps every header cluster inside a narrow viewport", () => {
  it("caps each child of the wrapping column to the column's width, so a shrink-0 cluster of badges cannot run past a 390px screen", () => {
    render(
      <HeaderCloseSlot close={<button>Close</button>}>
        <div data-testid="title">Title</div>
        <div data-testid="cluster" className="flex shrink-0 flex-wrap">
          <span>Cloud AI</span>
          <span>Bug?</span>
        </div>
      </HeaderCloseSlot>,
    );
    const column = screen.getByTestId("cluster").parentElement;
    expect(column.className).toMatch(/min-w-0/);
    expect(column.className).toMatch(/flex-wrap/);
    expect(column.className).toMatch(/\[&>\*\]:max-w-full/);
  });

  it("still pins the close control outside the wrapping column", () => {
    render(
      <HeaderCloseSlot close={<button>Close</button>}>
        <div>Title</div>
      </HeaderCloseSlot>,
    );
    const close = screen.getByRole("button", { name: "Close" });
    expect(close.parentElement.className).toMatch(/shrink-0/);
  });
});
