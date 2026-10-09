/**
 * bvaAuthorityTagging - authority metadata for Board of Veterans' Appeals (BVA)
 * decisions (S32).
 *
 * LEGAL FOUNDATION (the whole reason this module exists):
 * Under 38 CFR § 20.1303, Board decisions are **non-precedential** - "binding
 * only with regard to the specific case decided." Prior Board decisions "may be
 * considered … to the extent that they reasonably relate," but each appeal is
 * decided on its own facts. There is therefore NO "precedential BVA decision"
 * category to infer: every one of the 116,209 BVA entries is non-precedential
 * as a matter of law. Guessing a precedential/non-precedential split (as if it
 * were a per-decision property) would be legally wrong and dangerous - it could
 * present a single-judge, fact-bound decision as binding authority.
 *
 * So this module does two things, both defensible:
 *   1. Affirms non-precedential status UNIFORMLY (precedential:false,
 *      binding:false, confidence 1.0) with the regulation as the citable basis.
 *      This IS the S32 guarantee "never let a non-precedential entry render as
 *      binding authority" - enforced in the data, unit-asserted, not left to
 *      the model.
 *   2. Computes a `citation_weight` ∈ [0,1] - a PERSUASIVE-value ranking signal,
 *      NOT authority. A high weight still never makes a BVA decision binding; it
 *      only means "rank this persuasive example above that one." Signals: how
 *      recent the decision is (current-law decisions are more reliable), whether
 *      it grounds itself in binding authority (CAVC/Fed. Cir./CFR/USC), its
 *      disposition, and its substance.
 *
 * Every retrieved BVA chunk carries BVA_CAVEAT so the answerer/UI can surface
 * the non-binding nature at citation time.
 *
 * Pure functions, no deps - build-time (build-bva-shard.mjs bakes these fields
 * into each shard chunk) and runtime importable, and fully unit-testable.
 */

/** The regulation that makes every Board decision non-precedential. */
export const BVA_AUTHORITY_BASIS = "38 CFR § 20.1303";

/** Caveat surfaced wherever a BVA decision is cited. */
export const BVA_CAVEAT =
  "Board of Veterans' Appeals decisions are non-precedential (38 CFR § 20.1303) - " +
  "persuasive only, binding solely in the specific case decided, never binding authority in another claim.";

// Recency is scored relative to the span of BVA's online record (from 1992,
// when vetapp postings begin, to a fixed reference year). A constant reference
// year keeps citation_weight deterministic and test-stable - it is NOT wall
// clock; bump it deliberately when re-baselining, don't wire it to Date.now().
export const BVA_ONLINE_START_YEAR = 1992;
export const BVA_REFERENCE_YEAR = 2026;

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/**
 * Decision year from the va.gov vetapp URL (most reliable), e.g.
 * ".../vetapp25/Files1/19167246.txt" → 2025. vetapp92-99 map to 1992-1999,
 * vetapp00-91 map to 2000-2091. Returns null if no vetapp segment is present.
 * @param {string} url
 * @returns {number|null}
 */
export function parseDecisionYear(url) {
  const m = /vetapp(\d{2})\b/i.exec(String(url || ""));
  if (!m) return null;
  const yy = Number(m[1]);
  return yy >= 92 ? 1900 + yy : 2000 + yy;
}

/**
 * Disposition of the decision. Prefers the corpus title marker
 * ("BVA DENIED"/"BVA GRANTED"/…), falls back to ORDER-line language in the
 * body. "mixed" when both grant and denial language appear.
 * @param {string} title
 * @param {string} content
 * @returns {"granted"|"denied"|"remanded"|"mixed"|"unknown"}
 */
export function parseDisposition(title, content) {
  const t = String(title || "").toUpperCase();
  if (/BVA\s+GRANTED/.test(t)) return "granted";
  if (/BVA\s+DENIED/.test(t)) return "denied";
  if (/BVA\s+REMAND/.test(t)) return "remanded";

  const c = String(content || "").toLowerCase();
  const granted = /\bis granted\b|\bare granted\b|\bgranted\.\b/.test(c);
  const denied = /\bis denied\b|\bare denied\b|\bdenied\.\b/.test(c);
  const remanded = /\bis remanded\b|\bremanded\b/.test(c);
  if (granted && denied) return "mixed";
  if (granted) return "granted";
  if (denied) return "denied";
  if (remanded) return "remanded";
  return "unknown";
}

/**
 * Whether the decision grounds itself in BINDING authority (statute, regulation,
 * or a court of record). A BVA decision that reasons from binding authority is
 * more persuasive than a bare fact-application. Not authority itself - a signal.
 * @param {string} content
 * @returns {boolean}
 */
export function citesBindingAuthority(content) {
  const c = String(content || "");
  return (
    /\bVet\.?\s?App\.?/i.test(c) || // CAVC (… Vet. App. …)
    /\bF\.\s?(?:2d|3d|4th)\b/i.test(c) || // Federal Reporter (Fed. Cir. etc.)
    /\bFed\.?\s?Cir\.?/i.test(c) ||
    /\b\d+\s?C\.?F\.?R\.?/i.test(c) || // 38 C.F.R. …
    /\b\d+\s?U\.?S\.?C\.?/i.test(c) // 38 U.S.C. …
  );
}

/**
 * Persuasive-value weight ∈ [0,1] for ranking BVA examples against one another.
 * Deterministic and documented - NOT authority. Weights: recency 0.30, grounded
 * -in-binding-authority 0.20, disposition up to 0.10, substance 0.05, base 0.35.
 * @param {{year:(number|null), citesBinding:boolean, disposition:string, contentLength:number}} p
 * @returns {number}
 */
export function citationWeight({
  year,
  citesBinding,
  disposition,
  contentLength,
}) {
  let w = 0.35;
  if (year) {
    const span = BVA_REFERENCE_YEAR - BVA_ONLINE_START_YEAR;
    w += clamp01((year - BVA_ONLINE_START_YEAR) / span) * 0.3;
  }
  if (citesBinding) w += 0.2;
  if (disposition === "granted") w += 0.1;
  else if (disposition === "mixed") w += 0.05;
  w += clamp01((Number(contentLength) || 0) / 4000) * 0.05;
  return Number(clamp01(w).toFixed(4));
}

/**
 * Full authority tag for one BVA corpus entry. The non-precedential fields are
 * INVARIANT (never inferred): every BVA decision is non-precedential and
 * non-binding per 38 CFR § 20.1303. Only citation_weight and the descriptive
 * fields vary per entry.
 * @param {Object} entry - corpus BVA entry ({title, content, url, ...})
 * @returns {Object} authority tag to bake into the shard chunk
 */
export function tagBvaEntry(entry) {
  const content = String(entry?.content || entry?.text || "");
  const year = parseDecisionYear(entry?.url);
  const disposition = parseDisposition(entry?.title, content);
  const citesBinding = citesBindingAuthority(content);
  return {
    // Invariant authority facts (the guarantee) - identical for every BVA entry.
    precedential: false,
    binding: false,
    precedential_confidence: 1.0,
    authority_basis: BVA_AUTHORITY_BASIS,
    caveat: BVA_CAVEAT,
    // Per-entry persuasive/descriptive metadata.
    disposition,
    decision_year: year,
    cites_binding_authority: citesBinding,
    citation_weight: citationWeight({
      year,
      citesBinding,
      disposition,
      contentLength: content.length,
    }),
  };
}
