# Observability — what we DO and don't do

Closes [AUDIT_FINDINGS](AUDIT_FINDINGS.md) **#38** (observability-monitoring).
The original audit row read *"~1,215 `console.log` calls in src/; no
OpenTelemetry; no structured logging; no Sentry / Datadog (intentional
under zero-knowledge stance); …"* — listed as a `gap`. This file makes
the stance explicit and inventories the local-first machinery we DO
ship.

## Why standard observability is rejected

The app is a **local-first, zero-knowledge SPA**. Every standard
observability primitive assumes a server-side aggregator:

| Standard tool | Why it does not fit |
|---|---|
| OpenTelemetry / OTLP | Streams traces to a collector. Collector = remote sink = leaks user data. |
| Sentry / Datadog / Honeycomb | Hosted SaaS. Bug reports include stack frames + page state, which would carry veteran data. |
| Health endpoints (`/health`, `/ready`) | There is no server to probe. |
| SLO burn-rate alerting | No service to burn — the app runs entirely on the veteran's device. |
| Centralized error tracking | Same issue as Sentry. Every shipped error report is a privacy leak. |

The audit's framing ("no structured logging" as a gap) is **the wrong
shape for this product**. The compliant outcome is not "add Sentry"; it
is "ship local-only structured logging that the user can read, export,
and clear."

## What we DO ship

### 1. Structured local logger — [src/utils/logger.js](../src/utils/logger.js)

- **Levels:** `debug` / `info` / `warn` / `error` (numeric 10/20/30/40,
  Sentry-shaped so future swap-in is mechanical).
- **In-memory ring buffer:** 500 entries, FIFO eviction. Always
  available without touching disk.
- **Console passthrough:** on by default in Vite dev mode
  (`import.meta.env.DEV`), off in prod. Toggleable via
  `setConsolePassthrough(true|false)` so dev DX is preserved.
- **Optional IndexedDB persistence:** behind a user opt-in flag
  (`vet_rate_log_persist` in `localStorage`). Off by default. When on,
  entries are mirrored to IDB under `log:<seq>` keys so they survive
  reloads.
- **No auto-egress.** The only way logs leave the device is the
  explicit `exportLogs()` call, which returns a JSON-serializable
  object the caller (typically a user-driven "Export logs" UI button)
  saves locally.

API:

```js
import { logger, setLevel, getLogs, exportLogs,
         setPersistEnabled, clearLogs } from "./utils/logger";

logger.info("retrieval", { hits: 5, query_id: "q01" });
logger.warn("dim mismatch", { expected: 384, got: 768 });
logger.error("offline-fetch refused", { url, reason: "non-gov" });

setLevel("debug");          // raise verbosity (off by default)
setPersistEnabled(true);    // user opt-in for IDB persistence
const dump = exportLogs();  // {exportedAt, count, level, entries[]}
```

### 2. Append-only AI audit log — [src/utils/aiAuditLog.js](../src/utils/aiAuditLog.js)

The episodic memory layer documented in
[CONTEXT_VAULT.md §Layer 3](CONTEXT_VAULT.md). Already shipped; this is
the LLM-specific equivalent of the structured logger above, with one
additional property: every entry is **hash-chained** so silent
tampering is detectable.

Use it for every model call (AI completion, retrieval, swarm
invocation). Use the structured logger for everything else.

### 3. Error boundary — already shipped

React error boundary is in place. Uncaught render errors land in the
ring buffer (when call sites flip to `logger.error`) and the error
boundary surfaces a user-visible recovery UI. There is no automatic
remote report — recovery is the only feedback channel.

## Hygiene rules

These apply to every call site that uses the logger:

1. **PII discipline at the call site.** The logger does NOT auto-scrub.
   Auto-scrubbing would mask real bugs at dev time. If you log
   user-derived content, call [piiScrubber](../src/utils/piiScrubber.js)
   first.
2. **Levels mean what they say.** `error` is for invariant violations
   the user needs to know about; `warn` is for recoverable degradation;
   `info` is the default for routine state changes; `debug` is
   off by default and exists for opt-in noisy traces.
3. **No PII in `fields`.** The structured-context object is shown
   verbatim in the export. Pass digests or scrubbed values when in
   doubt.
4. **No external sinks.** Do not pipe logger output to fetch / XHR /
   WebSocket / postMessage to a cross-origin frame. The export call is
   the only sanctioned egress, and it goes through the user.

## Console.log migration — deliberately incremental

There are ~1,215 `console.log` calls in `src/` at the time of writing.
The B18 audit-closure did NOT migrate them all in one sweep. Reasons:

- Dev-time `console.log` and structured `logger.info` are **different
  tools**. The former is for debugging *right now*; the latter is for
  capture + export. A blanket codemod would replace one with the other
  and lose dev DX.
- The high-value migration targets are the call sites that:
  (a) run in production builds AND
  (b) carry diagnostic context worth exporting (errors, refusals,
      retrieval misses, network failures).
- Bulk replacement across an audit-closure PR conflates two reviews
  into one. Per-feature adoption is cleaner and lower-risk.

The expected adoption pattern: when touching any module for another
reason, swap its `console.log` to the appropriate `logger.*` call. New
code uses `logger` from day one.

## Re-audit triggers

- Adding any non-local sink (Sentry, Datadog, OTLP, custom telemetry
  endpoint) — would re-open the zero-knowledge debate. Stage a Risk
  Register entry first.
- Switching from `localStorage` opt-in to a different consent
  mechanism.
- Increasing the ring-buffer size (current: 500). Worth a re-read if
  bumping past ~5000 because memory cost becomes user-visible on
  low-end devices.
- Adding new log levels — `LEVELS` is frozen for a reason; rotation
  requires touching the test suite.
