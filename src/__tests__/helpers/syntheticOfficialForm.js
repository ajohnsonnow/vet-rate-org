/**
 * A stand-in for an official VA form PDF, for tests that read back what the
 * filler set. It is built from the real form's own field list
 * (fixtures/officialFormFields.json): the real field names, kinds, pages,
 * box sizes, maximum lengths, font sizes and tooltips. It is not the VA's
 * file and nothing is rendered, but a value the real form would refuse or
 * could not show in its box behaves the same here.
 */
import { vi } from "vitest";
import { PDFDocument, PDFHexString, PDFName } from "pdf-lib";
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
    const tip = PDFHexString.fromText(field.tip);
    if (field.kind === "CheckBox") {
      const box = form.createCheckBox(field.name);
      box.acroField.dict.set(PDFName.of("TU"), tip);
      box.addToPage(page, place);
    } else if (field.kind === "Text") {
      const text = form.createTextField(field.name);
      text.acroField.dict.set(PDFName.of("TU"), tip);
      if (field.max) text.setMaxLength(field.max);
      if (field.multiline) text.enableMultiline();
      text.addToPage(page, place);
      text.setFontSize(field.size || 10);
    }
  }
  return template.save();
}

/**
 * Fill `formNumber` with `data` through `fill` (the filler's own function)
 * and return a reader over the result, by the field map's keys: `text(key)`,
 * `checked(key)`, `filledTextKeys()`, `checkedKeys()`, `allText()`.
 */
export async function fillSyntheticForm(formNumber, fill, data) {
  const fieldMap = _VA_FORM_FIELDS[formNumber];
  const templateBytes = await realTemplate(formNumber);
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
    fieldName: (key) => fieldMap[key],
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
