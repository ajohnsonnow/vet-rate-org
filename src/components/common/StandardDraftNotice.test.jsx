import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StandardDraftNotice from "./StandardDraftNotice";
import { STANDARD_DRAFT_NOTE } from "../../utils/writerTemplates";

describe("StandardDraftNotice", () => {
  it("announces the note as a status message", () => {
    render(<StandardDraftNotice note={STANDARD_DRAFT_NOTE} />);
    expect(screen.getByRole("status").textContent).toBe(STANDARD_DRAFT_NOTE);
  });

  it("renders nothing without a note", () => {
    const { container } = render(<StandardDraftNotice note={null} />);
    expect(container.innerHTML).toBe("");
  });
});
