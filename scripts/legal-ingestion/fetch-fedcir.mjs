#!/usr/bin/env node
/**
 * fetch-fedcir.mjs — fetch U.S. Court of Appeals for the Federal Circuit
 * opinions/orders and keep only veterans-law appeals (S33).
 *
 * Source: the court's own WordPress REST API — a plain, paginated JSON feed,
 * no headless browser needed. NOTE the host MUST be www.cafc.uscourts.gov;
 * the apex cafc.uscourts.gov fails SNI.
 *
 *   GET https://www.cafc.uscourts.gov/wp-json/wp/v2/posts
 *       ?categories=27&per_page=100&_fields=id,date,link,title,content
 *       &page=N
 *
 * categories=27 is the "Opinion-Order" category (~18.7K posts total; the
 * X-WP-Total response header carries the live count). Every post's
 * title.rendered and content.rendered together carry:
 *   - appeal number ("Appeal Number: <n>")
 *   - the originating tribunal ("Origin: <CODE>")
 *   - precedential status (title suffix)
 *   - the opinion PDF, as a site-relative href we absolutize
 *
 * Federal Circuit veterans-law appeals originate from the CAVC or, rarely,
 * the Dept of Veterans Affairs directly — Origin codes like DCT/RIT/CFC/PTO
 * are other dockets (district court, ITC, Court of Federal Claims, patent
 * office) and are dropped by isVeteransOrigin().
 *
 * By default `body` is a synopsis (no PDF fetch): title + appeal number +
 * origin + precedential + a link to the PDF. --with-pdf-text additionally
 * fetches each kept opinion's PDF and appends its extracted text — this is
 * the heavy path (one PDF download + parse per case) and is opt-in.
 *
 * Output: scripts/legal-ingestion/.work/fedcir.jsonl
 *
 * Env knobs:
 *   FEDCIR_API_URL       override the REST endpoint base (site restructure)
 *   FEDCIR_MAX_PAGES     pages to walk at 100/page (default 3 — bounded run;
 *                        a full historical crawl needs ~188 pages and is a
 *                        separate time-gated backfill job, not this sprint)
 *   FEDCIR_THROTTLE_MS   delay between page requests (default 350)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path, { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { makeRecord } from "./sanitize-html.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, ".work");

const workerPath = resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
GlobalWorkerOptions.workerSrc = new URL(`file:///${workerPath.replaceAll("\\", "/")}`).href;

const CAFC_ORIGIN = "https://www.cafc.uscourts.gov";
const FEDCIR_API_URL =
  process.env.FEDCIR_API_URL ||
  `${CAFC_ORIGIN}/wp-json/wp/v2/posts?categories=27&per_page=100&_fields=id,date,link,title,content`;
const MAX_PAGES = Number(process.env.FEDCIR_MAX_PAGES) || 3;
const THROTTLE_MS = Number(process.env.FEDCIR_THROTTLE_MS) || 350;

const USER_AGENT =
  "vet-rate-org legal-ingestion/1.0 (anthony.johnson.now@gmail.com)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ORIGIN_RE = /Origin:\s*([A-Z]+)/i;
const PDF_HREF_RE = /<a\s+href="([^"]+\.pdf)"/i;
const STATUS_RE = /^(precedential|nonprecedential)$/i;

/**
 * Parse a WordPress post title of the form
 * "25-1783: WALKER v. COLLINS [OPINION], Nonprecedential" into its parts.
 * Plain string splitting (indexOf, not a single monolithic regex) so the
 * free-text parties segment can't create regex backtracking ambiguity.
 * @param {string} title
 * @returns {{appealNumber:string, parties:string, docType:string, precedential:boolean}|null}
 */
function parseFedcirTitle(title) {
  const t = String(title || "").trim();
  const colonIdx = t.indexOf(":");
  if (colonIdx === -1) return null;
  const appealNumber = t.slice(0, colonIdx).trim();
  const rest = t.slice(colonIdx + 1).trim();

  const bracketOpen = rest.indexOf("[");
  const bracketClose = bracketOpen === -1 ? -1 : rest.indexOf("]", bracketOpen);
  if (bracketOpen === -1 || bracketClose === -1) return null;

  const parties = rest.slice(0, bracketOpen).trim();
  const docType = rest.slice(bracketOpen + 1, bracketClose).trim();
  const status = rest.slice(bracketClose + 1).replace(/^,/, "").trim();
  if (!STATUS_RE.test(status)) return null;

  return {
    appealNumber,
    parties,
    docType,
    precedential: /^precedential$/i.test(status),
  };
}

/**
 * Pull the "Origin: <CODE>" tribunal code out of a post's content.rendered.
 * @param {string} contentHtml
 * @returns {string}
 */
export function originFromContent(contentHtml) {
  const m = ORIGIN_RE.exec(String(contentHtml || ""));
  return m ? m[1] : "";
}

/**
 * Pull the opinion PDF link out of a post's content.rendered and absolutize
 * it (the REST API returns a site-relative href, e.g.
 * "/opinions-orders/25-1783.OPINION.7-15-2026_2723053.pdf").
 * @param {string} contentHtml
 * @returns {string|null}
 */
export function pdfUrlFromContent(contentHtml) {
  const m = PDF_HREF_RE.exec(String(contentHtml || ""));
  if (!m) return null;
  const href = m[1];
  return href.startsWith("http") ? href : `${CAFC_ORIGIN}${href}`;
}

