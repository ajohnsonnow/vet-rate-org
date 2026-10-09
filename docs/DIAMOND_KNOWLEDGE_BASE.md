# 💎 DIAMOND Knowledge Base Architecture

> **Version:** 5.0.0 | **Last Updated:** 2026-07-26 (S44) | **Offline corpus:** 130,508 entries | **Live queryable today:** 142,785 chunks across 8 populated semantic shards (ecfr, m21_1, m21_4, m21_5, cavc, fedcir, ogc, bva) + 378 structured entries (state-benefits + multinational, non-shard) | **Not yet promoted from `content-verified` to `verified`:** all 7 non-eCFR shards, pending two observed green weekly freshness-cron runs each (S39)

## Overview

"Diamond Knowledge Base" refers to **two deliberately separate systems**, not one — this is by design (decided in Sprint S18–S26, reaffirmed in S27–S40), not accidental duplication:

1. **💎 Offline DKB corpus** (`llm-compiler/knowledge-base/diamond_knowledge_base.json`) — a large, broad collection of VA-claims-relevant entries scraped from official and judicial sources. **Stats-display only** — surfaced to the app via [dkbIndexedDB.js](../src/utils/dkbIndexedDB.js), no query/search layer. Unregenerated since 2026-01-27; the S27-S40 cycle built new, separate live-fetch pipelines (below) rather than re-scraping this file.
2. **⚖️ Live legal-index RAG** (`public/legal-index/v0.1.0/`) — the original chunked-and-embedded index, queryable at runtime, powering "Ask the Regs" via [legalRag.js](../src/services/legalRag.js) / [legalAnswerer.js](../src/services/legalAnswerer.js). Covers eCFR Title 38 Parts 3/4/19/20. Unchanged by S27-S40.
3. **🧩 Sharded DKB index** (`public/dkb-index/<id>/`, S29, fully populated S31-S34+S44) — a per-category semantic-shard layout, registered in [public/dkb-index/registry.json](../public/dkb-index/registry.json) and queried via `queryCorpus`/[dkbShardedRag.js](../src/services/dkbShardedRag.js). **All 8 shards are populated and registered** (`registry.json` reports `shard_count: 8`, generated `2026-07-20`): eCFR (1,060), M21-1 (4,720), M21-4 (341), M21-5 (453), CAVC (11,920), Federal Circuit (7,233), OGC (893), BVA (116,165) — 142,785 chunks total. `queryCorpus` fans out across all 8 today; no code change was needed to light the last seven up, since the query layer always reads whatever `registry.json` lists (see the shard table below). Each non-eCFR source's `knowledge-sources.yaml` status is still `content-verified`, not `verified` — promotion requires two observed green weekly freshness-cron runs (S39), tracked per source.
4. **📋 Structured reference data** (S36-S38, S44) — state VA benefits, multinational/OCONUS content, and VA compensation/SMC rate tables are **already fully queryable today**, but NOT via a semantic shard: they're plain structured JSON/JS (`src/data/states/*.json`, `src/data/multinational/*.json`, `src/data/vaSmcRatesHistorical.js`) reached synchronously through the unified access layer ([knowledgeQuery.js](../src/services/knowledgeQuery.js), S30) via `getStateBenefits`/`searchStateBenefits`/`getMultinationalContent`/`queryMultinational`. No embedding or shard population step is needed for these categories.

**The practical rule as of this writing:** "the DKB has an entry about X" (offline corpus, stats-only), "the DKB can answer a semantic query about X" (all 8 shards, live today), and "the app has structured, citable data about X" (eCFR + state-benefits + multinational + rate-tables, live now) are three different claims — but as of S44 the first two have converged for every currently-onboarded source. Check `knowledge-sources.yaml`'s `verified_status` before treating a source as promoted past `content-verified`.

