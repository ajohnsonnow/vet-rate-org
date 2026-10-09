# Preflight extras

> Three "polish" checks (markdownlint, knip, license-checker) wired in as opt-in scripts that **do not install devDependencies**. Run them when they earn priority; skip them when you don't need them. Closes finding #33 in [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md).

**Last updated:** 2026-05-15

---

## Why these are opt-in instead of always-on

The S8 audit ([AUDIT_FINDINGS.md row 33](./AUDIT_FINDINGS.md)) intentionally **deferred** adding markdownlint / knip / license-checker / lighthouse-ci as devDependencies — bundling four packages into the audit-fix PR would have inflated the diff against the actual security fixes.

This doc closes the gap by making the checks runnable **without** the bundling cost:

- Each check is invoked through `npx --yes <pkg>@<pinned-version>` so the package is downloaded *only* when the check runs.
- A clean `npm ci` does not pull these packages.
- CI can opt-in by adding a step `npm run preflight:extras` — the cost is one cold-start per CI run (acceptable for a weekly job; fast enough for per-PR if desired).

The trade-off:

| | Always-on devDeps | npx-on-demand (this approach) |
|---|---|---|
| `npm ci` time | +~5–8 s per package | unchanged |
| `package.json` clutter | +4 devDep lines | 0 devDep lines |
| First-run latency | 0 s | ~30 s (npx fetch) |
| Subsequent runs | 0 s warmup | 0 s (cached) |
| CI cache friendliness | excellent | good (npx caches between runs) |
| Version drift risk | dependabot tracks | manual pin in script |

For a polish-tier check that runs occasionally, the npx path wins.

---

## The three checks

### 1. markdownlint-cli2 (Markdown style)

```sh
npm run check:markdown           # all *.md, respecting .markdownlintignore
make check-markdown              # same
```

Config: [.markdownlint.json](../.markdownlint.json) (already in repo).
Ignore: [.markdownlintignore](../.markdownlintignore) (already in repo).

Why: catches broken markdown links, table issues, and heading-hierarchy regressions in the 100+ doc files under `docs/`.

### 2. knip (dead-code + unused-deps)

```sh
npm run check:knip               # report unused exports, files, deps
make check-knip                  # same
```

Config: [knip.json](../knip.json).

`entry:` lists the real entry points (main.jsx, App.jsx, vite.config.js, scripts/**, tests).
`project:` is the full source tree.
`ignore:` carves out `packages/dompurify-noop/**`, `public/**`, `src/data/**`, and `*.test.{js,jsx}`.

Why: the codebase has ~40 modal-shaped components and a sprawling `scripts/` tree. Knip surfaces files that nothing imports — useful before a refactor or release.

**Honest gap:** the report will include false positives for dynamic-imported components and Vite virtual modules. Tune `ignore` over time rather than chasing the long tail in one sitting.

### 3. license-checker (prod-dep licenses)

```sh
npm run check:licenses           # MIT/BSD/Apache/ISC/0BSD/Unlicense summary
make check-licenses              # same
```

We use `license-checker-rseidelsohn` (an actively maintained fork of the original) via npx with `--production --summary --excludePrivatePackages`. The output is a one-line-per-license counts table.

Why: catches accidental GPL/AGPL-licensed prod deps before they ship. Our SBOM (release pipeline) carries the full license metadata; this command surfaces it in a single CLI invocation.

---

## How to use them

### Run all three

```sh
npm run preflight:extras         # fail the run on any error
npm run preflight:extras:soft    # downgrade errors to warnings
make preflight-extras
```

### Run one

```sh
npm run check:markdown
npm run check:knip
npm run check:licenses
```

Or the script directly:

```sh
node scripts/preflight-extras.mjs --only=knip
node scripts/preflight-extras.mjs --only=markdown --soft
```

### Wire into CI (optional)

Add to [.github/workflows/ci.yml](../.github/workflows/ci.yml) only if/when the maintenance cost justifies the runtime cost:

```yaml
- name: Preflight extras
  run: npm run preflight:extras:soft
  continue-on-error: true
```

`continue-on-error: true` keeps these as advisory rather than blocking, matching their polish-tier status. Promote to blocking if/when the noise dies down on a green tree.

---

## What we explicitly chose NOT to do

- **No lighthouse-ci.** Lighthouse runs in headless Chrome and would add ~60 s per CI run, plus a Puppeteer install. Web-vitals capture at [src/utils/webVitals.js](../src/utils/webVitals.js) gives us the metrics that matter without the bundling cost. If we ever wire a hosted preview deployment, revisit Lighthouse-CI on the preview URL.
- **No `linkinator` / dead-link checker.** Markdown link validity is partially covered by markdownlint's `MD034` / `MD039` rules. A real link-validity check needs to fetch each URL (rate-limited, flaky on GitHub anchors). Not worth the noise.
- **No commit-message lint (`commitlint`).** [CONTRIBUTING.md](../CONTRIBUTING.md) documents conventional-commits; a hard gate adds friction without catching real bugs. Trust the developer, fix violations in code review.

---

## Re-audit triggers

Reopen this document if any of these happen:

- A user-visible bug ships that one of these checks would have caught (graduate the check from optional to required).
- The npx fetch becomes unreliable in our CI environment (consider pinning to devDeps after all).
- A new check earns priority (e.g., a doc-site build, a typed-config validator).

---

*Owner: Anthony Johnson. Last updated 2026-05-15. Closes [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md) row 33 — promoted from partial to compliant. The deferred lighthouse-ci item is documented as explicitly out-of-scope.*
