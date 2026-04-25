# VetRate Project - Copilot Instructions

## Project Overview

VetRate is a veteran disability claims assistance application built with:
- **Frontend**: React + Vite + TailwindCSS
- **Target**: Veterans seeking VA disability compensation
- **Philosophy**: Diamond Standard - accuracy, compliance, and veteran-first design
- **Toolkit**: claude-toolkit integrated (agents, skills, contracts, hooks)

## Critical Rules

### 1. Accuracy is Paramount
- All VA regulations must cite 38 CFR sources
- Calculator must use exact VA bilateral factor formula (38 CFR 4.26)
- Combined ratings follow 38 CFR 4.25 exactly
- Medical terminology must be precise — use official VA nomenclature
- Never fabricate legal/regulatory information

### 2. Code Organization
- Components in `src/components/`
- Utilities in `src/utils/`
- Data files in `src/data/`
- Keep files under 500 lines when possible
- Use TailwindCSS for styling (no inline styles)

### 3. Security & Privacy
- No PII stored on servers (local storage only)
- No hardcoded API keys
- All user data stays on device
- Validate all inputs
- See `.arc/CONTRACTS.md` for enforced security contracts

### 4. Accessibility
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader compatibility
- High contrast support in dark mode
- WCAG AA minimum (4.5:1 contrast ratio)

## Agent Pipeline (from claude-toolkit)

For complex features, use the agent pipeline:

```
Alpha Researcher → Beta Coder → Gamma Auditor
```

For bug fixes:
```
Debugger (4-level reasoning) → Beta Coder → Gamma Auditor
```

## Available Agents (`.claude-tools/agents/`)

| Agent | File | When to Use |
|-------|------|-------------|
| Alpha Researcher | `agents/alpha-researcher.md` | Before implementation — gather VA regulations, library docs |
| Beta Coder | `agents/beta-coder.md` | Implementation — write production code |
| Gamma Auditor | `agents/gamma-auditor.md` | After implementation — quality gate review |
| Debugger | `agents/debugger.md` | Bug investigation — 4-level reasoning protocol |
| Frontend Engineer | `agents/frontend-engineer.md` | React/accessibility specialist work |

## Available Skills (`.claude-tools/skills/`)

| Skill | When to Activate |
|-------|-----------------|
| `security-review/` | Auth, PII handling, OWASP checks |
| `tdd-workflow/` | Writing tests (RED-GREEN-REFACTOR) |
| `verification-loop/` | Pre-commit / pre-PR validation |
| `debugging/` | Bug investigation (KNOWN/UNKNOWN/HYPOTHESIS/NEXT_ACTION) |
| `frontend-patterns/` | React components, hooks, performance |
| `coding-standards/` | Code quality, DRY, KISS |
| `continuous-learning/` | Session pattern extraction |

## Governance Contracts (`.arc/CONTRACTS.md`)

Machine-readable rules enforced by hooks and the Gamma Auditor:
- **CTK-001-008**: Standard code quality (no eval, no any, no secrets, etc.)
- **VA-001**: Regulatory citations required
- **VA-002**: Calculator accuracy mandated
- **VA-003**: No PII on servers
- **VA-004**: Medical terminology precision
- **VA-005**: Accessibility non-negotiable
- **VA-006**: No inline styles

### Auto-Apply Rules
- **Before any feature work**: Use Alpha Researcher agent
- **After code changes**: Run Gamma Auditor for quality gate
- **Security-sensitive code**: Follow `skills/security-review/` + `rules/security.md`
- **Bug fixes**: Use Debugger agent with 4-level reasoning
- **Before PR**: Run verification loop (`skills/verification-loop/`)

## Code Patterns

### Component Structure
```jsx
// imports
// types/interfaces
// constants
// component function
// helper functions (inside or below component)
// export
```

### Error Handling
```javascript
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  console.error('Context:', error);
  // Show user-friendly message, log technical details
}
```

### Local Storage Pattern
```javascript
const STORAGE_KEY = 'vetrate_feature_data';
const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
```

## Git Workflow

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`
- Version tags: `v1.5.x` format
- Test builds before committing: `npm run build`
- Run `npm run push-prep` for full pre-deploy validation

## Key Files

- `src/utils/vaCalculator.js` - VA math formulas (38 CFR 4.25/4.26); `calculateVARating`, `calculateCompensation`, `VA_PAY_RATES_2026`
- `src/utils/ratingCalculator.js` - Parallel combined-rating engine (kept in cross-check parity with `vaCalculator.js` via `src/__tests__/utils/ratingCalculator.crosscheck.test.js`)
- `src/data/disabilityData.json` - 748 VA conditions / diagnostic codes (eCFR-validated; `src/utils/disabilityCount.js` is the read API)
- `src/data/toolkitData.js` - Canonical tool list (single source of truth for tool count; cross-checked by `src/__tests__/utils/toolCount.crosscheck.test.js`)
- `src/data/projectStats.json` + `src/data/projectStats.js` - Auto-generated project metrics; do not hand-edit JSON
- `src/components/TacticalCalculator.jsx` - Main combined-rating UI
- `src/components/DD214Analyzer.jsx` - Document analyzer
- `.arc/CONTRACTS.md` - Governance contracts
- `CLAUDE.md` - Master agentic context
- `README.md` - User-facing claims; tool count and stats must agree with `toolkitData.js` and `projectStats.json`
- `.aiignore` - AI context exclusions

## Don't Do

- ❌ Use emojis in production code/commits
- ❌ Hardcode sensitive data
- ❌ Skip error boundaries
- ❌ Ignore accessibility
- ❌ Make up VA regulations
