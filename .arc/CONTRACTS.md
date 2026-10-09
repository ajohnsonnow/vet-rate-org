# CONTRACTS.md — VetRate Governance Rules

> Machine-readable project contracts. Violations block commits.
> Enforced by the Gamma Auditor agent and pre-commit hooks.

---

## Built-In Contracts (Always Active)

### CTK-001: No `any` Type

```yaml
id: "no-any"
rule: "No 'any' type allowed — use proper types or generics"
category: typing
severity: error
banned_patterns:
  - ": any"
  - "as any"
  - "<any>"
  - "Array<any>"
  - "Promise<any>"
```

### CTK-002: No `eval()`

```yaml
id: "no-eval"
rule: "Dynamic code execution via eval() or new Function() is prohibited"
category: security
severity: error
banned_patterns:
  - "eval("
  - "new Function("
```

### CTK-003: No `console.log` in Production

```yaml
id: "no-console-log"
rule: "console.log is banned in non-test files — use structured error handling"
category: style
severity: warning
banned_patterns:
  - "console.log("
skip_in: ["*.test.*", "*.spec.*", "__tests__/**"]
```

### CTK-004: No TODO Comments

```yaml
id: "no-todo-comment"
rule: "TODO/FIXME/HACK comments must not remain in committed code"
category: style
severity: warning
banned_patterns:
  - "// TODO"
  - "// FIXME"
  - "// HACK"
```

### CTK-005: No Hardcoded Secrets

```yaml
id: "no-secret-patterns"
rule: "Potential secret committed — use environment variables"
category: security
severity: error
banned_patterns:
  - "password="
  - "api_key="
  - "secret="
  - "PRIVATE_KEY"
  - "-----BEGIN"
  - "sk-ant-"
  - "sk-proj-"
  - "ghp_"
```

### CTK-006: No `require()` in ES Modules

```yaml
id: "no-require"
rule: "Use ES module imports, not require()"
category: style
severity: warning
banned_patterns:
  - "require("
```

### CTK-007: No Deprecated Crypto

```yaml
id: "no-deprecated-crypto"
rule: "MD5 and SHA-1 are insecure cryptographic algorithms"
category: security
severity: error
banned_patterns:
  - "createHash('md5')"
  - "createHash('sha1')"
  - "md5("
  - "sha1("
```

---

## VetRate-Specific Contracts

### VA-001: Regulatory Citation Required

```yaml
id: "va-cite-required"
rule: "All VA regulation references must cite 38 CFR or USC source"
category: accuracy
severity: error
description: >
  VetRate is Diamond Standard — every regulatory claim must be
  traceable to a specific 38 CFR section, 38 USC statute, or
  official VA document. Never fabricate regulatory information.
required_patterns_in_regulatory_files:
  - "38 CFR"
  - "38 USC"
```

### VA-002: Calculator Accuracy

```yaml
id: "va-calculator-accuracy"
rule: "VA calculator must use exact bilateral factor formula from 38 CFR 4.26"
category: accuracy
severity: error
description: >
  The bilateral factor calculation is legally mandated.
  Formula: combine bilateral ratings, multiply by 0.10,
  add result to combined rating. Any deviation is a compliance failure.
applies_to:
  - "src/utils/vaCalculations.js"
  - "src/components/Calculator.jsx"
```

### VA-003: No PII Storage on Server

```yaml
id: "no-pii-server-storage"
rule: "No veteran PII may be stored on servers — local storage only"
category: security
severity: error
description: >
  All veteran personal data (SSN, disability details, medical records)
  must remain on-device. localStorage and IndexedDB are acceptable.
  No data may be transmitted to external APIs without explicit user consent.
banned_patterns:
  - "fetch.*body.*ssn"
  - "fetch.*body.*social"
  - "axios.*ssn"
```

### VA-004: Medical Terminology Precision

```yaml
id: "va-medical-precision"
rule: "Medical and diagnostic terminology must use exact VA nomenclature"
category: accuracy
severity: warning
description: >
  Use official VA diagnostic code descriptions from 38 CFR Part 4.
  Do not paraphrase or simplify condition names in code or UI labels
  that are displayed to veterans making claims decisions.
```

### VA-005: Accessibility Non-Negotiable

```yaml
id: "accessibility-required"
rule: "All interactive elements must have ARIA attributes and keyboard support"
category: accessibility
severity: error
description: >
  Many veterans have visual or motor impairments. Every interactive
  element needs: aria-label/aria-labelledby, keyboard navigation,
  focus management, and screen reader compatibility.
required_patterns_in_components:
  - "aria-"
```

### VA-006: No Inline Styles

```yaml
id: "no-inline-styles"
rule: "Use TailwindCSS classes, not inline style attributes"
category: style
severity: warning
banned_patterns:
  - "style={"
  - "style=\""
applies_to:
  - "src/components/**"
```

---

## How Contracts Are Enforced

1. **Pre-commit**: All contracts scanned on staged files
2. **Gamma Auditor**: Reviews code against this file during agent orchestration
3. **CI/CD**: Contract enforcement runs in the build pipeline
4. **Manual**: Run `npx ctk audit` to check specific files

## Adding New Contracts

Add a new YAML block following the template:

```yaml
id: "unique-id"
rule: "Human-readable rule description"
category: typing | security | style | accuracy | accessibility | architecture
severity: error | warning
banned_patterns:
  - "pattern to match"
required_patterns:
  - "pattern that must exist"
applies_to:
  - "glob/pattern/**"
```
