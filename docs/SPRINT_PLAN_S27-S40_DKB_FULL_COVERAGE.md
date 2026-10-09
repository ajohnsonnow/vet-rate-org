# Sprint Plan — Cycle S27–S40: Diamond Knowledge Base Full-Coverage Audit

> Companion to [SPRINT_PLAN.md](./SPRINT_PLAN.md), [SPRINT_PLAN_S9-S17.md](./SPRINT_PLAN_S9-S17.md), [SPRINT_PLAN_S18-S26_KB_INGESTION.md](./SPRINT_PLAN_S18-S26_KB_INGESTION.md), [DIAMOND_KNOWLEDGE_BASE.md](./DIAMOND_KNOWLEDGE_BASE.md), [KNOWLEDGE_BASE_ARCHITECTURE.md](./KNOWLEDGE_BASE_ARCHITECTURE.md), and [../knowledge-sources.yaml](../knowledge-sources.yaml). Continues sprint numbering (S0–S17 done, S18–S26 done). Authored 2026-07-15 for **Sonnet 4.6 / Haiku 4.5 executing sessions**, with **Opus 4.8 reserved for S29, S31, S32**.
>
> Status legend: `planned` · `in-progress` · `done` (with evidence) · `deferred` (justified)
>
> **Execution process:** each sprint runs in its own session. **Compact/clear the context window after every sprint completes**, before starting the next one — keeps each session focused on its own scope and verification output instead of accumulating the full history of prior sprints.

---

## Context

