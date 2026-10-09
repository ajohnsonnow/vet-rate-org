# `scripts/` — Build, Release, Data, and Dev Tooling

This directory holds every Node, PowerShell, Bash, and Python script the
repository uses outside of the application source tree. The catalogue below is
the canonical list of what each script does and which `npm run` command (if
any) invokes it. **Update this file when you add or rename a script.**

> Most scripts are intended to be run from the repo root via the `npm run`
> aliases listed in [`package.json`](../package.json). A handful are invoked
> directly (Python, PowerShell), and those are noted explicitly.

## How to read this catalogue

- `npm script` column = what to type. `—` means there is no npm alias and the
  script is invoked directly or by another script.
- `Trigger` column = whether the script runs automatically as part of another
  workflow (e.g. `build`, `husky` hook, CI).
- Sections are grouped by purpose, not file extension.

---

## 1. Build, version, and release

| Script | npm script | Trigger | Purpose |
|---|---|---|---|
| [`sync-version.js`](./sync-version.js) | `sync-version` | runs in `npm run build` | Mirrors `package.json` version into runtime constants. |
| [`update-stats.js`](./update-stats.js) | `update-stats` | runs in `npm run build` | Regenerates [`src/data/projectStats.json`](../src/data/projectStats.json) (lines, files, costs, tool count). |
| [`calculate-live-stats.js`](./calculate-live-stats.js) | — | called by `update-stats.js` | Pure calculator for the project-stats numbers. |
| [`update-docs.js`](./update-docs.js) | `update-docs` | runs in `npm run build` | Regenerates auto-built docs blocks (changelog snippets, badges). |
| [`update-changelog.js`](./update-changelog.js) | `update-changelog` / `changelog-preview` | manual | Walks git history and writes/proofs `CHANGELOG.md`. Use `--preview`. |
| [`smart-version.js`](./smart-version.js) | `version-auto` / `version-preview` | manual | Picks the next semver bump based on conventional-commit messages. Use `--dry-run`. |
| [`release.js`](./release.js) | `release` / `release:minor` / `release:major` / `release:preview` | manual | Bumps version, regenerates docs/stats, tags, pushes. |
| [`build-brands.js`](./build-brands.js) | `build:all` | manual | Builds both the `vetrate` and `supplylocker` brand bundles in one pass. |
| [`build_vetrate_compiler.sh`](./build_vetrate_compiler.sh) | — | manual (Linux/macOS) | One-shot build of the LLM-side compiler image used by `llm-compiler/`. |
| [`build-vision-model.sh`](./build-vision-model.sh) | — | manual (Linux/macOS) | Builds the on-device vision model bundle for DD214 OCR. |

## 2. Pre-deploy / preflight / push gating

| Script | npm script | Trigger | Purpose |
|---|---|---|---|
| [`preflight.js`](./preflight.js) | `preflight` / `preflight:fast` / `preflight:full` / `preflight:push` | runs from `husky` `pre-push` | Runs lint, tests, build, and docs sync in one gate. `--fast` skips the build, `--report` writes a JSON artefact, `--push` is the pre-push variant. |
| [`pre-deploy-check.js`](./pre-deploy-check.js) | `pre-deploy` / `pre-deploy:quick` | manual before deploys | Heavier pre-deploy gate that runs build + bundle-size + checks. `--skip-build` for the quick variant. |
| [`push-prep.js`](./push-prep.js) | `push-prep` / `push-prep:patch` / `push-prep:minor` / `push-prep:quick` | manual | Bumps version, regenerates derived files, then runs preflight before pushing. `-y` skips prompts. |
| [`squash-bug.js`](./squash-bug.js) | `squash-bug` | manual | Helper for collapsing a chain of fixup commits into a single user-visible bugfix commit. |

## 3. Data ingest, scrapers, and forms

