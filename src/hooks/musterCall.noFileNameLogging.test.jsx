/**
 * D21-5: a veteran chooses their own file names and they often carry a name,
 * a file number or a date of birth. One import wrote those names to the
 * console thousands of times (every progress tick, every queue update), where
 * bug reports and screenshots capture them. A full import - selecting the
 * files, processing, saving, review and Verify & Save - of files whose names
 * carry generic identifier tokens must write none of those tokens to any
 * console method. Only text extraction is faked; the hooks, the processor
 * and the stores are real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { inspect } from "node:util";
import { createFakeIndexedDB } from "../__tests__/helpers/fakeIndexedDB";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("../utils/documentAnalyzer", async (importOriginal) => ({
  ...(await importOriginal()),
  analyzeDocument: vi.fn(),
}));

const NAME_TOKENS = ["QUILLFEATHER", "ZEPHANIA", "987654321", "19710203"];
const FILE_NAMES = [
  "QUILLFEATHER-ZEPHANIA-987654321-dd214.pdf",
  "ClaimLetter-QUILLFEATHER-19710203.pdf",
];

const DOCUMENT_TEXT = `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
4A. GRADE, RATE OR RANK: SGT
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
24. CHARACTER OF SERVICE: HONORABLE
`;

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};
const setError = vi.fn();
const setProcessingState = vi.fn();

let useFormationQueue;
let useSequentialFormationFlow;
let useMusterCallFileIntake;
let analyzeDocument;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  vi.stubGlobal("indexedDB", createFakeIndexedDB().indexedDB);
  ({ analyzeDocument } = await import("../utils/documentAnalyzer"));
  analyzeDocument.mockResolvedValue({
    text: DOCUMENT_TEXT,
    pageCount: 1,
    method: "text",
    ocrUsed: false,
  });
  ({ default: useFormationQueue } = await import("./useFormationQueue"));
  ({ useSequentialFormationFlow } =
    await import("./useSequentialFormationFlow"));
  ({ default: useMusterCallFileIntake } =
    await import("./useMusterCallFileIntake"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function consoleText(spies) {
  return spies
    .flatMap((spy) => spy.mock.calls)
    .map((args) => args.map((a) => inspect(a, { depth: 8 })).join(" "))
    .join("\n");
}

describe("the progress panel never logs the file name it is showing", () => {
  it("renders a progress update carrying an identifier-bearing file name without logging it", async () => {
    const { render } = await import("@testing-library/react");
    const { default: PlatoonSergeantReview } =
      await import("../components/PlatoonSergeantReview");
    const spies = ["log", "info", "warn", "error", "debug"].map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const progress = {
      filename: FILE_NAMES[0],
      fileSize: 1024,
      progress: 40,
      stage: "platoon_sergeant",
      state: "extracting",
    };

    render(<PlatoonSergeantReview progress={progress} onSkip={() => {}} />);

    const output = consoleText(spies);
    expect(output).toContain("PlatoonSergeantReview received progress");
    for (const token of NAME_TOKENS) {
      expect(output, `console output contains "${token}"`).not.toContain(token);
    }
  });
});

describe("a full Muster Call import never logs a file name", () => {
  it("selecting, processing, saving and verifying files with identifier-bearing names", async () => {
    const spies = ["log", "info", "warn", "error", "debug"].map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const { result } = renderHook(() => {
      const formationQueue = useFormationQueue();
      const flow = useSequentialFormationFlow({
        formationQueue,
        toast,
        setError,
        setProcessingState,
      });
      const intake = useMusterCallFileIntake({
        useSequentialMode: true,
        formationQueue,
        toast,
        setError,
      });
      return { formationQueue, flow, intake };
    });

    act(() => {
      result.current.intake.handleFileSelect(
        FILE_NAMES.map(
          (name) =>
            new File([DOCUMENT_TEXT], name, { type: "application/pdf" }),
        ),
      );
    });
    await waitFor(() =>
      expect(result.current.formationQueue.formation).toHaveLength(2),
    );

    for (let i = 0; i < FILE_NAMES.length; i++) {
      await act(async () => {
        if (i === 0) result.current.flow.startSequentialProcessing();
      });
      await waitFor(
        () => expect(result.current.flow.showIntelBriefing).toBe(true),
        { timeout: 15_000 },
      );
      await act(async () => {
        await result.current.flow.handleVerifyAndSave({
          verifiedData: {},
          saveToVKB: true,
          updateProfile: false,
        });
      });
      await waitFor(
        () => expect(result.current.flow.showIntelBriefing).toBe(false),
        { timeout: 15_000 },
      );
    }

    const output = consoleText(spies);
    expect(output.length).toBeGreaterThan(0);
    expect(output).toMatch(/document \d+ \(/);
    for (const token of NAME_TOKENS) {
      expect(output, `console output contains "${token}"`).not.toContain(token);
    }
  }, 60_000);
});
