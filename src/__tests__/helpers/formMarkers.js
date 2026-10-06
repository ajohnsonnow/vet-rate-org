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
      } else {
        formData[field.name] = marker;
        markers.push({ name: field.name, printed: marker });
      }
    });
  return { formData, markers };
}