| Script | npm script | Trigger | Purpose |
|---|---|---|---|
| [`fetch-dbqs.js`](./fetch-dbqs.js) | `fetch-dbqs` / `update-forms` | manual / scheduled | Pulls the latest DBQ form catalogue from VA.gov and syncs it into [`src/data`](../src/data). |
| [`download-publications.js`](./download-publications.js) | — | manual | Mirrors VA publications to local cache (used by the Publications Index tool). |
| [`extract-pdf-fields.js`](./extract-pdf-fields.js) | — | manual | Extracts AcroForm field names from a VA PDF and writes [`pdf-field-mappings.json`](./pdf-field-mappings.json). |
| [`pdf-field-mappings.json`](./pdf-field-mappings.json) | data file | — | Output of `extract-pdf-fields.js`. Consumed by the form-filler. |
| [`ingest-cfile.mjs`](./ingest-cfile.mjs) | — | manual | Local-only C-file ingestion smoke harness — never run in CI. |
| [`scrape-badge-images.mjs`](./scrape-badge-images.mjs) | — | manual | Pulls military badge images for the ribbon rack feature. |
| [`scrape-badges*.ps1`](./scrape-badges.ps1) (`v2`–`v5`) | — | manual (Windows) | PowerShell variants of the badge scraper, kept for cross-platform parity. |
| [`ribbon_scraper.py`](./ribbon_scraper.py) | — | manual | Python ribbon scraper (parallel implementation; do not delete without confirming `scrape-badges*` parity). |
| [`scrape_raterhq_youtube.py`](./scrape_raterhq_youtube.py) | — | manual | Pulls public RaterHQ YouTube transcripts for the knowledge base. |

## 4. Knowledge base and ratings data

| Script | npm script | Trigger | Purpose |
|---|---|---|---|
| [`add_verification_dates.py`](./add_verification_dates.py) | — | manual | Stamps verification dates onto KB entries. |
| [`validate_and_add_dates.py`](./validate_and_add_dates.py) | — | manual | Validates existing dates and back-fills missing ones. |
| [`analyze_gaps.py`](./analyze_gaps.py) | — | manual | Reports rating-criteria gaps in the KB. |
| [`check_kb_gaps.py`](./check_kb_gaps.py) | — | manual | Lighter gap-check used in interactive sessions. |
| [`final_gap_report.py`](./final_gap_report.py) | — | manual | Produces the formatted final gap report for review. |
| [`completeness_audit.py`](./completeness_audit.py) | — | manual | Audits per-condition completeness across the KB. |
| [`comprehensive_validation.py`](./comprehensive_validation.py) | — | manual | End-to-end KB validation pass. |
| [`complete_record_status.py`](./complete_record_status.py) | — | manual | Marks records complete after validation. |
| [`fix_missing_criteria.py`](./fix_missing_criteria.py) | — | manual | Patches records with missing rating criteria. |
| [`update_secondary_conditions_ecfr.py`](./update_secondary_conditions_ecfr.py) | — | manual | Re-syncs secondary-condition data from eCFR. |
| [`separate_knowledge_bases.py`](./separate_knowledge_bases.py) | — | manual | Splits a merged KB back into its source partitions. |
| [`dkb_comprehensive_audit.py`](./dkb_comprehensive_audit.py) | — | manual | Full audit of the Diamond KB. |
| [`dkb_mega_merge.py`](./dkb_mega_merge.py) | — | manual | Merges Diamond KB shards into one corpus. |
| [`dkb_web_optimizer.py`](./dkb_web_optimizer.py) | — | manual | Optimizes the Diamond KB for browser shipping. |
| [`CRITICAL_THYROID_FIX.py`](./CRITICAL_THYROID_FIX.py) | — | manual, kept for audit trail | One-off fix for a thyroid-rating data error. **Do not re-run** — kept as a record. |
| [`va-data*` (npm aliases)](../package.json) | `va-data` / `va-data:full` / `va-data:bva` | manual | Wraps the venv-Python `scripts/scrapers/va_data_pipeline.py` for VA data refreshes. |

## 5. LLM training and on-device models

| Script | npm script | Trigger | Purpose |
|---|---|---|---|
| [`setup_training_env.sh`](./setup_training_env.sh) | — | manual (Linux/macOS) | Sets up the Python venv + deps for LLM training. |
| [`verify_training_env.py`](./verify_training_env.py) | — | manual | Verifies the training env is healthy before a long run. |
| [`create_training_templates.py`](./create_training_templates.py) | — | manual | Generates prompt/template scaffolds for training. |
| [`expand_training_data.py`](./expand_training_data.py) | — | manual | Expands seed data with augmentations. |
| [`train_qwen_v2.py`](./train_qwen_v2.py) | — | manual | Trains the Qwen-based VetRate model. |
| [`execute_rater_output.py`](./execute_rater_output.py) | — | manual | Runs the trained model against held-out cases. |
| [`test_classifier.py`](./test_classifier.py) | — | manual | Smoke test for the classifier head. |
| [`test_search_fixes.py`](./test_search_fixes.py) | — | manual | Regression check for search-quality fixes. |
| [`test_swarm.py`](./test_swarm.py) | — | manual | Smoke test for the multi-agent "swarm" orchestrator. |
| [`start_diamond_server.sh`](./start_diamond_server.sh) | — | manual (Linux/macOS) | Boots the local Diamond inference server. |
| [`check-vision-model-fix.js`](./check-vision-model-fix.js) | `check-vision` | manual | Verifies the on-device vision-model patch is applied. |

