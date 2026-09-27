/**
 * D11-6: VKBViewer never rendered vkb.serviceHistory.servicePeriods at all,
 * and editing the top-level Entry Date only ever touched
 * vkb.serviceHistory.entryDate/entryDateDerived - the matching entry in
 * servicePeriods[] (what generateLLMContext's "Period 1:" line reads) kept
 * its stale calculated flag, so "Service:" and "Period 1:" disagreed after
 * every edit. Fixture values are synthetic, not any real veteran's data.
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
// Two tests now assert on saveVKB.mock.calls[0] - without this, calls
// accumulate across tests and the second test reads the first test's call.
afterEach(() => {
  vi.clearAllMocks();
});

function buildVkb() {
  return {
    metadata: { completeness: 10, documentCount: 1 },
    personal: { fullName: null, dateOfBirth: null, email: null, phone: null },
    serviceHistory: {
      branch: "Army National Guard",
      characterOfService: "Honorable",
      entryDate: "2002-03-05",
      entryDateDerived: true,
      separationDate: "2010-06-15",
      servicePeriods: [
        {
          serviceStartDate: "2002-03-05",
          serviceStartDateDerived: true,
          serviceEndDate: "2010-06-15",
          branch: "Army National Guard",
        },
      ],
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

describe("VKBViewer - service periods display", () => {
  it("renders the servicePeriods array with its own calculated marker", async () => {
    loadVKB.mockResolvedValue(buildVkb());
    await openServiceHistory();

    expect(screen.getByText("Service Periods")).toBeInTheDocument();
    expect(screen.getAllByText(/2002-03-05/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/calculated from net service/).length,
    ).toBeGreaterThan(1);
  });

  it("propagates an Entry Date edit to the matching period even when the two dates have already drifted a few days apart", async () => {
    const vkb = buildVkb();
    // mergeDD214ServiceDates (the top-level field's own writer) and the
    // servicePeriods[] merge are independent code paths - a veteran whose
    // top-level entry date was already nudged by one but not the other
    // lands here with the two close, but not byte-identical.
    vkb.serviceHistory.servicePeriods[0].serviceStartDate = "2002-03-08";
    loadVKB.mockResolvedValue(vkb);
    await openServiceHistory();

    fireEvent.click(screen.getByText("✏️ Edit"));
    fireEvent.change(screen.getByLabelText(/Entry Date/), {
      target: { value: "2001-01-15" },
    });
    fireEvent.click(screen.getByText("💾 Save"));

    const { saveVKB } = await import("../../utils/veteranKnowledgeBase.js");
    await vi.waitFor(() => expect(saveVKB).toHaveBeenCalled());
    const saved = saveVKB.mock.calls[0][0];
    expect(saved.serviceHistory.servicePeriods[0]).toMatchObject({
      serviceStartDate: "2001-01-15",
      serviceStartDateDerived: false,
    });
  });

  it("propagates an Entry Date edit through to the matching service period", async () => {
    loadVKB.mockResolvedValue(buildVkb());
    await openServiceHistory();

    fireEvent.click(screen.getByText("✏️ Edit"));
    fireEvent.change(screen.getByLabelText(/Entry Date/), {
      target: { value: "2001-01-15" },
    });
    fireEvent.click(screen.getByText("💾 Save"));

    const { saveVKB } = await import("../../utils/veteranKnowledgeBase.js");
    await vi.waitFor(() => expect(saveVKB).toHaveBeenCalled());
    const saved = saveVKB.mock.calls[0][0];
    expect(saved.serviceHistory.entryDate).toBe("2001-01-15");
    expect(saved.serviceHistory.entryDateDerived).toBe(false);
    expect(saved.serviceHistory.servicePeriods[0]).toMatchObject({
      serviceStartDate: "2001-01-15",
      serviceStartDateDerived: false,
    });
  });
});
