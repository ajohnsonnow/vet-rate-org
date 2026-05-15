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

**High-severity themes for Sprint 5 (a11y + perf):**

- Axe-core suite skips modals (78 dialog elements untested).
- No service worker / offline shell (manifest.json present, sw.js absent).
- 181 `title=` attributes in components — fails WCAG 1.4.13 (no Esc dismissal, no hover persistence).
- No bundle analyzer; no web-vitals measurement.

**High-severity themes for Sprint 6–7 (RAG knowledge):**

- No vector DB. [llm-compiler/](../llm-compiler/) has scrapers + a static knowledge base but no integrated retrieval.
- Static [disabilityData.json](../src/data/disabilityData.json) carries a `lastVerifiedDate` but has no automated refresh.
- No knowledge-monitoring registry (knowledge-sources.yaml) or changedetection on eCFR.

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
| 14 | vector-database-rag-best-practices | AI/data | gap | med | [llm-compiler/](../llm-compiler/) scaffolds a knowledge base but no integrated vector retrieval in `src/`; no embedding model selected; no recall@k / MRR / NDCG evaluation | 6 | S6 builds eCFR/M21-1/CAVC/Fed-Cir ingestion → chunker → Q8 embeddings. |
| 15 | ai-research-best-practices | AI | n/a | low | Operational app over fixed regulatory domain (38 CFR); not a research project | — | — |
| 16 | knowledge-monitoring-best-practices | AI/ops | gap | high | [disabilityData.json:45](../src/data/disabilityData.json#L45) carries `lastVerifiedDate: "2026-01-18"` but no refresh mechanism; no `knowledge-sources.yaml`; no eCFR changedetection; no quarterly review CI job; no URL validity check in preflight | 7 | S7 wires weekly GitHub Action + diff-on-change PR opener. |
| 17 | threat-modeling-best-practices | Security | compliant | low | [docs/THREAT_MODEL.md](./THREAT_MODEL.md) covers scope, assets, trust boundaries (lethal-trifecta map), DFD, STRIDE per surface, OWASP LLM Top 10 mapping, and documented residual risk (7 open issues). | — | S3 closed. Update procedure in §8. |
| 18 | api-security-best-practices | Security | partial | high | [api/va.js:99-159](../src/api/va.js#L99) handles 401/403; [vite.config.js](../vite.config.js) `/va-api` proxy is dev-only CORS bypass; rate limiter is global ([api/va.js:44-89](../src/api/va.js#L44)), not per-user; OAuth state generated but no explicit post-redirect verification check beyond `useVaAuth` internal | 3 | S3 adds per-user rate-limit keying, CORS allow-list documentation, key-rotation tracking. |
| 19 | sast-preflight-integration-best-practices | DevSecOps | partial | high | gitleaks + semgrep wired into [scripts/preflight.js](../scripts/preflight.js) + [ci.yml](../.github/workflows/ci.yml) per S1; 44 SAST findings filed; `STRICT_SAST` toggle present for graduating to blocking | 3 | Flip `STRICT_SAST=true` when S3 closes 4× XSS + exec() + document.write. |
| 20 | supply-chain-security-best-practices | DevSecOps | gap | critical | npm audit: protobufjs critical [GHSA-xq3m-2v4x-88gg](https://github.com/advisories/GHSA-xq3m-2v4x-88gg); xmldom 5× high; no Renovate / Dependabot grouping; no SBOM; no artifact signing (Cosign / SLSA provenance) | 8 | **Critical (dependency-tree, not app code)** — S8 introduces Renovate + grouped automerge + CycloneDX SBOM + signed releases. |
| 21 | devsecops-pipeline-best-practices | DevSecOps | partial | high | [ci.yml](../.github/workflows/ci.yml) runs lint, test+coverage, build, E2E, npm audit, gitleaks, semgrep, codeql; missing: SBOM, signed artifacts, IaC scanning, pre-commit gitleaks (Husky), SLSA provenance | 8 | S8 closes SBOM + Cosign + STRICT_* flips. |
| 22 | network-security-best-practices | Security | n/a | low | Browser SPA — no network perimeter to secure (no firewall, IDS, segmentation, mTLS); Vite proxy is dev-only | — | Verify production deployment enforces TLS 1.3 + HSTS at hosting layer — track outside this scoreboard. |
| 23 | frontend-react-best-practices | Frontend | partial | high | [App.jsx](../src/App.jsx) 3,913 lines / 181 KB / 93 useState hooks; only 4 `React.lazy()` instances; ~40 modal-shaped components imported eagerly | 4 | **S4 headline refactor** — split into `src/features/<region>/` with route-based code splitting. |
| 24 | accessibility | UX | partial | high | [`src/__tests__/a11y/accessibility.test.jsx`](../src/__tests__/a11y/accessibility.test.jsx) covers forms / nav / tables but explicitly skips modals; 78 modal/dialog elements untested; 201 `aria-label` vs only 38 `aria-describedby` (form-error association gap) | 5 | S5 extends axe to all modal components + adds focus-trap + screen-reader pass. |
| 25 | tooltip-ux-best-practices | UX | gap | high | 181 native `title=` attributes across [src/components/](../src/components/); no positioned tooltip system; no `role="tooltip"` pattern; cursor-overlap risk on hover; no Esc-dismissal; fails WCAG 1.4.13 | 5 | S5 introduces CSS-based tooltip primitive with pointer-events:none + Esc handling. |
| 26 | design-systems-ai-best-practices | UX | partial | med | [tailwind.config.js](../tailwind.config.js) defines semantic tokens (service-blue, tactical-grey, medal-green); no Figma Variables sync; no Code Connect mappings; no Style Dictionary | 5 | S5 adds token documentation + system-preference detection. |
| 27 | pwa-privacy-best-practices | Frontend/privacy | partial | high | [public/manifest.json](../public/manifest.json) valid (192/512 + maskable + screenshots); no `public/sw.js`; no offline cache strategy; no `/offline.html` fallback | 5 | S5 adds service worker (stale-while-revalidate for data, cache-first for assets) + offline shell. |
| 28 | performance-engineering-best-practices | Performance | gap | critical | Initial JS ~3.4 MB ungz / ~825 KB gz — 4× over 200 KB budget; [vite.config.js](../vite.config.js) has 19 manual chunks but App.jsx monolith blocks tree-shaking; no bundle analyzer; no web-vitals measurement; lazy `<img>` absent (only 13 `<img>` tags across 158 components) | 5 | **Critical (perf)** — S5 adds `rollup-plugin-visualizer` + budget gate, code-splits AI/vision modules, preloads with `fetchpriority`. |
| 29 | html-css-best-practices | Frontend | partial | med | [src/index.css](../src/index.css) has mobile-first + safe-area-insets; Tailwind dark mode = `class`; ThemeContext supports 4 modes; **no** `prefers-reduced-motion` rules; no system-preference fallback on first load | 5 | S5 adds `@media (prefers-reduced-motion: reduce)` to all transitions. |
| 30 | testing | Testing | partial | high | ~16 unit-test files vs ~298 source files (~5%); [vitest.config.js:14-22](../vitest.config.js#L14) thresholds at 25–35% (target 70% per plan); 84 tests added in `17e7c32` (Florence-2 + SmolVLM); 4 Playwright specs in [tests/e2e](../tests/e2e/) | 4 | S4 raises to ≥70% global, ≥85% on named high-risk modules. |
| 31 | codebase-audit-best-practices | DX | partial | med | This document and [SPRINT_PLAN.md](./SPRINT_PLAN.md) ARE the audit artifact; ESLint configured but mostly warnings, not errors; no TS strict mode enforced in CI; magic numbers scattered in CSS + config | 4 | S4 enables ESLint `error` for security rules + TS strict mode in CI. |
| 32 | plan-audit-best-practices | DX | n/a | low | Meta-guide for sprint-plan docs; we have a plan in [SPRINT_PLAN.md](./SPRINT_PLAN.md); not applicable to running code | — | — |
| 33 | preflight-checks-best-practices | DevSecOps | partial | high | [scripts/preflight.js](../scripts/preflight.js) covers Phase 1 fix, Phase 2 prep, Phase 3 validate (lint/test/E2E/build/SECURITY/gitleaks/semgrep/contract/a11y/docs); missing: markdownlint, link validation, dead-code (knip), license auditor, SBOM (syft), Lighthouse-CI | 8 | S8 extends with the missing checks. |
| 34 | ide-tooling-best-practices | DX | partial | med | [.vscode/settings.json](../.vscode/settings.json) present; no `.editorconfig`; no explicit `.prettierrc`; no `.vscode/tasks.json` / `launch.json` / `extensions.json`; Husky + lint-staged wired | 8 | S8 adds the missing dotfiles. Light lift. |
| 35 | file-organization-best-practices | DX | partial | high | Root has ~37 files (target ≤15); three test dirs coexist (`src/__tests__/` + `src/test/` + `tests/`); [App.jsx](../src/App.jsx) 181 KB; 159 components flat in `src/components/`; ~30 scripts flat in `scripts/` | 4 | S4 consolidates test dirs, splits components by feature region, organizes scripts. |
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
