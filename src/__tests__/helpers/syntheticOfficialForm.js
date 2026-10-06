/**
 * A stand-in for an official VA form PDF, for tests that read back what the
 * filler set. For the seven forms the app offers it is built from the real
 * forms' own field list (fixtures/officialFormFields.json): the real field
 * names, kinds, pages, box sizes, maximum lengths, font sizes and tooltips.
 * It is not the VA's file and nothing is rendered, but a value the real
 * form would refuse or could not show in its box behaves the same here.
 * A form with no fixture gets one field per name in the filler's map.
 */
import { vi } from "vitest";
import { PDFDocument, PDFForm } from "pdf-lib";
import { _VA_FORM_FIELDS } from "../../utils/pdfFormFiller";
import REAL from "../utils/fixtures/officialFormFields.json";

/** The real form's fields, by name: `{ kind, page, box, tip, max, size }`. */
export const realFields = (formNumber) =>
  new Map(
    (REAL.forms[formNumber]?.fields ?? []).map((field) => [field.name, field]),
  );

/**
 * The item number a real field belongs to, from its tooltip ("8. VETERAN'S
 * TELEPHONE NUMBER" is item 8), or null when the tooltip gives none.
 */
export function itemNumberOf(field) {
  const tip = (field?.tip ?? "").replace(/SECTION \d+/gi, "");
  const found = /(?:^|[\s.:])(\d{1,2})\. ?[A-Za-z]/.exec(tip);
  return found ? Number(found[1]) : null;
}

async function realTemplate(formNumber) {
  const { pages, fields } = REAL.forms[formNumber];
  const template = await PDFDocument.create();
  const sheets = Array.from({ length: pages }, () => template.addPage());
  const form = template.getForm();
  for (const field of fields) {
    const [x, y, width, height] = field.box;
    const place = { x, y, width, height };
    const page = sheets[field.page - 1];
    if (field.kind === "CheckBox") {
      form.createCheckBox(field.name).addToPage(page, place);
    } else if (field.kind === "Text") {
      const text = form.createTextField(field.name);
      if (field.max) text.setMaxLength(field.max);
      if (field.multiline) text.enableMultiline();
      text.addToPage(page, place);
      text.setFontSize(field.size || 10);
    }
  }
  return template.save();
}

// Answers that make the filler reach for every check box it can set.
const CHECK_BOX_PROBES = [
  {},
  { benefitTypes: ["compensation", "pension", "dic"] },
  { priorityReasons: ["illness financial als 85 homeless", "extreme"] },
  { priorityReasons: ["financial"] },
];

async function mapTemplate(formNumber, fill) {
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
  const template = await PDFDocument.create();
  const page = template.addPage();
  const form = template.getForm();
  [...new Set(Object.values(_VA_FORM_FIELDS[formNumber]))].forEach(
    (name, i) => {
      const place = { x: 10, y: 10 + (i % 70) * 10, width: 200, height: 9 };
      if (asked.has(name)) {
        form.createCheckBox(name).addToPage(page, { ...place, width: 9 });
      } else {
        const field = form.createTextField(name);
        field.enableMultiline();
        field.addToPage(page, { ...place, height: 600 });
        field.setFontSize(10);
      }
    },
  );
  return template.save();
}

/**
 * Fill `formNumber` with `data` through `fill` (the filler's own function)
 * and return a reader over the result, by the field map's keys: `text(key)`,
 * `checked(key)`, `filledTextKeys()`, `checkedKeys()`, `allText()`.
 */
export async function fillSyntheticForm(formNumber, fill, data) {
  const fieldMap = _VA_FORM_FIELDS[formNumber];
  const templateBytes = REAL.forms[formNumber]
    ? await realTemplate(formNumber)
    : await mapTemplate(formNumber, fill);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => templateBytes })),
  );

  const filled = await PDFDocument.load(await fill(data));
  const out = filled.getForm();
  const kindOf = new Map(
    out.getFields().map((field) => [field.getName(), field.constructor.name]),
  );
  const keys = Object.keys(fieldMap);
  const isCheckBox = (key) => kindOf.get(fieldMap[key]) === "PDFCheckBox";
  const isText = (key) => kindOf.get(fieldMap[key]) === "PDFTextField";
  const text = (key) => out.getTextField(fieldMap[key]).getText() ?? "";
  const checked = (key) => out.getCheckBox(fieldMap[key]).isChecked();
  return {
    text,
    checked,
    checkBoxKeys: () => keys.filter(isCheckBox),
    checkedKeys: () => keys.filter((key) => isCheckBox(key) && checked(key)),
    filledTextKeys: () => keys.filter((key) => isText(key) && text(key) !== ""),
    allText: () => keys.filter(isText).map(text).join("\n"),
    // Every filled field on the form, mapped or not, by its real name.
    filledByName: () =>
      Object.fromEntries(
        out
          .getFields()
          .filter((field) => field.constructor.name === "PDFTextField")
          .map((field) => [field.getName(), field.getText() ?? ""])
          .filter(([, value]) => value !== ""),
      ),
  };
}