## 6. Legal pages, glossary, manual

| Script | npm script | Trigger | Purpose |
|---|---|---|---|
| [`generate-legal-pages.js`](./generate-legal-pages.js) | `legal-sync` / `check-legal-pages` | runs in `npm run build` | Generates Privacy / ToS / Disclaimer pages from canonical sources. |
| [`sync-legal-pages.js`](./sync-legal-pages.js) | `sync-legal-pages` | runs in `npm run build` | Mirrors the generated legal pages into the React tree. |
| [`sync-glossary.js`](./sync-glossary.js) | — | manual | Syncs the VA terminology glossary into the bundled JSON. |
| [`sync-user-manual.js`](./sync-user-manual.js) | `sync-user-manual` | manual | Syncs the in-app user manual from the source markdown. |

## 7. Dev tooling and one-offs

| Script | npm script | Trigger | Purpose |
|---|---|---|---|
| [`launch-chrome-dev.ps1`](./launch-chrome-dev.ps1) | `dev:webgpu` / `dev:chrome` | manual (Windows) | Launches Chrome with the WebGPU flags Local-AI needs. See section below. |
| [`launch-chrome-dev.sh`](./launch-chrome-dev.sh) | `dev:webgpu` / `dev:chrome` | manual (macOS/Linux) | Same as above for Bash. |
| [`generate-admin-pin-hash.js`](./generate-admin-pin-hash.js) | — | manual | Generates an admin-PIN hash for local-only admin tooling. |
| [`validate-no-hardcodes.js`](./validate-no-hardcodes.js) | — | manual / CI | Scans the source tree for forbidden hard-coded URLs / IDs. |
| [`analyze-real-dd214.cjs`](./analyze-real-dd214.cjs) and [`.mjs`](./analyze-real-dd214.mjs) | — | manual | DD214 analysis harness. CJS + MJS variants for compatibility experiments. |
| [`test-dd214-parser.mjs`](./test-dd214-parser.mjs) | — | manual | Smoke test for the DD214 parser. |
| [`test-badge-parser.mjs`](./test-badge-parser.mjs) | — | manual | Smoke test for the ribbon/badge parser. |
| [`test-va-apis.js`](./test-va-apis.js) | — | manual | Pings the public VA Lighthouse endpoints to verify reachability. |

---

## Chrome WebGPU launcher (Local-AI development)

`launch-chrome-dev.ps1` (Windows) and `launch-chrome-dev.sh` (macOS/Linux) launch
Chrome with the experimental WebGPU flags WebLLM needs for `u8` WGSL types.
Use the npm alias instead of invoking the script directly.

```powershell
# Windows
npm run dev:webgpu
```

```bash
# macOS / Linux
npm run dev:webgpu
```

Required flags injected by these scripts:

```text
--enable-dawn-features=allow_unsafe_apis   # Required for u8 WGSL type
--enable-features=Vulkan                   # Faster GPU backend
--enable-unsafe-webgpu                     # Experimental WebGPU
--disable-web-security                     # Localhost dev only
--user-data-dir=/tmp/chrome-dev-webgpu     # Isolated profile
```

**Without these flags you'll see:**

```text
Error: 'u8' type used without 'chromium_experimental_subgroup_matrix' extension enabled
```

The launcher safely closes existing Chrome windows first and opens
`http://localhost:5173`. The isolated user-data-dir keeps experimental flags
out of your everyday Chrome profile.

---

## Conventions

1. **Add a row to the table above** when you add or rename a script. The
   `npm run` aliases live in [`package.json`](../package.json) — keep both in
   sync.
2. **Python scripts** assume the venv at `.venv/`. The `va-data*` aliases use
   `.venv/Scripts/python.exe` (Windows). On macOS/Linux, activate the venv
   first (`source .venv/bin/activate`) and call `python scripts/...` directly.
3. **PowerShell scripts** (`*.ps1`) require `pwsh` (PowerShell 7+) — the
   Windows-default `powershell.exe` (5.1) is not supported.
4. **One-off / archival scripts** (e.g. `CRITICAL_THYROID_FIX.py`) are kept
   for audit trail only. Do not re-run them.
5. **Never run any script in this directory inside CI without an explicit npm
   alias and a passing dry-run on a feature branch.**
