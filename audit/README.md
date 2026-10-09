# VetRate Autonomous Codebase Audit Pipeline

## Architecture Overview

This pipeline implements autonomous full-coverage codebase auditing and UI-to-function
verification as described in the Architectural Blueprint for Autonomous Full-Coverage
Codebase Auditing and UI-to-Function Verification.

## Directory Structure

```
audit/
├── README.md                     # This file
├── static-analysis/
│   ├── ast-mapper.js             # AST parser - maps every export, function, component
│   ├── dependency-graph.js       # Builds import/export dependency graph
│   └── wiring-verifier.js        # Verifies UI-to-function wiring completeness
├── dynamic-testing/
│   ├── playwright.config.js      # Playwright configuration
│   ├── page-objects/
│   │   └── AppPage.js            # Page Object Model for main app
│   ├── tests/
│   │   ├── smoke.spec.js         # Smoke test - app loads, no console errors
│   │   ├── component-render.spec.js  # Every component renders without crash
│   │   ├── wiring-audit.spec.js  # UI click → function execution verification
│   │   └── security-audit.spec.js    # XSS, injection, input sanitization
│   └── fixtures/
│       └── test-data.json        # Synthetic test data for forms
├── coverage/
│   └── coverage-analyzer.js      # Compares dynamic coverage vs AST map
├── reports/
│   └── .gitkeep                  # Generated reports land here
├── runner.js                     # Main orchestrator - runs the full pipeline
└── package.json                  # Audit-specific dependencies
```

## Quick Start

```bash
cd audit
npm install
npm run audit           # Full pipeline
npm run audit:static    # Static analysis only
npm run audit:dynamic   # Playwright tests only
npm run audit:report    # Generate report from last run
```

## Pipeline Stages

1. **Static AST Analysis** - Parses every .js/.jsx/.ts/.tsx file, maps exports, functions, hooks
2. **Dependency Graph** - Builds complete import graph, detects orphans & circular deps
3. **Wiring Verification** - Maps every UI state toggle to its component and handler chain
4. **Dynamic Testing** - Playwright clicks through every reachable UI surface
5. **Coverage Analysis** - Compares executed code paths vs total function inventory
6. **Report Generation** - JSON + Markdown audit report with pass/fail per function