**Why this cycle:** the owner asked for a full audit of the "Diamond Knowledge Base" (DKB) — is it pulling in everything available from VA-claims sources, where is it weak, what's needed to complete it. The audit surfaced that the DKB is really two systems sharing one name, that most of the 130K-entry corpus isn't queryable by anyone, and that several high-value sources (M21-1, CAVC, Federal Circuit, OGC) are either broken, unverified, or untracked. The owner then expanded scope: **index the entire raw corpus and every subset** (reversing S18–S26's "stats-only" call for the 130K corpus), require **every entry to be true, accurate, and reachable from any feature that consults the knowledge base** (not just "Ask the Regs"), and **investigate new source categories** — state VA benefits and content for US veterans with qualifying multinational/overseas service.

### Verified current state (direct reads, not assumptions)

**The two "Diamond KB" systems** (a deliberate S18–S26 decision — see that plan's "Explicitly NOT building" table — not an oversight, but one this cycle now reverses for the first system):

- `llm-compiler/knowledge-base/diamond_knowledge_base.json` — 130,508 entries. Category breakdown (`metadata.category_counts`): 38 CFR 2,953 · eCFR 1,303 · M21-1 1,371 · OGC 891 · CAVC 6,422 · Federal Circuit 293 · presumptive 277 · secondary 774 · **BVA 116,209 (89% of the corpus)** · community 0. Deduplication already removed 117,193 near-duplicates from a larger raw scrape. Distributed to the web app as `public/data/diamond_knowledge_full.json` (130MB) / `diamond_knowledge.json` (7.9MB web tier, 7,988 entries) via [dkbIndexedDB.js](../src/utils/dkbIndexedDB.js) — **stats-display only, no query layer**.
- `public/legal-index/v0.1.0/` — the only currently-**queryable** index, powering "Ask the Regs" ([legalRag.js](../src/services/legalRag.js) / [legalAnswerer.js](../src/services/legalAnswerer.js)). eCFR Title 38 Parts 3/4/19/20 only: 564 records → 1,060 chunks, 2.6MB, well under the 25MB lazy-load budget. Built by [scripts/legal-ingestion/](../scripts/legal-ingestion/) (chunk/embed/contextualize/hybrid-retrieval pipeline from S18–S26).

**[knowledge-sources.yaml](../knowledge-sources.yaml)** — the source-of-truth registry — status per source:

| Source | Status | Notes |
|---|---|---|
| eCFR (Title 38) | `verified`, weekly, `last_verified: 2026-07-09` | Live. Parts 3/4/19/20 fully indexed. |
| M21-1 | `scaffold` | **Confirmed broken 2026-07-09**: KnowVA now serves the manual as a client-rendered Angular SPA; a fetch()+regex scraper gets zero content (zero `<a>` hrefs beyond an Angular binding). Needs a headless-browser fetcher (Puppeteer/Playwright — new dependency) or a reverse-engineered content API. |
| CAVC | `scaffold`, `last_verified: null` | Unverified. PDF-shaped source. |
| Federal Circuit | `scaffold`, `last_verified: null` | Unverified. PDF-shaped source. |
| OGC | **not in the registry at all** | 891 entries exist in the offline corpus with no tracked freshness or verification. |
| BVA | Explicitly out of scope — *"non-precedential — would inflate the index 100×"* | This cycle revisits that call: index everything, tag authority tier as metadata instead of excluding it (see S32). |

**Archive audit** ([archive/DIAMOND_KB_COMPREHENSIVE_AUDIT_JAN_2026.md](../archive/DIAMOND_KB_COMPREHENSIVE_AUDIT_JAN_2026.md), dated 2026-01-26, ~6 months stale relative to this cycle) independently flagged the same gaps from a different angle: CAVC 2007–2023 (a 16-year hole between the 1989–2006 archive and the last-2-years feed), BVA precedential decisions, M21-1 full parse, OGC opinions, Federal Circuit key cases (Procopio, Kirkpatrick, Martin), structured rating criteria per diagnostic code, DBQ evidence-checklist templates.

**Human-blocked sources (out of scope for this cycle — zero agent sprints, see appendix):**

- **VA.gov API** — fully built, disabled behind `VITE_VA_API_ENABLED=false` ([vaAuth.js:22-25](../src/config/vaAuth.js#L22-L25)) pending re-credentialing at developer.va.gov. Business/access blocker, not technical.
- **Community KB** (VeteransBenefitsKB.com, r/VeteransBenefits, RaterHQ) — architecturally ready ([KNOWLEDGE_BASE_ARCHITECTURE.md](./KNOWLEDGE_BASE_ARCHITECTURE.md)), blocked on pending permission-request responses sent 2026-01-23.

**Trust risk:** a prior ingestion cycle produced `llm-compiler/knowledge-base/removed_fake_entries.json` — fabricated entries had to be purged once already. Corpus integrity hasn't been re-verified since that cleanup. This cycle treats re-verification as a prerequisite, not an afterthought (S28).

**Hard constraints (every sprint, carried forward from S18–S26 and non-negotiable):** 100% client-side, no server, no backend; user documents and their vectors never leave the device; the dual-LLM extractor/synthesizer security split in [legalAnswerer.js](../src/services/legalAnswerer.js) is preserved unchanged — wired and fed, never rebuilt; low-end mobile must work; `npm run preflight`/`npm test`/the eval CI gate stay green.

---

## Strategy (centerpiece)

The prior cycle (S18–S26) deliberately kept the 130K-entry corpus stats-only and the live index eCFR-only, reasoning there was "no established product need yet" for more. The owner has now established that need explicitly: **full RAG over the entire raw corpus and all subsets**, with a **unified access layer** so every feature — not just "Ask the Regs" — can query it, and an ongoing **accuracy/authority discipline** so expanding coverage never means expanding unverified or fabricated content.

This is reconciled with the repo's hard privacy/budget constraints via **sharding**, not by relaxing them: instead of one monolithic ≤25MB index, each category (CFR, M21-1, CAVC, Federal Circuit, OGC, BVA, presumptive, secondary, state-benefits, multinational) becomes its own independently lazy-loadable shard. Total on-disk corpus size grows substantially; **what any single query actually downloads stays small**, because only the shard(s) relevant to that query load, gated by the device-tier detection already built in S22/S24.

Sequencing: foundation first (verify the corpus is trustworthy, design the shard architecture and unified access layer) **before** pouring more content into it or exposing it more broadly — building on an unverified foundation would just scale the trust problem. Then the previously-identified gaps (M21-1, BVA, CAVC/FedCir, OGC, rating/DBQ structure) get closed into the new shard model. Then genuinely new categories (state benefits, multinational service) get added using the now-proven pattern. Finally, freshness CI and documentation catch up to the shipped state — mirroring S26's closing-hygiene role.

**Model right-sizing policy:** Sonnet 4.6 executes the majority of sprints — fetcher/parser/integration work, consumer migration, content curation within an established pattern. Haiku 4.5 executes mechanical bulk work — dedup/classification scans, templated per-state entries once a pattern is proven, registry/docs/CI hygiene. **Opus 4.8 is reserved for exactly three sprints**: S29 (sharded full-corpus architecture — privacy, security-adjacent, and mobile-memory risk all at once), S31 (M21-1 — a new headless-browser dependency feeding the security-sensitive answerer), and S32 (BVA authority-tier tagging methodology — a legal-judgment call where getting it wrong has real downstream consequences for a veteran relying on cited authority). **Fable 5 is deliberately assigned to no sprint**: even at this larger scope, every sprint applies already-established patterns (lazy-loading, device-tiering, the existing chunk/embed pipeline, the dual-LLM security split) rather than requiring genuinely novel reasoning. If a sprint uncovers a redesign this scale, escalate to Fable rather than improvising.

### Explicitly NOT building (over-engineering guard)

| Rejected | One-line reason |
|---|---|
| Any server-side component | Full-corpus RAG is achieved via client-side sharded lazy-loading; a backend would break the documented zero-data-collection privacy architecture. |
| VA.gov API agent work | Human-blocked on re-credentialing (business/legal), not a technical gap this cycle can close. |
| Community KB scraping/integration | Human-blocked on pending copyright permission responses; scraping without affirmative permission is a legal risk, not an engineering decision. |
| Comparative international veteran-benefit-system content (Canada/UK/Australia/NATO systems as their own reference category) | Owner confirmed multinational scope means US veterans with qualifying overseas/allied *service*, not benefit systems of other countries. |
| All-50-states-at-once state-benefits build | Owner confirmed: phase by veteran population, prove the ingestion pattern on a few states before scaling to all 50 + territories. |
| ANN/HNSW vector index per shard | Per-shard corpora stay in the hundreds-to-low-thousands range; brute-force cosine (already proven sub-10ms in S21) remains sufficient. |
| Rebuilding the dual-LLM/PII/spotlight security layer | It is correct; this cycle feeds more shards into it, never redesigns it. |

---

## Sprint Plan (S27–S40)

### Phase A — Foundation (quality + architecture)

| # | Theme | Key deliverables | Definition of done | Model · Effort | Size |
|---|---|---|---|---|---|
| **S27** | Reconciliation & audit refresh | Refresh archive-audit numbers against current state; add OGC to `knowledge-sources.yaml`; document the two-system split plainly as intentional in `DIAMOND_KNOWLEDGE_BASE.md` | Updated numbers match a fresh count of the actual corpus files; OGC has a registry entry with real status; docs read as "two systems, by design" not "confusing duplication" | Sonnet 4.6 · M | ~2d |
| **S28** | Corpus quality & trust audit | Re-run/extend dedup integrity checks on the full 130K corpus; scan for reintroduced fabrication patterns against the historical `removed_fake_entries.json` signature; verify per-category counts vs. registry claims; refresh `DATA_INTEGRITY_REPORT.md`; establish the ongoing accuracy discipline (`source_url` + `last_verified` + `authority_tier` required on every entry, checked going forward, not just once) | Fresh integrity report with concrete pass/fail counts per category; zero newly-detected fabricated entries, or a filed list of suspects with evidence; accuracy-field schema documented and enforced in a lint/validate script | Haiku (bulk scan) + Sonnet (judgment/report) · M | ~3d |
| **S29** | Sharded full-corpus RAG architecture | Design + implement the shard model: one independently-lazy-loadable index per category (CFR, M21-1, CAVC, FedCir, OGC, BVA, presumptive, secondary, state-benefits, multinational) under `public/dkb-index/<shard>/`, each following the existing chunk/embed/manifest pattern from `scripts/legal-ingestion/`; cross-shard query fan-out in `legalRag.js` with authority-tier-aware ranking; device-tiered shard loading (reuse S22/S24 device-capability detection) | A query against any populated shard returns cited results; per-shard-loaded size stays ≤25MB even as total on-disk corpus grows; low-tier device profile loads only the shard(s) it queries; existing eCFR shard behavior is unchanged (regression-free migration) | **Opus 4.8** · L | ~5-6d |
| **S30** | Unified KB access layer | Audit every current consumer of KB data (`disabilityData.json`, `secondary_conditions_db.json`, `dbq_logic_map.json`, `pactActData.json`, `cfr3Regulations.json`, `title38Regulations.json`, AI system prompts, any chatbot/assistant surface); design one query API (e.g. `src/services/knowledgeQuery.js`) that all of them call through; migrate consumers one at a time with regression verification at each step | Every identified consumer reads through the unified API; zero behavior regressions (existing feature test suites green after each migration); a new consumer can query any shard without knowing its underlying file format | Sonnet 4.6 · L | ~5d |

### Phase B — Corpus shard build-out (previously identified gaps)

| # | Theme | Key deliverables | Definition of done | Model · Effort | Size |
|---|---|---|---|---|---|
| **S31** | M21-1 headless-browser fetcher | Puppeteer/Playwright fetcher against the real KnowVA SPA (or a reverse-engineered content API if one proves stable and documented); coverage-floor guard; weekly cron; re-chunk/re-embed into the M21-1 shard | M21-1 fetcher pulls real chapter/article content (not zero records); `verified_status: verified` in the registry with a real `last_verified` date; weekly cron succeeds end-to-end at least twice before declaring done | **Opus 4.8** · L | ~5d |
| **S32** | BVA full-corpus shard + authority-tier tagging | Index all 116,209 BVA entries into their shard (not a curated subset); tag each with a defensible precedential/non-precedential confidence label + citation-weight metadata; wire tier-aware ranking/caveating into the answerer so non-precedential entries never render as binding authority | 100% of BVA entries carry an authority-tier label; a spot-check sample confirms non-precedential entries surface with a clear non-binding caveat in the UI; precedential entries rank appropriately against CAVC/CFR in mixed queries | **Opus 4.8** (tagging methodology) + Sonnet/Haiku (bulk execution) · L | ~5d |
| **S33** | CAVC gap-fill + Federal Circuit fetcher | Close the CAVC 2007–2023 gap (via `search.uscourts.cavc.gov` or an equivalent stable source); build a real Federal Circuit fetcher covering key veterans-law cases (Procopio, Kirkpatrick, Martin, and similarly load-bearing opinions); handle PDF-shaped source parsing | CAVC shard spans 1989–present with no multi-year gaps; Federal Circuit shard has ≥20 verified key cases with correct citations; both registry entries move to `verified` | Sonnet 4.6 · M-L | ~4d |
| **S34** | OGC opinions integration | Registry entry + verified fetcher for VA OGC precedent opinions (1987–2019, ~100–200 opinions); integrate as a policy-tier shard | OGC has a `knowledge-sources.yaml` entry with `verified_status: verified`; shard is queryable and ranks correctly relative to CFR/CAVC/BVA tiers | Sonnet 4.6 · M | ~2-3d |
| **S35** | Rating schedule + DBQ structured data | Verify/complete `disabilityData.json` rating-criteria coverage per diagnostic code (0/10/30/50/70/100% structured criteria, pyramiding restrictions, combined-rating rules); verify `dbq_logic_map.json` against the full 70+ DBQ list from the archive audit | Every in-scope diagnostic code has structured (not prose-only) rating criteria; DBQ map covers ≥70 conditions with evidence-checklist mapping; gaps are enumerated, not silently skipped | Sonnet (extraction logic) + Haiku (bulk entries) · M | ~3d |

### Phase C — New source categories

| # | Theme | Key deliverables | Definition of done | Model · Effort | Size |
|---|---|---|---|---|---|
| **S36** | State VA benefits — pattern + pilot | Design a per-state benefit schema (property tax exemption, state VA homes, education/tuition waivers, hiring preference, license plates, state VA hospital network); build an ingestion pattern against official state VA websites; pilot on the ~3 highest-veteran-population states | Schema documented and reused without rework in S37; 3 pilot states fully populated with `source_url` + `last_verified` per entry; ingestion pattern proven repeatable (not one-off manual work) | Sonnet 4.6 · M-L | ~4d |
| **S37** | State VA benefits — phased rollout | Apply the S36 pattern across the remaining top-~12-15 states by veteran population (e.g. CA, TX, FL, PA, NY, OH, GA, NC, VA, AZ, IL, WA — verify actual current VA population data before finalizing the list, don't assume this ranking is current) | All targeted states populated to the same schema depth as the S36 pilots; remaining 50-state + territory rollout explicitly deferred to a future cycle with a clear "not yet covered" list, not silently implied complete | Haiku (templated) + Sonnet (edge cases) · M-L | ~4-5d |
| **S38** | Multinational/OCONUS service content | Foreign-service presumptive-exposure claims (e.g. overseas radiation sites, burn pit exposure locations already PACT-Act-adjacent), Foreign Medical Program guidance, OCONUS claims-filing procedures, combined/allied-service credit rules for qualifying VA benefits | New shard covers the above categories with real `.gov`/statutory sourcing; explicitly scoped as US-veteran-benefit content about overseas service, not a comparative international-systems reference | Sonnet 4.6 · M | ~3d |

### Phase D — Integration, freshness, and accuracy gates

| # | Theme | Key deliverables | Definition of done | Model · Effort | Size |
|---|---|---|---|---|---|
| **S39** | Sharded freshness/CI gate rollout | Extend the `dkb-freshness.yml` weekly hash-drift/coverage-floor pattern to every shard shipped in S31–S38; per-shard `verified_status`/`last_verified` tracked in `knowledge-sources.yaml` | Every shard has a weekly automated freshness check; a drifted or broken source opens an issue/PR the same way the existing eCFR check does, not silently going stale | Haiku 4.5 · M | ~2-3d |
| **S40** | Docs reconciliation + final architecture writeup | Final update to `DIAMOND_KNOWLEDGE_BASE.md` / `KNOWLEDGE_BASE_ARCHITECTURE.md` / `RAG_DESIGN.md` / `knowledge-sources.yaml` reflecting the shipped sharded, full-coverage, unified-access-layer state; retire stale archive-audit pointers | Docs match shipped code (spot-audited, same bar as S26); no reader is misled by a doc describing the pre-S27 eCFR-only state | Haiku 4.5 · S | ~2d |

**Dependencies.** S28 depends on S27. S29 and S30 depend on S28 — don't shard or expose a corpus whose integrity is unverified — and are largely parallelizable with each other. S31–S35 depend on S29 (need the shard architecture to land content into) and are parallelizable with each other; S32 additionally depends on S28's accuracy discipline. S36–S38 depend on S29/S30 (new categories need the shard model and unified access layer to slot into) and are parallelizable with each other and with Phase B. S39–S40 depend on all of S31–S38 (they document/gate the final state, mirroring S26's closing-hygiene role).

**Total ≈ 45–50 dev-days across 14 sprints.** Model distribution: **Opus ×3 (S29, S31, S32), Sonnet ×8 (some shared with Haiku), Haiku ×5 (some shared with Sonnet), Fable ×0.**

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Headless-browser fetcher fragility — KnowVA's Angular SPA changes without notice | Med | High | Loud-failure fetchers + coverage floors (existing pattern from eCFR); weekly cron surfaces breakage within a week, not silently |
| BVA authority-tier mislabeling — a non-precedential decision gets cited as binding | Med | High | Conservative tagging criteria set by Opus-level review; explicit confidence flag surfaced in the UI; never silently upgrade a tier |
| Sharded corpus growth threatens per-shard budget or low-end mobile device storage | Med | Med | Per-shard size check every build; lazy-load only what's queried; device-tier gating reused from S22/S24 |
| State-benefits data drifts (states change programs yearly, differently from federal cadence) | Med | Med | Per-state `last_verified` + registry entry; same freshness-CI pattern as federal sources, just a different refresh cadence |
| Unified access layer migration breaks an existing consumer | Med | High | Migrate one consumer at a time with regression verification (existing test suite green) before moving to the next; never a big-bang cutover |
| Legacy Python scraper unreliability (the ad-hoc `llm-compiler/scrapers/` swarm) | Med | Med | Prefer hardening the existing Node `scripts/legal-ingestion/` pattern over reviving the legacy swarm where feasible |
| Eval overfitting as the golden set grows across many new shards | Med | Med | Extend the S18 held-out-slice discipline to new-shard queries; tuning restricted to the non-held-out portion |
| Cross-shard retrieval fusion weakens single-shard precision (e.g. CFR results diluted by BVA volume) | Med | Med | Authority-tier-aware ranking (S29) plus per-shard eval baselines before and after fan-out is enabled |

---

## Appendix: Human-Blocked Items (zero agent sprints — tracked only)

| Item | Status | Owner | Unblock condition |
|---|---|---|---|
| VA.gov API re-enablement | Disabled behind `VITE_VA_API_ENABLED=false` pending re-credentialing at developer.va.gov | Product + legal | One-flag flip (`VITE_VA_API_ENABLED=true`) once VA sandbox/production access is restored — see [COMPLIANCE_STRATEGY.md](./COMPLIANCE_STRATEGY.md) re-evaluation triggers |
| Community KB permissions | Permission emails sent 2026-01-23 to VeteransBenefitsKB.com and RaterHQ; r/VeteransBenefits API application pending | Whoever sent the original requests | Affirmative written permission received — do not scrape without it (copyright); see [KNOWLEDGE_BASE_ARCHITECTURE.md](./KNOWLEDGE_BASE_ARCHITECTURE.md) permission-tracker table |

---

## Metrics — the definition of "complete and accurate"

- **Corpus coverage:** every category in the 130K corpus, plus the new state-benefits and multinational categories, reaches `verified` status in `knowledge-sources.yaml` with a real `last_verified` date. (Currently: only eCFR is verified.)
- **Accuracy/trust:** every entry across every shard carries `source_url` + `last_verified` + `authority_tier`. No entry renders in any UI without a citation a veteran or VSO could independently check.
- **Accessibility:** 100% of current KB consumers (rating calculator, secondary-condition finder, DBQ generator, C-File analyzer, any AI assistant surface, "Ask the Regs") migrated to the unified query layer — no feature maintains its own stale flat-file copy going forward.
- **Full-corpus query capability:** a query against BVA, CAVC, M21-1, state-benefits, or multinational-service content returns cited, authority-tier-labeled results through the same answerer UI as "Ask the Regs" does today for eCFR.
- **Budget discipline held:** per-shard lazy-loaded size stays ≤25MB; low-tier device profile never downloads more than the shard(s) a given query actually needs.

---

## Verification Matrix

| Workstream | Automated proof | Manual* |
|---|---|---|
| Corpus integrity (S28) | Dedup/fabrication scan script output, count deltas vs. registry claims | * spot-check a sample of flagged/borderline entries |
| Shard architecture (S29) | Per-shard eval baseline (`npm run eval:rag -- --check-baseline`, extended to new shards); per-shard size check | * low-end device real-world load test |
| Unified access layer (S30) | Existing feature test suites green after each consumer migration | * manual pass through each migrated feature |
| New fetchers (S31, S33, S34) | Coverage-floor assertions; weekly cron succeeds twice before "done" | — |
| BVA tagging (S32) | Authority-tier label present on 100% of entries (unit-asserted) | * spot-check precedential vs. non-precedential sample against source |
| State/multinational content (S36-S38) | Schema-validation script; `source_url`/`last_verified` present on every entry | * spot-check a few entries against the official state site |
| Freshness CI (S39) | Weekly workflow run opens issue/PR on drift, same as existing eCFR check | — |
| Docs (S40) | Spot-audit: docs match shipped code | — |

*(* = manual-only, owner-run, matching the convention established in [SPRINT_PLAN_S18-S26_KB_INGESTION.md](./SPRINT_PLAN_S18-S26_KB_INGESTION.md)'s own Verification Matrix.)*
