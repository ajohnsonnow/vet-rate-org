# Multinational / OCONUS Service — Canonical Schema & Ingestion Pattern (S38)

> Authored 2026-07-15 for sprint **S38** (Diamond KB cycle S27–S40). Defines the
> one schema every multinational/OCONUS-service content category uses, and the
> repeatable ingestion pattern that populates it. Deliberately mirrors the S36
> state-benefits pipeline — adding or refreshing a category is "write a research
> file, run the build," not bespoke per-category code.
>
> Canonical code: [scripts/multinational/schema.mjs](../scripts/multinational/schema.mjs).

---

## Scope (what this is and is NOT)

This category holds **US-veteran-benefit content about overseas or allied
service** — never a comparative reference to other countries' benefit systems
(scope confirmed in
[SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md](./SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md)
line 63). Four categories:

| category                        | display label                        | covers                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `presumptive_exposure_overseas` | Overseas Presumptive Exposure        | Foreign-location radiation/herbicide presumptions (Hiroshima/Nagasaki, atmospheric tests, Enewetak, Palomares, Thule, Thailand, Korean DMZ, Laos/Cambodia, Guam/Johnston Atoll), each with its 38 CFR cite + eligibility date range |
| `foreign_medical_program`       | Foreign Medical Program              | VA-covered care while living/traveling abroad (FMP): eligibility, forms 10-7959f-1/f-2, the Philippines/Manila arrangement                                                                                                          |
| `oconus_filing`                 | OCONUS Claims Filing                 | Filing and getting paid on a claim from outside the US: Manila RO, online/mail filing, embassy Federal Benefits Units, international direct deposit                                                                                 |
| `allied_service_credit`         | Allied & Commonwealth Service Credit | Philippine Scout/Commonwealth/guerrilla credit, the 38 U.S.C. 107 $0.50-per-dollar rule, the 38 CFR 3.42 full-rate exception, the FVEC Fund, 38 U.S.C. 109 allied-forces benefits                                                   |

It complements the existing high-level [pactActData.json](../src/data/pactActData.json)
by surfacing **specific named overseas locations and their authorities**, not by
restating the generic PACT overview.

---

## The canonical schema

### Per-category file — `src/data/multinational/<category>.json`

```jsonc
{
  "category": "foreign_medical_program", // machine category — see vocabulary
  "displayName": "Foreign Medical Program",
  "officialSource": "https://www.va.gov/COMMUNITYCARE/programs/veterans/fmp/index.asp",
  "verificationStatus": "verified", // "verified" | "template" | "unverified"
  "lastVerified": "2026-07-15", // YYYY-MM-DD
  "provisions": [
    /* Provision[] */
  ],
}
```

A file is `verified` iff **at least one** of its provisions is verified;
otherwise `template`. `build-multinational.mjs` derives this — it is not
hand-set.

### Provision record

```jsonc
{
  "id": "foreign_medical_program-what-the-foreign-medical-progr", // stable, unique per category
  "category": "foreign_medical_program", // must equal the file category
  "displayCategory": "Foreign Medical Program", // UI label — DERIVED from category
  "name": "What the Foreign Medical Program (FMP) is",
  "description": "FMP is a VA health benefit that may pay for medical care...",
  "keyPoints": [
    "Covers care obtained outside the U.S. for a service-connected condition",
    "...",
  ],
  "eligibility": "Veterans getting care abroad for a VA-rated service-connected disability...", // string | null
  "application": {
    "howToFile": "File the completed VA Form 10-7959f-2...", // string | null
    "agency": "VHA Office of Integrated Veteran Care", // string | null
    "form": "VA Form 10-7959f-2", // string | null
    "url": "https://www.va.gov/health-care/file-foreign-medical-program-claim/", // string | null
    "phone": null, // string | null
  },
  "legalCitation": "38 U.S.C. 1724; 38 C.F.R. 17.35", // string | null
  "authorityTier": "reference", // ALWAYS "reference" (see below)
  "sourceUrl": "https://www.va.gov/COMMUNITYCARE/programs/veterans/fmp/index.asp",
  "lastVerified": "2026-07-15",
  "verificationStatus": "verified", // per-provision
}
```

### Accuracy fields — mandatory on every provision (S28 discipline)

