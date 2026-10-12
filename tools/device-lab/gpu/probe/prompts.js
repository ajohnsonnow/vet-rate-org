export const SHORT_PROMPT =
  "In two or three plain sentences, explain what a smoke detector does and why it should be tested every month.";

const SUBJECTS = [
  "The maintenance crew",
  "A delivery driver",
  "The night shift",
  "An inspector",
  "The warehouse team",
  "A volunteer",
  "The records clerk",
  "A supervisor",
];
const ACTIONS = [
  "logged a faulty door sensor",
  "moved twelve pallets to bay four",
  "replaced a worn conveyor belt",
  "reported a slow leak near the loading dock",
  "updated the weekly schedule",
  "counted the spare filters",
  "repainted the floor markings",
  "tested the backup generator",
];
const PLACES = [
  "on Monday morning",
  "late on Tuesday",
  "during the lunch break",
  "before the shift change",
  "after the storm",
  "at the start of the quarter",
  "near the east gate",
  "beside the cold store",
];

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildLongPrompt(paragraphs = 70) {
  const rnd = lcg(20261011);
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const lines = [];
  for (let n = 1; n <= paragraphs; n++) {
    lines.push(
      `Note ${n}: ${pick(SUBJECTS)} ${pick(ACTIONS)} ${pick(PLACES)}. ` +
        `${pick(SUBJECTS)} then ${pick(ACTIONS)} ${pick(PLACES)}, and the entry was signed off by unit ${100 + Math.floor(rnd() * 900)}.`,
    );
  }
  return (
    "Below is a synthetic facility log. Read it, then write a short summary of the three most common kinds of activity in about four sentences.\n\n" +
    lines.join("\n")
  );
}
