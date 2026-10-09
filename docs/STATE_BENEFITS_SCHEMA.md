# State Veteran Benefits — Canonical Schema & Ingestion Pattern (S36)

> Authored 2026-07-15 for sprint **S36** (Diamond KB cycle S27–S40). Defines the
> one schema every state's veteran-benefit data uses, and the repeatable
> ingestion pattern that populates it. **S37 reuses this without rework** — adding
> a state is "write a research file, run the build," not bespoke per-state code.
>
> Canonical code: [scripts/state-benefits/schema.mjs](../scripts/state-benefits/schema.mjs).

---

## Why this exists

The Jan-2026 Python scraper ([scripts/state-benefits-scraper/](../scripts/state-benefits-scraper/))
left two problems this sprint corrects:

1. **Two divergent shapes.** The hand-authored TX/CA/FL files used
   `benefitName` / `applicationProcess` / `legalCitation` / `sources[]`; the 48
   template-generated files used `name` / `howToApply` / `legalCitations[]` /
   `sourceUrl`. The live consumer papered over the split with defensive `a || b`
   field reads. One schema removes that fragility.
2. **Fabricated data presented as data.** The scraper's own
   [FINAL_REPORT.md](../scripts/state-benefits-scraper/FINAL_REPORT.md) states only
   3 of 51 states were verified; the other 48 were "template-generated" from
   "common patterns" and "NEED VERIFICATION." Plausible-but-unverified benefit
   numbers shown to veterans are the same anti-pattern that once required
   `removed_fake_entries.json`. The canonical schema makes verification a
   **required, enforced** property, not a footnote.

S36 delivers the schema + pipeline and verifies the **3 pilot states**
(TX, CA, FL — the three highest veteran-population states). The remaining 48
template files stay in place, still flagged `template` in the UI, until S37 and
beyond verify them. They are never relabeled "verified" without a cited source.

---

## The canonical schema

### Per-state file — `src/data/states/<code>.json`

```jsonc
{
  "state": "Texas",
  "stateCode": "TX",
  "officialSource": "https://www.tvc.texas.gov/",
  "verificationStatus": "verified", // "verified" | "template" | "unverified"
  "lastVerified": "2026-07-15", // YYYY-MM-DD
  "benefits": [
    /* Benefit[] */
  ],
}
```

A file is `verified` iff **at least one** of its benefits is verified; otherwise
`template`. `build-state-benefits.mjs` derives this — it is not hand-set.

### Benefit record

```jsonc
{
  "id": "tx-property_tax_exemption-100-disabled-...", // stable, unique per state
  "benefitType": "property_tax_exemption", // machine type — see vocabulary
  "category": "Property Tax", // UI display bucket — DERIVED from type
  "name": "100% Disabled Veteran Residence Homestead Exemption",
  "description": "Total exemption from property tax on the residence homestead...",
  "value": "Total exemption of the residence homestead", // string | null
  "estimatedAnnualValue": null, // number (USD/yr) | null — null unless confidently known
  "requirements": {
    "minRating": 100, // 0-100 — the eligibility gate the search filters on
    "maxRating": null, // 0-100 | null (null = no upper bound)
    "isPermanentTotal": false,
    "residencyRequired": true,
    "otherReqs": ["Texas resident", "Primary residence"],
  },
  "application": {
    "agency": "County Appraisal District",
    "form": "Form 50-114", // string | null
    "url": "https://...", // string | null
    "documentation": ["VA disability rating letter", "DD-214"],
  },
  "legalCitation": "Texas Tax Code §11.131", // string | null
  "authorityTier": "reference", // ALWAYS "reference" (see below)
  "sourceUrl": "https://comptroller.texas.gov/taxes/property-tax/exemptions/",
  "lastVerified": "2026-07-15",
  "verificationStatus": "verified", // per-benefit
}
```

### `benefitType` vocabulary

The **six DoD-mandated types** (cover each where the state has the program):

| type                     | DoD category                        | UI `category` |
| ------------------------ | ----------------------------------- | ------------- |
| `property_tax_exemption` | property tax exemption              | Property Tax  |
| `state_veterans_home`    | state VA homes                      | Housing       |
| `education_tuition`      | education / tuition waivers         | Education     |
| `hiring_preference`      | hiring preference                   | Employment    |
| `license_plate`          | license plates                      | Vehicle       |
| `state_va_healthcare`    | state VA hospital / nursing network | Healthcare    |

Plus, for honest coverage of programs outside the six:
`vehicle_registration`, `recreation`, `housing`, `financial_bonus`, `other`.