A fifth, separate concept — the **Community Knowledge Base (CKB)** — is architecturally scoped in [KNOWLEDGE_BASE_ARCHITECTURE.md](./KNOWLEDGE_BASE_ARCHITECTURE.md) for veteran-community-sourced content (VeteransBenefitsKB, r/VeteransBenefits, RaterHQ). It currently has **zero entries** (`metadata.sources.community: 0` in the offline corpus) — populating it is blocked on pending copyright-permission responses (sent 2026-01-23), not an engineering gap. See that doc's permission tracker for status.

## 📊 Knowledge Base Statistics

### 💎 Offline DKB corpus — stats-only, not queryable

Source: `llm-compiler/knowledge-base/diamond_knowledge_base.json`, `metadata.generated: 2026-01-27T08:23:12` (not regenerated since — see [archive audit refresh](../archive/DIAMOND_KB_COMPREHENSIVE_AUDIT_JAN_2026.md)).

| Category                                                       | Entries     |
| -------------------------------------------------------------- | ----------- |
| **Total Entries**                                              | **130,508** |
| BVA (raw, uncurated — non-precedential and precedential mixed) | 116,209     |
| CAVC                                                           | 6,422       |
| 38 CFR                                                         | 2,953       |
| eCFR                                                           | 1,303       |
| M21-1                                                          | 1,371       |
| OGC                                                            | 891         |
| Secondary conditions                                           | 774         |
| Federal Circuit                                                | 293         |
| Presumptive conditions                                         | 277         |
| Federal Register                                               | 15          |
| Community (CKB)                                                | 0           |

A distributed web-tier subset (7,988 entries, `public/data/diamond_knowledge.json`) ships to the browser for the stats-display UI; the full 130,508-entry file (`public/data/diamond_knowledge_full.json`, ~130MB) is desktop-only.

### ⚖️ Live legal-index RAG — queryable via "Ask the Regs"

Source: `public/legal-index/v0.1.0/manifest.json`, `fetched_at: 2026-07-10T01:40:26Z`.

| Category                        | Records   |
| ------------------------------- | --------- |
| **Total chunks**                | **1,060** |
| eCFR (Title 38 Parts 3/4/19/20) | 1,060     |

This shard is fully queryable via **semantic search** (`queryCorpus`/`queryLegal`) and is the only shard already promoted to `verified` status — see the shard table below for the other 7.

### 🧩 Sharded DKB index — populated and live (S29, S31-S34, S44)

Source: [knowledge-sources.yaml](../knowledge-sources.yaml) (per-source `verified_status`/`last_verified`/notes) and [public/dkb-index/registry.json](../public/dkb-index/registry.json) (`generated_at: 2026-07-20`) for entry counts.

| Shard id | Sprint | Entries | Status          | What's built                                                                                                                                                                                    | Promotion to `verified`                                              |
| -------- | ------ | ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `ecfr`   | S18-26 | 1,060   | verified          | eCFR Title 38 Parts 3/4/19/20, weekly-refreshed                                                                                                                                                  | Already verified                                                         |
| `m21-1`  | S31    | 4,720   | content-verified | Real KnowVA content API fetcher (reverse-engineered KANA/Verint REST, no headless browser); `build-m21-1-shard.mjs`                                                                             | Needs 2 green weekly freshness-cron runs                                 |
| `m21-4`  | S44    | 341     | content-verified | RO workload/national-quality-review manual; added despite an earlier ops-content exclusion call, per explicit user request for full M21-series coverage, tagged `authority_tier: reference`    | Needs 2 green weekly freshness-cron runs                                 |
| `m21-5`  | S44    | 453     | content-verified | Appeals & Reviews manual, found via KnowVA's "Compensation and Pension" parent topic; `build-m21-5-shard.mjs`                                                                                    | Needs 2 green weekly freshness-cron runs                                 |
| `cavc`   | S33    | 11,920  | content-verified | Real Atom-RSS fetcher (rolling recent-decisions window), Panel decisions; `build-cavc-shard.mjs`. Single-Judge backfill resumed S44 after a 60s-timeout fix; confirm against a fresh registry rebuild before citing a higher count | Needs 2 green weekly freshness-cron runs; historical backfill ongoing    |
| `fedcir` | S33    | 7,233   | content-verified | Real WordPress REST fetcher + a 24-case hand-verified key-precedent seed (Procopio, Kirkpatrick, etc.); `build-fedcir-shard.mjs`                                                                | Needs 2 green weekly freshness-cron runs                                 |
| `ogc`    | S34    | 893     | content-verified | Real 2-level HTML crawl fetcher (1987-2019 opinion index) + url-backfill for 468 previously url-less corpus entries; `build-ogc-shard.mjs`                                                      | Needs 2 green weekly freshness-cron runs                                 |
| `bva`    | S32    | 116,165 | content-verified | Per-entry authority-tier tagging ([bvaAuthorityTagging.js](../src/services/bvaAuthorityTagging.js)) over the corpus's 116,209 raw entries (116,165 embedded — 44 dropped as empty/duplicate); categorically non-precedential (38 CFR § 20.1303), unit-asserted | Needs 2 green weekly freshness-cron runs |

