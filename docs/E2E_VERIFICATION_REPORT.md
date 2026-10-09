# End-to-end verification report: records wiring and quality

**Branch:** `fix/records-wiring-and-quality` at `b126e7e6` (653 commits over `main`)
**Date:** 2026-10-06
**Verdict:** nothing found that blocks a pull request.

This report covers the last of 13 fix-and-verify rounds (final14 to final26). In each round engineers fixed findings in isolated worktrees, a reviewer tried to refute each fix, the work was combined, and an independent verifier checked the combined build against a private set of documents, including a very large scanned claims file, service-record scans and VA letters. That set is held outside this repository and was never uploaded anywhere. The results below give outcomes and pass counts only.

## What was checked, and the result

### Automated checks on the combined branch

| Check                                                     | Result                                                                                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Unit tests (Vitest)                                       | 449 files, 5,479 passed, 1 skipped                                                                                         |
| ESLint (`--max-warnings 0`)                               | clean                                                                                                                      |
| TypeScript (`tsc --noEmit`)                               | clean                                                                                                                      |
| Production build                                          | succeeds; no test engine in the build                                                                                      |
| Playwright, Chrome, Firefox and mobile Chrome, no retries | about 2,340 run; 1 failure, a cold-start timeout that passes on a warm server and is in a file this branch does not change |

One unit test failed once in one of four full runs and passed in the others. It was not identified.

### Real-records checks (final26)

| Area                                                                                  | Result                                                                                               |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Import of the full document set into a brand-new browser profile                      | every import completes; every rated condition, service period and timeline event shown, 0 duplicates |
| Same result in reversed order, after upgrade from an older build, and after re-import | identical                                                                                            |
| "Service began" date across the app                                                   | agrees in 25 of 25 places, in 26 captures, after every editor and re-import                          |
| Four imports at once                                                                  | 8 of 8 complete, no document lost                                                                    |
| Import time alone                                                                     | about 400 seconds; equal to the previous round measured back to back                                 |
| Quick Exit during an import                                                           | 13 to 125 ms at normal speed; 22 to 174 ms at 4x CPU slowdown                                        |
| Triple-Escape during an import                                                        | 260 to 308 ms at normal speed; 279 to 499 ms at 4x                                                   |
| Text sent to an off-device AI provider                                                | 0 document text, 0 identifiers in 68 request bodies; the known city and ZIP remainder is unchanged   |
| Browser console and bug reports                                                       | 0 file names and 0 identifiers in 778,071 captured lines                                             |
| DD-214 Analyzer: rows read by the AI                                                  | 453 shown, all labelled as read by the AI, 0 pre-ticked                                              |
| DD-214 Analyzer: pre-ticked rows                                                      | 18 over 36 readings, all read by the local parser, 18 correct, 0 wrong                               |
| DD-214 Analyzer: identifiers in education and awards rows                             | 0                                                                                                    |
| C-File Analyzer                                                                       | saves nothing until Save; Save files the letter once; re-saving adds nothing                         |
| C-File cloud-only fallback                                                            | every rated condition and denial found; 0 unclean findings                                           |
| Unreadable saved profile                                                              | app answers in 1 to 12 ms, one plain notice, Quick Exit unaffected, every tool opens                 |
| Failed or unreadable document                                                         | plain message with Retry; Retry completes; no technical text                                         |
| Browser killed mid-import                                                             | notice within 3 seconds of the next start; re-adding the files completes with no duplicates          |

## Decisions this branch implements

| Decision                                                                                     | Where it is recorded |
| -------------------------------------------------------------------------------------------- | -------------------- |
| One authoritative service-history store; "service began" is chronological across enlistments | ADR-007              |
| No direct identifiers in AI contexts built from stored data                                  | ADR-008              |
| Raw documents are read only by an on-device engine; off-device AI gets structured context    | ADR-009              |
| The AI is never the source of an identifier field; nothing it reads is pre-selected          | ADR-009              |
| A local-parser value is pre-selected only when it passes the same checks as an AI value      | ADR-009              |
| Every analyzer saves nothing until the veteran confirms                                      | ADR-009              |
| Every "Clear All Data" is the same full delete, in every open tab                            | tests                |
| Only an Escape that closes a tool dialog is exempt from the triple-Escape exit               | tests                |

## Known issues carried forward

All are Low and none loses or exposes data.

1. After a hard browser kill during very fast saves, the interrupted-import notice can state fewer saved documents than were stored.
2. The awards row on the DD-214 review screen drops some award-number and device suffixes. The rows are unticked.
3. Firefox on-device decoding of an image did not finish within 30 minutes on the test machine. It could not be separated from that machine's graphics card dropping to a low-power clock.
4. On scans where the parser reads no date of birth, the AI occasionally places one in a service-date row. It is shown unticked and labelled, and is never saved without the veteran ticking it.
5. If every local-storage read throws, the app shows a blank page. Single-key failures are handled.
6. City and ZIP can remain in text built for an off-device AI when they are not known values.

## Not verified

- A real cloud AI provider. All off-device checks used request capture with a stub.
- Whether the production build contains the test engine, from the verifier's side. The integrator's scan of the build found none.
- GitHub Actions. Every result above is local; the pull request's checks are the gate for merging.
- Stock Firefox for the full import. Firefox was exercised through the Playwright suite and targeted probes.

## How to reproduce the automated part

```bash
npx vitest run
npx eslint src --max-warnings 0
npx tsc --noEmit
npm run build
npx playwright test --retries=0
```
