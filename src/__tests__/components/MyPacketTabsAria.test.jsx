/**
 * My Packet's tab strip had no ARIA tabs semantics (no tablist/tab roles,
 * no aria-selected/aria-controls, no tabpanel) - at 390px the "hidden
 * sm:inline" label text disappears, so a tab's accessible name collapsed
 * to just its emoji + count badge (e.g. the Service tab announced as
 * "🎖️ 15"). This verifies the WAI-ARIA Tabs pattern (tablist container,
 * tab/tabpanel pairing, roving-tabindex arrow-key navigation) and that
 * every tab keeps a real accessible name regardless of the visible-label
 * breakpoint.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { VaAuthProvider } from "../../contexts/VaAuthContext.jsx";

// MyPacket transitively imports pdfjs, which references canvas globals
// jsdom doesn't provide (same pattern as musterCallProcessor.*.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};
const { default: MyPacket } = await import("../../components/MyPacket.jsx");

const TAB_ORDER = [
  "claims",
  "ratings",
  "service",
  "timeline",
  "painmaps",
  "profile",
  "forms",
  "varecords",
  "documents",
];

const TAB_NAMES = {
  claims: "Claims",
  ratings: "Ratings",
  service: "Service",
  timeline: "Timeline",
  painmaps: "Pain Maps",
  profile: "Profile",
  forms: "Forms",
  varecords: "VA Records",
  documents: "Documents",
};

function renderMyPacket() {
  return render(
    <LanguageProvider>
      <VaAuthProvider>
        <MyPacket onClose={() => {}} />
      </VaAuthProvider>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("MyPacket tabs: WAI-ARIA Tabs pattern - structure", () => {
  it("exposes a tablist with every tab carrying a real accessible name", () => {
    renderMyPacket();

    const tablist = screen.getByRole("tablist", { name: "Tabs" });
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(TAB_ORDER.length);

    for (const id of TAB_ORDER) {
      const tab = screen.getByRole("tab", { name: TAB_NAMES[id] });
      expect(tab).toHaveAttribute("id", `mypacket-tab-${id}`);
      expect(tab).toHaveAttribute("aria-controls", `mypacket-panel-${id}`);
    }
  });

  it("marks only the active tab as selected, with a matching tabpanel", () => {
    renderMyPacket();

    // Default active tab is "claims".
    expect(screen.getByRole("tab", { name: "Claims" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Service" })).toHaveAttribute(
      "aria-selected",
      "false",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Service" }));

    expect(screen.getByRole("tab", { name: "Service" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Claims" })).toHaveAttribute(
      "aria-selected",
      "false",
    );

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "mypacket-panel-service");
    expect(panel).toHaveAttribute("aria-labelledby", "mypacket-tab-service");
  });

  it("uses roving tabindex: only the selected tab is tab-reachable", () => {
    renderMyPacket();

    expect(screen.getByRole("tab", { name: "Claims" })).toHaveAttribute(
      "tabIndex",
      "0",
    );
    for (const id of TAB_ORDER.filter((t) => t !== "claims")) {
      expect(screen.getByRole("tab", { name: TAB_NAMES[id] })).toHaveAttribute(
        "tabIndex",
        "-1",
      );
    }

    fireEvent.click(screen.getByRole("tab", { name: "Forms" }));

    expect(screen.getByRole("tab", { name: "Forms" })).toHaveAttribute(
      "tabIndex",
      "0",
    );
    expect(screen.getByRole("tab", { name: "Claims" })).toHaveAttribute(
      "tabIndex",
      "-1",
    );
  });
});

describe("MyPacket tabs: WAI-ARIA Tabs pattern - keyboard navigation", () => {
  it("moves selection and focus with ArrowRight/ArrowLeft/Home/End", () => {
    renderMyPacket();

    const claimsTab = screen.getByRole("tab", { name: "Claims" });
    claimsTab.focus();

    fireEvent.keyDown(claimsTab, { key: "ArrowRight" });
    const ratingsTab = screen.getByRole("tab", { name: "Ratings" });
    expect(ratingsTab).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(ratingsTab);

    fireEvent.keyDown(ratingsTab, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Claims" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(screen.getByRole("tab", { name: "Claims" }), {
      key: "ArrowLeft",
    });
    const documentsTab = screen.getByRole("tab", { name: "Documents" });
    expect(documentsTab).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(documentsTab);

    fireEvent.keyDown(documentsTab, { key: "Home" });
    expect(screen.getByRole("tab", { name: "Claims" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(screen.getByRole("tab", { name: "Claims" }), {
      key: "End",
    });
    expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