`category` is **derived** from `benefitType` via `CATEGORY_FOR_TYPE` so the live
`StateBenefitHunter` icon/colour config keeps working; never hand-set a category
that disagrees with its type (the validator rejects it).

### Accuracy fields — mandatory on every benefit (S28 discipline)

- **`sourceUrl`** — the official page the fact was read from (https).
- **`lastVerified`** — ISO date the fact was confirmed.
- **`authorityTier`** — always `"reference"`. State benefits are secondary
  reference material, the lowest-but-one authority tier
  ([build-registry.mjs](../scripts/dkb-sharding/build-registry.mjs) `AUTHORITY_TIERS`);
  they are never binding legal authority and must never outrank statute/court
  tiers in cross-shard ranking.

The validator enforces the core rule: a benefit with
`verificationStatus: "verified"` **must** carry a valid https `sourceUrl` — the
official page the fact was read from. A `legalCitation` is **recommended but not
required**: an official agency page (a state DMV or veterans-home page) is valid
grounding on its own, and requiring a statute number would only pressure a
researcher into guessing one. Unverified data therefore cannot be labeled
verified — the build fails loudly instead of shipping it.

---

## The ingestion pattern (repeatable)

```
scripts/state-benefits/
├── schema.mjs                 # canonical types + validateBenefit / validateStateFile
├── normalize.mjs              # raw research finding → canonical benefit (pure)
├── build-state-benefits.mjs   # orchestrator: read → normalize → validate → write
└── sources/
    └── <code>.research.json   # per-state research input (one per state)
```

### Step 1 — research (`sources/<code>.research.json`)

A researcher (or a scoped subagent) reads **official state agency sites** and
records findings. Only `benefitType`, `name`, `description`, `sourceUrl`, and
`verificationStatus` are required per finding; everything else defaults. Each
verified finding carries a `sourceExcerpt` (the exact confirming quote) for
audit — that field stays in the research file and is **not** shipped.

Rules the research step follows (and that make the data trustworthy):

- Official sources only (state `.gov`/`.us` agencies, `va.gov`, the state
  statutes site). No blogs, law firms, or aggregators for numbers/citations.
- If a source blocks (403/access-denied) or a figure can't be confirmed, the
  field is `null` and the finding is `verificationStatus: "unverified"` — **never
  a guessed statute number or dollar amount.**
- Dollar amounts that are indexed annually (e.g. CA's exemption) are only stated
  when confirmed on an official page for a known year; otherwise the benefit is
  described qualitatively.

### Step 2 — build

```bash
node scripts/state-benefits/build-state-benefits.mjs            # all states with a research file
node scripts/state-benefits/build-state-benefits.mjs tx ca fl   # a subset
# npm alias:
npm run build:state-benefits
```

`normalize.mjs` maps each finding to a canonical benefit (stable `id`, derived
`category`, `authorityTier: "reference"`, `lastVerified` from the file's
`research_date`). `build-state-benefits.mjs` validates every file and **exits
non-zero** if any benefit fails — a verified benefit missing its source is a
build error. Output: `src/data/states/<code>.json`.

### Step 3 — consume

[src/data/stateBenefits.js](../src/data/stateBenefits.js) loads the canonical
pilot files (and the legacy template files for not-yet-verified states) and the
`searchStateBenefits` path in
[src/utils/aiStatementHelper.js](../src/utils/aiStatementHelper.js) serves them
to the `StateBenefitHunter` UI, which shows a "Verified" vs "Pending
Verification" badge driven by `verificationStatus`.

---

## Guard

[src/**tests**/stateBenefitsSchema.test.js](../src/__tests__/stateBenefitsSchema.test.js)
asserts every canonical pilot file validates against `schema.mjs`, that verified
benefits are each grounded in an official https `sourceUrl`, and that the three
pilot states are present and verified. This locks the accuracy floor so a future
edit can't silently downgrade a pilot state or ship a verified benefit with no
source.

---

## Scope boundary (what S36 does and does not claim)

- **Does:** one schema; a repeatable Node pipeline (replacing the ad-hoc Python
  swarm per the cycle's risk-table preference); 3 pilot states verified against
  official sources with per-entry `sourceUrl` + `lastVerified`.
- **Does not:** verify the other 48 states (they remain `template`, flagged in
  the UI); build the state-benefits **shard** (S29's `public/dkb-index/` layout —
  the `authorityTier` field is already set so that slot-in is mechanical); wire
  freshness CI (S39). These are named here so no reader assumes them done.
