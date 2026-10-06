/**
 * What a writing tool saves "to My Packet" is on the My Packet screen
 * afterwards. Each tool is saved through its own button, the tool is
 * closed, and My Packet is opened fresh, as after a reload: the tab's count
 * goes up and the saved item is listed with its text. All values are
 * invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { VaAuthProvider } from "../../contexts/VaAuthContext.jsx";
import { saveStatementForCondition } from "../../utils/claimsStorage";
import { fillRequiredOnScreen } from "../helpers/formMarkers";

vi.mock("../../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  isAnyAIAvailable: () => false,
  getAIStatus: () => ({ statusText: "No AI", isPrivate: true }),
  generateAI: vi.fn(),
}));
vi.mock("../../utils/aiStatementHelper", async (importOriginal) => ({
  ...(await importOriginal()),
  isAIAvailable: () => false,
}));
vi.mock("../../utils/veteranContextProvider", async (importOriginal) => ({
  ...(await importOriginal()),
  getVeteranAIContext: vi.fn(async () => ""),
  saveAnalysisResults: vi.fn(async () => ({ documentId: "doc-1" })),
  mergeAnalysisIntoVkb: vi.fn(async () => {}),
}));

// My Packet imports the PDF reader, whose worker file this test never runs.
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "" }));

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};
const { default: MyPacket } = await import("../../components/MyPacket.jsx");
const { default: TDIUBuilder } =
  await import("../../components/TDIUBuilder.jsx");
const { default: FormsHelper } =
  await import("../../components/FormsHelper.jsx");
const { default: WitnessBench } =
  await import("../../components/WitnessBench.jsx");
const { default: NexusBuilder } =
  await import("../../components/NexusBuilder.jsx");

const inApp = (tool) =>
  render(
    <LanguageProvider>
      <VaAuthProvider>{tool}</VaAuthProvider>
    </LanguageProvider>,
  );

/** Close the tool and open My Packet fresh, as after a reload. */
function openMyPacket() {
  cleanup();
  inApp(<MyPacket onClose={() => {}} />);
}
const tab = (name) => screen.getByRole("tab", { name });
const countOn = (name) => Number(/\d+/.exec(tab(name).textContent)?.[0]);

beforeEach(() => {
  localStorage.clear();
});

describe("TDIU Builder", () => {
  const WORK = "Marker22 warehouse loader";

  async function saveStatement() {
    inApp(<TDIUBuilder onClose={() => {}} />);
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "Diabetes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fatigue" }));
    fireEvent.click(
      screen.getByRole("button", { name: /add this disability/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /continue to work history/i }),
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "What was your last occupation?" }),
      { target: { value: WORK } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /generate vocational statement/i }),
    );
    const box18 = await screen.findByLabelText(
      "Statement for Box 18 (VA Form 21-8940)",
    );
    fireEvent.change(box18, {
      target: { value: "I cannot keep a job because I tire within an hour." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to My Packet" }));
    await screen.findByRole("button", { name: /^Saved to My Packet at/ });
  }

  it("is listed under Forms in My Packet, with the statement and the work history", async () => {
    await saveStatement();
    openMyPacket();

    expect(countOn("Forms")).toBe(1);
    fireEvent.click(tab("Forms"));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("TDIU statement")).toBeVisible();
    expect(panel.textContent).toContain("VA Form 21-8940");

    fireEvent.click(within(panel).getByRole("button", { name: "View" }));
    await waitFor(() =>
      expect(document.body.textContent).toContain(
        "I cannot keep a job because I tire within an hour.",
      ),
    );
    expect(document.body.textContent).toContain(`Last occupation: ${WORK}`);
  });

  it("is one item after saving changes, not two", async () => {
    await saveStatement();
    const box18 = screen.getByLabelText(
      "Statement for Box 18 (VA Form 21-8940)",
    );
    fireEvent.change(box18, { target: { value: `${box18.value} Edited.` } });
    fireEvent.click(
      screen.getByRole("button", { name: "Save changes to My Packet" }),
    );
    await screen.findByRole("button", { name: /^Saved to My Packet at/ });
    openMyPacket();

    expect(countOn("Forms")).toBe(1);
    fireEvent.click(tab("Forms"));
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    await waitFor(() =>
      expect(document.body.textContent).toContain("within an hour. Edited."),
    );
  });
});

describe("Forms Helper", () => {
  it("is listed under Forms in My Packet", async () => {
    inApp(<FormsHelper onClose={() => {}} />);
    fireEvent.click(screen.getByText("Statement in Support of Claim"));
    fireEvent.click(screen.getByText("Start Guided Builder"));
    const next = () => screen.queryByRole("button", { name: /^next$/i });
    for (let guard = 0; guard < 14; guard++) {
      fillRequiredOnScreen(fireEvent.change, fireEvent.click);
      if (!next()) break;
      fireEvent.click(next());
    }
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));
    fireEvent.click(screen.getByRole("button", { name: /save to packet/i }));
    await screen.findByRole("button", { name: /saved to my packet at/i });
    openMyPacket();

    expect(countOn("Forms")).toBe(1);
    fireEvent.click(tab("Forms"));
    expect(screen.getByRole("tabpanel").textContent).toContain("21-4138");
  });
});

describe("Witness Bench", () => {
  it("is listed under Claims in My Packet, for the condition it is about", async () => {
    inApp(<WitnessBench onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /spouse \/ partner/i }));
    fireEvent.change(
      screen.getByPlaceholderText(
        "e.g., PTSD, Lower Back Pain, Tinnitus, Sleep Apnea",
      ),
      { target: { value: "Marker10 condition" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("e.g., Jane Smith, John Doe"),
      { target: { value: "Odalys Fenwick" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /start interview/i }));
    const next = () => screen.queryByRole("button", { name: /^next/i });
    for (let i = 0; i < 20; i++) {
      fireEvent.change(await screen.findByRole("textbox"), {
        target: { value: `I saw this happen, number ${i}.` },
      });
      if (!next()) break;
      fireEvent.click(next());
    }
    fireEvent.click(
      screen.getByRole("button", { name: /generate statement/i }),
    );
    await screen.findByRole("textbox", { name: "Your Buddy Statement" });
    fireEvent.click(screen.getByRole("button", { name: /save to my packet/i }));
    await waitFor(() =>
      expect(document.body.textContent).toMatch(/Saved to My Packet at/),
    );
    openMyPacket();

    expect(countOn("Claims")).toBe(1);
    expect(screen.getByRole("tabpanel").textContent).toContain(
      "Marker10 condition",
    );
  });
});

describe("Nexus Builder", () => {
  it("is listed under Claims in My Packet, for the condition it is about", () => {
    inApp(
      <NexusBuilder
        onClose={() => {}}
        onSave={saveStatementForCondition}
        condition="Marker40 condition"
      />,
    );
    const step = (name) =>
      fireEvent.click(screen.getByRole("button", { name }));
    step(/next step/i);
    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "I miss about two shifts a month" },
    });
    step(/next step/i);
    fireEvent.click(screen.getAllByRole("checkbox").at(-1));
    step(/save to packet/i);
    openMyPacket();

    expect(countOn("Claims")).toBe(1);
    expect(screen.getByRole("tabpanel").textContent).toContain(
      "Marker40 condition",
    );
  });
});
