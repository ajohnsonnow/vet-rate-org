# Legal Knowledge Ingestion Pipeline

Fetches → sanitizes → chunks → embeds → indexes the authoritative VA legal
corpus so the in-app LLM can answer rating questions with current citations.

Design rationale + threat model live in [docs/RAG_DESIGN.md](../../docs/RAG_DESIGN.md)
and [docs/THREAT_MODEL.md](../../docs/THREAT_MODEL.md). Sprint placement:
**Sprint 6** (this directory) builds the ingestion; **Sprint 7** wires the
runtime retrieval ([src/services/legalRag.js](../../src/services/legalRag.js))
and the weekly cron action.

## Sources

| Source | What we ingest | Fetcher |
|---|---|---|
| eCFR | 38 CFR Parts 3, 4, 19, 20 | `fetch-ecfr.mjs` |
| VA M21-1 | Adjudication manual | `fetch-m21-1.mjs` |
| CAVC | Precedential decisions (rolling 5-year window) | `fetch-cavc.mjs` |
| Federal Circuit | Veteran-law opinions | `fetch-fedcir.mjs` |

Every fetcher emits JSONL with the same schema:

```jsonc
{
  "source": "ecfr",           // ecfr | m21-1 | cavc | fedcir
  "jurisdiction": "federal",
  "citation": "38 CFR § 4.71a",
  "title": "Schedule of Ratings — Musculoskeletal System",
  "body": "…",                // HTML/script-stripped plain text
  "fetched_at": "2026-05-14T04:00:00Z",
  "source_url": "https://www.ecfr.gov/current/title-38/...",
  "content_hash": "sha256:…"  // for change detection across runs
}
```

## End-to-end usage

```bash
# 1) Run every fetcher → ingestion/{source}.jsonl
node scripts/legal-ingestion/fetch-ecfr.mjs
node scripts/legal-ingestion/fetch-m21-1.mjs
node scripts/legal-ingestion/fetch-cavc.mjs
node scripts/legal-ingestion/fetch-fedcir.mjs

# 2) Chunk + embed → public/legal-index/v{semver}/
node scripts/legal-ingestion/chunk.mjs
node scripts/legal-ingestion/embed.mjs

# OR run everything in one go
node scripts/legal-ingestion/run-all.mjs

# OR diff a new run against the previous index
node scripts/legal-ingestion/diff.mjs --against v0.1.0
```

## Output layout

```
public/legal-index/
└── v0.1.0/
    ├── manifest.json           # version, fetched_at, source_versions, total_chunks
    ├── chunks/
    │   ├── ecfr.jsonl          # one chunk per line
    │   ├── m21-1.jsonl
    │   ├── cavc.jsonl
    │   └── fedcir.jsonl
    └── vectors/
        ├── ecfr.bin            # Q8-quantized embeddings
        ├── m21-1.bin
        ├── cavc.bin
        └── fedcir.bin
```

The runtime ([src/services/legalRag.js](../../src/services/legalRag.js))
lazy-loads `manifest.json` first, then fetches the chunk + vector shards
on-demand. Total bundle target: ≤25 MB.

## Lethal-trifecta hardening

Every fetcher passes its raw HTML/markdown through
[sanitize-html.mjs](./sanitize-html.mjs) before chunking:

- Drops `<script>`, `<style>`, `<iframe>` tags entirely.
- Strips inline event handlers (`on*`).
- Replaces non-government URLs inline with `[external-link]`.
- Decodes HTML entities to a normalized form.

Combined with `untrustedSection()` delimiters added at retrieval time
(see [src/utils/aiSystemPrompts.js](../../src/utils/aiSystemPrompts.js)), the
pipeline meets the OWASP LLM01 indirect-prompt-injection bar documented in
[docs/THREAT_MODEL.md §5.3](../../docs/THREAT_MODEL.md).

## Failure modes

- **HTTP non-2xx** — script exits 1 with the URL + status. CI surfaces this
  as a failed weekly run (`legal-ingestion-stale` issue auto-filed).
- **Schema mismatch** — fail fast; do NOT silently coerce. A changed
  upstream API requires a human review.
- **Empty result** — fail fast; an empty fetch is more dangerous than a
  failed one (it would silently break the runtime).

## Determinism / reproducibility

Fetchers do not currently send ETag / If-Modified-Since headers; change detection is post-hoc. Each fetcher emits `content_hash` per record, and `diff.mjs` compares hashes between two index versions to detect the symmetric difference — used by the weekly cron action to open a PR titled `chore(legal): refresh index → v{x.y.z}` when changes are detected. Conditional-GET support (skipping unchanged resources) is a planned improvement — see [docs/SPRINT_PLAN_S18-S26_KB_INGESTION.md § S26](../../docs/SPRINT_PLAN_S18-S26_KB_INGESTION.md).

## Status: SCAFFOLD (Sprint 6)

These scripts are real code, structured for production use, but have NOT
been run against live sources in this session. Before promotion to CI:

1. Add `node scripts/legal-ingestion/fetch-ecfr.mjs` to a local devloop
   and verify it returns ≥1 record for a known section (e.g., § 4.71a).
2. Verify content-hash determinism: two runs over the same eCFR snapshot
   produce identical hashes.
3. Confirm chunker output passes the schema validator.
4. Run embed.mjs once locally to confirm transformer model loads + emits
   Q8-quantized vectors.

See [docs/SPRINT_PLAN.md § Sprint 6](../../docs/SPRINT_PLAN.md) for the
Definition of Done.
