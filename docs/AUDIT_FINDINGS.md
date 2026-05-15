# Audit Findings — Best-Practices Implementation Scoreboard

> Companion to [SPRINT_PLAN.md](./SPRINT_PLAN.md). Sprint 2 fills this scoreboard guide-by-guide; subsequent sprints close the gaps.
>
> Status legend: `compliant` (full evidence) · `partial` (some controls present) · `gap` (not implemented) · `n/a` (justified non-applicable) · `pending` (not yet audited)
>
> Severity legend: `critical` (must fix in Sprint 3) · `high` · `med` · `low`
>
> Target-sprint maps the remediation to Sprints 3–8.

---

## Executive summary

End-of-Sprint-3 snapshot. Sprint 2's audit pass surfaced 3 critical and 17 high findings; Sprint 3 closed the AI/agent-safety subset and produced docs/THREAT_MODEL.md. Detailed Sprint 3 deltas appear in §"Sprint 3 closeout" below the scoreboard.

**Critical findings — fix-window mapping:**

- **supply-chain-security** (gap) — `protobufjs` RCE [GHSA-xq3m-2v4x-88gg](https://github.com/advisories/GHSA-xq3m-2v4x-88gg) + 5× xmldom high. **Fix in S8** (Renovate-driven update). Out-of-stack to S3 (not an app vulnerability, dependency-tree).
- **red-team** (gap) — no LLM red-team / OWASP LLM Top 10 / MITRE ATLAS coverage on the [unifiedAIService.js](../src/utils/unifiedAIService.js) pipeline. **Fix in S3** (PyRIT/Promptfoo harness, indirect-injection fixtures, agent-scope tests).
- **performance-engineering** (gap) — initial JS ~3.4 MB ungz / ~825 KB gz vs ≤300 KB gz target. **Fix in S5** (bundle visualizer, code-split AI/vision modules, lazy chunks).

**High-severity themes for Sprint 3 (AI/security hardening):**

- Prompt-injection hygiene missing across [aiSystemPrompts.js](../src/utils/aiSystemPrompts.js) and [unifiedAIService.js](../src/utils/unifiedAIService.js) (no spotlight delimiters, OCR text → system prompt raw).
- DOMPurify noop shim in [vite.config.js](../vite.config.js); 4 `dangerouslySetInnerHTML` sites surfaced by S1 SAST.
- No CSP header. No tamper-evident model I/O audit log. No threat model document. No compliance framework selection.
- piiScrubber 3 unresolved TODO edge cases. No key-rotation, no device-deauth, no Web Crypto audit on the local-first storage layer.

**High-severity themes for Sprint 4 (test coverage + monolith split):**

- ~5–9% test coverage vs 70% target — gap in [vitest.config.js](../vitest.config.js) thresholds is dramatic.
- [App.jsx](../src/App.jsx) 181 KB / 3,913 lines / 93 useState hooks — single highest-risk refactor.
- Three parallel test trees (`src/__tests__/`, `src/test/`, `tests/`) — consolidate.
- Only 4 `React.lazy()` instances across ~40 modal-shaped components.
- No agentic-testing golden set / eval harness for the swarm/AI pipeline.

**Sprint 5 wins (closed 2026-05-15):**

- `Tooltip` primitive shipped at [src/components/common/Tooltip.jsx](../src/components/common/Tooltip.jsx) (role="tooltip", Esc dismissal, hover persistence, aria-describedby linkage, 200/80ms delays).
- JSX-aware codemods converted 118 native `title=` → `aria-label=` across HTML element tags and surgically removed 21 redundant `title=` attrs where `aria-label=` already existed. All converted files lint cleanly.
- Real-component axe-core coverage: new [`modals.test.jsx`](../src/__tests__/a11y/modals.test.jsx) exercises `AIConsentModal` (3 cases) + `Tooltip` primitive (2 cases) against axe; 5/5 pass.
- Native web-vitals capture at [src/utils/webVitals.js](../src/utils/webVitals.js) (LCP/CLS/INP/FCP/TTFB via `PerformanceObserver`, no npm dep) wired into [main.jsx](../src/main.jsx); surfaces via `window.__VITALS__` + `web-vital` `CustomEvent` for devtools/e2e introspection.
- `rollup-plugin-visualizer` wired via `npm run build:analyze` ([vite.config.js](../vite.config.js)); outputs `dist/bundle-report.html` (treemap + gzip + brotli).
- Service worker, reduced-motion CSS, bundle-budget gate landed previously (commits `4e4bc24`, `5c3d348`).
- Full vitest suite: 571/571 passing across 34 test files after the localStorage shim in [setup.js](../src/__tests__/setup.js).
- Honest gap: NVDA + Lighthouse perf-budget run is a manual item I cannot perform in this environment.

**Sprint 6 wins (closed 2026-05-15):**

- eCFR fetcher refactored to current API ([scripts/legal-ingestion/fetch-ecfr.mjs](../scripts/legal-ingestion/fetch-ecfr.mjs)): scaffold's defunct `/api/versioner/v1/full/{date}/title-N.json` endpoint (HTTP 406) replaced with structure + renderer split (`structure/{date}/title-N.json` → JSON tree, `renderer/v1/content/enhanced/{date}/title-N?part=X&section=Y` → HTML body). CLI flags `--part=N,...` and `--limit=K` for narrow runs.
- Cross-platform entry-point detection fixed across all 8 ingestion scripts. The scaffold's string-template comparison against `process.argv[1]` produced a `file://` URL with two slashes; on Windows `import.meta.url` is `file:///e:/...` with three, so `main()` never ran. Replaced with `pathToFileURL(process.argv[1]).href`.
- Embedder pooling option fixed in [embed.mjs](../scripts/legal-ingestion/embed.mjs): `pooling: 'mean'` moved from pipeline construction (where transformers.js ignored it, producing `[1, T, 384]` tensors that overflowed the Q8 buffer) to call-time invocation (now correctly produces `[1, 384]` pooled vectors).
- End-to-end run verified against 38 CFR Part 4 (the rating-schedule core): 101 sections → 226 chunks → 226 × 384-dim Q8 vectors (86 784 bytes). Manifest at [public/legal-index/v0.1.0/manifest.json](../public/legal-index/v0.1.0/manifest.json).
- Content-hash determinism confirmed: two back-to-back fetches over the same `2026-05-01` eCFR snapshot produced byte-identical `content_hash` arrays across all 5 sampled records — the cron's diff-on-change detection will not be flapping on identical content.
- `.work/` (transient JSONL between fetcher and chunker) added to `.gitignore`.
- Known gaps deferred: M21-1 / CAVC / Fed-Cir fetchers remain unverified scaffolds (the canonical URL surfaces vary and need live probing); Parts 3, 19, 20 not yet fetched (Part 4 covers the highest-value content — the rating schedule). Both items belong to S7's cron-wiring step.

**Sprint 7 wins (closed 2026-05-15):**

- [src/services/legalRag.js](../src/services/legalRag.js): lazy index loader (`loadManifest` → per-source `loadSource` on first hit), Q8 cosine via `cosineQ8(queryVec, bin, idx)`, top-K + threshold filter in `query()`. Embedder pipeline cached at the module level after first invocation.
- [src/services/legalAnswerer.js](../src/services/legalAnswerer.js): PII-scrub → retrieve → `createDualLLM(generateAI)` extractor → synthesizer. Refuses ("I don't have a current citation that directly addresses that question") when retrieval is empty or no fact is applicable. Surfaces `injectionAttempt: true` when the extractor flags an instruction inside retrieved text.
- [src/components/LegalCitation.jsx](../src/components/LegalCitation.jsx) + `LegalCitationList`: badge with citation, gov-domain-checked source link (`sanitizeUrl(url, { requireGov: true })`), `fetched_at` date, optional cosine score. `rel="noopener noreferrer"`.
- [knowledge-sources.yaml](../knowledge-sources.yaml): registry of authoritative sources with `verified_status`, `last_verified`, and refresh cadences. Closes the knowledge-monitoring-best-practices registry gap on finding #16.
- [.github/workflows/legal-ingestion.yml](../.github/workflows/legal-ingestion.yml): weekly cron (`0 4 * * 1` UTC) + `workflow_dispatch`. Runs `run-all.mjs`, opens a PR titled `chore(legal): refresh index → v{x.y.z}` on diff exit code 2, files a `legal-ingestion-stale` issue on any other non-zero exit. Diff artifact retained 30 days.
- 32 new tests under `src/__tests__/services/` and `src/__tests__/components/LegalCitation.test.jsx`: cosine determinism, query() with mocked fetch+embedder, dim-mismatch refusal, refusal paths (zero chunks, no applicable fact, injection attempt), happy-path synthesis with citation extraction, PII-scrubbed query verification, link rendering with non-gov URL rejection, axe-clean rendering. Full suite: 591/591 across 37 files (up from 571/571 / 34).
- Known gaps deferred: no integration into existing call sites ([claimNavigatorEngine.js](../src/utils/claimNavigatorEngine.js), [llmRecommendations.js](../src/utils/llmRecommendations.js)) — services exist standalone, wiring deferred to avoid regression risk on the unrelated existing claim-flow. `LegalKnowledgeFreshness.jsx` settings panel not built. Static-data cross-validation against the index moves to S8.

**High-severity themes for Sprint 8 (supply chain + DevOps):**

**High-severity themes for Sprint 8 (supply chain + DevOps):**

- npm audit: 1 critical + 5 high + 1 moderate. No Renovate / Dependabot grouping. No SBOM. No artifact signing.
- ~1,215 `console.log` calls in src/ — no structured logging, no OpenTelemetry, no privacy-preserving local audit log.
- preflight missing markdownlint, link-validation, dead-code (knip), license check, SBOM (syft), Lighthouse-CI.

**Sprint 1 wins (carried into this snapshot):**

- gitleaks: 0 leaks across 108 commits / 99 MB.
- VA API surface fully gated behind one env flag — `va-veteran-tech-best-practices` = compliant.
- Mirror files (CLAUDE.md + 4 sibling files) diff-clean against the toolkit propagator.

---

## Counts at a glance

End-of-Sprint-3 snapshot:

| Status | S2 close | S3 close |
|---|---|---|
| compliant | 2 | 7 |
| partial | 22 | 19 |
| gap | 11 | 9 |
| n/a | 4 | 4 |
| pending | 1 | 1 |

| Severity | S2 close | S3 close |
|---|---|---|
| critical | 3 | 2 |
| high | 17 | 9 |
| med | 12 | 16 |
| low | 4 | 9 |

> S3 closed: rows 2, 4, 5, 7, 17 (compliant). Rows 8, 12, 13 downgraded in severity.
> Sprints 4–8 close the remaining 9 gaps + 9 high-severity items.

---

## Scoreboard

| # | Guide | Dimension | Status | Severity | Evidence | Target sprint | Notes |
|---|---|---|---|---|---|---|---|
| 1 | claude-code-best-practices | AI/universal | n/a | low | Project uses local LLM stack (web-llm / wllama / transformers.js); Claude Code patterns (hooks, worktrees, skills) not used in app code | — | Mirror files cover the universal AI-rule subset already (compliant). |
| 2 | ai-prompt-engineering-best-practices | AI/universal | compliant | low | `spotlight()` + `untrustedSection()` helpers added to [aiSystemPrompts.js](../src/utils/aiSystemPrompts.js); BASE_SYSTEM_PROMPT now carries the INSTRUCTION-vs-DATA rule (Sprint 3 commit `bb6455a`); `constructSafePrompt` + `formatDKBEntry` updated to wrap untrusted content. | — | S3 closed. Integration into all call sites continues into S4. |
| 3 | agentic-development-best-practices | AI/universal | partial | med | Diamond Swarm 3-agent orchestrator (Auditor / Writer / Rater) present in [unifiedAIService.js:287-300](../src/utils/unifiedAIService.js#L287); no worktree isolation, no checkpoint pattern, no behavior-contract / property assertions | 3 | Document agent boundaries + add tool-allowlist enforcement during S3 hardening. |
| 4 | ai-agent-security-best-practices | Security | compliant | low | Lethal-trifecta defenses landed: spotlight delimiters (`piiScrubber.spotlight`), dual-LLM split ([dualLLM.js](../src/utils/dualLLM.js)), append-only audit log ([aiAuditLog.js](../src/utils/aiAuditLog.js)), URL allow-list stripper ([sanitize.stripUntrustedUrls](../src/utils/sanitize.js)), 4× nosemgrep-justified `dangerouslySetInnerHTML` sites, dompurify-noop documented ([packages/dompurify-noop/README.md](../packages/dompurify-noop/README.md)), CSP verified ([index.html](../index.html)). | — | S3 closed. 44 red-team tests in [`src/__tests__/red-team/`](../src/__tests__/red-team/). |
| 5 | ai-security-controls-best-practices | Security | compliant | low | piiScrubber hardened (VA file, MRN, pattern ordering, /g statefulness fix); 58 adversarial tests; append-only hash-chained audit log with tamper detection. | — | S3 closed. |
| 6 | ai-memory-systems-best-practices | AI | gap | med | No CONTEXT_VAULT.md or session-log pattern; [veteranProfile.js](../src/utils/veteranProfile.js) is state store, not a durable memory layer; static JSON `lastVerifiedDate` exists but unused programmatically | 4 | Episodic memory layer added incidentally during S4 monolith split if time permits, else deferred. |
| 7 | prompt-engineering-advanced-best-practices | AI | compliant | low | Lethal-trifecta clause now in BASE_SYSTEM_PROMPT; all derived prompts inherit it. Dual-LLM split provides hard separation between data-side and instruction-side LLM calls. | — | S3 closed via commits `bb6455a` + `f733ef2`. |
| 8 | red-team-best-practices | Security | partial | med | 44-payload red-team test suite in [`src/__tests__/red-team/`](../src/__tests__/red-team/) covers direct + indirect injection, exfiltration prompts, URL bait, schema hijack, PII obfuscation, and mixed-vector attacks. OWASP LLM Top 10 mapping documented in [THREAT_MODEL.md §6](./THREAT_MODEL.md). | 8 | Promote to `compliant` after S8 adds an automated promptfoo / PyRIT eval in CI. |
| 9 | agentic-testing-best-practices | Testing | gap | high | No golden set (.jsonl) found; no eval harness; no LLM-as-judge rubric; swarm agents lack regression coverage; [aiStatementHelper.js](../src/utils/aiStatementHelper.js) does not snapshot trajectories | 4 | S4 establishes ≥30-example golden set per agent + Vitest-driven eval pipeline. |
| 10 | token-optimization-best-practices | AI | partial | med | [unifiedAIService.js:112-123](../src/utils/unifiedAIService.js#L112) `getUserTokenLimit()` with 2048 default; AI_PRESETS defined. Prompt caching is a Claude API concept — not applicable to local LLMs; Gemini fallback unwired for cache breakpoints | 4 | Low priority; pick up alongside S4 perf work. |
| 11 | va-veteran-tech-best-practices | Domain | compliant | low | VA API surface gated behind `VITE_VA_API_ENABLED` ([config/vaAuth.js](../src/config/vaAuth.js), [App.jsx](../src/App.jsx), [main.jsx](../src/main.jsx)) per S1 commit `aeebe47` | — | Re-audit when VA access is restored and flag flips to `true`. |
| 12 | compliance-strategy-best-practices | Compliance | partial | med | [THREAT_MODEL.md](./THREAT_MODEL.md) documents trust boundaries + OWASP LLM Top 10 mapping. Compliance framework selection (SOC 2 / ISO 27001 / NIST) intentionally deferred — premature without organizational legal sign-off. SECURITY.md, CONTRIBUTING.md, audit log infrastructure in place. | 8 | S8 adds framework selection rationale once legal context is determined. |
| 13 | zero-knowledge-local-first-best-practices | Privacy | partial | med | All storage via IndexedDB/localStorage; PII scrubbed before any cloud call; aiAuditLog stores sha256 digests not raw text. No encryption-at-rest layer yet (the data is on the user's device under their OS-level disk encryption). Web Crypto used only for `crypto.subtle.digest('SHA-256', ...)` in the audit chain — no PBKDF2/AES code in the codebase to audit. | 8 | If/when a key-derivation or device-sync feature lands, audit then. |
| 14 | vector-database-rag-best-practices | AI/data | partial | med | S6 closed the ingestion half: [fetch-ecfr.mjs](../scripts/legal-ingestion/fetch-ecfr.mjs) → [chunk.mjs](../scripts/legal-ingestion/chunk.mjs) → [embed.mjs](../scripts/legal-ingestion/embed.mjs) produces a deterministic v0.1.0 index (101 §s of 38 CFR Part 4, 226 chunks, bge-small-en-v1.5 Q8). Runtime retrieval + recall@k / MRR / NDCG eval still missing. | 7 | S7 wires `src/services/legalRag.js` + answerer + citation UI + weekly cron. |
| 15 | ai-research-best-practices | AI | n/a | low | Operational app over fixed regulatory domain (38 CFR); not a research project | — | — |
| 16 | knowledge-monitoring-best-practices | AI/ops | gap | high | [disabilityData.json:45](../src/data/disabilityData.json#L45) carries `lastVerifiedDate: "2026-01-18"` but no refresh mechanism; no `knowledge-sources.yaml`; no eCFR changedetection; no quarterly review CI job; no URL validity check in preflight | 7 | S7 wires weekly GitHub Action + diff-on-change PR opener. |
| 17 | threat-modeling-best-practices | Security | compliant | low | [docs/THREAT_MODEL.md](./THREAT_MODEL.md) covers scope, assets, trust boundaries (lethal-trifecta map), DFD, STRIDE per surface, OWASP LLM Top 10 mapping, and documented residual risk (7 open issues). | — | S3 closed. Update procedure in §8. |
| 18 | api-security-best-practices | Security | partial | high | [api/va.js:99-159](../src/api/va.js#L99) handles 401/403; [vite.config.js](../vite.config.js) `/va-api` proxy is dev-only CORS bypass; rate limiter is global ([api/va.js:44-89](../src/api/va.js#L44)), not per-user; OAuth state generated but no explicit post-redirect verification check beyond `useVaAuth` internal | 3 | S3 adds per-user rate-limit keying, CORS allow-list documentation, key-rotation tracking. |
| 19 | sast-preflight-integration-best-practices | DevSecOps | partial | high | gitleaks + semgrep wired into [scripts/preflight.js](../scripts/preflight.js) + [ci.yml](../.github/workflows/ci.yml) per S1; 44 SAST findings filed; `STRICT_SAST` toggle present for graduating to blocking | 3 | Flip `STRICT_SAST=true` when S3 closes 4× XSS + exec() + document.write. |
| 20 | supply-chain-security-best-practices | DevSecOps | gap | critical | npm audit: protobufjs critical [GHSA-xq3m-2v4x-88gg](https://github.com/advisories/GHSA-xq3m-2v4x-88gg); xmldom 5× high; no Renovate / Dependabot grouping; no SBOM; no artifact signing (Cosign / SLSA provenance) | 8 | **Critical (dependency-tree, not app code)** — S8 introduces Renovate + grouped automerge + CycloneDX SBOM + signed releases. |
| 21 | devsecops-pipeline-best-practices | DevSecOps | partial | high | [ci.yml](../.github/workflows/ci.yml) runs lint, test+coverage, build, E2E, npm audit, gitleaks, semgrep, codeql; missing: SBOM, signed artifacts, IaC scanning, pre-commit gitleaks (Husky), SLSA provenance | 8 | S8 closes SBOM + Cosign + STRICT_* flips. |
| 22 | network-security-best-practices | Security | n/a | low | Browser SPA — no network perimeter to secure (no firewall, IDS, segmentation, mTLS); Vite proxy is dev-only | — | Verify production deployment enforces TLS 1.3 + HSTS at hosting layer — track outside this scoreboard. |
| 23 | frontend-react-best-practices | Frontend | partial | high | [App.jsx](../src/App.jsx) 3,913 lines / 181 KB / 93 useState hooks; only 4 `React.lazy()` instances; ~40 modal-shaped components imported eagerly | 4 | **S4 headline refactor** — split into `src/features/<region>/` with route-based code splitting. |
| 24 | accessibility | UX | partial | med | [`src/__tests__/a11y/accessibility.test.jsx`](../src/__tests__/a11y/accessibility.test.jsx) + new [`modals.test.jsx`](../src/__tests__/a11y/modals.test.jsx) (S5) now exercises `AIConsentModal` (real component) + `Tooltip` primitive against axe-core; localStorage shim in [setup.js](../src/__tests__/setup.js) unlocks context-provider tests. Remaining gap: 201 `aria-label` vs 38 `aria-describedby` (form-error association). | 5 | S5 closed for modal coverage; form-error association deferred — re-audit if user reports. |
| 25 | tooltip-ux-best-practices | UX | partial | med | S5 closed: [`Tooltip.jsx`](../src/components/common/Tooltip.jsx) primitive shipped (role="tooltip", aria-describedby, Esc dismissal, hover persistence, 200/80ms delays); JSX-aware codemod converted 118 `title=` → `aria-label=` across ~55 files and removed 21 redundant `title=` attrs; native `title=` no longer used as an accessible name on icon-only triggers. | — | Compliant once Tooltip primitive is adopted in remaining hover-affordance sites (replace residual `aria-label` icon buttons with Tooltip where a visible explanation helps). |
| 26 | design-systems-ai-best-practices | UX | partial | med | [tailwind.config.js](../tailwind.config.js) defines semantic tokens (service-blue, tactical-grey, medal-green); no Figma Variables sync; no Code Connect mappings; no Style Dictionary | 5 | S5 adds token documentation + system-preference detection. |
| 27 | pwa-privacy-best-practices | Frontend/privacy | partial | high | [public/manifest.json](../public/manifest.json) valid (192/512 + maskable + screenshots); no `public/sw.js`; no offline cache strategy; no `/offline.html` fallback | 5 | S5 adds service worker (stale-while-revalidate for data, cache-first for assets) + offline shell. |
| 28 | performance-engineering-best-practices | Performance | partial | high | S5 close: `rollup-plugin-visualizer` wired via `npm run build:analyze` ([vite.config.js](../vite.config.js)); native web-vitals capture (LCP/CLS/INP/FCP/TTFB) at [src/utils/webVitals.js](../src/utils/webVitals.js) — no `web-vitals` npm dep, surfaces via `window.__VITALS__` + `web-vital` CustomEvent; bundle-budget gate ([check-bundle-budget.mjs](../scripts/check-bundle-budget.mjs)) wired previously. Remaining: tree-shake App.jsx monolith + code-split AI/vision modules. | 8 | App.jsx feature-region split is the residual lever — tracked alongside finding #35. |
| 29 | html-css-best-practices | Frontend | partial | med | [src/index.css](../src/index.css) has mobile-first + safe-area-insets; Tailwind dark mode = `class`; ThemeContext supports 4 modes; **no** `prefers-reduced-motion` rules; no system-preference fallback on first load | 5 | S5 adds `@media (prefers-reduced-motion: reduce)` to all transitions. |
| 30 | testing | Testing | partial | high | 32 unit-test files (Sprint 4.1 consolidation); aiSystemPrompts.js now has 49 dedicated tests (Sprint 4.4). 4 Playwright specs covering smoke + search + safety + a11y (20 E2E tests). vitest thresholds still at 25–35% in [vitest.config.js](../vitest.config.js); raise to 70% after coverage push completes. | 4 | S4 close: raise thresholds + add tests for pdfFormFiller, claimNavigatorEngine, llmRecommendations, advancedOCR. |
| 31 | codebase-audit-best-practices | DX | partial | med | This document and [SPRINT_PLAN.md](./SPRINT_PLAN.md) ARE the audit artifact; ESLint configured but mostly warnings, not errors; no TS strict mode enforced in CI; magic numbers scattered in CSS + config | 4 | S4 enables ESLint `error` for security rules + TS strict mode in CI. |
| 32 | plan-audit-best-practices | DX | n/a | low | Meta-guide for sprint-plan docs; we have a plan in [SPRINT_PLAN.md](./SPRINT_PLAN.md); not applicable to running code | — | — |
| 33 | preflight-checks-best-practices | DevSecOps | partial | high | [scripts/preflight.js](../scripts/preflight.js) covers Phase 1 fix, Phase 2 prep, Phase 3 validate (lint/test/E2E/build/SECURITY/gitleaks/semgrep/contract/a11y/docs); missing: markdownlint, link validation, dead-code (knip), license auditor, SBOM (syft), Lighthouse-CI | 8 | S8 extends with the missing checks. |
| 34 | ide-tooling-best-practices | DX | partial | med | [.vscode/settings.json](../.vscode/settings.json) present; no `.editorconfig`; no explicit `.prettierrc`; no `.vscode/tasks.json` / `launch.json` / `extensions.json`; Husky + lint-staged wired | 8 | S8 adds the missing dotfiles. Light lift. |
| 35 | file-organization-best-practices | DX | partial | med | Test-dir consolidation done (Sprint 4.1 commit `2faba8d`): `src/test/` removed; vitest now uses only `src/__tests__/`; Playwright keeps `tests/`. Root file count + App.jsx 181 KB monolith remain. | 4 | S4 App.jsx feature-region split is deferred to a focused session (per user instruction). |
| 36 | developer-experience-best-practices | DX | partial | med | Comprehensive [README.md](../README.md); 45+ npm scripts; [CONTRIBUTING.md](../CONTRIBUTING.md); [.env.example](../.env.example); Husky wired; no `.devcontainer.json`; no Makefile | 8 | S8 adds devcontainer + Makefile for one-command setup. |
| 37 | technical-writing-best-practices | Docs | partial | med | [docs/index.md](./index.md); 108 doc files in [docs/](.); no Diátaxis structure; no doc-site generator (VitePress/Docusaurus); no markdownlint in preflight | 8 | S8 adds markdownlint + optional doc-site. |
| 38 | observability-monitoring-best-practices | Ops | gap | med | ~1,215 `console.log` calls in `src/`; no OpenTelemetry; no structured logging; no Sentry / Datadog (intentional under zero-knowledge stance); no health endpoints; no SLO burn-rate alerting; error boundary present but no centralized error tracking | 8 | S8 adds privacy-preserving local audit log + optional opt-in error reporting. |
| 39 | git-workflow | DX | compliant | low | Feature branches → main; conventional commits in use (`feat:`, `chore:`, `docs:`); Husky pre-commit → lint-staged; [CONTRIBUTING.md](../CONTRIBUTING.md) defines PR process; no explicit branch protection / CODEOWNERS visible | 8 | S8 enforces branch protection + CODEOWNERS at GitHub level. |
| 40 | project-management-best-practices | Process | partial | low | 8 sequential PR-prefixed branches (pr1-security → pr8-hygiene) imply a Shape Up cadence; [SPRINT_PLAN.md](./SPRINT_PLAN.md) + this scoreboard land formal artifacts; no OKR doc; no RICE/ICE prioritization framework; no retros/DORA tracking | 8 | S8 adds a lightweight risk register + post-mortem template. |

---

## How to update this scoreboard

1. Read the guide in `E:\VS_Studio\best-practices-toolkit\docs\best-practices\<name>.md`.
2. Run its checklist (most have one near the bottom).
3. Cite evidence with `[path/file.ext:N](../path/file.ext#L-N)` — required for any `compliant` or `partial` verdict. A `compliant` verdict with thin evidence must be downgraded to `partial`.
4. Pick severity (worst gap):
   - `critical` — direct security/PII leak, broken core behavior, lethal-trifecta exposure, or budget breach ≥3×.
   - `high` — blocks a stated sprint goal.
   - `med` — measurable improvement, not blocking.
   - `low` — polish or marginal relevance.
5. Assign target sprint (3–8). Security-critical findings move to Sprint 3 regardless of original placement; non-security critical (perf, supply-chain) stay in their natural sprint with a note.
6. Update Counts tables at top.
7. Add a bullet to the Executive summary if the finding is one of the top ~20.

---

## Sprint 4 partial close

**Landed:**

- `2faba8d` — Test-tree consolidation: src/test/ removed; 14 files reorganized
  into `src/__tests__/utils/`; 5 legacy duplicates renamed `*Legacy.test.js`
  (kept running until hand-merge). Vitest setup file moved to canonical
  location with React-Testing-Library cleanup hook. 517/517 tests pass.
- `7955f7a` — aiSystemPrompts.js coverage: 49 new tests covering spotlight,
  untrustedSection, detectDecisionText, constructSafePrompt, validateAIResponse
  (FORBIDDEN_PHRASES + CFR grounding + warnings), pattern-regex regression
  guards, and ANTI_HALLUCINATION_SUFFIX content guarantees. First dedicated
  test file for this 1499-LOC security-critical module.

**Deferred to a focused session (per user "pause before S4.5" instruction):**

- App.jsx (181 KB / 3,913 LOC / 93 useState) feature-region extraction into
  src/features/<region>/. Highest blast-radius change in the plan; needs eyes
  on each region as it lands. Per-extraction Playwright golden paths land
  alongside (not before).
- Vitest threshold bump to ≥70% — premature without the coverage push it
  enables. Hand-merge of the 5 `*Legacy.test.js` files into canonical also
  deferred to that session.
- Tests for pdfFormFiller (2933 LOC), claimNavigatorEngine (871), advancedOCR
  (1021), dd214VisionParser (995), llmRecommendations (885) — all currently
  untested. Sprint 4 follow-up.

---

## Sprint 3 closeout

**Defenses landed (in commit order):**

- `d14f688` — piiScrubber hardened: VA file numbers, MRN, pattern ordering (longest-first), /g lastIndex statefulness bug fixed, `spotlight()` + `scrubAndSpotlight()` helpers. 58 adversarial tests.
- `bb6455a` — `spotlight()` + `untrustedSection()` wired into [aiSystemPrompts.js](../src/utils/aiSystemPrompts.js). BASE_SYSTEM_PROMPT carries INSTRUCTION-vs-DATA rule for every derived prompt. constructSafePrompt + formatDKBEntry updated.
- `8f62299` — `safeHtml()` helper for `dangerouslySetInnerHTML` (markdown-lite + sanitizeUrl). 4 SAST sites annotated with justified `nosemgrep` and per-site defenses documented. dompurify-noop README explains the intentional no-DOMPurify design. CSP in [index.html](../index.html) verified comprehensive.
- `f733ef2` — Dual-LLM lethal-trifecta defense in [src/utils/dualLLM.js](../src/utils/dualLLM.js). Extractor sees raw untrusted content (spotlight-wrapped) and emits only structured JSON. Synthesizer never sees raw text. `_injection_attempt: true` short-circuit. 18 tests.
- `ccb17f1` — Append-only hash-chained AI audit log in [src/utils/aiAuditLog.js](../src/utils/aiAuditLog.js). Detects mutation, missing entries, broken prevHash links. 19 tests including 4 dedicated tamper-detection cases.
- *(this commit)* — `stripUntrustedUrls` + `isLLMOutputUrlAllowed` for LLM output; allow-list = va.gov, ecfr.gov, federalregister.gov, uscourts.cavc.gov, cafc.uscourts.gov, ssa.gov, house.gov, senate.gov. Red-team test suite (44 cases). [docs/THREAT_MODEL.md](./THREAT_MODEL.md).

**Total Sprint 3 test additions:** ~140 new test cases across piiScrubber, sanitize, dualLLM, aiAuditLog, red-team.

**Deferred to later sprints:**

- **STRICT_SAST=true flip** — most semgrep findings (e.g., the 4 dSetInnerHTML sites + App.jsx-internal patterns) are now justified or fixed, but a clean count requires the App.jsx feature-region split (S4) to complete first. Will flip in S4 or S8.
- **Wiring `aiAuditLog.logModelCallWithDigests` into the dual-LLM call site** — deferred to S4 alongside the App.jsx feature-region split so each consumer flips independently.
- **Compliance framework selection** — needs legal context (S8).
- **Worktree isolation between Diamond Swarm agents** — S8 follow-up.

---

## Out-of-stack guides (justified `n/a` at audit time)

Tracked here so future auditors don't re-evaluate. Justification: outside the React/JS/browser-first stack.

| Guide | Reason |
|---|---|
| kubernetes-best-practices | No k8s deployment surface. |
| ruby-rails-best-practices | Not in stack. |
| java-spring-best-practices | Not in stack. |
| csharp-dotnet-best-practices | Not in stack. |
| ue5-cpp-best-practices | Not in stack. |
| blockchain-web3-best-practices | Not in product scope. |
| flutter-dart-best-practices | Not in stack. |
| kotlin-android-best-practices | Not in stack. |
| swiftui-uikit-best-practices | Not in stack. |
| unreal-engine-mcp-best-practices | Not in scope. |
| nextjs-prisma-best-practices | Vite + React, no Next.js. |
| graphql-production-best-practices | REST + browser-local only. |
| postgresql-production-best-practices | No database — IndexedDB only. |
| redis-caching-best-practices | No server-side caching layer. |
| message-queue-best-practices | No background workers / queues. |
| chaos-engineering-best-practices | No production infrastructure. |
| gitops-platform-best-practices | No GitOps deployment. |

If product strategy ever pivots, re-add to the in-scope table above.

---

*End of scoreboard. Sprint 2 closed 2026-05-14.*
