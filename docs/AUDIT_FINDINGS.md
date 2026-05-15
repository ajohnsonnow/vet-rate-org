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

> Filled at end of Sprint 2 with ≤20 bullets covering the top gaps and any critical findings escalated to Sprint 3.

- _pending Sprint 2_

---

## Counts at a glance

| Status | Count |
|---|---|
| compliant | 0 |
| partial | 0 |
| gap | 0 |
| n/a | 0 |
| pending | 40 |

| Severity | Count |
|---|---|
| critical | 0 |
| high | 0 |
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
| 4 | ai-agent-security-best-practices | Security | pending | — | — | — | Lethal-trifecta evidence required |
| 5 | ai-security-controls-best-practices | Security | pending | — | — | — | — |
| 6 | ai-memory-systems-best-practices | AI | pending | — | — | — | — |
| 7 | prompt-engineering-advanced-best-practices | AI | pending | — | — | — | — |
| 8 | red-team-best-practices | Security | pending | — | — | — | — |
| 9 | agentic-testing-best-practices | Testing | pending | — | — | — | — |
| 10 | token-optimization-best-practices | AI | pending | — | — | — | — |
| 11 | va-veteran-tech-best-practices | Domain | pending | — | — | — | Domain-critical |
| 12 | compliance-strategy-best-practices | Compliance | pending | — | — | — | PHI / 38 CFR posture |
| 13 | zero-knowledge-local-first-best-practices | Privacy | pending | — | — | — | Aligns with browser-first stance |
| 14 | vector-database-rag-best-practices | AI/data | pending | — | — | — | Read end-to-end in S6 |
| 15 | ai-research-best-practices | AI | pending | — | — | — | — |
| 16 | knowledge-monitoring-best-practices | AI/ops | pending | — | — | — | Feeds S7 refresh design |
| 17 | threat-modeling-best-practices | Security | pending | — | — | — | — |
| 18 | api-security-best-practices | Security | pending | — | — | — | VA-API client paths |
| 19 | sast-preflight-integration-best-practices | DevSecOps | pending | — | — | — | Sprint 1 lays the baseline |
| 20 | supply-chain-security-best-practices | DevSecOps | pending | — | — | — | SBOM + Renovate in S8 |
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
