/**
 * A stand-in for an official VA form PDF: one field for every name in the
 * filler's field map, a check box where the filler asks for a check box and
 * a text field otherwise. The real forms are not read by tests; this holds
 * the filler to its own map and lets a test read back what it set.
 */
import { vi } from "vitest";
import { PDFDocument, PDFForm } from "pdf-lib";
import { _VA_FORM_FIELDS } from "../../utils/pdfFormFiller";

// Answers that make the filler reach for every check box it can set.
const CHECK_BOX_PROBES = [
  {},
  ...["fellow-service-member", "spouse", "coworker", "caregiver"].map(
    (witnessRelation) => ({ witnessRelation }),
  ),
  ...["served", "family", "work", "zz"].map((witnessRelation) => ({
    witnessRelation,
  })),
  { benefitTypes: ["compensation", "pension", "dic"] },
  { priorityReasons: ["illness financial als 85 homeless", "extreme"] },
  { priorityReasons: ["financial"] },
];

async function checkBoxNamesAskedFor(fill) {
  const blank = await PDFDocument.create();
  blank.addPage();
  const bytes = await blank.save();
  const asked = new Set();
  const spy = vi
    .spyOn(PDFForm.prototype, "getCheckBox")
    .mockImplementation((name) => {
      asked.add(name);
      throw new Error("no such field");
    });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => bytes })),
  );
  try {
    for (const probe of CHECK_BOX_PROBES) await fill(probe);
  } finally {
    spy.mockRestore();
  }
  return asked;
}

/**
 * Fill `formNumber` with `data` through `fill` (the filler's own function)
 * and return a reader over the result: `text(key)`, `checked(key)` by the
 * field map's keys, `allText()` and `checkedKeys()`.
 */
export async function fillSyntheticForm(formNumber, fill, data) {
  const fieldMap = _VA_FORM_FIELDS[formNumber];
  const checkBoxes = await checkBoxNamesAskedFor(fill);

  const template = await PDFDocument.create();
  const page = template.addPage();
  const form = template.getForm();
  [...new Set(Object.values(fieldMap))].forEach((name, i) => {
    const place = { x: 10, y: 10 + (i % 70) * 10, width: 200, height: 9 };
    if (checkBoxes.has(name)) {
      form.createCheckBox(name).addToPage(page, { ...place, width: 9 });
    } else {
      const field = form.createTextField(name);
      field.enableMultiline();
      field.addToPage(page, place);
    }
  });
  const templateBytes = await template.save();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => templateBytes })),
  );

  const filled = await PDFDocument.load(await fill(data));
  const out = filled.getForm();
  const keys = Object.keys(fieldMap);
  const isCheckBox = (key) => checkBoxes.has(fieldMap[key]);
  const text = (key) => out.getTextField(fieldMap[key]).getText() ?? "";
  const checked = (key) => out.getCheckBox(fieldMap[key]).isChecked();
  return {
    text,
    checked,
    checkBoxKeys: () => keys.filter(isCheckBox),
    checkedKeys: () => keys.filter((key) => isCheckBox(key) && checked(key)),
    filledTextKeys: () =>
      keys.filter((key) => !isCheckBox(key) && text(key) !== ""),
    allText: () =>
      keys
        .filter((key) => !isCheckBox(key))
        .map(text)
        .join("\n"),
  };
}