/** Federal Circuit veterans-law appeals originate from the CAVC, or rarely the VA itself. */
export function isVeteransOrigin(origin) {
  return origin === "CAVC" || origin === "DVA";
}

/**
 * Normalize a page of CAFC WP-REST posts into the fetcher's working shape.
 * Posts whose title doesn't match the "<appeal#>: <PARTIES> [<TYPE>], <status>"
 * pattern (e.g. a non-opinion announcement post) are skipped.
 * @param {Array<Object>} jsonArray — raw `posts` response array
 * @returns {Array<{id:number, appealNumber:string, parties:string, docType:string, precedential:boolean, origin:string, pdfUrl:string|null, link:string, title:string, date:string}>}
 */
export function parseFedcirPosts(jsonArray) {
  const out = [];
  for (const post of Array.isArray(jsonArray) ? jsonArray : []) {
    const rawTitle = post?.title?.rendered || "";
    const parsed = parseFedcirTitle(rawTitle);
    if (!parsed) continue;
    const contentHtml = post?.content?.rendered || "";
    out.push({
      id: post.id,
      appealNumber: parsed.appealNumber,
      parties: parsed.parties,
      docType: parsed.docType,
      precedential: parsed.precedential,
      origin: originFromContent(contentHtml),
      pdfUrl: pdfUrlFromContent(contentHtml),
      link: post.link || "",
      title: rawTitle,
      date: post.date || "",
    });
  }
  return out;
}

/**
 * Reporter-style citation for a Federal Circuit veterans-law case parsed from
 * its post title. Federal Circuit posts don't carry the F.3d/F.4th reporter
 * cite (that lags publication) — this is a neutral docket citation.
 * @param {string} title — raw post title.rendered
 * @param {number|string} year
 * @returns {string}
 */
export function citationFromFedcirTitle(title, year) {
  const parsed = parseFedcirTitle(title);
  const parties = parsed ? parsed.parties : String(title || "").trim();
  const appealNumber = parsed ? parsed.appealNumber : "unknown";
  return `${parties}, No. ${appealNumber} (Fed. Cir. ${year})`;
}

/**
 * Extract full opinion text from a downloaded PDF's raw bytes, using the same
 * pdfjs-dist legacy Node build + worker setup proven in scripts/ingest-cfile.mjs.
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

async function fetchPage(page) {
  const url = `${FEDCIR_API_URL}&page=${page}`;
  console.log(`[fedcir] GET ${url}`);
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    // WP-REST returns 400 once page exceeds the total — that's the normal
    // end-of-pagination signal, not a failure, for any page after the first.
    if (page > 1) return null;
    throw new Error(`fedcir ${url} → HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchAllPosts() {
  const posts = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const json = await fetchPage(page);
    if (!json || !Array.isArray(json) || json.length === 0) break;
    posts.push(...json);
    if (page < MAX_PAGES) await sleep(THROTTLE_MS);
  }
  return posts;
}

async function withPdfText(bodyText, pdfUrl) {
  console.log(`[fedcir] fetching PDF text: ${pdfUrl}`);
  const res = await fetch(pdfUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    console.warn(`[fedcir] PDF fetch failed (${res.status}) for ${pdfUrl}, keeping synopsis only`);
    return bodyText;
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const pdfText = await extractPdfText(buf);
  return `${bodyText}\n\n${pdfText}`;
}

async function main() {
  mkdirSync(WORK_DIR, { recursive: true });
  const withPdf = process.argv.includes("--with-pdf-text");

  const rawPosts = await fetchAllPosts();
  if (rawPosts.length === 0) {
    throw new Error(
      "Federal Circuit REST API returned ZERO posts — endpoint or category id may have changed",
    );
  }
  console.log(`[fedcir] ${rawPosts.length} Opinion-Order posts fetched`);

  const parsed = parseFedcirPosts(rawPosts);
  const veteransCases = parsed.filter((p) => isVeteransOrigin(p.origin));
  console.log(
    `[fedcir] ${parsed.length} parsed; ${veteransCases.length} veterans-origin (CAVC/DVA)`,
  );

  const records = [];
  for (const c of veteransCases) {
    const year = String(c.date || "").slice(0, 4) || "n.d.";
    let body =
      `${c.title}\n` +
      `Appeal Number: ${c.appealNumber}\n` +
      `Origin: ${c.origin}\n` +
      `Precedential: ${c.precedential}\n` +
      `Full opinion PDF: ${c.pdfUrl || "unavailable"}`;
    if (withPdf && c.pdfUrl) {
      body = await withPdfText(body, c.pdfUrl);
      await sleep(THROTTLE_MS);
    }
    records.push(
      await makeRecord({
        source: "fedcir",
        jurisdiction: "court",
        citation: citationFromFedcirTitle(c.title, year),
        title: c.parties,
        body,
        source_url: c.link,
      }),
    );
  }

  const out = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const outPath = path.join(WORK_DIR, "fedcir.jsonl");
  writeFileSync(outPath, out);
  const rel = path.relative(path.resolve(__dirname, "..", ".."), outPath);
  console.log(`[fedcir] wrote ${records.length} veterans-case records → ${rel}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[fedcir] FAILED: ${e.message}`);
    process.exit(1);
  });
}
