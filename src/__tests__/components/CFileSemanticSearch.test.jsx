/**
 * S24 — CFileSemanticSearch UI. The ranking/embedding logic is covered by
 * userDocSemanticIndex.test.js; these tests cover only the component wiring:
 * it calls semanticSearchDocument with the session key, renders ranked page
 * hits, and degrades gracefully on no-results / error / missing index.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CFileSemanticSearch from "../../components/CFileSemanticSearch.jsx";

const mockSearch = vi.fn();
vi.mock("../../utils/userDocSemanticIndex", () => ({
  semanticSearchDocument: (...args) => mockSearch(...args),
}));

beforeEach(() => {
  mockSearch.mockReset();
});

function typeAndSearch(text) {
  fireEvent.change(screen.getByLabelText(/search your document/i), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: /search/i }));
}

describe("CFileSemanticSearch", () => {
  it("shows an unavailable message when no session key exists", () => {
    render(<CFileSemanticSearch sessionKey={null} />);
    expect(
      screen.getByText(/not available for this analysis/i),
    ).toBeInTheDocument();
  });

  it("searches the given session and renders ranked page hits", async () => {
    mockSearch.mockResolvedValue([
      { page: 42, score: 0.91, snippet: "constant ringing in both ears" },
      { page: 7, score: 0.55, snippet: "hearing evaluation performed" },
    ]);
    render(<CFileSemanticSearch sessionKey="sess-1" excludedPageCount={12} />);

    typeAndSearch("ringing in my ears");

    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    expect(mockSearch.mock.calls[0][0]).toMatchObject({
      sessionKey: "sess-1",
      queryText: "ringing in my ears",
    });
    expect(await screen.findByText("Page 42")).toBeInTheDocument();
    expect(screen.getByText("Page 7")).toBeInTheDocument();
    expect(screen.getByText(/91% match/)).toBeInTheDocument();
    // The excluded-page framing appears in the helper copy.
    expect(
      screen.getByText(/including the 12 the ai pass skipped/i),
    ).toBeInTheDocument();
  });

  it("shows a no-results message when nothing matches", async () => {
    mockSearch.mockResolvedValue([]);
    render(<CFileSemanticSearch sessionKey="sess-1" />);
    typeAndSearch("submarine sandwich");
    expect(await screen.findByText(/no pages matched/i)).toBeInTheDocument();
  });

  it("renders an error alert if the search model fails to load", async () => {
    mockSearch.mockRejectedValue(new Error("model load failed"));
    render(<CFileSemanticSearch sessionKey="sess-1" />);
    typeAndSearch("knee pain");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /search is unavailable/i,
    );
  });

  it("does not search a blank query", () => {
    render(<CFileSemanticSearch sessionKey="sess-1" />);
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(mockSearch).not.toHaveBeenCalled();
  });
});
