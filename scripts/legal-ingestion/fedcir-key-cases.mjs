/**
 * fedcir-key-cases.mjs — curated seed of load-bearing U.S. Court of Appeals for
 * the Federal Circuit veterans-law precedents (S33).
 *
 * WHY A SEED LIST: the live CAFC fetcher (fetch-fedcir.mjs) pulls the court's
 * WordPress REST archive and filters to veterans-origin appeals (Origin: CAVC /
 * DVA). That archive is authoritative for recent opinions but does not reliably
 * surface the *reporter* citation (F.3d / F.4th) a VSO actually cites, and the
 * oldest landmark opinions predate the site's post archive. This module fills
 * that gap with a hand-verified list of the veterans-law opinions the rest of
 * the app most needs to reason about — each with its canonical reporter
 * citation. These are heavily-cited, well-documented precedents; the citation
 * strings here are the canonical reporter cites, not model-guessed values.
 *
 * ACCURACY DISCIPLINE (CLAUDE.md 2.11): only cases whose reporter citation is
 * well-established are listed. The sprint plan named "Procopio, Kirkpatrick,
 * Martin" as examples — Procopio and Martin are included; "Kirkpatrick" is
 * deliberately OMITTED because a load-bearing Federal Circuit veterans-law
 * "Kirkpatrick" precedent could not be citation-verified, and a fabricated
 * citation is worse than an honest gap. Add it later only with a verified cite.
 *
 * Each seed becomes a shard entry (judicial_federal_circuit tier) via
 * build-fedcir-shard.mjs, merged with (and de-duplicated against) the
 * live-fetched records so the shard always covers these anchors even before a
 * full historical backfill runs.
 *
 * source_url uses the court's real WordPress search endpoint
 * (https://www.cafc.uscourts.gov/?s=…), which resolves to the opinion and is on
 * the sanitize-html gov allow-list. `appeal_number` is left null where it was
 * not verified rather than guessed.
 */

/**
 * @typedef {Object} KeyCase
 * @property {string} name         Short v.-style case name
 * @property {string} citation     Canonical reporter citation
 * @property {number} year         Decision year
 * @property {boolean} en_banc     Whether decided en banc
 * @property {string} holding      One-sentence load-bearing holding
 * @property {string[]} topics     Retrieval keywords
 * @property {string|null} appeal_number  Fed. Cir. docket if verified, else null
 */

