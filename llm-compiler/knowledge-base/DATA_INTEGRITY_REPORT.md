# Knowledge Base Data Integrity Report

**Generated:** 2026-01-22 10:25:28 (original) · **Refreshed:** 2026-07-15 (Sprint S28, [docs/SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md](../../docs/SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md))

> This report now covers the **current** corpus (130,508 entries, `metadata.generated: 2026-01-27T08:23:12`), five days after the original cleanup below. The original January findings are preserved as historical context; the S28 section below is the current state of record. Run `node scripts/validate-dkb-offline-corpus.mjs` to reproduce.

---

## S28 Refresh (2026-07-15) — current corpus, 130,508 entries

### Method

Programmatic structural audit of `llm-compiler/knowledge-base/diamond_knowledge_base.json` — the corpus is too large (130K entries) for manual line-by-line review, so this audit checks: (1) recurrence of the exact fabrication signature from the January incident below, (2) key uniqueness, (3) category-count consistency against the file's own declared metadata, (4) source/URL-domain consistency, (5) exact-content duplication. This is **not** a claim that every entry's substantive content is factually correct — that would require per-entry verification against each cited primary source, out of scope for a single sprint on a 130K-entry corpus. It **is** a claim that the corpus is free of the specific known fabrication pattern, and a precise accounting of every structural defect found.

### Summary

| Check | Result |
|---|---|
| Fabrication signature (fake "BVA YYYY-NNNNN" citations / "[BVA Precedent - GREEN]" boilerplate from the Jan 22 incident) | ✅ **0 matches** across all 130,508 entries |
| `dkb_id` uniqueness | ✅ **0 collisions** — reliable primary key |
| `id` uniqueness | ❌ **48,994 duplicates** (37.5% of the corpus) — see below |
| Category counts vs. `metadata.sources` | ✅ All 11 categories match exactly |
| `38_cfr` category source-labeling | ❌ **2,943 of 2,953** entries are mislabeled — see below |
| Exact-content duplication (post-merge residue) | ⚠️ **2,571 entries** (2% of substantive content) in 855 duplicate groups |

### Finding 1 — `id` field is not a reliable unique key (HIGH severity)

**48,994 of 130,508 entries (37.5%)** share their `id` value with at least one other entry. This is not harmless re-registration: sampling confirmed that colliding ids point to **genuinely different records** — e.g. `bva_1` is used for both citation `BVA-19167246` (an Obstructive Sleep Apnea/CAD denial) and citation `BVA-23047199` (a Hearing Loss/Tinnitus decision). The collision is heaviest in BVA (34,664 of ~48,228 BVA-subset duplicate-id groups have differing content — consistent with multiple scrape batches each restarting an `bva_N` counter from 1) and also present in OGC (431/891, 48%) and CAVC (256/6,422, 4%).

**Impact:** any consumer that keys entries by `id` (React list keys, lookup maps, dedup-by-id logic) will silently drop or overwrite ~37% of the corpus. `dkb_id` (e.g. `DKB-013234`) is confirmed 100% unique across all 130,508 entries and should be treated as the real primary key everywhere; `id` should be treated as a display/reference field only until remediated.

**Recommendation:** remediate before or during Sprint S29 (sharded architecture) — building shards on top of a non-unique key would propagate this defect into the new live index. Not attempted in this sprint; flagged as a blocking prerequisite.

### Finding 2 — `38_cfr` category is 99.7% mislabeled empty stubs (HIGH severity)

Of the 2,953 entries tagged `source: "38_cfr"` — the "GOLD standard binding regulation" tier per [docs/DIAMOND_KNOWLEDGE_BASE.md](../../docs/DIAMOND_KNOWLEDGE_BASE.md) — only **2** contain actual 38 CFR regulatory text (sourced from eCFR/Cornell LII, with populated `content`). The remaining **2,943** are Federal Register notices (`url` pointing to `federalregister.gov`) with **empty `content` and `citation` fields** — just a `title` and a URL. Their `id` prefix (`fed_reg_YYYY_NNNNN`) reveals what they actually are; they were tagged with the wrong `source` value during ingestion.

**Impact:** the corpus's own claim of "2,953 38 CFR entries" is off by two orders of magnitude for actual usable regulatory text. The real 38 CFR body text that does exist in this corpus lives in the separate `ecfr` category (1,303 entries, content present, `citation`/`url` populated) — a naming collision between `38_cfr` and `ecfr` as two different categories for what a reader would assume is the same thing. Anything downstream that filtered on `source: "38_cfr"` expecting regulation text would get 2,943 empty stubs and 2 real entries.