- **`sourceUrl`** — the official page the fact was read from (https).
- **`lastVerified`** — ISO date the fact was confirmed.
- **`authorityTier`** — always `"reference"`. Multinational content is secondary
  reference material, matching the `multinational: "reference"` slot already
  registered in
  [src/services/dkbAuthorityTiers.js](../src/services/dkbAuthorityTiers.js); it
  is never binding legal authority and must never outrank statute/court tiers in
  cross-shard ranking.

The validator enforces the core rule: a provision with
`verificationStatus: "verified"` **must** carry a valid https `sourceUrl`. A
`legalCitation` is **recommended but not required** — an official VA program page
is valid grounding on its own, and requiring a statute number would only pressure
a researcher into guessing one. Unverified data therefore cannot be labeled
verified — the build fails loudly instead of shipping it.

---

## The ingestion pattern (repeatable)

```
scripts/multinational/
├── schema.mjs                  # canonical categories + validateProvision / validateCategoryFile
├── normalize.mjs               # raw research finding → canonical provision (pure)
├── build-multinational.mjs     # orchestrator: read → normalize → validate → write
└── sources/
    └── <category>.research.json  # per-category research input (one per category)
```

### Step 1 — research (`sources/<category>.research.json`)

A researcher (or a scoped subagent) reads **official VA / CFR / U.S. Code pages**
and records findings. Only `category`, `name`, `description`, and `sourceUrl` are
required per finding; everything else defaults. Each verified finding carries a
`sourceExcerpt` (the exact confirming quote) for audit — that field stays in the
research file and is **not** shipped.

Rules the research step follows (and that make the data trustworthy):

- Official sources only (`va.gov`/`*.va.gov`, `publichealth.va.gov`,
  `ecfr.gov`/`govinfo.gov`, `uscode.house.gov`, `state.gov`). No blogs, law
  firms, or aggregators for numbers/citations.
- If a source blocks (403/404/timeout) or a figure can't be confirmed, the field
  is `null` and the finding is `verificationStatus: "unverified"` — **never a
  guessed statute number, date range, address, or dollar amount.** Date ranges
  gate eligibility, so an unconfirmed range is marked unverified, not estimated.
- When a stronger official source exists, prefer it: the FVEC dollar amounts were
  re-sourced from an official VA News release rather than an incidental BVA
  decision quote.

### Step 2 — build

```bash
node scripts/multinational/build-multinational.mjs                       # all categories
node scripts/multinational/build-multinational.mjs foreign_medical_program  # a subset
# npm alias:
npm run build:multinational
```

`normalize.mjs` maps each finding to a canonical provision (stable `id`, derived
`displayCategory`, `authorityTier: "reference"`, `lastVerified` from the file's
`research_date`). `build-multinational.mjs` validates every file and **exits
non-zero** if any provision fails — a verified provision missing its source is a
build error. Output: `src/data/multinational/<category>.json`.

### Step 3 — consume

[src/data/multinationalContent.js](../src/data/multinationalContent.js) loads the
four category files and flattens their provisions;
[src/services/knowledgeQuery.js](../src/services/knowledgeQuery.js) (the S30
unified access layer) exposes them via `getMultinationalContent()`,
`getMultinationalCategory(category)`, and `queryMultinational(term)` so any
feature can reach this content without knowing its file layout.

---

## Guard

[src/\_\_tests\_\_/multinationalSchema.test.js](../src/__tests__/multinationalSchema.test.js)
asserts every canonical category file validates against `schema.mjs`, that
verified provisions are each grounded in an official https `sourceUrl`, that all
four categories are present and verified, and that the live consumer flattens
them. [src/\_\_tests\_\_/services/knowledgeQuery.test.js](../src/__tests__/services/knowledgeQuery.test.js)
asserts the unified-layer accessors return them. This locks the accuracy floor so
a future edit can't silently downgrade a category or ship a verified provision
with no source.

---

## Scope boundary (what S38 does and does not claim)

- **Does:** one schema; a repeatable Node pipeline mirroring S36; four categories
  (33 provisions, 32 verified) grounded in official VA/CFR/U.S. Code sources with
  per-entry `sourceUrl` + `lastVerified`; reachable through the unified access
  layer.
- **Does not:** build a dedicated OCONUS **UI** (the content is reachable through
  the unified query layer and existing AI surfaces — a bespoke `OCONUSHunter`
  component is not required by the S38 DoD and is left for a later cycle); build
  the multinational **shard** (S29's `public/dkb-index/` layout — the
  `multinational` `authorityTier` slot is already registered so that slot-in is
  mechanical); wire freshness CI (S39). These are named here so no reader assumes
  them done.

```

```
