/**
 * An NGB-22 that prints no entry date gets one calculated (separation date
 * minus net service - musterCallProcessor.js's derived-date flags,
 * carried onto vkb.serviceHistory.entryDateDerived by
 * mergeDD214IntoVKB/veteranKnowledgeBase.js). VKBViewer's own "Entry Date"
 * field must say so instead of showing the calculated value as if it were
 * printed on the form.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import VKBViewer from "../../components/VKBViewer.jsx";
import { loadVKB } from "../../utils/veteranKnowledgeBase.js";

vi.mock("../../utils/veteranKnowledgeBase.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadVKB: vi.fn(),
    saveVKB: vi.fn().mockResolvedValue({ success: true }),
  };
});

afterEach(cleanup);

function buildVkb(entryDateDerived) {
  return {
    metadata: { completeness: 10, documentCount: 1 },
    personal: { fullName: null, dateOfBirth: null, email: null, phone: null },
    serviceHistory: {
      branch: "Army National Guard",
      characterOfService: "Honorable",
      entryDate: "2012-03-14",
      entryDateDerived,
      separationDate: "2020-03-14",
      mos: [],
      awards: [],
    },
  };
}

async function openServiceHistory() {
  render(<VKBViewer isOpen onClose={() => {}} />);
  fireEvent.click(await screen.findByText("Service History"));
  await screen.findByText("Entry Date");
}

describe("VKBViewer - calculated entry date marker", () => {
  it("shows the marker when entryDateDerived is set", async () => {
    loadVKB.mockResolvedValue(buildVkb(true));
    await openServiceHistory();

    expect(screen.getByText(/calculated from net service/)).toBeInTheDocument();
  });

  it("shows no marker when entryDateDerived is unset", async () => {
    loadVKB.mockResolvedValue(buildVkb(false));
    await openServiceHistory();

    expect(
      screen.queryByText(/calculated from net service/),
    ).not.toBeInTheDocument();
  });

  it("clears the marker once the veteran edits and saves their own entry date", async () => {
    loadVKB.mockResolvedValue(buildVkb(true));
    await openServiceHistory();

    fireEvent.click(screen.getByText("✏️ Edit"));
    fireEvent.change(screen.getByLabelText(/Entry Date/), {
      target: { value: "2011-09-01" },
    });

    expect(
      screen.queryByText(/calculated from net service/),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("💾 Save"));

    const { saveVKB } = await import("../../utils/veteranKnowledgeBase.js");
    await vi.waitFor(() => expect(saveVKB).toHaveBeenCalled());
    expect(saveVKB.mock.calls[0][0].serviceHistory).toMatchObject({
      entryDate: "2011-09-01",
      entryDateDerived: false,
    });
  });
});
