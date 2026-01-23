# VetRate Project - Copilot Instructions

## Project Overview

VetRate is a veteran disability claims assistance application built with:
- **Frontend**: React + Vite + TailwindCSS
- **Target**: Veterans seeking VA disability compensation
- **Philosophy**: Diamond Standard - accuracy, compliance, and veteran-first design

## Critical Rules

### 1. Accuracy is Paramount
- All VA regulations must cite 38 CFR sources
- Calculator must use exact VA bilateral factor formula
- Medical terminology must be precise
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

### 4. Accessibility
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader compatibility
- High contrast support in dark mode

## Available Tools (from .claude-tools/)

**IMPORTANT**: Always read and follow the relevant agent/skill file before executing tasks:

| Task | Reference File | When to Use |
|------|---------------|-------------|
| Feature Planning | `.claude-tools/agents/planner.md` | Before implementing any new feature |
| Code Review | `.claude-tools/agents/code-reviewer.md` | After writing/modifying code |
| Security Audit | `.claude-tools/agents/security-reviewer.md` | For auth, data handling, API code |
| TDD Workflow | `.claude-tools/skills/tdd-workflow/` | When writing tests |
| Architecture | `.claude-tools/agents/architect.md` | For system design decisions |
| Build Errors | `.claude-tools/agents/build-error-resolver.md` | When builds fail |

### Auto-Apply Rules
- **Before any feature work**: Read `.claude-tools/agents/planner.md`
- **After code changes**: Apply `.claude-tools/agents/code-reviewer.md` checklist
- **Security-sensitive code**: Follow `.claude-tools/rules/security.md`

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

## Key Files

- `src/utils/vaCalculations.js` - VA math formulas
- `src/data/diagnosticCodes.json` - Medical condition codes
- `src/components/Calculator.jsx` - Main calculator
- `src/components/DD214Analyzer.jsx` - Document analyzer

## Don't Do

- ❌ Use emojis in production code/commits
- ❌ Hardcode sensitive data
- ❌ Skip error boundaries
- ❌ Ignore accessibility
- ❌ Make up VA regulations
