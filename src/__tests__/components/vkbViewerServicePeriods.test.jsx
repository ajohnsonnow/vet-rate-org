/**
 * ADR-007: the VKB is a projection of servicePeriods[] now, never an
 * independent editor - editing the top-level "Entry Date" field routes
 * through saveVkbViewerEdits (setServiceEntryDate, via: 'vkb_viewer')
 * instead of writing straight into vkb.serviceHistory, and the SAME
 * projection engine that populates servicePeriods[] rows in the first
 * place keeps the top-level field and the matching period row in sync -
 * they can no longer independently drift. Fixture values are synthetic,
 * not any real veteran's data.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

let store = null;

vi.mock("../../utils/veteranKnowledgeBase.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadVKB: vi.fn(async () =>
      actual._applyServiceEntryProjection(
        structuredClone(store ?? actual.initializeVKB()),
      ),
    ),
    saveVKB: vi.fn(async (vkb) => {
      await actual._applyServiceEntryProjection(vkb);
      store = structuredClone(vkb);
      return { success: true };
    }),
  };
});

import VKBViewer from "../../components/VKBViewer.jsx";
import {
  upsertServicePeriod,
  getServiceEntry,
} from "../../utils/veteranProfile.js";

const PROFILE_KEY = "vet_rate_veteran_profile";

function seedCalculatedPeriod() {
  return upsertServicePeriod(
    {
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
      serviceEndDate: "2010-06-15",
      formType: "NGB22",
      branch: "Army National Guard",
    },
    { sourceDocument: "ngb22-synthetic.pdf", confidence: 60 },
  );
}

async function openServiceHistory() {
  render(<VKBViewer isOpen onClose={() => {}} />);
  fireEvent.click(await screen.findByText("Service History"));
  await screen.findByText("Entry Date");
}

beforeEach(() => {
  localStorage.clear();
  store = null;
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ fullName: "Jordan Sample" }),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("VKBViewer - service periods display", () => {
  it("renders the servicePeriods array with its own calculated marker", async () => {
    seedCalculatedPeriod();
    await openServiceHistory();

    expect(screen.getByText("Service Periods")).toBeInTheDocument();
    expect(screen.getAllByText(/2002-03-05/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/calculated from net service/).length,
    ).toBeGreaterThan(1);
  });

  it("propagates an Entry Date edit through to the matching canonical period", async () => {
    const periodId = seedCalculatedPeriod();
    await openServiceHistory();

    fireEvent.click(screen.getByText("✏️ Edit"));
    fireEvent.change(screen.getByLabelText(/Entry Date/), {
      target: { value: "2001-01-15" },
    });
    fireEvent.click(screen.getByText("💾 Save"));

    const { saveVKB } = await import("../../utils/veteranKnowledgeBase.js");
    await vi.waitFor(() => expect(saveVKB).toHaveBeenCalled());

    expect(getServiceEntry()).toMatchObject({
      date: "2001-01-15",
      derived: false,
      source: "veteran",
      periodId,
    });
    expect(store.serviceHistory.entryDate).toBe("2001-01-15");
    expect(store.serviceHistory.entryDateDerived).toBe(false);
    expect(store.serviceHistory.servicePeriods[0]).toMatchObject({
      serviceStartDate: "2001-01-15",
      serviceStartDateDerived: false,
      canonicalPeriodId: periodId,
    });
  });
});
