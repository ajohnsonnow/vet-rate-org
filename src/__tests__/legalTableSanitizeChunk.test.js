import { describe, it, expect } from "vitest";
import { sanitizeLegalHtml } from "../../scripts/legal-ingestion/sanitize-html.mjs";
import {
  chunkRecord,
  segmentBody,
  packProse,
} from "../../scripts/legal-ingestion/chunk.mjs";

/**
 * S19 - table-aware sanitization + structural chunking.
 *
 * sanitize-html.mjs had zero dedicated tests. This suite covers (a) the
 * pre-S19 baseline security behavior as regression protection, (b) the new
 * table -> Markdown conversion, (c) adversarial table+injection combinations
 * (a `<td>` is a new content-carrier surface), and (d) the structural chunker
 * (atomic tables, paragraph packing, oversized-paragraph 15% overlap fallback).
 */

const rec = (body, over = {}) => ({
  source: "ecfr",
  jurisdiction: "federal",
  citation: "38 CFR § 4.99",
  title: "Test section",
  body,
  fetched_at: "2026-01-01T00:00:00Z",
  source_url: "https://www.ecfr.gov/current/title-38/x",
  content_hash: "sha256:parent",
  ...over,
});

// A chunk is a "table chunk" when every one of its lines is a Markdown table
// line and there are at least two of them.
const isPipe = (line) => line.trimStart().startsWith("|");
const isTableChunk = (text) => {
  const lines = text.split("\n");
  return lines.length >= 2 && lines.every(isPipe);
};
const hasAnyPipeLine = (text) => text.split("\n").some(isPipe);
const words = (text) => text.match(/\S+/g) || [];

