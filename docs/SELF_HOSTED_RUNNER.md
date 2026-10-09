# Self-hosted Actions runner

Runs this repo's CI on your own machine instead of GitHub-hosted runners,
which do not consume Actions minutes. **It is off by default** and nothing
changes until you set one repository variable.

## Should you use it?

Probably not yet. After the trigger/job dedupe in this branch (see
[CI_MINUTES.md](./CI_MINUTES.md)), a push to main is on the order of 40-55
billable minutes (the last measured `ci.yml` push run was 44 minutes). A PR
that touches code has never been measured: the code-gated jobs have never run
on a real PR, so treat any per-PR figure as an estimate. The Free plan's
2,000 monthly minutes covers a few dozen runs a month before you'd need to
buy more at the Linux rate ($0.008/min).

Reach for this when one of these is true:

- Actions minutes are exhausted and a merge is blocked
- You are iterating on CI itself and pushing many times an hour
- A job needs more CPU/RAM than a 2-core hosted runner provides

The costs are real: a Docker daemon exposed to CI jobs (see **Security**), a
machine that must be awake for CI to run at all, and one more thing to keep
patched.

## Security

**Do not register a self-hosted runner while this repository is public.**
For a `pull_request` event GitHub runs the workflow file from the PR's own
merge commit, so a fork author can edit any workflow in their PR to say
`runs-on: self-hosted` (or delete the guard) and the job is routed to your
machine. A registered repo-level runner is enough; `RUNNER_LABEL` need not be
set. The fork-approval policy here is `first_time_contributors`, so anyone
with one previously merged PR gets no approval prompt. The runner needs the
Docker socket, which is equivalent to root on the host. The `runs-on`
expression below is defence in depth only, not a boundary. If you must use a
runner anyway: set fork-PR approval to all outside collaborators, use an
ephemeral isolated runner (a throwaway VM, not your workstation), and note
that same-repo Dependabot PRs pass the guard, so third-party npm install
scripts would run on it.

Two jobs run inside `container: image: semgrep/semgrep`
(`sast-semgrep` in `pr-checks.yml`, `full-sast-semgrep` in
`release-gates.yml`). A self-hosted runner cannot start a `container:` job
without talking to the host's Docker daemon, so the runner needs the Docker
socket mounted. **Socket access is equivalent to root on the host.** Any
job that reaches this runner can start a privileged container and read or
write anything on your machine.

That is acceptable only while both of these hold:

1. This repo is **private** (or you accept the risk on a public one).
   GitHub advises against self-hosted runners on public repos precisely
   because a pull request from a fork would execute attacker-authored code
   against your Docker daemon.
2. Only trusted collaborators have write access. Anyone who can push a
   branch or open a PR that runs these workflows can run code on this
   machine.

If either changes, tear the runner down.

Use an **ephemeral** runner configuration (unregister after one job) to
limit the blast radius between jobs — no workspace, credential, or
container state should carry forward from one job to the next.

## Setup

This repo does not ship a bundled runner container (unlike some sibling
projects) — register a standard GitHub-hosted self-hosted runner yourself:

**1. Get a registration token.** These expire after one hour and are not
PATs.

```bash
gh api -X POST repos/ajohnsonnow/vet-rate-org/actions/runners/registration-token --jq .token
```

**2. Register and run the runner** on the machine that will execute jobs,
following [GitHub's own runner setup](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/adding-self-hosted-runners)
(`config.sh --ephemeral --labels self-hosted,linux,x64` then `run.sh`, or
the equivalent Docker image such as `myoung34/github-runner`). Make sure the
Docker socket is reachable from wherever the runner executes jobs — the two
`container:` jobs above need it.

Confirm it registered under Settings → Actions → Runners.

**3. Flip the switch.** Settings → Secrets and variables → Actions →
Variables → New repository variable:

```
RUNNER_LABEL = self-hosted
```

Every workflow in `.github/workflows/` resolves `runs-on` to
`vars.RUNNER_LABEL` when set, else `ubuntu-latest`, so this one variable
moves every job at once. The one exception is a `pull_request` from a fork:
repository variables are visible to fork PR runs, so the expression
(`github.event.pull_request.head.repo.full_name == github.repository`)
keeps unmodified workflows on `ubuntu-latest`. This does not stop a fork PR
that rewrites the workflow file itself (see **Security**). `scorecard.yml`
is the one workflow that always uses a literal `ubuntu-latest`, because the
OpenSSF publish verifier rejects any other `runs-on`. Do not weaken that
guard, and do not add
`pull_request_target` or `workflow_run` triggers that check out PR code.

## Turning it off

**Delete the `RUNNER_LABEL` variable.** Jobs return to `ubuntu-latest` on
the next run. Do this before stopping the runner process, or queued jobs
will wait for a runner that is gone.

## When jobs queue forever

The usual cause is `RUNNER_LABEL` set while the runner is offline: the
machine slept, Docker restarted, or the registration token expired. GitHub
does not fall back to a hosted runner — it waits. Delete the `RUNNER_LABEL`
variable to unblock immediately, then investigate the runner process.

## What will not work the same as a hosted runner

- **Preinstalled tooling.** GitHub's images ship Node, Python, Go, browsers,
  and the `gh` CLI. A minimal self-hosted image will not. Steps using
  `actions/setup-node` are fine because they install what they need; steps
  assuming a preinstalled binary may not be.
- **Playwright browsers.** The e2e/mobile/axe/cwv/pwa jobs in `ci.yml` and
  `e2e-user-journeys` in `pr-checks.yml` cache them (separate cache keys for chromium-only and chromium+firefox) via `actions/cache`,
  which works the same on a self-hosted runner, but the first run on a
  fresh machine still downloads them.
- **`ubuntu-latest` drift.** If you run a container-based self-hosted
  image, pin it to a specific Ubuntu release rather than tracking
  `latest`, so job behavior doesn't silently diverge from GitHub's hosted
  runners.
