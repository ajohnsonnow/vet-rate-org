/**
 * Read the text back out of a downloaded draft file, for tests that hold
 * every download to the text on screen.
 */
import JSZip from "jszip";

const XML_ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

async function docxText(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml").async("string");
  return xml
    .split("</w:p>")
    .map((paragraph) =>
      [...paragraph.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((run) => run[1])
        .join("")
        .replace(
          /&(?:amp|lt|gt|quot|apos);/g,
          (entity) => XML_ENTITIES[entity],
        ),
    )
    .join("\n");
}

function pdfText(bytes) {
  const raw = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  // jsPDF writes each shown line as "(text) Tj" on a line of its own.
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("(") && line.endsWith(") Tj"))
    .map((line) => line.slice(1, -4).replace(/\\([\\()])/g, "$1"))
    .join("\n");
}

/** The text of a .txt, .docx or .pdf draft file. */
export async function draftFileText(bytes, format) {
  if (format === "txt") return new TextDecoder().decode(bytes);
  if (format === "docx") return docxText(bytes);
  if (format === "pdf") return pdfText(bytes);
  throw new Error(`unknown draft format ${format}`);
}

/** Text with every run of whitespace as one space: a PDF wraps its lines. */
export const flat = (text) => String(text).replace(/\s+/g, " ").trim();

/** How many times `needle` occurs in `text`, whitespace aside. */
export const occurrences = (text, needle) =>
  flat(text).split(flat(needle)).length - 1;