// ─────────────────────────────────────────────────────────────────────────
// (a) Pre-S19 baseline security behavior - regression protection.
// ─────────────────────────────────────────────────────────────────────────
describe("sanitizeLegalHtml - baseline security (regression)", () => {
  it("returns empty string for non-string / empty input", () => {
    expect(sanitizeLegalHtml("")).toBe("");
    expect(sanitizeLegalHtml(null)).toBe("");
    expect(sanitizeLegalHtml(undefined)).toBe("");
    expect(sanitizeLegalHtml(42)).toBe("");
  });

  it("strips <script> tags AND their bodies", () => {
    const out = sanitizeLegalHtml("<p>keep</p><script>alert('x')</script>");
    expect(out).toContain("keep");
    expect(out).not.toMatch(/script|alert/i);
  });

  it("strips <style> tags AND their bodies", () => {
    const out = sanitizeLegalHtml("<style>.a{color:red}</style>body");
    expect(out).toContain("body");
    expect(out).not.toMatch(/color:red|<style/i);
  });

  it("strips <iframe> tags AND their bodies", () => {
    const out = sanitizeLegalHtml("<iframe src='evil'>frame</iframe>text");
    expect(out).toContain("text");
    expect(out).not.toMatch(/iframe|evil/i);
  });

  it("strips inline event handlers", () => {
    const out = sanitizeLegalHtml('<div onclick="steal()">content</div>');
    expect(out).toContain("content");
    expect(out).not.toMatch(/onclick|steal/i);
  });

  it("decodes named and numeric HTML entities", () => {
    const out = sanitizeLegalHtml("A &amp; B &sect;4.25 &#39;q&#39; &#x41;");
    expect(out).toContain("A & B");
    expect(out).toContain("§4.25");
    expect(out).toContain("'q'");
    expect(out).toContain("A"); // &#x41; -> A
  });

  it("replaces non-gov URLs with [external-link] but preserves gov URLs", () => {
    const out = sanitizeLegalHtml(
      "see https://evil.example.com/x and https://www.va.gov/disability",
    );
    expect(out).toContain("[external-link]");
    expect(out).not.toContain("evil.example.com");
    expect(out).toContain("https://www.va.gov/disability");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// (b) New table -> Markdown conversion.
// ─────────────────────────────────────────────────────────────────────────
describe("sanitizeLegalHtml - table -> Markdown", () => {
  it("converts a simple table to pipe rows with a header separator", () => {
    const out = sanitizeLegalHtml(
      "<table><thead><tr><th>Code</th><th>Rating</th></tr></thead>" +
        "<tbody><tr><td>5000</td><td>100</td></tr></tbody></table>",
    );
    const lines = out.split("\n").filter(Boolean);
    expect(lines).toContain("| Code | Rating |");
    expect(lines).toContain("| --- | --- |");
    expect(lines).toContain("| 5000 | 100 |");
  });

  it("preserves the caption as a leading table row (stays atomic)", () => {
    const out = sanitizeLegalHtml(
      "<table><caption>Table I-Combined Ratings</caption>" +
        "<tr><td>a</td><td>b</td></tr></table>",
    );
    expect(out.split("\n")[0]).toBe("| Table I-Combined Ratings |");
    expect(isTableChunk(out)).toBe(true);
  });

  it("fences adjacent tables with a blank line so they don't merge", () => {
    const out = sanitizeLegalHtml(
      "<table><tr><td>t1</td></tr></table><table><tr><td>t2</td></tr></table>",
    );
    // A blank line between the two tables => two blocks for the chunker.
    expect(out).toContain("\n\n");
    const blocks = segmentBody(out);
    expect(blocks.filter((b) => b.type === "table")).toHaveLength(2);
    expect(out.indexOf("t1")).toBeLessThan(out.indexOf("t2"));
  });

  it("keeps table cell text content intact", () => {
    const out = sanitizeLegalHtml(
      "<table><tr><td>Osteomyelitis of the pelvis</td><td>100</td></tr>" +
        "<tr><td>Frequent episodes</td><td>60</td></tr></table>",
    );
    expect(out).toContain("Osteomyelitis of the pelvis");
    expect(out).toContain("Frequent episodes");
    expect(out).toContain("| 100 |");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// (c) Adversarial: a table cell is a new injection-carrier surface. Every
//     control that applied to prose must still apply inside <td>/<th>.
// ─────────────────────────────────────────────────────────────────────────
describe("sanitizeLegalHtml - adversarial table cells", () => {
  const clean = (s) =>
    !/script|onclick|onerror|alert\(|evil\.com|<style/i.test(s);

  it("neutralizes a <script> inside a table cell, keeping the safe text", () => {
    const out = sanitizeLegalHtml(
      "<table><tr><td><script>alert(1)</script>cellA</td></tr></table>",
    );
    expect(clean(out)).toBe(true);
    expect(out).toContain("cellA");
  });

  it("strips an event handler on a <td>", () => {
    const out = sanitizeLegalHtml(
      '<table><tr><td onclick="evil()">cellB</td></tr></table>',
    );
    expect(clean(out)).toBe(true);
    expect(out).toContain("cellB");
  });

  it("neutralizes an <img onerror> inside a cell", () => {
    const out = sanitizeLegalHtml(
      "<table><tr><td><img src=x onerror=alert(1)>txt</td></tr></table>",
    );
    expect(clean(out)).toBe(true);
    expect(out).toContain("txt");
  });

  it("strips a <style> inside a cell", () => {
    const out = sanitizeLegalHtml(
      "<table><tr><td><style>.x{}</style>keep</td></tr></table>",
    );
    expect(clean(out)).toBe(true);
    expect(out).toContain("keep");
  });

  it("replaces a non-gov URL inside a cell, preserves a gov URL", () => {
    const bad = sanitizeLegalHtml(
      "<table><tr><td>see http://evil.com/x now</td></tr></table>",
    );
    expect(clean(bad)).toBe(true);
    expect(bad).toContain("[external-link]");

    const good = sanitizeLegalHtml(
      "<table><tr><td>https://www.va.gov/foo bar</td></tr></table>",
    );
    expect(good).toContain("https://www.va.gov/foo");
  });

  it("does not let a forged </table> smuggle a script through", () => {
    const out = sanitizeLegalHtml(
      "<table><tr><td>foo</table>bar<script>x()</script></td></tr></table>",
    );
    expect(clean(out)).toBe(true);
    expect(out).not.toContain("x()");
  });

  it("escapes an encoded pipe so a cell cannot forge extra columns", () => {
    const out = sanitizeLegalHtml(
      "<table><tr><td>a&#124;b</td><td>c</td></tr></table>",
    );
    // The header row is the first data row; it must have exactly two cells
    // (three pipes), not three cells, despite the injected pipe.
    const dataRow = out.split("\n").find((l) => l.includes("a"));
    expect((dataRow.match(/(?<!\\)\|/g) || []).length).toBe(3);
    expect(dataRow).toContain("a\\|b");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// (d) Structural chunker - atomic tables.
// ─────────────────────────────────────────────────────────────────────────
describe("chunkRecord - tables are atomic (never split)", () => {
  it("keeps a large rating table as exactly ONE unsplit chunk", async () => {
    // 60-row schedule - far larger than the ~393-word prose budget, so a
    // naive word-window WOULD split it. It must not.
    const rows = Array.from(
      { length: 60 },
      (_, i) =>
        `<tr><td>DC ${5000 + i} condition</td><td>${(i % 10) * 10}</td></tr>`,
    ).join("");
    const html =
      "<p>Intro paragraph before the schedule.</p>" +
      `<table><caption>Rating schedule</caption><thead><tr><th>Code</th><th>Rating</th></tr></thead><tbody>${rows}</tbody></table>` +
      "<p>Trailing paragraph after the schedule.</p>";
    const body = sanitizeLegalHtml(html);
    const chunks = await chunkRecord(rec(body));

    const tableChunks = chunks.filter((c) => isTableChunk(c.text));
    expect(tableChunks).toHaveLength(1); // 100% survival as a single chunk

    const table = tableChunks[0].text;
    // All 60 diagnostic codes present in that ONE chunk -> not split.
    const dcCount = (table.match(/DC \d{4} condition/g) || []).length;
    expect(dcCount).toBe(60);
    expect(table).toContain("DC 5000 condition");
    expect(table).toContain("DC 5059 condition");

    // No prose chunk contains any stray table line (zero mid-table bleed).
    for (const c of chunks) {
      if (isTableChunk(c.text)) continue;
      expect(hasAnyPipeLine(c.text)).toBe(false);
    }
  });

  it("emits two adjacent tables as two separate atomic chunks", async () => {
    const html =
      "<table><tr><th>h1</th></tr><tr><td>alpha</td></tr></table>" +
      "<table><tr><th>h2</th></tr><tr><td>beta</td></tr></table>";
    const body = sanitizeLegalHtml(html);
    const chunks = await chunkRecord(rec(body));
    const tableChunks = chunks.filter((c) => isTableChunk(c.text));
    expect(tableChunks).toHaveLength(2);
    expect(tableChunks.some((c) => c.text.includes("alpha"))).toBe(true);
    expect(tableChunks.some((c) => c.text.includes("beta"))).toBe(true);
    // alpha and beta never share a chunk.
    expect(
      chunks.some((c) => c.text.includes("alpha") && c.text.includes("beta")),
    ).toBe(false);
  });

  it("preserves the chunk record schema on every chunk", async () => {
    const body = sanitizeLegalHtml(
      "<p>Some prose.</p><table><tr><th>a</th></tr><tr><td>b</td></tr></table>",
    );
    const record = rec(body);
    const chunks = await chunkRecord(record);
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c).toMatchObject({
        source: record.source,
        jurisdiction: record.jurisdiction,
        citation: record.citation,
        title: record.title,
        source_url: record.source_url,
        parent_hash: record.content_hash,
      });
      expect(c.id).toMatch(/^ecfr_38_CFR_§_4\.99_\d+$/);
      expect(c.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(typeof c.text).toBe("string");
      expect(c.fetched_at).toBe(record.fetched_at);
    }
  });

  it("returns [] for an empty or missing body", async () => {
    expect(await chunkRecord(rec(""))).toEqual([]);
    expect(await chunkRecord({ source: "ecfr" })).toEqual([]);
    expect(await chunkRecord(null)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// (d) Structural chunker - prose splitting + oversized-paragraph fallback.
// ─────────────────────────────────────────────────────────────────────────
describe("chunkRecord / packProse - prose splits on paragraph boundaries", () => {
  it("packs small paragraphs without splitting a sentence", () => {
    const p1 = "First paragraph with several words in it here.";
    const p2 = "Second distinct paragraph, also short and whole.";
    const chunks = packProse(`${p1}\n${p2}`);
    // Both short paragraphs pack into one chunk, each intact.
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain(p1);
    expect(chunks[0]).toContain(p2);
  });

  it("flushes to a new chunk at a paragraph boundary when the budget fills", () => {
    const big = (label) =>
      `${label} ` + Array.from({ length: 300 }, (_, i) => `w${i}`).join(" ");
    const a = big("ALPHA");
    const b = big("BETA");
    // 300 + 300 words > 393 budget -> two chunks, split on the boundary.
    const chunks = packProse(`${a}\n${b}`);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(a); // whole paragraph, no mid-sentence cut
    expect(chunks[1]).toBe(b);
  });

  it("word-windows a single oversized paragraph with ~15% overlap", () => {
    // One 800-word paragraph (no blank lines) -> exceeds the ~393-word budget,
    // so it takes the fallback path. WORDS_PER_CHUNK = floor(512/1.3) = 393,
    // OVERLAP_WORDS = floor(77/1.3) = 59 (~15% of the window).
    const WORDS_PER_CHUNK = Math.floor(512 / 1.3); // 393
    const OVERLAP_WORDS = Math.floor(77 / 1.3); // 59
    const para = Array.from({ length: 800 }, (_, i) => `t${i}`).join(" ");
    const chunks = packProse(para);

    expect(chunks.length).toBeGreaterThan(1);
    expect(words(chunks[0]).length).toBe(WORDS_PER_CHUNK);

    // Adjacent windows overlap by exactly OVERLAP_WORDS.
    const w0 = words(chunks[0]);
    const w1 = words(chunks[1]);
    const tail = w0.slice(w0.length - OVERLAP_WORDS);
    const head = w1.slice(0, OVERLAP_WORDS);
    expect(head).toEqual(tail);
    // Overlap is ~15% of the window.
    expect(OVERLAP_WORDS / WORDS_PER_CHUNK).toBeGreaterThan(0.13);
    expect(OVERLAP_WORDS / WORDS_PER_CHUNK).toBeLessThan(0.17);
  });

  it("never splits a table even when it alone exceeds the word budget", async () => {
    // A single 500-row table >> the prose budget: still one chunk.
    const rows = Array.from(
      { length: 500 },
      (_, i) => `<tr><td>r${i}</td><td>${i}</td></tr>`,
    ).join("");
    const body = sanitizeLegalHtml(`<table>${rows}</table>`);
    const chunks = await chunkRecord(rec(body));
    const tableChunks = chunks.filter((c) => isTableChunk(c.text));
    expect(tableChunks).toHaveLength(1);
    expect((tableChunks[0].text.match(/\| r\d+ \|/g) || []).length).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// segmentBody - block classification.
// ─────────────────────────────────────────────────────────────────────────
describe("segmentBody - table vs prose classification", () => {
  it("splits a body into ordered table and prose blocks", () => {
    const body =
      "Intro prose.\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nMore prose.";
    const blocks = segmentBody(body);
    expect(blocks.map((b) => b.type)).toEqual(["prose", "table", "prose"]);
  });

  it("treats a lone pipe line as prose, not a table", () => {
    const blocks = segmentBody("a | b was mentioned in passing");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("prose");
  });
});
