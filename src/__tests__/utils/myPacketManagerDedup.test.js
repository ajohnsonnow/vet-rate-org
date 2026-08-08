/**
 * FIX-6 (packet store): re-importing the same 4 DD214 files a second time
 * previously made getAllPacketDocuments() return 43 rows instead of 39 —
 * each saveDocumentToPacket() call always minted a new `pkt_...` id, so a
 * re-import appended a duplicate row rather than updating the existing
 * one. findDuplicatePacketDocument() is the pure (fileName, fileSize)
 * lookup saveDocumentToPacket now uses to reuse the existing row's id
 * instead — same idempotency key as addDocumentToVKB's guard in
 * veteranKnowledgeBase.js.
 */
import { describe, it, expect } from "vitest";
import { findDuplicatePacketDocument } from "../../utils/myPacketManager";

const seedDoc = ({ id, fileName, fileSize, version = 1 }) => ({
  id,
  fileName,
  metadata: { fileSize },
  version,
});

describe("findDuplicatePacketDocument", () => {
  it("matches an existing document by (fileName, fileSize)", () => {
    const existing = [
      seedDoc({
        id: "pkt_1",
        fileName: "williams_dd214.pdf",
        fileSize: 240_000,
      }),
      seedDoc({ id: "pkt_2", fileName: "smith_dd214.pdf", fileSize: 180_000 }),
    ];

    const match = findDuplicatePacketDocument(
      existing,
      "williams_dd214.pdf",
      240_000,
    );

    expect(match?.id).toBe("pkt_1");
  });

  it("does not match when the fileName matches but fileSize differs (edited/re-scanned file)", () => {
    const existing = [
      seedDoc({
        id: "pkt_1",
        fileName: "williams_dd214.pdf",
        fileSize: 240_000,
      }),
    ];

    const match = findDuplicatePacketDocument(
      existing,
      "williams_dd214.pdf",
      241_500,
    );

    expect(match).toBeNull();
  });

  it("does not match when the fileSize matches but fileName differs", () => {
    const existing = [
      seedDoc({
        id: "pkt_1",
        fileName: "williams_dd214.pdf",
        fileSize: 240_000,
      }),
    ];

    const match = findDuplicatePacketDocument(
      existing,
      "doe_dd214.pdf",
      240_000,
    );

    expect(match).toBeNull();
  });

  it("returns null against an empty or missing document list", () => {
    expect(findDuplicatePacketDocument([], "a.pdf", 100)).toBeNull();
    expect(findDuplicatePacketDocument(null, "a.pdf", 100)).toBeNull();
    expect(findDuplicatePacketDocument(undefined, "a.pdf", 100)).toBeNull();
  });

  it("re-importing all 4 DD214s a second time resolves to the same 4 existing ids, not 4 new ones", () => {
    const existing = [
      seedDoc({ id: "pkt_a", fileName: "dd214_1.pdf", fileSize: 100 }),
      seedDoc({ id: "pkt_b", fileName: "dd214_2.pdf", fileSize: 200 }),
      seedDoc({ id: "pkt_c", fileName: "dd214_3.pdf", fileSize: 300 }),
      seedDoc({ id: "pkt_d", fileName: "dd214_4.pdf", fileSize: 400 }),
    ];
    const reimport = [
      { fileName: "dd214_1.pdf", fileSize: 100 },
      { fileName: "dd214_2.pdf", fileSize: 200 },
      { fileName: "dd214_3.pdf", fileSize: 300 },
      { fileName: "dd214_4.pdf", fileSize: 400 },
    ];

    const resolvedIds = reimport.map(
      (doc) =>
        findDuplicatePacketDocument(existing, doc.fileName, doc.fileSize)?.id,
    );

    expect(resolvedIds).toEqual(["pkt_a", "pkt_b", "pkt_c", "pkt_d"]);
  });
});
