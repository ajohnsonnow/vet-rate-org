/**
 * One draft in the Nexus Builder. Every answer is given through the real
 * wizard with its own marker; each must appear exactly once in the
 * statement on screen, in the statement part of every download and in the
 * statement saved to My Packet, along with an edit made on screen. The
 * builder has no copy button: the editable statement is the text to copy.
 * A download also carries the doctor's cheat sheet shown beside the
 * statement. All values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { draftFileText, flat, occurrences } from "../helpers/draftFileText";
import { DRAFT_FORMATS } from "../../utils/draftExport";

vi.mock("../../utils/sanitize", async (importOriginal) => ({
  ...(await importOriginal()),
  triggerBlobDownload: vi.fn(() => true),
}));
vi.mock("../../utils/draftExport", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    downloadDraft: vi.fn((...args) => actual.downloadDraft(...args)),
  };
});
vi.mock("../../utils/aiStatementHelper", async (importOriginal) => ({
  ...(await importOriginal()),
  isAIAvailable: () => false,
}));
const { downloadDraft } = await import("../../utils/draftExport");
const { default: NexusBuilder } =
  await import("../../components/NexusBuilder.jsx");

const LABEL = "Statement in Support of Claim (VA Form 21-4138)";
const FORMAT_LABELS = {
  txt: "Text (.txt)",
  docx: "Word (.docx)",
  pdf: "PDF (.pdf)",
};
const EDIT = "A line the veteran typed into the statement on screen.";
const CHEAT_SHEET = "--- DOCTOR'S CHEAT SHEET";
const statementField = () => screen.getByRole("textbox", { name: LABEL });
const next = () =>
  fireEvent.click(screen.getByRole("button", { name: /next step/i }));
const type = (index, value) =>
  fireEvent.change(screen.getAllByRole("textbox")[index], {
    target: { value },
  });

const CLAIMS = {
  direct: {
    props: { condition: "Marker10 claimed condition" },
    printed: [
      "Marker10 claimed condition",
      "Marker11 onset",
      "I have sought medical treatment for this condition through both the VA and private healthcare.",
      "Marker15 work",
      "Marker16 social",
      "Marker17 examples",
    ],
  },
  secondary: {
    props: {
      condition: "Marker10 claimed condition",
      primaryCondition: "Marker20 primary condition",
    },
    printed: [
      "Marker10 claimed condition",
      "Marker20 primary condition",
      "Marker11 onset",
      "I have sought medical treatment for this condition through both the VA and private healthcare.",
      "Sleep disruption from primary condition.",
      "Marker13 explanation",
      "Marker14 incident",
      "Marker15 work",
      "Marker16 social",
      "Marker17 examples",
    ],
  },
};

/** Answer every question, reach the review step, and add one typed line. */
function answerEverything(kind, onSave = () => true) {
  render(
    <LanguageProvider>
      <NexusBuilder
        onClose={() => {}}
        onSave={onSave}
        {...CLAIMS[kind].props}
      />
    </LanguageProvider>,
  );
  type(0, "Marker11 onset");
  fireEvent.click(screen.getByLabelText("Both VA and private"));
  next();
  if (kind === "secondary") {
    fireEvent.click(
      screen.getByLabelText("Sleep disruption from primary condition"),
    );
    type(0, "Marker13 explanation");
    type(1, "Marker14 incident");
    next();
  }
  type(0, "Marker15 work");
  type(1, "Marker16 social");
  type(2, "Marker17 examples");
  next();
  fireEvent.change(statementField(), {
    target: { value: `${statementField().value}\n\n${EDIT}` },
  });
  fireEvent.click(screen.getAllByRole("checkbox").at(-1));
  return [...CLAIMS[kind].printed, EDIT];
}

const expectEachOnce = (text, printed) => {
  for (const answer of printed) {
    expect([answer, occurrences(text, answer)]).toEqual([answer, 1]);
  }
};

beforeEach(() => {
  localStorage.clear();
  downloadDraft.mockClear();
});

describe.each(Object.keys(CLAIMS))("Nexus Builder, %s claim", (kind) => {
  it("shows every answer exactly once in the statement on screen", () => {
    const printed = answerEverything(kind);
    const counts = printed.map((answer) =>
      occurrences(statementField().value, answer),
    );
    expect(counts).toEqual(printed.map(() => 1));
  });

  it.each(DRAFT_FORMATS)(
    "puts that statement, every answer once, in the .%s download",
    async (format) => {
      const printed = answerEverything(kind);
      const onScreen = statementField().value;
      fireEvent.click(
        screen.getByRole("button", { name: /download statement/i }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: FORMAT_LABELS[format] }),
      );

      await waitFor(() => expect(downloadDraft).toHaveBeenCalledTimes(1));
      const { bytes } = await downloadDraft.mock.results[0].value;
      const [statement, cheatSheet] = flat(
        await draftFileText(bytes, format),
      ).split(CHEAT_SHEET);
      expect(flat(statement)).toBe(flat(onScreen));
      expectEachOnce(statement, printed);
      expect(cheatSheet).toContain("Dear Healthcare Provider,");
    },
  );

  it("saves that statement, every answer once, to My Packet", () => {
    const onSave = vi.fn(() => true);
    const printed = answerEverything(kind, onSave);
    const onScreen = statementField().value;
    fireEvent.click(screen.getByRole("button", { name: /save to packet/i }));

    const saved = onSave.mock.calls[0][0];
    expect(saved.statement).toBe(onScreen);
    expectEachOnce(saved.statement, printed);
    expect(saved.doctorNote).toContain("Dear Healthcare Provider,");
  });
});
