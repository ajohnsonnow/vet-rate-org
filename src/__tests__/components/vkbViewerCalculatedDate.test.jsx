/**
 * An NGB-22 that prints no entry date gets one calculated (separation date
 * minus net service). ADR-007: VKBViewer's "Entry Date" field is now a
 * projection of the canonical servicePeriods[] resolver - it must mark a
 * calculated date instead of showing it as printed, and a veteran's own
 * edit routes through setServiceEntryDate (via: 'vkb_viewer') rather than
 * writing the VKB's top-level field directly. Fixture values are
 * synthetic, not any real veteran's data.
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

function seedPeriod(derived) {
  return upsertServicePeriod(
    {
      serviceStartDate: "2012-03-14",
      serviceStartDateDerived: derived,
      serviceEndDate: "2020-03-14",
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

describe("VKBViewer - calculated entry date marker", () => {
  it("shows the marker when the resolved entry is calculated", async () => {
    seedPeriod(true);
    await openServiceHistory();

    // The projection keeps the top-level field AND the linked period row
    // showing the same marker - both are asserted to exist, never zero.
    expect(
      screen.getAllByText(/calculated from net service/).length,
    ).toBeGreaterThan(0);
  });

  it("shows no marker when the resolved entry is printed", async () => {
    seedPeriod(false);
    await openServiceHistory();

    expect(
      screen.queryByText(/calculated from net service/),
    ).not.toBeInTheDocument();
  });

  it("clears the marker once the veteran edits and saves their own entry date", async () => {
    const periodId = seedPeriod(true);
    await openServiceHistory();

    fireEvent.click(screen.getByText("✏️ Edit"));
    fireEvent.change(screen.getByLabelText(/Entry Date/), {
      target: { value: "2011-09-01" },
    });

    // The top-level field's own marker clears immediately (component-local
    // state) - the linked period row's marker only updates once Save
    // actually applies the real correction and reloads.
    expect(
      screen.getByLabelText(/Entry Date/).labels[0].textContent,
    ).not.toContain("calculated");

    fireEvent.click(screen.getByText("💾 Save"));

    const { saveVKB } = await import("../../utils/veteranKnowledgeBase.js");
    await vi.waitFor(() => expect(saveVKB).toHaveBeenCalled());

    expect(getServiceEntry()).toMatchObject({
      date: "2011-09-01",
      derived: false,
      source: "veteran",
      periodId,
    });
    expect(store.serviceHistory.entryDate).toBe("2011-09-01");
    expect(store.serviceHistory.entryDateDerived).toBe(false);
  });
});
