/**
 * D22-1: rendering pages for the vision model opened a PDF and never closed
 * it, so each scanned document the vision fallback touched stayed resident.
 * The document and each page are released, on success and on failure, and a
 * file that cannot be read is reported as a plain read failure.
 *
 * pdf.js and the canvas are the external boundaries and are faked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fake = vi.hoisted(() => ({
  numPages: 3,
  destroyed: 0,
  cleaned: new Set(),
  failRender: null,
  failOpen: null,
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  version: "0.0.0",
  getDocument: () => ({
    destroy: async () => {
      fake.destroyed++;
    },
    promise: fake.failOpen
      ? Promise.reject(fake.failOpen)
      : Promise.resolve({
          numPages: fake.numPages,
          getPage: async (n) => ({
            cleanup: () => fake.cleaned.add(n),
            getViewport: () => ({ width: 10, height: 10 }),
            render: () => ({
              promise: fake.failRender
                ? Promise.reject(fake.failRender)
                : Promise.resolve(),
            }),
          }),
        }),
  }),
}));

const { renderPDFToImages } = await import("./documentAnalyzer");
const pdf = () => new File([new Uint8Array(8)], "generic.pdf");

beforeEach(() => {
  Object.assign(fake, {
    numPages: 3,
    destroyed: 0,
    cleaned: new Set(),
    failRender: null,
    failOpen: null,
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((name) =>
    name === "canvas"
      ? { getContext: () => ({}), toDataURL: () => "data:image/jpeg;x" }
      : realCreate(name),
  );
});

describe("renderPDFToImages: memory is released", () => {
  it("renders the pages and releases the document and each page", async () => {
    const result = await renderPDFToImages(pdf(), { maxPages: 3 });

    expect(result.images).toHaveLength(3);
    expect(result.pageCount).toBe(3);
    expect(fake.destroyed).toBe(1);
    expect([...fake.cleaned].sort()).toEqual([1, 2, 3]);
  });

  it("releases the document when a page fails to render", async () => {
    fake.failRender = new Error("render failed");

    await expect(renderPDFToImages(pdf())).rejects.toThrow(
      "Failed to render PDF",
    );
    expect(fake.destroyed).toBe(1);
  });

  it("reports a file that cannot be read plainly", async () => {
    fake.failOpen = Object.assign(
      new Error('Unexpected server response (0) while retrieving PDF "blob:x"'),
      { name: "UnexpectedResponseException" },
    );

    const failure = await renderPDFToImages(pdf()).catch((error) => error);

    expect(failure.name).toBe("FileReadError");
    expect(fake.destroyed).toBe(1);
  });
});
