# Compliance Strategy

> Single-file rationale for what compliance frameworks vet-rate-org IS and ISN'T pursuing, and why. Living document — revisit at every major release or whenever counsel weighs in.

**Status:** non-binding. Authoritative legal posture comes from project counsel; this doc captures the engineering team's read so we don't accidentally drift into a framework we haven't agreed to support.

---

## TL;DR

| Framework | Posture | Why |
|---|---|---|
| **SOC 2** | Out-of-scope | Browser-only SPA. No server-side data plane, no shared infrastructure, no customer-data processing under contract. Type-1 audit would attest to ~3 controls; not cost-justified. |
| **ISO 27001** | Out-of-scope | Same reasoning as SOC 2 plus the formal ISMS overhead vs. team size. |
| **HIPAA** | Out-of-scope (no PHI) | Veterans' medical data is **never sent off-device**. PII scrubber runs before any cloud AI call. Re-evaluate if/when the product introduces a server-side PHI surface. |
| **NIST 800-53 / 800-218 (SSDF)** | **In-scope (informal)** | Lightweight alignment — many controls overlap with our existing AI-security posture. We aim at 800-218 v1.1 secure-software-development practices without formal attestation. |
| **OWASP ASVS L1** | **In-scope (target)** | Practical web-app baseline. Most L1 controls land naturally via our preflight + threat-model work. |
| **OWASP LLM Top 10** | **In-scope (verified)** | All 10 mapped in [THREAT_MODEL.md §6](./THREAT_MODEL.md); red-team suite (44 cases) under [`src/__tests__/red-team/`](../src/__tests__/red-team/) covers the relevant attack vectors. |
| **VA / VHA data-handling guidance** | **In-scope (informal)** | We process publicly-licensed regulatory text (38 CFR, M21-1, CAVC/Fed-Cir opinions). We do **not** integrate with VA APIs in production — the VA-API surface is feature-flagged off ([config/vaAuth.js](../src/config/vaAuth.js)). If/when it re-enables, re-audit. |

---

## What "in-scope informal" means here

We don't pursue formal attestation (audits, certifications). We treat the framework's control list as a checklist to compare our practices against and document gaps. The deliverable is [`docs/AUDIT_FINDINGS.md`](./AUDIT_FINDINGS.md), not a third-party assessor's report.

That posture works because:

1. **No customer contracts demand it.** This is a public-good app, not a SaaS sold to enterprises.
2. **No regulated data plane.** PHI / PII never leaves the user's device.
3. **The threat model is already documented.** [THREAT_MODEL.md](./THREAT_MODEL.md) covers scope, assets, trust boundaries, STRIDE-per-surface, and OWASP LLM Top 10 mapping.

If any of those change — e.g., we accept funding contingent on SOC 2, or we ship a server component that processes user inputs — this posture re-opens.

---

## Mapping our existing controls to NIST SSDF v1.1

| SSDF Practice | What we do | Evidence |
|---|---|---|
| PO.1 — Define security requirements | THREAT_MODEL + AUDIT_FINDINGS scoreboard | [THREAT_MODEL.md](./THREAT_MODEL.md), [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md) |
| PO.3 — Implement supporting toolchain | gitleaks + semgrep + CodeQL + npm audit + Dependabot grouping + preflight | [.github/workflows/](../.github/workflows/), [scripts/preflight.js](../scripts/preflight.js), [.github/dependabot.yml](../.github/dependabot.yml) |
| PO.4 — Define a process for archiving + audit | Append-only hash-chained AI audit log | [src/utils/aiAuditLog.js](../src/utils/aiAuditLog.js) |
| PO.5 — Implement a secure environment for development | Devcontainer + EditorConfig + Husky pre-commit | [.devcontainer/devcontainer.json](../.devcontainer/devcontainer.json), [.editorconfig](../.editorconfig), `.husky/` |
| PS.1 — Protect all forms of code from unauthorized access and tampering | Branch protection (configured at GitHub project level — outside this repo's code); Husky + lint-staged gating | n/a (project-settings layer) |
| PS.2 — Verify software release integrity | SBOM (CycloneDX + SPDX) generated and attached on every release tag | [.github/workflows/release.yml](../.github/workflows/release.yml) |
| PS.3 — Archive and protect each software release | GitHub Releases retain artifacts + 90-day SBOM artifact retention | [.github/workflows/release.yml](../.github/workflows/release.yml) |
| PW.1 — Design software to meet security requirements | Threat model drives the design; lethal-trifecta defenses are first-class | [THREAT_MODEL.md](./THREAT_MODEL.md), [src/utils/dualLLM.js](../src/utils/dualLLM.js) |
| PW.4 — Reuse existing, well-secured software where feasible | We avoid hand-rolled crypto, prefer Web Crypto. Sanitizers are explicit; DOMPurify is intentionally noop with documented per-site `safeHtml` defenses | [src/utils/sanitize.js](../src/utils/sanitize.js), [packages/dompurify-noop/README.md](../packages/dompurify-noop/README.md) |
| PW.5 — Create source code by adhering to secure coding practices | semgrep registry + custom rules; SAST blocking in CI as of S8 | [.semgrep.yml](../.semgrep.yml), [.github/workflows/ci.yml](../.github/workflows/ci.yml) |
| PW.7 — Review/analyze human-readable code to identify vulnerabilities | gitleaks + semgrep + CodeQL in CI; SECURITY.md describes the disclosure path | [SECURITY.md](../SECURITY.md) |
| PW.8 — Test executable code to identify vulnerabilities | Red-team test suite (44 cases) + dual-LLM tests + a11y tests | [`src/__tests__/red-team/`](../src/__tests__/red-team/) |
| PW.9 — Configure software to have secure settings by default | CSP in [index.html](../index.html); VA-API gated off; feature flags default-safe | [index.html](../index.html) |
| RV.1 — Identify and confirm vulnerabilities on an ongoing basis | Dependabot weekly; Renovate not in use (Dependabot grouping is sufficient) | [.github/dependabot.yml](../.github/dependabot.yml) |
| RV.3 — Analyze vulnerabilities to identify root causes | AUDIT_FINDINGS.md tracks each finding's root cause and target sprint | [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md) |

---

## Re-evaluation triggers

Re-open this posture if any of these become true:

- We sign a contract that obligates SOC 2 / ISO 27001.
- A server-side data plane is introduced (auth, sync, sharing, telemetry).
- Veterans' inputs leave their device for any reason other than the gated VA-API flow.
- An incident occurs that exposes a gap a framework would have caught earlier.
- Legal counsel requests an explicit posture for a partner, grant, or filing.

---

*Owner: Anthony Johnson. Last updated 2026-05-15. Cross-referenced from [`AUDIT_FINDINGS.md`](./AUDIT_FINDINGS.md) row 12.*
