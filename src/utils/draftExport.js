/**
 * Vet-Rate.org - one draft, every format
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * A writing tool has one draft: the text on screen, with the veteran's
 * edits. Copy, each download format and Save to Packet all carry that text
 * and nothing else. These build the three file formats from it. A file may
 * open with a short `banner` the tool passes (a "draft, not yet signed"
 * line); the body is the draft, line for line.
 */
import { Document, Packer, Paragraph, TextRun } from "docx";
import jsPDF from "jspdf";
import { triggerBlobDownload } from "./sanitize";

export const DRAFT_FORMATS = ["txt", "docx", "pdf"];

const MIME = {
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

const withBanner = (text, banner) =>
  banner ? `${banner}\n\n${text}` : String(text ?? "");

async function docxBytes(text) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: text.split("\n").map(
          (line) =>
            new Paragraph({
              children: [new TextRun({ text: line, size: 22 })],
              spacing: { after: 80 },
            }),
        ),
      },
    ],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}

function pdfBytes(text) {
  const pdf = new jsPDF();
  const margin = 15;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  let y = 20;
  pdf.setFontSize(10);
  for (const line of pdf.splitTextToSize(text, maxWidth)) {
    if (y > pageHeight - 20) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(line, margin, y);
    y += 5;
  }
  return new Uint8Array(pdf.output("arraybuffer"));
}

/**
 * The bytes of `text` as a .txt, .docx or .pdf file.
 * @param {string} text the draft as shown on screen
 * @param {"txt"|"docx"|"pdf"} format
 * @param {{ banner?: string }} [options]
 * @returns {Promise<Uint8Array>}
 */
export async function draftFileBytes(text, format, { banner } = {}) {
  const body = withBanner(text, banner);
  if (format === "txt") return new TextEncoder().encode(body);
  if (format === "docx") return docxBytes(body);
  if (format === "pdf") return pdfBytes(body);
  throw new Error(`unknown draft format ${format}`);
}

/**
 * Build the file and hand it to the browser as a download. Rejects when the
 * file cannot be built or the download cannot start; the caller says so and
 * keeps the draft on screen.
 */
export async function downloadDraft(text, fileName, format, options) {
  const bytes = await draftFileBytes(text, format, options);
  const name = `${fileName}.${format}`;
  const started = triggerBlobDownload(
    new Blob([bytes], { type: MIME[format] }),
    name,
  );
  if (!started) throw new Error(`the ${format} download could not start`);
  return { bytes, fileName: name };
}