Every shard above surfaces through the same `queryCorpus` path — no per-shard consumer code exists. S39 wired weekly freshness checks for all 7 non-eCFR shards (plus rate-tables/state-benefits/multinational, below — 10 sources total) so a broken fetcher or a stale source opens a GitHub issue automatically rather than going silently stale.

### 📋 Structured reference data — live today, not a semantic shard (S36-S38, S44)

| Category                       | Sprint  | Coverage                                                                                                                                                              | Access                                                                                                                                                                          |
| ------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| State VA benefits              | S36-S41 | All 51 states verified (rolled out incrementally: TX/CA/FL → 15 highest-population states → all 51), 345 benefits (334 verified)                                       | `getStateBenefits`/`searchStateBenefits` via [stateBenefits.js](../src/data/stateBenefits.js), exposed through [knowledgeQuery.js](../src/services/knowledgeQuery.js)           |
| Multinational / OCONUS service | S38     | 4 categories (overseas presumptive exposure, Foreign Medical Program, OCONUS filing, allied/Commonwealth service credit), 33 provisions (32 verified)                 | `getMultinationalContent`/`getMultinationalCategory`/`queryMultinational` via [multinationalContent.js](../src/data/multinationalContent.js), exposed through knowledgeQuery.js |
| VA compensation + SMC rate tables | S44 | Current-year VA disability compensation + Special Monthly Compensation rates (historical archive deliberately excluded — KnowVA's differs from verified current data by ~$1) | `src/data/vaSmcRatesHistorical.js`, generated by `apply-smc-rates.mjs` from `fetch-rate-tables.mjs`; exposed through knowledgeQuery.js |

All three are reached synchronously (no embedding step) through the S30 unified access layer, so any consumer that imports `knowledgeQuery.js` can already query them.

## 🔐 Privacy Architecture

### 100% Client-Side Processing

```
┌──────────────────────────────────────────────────────────────┐
│                    BROWSER ENVIRONMENT                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │   IndexedDB     │  │  Transformers.js │  │  In-memory   │  │
│  │   (device data) │  │  (Embeddings)    │  │  retrieval   │  │
│  │                 │  │                  │  │              │  │
│  │ ✓ Legal DB      │  │ ✓ bge-small-en  │  │ ✓ Brute-force│  │
│  │ ✓ User Data     │  │   -v1.5, 384-dim │  │   cosine +   │  │
│  │ ✓ Search Index  │  │ ✓ No API calls  │  │   BM25 (RRF) │  │
│  └─────────────────┘  └─────────────────┘  └──────────────┘  │
│                                                               │
│                    ❌ NO DATA LEAVES BROWSER                  │
└──────────────────────────────────────────────────────────────┘
```

### Privacy Guarantees

- ✅ **No Server Communication** - All processing happens locally
- ✅ **No User Tracking** - No personal tracking or telemetry (site-wide analytics is cookieless, aggregate GoatCounter only)
- ✅ **No Data Storage** - Nothing persisted externally
- ✅ **No API Keys Required** - Pre-loaded knowledge base
- ✅ **Works Offline** - Full functionality without internet

## 📁 Data Sources

Tracked in [knowledge-sources.yaml](../knowledge-sources.yaml) (the source-of-truth registry for the live legal-index) and, for the offline corpus's raw category counts, in `llm-compiler/knowledge-base/diamond_knowledge_base.json`'s `metadata.sources`.

### 1. eCFR Official Source (GOLD Standard) — live, verified

**Source:** [Electronic Code of Federal Regulations](https://www.ecfr.gov/), Title 38 Parts 3/4/19/20.

```json
{
  "source": "eCFR_OFFICIAL",
  "authority": "38 CFR Parts 3/4/19/20",
  "legal_weight": "BINDING - Federal Regulation",
  "coverage": [
    "All diagnostic codes (DC 5000-9999)",
    "Rating percentages (0-100%)",
    "Medical criteria definitions",
    "Effective dates and amendments"
  ]
}
```

The only source already promoted to `verified` status; weekly-refreshed and indexed into the queryable RAG today (1,060 chunks).

### 2. M21-1, M21-4, M21-5, CAVC, Federal Circuit, OGC — real fetchers, shards populated (S31/S33/S34/S44)

All six now have a working, content-verified live fetcher and a populated, registered shard (see the shard table above for entry counts):

- **M21-1** — the old `fetch-m21-1.mjs` scaffold was confirmed broken against KnowVA's Angular SPA; S31 solved it by reverse-engineering the SPA's underlying KANA/Verint JSON content API (no headless browser needed at runtime).
- **M21-4 / M21-5** — S44 found both via KnowVA's "Compensation and Pension" parent topic, which lists M21-1's full sibling set. M21-4 (RO workload/national-quality-review manual) had been excluded in an earlier sprint as ops-not-adjudication content, then added anyway per an explicit user request for full M21-series coverage — tagged `authority_tier: reference` so it can't outrank adjudication guidance in ranking.
- **CAVC / Federal Circuit** — S33 replaced the unverified scaffolds with a real Atom-RSS fetcher (CAVC) and a real WordPress-REST fetcher plus a hand-verified 24-case key-precedent seed (Federal Circuit). CAVC's Single-Judge backfill hit a genuine upstream server outage (S43) and resumed after a 60s-timeout fix (S44).
- **OGC** — S34 added the registry entry (it wasn't tracked before S27) and a real two-level HTML crawl fetcher.

### 3. BVA Decisions — 116,209 raw / 116,165 embedded, tagged by authority tier (S32)

**Source:** [VA Board of Veterans Appeals](https://www.va.gov/vetapp/) sitemaps.

```json
{
  "source": "BVA_DECISIONS",
  "authority": "Board of Veterans Appeals",
  "legal_weight": "Categorically non-precedential under 38 CFR § 20.1303 (binding only for the specific case decided); a persuasive citation_weight is computed per entry for ranking",
  "current_status": "116,209 raw entries tagged precedential:false/binding:false (invariant, not inferred) via bvaAuthorityTagging.js; 116,165 embedded into the live shard (44 dropped as empty/duplicate content)"
}
```

S32 replaced the old blanket exclusion ("non-precedential — would inflate the index 100x") with per-entry authority-tier tagging: every BVA entry is indexed, none can ever render as binding authority, and a caveat is surfaced at citation time. This is enforced by a unit-asserted invariant, not left to inference at query time.

### 4. VA compensation + SMC rate tables — live via structured access (S44)

**Source:** KnowVA Rate Tables topic (current-year VA disability compensation + Special Monthly Compensation rates only — the historical archive was deliberately excluded because KnowVA's figures disagree with verified data by ~$1).

Reached the same way as sources 5 below: `scripts/legal-ingestion/fetch-rate-tables.mjs` → `apply-smc-rates.mjs` generates `src/data/vaSmcRatesHistorical.js`, exposed through [knowledgeQuery.js](../src/services/knowledgeQuery.js). Not a semantic shard.

### 5. State VA benefits & multinational/OCONUS service — live via structured access (S36-S38, S41)

**Source:** official state veteran-affairs agencies (per-state) and va.gov/CFR/U.S. Code (multinational). See the shard table above for coverage detail.

Unlike sources 1-4, these two categories don't go through the semantic-shard pipeline at all — they're canonical, schema-validated JSON built by a repeatable Node ingestion pattern (`scripts/state-benefits/` and `scripts/multinational/`, mirroring each other) and reached synchronously through [knowledgeQuery.js](../src/services/knowledgeQuery.js). Every entry carries a mandatory `sourceUrl` + `lastVerified` + `authorityTier: "reference"`; the build fails loudly if a "verified" entry lacks an official https source.

### 6. Community Knowledge Base (CKB) — zero entries, blocked on permissions

**Source (pending permission):** [VeteransBenefitsKB](https://www.veteransbenefitskb.com/), r/VeteransBenefits, RaterHQ.

Permission-request emails sent 2026-01-23; no response as of this writing. **Do not scrape without affirmative written permission** — see [KNOWLEDGE_BASE_ARCHITECTURE.md](./KNOWLEDGE_BASE_ARCHITECTURE.md) for the permission tracker. This is a human-blocked item, not an engineering task — see [SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md](./SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md)'s Human-Blocked Items appendix.

## 🏗️ Data Structure

### Entry Schema

```typescript
interface KnowledgeEntry {
  // Identification
  id: string; // Unique identifier
  type: EntryType; // Entry classification

  // Content
  title: string; // Human-readable title
  content: string; // Main content/description

  // Source Attribution
  source:
    | "eCFR_OFFICIAL"
    | "M21_1"
    | "CAVC"
    | "FEDERAL_CIRCUIT"
    | "OGC"
    | "BVA_DECISIONS"
    | "PRESUMPTIVE"
    | "SECONDARY"
    | "STATE_BENEFITS"
    | "MULTINATIONAL_SERVICE"
    | "COMMUNITY_PROVIDED";
  source_url?: string; // Original source URL — required going forward (S28)
  source_disclaimer?: string; // For community content
  content_warning?: string; // Educational use notice

  // Trust/accuracy fields — required on every entry from S28 onward
  authority_tier?:
    | "statutory"
    | "judicial"
    | "administrative_precedent"
    | "policy"
    | "procedural"
    | "reference"
    | "community";
  precedential?: boolean; // Required for BVA/CAVC/FedCir entries (S32)

  // Classification
  category?: string; // Body system category
  diagnostic_codes?: string[]; // Related DC codes

  // Metadata
  last_updated: string; // ISO date string
  last_verified?: string; // ISO date of last freshness-check pass (S39)
  scraped_at: string; // When data was collected
}
```

> Fields above marked "S28"/"S32"/"S39" are being added by the [S27-S40 sprint cycle](./SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md) and are not yet populated on all existing entries — check a given source's registry entry in [knowledge-sources.yaml](../knowledge-sources.yaml) before assuming completeness.

### Body System Categories

| Category                | Diagnostic Codes | Description            |
| ----------------------- | ---------------- | ---------------------- |
| Musculoskeletal         | 5000-5299        | Bones, joints, muscles |
| Organs of Special Sense | 6000-6099        | Eyes and ears          |
| Respiratory             | 6600-6899        | Lungs, breathing       |
| Cardiovascular          | 7000-7199        | Heart, blood vessels   |
| Digestive               | 7200-7399        | GI system              |
| Genitourinary           | 7500-7599        | Kidneys, bladder       |
| Gynecological           | 7600-7699        | Female conditions      |
| Hemic/Lymphatic         | 7700-7799        | Blood, lymph           |
| Skin                    | 7800-7899        | Dermatological         |
| Endocrine               | 7900-7999        | Hormones, glands       |
| Neurological            | 8000-8599        | Brain, nerves          |
| Mental Disorders        | 9200-9499        | Psychiatric            |
| Dental/Oral             | 9900-9999        | Teeth, mouth           |

## 🔍 Search Architecture

**This section describes the eCFR legal-index RAG** ([legalRag.js](../src/services/legalRag.js) / [legalAnswerer.js](../src/services/legalAnswerer.js)) — the sharded pipeline (`queryCorpus`/`dkbShardedRag.js`, S29) reuses the same retrieval shape once a shard is populated; the raw offline DKB corpus itself still has no search layer (see Overview above).

### Hybrid Retrieval Pipeline

```
User Query → Embedding (bge-small-en-v1.5) ─┐
           → BM25 postings lookup ──────────┼→ Reciprocal Rank Fusion → MMR diversity → Top-k cited results
                                             ┘
"PTSD rating criteria" → dense cosine match + exact-term match, fused → ranked chunks with citations
```

Built in Sprint S21 (hybrid BM25 + dense + RRF) and S22 (MMR reranking) of [SPRINT_PLAN_S18-S26_KB_INGESTION.md](./SPRINT_PLAN_S18-S26_KB_INGESTION.md); a cross-encoder reranker was evaluated and deliberately deferred (no demonstrated lift for the current query mix). Recall@5 ≥0.95, MRR ≥0.85 on the 74-query golden set as of S25.

### Search Features

1. **Semantic Understanding** - Finds conceptually related content via dense embeddings
2. **Lexical Matching** - BM25 recovers exact regulatory terms dense embeddings blur
3. **Source Filtering** - Search within specific sources (per-shard architecture via S29; all 8 shards populated as of S44, see the shard table above)
4. **Category Scoping** - Limit to body system
5. **Confidence Scoring** - Relevance percentages, plus (from S28/S32 onward) an authority-tier label per result

## 📋 Diamond Checklist

Superseded by the sprint tracker in [SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md](./SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md) (S27-S40 complete as of S40, 2026-07-16) — check that document for full per-sprint detail rather than this section, which is kept only as a quick-glance summary.

### ✅ Completed

- [x] **eCFR live index** - Parts 3/4/19/20, verified, weekly-refreshed
- [x] **Source Attribution** - `source_url`/`last_updated` on eCFR entries
- [x] **Privacy Protection** - 100% client-side processing, no server
- [x] **Hybrid retrieval** - BM25 + dense + RRF + MMR (S21-S22)
- [x] **Offline corpus scraped** - 130,508 raw entries across 11 categories (10 populated + Community at 0)
- [x] **Corpus quality & trust audit** (S28) - accuracy-field discipline (`source_url`/`last_verified`/`authority_tier`) established and enforced going forward
- [x] **Sharded full-corpus RAG architecture** (S29) - `public/dkb-index/<id>/` layout + `dkbShardedRag.js`/`build-registry.mjs` shipped; eCFR migrated in as the first shard
- [x] **Unified KB access layer** (S30) - [knowledgeQuery.js](../src/services/knowledgeQuery.js) is the one query API every consumer reads through
- [x] **M21-1 real content fetcher** (S31) - KnowVA's underlying JSON API reverse-engineered; content-verified
- [x] **BVA authority-tier tagging** (S32) - all 116,209 entries tagged precedential:false/binding:false (invariant) + persuasive citation_weight
- [x] **CAVC + Federal Circuit real fetchers** (S33) - Atom-RSS (CAVC) and WP-REST + 24-case seed (Federal Circuit); content-verified
- [x] **OGC opinions fetcher + registry entry** (S34) - two-level crawl fetcher, content-verified
- [x] **Rating schedule + DBQ structured data** (S35) - 176 missing rating criteria filled from the verified eCFR index; DBQ map 5→71 conditions
- [x] **State VA benefits** (S36-S41) - all 51 states verified, 345 benefits (334 verified), live via knowledgeQuery
- [x] **Multinational/OCONUS service content** (S38) - 4 categories, 33 provisions (32 verified), live via knowledgeQuery
- [x] **Sharded freshness CI** (S39) - weekly check covers all 10 non-eCFR-hash-diff sources; drift/staleness opens a GitHub issue
- [x] **M21-4 + M21-5 fetchers/shards** (S44) - found via KnowVA's C&P parent topic; M21-4 added despite an earlier exclusion call, per explicit user request
- [x] **VA compensation + SMC rate tables** (S44) - current-year rates, live via knowledgeQuery
- [x] **Populate the 7 non-eCFR semantic shards** (S44) - m21-1/m21-4/m21-5/cavc/fedcir/ogc/bva all embedded and registered; `registry.json` reports `shard_count: 8`

### ⏳ Remaining (deliberately not claimed done — see each source's knowledge-sources.yaml notes)

- [ ] **CAVC Single-Judge historical backfill** - resumed S44 after a 60s-timeout fix following a genuine upstream outage (S43); registry snapshot (2026-07-20) still shows 11,920 chunks — confirm against a fresh rebuild before citing a higher count
- [ ] **Two observed green weekly freshness-cron runs per source** - required before any of the 7 non-eCFR S39-wired shard sources (plus rate-tables/state-benefits/multinational) is promoted from `content-verified` to `verified`
- [ ] **VA.gov API / Community KB** - human-blocked, tracked in the sprint plan's appendix, not an engineering gap

## 🛠️ Maintenance

### Updating the live legal-index (current, active pipeline)

```bash
# Fetch + chunk + embed the eCFR shard (see scripts/legal-ingestion/ for the full pipeline)
node scripts/legal-ingestion/run-all.mjs

# Verify against the eval golden set (no >5% regression)
npm run eval:rag -- --check-baseline
```

### Regenerating the offline DKB corpus (legacy, ad-hoc — not on any schedule)

The scripts below live in `llm-compiler/scrapers/real_sources/` and were last run to produce the current `diamond_knowledge_base.json` (generated 2026-01-27). They are not wired into any CI/cron; running them re-scrapes each source from scratch. Prefer hardening the Node `scripts/legal-ingestion/` pattern over relying on this legacy path where feasible (see S27-S40 Risks).

```bash
# Per-source scrapers (see llm-compiler/scrapers/real_sources/ for the full list)
python llm-compiler/scrapers/real_sources/ecfr_xml_scraper.py
python llm-compiler/scrapers/real_sources/cavc_final_push.py
python llm-compiler/scrapers/real_sources/m21_1_ultra_comprehensive.py
python llm-compiler/scrapers/real_sources/ogc_full_scraper.py
python llm-compiler/scrapers/real_sources/bva_precedential_scraper.py

# Merge + dedupe
python llm-compiler/scrapers/real_sources/diamond_merger.py

# Verify counts against knowledge-sources.yaml expectations
python scripts/dkb_comprehensive_audit.py
```

### Adding New Sources

1. Add a registry entry to [knowledge-sources.yaml](../knowledge-sources.yaml) first (`verified_status: not_started`).
2. Build a fetcher following the `scripts/legal-ingestion/fetch-*.mjs` pattern (loud-failure, coverage-floor guard) rather than a new ad-hoc Python scraper.
3. Wire into the sharded index (`public/dkb-index/<id>/`, following the `build-<id>-shard.mjs` pattern from S31-S34) for semantic content, or the structured-JSON + `knowledgeQuery.js` pattern from S36-S38 for reference data that doesn't need embedding.
4. Add eval golden-set queries covering the new source before calling it done.
5. Add the new source to `check-shard-freshness.mjs`'s hard-coded config (S39) so it gets a weekly freshness check.

## 📜 Legal Disclaimer

> **IMPORTANT:** This knowledge base is for **educational and informational purposes only**. It is not legal advice and should not be used as a substitute for consultation with a qualified VA-accredited attorney, claims agent, or Veterans Service Organization representative.
>
> - **Official content** (eCFR) reflects federal regulations as published
> - **Community content** represents veteran experiences and opinions
> - **BVA decisions** are persuasive but not binding precedent
>
> Always verify information with official VA sources before making claims decisions.

---

_Built with 💎 for veterans, by veterans_