**Recommendation:** re-tag the 2,943 mislabeled entries to `source: "federal_register"` (bringing that category's true count from 15 to 2,958) and populate their empty `content` field, or remove them if the Federal Register content isn't intended to be retained as its own category. Either way, do not build S32-S38 tooling that trusts the `38_cfr` category label without re-running this check first.

### Finding 3 — Residual exact-content duplication (LOW-MEDIUM severity)

2,571 of 127,435 substantive-content entries (content ≥30 chars) are byte-for-byte identical to at least one other entry under a *different* `id`/`citation` — 855 distinct duplicate-content groups, the largest containing 478 entries with the same content. This sits alongside, not in contradiction with, the corpus's own `metadata.deduplication.duplicates_removed: 117193` claim — that number reflects an earlier pre-merge dedup pass (likely against a different, larger raw-scrape format), not a check against the current merged `entries[]` array's exact content.

**Impact:** minor — 2% residual duplication doesn't materially distort category counts or search results, but is worth cleaning up opportunistically since it inflates effective corpus size for no informational gain. Not remediated this sprint.

### Finding 4 — Content is truncated/excerpted, not full-text, across most sources (informational, not a defect)

Content-length medians by category: BVA ~500 chars, CAVC ~244 chars, M21-1 ~404 chars, eCFR ~210 chars, OGC ~90 chars — all far shorter than a full regulatory section or judicial opinion, and BVA content samples end mid-sentence with `...`. Structural section markers (`ORDER`, `FINDING`, `CONCLUSION`, `CFR` citations) are present in 111,405 of 116,209 BVA entries (95.9%), confirming these are genuine excerpts of real decisions rather than fabricated text — but they are excerpts, not the complete opinion. This is a fidelity/completeness characteristic to design around (e.g. link out to the full `url` for the complete text) rather than a trust defect; flagged here so Sprint S29's shard design doesn't assume full-text retrieval depth that isn't actually present in the source data.

### Finding 5 — BVA coverage is narrower than the corpus's own framing suggests (informational)

The 116,209 raw BVA entries only span VA sitemap years `vetapp23`/`vetapp24`/`vetapp25` (calendar 2023–2025) plus 44 hand-curated "landmark" precedential case summaries (e.g. *Caluza v. Brown*, tagged `category: "BVA Precedential"` — a good existing pattern to extend in Sprint S32's authority-tier tagging). The archive audit ([archive/DIAMOND_KB_COMPREHENSIVE_AUDIT_JAN_2026.md](../../archive/DIAMOND_KB_COMPREHENSIVE_AUDIT_JAN_2026.md)) noted BVA sitemaps go back to 2020; this scrape did not reach 2020–2022. Not a fabrication issue, but the "116,209 BVA entries" figure should not be read as "all available BVA decisions" — it's 3 years of a wider window.

### What did NOT reproduce from the January incident

Zero entries anywhere in the current 130,508-entry corpus match the fabricated-citation pattern (`BVA <year>-<5 digits>`, e.g. "BVA 2021-12345") or the `[BVA Precedent - GREEN]` boilerplate marker documented below. The January cleanup's specific defect has not recurred in the entries added since.

### Accuracy discipline going forward (per S28 scope)

Per the sprint plan, every entry across every source should carry `source_url` (or `url`), `last_updated`/`last_verified`, and (from S32) `authority_tier`. Current `url` presence by category: `ecfr`/`m21_1`/`38_cfr`(nominal)/`federal_circuit` 100%, `cavc` 99.97%, `ogc` 47.5% (468/891 missing), `presumptive` 49.5% (140/277 missing), `secondary` 70% (234/774 missing). Closing the `ogc`/`presumptive`/`secondary` gaps is folded into their respective build-out sprints (S34, S35) rather than attempted here, since populating a citation needs the actual source content work those sprints do anyway.

### Verification

```bash
node scripts/validate-dkb-offline-corpus.mjs
```

Reproduces all counts in this report. Exits 0 today (all findings above are warnings against a recorded baseline, not failures) — see that script's header comment for which checks are hard-failure vs. baseline-tracked warnings, and why.

---

## Original Report (2026-01-22) — historical, corpus was 1,560 entries at the time

### Summary

| Metric | Count |
|--------|-------|
| Original entries | 1560 |
| Fake entries removed | 45 |
| Verified entries remaining | 1515 |

### Fake Data Removed

The following types of fabricated data were identified and removed:

1. **Fake BVA Citations** - Citations like 'BVA 2021-12345' that don't exist
2. **Invented Case Numbers** - Made-up case references

### Verified Data Sources

The remaining knowledge base entries come from:

| Source | Verified |
|--------|----------|
| eCFR.gov (38 CFR) | Yes |
| Federal Register | Yes |
| VA.gov | Yes |
| Cornell LII | Yes |
| Data.gov | Yes |

### Entry Types After Cleaning

| Type | Count |
|------|-------|
| unknown | 1515 |

### Data Authenticity Statement

**After this cleanup, ALL data in the knowledge base is from official government sources.**

- No fabricated citations remain
- All entries can be verified against their original sources
- eCFR data verified against live eCFR.gov XML
