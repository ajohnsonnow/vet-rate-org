#!/usr/bin/env node
/**
 * fetch-ogc.mjs — fetch VA Office of General Counsel (OGC) precedent
 * opinions (S34).
 *
 * Source: a stable, plain-fetch, two-level crawl of va.gov — no headless
 * browser, no JS-only search form:
 *
 *   LEVEL 1 landing  https://www.va.gov/ogc/precedentopinions.asp
 *     -> anchors to per-year index pages (1987–2019), href shape (case
 *        varies across eras): /OGC/opinions/2019PrecedentOpinions.asp
 *
 *   LEVEL 2 year page  https://www.va.gov/OGC/opinions/<yyyy>PrecedentOpinions.asp
 *     -> anchors to the individual opinion PDFs, e.g.
 *        <a href="/OGC/docs/2019/VAOPGCPREC2-2019.pdf">VAOPGCPREC 2-2019</a>
 *        The anchor TEXT is the citation; the href is a site-relative PDF
 *        path under /OGC/docs/<yyyy>/. Year pages also carry unrelated PDF
 *        links (VBA forms, an ethics-contacts PDF) — kept ONLY if the href
 *        matches /OGC/docs/<4-digit-year>/ AND contains "VAOPGCPREC".
 *
 * jurisdiction is "va" — OGC issues VA policy/legal-interpretation opinions,
 * not court decisions.
 *
 * By default `body` is a synopsis (no PDF fetch): citation + a link to the
 * PDF. --with-pdf-text additionally downloads each kept opinion's PDF and
 * appends its extracted text — the heavy path, opt-in.
 *
 * Output: scripts/legal-ingestion/.work/ogc.jsonl
 *
 * Env knobs:
 *   OGC_LANDING_URL    override the landing-page URL (site restructure)
 *   OGC_MAX_YEARS      year-index pages to crawl, most recent first (default
 *                      3 — bounded run; a full historical crawl covers all
 *                      ~26 years and is a separate time/compute-gated
 *                      backfill job, not this sprint)
 *   OGC_THROTTLE_MS    delay between requests (default 350)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path, { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { makeRecord } from "./sanitize-html.mjs";
import { parseOgcCitation } from "./ogc-citation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, ".work");

const workerPath = resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
GlobalWorkerOptions.workerSrc = new URL(`file:///${workerPath.replaceAll("\\", "/")}`).href;

const OGC_ORIGIN = "https://www.va.gov";
const OGC_LANDING_URL =
  process.env.OGC_LANDING_URL || `${OGC_ORIGIN}/ogc/precedentopinions.asp`;
const MAX_YEARS = Number(process.env.OGC_MAX_YEARS) || 3;
const THROTTLE_MS = Number(process.env.OGC_THROTTLE_MS) || 350;

const USER_AGENT =
  "vet-rate-org legal-ingestion/1.0 (anthony.johnson.now@gmail.com)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ANCHOR_HREF_RE = /<a\s+href="([^"]+)"/gi;
const ANCHOR_RE = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
const YEAR_HREF_RE = /(\d{4})PrecedentOpinions\.asp/i;
const YEAR_DOCS_RE = /\/OGC\/docs\/(\d{4})\//i;
const FILENAME_CITATION_RE = /VAOPGCPREC_?(\d{1,3})-(\d{2,4})/i;

/** Absolutize a site-relative va.gov href; leaves an already-absolute url alone. */
function absolutizeVaUrl(href) {
  if (/^https?:\/\//i.test(href)) return href;
  const relativeHref = href.startsWith("/") ? href : "/" + href;
  return OGC_ORIGIN + relativeHref;
}

/** Derive "VAOPGCPREC <n>-<yyyy>" from a PDF filename when the anchor text is empty. */
function citationFromFilename(href) {
  const m = FILENAME_CITATION_RE.exec(href);
  return m ? `VAOPGCPREC ${m[1]}-${m[2]}` : "";
}

/**
 * Parse the OGC landing page into its per-year index pages, most recent
 * year first (the bounded run's default `OGC_MAX_YEARS` picks off this
 * front). Dedupes by year — the same year never appears twice.
 * @param {string} html
 * @returns {Array<{year:number, url:string}>}
 */
export function parseOgcLanding(html) {
  const seen = new Map();
  ANCHOR_HREF_RE.lastIndex = 0;
  let m;
  while ((m = ANCHOR_HREF_RE.exec(String(html || "")))) {
    const href = m[1];
    const yearMatch = YEAR_HREF_RE.exec(href);
    if (!yearMatch) continue;
    const year = Number.parseInt(yearMatch[1], 10);
    if (seen.has(year)) continue;
    seen.set(year, absolutizeVaUrl(href));
  }
  return Array.from(seen, ([year, url]) => ({ year, url })).sort(
    (a, b) => b.year - a.year,
  );
}

/**
 * Parse one OGC year-index page into its precedent-opinion PDF links. Only
 * hrefs under /OGC/docs/<yyyy>/ that also contain "VAOPGCPREC" are kept —
 * that isolates real opinions from the unrelated VBA-form / ethics-contact
 * PDFs the same page links to.
 * @param {string} html
 * @returns {Array<{citation:string, pdfUrl:string, number:number, year:number}>}
 */
export function parseOgcYearPage(html) {
  const out = [];
  ANCHOR_RE.lastIndex = 0;
  let m;
  while ((m = ANCHOR_RE.exec(String(html || "")))) {
    const href = m[1];
    if (!YEAR_DOCS_RE.test(href)) continue;
    if (!/VAOPGCPREC/i.test(href)) continue;
    if (!/\.pdf$/i.test(href)) continue;

    const anchorText = m[2].replace(/\s+/g, " ").trim();
    const citation = anchorText || citationFromFilename(href);
    const parsed = parseOgcCitation(citation);
    if (!parsed) continue;

    out.push({
      citation,
      pdfUrl: absolutizeVaUrl(href),
      number: parsed.number,
      year: parsed.year,
    });
  }
  return out;
}

/**
 * Extract full opinion text from a downloaded PDF's raw bytes, using the same
 * pdfjs-dist legacy Node build + worker setup as fetch-fedcir.mjs.
 * @param {Uint8Array} uint8Array
 * @returns {Promise<string>}
 */
export async function extractPdfText(uint8Array) {
  const pdf = await getDocument({
    data: uint8Array,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(" ") + "\n\n";
  }
  return text.trim();
}

async function fetchText(url) {
  console.log(`[ogc] GET ${url}`);
  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`ogc ${url} → HTTP ${res.status}`);
  return res.text();
}

async function withPdfText(bodyText, pdfUrl) {
  console.log(`[ogc] fetching PDF text: ${pdfUrl}`);
  const res = await fetch(pdfUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    console.warn(`[ogc] PDF fetch failed (${res.status}) for ${pdfUrl}, keeping synopsis only`);
    return bodyText;
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const pdfText = await extractPdfText(buf);
  return `${bodyText}\n\n${pdfText}`;
}

async function fetchAllOpinions() {
  const landingHtml = await fetchText(OGC_LANDING_URL);
  const yearPages = parseOgcLanding(landingHtml);
  if (yearPages.length === 0) {
    throw new Error(
      "OGC landing page yielded ZERO year-index pages — page structure may have changed",
    );
  }
  console.log(`[ogc] ${yearPages.length} year-index pages found on landing`);

  const selected = yearPages.slice(0, MAX_YEARS);
  const opinions = [];
  for (const yp of selected) {
    await sleep(THROTTLE_MS);
    let html;
    try {
      html = await fetchText(yp.url);
    } catch (e) {
      console.warn(`[ogc] skipping year ${yp.year}: ${e.message}`);
      continue;
    }
    const parsed = parseOgcYearPage(html);
    console.log(`[ogc] year ${yp.year}: ${parsed.length} opinions`);
    opinions.push(...parsed);
  }
  return opinions;
}

async function main() {
  mkdirSync(WORK_DIR, { recursive: true });
  const withPdf = process.argv.includes("--with-pdf-text");

  const opinions = await fetchAllOpinions();
  if (opinions.length === 0) {
    throw new Error(
      "OGC crawl parsed ZERO opinions across the selected year pages — endpoint or markup may have changed",
    );
  }
  console.log(`[ogc] ${opinions.length} opinions parsed`);

  const records = [];
  for (const o of opinions) {
    let body = `VA OGC Precedent Opinion ${o.citation}. Full opinion PDF: ${o.pdfUrl}`;
    if (withPdf) {
      body = await withPdfText(body, o.pdfUrl);
      await sleep(THROTTLE_MS);
    }
    records.push(
      await makeRecord({
        source: "ogc",
        jurisdiction: "va",
        citation: o.citation,
        title: o.citation,
        body,
        source_url: o.pdfUrl,
      }),
    );
  }

  const out = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const outPath = path.join(WORK_DIR, "ogc.jsonl");
  writeFileSync(outPath, out);
  const rel = path.relative(path.resolve(__dirname, "..", ".."), outPath);
  console.log(`[ogc] wrote ${records.length} opinion records → ${rel}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[ogc] FAILED: ${e.message}`);
    process.exit(1);
  });
}
