# CI minutes: what runs when, and what this branch saved

Companion to [SELF_HOSTED_RUNNER.md](./SELF_HOSTED_RUNNER.md). Closes the
overlap flagged as finding RT13-2 of the June 2026 red-team audit (`ci.yml`
and `pr-checks.yml` duplicate lint/build/test/e2e; that report is not part
of this repository), and
the CodeQL double-trigger visible in real run history (see Methodology).

## Tiers — what runs, and when

| Tier                          | Workflow(s)                                 | Trigger                                                               | Jobs (after this branch)                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every PR push                 | `pr-checks.yml`                             | `pull_request` → `main`/`master`/`develop` (only `main` exists today) | detect, secret-scan, sast-semgrep (code-gated), sast-codeql (via `workflow_call`), sca-dependency-review, sca-osv-scanner, supply-chain, link-check (markdown-gated), markdown-lint (markdown-gated), perf-budget (gated on a `size-limit` config block that doesn't exist yet — always skipped), e2e-user-journeys (code-gated), required-checks |
| Every PR push                 | `ci.yml`                                    | `pull_request` → `main`                                               | quality (lint), type-check, validate-dkb, test, build, e2e, mobile, axe, cwv, pwa, lighthouse, red-team, rag-eval, security, ci-gate                                                                                                                                                                                                              |
| Every push to `main`          | `ci.yml`                                    | `push` → `main`                                                       | same 15 jobs as above                                                                                                                                                                                                                                                                                                                             |
| Every push to `main`/tags     | `release-gates.yml`                         | `push` → `main`/`master`, tags `v*`, dispatch                         | sbom, provenance (tags only), dast-baseline (needs `STAGING_URL` var — currently unset, skipped), security-headers (same), full-sast-semgrep, full-sast-codeql (via `workflow_call`), license-scan, smoke-test, post-deploy-notify                                                                                                                |
| Every push to `main`/`master` | `scorecard.yml`                             | `push`, weekly schedule, dispatch                                     | analysis                                                                                                                                                                                                                                                                                                                                          |
| Weekly                        | `codeql.yml`                                | `schedule` (Mon 06:00 UTC) — **no longer** `push`/`pull_request`      | detect-languages, analyze                                                                                                                                                                                                                                                                                                                         |
| Weekly                        | `legal-ingestion.yml`                       | `schedule` (Mon 04:00 UTC), dispatch                                  | refresh                                                                                                                                                                                                                                                                                                                                           |
| Weekly                        | `dkb-freshness.yml`                         | `schedule` (Tue 04:30 UTC), dispatch                                  | freshness                                                                                                                                                                                                                                                                                                                                         |
| Weekly                        | `model-watch.yml`                           | `schedule` (Wed 05:00 UTC), dispatch                                  | watch (not changed by this branch; always `ubuntu-latest`)                                                                                                                                                                                                                                                                                        |
| Weekly                        | `weekly-security.yml`                       | `schedule` (Mon 09:00 UTC), dispatch                                  | secrets-full-history, dependency-cve, openssf-scorecard, dep-updates-triage, mcp-scan                                                                                                                                                                                                                                                             |
| Weekly                        | `scorecard.yml`                             | `schedule` (Sun 23:17 UTC)                                            | analysis                                                                                                                                                                                                                                                                                                                                          |
| Monthly                       | `monthly-deep-audit.yml`                    | `schedule` (1st, 08:00 UTC), dispatch                                 | full-lighthouse-crawl (needs `PRODUCTION_URL` var), mutation-testing, license-full, sbom-refresh, compliance-checklist, dependency-health                                                                                                                                                                                                         |
| Tag push / dispatch only      | `release.yml`                               | `push` tag `vX.Y.Z`, dispatch                                         | build, publish, provenance                                                                                                                                                                                                                                                                                                                        |
| Opt-in (any trigger)          | all workflows but scorecard and model-watch | any                                                                   | moves the repo to a self-hosted runner if `vars.RUNNER_LABEL` is set. Do not use while the repo is public — see SELF_HOSTED_RUNNER.md                                                                                                                                                                                                             |

## What changed and why

1. **`codeql.yml` dropped its own `push`/`pull_request` triggers.** It is
   invoked via `workflow_call` from `pr-checks.yml` (every PR) and
   `release-gates.yml` (every push to main) already; the direct trigger ran
   — and billed — the same commit a second time. Kept: weekly `schedule`
   (catches newly published CVE queries against unchanged code) and
   `workflow_dispatch`. Added `concurrency`.
2. **`pr-checks.yml`'s `lint-and-quality`, `build`, and `test` jobs were
   removed.** `ci.yml` already runs the same lint/typecheck/build/test on
   the same `pull_request`/`main` events — RT13-2. The Codecov upload and
   the informational bundle-budget check those jobs also carried were
   relocated into `ci.yml`'s `test`/`build` jobs rather than dropped.
3. **`pr-checks.yml`'s `visual-regression` job was removed.** Dead code:
   it runs `playwright test --config playwright-visual.config.ts`, and that
   config file does not exist in this repo. It has never passed: on every
   code-touching PR between 2026-10-05 and 2026-10-07 it failed earlier
   still, at `npm run preview & || npm run start &`, which is a shell syntax
   error (for example run 37573440226). On the dependabot
   GitHub-Actions-version-bump PRs before that, its `code`-filter gate was
   false and it was skipped.
4. **`pr-checks.yml`'s `ux-perf-check` job was removed.** It duplicates
   `ci.yml`'s required `lighthouse` job (both run Lighthouse-CI against a
   built/preview server); `ux-perf-check` is informational only (not in
   `required-checks`'s `needs`) and not required by branch protection. On
   the same code-touching PRs it failed within seconds, before any build,
   because its pinned `treosh/lighthouse-ci-action` commit could not be
   resolved, so it never produced a score.
5. **`pr-checks.yml`'s `e2e-user-journeys` job was kept**, even though it
   overlaps with `ci.yml`'s `e2e`/`mobile`/`axe`/`cwv`/`pwa` jobs, and
   repaired: the old step had no build, ran every Playwright project while
   installing chromium only, and used a preview server the tests never hit. It
   now runs `--project=chromium` on the seven specs listed below. It is the
   only CI job that runs
   `tests/e2e/{ask-the-regs,cfile-canonical-dataflow,
document-corpus-import-report,duty-station-map,my-packet-summary,
palette-axe,simulators-a11y}.spec.ts` — `ci.yml`'s curated per-gate spec
   lists never reference those seven files. Removing the job would
   silently drop that coverage. **Caveat:** the old job failed at the
   preview-server syntax error on every code-touching PR (2026-10-05 to
   2026-10-07), so these seven specs have never actually run in CI and the
   repaired version is unproven; expect to adjust it on its first real run.
   It stays until those specs move into a `ci.yml` gate.
6. **`concurrency` added** to `ci.yml`, `codeql.yml`, and `scorecard.yml`,
   which had none. A superseded run on a PR or feature branch is cancelled;
   a run on `main` is never cancelled or replaced: on `main` the group is
   `<name>-<run_id>` (unique per run, so GitHub's "newer pending run replaces
   the older pending one" rule cannot drop a commit's gate run either) and
   `cancel-in-progress` is `github.ref != 'refs/heads/main'`. Not added to `release-gates.yml`,
   `release.yml`, `dkb-freshness.yml`, or `legal-ingestion.yml` — the first
   two are release/tag pipelines and the last two already set
   `cancel-in-progress: false` deliberately (a cancelled run could leave a
   partially-applied auto-PR or a stale freshness snapshot).
7. **Playwright browsers are cached** (`~/.cache/ms-playwright`, keyed on
   `package-lock.json`) in every job that installs them: `ci.yml`'s `e2e`,
   `mobile`, `axe`, `cwv`, `pwa`, and `pr-checks.yml`'s `e2e-user-journeys`.
   On a cache hit the job runs `playwright install-deps` (OS packages only)
   instead of `playwright install --with-deps` (which re-downloads the
   browser binaries).
8. **Self-hosted runner opt-in**, off by default: every job's
   `runs-on: ubuntu-latest` became
   `runs-on: ${{ (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) && vars.RUNNER_LABEL || 'ubuntu-latest' }}`.
   With no `RUNNER_LABEL` variable (verified: the repo has zero Actions
   variables today) every job is `ubuntu-latest`. Setting it moves every job
   to a self-hosted runner, except a `pull_request` from a fork: repository
   variables are visible to fork PR runs (only secrets are withheld) and
   this repo is public, so without that guard fork-authored code would run
   on the owner's machine. Such jobs fall back to `ubuntu-latest`. This is
   defence in depth only: a fork PR runs the workflow file from its own merge
   commit and can rewrite `runs-on`, so do not register a self-hosted runner
   while the repo is public. See
   [SELF_HOSTED_RUNNER.md](./SELF_HOSTED_RUNNER.md).
   `scorecard.yml` keeps a literal `runs-on: ubuntu-latest`: with
   `publish_results: true` the OpenSSF verifier statically requires one hosted
   Ubuntu label and rejects an expression. `model-watch.yml`, which reached
   `main` separately, also has a literal `runs-on: ubuntu-latest` and is not
   part of the opt-in.
9. **Playwright cache keys are per browser set.** `e2e` (chromium + firefox)
   uses `...-playwright-chromium-firefox-<lockfile hash>`; the chromium-only
   jobs use `...-playwright-chromium-<hash>`. A shared key let a chromium-only
   save be restored into `e2e`, which then skipped the browser download and
   failed with no Firefox binary.
10. **Node version.** The removed `pr-checks.yml` lint/typecheck/build/test jobs
    ran Node 22; their `ci.yml` replacements run Node 20, so a Node-22-only
    regression is no longer caught on PRs. Production's Node version was not
    checked; add a Node 22 matrix leg to `ci.yml` if it matters.

## Check names before and after

Required checks: the `DefensivePosture` ruleset on the default branch has
only `deletion` and `non_fast_forward` rules, and `main` has no classic
branch protection (`gh api` 404), so no status check is currently required
by GitHub. No `checksPass`/`required_status` reference exists in the repo.
Even so, no job that remains was renamed. Removed (all in `pr-checks.yml`):
`Lint & typecheck`, `Test & coverage`, `Visual Regression`,
`UX Performance Check`, and its `Build` (the `Build` job in `ci.yml` keeps
the same check name). `PR gate summary` and `CI Gate (required check)` are
unchanged; `PR gate summary` no longer waits on the three removed jobs.
On a PR the CodeQL check is now only `SAST (CodeQL) / Analyze (...)`; the
bare `Analyze (...)` check from the direct trigger is gone. If an owner
later requires checks, require `CI Gate (required check)` and
`PR gate summary`, not individual jobs.

## Estimated minutes saved

**Methodology:** GitHub Actions bills ubuntu-hosted jobs in whole minutes,
rounded up. The per-job numbers below are measured wall-clock durations
pulled via `gh run view --json jobs` from this repo's own run history, each
rounded up to a whole minute: for a PR, the `pr-checks.yml`, `ci.yml` and
`codeql.yml` runs of one code-touching PR on 2026-10-07 (runs 37573440226,
37573440020 and 37573439989, same commit); for `main`, the push runs of
2026-10-07 (`ci.yml` 37576306086, `release-gates.yml` 37576306261,
`scorecard.yml` 37576306148, `codeql.yml` 37576306100).

These are **computed** minutes, not an invoice. While this repository is
public GitHub reports zero billable time for these runs
(`gh api repos/ajohnsonnow/vet-rate-org/actions/runs/37576306086/timing`
returns `total_ms: 0`), so "billed" below means what the same jobs would
cost on a private repository, and is otherwise a measure of runner time.

### Per PR push

| Removed / deduped                                                   | Basis                                                                        | Minutes    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------- |
| `codeql.yml`'s standalone `pull_request` run (detect 1 + analyze 3) | measured (run 37573439989)                                                   | 4          |
| `pr-checks.yml` `lint-and-quality`                                  | measured (run 37573440226, job "Lint & typecheck", 106 s)                    | 2          |
| `pr-checks.yml` `build`                                             | measured (same run, job "Build", 84 s)                                       | 2          |
| `pr-checks.yml` `test`                                              | measured (same run, job "Test & coverage", 651 s)                            | 11         |
| `pr-checks.yml` `visual-regression`                                 | measured on a failing run (41 s, stopped at the preview-server syntax error) | 1          |
| `pr-checks.yml` `ux-perf-check`                                     | measured on a failing run (3 s, action could not be resolved)                | 1          |
| **Total**                                                           |                                                                              | **21 min** |

Before the change that PR used 97 computed minutes (29 `pr-checks.yml` +
64 `ci.yml` + 4 `codeql.yml`), so the removed work is about 22% of it.
Treat that as an upper bound, not the expected saving: `e2e-user-journeys`
counted 1 minute in that run only because it failed at the syntax error,
and the repaired job will now really run its seven specs, at a cost that
has not been measured. `Test & coverage` also varied from 3 to 12 minutes
across the code-touching PR runs of 2026-10-05 to 2026-10-07.
The Playwright cache and `concurrency` additions are not in this table: the
cache's effect is not measured on this branch (no workflow has run on it;
the 20-30 second figure is an estimate), and it only
sometimes crosses a whole-minute billing boundary; `concurrency` saves
nothing on an isolated push and saves a full duplicate run's worth of
minutes whenever a developer pushes again before the first run finishes.

### Per push to `main`

| Removed / deduped                                        | Basis                         | Minutes      |
| -------------------------------------------------------- | ----------------------------- | ------------ |
| `codeql.yml`'s standalone `push` run                     | measured (run 37576306100)    | 5            |
| Playwright cache effect across `ci.yml`'s 5 browser jobs | estimated, rounding-sensitive | ~1-2         |
| **Total**                                                |                               | **~6-7 min** |

Against a computed 81-minute total on 2026-10-07 (65 min `ci.yml` + 10 min
`release-gates.yml` + 1 min `scorecard.yml` + 5 min duplicate CodeQL),
that is roughly a **7-9% reduction** per push to `main`, of which only the
5 CodeQL minutes are measured. (The same push on 2026-09-07 totalled 63:
`ci.yml` has grown from 44 to 65 minutes since.)

Two things this repo does that are outside this branch's scope, noted for
awareness rather than fixed here:

- A single release (per the `[pre-push]` release recipe) pushes both the
  `main` branch and a version tag as two separate `push` events, so
  `release-gates.yml` genuinely runs twice per release. Not deduped here —
  changing which ref triggers what release-gate work is a bigger call than
  "remove a duplicate trigger," and risks the documented
  tag-equals-deployed release contract.
- `pr-checks.yml`'s `pull_request` trigger still lists `master`/`develop`
  alongside `main`; neither branch exists in this repo (`git branch -r`),
  so this is inert, not a real second gate to reconcile with `ci.yml`.

## Before / after per workflow

Computed minutes per event, from the measured runs in Methodology. "After"
is the same measurement minus the removed work; nothing below was re-run
after the change (no push was made).

| Workflow                                                                 | Event                    | Before    | After                                      | Basis                                                                                    |
| ------------------------------------------------------------------------ | ------------------------ | --------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `codeql.yml`                                                             | PR push                  | 4         | 0 (direct run removed)                     | measured; the `workflow_call` run inside `pr-checks.yml` remains                         |
| `codeql.yml`                                                             | push to `main`           | 5         | 0 (direct run removed)                     | measured; the `workflow_call` run inside `release-gates.yml` remains                     |
| `pr-checks.yml`                                                          | PR touching code         | 29        | 12 plus `e2e-user-journeys` (not measured) | 2+2+11+1+1 removed, all measured; the repaired `e2e-user-journeys` has never run         |
| `ci.yml`                                                                 | PR push / push to `main` | 64-65     | about 63-65                                | Playwright cache saves an estimated 20-30 s per browser job; Codecov upload adds seconds |
| `release-gates.yml`, `scorecard.yml`, `release.yml`, scheduled workflows | any                      | unchanged | unchanged                                  | only `runs-on` expression changed (still `ubuntu-latest` by default)                     |

## Not measured

- No workflow was run after these changes (no push, no PR), so every "after"
  figure is the measured "before" minus removed work, not a fresh run.
- The Playwright cache saving is an estimate; hit rate depends on
  `package-lock.json` churn and GitHub's 7-day cache eviction.
- `visual-regression` and `ux-perf-check` never ran to completion; their
  1-minute figures come from runs in which they failed early.
- What the repaired `e2e-user-journeys` job costs when it really runs its
  seven specs.
- Actual billing: GitHub reports zero billable time for this public
  repository, so every minute figure here is computed from job durations.
- Cancelled-run savings from `concurrency` depend on push cadence and were
  not measured.
- Self-hosted behaviour was reasoned from the expression and the docs, not
  tested on a live runner.
