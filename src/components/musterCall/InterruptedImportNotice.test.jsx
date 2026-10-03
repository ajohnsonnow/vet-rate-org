import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InterruptedImportNotice from "./InterruptedImportNotice";
import {
  IMPORT_MARKER_KEY,
  startImportMarker,
  recordDocumentSaved,
} from "../../utils/importProgressMarker";

beforeEach(() => sessionStorage.clear());

describe("InterruptedImportNotice", () => {
  it("shows nothing when no import was interrupted", () => {
    render(<InterruptedImportNotice />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("tells the veteran what was cut short and how to finish", () => {
    startImportMarker([
      "document 1 (DD214)",
      "document 2 (DBQ)",
      "document 3 (UNKNOWN)",
    ]);
    recordDocumentSaved();

    render(<InterruptedImportNotice />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your last import was interrupted before it finished. 1 of 3 documents were saved. Add the same files again to finish - nothing will be duplicated.",
    );
  });

  it("goes away for good when dismissed", () => {
    startImportMarker(["document 1 (DD214)"]);
    render(<InterruptedImportNotice />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(sessionStorage.getItem(IMPORT_MARKER_KEY)).toBeNull();
  });

  it("keeps the marker of an import started while the old notice is showing", () => {
    startImportMarker(["document 1 (DD214)", "document 2 (DBQ)"]);
    render(<InterruptedImportNotice />);

    startImportMarker(["document 1 (DD214)", "document 2 (DBQ)"]);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    recordDocumentSaved();

    expect(screen.queryByRole("status")).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(IMPORT_MARKER_KEY))).toMatchObject(
      { total: 2, saved: 1 },
    );
  });

  it("does not show an import that begins after the app has loaded", () => {
    render(<InterruptedImportNotice />);

    startImportMarker(["document 1 (DD214)"]);

    expect(screen.queryByRole("status")).toBeNull();
  });
});
