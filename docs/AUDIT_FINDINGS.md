# Audit Findings — Best-Practices Implementation Scoreboard

> Companion to [SPRINT_PLAN.md](./SPRINT_PLAN.md). Sprint 2 fills this scoreboard guide-by-guide; subsequent sprints close the gaps.
>
> Status legend: `compliant` (full evidence) · `partial` (some controls present) · `gap` (not implemented) · `n/a` (justified non-applicable) · `pending` (Sprint 2 hasn't audited yet)
>
> Severity legend: `critical` (must fix in Sprint 3) · `high` · `med` · `low`
>
> Target-sprint maps the remediation to Sprints 3–8.

---

## Executive summary

> Sprint 2 fills this section comprehensively. Below is a Sprint 1 partial — only findings the new gitleaks + semgrep wiring surfaced this sprint.

**Sprint 1 baseline findings (2026-05-14):**

- **Secrets:** 0 detected by gitleaks across 108 commits / 99 MB scanned. Baseline clean.
- **SAST (semgrep, 44 blocking findings):**
  - 4× `dangerouslySetInnerHTML` without sanitization: [BadgeDisplay.jsx:147](../src/components/BadgeDisplay.jsx#L147), [DbqFinder.jsx:254](../src/components/DbqFinder.jsx#L254), [RecordSearch.jsx:411](../src/components/RecordSearch.jsx#L411), [UserManual.jsx:3853](../src/components/UserManual.jsx#L3853). Target: Sprint 3 (CSP + DOMPurify-real, not noop shim).
  - 1× `window.document.write` from non-constant: [systemCapabilityCheck.js:420](../src/utils/systemCapabilityCheck.js#L420). Target: Sprint 3.
  - 1× Python `exec()`: [utils/vetrate_swarm.py:334](../src/utils/vetrate_swarm.py#L334). Target: Sprint 3.
  - 37 additional findings to be triaged in Sprint 2.
- **Supply chain (npm audit, 6 advisories):**
  - 1× **critical** — protobufjs arbitrary code execution ([GHSA-xq3m-2v4x-88gg](https://github.com/advisories/GHSA-xq3m-2v4x-88gg)). Target: Sprint 8 supply-chain hardening (Renovate-driven update).
  - 5× **high** — xmldom XML injection family. Target: Sprint 8.
  - 1× **moderate** — protobufjs overlong UTF-8 decoding.
- **Mirror files (CLAUDE.md, copilot-instructions.md, .cursor/rules/best-practices.mdc, .windsurfrules, .continuerules):** Diff-clean against the toolkit propagator output. Compliant.
- **Preflight + CI wiring:** gitleaks and semgrep now run on every PR via [.github/workflows/ci.yml](../.github/workflows/ci.yml) (security job) and `npm run preflight`. Both non-blocking until Sprint 3 / Sprint 8 close their backlog.

---

## Counts at a glance

| Status | Count |
|---|---|
| compliant | 1 |
| partial | 2 |
| gap | 1 |
| n/a | 0 |
| pending | 36 |

| Severity | Count (Sprint 1 only — Sprint 2 will populate the rest) |
|---|---|
| critical | 1 |
| high | 5 |
| med | 0 |
| low | 0 |

> Update both tables at the end of Sprint 2 and again at the end of Sprint 8.

---

## Scoreboard

| # | Guide | Dimension | Status | Severity | Evidence (file:line) | Target sprint | Notes |
|---|---|---|---|---|---|---|---|
| 1 | claude-code-best-practices | AI/universal | pending | — | — | — | — |
| 2 | ai-prompt-engineering-best-practices | AI/universal | pending | — | — | — | — |
| 3 | agentic-development-best-practices | AI/universal | pending | — | — | — | — |
| 4 | ai-agent-security-best-practices | Security | partial | high | XSS via dangerouslySetInnerHTML at 4 sites (BadgeDisplay/DbqFinder/RecordSearch/UserManual); DOMPurify shim is no-op in [vite.config.js](../vite.config.js); lethal-trifecta defenses not yet codified | 3 | S3 implements spotlight delimiters, dual-LLM split, real DOMPurify, CSP |
| 5 | ai-security-controls-best-practices | Security | pending | — | — | — | — |
| 6 | ai-memory-systems-best-practices | AI | pending | — | — | — | — |
| 7 | prompt-engineering-advanced-best-practices | AI | pending | — | — | — | — |
| 8 | red-team-best-practices | Security | pending | — | — | — | — |
| 9 | agentic-testing-best-practices | Testing | pending | — | — | — | — |
| 10 | token-optimization-best-practices | AI | pending | — | — | — | — |
| 11 | va-veteran-tech-best-practices | Domain | compliant | low | VA API surface fully gated behind `VITE_VA_API_ENABLED` flag pending re-credentialing ([config/vaAuth.js](../src/config/vaAuth.js), [App.jsx](../src/App.jsx), [main.jsx](../src/main.jsx)) | — | S1 commit `aeebe47` |
| 12 | compliance-strategy-best-practices | Compliance | pending | — | — | — | PHI / 38 CFR posture |
| 13 | zero-knowledge-local-first-best-practices | Privacy | pending | — | — | — | Aligns with browser-first stance |
| 14 | vector-database-rag-best-practices | AI/data | pending | — | — | — | Read end-to-end in S6 |
| 15 | ai-research-best-practices | AI | pending | — | — | — | — |
| 16 | knowledge-monitoring-best-practices | AI/ops | pending | — | — | — | Feeds S7 refresh design |
| 17 | threat-modeling-best-practices | Security | pending | — | — | — | — |
| 18 | api-security-best-practices | Security | pending | — | — | — | VA-API client paths |
| 19 | sast-preflight-integration-best-practices | DevSecOps | partial | high | gitleaks + semgrep wired into preflight + CI ([scripts/preflight.js](../scripts/preflight.js), [.github/workflows/ci.yml](../.github/workflows/ci.yml)); 44 SAST findings filed | 3 | Non-blocking until S3 closes findings. Strict mode toggle: `STRICT_SAST` env var. |
| 20 | supply-chain-security-best-practices | DevSecOps | gap | critical | npm audit: protobufjs critical [GHSA-xq3m-2v4x-88gg](https://github.com/advisories/GHSA-xq3m-2v4x-88gg); xmldom 5× high; no Renovate / SBOM yet | 8 | S8 handles via Renovate + grouped automerge + CycloneDX SBOM |
| 21 | devsecops-pipeline-best-practices | DevSecOps | pending | — | — | — | — |
| 22 | network-security-best-practices | Security | pending | — | — | — | CSP / HTTPS only |
| 23 | frontend-react-best-practices | Frontend | pending | — | — | — | App.jsx monolith |
| 24 | accessibility | UX | pending | — | — | — | WCAG 2.2 AA target |
| 25 | tooltip-ux-best-practices | UX | pending | — | — | — | — |
| 26 | design-systems-ai-best-practices | UX | pending | — | — | — | — |
| 27 | pwa-privacy-best-practices | Frontend/privacy | pending | — | — | — | — |
| 28 | performance-engineering-best-practices | Performance | pending | — | — | — | Bundle budget in S5 |
| 29 | html-css-best-practices | Frontend | pending | — | — | — | — |
| 30 | testing | Testing | pending | — | — | — | 70% target |
| 31 | codebase-audit-best-practices | DX | pending | — | — | — | Final sweep in S8 |
| 32 | plan-audit-best-practices | DX | pending | — | — | — | — |
| 33 | preflight-checks-best-practices | DevSecOps | pending | — | — | — | Extend scripts/preflight.js |
| 34 | ide-tooling-best-practices | DX | pending | — | — | — | — |
| 35 | file-organization-best-practices | DX | pending | — | — | — | src/features/ split in S4 |
| 36 | developer-experience-best-practices | DX | pending | — | — | — | — |
| 37 | technical-writing-best-practices | Docs | pending | — | — | — | — |
| 38 | observability-monitoring-best-practices | Ops | pending | — | — | — | — |
| 39 | git-workflow | DX | pending | — | — | — | — |
| 40 | project-management-best-practices | Process | pending | — | — | — | — |

---

## How to update this scoreboard (Sprint 2 procedure)

1. **Read the guide** in `E:\VS_Studio\best-practices-toolkit\docs\best-practices\<name>.md`.
2. **Run its checklist** (most guides have one near the bottom).
3. **Cite evidence** with `[path/file.ext:N](../path/file.ext#L-N)` — required for any `compliant` or `partial` verdict. A `compliant` verdict with thin evidence must be downgraded to `partial`.
4. **Pick severity** based on the worst gap the guide reveals:
   - `critical` — direct security or PII leak risk, broken core behavior, or lethal-trifecta exposure.
   - `high` — meaningful gap that blocks a goal (e.g., 70% coverage, WCAG AA).
   - `med` — improvement that delivers measurable value but isn't blocking.
   - `low` — polish, nice-to-have, or guide is only marginally relevant.
5. **Assign target sprint** (3–8). Critical findings move to Sprint 3 regardless of original placement.
6. **Update the Counts tables** at the top of this file.
7. **Add a line to the executive summary** if the finding is one of the top ~20.

---

## Out-of-stack guides (justified `n/a` at audit time)

Tracked here for completeness so future auditors don't re-evaluate. Justification: outside the React/JS/browser-first stack.

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

If product strategy ever pivots, re-add to the in-scope table above.

---

*End of scoreboard.*
