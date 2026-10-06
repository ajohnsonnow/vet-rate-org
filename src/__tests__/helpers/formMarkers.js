/**
 * Fill every field of a Forms Helper form with its own marker, for tests
 * that hold a draft to "every answer appears exactly once". All values are
 * invented.
 */

// The option picked for each select, and the text the draft prints for it.
export const MARKER_SELECTS = {
  claimType: ["secondary", "Secondary Service Connection"],
  witnessRelation: ["fellow-service-member", "Fellow Service Member"],
  veteranBranch: ["Coast Guard", "Coast Guard"],
  conditionType: [
    "know-before-after",
    "I knew the veteran before and after service",
  ],
  branch: ["Space Force", "Space Force"],
  stressorType: ["fear-hostile", "Fear of Hostile Military/Terrorist Activity"],
};

const CHECKBOX_TEXT = {
  willingToTestify:
    "I am willing to provide additional testimony or clarification if requested.",
};

/**
 * @returns {{ formData: object, markers: { name: string, printed: string }[] }}
 * `printed` is the text the draft must hold exactly once for that field.
 */
export function fillEveryField(steps) {
  const formData = {};
  const markers = [];
  steps
    .flatMap((step) => step.fields)
    .forEach((field, i) => {
      const marker = `Marker${100 + i} for ${field.name}`;
      if (field.type === "select") {
        const [value, printed] = MARKER_SELECTS[field.name];
        formData[field.name] = value;
        markers.push({ name: field.name, printed });
      } else if (field.type === "checklist") {
        formData[field.name] = field.options.slice(0, 2);
        markers.push({
          name: field.name,
          printed: field.options.slice(0, 2).join(", "),
        });
      } else if (field.type === "checkbox") {
        formData[field.name] = true;
        markers.push({ name: field.name, printed: CHECKBOX_TEXT[field.name] });
      } else if (field.type === "email") {
        // A real address: the official forms give it two 20-character lines.
        const address = `m${100 + i}@example.invalid`;
        formData[field.name] = address;
        markers.push({ name: field.name, printed: address });
      } else {
        formData[field.name] = marker;
        markers.push({ name: field.name, printed: marker });
      }
    });
  return { formData, markers };
}

/**
 * Give every required control on screen that has no answer one, so a test
 * about something else can walk through a wizard step.
 */
const REQUIRED_VALUES = {
  date: "2015-06-15",
  email: "someone@example.invalid",
  tel: "5550100200",
  number: "1",
};

export function fillRequiredOnScreen(fireChange, fireClick) {
  for (const control of document.querySelectorAll(
    "input[required], textarea[required], select[required]",
  )) {
    if (control.type === "checkbox") {
      if (!control.checked) fireClick(control);
      continue;
    }
    if (control.value.trim() !== "") continue;
    const value =
      control.tagName === "SELECT"
        ? control.options[1].value
        : (REQUIRED_VALUES[control.type] ?? "Answer");
    fireChange(control, { target: { value } });
  }
  for (const group of document.querySelectorAll('[role="group"]')) {
    const boxes = [...group.querySelectorAll('input[type="checkbox"]')];
    const required = group.textContent.includes("*");
    if (required && !boxes.some((box) => box.checked)) fireClick(boxes[0]);
  }
}
