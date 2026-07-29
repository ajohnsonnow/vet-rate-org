/**
 * ogc-citation.mjs — parse a VA General Counsel precedent-opinion citation and
 * derive its canonical source URL (S34).
 *
 * VA OGC precedent opinions are cited "VAOPGCPREC <n>-<yy|yyyy>" (e.g.
 * "VAOPGCPREC 3-97", "VAOPGCPREC 27-2003"). The published archive is a stable
 * two-level site under https://www.va.gov/ogc/:
 *   landing   precedentopinions.asp
 *   per-year  /OGC/opinions/<yyyy>PrecedentOpinions.asp   (1987–2019)
 *   opinion   /OGC/docs/<yyyy>/VAOPGCPREC<n>-<yyyy>.pdf   (filename shape
 *             varies across eras — PREC_n-yy.pdf / PRECn-yy.pdf also occur)
 *
 * WHY THIS EXISTS: 468 of the 891 offline-corpus OGC entries have an EMPTY url,
 * so build-shard.mjs's accuracy floor (S28: skip + count url-less entries) would
 * silently drop more than half the OGC corpus. We rescue them by backfilling a
 * canonical url derived from the citation. We deliberately backfill the per-YEAR
 * INDEX page (always valid, verified live) rather than construct a direct PDF
 * url — the PDF filename shape is not uniform across 1987–2019, so a constructed
 * PDF url would be a guess (a 404 risk), whereas the year-index page reliably
 * lists that year's opinions. Honest, verifiable citation over a fabricated one.
 */

const CITATION_RE = /VAOPGCPREC\s*(\d{1,3})\s*[-–]\s*(\d{2,4})/i;
const OGC_BASE = "https://www.va.gov";

// The published precedent-opinion archive runs 1987–2019; allow a little slack
// so a fresh opinion isn't rejected, but reject clearly-malformed source years
// (e.g. a "n-800" typo) rather than emit a fabricated year-index url.
const OGC_MIN_YEAR = 1987;
const OGC_MAX_YEAR = 2025;

/**
 * Normalize a 2- or 4-digit OGC year to a full, plausible year. Precedent
 * opinions span 1987–2019, so a 2-digit year 87–99 is 19xx and 00–19 (…–86) is
 * 20xx. Returns null for a year outside the plausible archive range.
 * @param {string|number} raw
 * @returns {number|null}
 */
export function normalizeOgcYear(raw) {
  const n = Number.parseInt(String(raw), 10);
  if (Number.isNaN(n)) return null;
  let year;
  if (n >= 1000) year = n; // already 4-digit
  else if (n >= 87) year = 1900 + n;
  else if (n <= 25) year = 2000 + n; // reject 3-digit / implausible 2-digit
  else return null;
  return year >= OGC_MIN_YEAR && year <= OGC_MAX_YEAR ? year : null;
}

/**
 * Parse "VAOPGCPREC <n>-<year>" into its number and full year.
 * @param {string} citation
 * @returns {{number:number, year:number}|null}
 */
export function parseOgcCitation(citation) {
  const m = CITATION_RE.exec(String(citation || ""));
  if (!m) return null;
  const year = normalizeOgcYear(m[2]);
  if (year === null) return null;
  return { number: Number.parseInt(m[1], 10), year };
}

/**
 * Canonical per-year index URL for an opinion's citation — the verified-stable
 * page that lists that year's precedent opinions.
 * @param {string} citation
 * @returns {string|null}
 */
export function ogcYearIndexUrl(citation) {
  const parsed = parseOgcCitation(citation);
  if (!parsed) return null;
  return `${OGC_BASE}/OGC/opinions/${parsed.year}PrecedentOpinions.asp`;
}

const GOV_HOST_RE = /^https?:\/\/(?:[^/]+\.)?va\.gov\//i;

/**
 * The citation text for a corpus OGC entry. ~half the corpus leaves `citation`
 * empty but carries the "VAOPGCPREC n-yyyy" string in `title` instead — fall
 * back to it so those entries still resolve a year and canonical url.
 * @param {{citation?:string, title?:string}} entry
 * @returns {string}
 */
export function ogcCitationText(entry) {
  const cite = String(entry?.citation || "").trim();
  if (CITATION_RE.test(cite)) return cite;
  const title = String(entry?.title || "").trim();
  return CITATION_RE.test(title) ? title : cite;
}

/**
 * Resolve the best available source URL for a corpus OGC entry: keep a real
 * va.gov url if the entry already has one, otherwise backfill the canonical
 * year-index url from the citation (or title). Falls back to the archive
 * landing page when neither parses, so an entry is never dropped for a missing
 * url.
 * @param {{url?:string, citation?:string, title?:string}} entry
 * @returns {string}
 */
export function ogcCanonicalUrl(entry) {
  const url = String(entry?.url || "").trim();
  if (GOV_HOST_RE.test(url)) return url;
  return (
    ogcYearIndexUrl(ogcCitationText(entry)) ||
    `${OGC_BASE}/ogc/precedentopinions.asp`
  );
}
