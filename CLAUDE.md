# CLAUDE.md — VetRate Master Agentic Context

> Auto-configured from claude-toolkit integration. Source of truth for AI agents.
> Last updated: 2026-03-04

## Project Overview

- **Name**: VetRate — Veteran Disability Claims Assistant
- **Language**: JavaScript (ES Modules)
- **Framework**: React + Vite + TailwindCSS
- **Version**: 1.19.8
- **Target Users**: Veterans seeking VA disability compensation
- **Philosophy**: Diamond Standard — accuracy, compliance, veteran-first

## Lazy-Loaded Skills

Only load a skill when the current task matches its triggers:

- `.claude-tools/skills/security-review/` — Security audits, PII protection, OWASP Top 10
- `.claude-tools/skills/tdd-workflow/` — Test-driven development, RED-GREEN-REFACTOR
- `.claude-tools/skills/verification-loop/` — Build/lint/test verification pipeline
- `.claude-tools/skills/frontend-patterns/` — React component architecture, hooks
- `.claude-tools/skills/coding-standards/` — Code quality, DRY, KISS, YAGNI
- `.claude-tools/skills/backend-patterns/` — API design, error handling
- `.claude-tools/skills/debugging/` — 4-level KNOWN/UNKNOWN/HYPOTHESIS/NEXT_ACTION protocol
- `.claude-tools/skills/eval-harness/` — Eval-driven development
- `.claude-tools/skills/continuous-learning/` — Pattern extraction from sessions
- `.claude-tools/skills/strategic-compact/` — Context management

## Available Agents

| Agent | File | When to Use |
|-------|------|-------------|
| Alpha Researcher | `agents/alpha-researcher.md` | Before implementation — gather VA regulations, library docs |
| Beta Coder | `agents/beta-coder.md` | Implementation — write production code |
| Gamma Auditor | `agents/gamma-auditor.md` | After implementation — quality gate review |
| Debugger | `agents/debugger.md` | Bug investigation — 4-level reasoning protocol |
| Frontend Engineer | `agents/frontend-engineer.md` | React/accessibility specialist work |

## Agent Pipeline

For complex features, run agents in sequence:

```
Alpha Researcher → Beta Coder → Gamma Auditor
```

For bug fixes:

```
Debugger → Beta Coder → Gamma Auditor
```

## Core Architectural Rules

1. **VA accuracy is law** — All calculations must follow 38 CFR exactly
2. **No PII on servers** — All veteran data stays on-device
3. **Accessibility first** — ARIA labels, keyboard nav, screen readers
4. **TailwindCSS only** — No inline styles
5. **Error handling required** — Every async function handles errors
6. **Files under 500 lines** — Split large files
7. **Contracts are enforced** — See `.arc/CONTRACTS.md`

## Key Files

| File | Purpose |
|------|---------|
| `src/utils/vaCalculations.js` | VA bilateral factor & combined ratings math |
| `src/data/diagnosticCodes.json` | Medical condition diagnostic codes |
| `src/components/Calculator.jsx` | Main disability calculator UI |
| `src/components/DD214Analyzer.jsx` | Military document analyzer |
| `vite.config.js` | Build configuration (multi-brand, WebGPU, chunk splitting) |
| `.arc/CONTRACTS.md` | Governance contracts (machine-readable rules) |

## Prohibited

- `eval()`, `new Function()` — no dynamic code execution
- `moment` — use native Date or date-fns
- Deprecated crypto (MD5, SHA-1)
- Inline styles — use TailwindCSS
- Server-side PII storage
- Fabricated VA regulations

## Build Commands

```bash
npm run dev             # Start Vite dev server
npm run build           # Production build (runs sync + checks)
npm run build:all       # Build all brands
npm run lint            # ESLint
npm run format          # Prettier
npm run pre-deploy      # Full pre-deployment validation
npm run push-prep       # Version bump + pre-deploy + commit
```