/** @type {KeyCase[]} */
export const FEDCIR_KEY_CASES = [
  {
    name: "Procopio v. Wilkie",
    citation: "913 F.3d 1371 (Fed. Cir. 2019)",
    year: 2019,
    en_banc: true,
    holding:
      "The territorial sea of the Republic of Vietnam is part of its landmass, so 'Blue Water Navy' veterans who served in Vietnam's territorial waters are entitled to the Agent Orange presumption of exposure under 38 U.S.C. § 1116; overruled Haas v. Peake.",
    topics: ["agent orange", "herbicide presumption", "blue water navy", "1116", "vietnam"],
    appeal_number: null,
  },
  {
    name: "Haas v. Peake",
    citation: "525 F.3d 1168 (Fed. Cir. 2008)",
    year: 2008,
    en_banc: false,
    holding:
      "Required actual presence on Vietnam's landmass or inland waterways for the Agent Orange presumption; effectively superseded for territorial-waters service by Procopio (2019) and the Blue Water Navy Vietnam Veterans Act of 2019.",
    topics: ["agent orange", "herbicide presumption", "blue water navy", "vietnam", "superseded"],
    appeal_number: null,
  },
  {
    name: "Buchanan v. Nicholson",
    citation: "451 F.3d 1331 (Fed. Cir. 2006)",
    year: 2006,
    en_banc: false,
    holding:
      "The Board may not reject competent lay evidence of continuity of symptomatology solely because it is not corroborated by contemporaneous medical records.",
    topics: ["lay evidence", "continuity of symptomatology", "credibility", "nexus"],
    appeal_number: null,
  },
  {
    name: "Jandreau v. Nicholson",
    citation: "492 F.3d 1372 (Fed. Cir. 2007)",
    year: 2007,
    en_banc: false,
    holding:
      "Lay evidence can be competent to establish a diagnosis when the layperson is reporting a contemporaneous medical diagnosis, describes symptoms later supported by a medical diagnosis, or the condition is one a layperson can identify.",
    topics: ["lay evidence", "competency", "diagnosis", "nexus"],
    appeal_number: null,
  },
  {
    name: "Hodge v. West",
    citation: "155 F.3d 1356 (Fed. Cir. 1998)",
    year: 1998,
    en_banc: false,
    holding:
      "Invalidated the Colvin 'reasonable possibility of changing the outcome' test for new and material evidence; the regulatory 38 C.F.R. § 3.156(a) standard governs reopening a claim.",
    topics: ["new and material evidence", "reopen claim", "3.156", "finality"],
    appeal_number: null,
  },
  {
    name: "Wagner v. Principi",
    citation: "370 F.3d 1089 (Fed. Cir. 2004)",
    year: 2004,
    en_banc: false,
    holding:
      "When no condition was noted at entry, the presumption of soundness places on the government the burden to rebut it by clear and unmistakable evidence of both preexistence and non-aggravation.",
    topics: ["presumption of soundness", "aggravation", "1111", "burden of proof"],
    appeal_number: null,
  },
  {
    name: "Roberson v. Principi",
    citation: "251 F.3d 1378 (Fed. Cir. 2001)",
    year: 2001,
    en_banc: false,
    holding:
      "VA must give a sympathetic reading to a pro se veteran's filings and develop all claims reasonably raised by the record, including total disability based on individual unemployability (TDIU).",
    topics: ["tdiu", "sympathetic reading", "pro se", "claim development"],
    appeal_number: null,
  },
  {
    name: "Comer v. Peake",
    citation: "552 F.3d 1362 (Fed. Cir. 2009)",
    year: 2009,
    en_banc: false,
    holding:
      "A request for TDIU is not a separate claim but part of any claim for a higher disability rating when unemployability is reasonably raised; VA must consider it even for a pro se claimant.",
    topics: ["tdiu", "increased rating", "sympathetic reading", "pro se"],
    appeal_number: null,
  },
  {
    name: "Cook v. Principi",
    citation: "318 F.3d 1334 (Fed. Cir. 2003)",
    year: 2003,
    en_banc: true,
    holding:
      "A breach of the duty to assist cannot form the basis for a clear-and-unmistakable-error (CUE) claim, and grave procedural error does not render a VA decision non-final.",
    topics: ["cue", "clear and unmistakable error", "duty to assist", "finality"],
    appeal_number: null,
  },
  {
    name: "Bailey v. West",
    citation: "160 F.3d 1360 (Fed. Cir. 1998)",
    year: 1998,
    en_banc: true,
    holding:
      "The 120-day period to appeal a Board decision to the Veterans Court is subject to equitable tolling where a claimant is misled by conduct of the VA.",
    topics: ["equitable tolling", "120-day appeal", "jurisdiction", "notice of appeal"],
    appeal_number: null,
  },
  {
    name: "Barrett v. Principi",
    citation: "363 F.3d 1316 (Fed. Cir. 2004)",
    year: 2004,
    en_banc: false,
    holding:
      "Equitable tolling of the appeal period is available where a veteran's mental illness rendered him incapable of handling his own affairs and thus prevented timely filing.",
    topics: ["equitable tolling", "mental illness", "120-day appeal", "jurisdiction"],
    appeal_number: null,
  },
  {
    name: "Bond v. Shinseki",
    citation: "659 F.3d 1362 (Fed. Cir. 2011)",
    year: 2011,
    en_banc: false,
    holding:
      "Under 38 C.F.R. § 3.156(b), VA must evaluate any new and material evidence submitted within the one-year appeal period as having been filed in connection with the pending claim.",
    topics: ["3.156(b)", "new and material evidence", "pending claim", "effective date"],
    appeal_number: null,
  },
  {
    name: "Kyhn v. Shinseki",
    citation: "716 F.3d 572 (Fed. Cir. 2013)",
    year: 2013,
    en_banc: false,
    holding:
      "The Veterans Court may not rely on extra-record evidence to invoke the presumption of regularity regarding notice of a VA examination; findings must rest on the record before the agency.",
    topics: ["presumption of regularity", "examination notice", "record", "due process"],
    appeal_number: null,
  },
  {
    name: "Martin v. O'Rourke",
    citation: "891 F.3d 1338 (Fed. Cir. 2018)",
    year: 2018,
    en_banc: false,
    holding:
      "The TRAC factors, not the stricter Costanza standard, govern petitions for a writ of mandamus alleging unreasonable delay in adjudicating veterans' benefits claims.",
    topics: ["mandamus", "unreasonable delay", "TRAC factors", "backlog"],
    appeal_number: null,
  },
  {
    name: "Forshey v. Principi",
    citation: "284 F.3d 1335 (Fed. Cir. 2002)",
    year: 2002,
    en_banc: true,
    holding:
      "Defined the scope of the Federal Circuit's jurisdiction to review Veterans Court decisions, limiting review of factual determinations and application of law to fact absent a constitutional issue.",
    topics: ["jurisdiction", "scope of review", "7292", "questions of law"],
    appeal_number: null,
  },
  {
    name: "Disabled American Veterans v. Secretary of Veterans Affairs",
    citation: "327 F.3d 1339 (Fed. Cir. 2003)",
    year: 2003,
    en_banc: false,
    holding:
      "Invalidated the Board's rule allowing it to obtain and consider additional evidence without remand or claimant waiver, as inconsistent with the veteran's right to one review on appeal.",
    topics: ["board rulemaking", "remand", "due process", "additional evidence"],
    appeal_number: null,
  },
  {
    name: "Andre v. Principi",
    citation: "301 F.3d 1354 (Fed. Cir. 2002)",
    year: 2002,
    en_banc: false,
    holding:
      "Each distinct theory of clear and unmistakable error is a separate claim; a prior final CUE denial does not bar a CUE claim raising a different theory.",
    topics: ["cue", "separate claims", "finality", "res judicata"],
    appeal_number: null,
  },
  {
    name: "Szemraj v. Principi",
    citation: "357 F.3d 1370 (Fed. Cir. 2004)",
    year: 2004,
    en_banc: false,
    holding:
      "VA must give a sympathetic reading to a claimant's filings to determine all claims reasonably raised, extending Roberson beyond the TDIU context.",
    topics: ["sympathetic reading", "claim identification", "pro se", "reasonably raised"],
    appeal_number: null,
  },
  {
    name: "Moody v. Principi",
    citation: "360 F.3d 1306 (Fed. Cir. 2004)",
    year: 2004,
    en_banc: false,
    holding:
      "Reinforced VA's obligation to fully and sympathetically develop a pro se veteran's claim to its optimum before deciding it.",
    topics: ["sympathetic reading", "claim development", "pro se"],
    appeal_number: null,
  },
  {
    name: "National Organization of Veterans' Advocates v. Secretary of Veterans Affairs",
    citation: "260 F.3d 1365 (Fed. Cir. 2001)",
    year: 2001,
    en_banc: false,
    holding:
      "Addressed the validity of VA regulations governing attorney fees and effective dates, establishing the Federal Circuit's role in direct review of VA rulemaking under 38 U.S.C. § 502.",
    topics: ["rulemaking", "502 review", "attorney fees", "regulations"],
    appeal_number: null,
  },
  {
    name: "Rodriguez v. Peake",
    citation: "511 F.3d 1147 (Fed. Cir. 2008)",
    year: 2008,
    en_banc: false,
    holding:
      "Clarified the requirements for an informal claim under 38 C.F.R. § 3.155, holding that an intent to apply for benefits must be communicated in writing.",
    topics: ["informal claim", "3.155", "effective date", "intent to file"],
    appeal_number: null,
  },
  {
    name: "Sellers v. Wilkie",
    citation: "965 F.3d 1328 (Fed. Cir. 2020)",
    year: 2020,
    en_banc: false,
    holding:
      "A claim for benefits must identify the sickness, disease, or injury for which benefits are sought; VA is not required to infer conditions with no basis in the application or record.",
    topics: ["scope of claim", "reasonably raised", "application", "sympathetic reading"],
    appeal_number: null,
  },
  {
    name: "Euzebio v. McDonough",
    citation: "989 F.3d 1305 (Fed. Cir. 2021)",
    year: 2021,
    en_banc: false,
    holding:
      "Applied the constructive-possession doctrine to relevant documents (a National Academy of Sciences update) before VA at the time of decision, requiring their consideration.",
    topics: ["constructive possession", "record before the agency", "NAS", "presumption"],
    appeal_number: null,
  },
  {
    name: "Military-Veterans Advocacy v. Secretary of Veterans Affairs",
    citation: "7 F.4th 1110 (Fed. Cir. 2021)",
    year: 2021,
    en_banc: false,
    holding:
      "Reviewed challenges to VA herbicide-exposure rules, including for service in Thailand and on Blue Water Navy ships, under the court's 38 U.S.C. § 502 direct-review authority.",
    topics: ["herbicide", "thailand", "blue water navy", "502 review", "agent orange"],
    appeal_number: null,
  },
];

/** Neutral, non-fabricated source URL: the court's real WP search resolves to the opinion. */
export function cafcSearchUrl(caseName) {
  return `https://www.cafc.uscourts.gov/?s=${encodeURIComponent(caseName)}`;
}

/**
 * Render a key case as a shard-ready record body (plain text — the shard builder
 * embeds this). Kept deterministic and citation-first so retrieval surfaces the
 * holding with its reporter cite.
 */
export function keyCaseToRecordBody(c) {
  const banc = c.en_banc ? " (en banc)" : "";
  return [
    `${c.name}, ${c.citation}${banc}`,
    ``,
    `HOLDING: ${c.holding}`,
    ``,
    `TOPICS: ${c.topics.join(", ")}`,
  ].join("\n");
}
