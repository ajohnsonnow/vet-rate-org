/**
 * An import stamps every document it files with its own id, so a notice after
 * a hard stop can count what this import stored (and nothing filed by another
 * tool). The stamp is bookkeeping: never exported. Real stores, fake browser
 * database.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeIndexedDB } from "../__tests__/helpers/fakeIndexedDB";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.stubGlobal("indexedDB", createFakeIndexedDB().indexedDB);

const { persistFormationDocument } = await import("./musterCallProcessor");
const { addDocumentToVKB, clearVKB, loadVKB, withoutImportStamps } =
  await import("./veteranKnowledgeBase");

const file = (name, size = 2048) => ({ name, size });
const result = (type, importId) => ({
  pageCount: 1,
  text: "invented text",
  classification: { type, confidence: 90 },
  extractedData: { type },
  ...(importId && { importId }),
});

async function everyStoredDocument() {
  const vkb = await loadVKB({ fresh: true });
  return Object.values(vkb.documentation).flat();
}

describe("the import stamp on stored documents", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearVKB();
  });

  it.each(["dd214", "c_file", "blue_button", "rating_decision", "other"])(
    "one imported %s file is one stored entry, carrying the import id",
    async (type) => {
      const name = `invented-${type}.pdf`;
      await persistFormationDocument(file(name), result(type, "import-a"));

      const docs = (await everyStoredDocument()).filter(
        (d) => d.fileName === name,
      );

      expect(docs).toHaveLength(1);
      expect(docs[0].importId).toBe("import-a");
    },
  );

  it("leaves a document filed by anything else unstamped", async () => {
    await persistFormationDocument(file("elsewhere.pdf"), result("other"));
    await addDocumentToVKB({
      fileName: "direct.pdf",
      fileSize: 10,
      classification: "other",
    });

    const docs = await everyStoredDocument();

    expect(docs).toHaveLength(2);
    expect(docs.every((d) => d.importId === undefined)).toBe(true);
  });

  it("files the same document imported again once, stamped by the latest import", async () => {
    await persistFormationDocument(file("again.pdf"), result("other", "first"));
    await persistFormationDocument(
      file("again.pdf"),
      result("other", "second"),
    );

    const docs = await everyStoredDocument();

    expect(docs).toHaveLength(1);
    expect(docs[0].importId).toBe("second");
  });

  it("keeps the stamp when the same document is saved again without one", async () => {
    await persistFormationDocument(file("kept.pdf"), result("other", "first"));
    await persistFormationDocument(file("kept.pdf"), result("other"));

    const docs = await everyStoredDocument();

    expect(docs).toHaveLength(1);
    expect(docs[0].importId).toBe("first");
  });

  it("ignores an id that is not a non-empty string", async () => {
    await addDocumentToVKB({
      fileName: "odd.pdf",
      fileSize: 1,
      classification: "other",
      importId: { toString: () => "x" },
    });

    expect((await everyStoredDocument())[0]).not.toHaveProperty("importId");
  });
});

describe("the import stamp is read back and kept out of exports", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearVKB();
  });

  it("is counted by the real notice, which sees only this import's documents", async () => {
    vi.resetModules();
    const page = await import("./importProgressMarker");
    page.startImportMarker(["document 1", "document 2", "document 3"]);
    const id = page.activeImportId();
    await persistFormationDocument(file("one.pdf"), result("other", id));
    await persistFormationDocument(file("unrelated.pdf"), result("other"));
    await persistFormationDocument(
      file("someone-elses.pdf"),
      result("other", "another-import"),
    );
    const key = `${page.IMPORT_MARKER_KEY_PREFIX}${id}`;
    const marker = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(
      key,
      JSON.stringify({
        ...marker,
        owner: "gone",
        started: 0,
        heartbeat: 0,
        saved: 2,
      }),
    );
    vi.resetModules();
    const restarted = await import("./importProgressMarker");

    expect(await restarted.findInterruptedImport()).toMatchObject({
      saved: 1,
      total: 3,
    });
  });

  it("is removed from an export of the knowledge base", async () => {
    await persistFormationDocument(file("exported.pdf"), result("dd214", "x"));
    const vkb = await loadVKB({ fresh: true });

    const exported = JSON.stringify(withoutImportStamps(vkb));

    expect(JSON.stringify(vkb)).toContain("importId");
    expect(exported).not.toContain("importId");
    expect(exported).toContain("exported.pdf");
  });
});
