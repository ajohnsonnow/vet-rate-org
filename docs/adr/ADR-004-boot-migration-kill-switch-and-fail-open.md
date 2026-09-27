# ADR-004: Boot migration - fail-open timeout, maintenance kill switch, pre-mount dialog no-ops

**Status:** Accepted
**Date:** 2026-09-27
**Context:** Boot sequence hardening — the IndexedDB migration runs before the interactive tree mounts (see `useBootSequence.js`'s `isBooting` gate); this records the three load-bearing decisions in that design that a future change could easily undo without realizing why they're there.

---

## Context

`useBootSequence.js` gates the interactive tree's first mount on `isBooting`: nothing under `App.jsx` mounts - and no dialog can open, no listener can attach - until the localStorage→IndexedDB migration decision (and the copy itself, if one is needed) has resolved. While that gate is up, `MigrationScreen` is the only thing on screen.

Three properties of that design are easy to get wrong in a future edit, because each looks like it should behave differently than it actually does:

1. How long the boot gate is allowed to wait on the migration decision before giving up.
2. How a maintenance-mode kill switch can stop the migration without making boot depend on the network.
3. What happens to a dialog-open request (`window.dispatchEvent(new CustomEvent("openXyz"))`) fired before the interactive tree exists to hear it.

## Decision

### 1. Fail-open timeout on the migration decision

`needsMigration()`'s IndexedDB open can stall or block indefinitely - most concretely, another tab running Atomic Wipe's `clearIndexedDb()` mid-delete (`AtomicWipe.jsx`). The boot gate must never leave a veteran stuck on `MigrationScreen` with no way out because of that.

`runStorageMigration()` races the decision against `MIGRATION_DECISION_TIMEOUT_MS` (3000ms). If the decision hasn't settled by then, `isBooting` still flips false - the interactive tree mounts - and the decision (plus the copy itself, if one turns out to be needed) keeps resolving in the background via `finishMigrationInBackground()`, still updating `isMigrating` when it eventually does. `MigrationScreen` renders `QuickExitButton` unconditionally specifically because of this: it must be reachable the instant the screen renders, independent of whether or when the boot gate resolves.

### 2. Maintenance-mode kill switch

The maintenance-mode check (`maintenanceMode.js`) is a network fetch with no timeout, deliberately decoupled from the migration: boot must never wait on the network to decide whether to migrate. But the kill switch still has to be able to stop a migration under two different timing scenarios, neither of which can afford a network round trip mid-decision:

- **Before it starts.** `maintenanceMode.js` caches the last-known flag (`MAINTENANCE_MODE_CACHE_KEY` in `localStorage`) on every successful fetch, on or off. `readCachedMaintenanceMode()` is a synchronous read of that cache - `initializeApp()` checks it before ever calling `runStorageMigration()`, and skips starting a migration entirely for this boot if it's on. This is a real skip, not a slow-path: no `await`, no IndexedDB open, nothing.
- **While one is running.** The live fetch (already in flight, per the decoupling above) can resolve "on" after a copy has already started. `checkMaintenanceMode()` takes an `onMaintenanceOn` callback and calls it synchronously the moment it detects maintenance is on; `useBootSequence.js`'s `createMaintenanceKillSwitch()` wires that callback to trip a `shouldAbort()` flag threaded through `runMigrationCopy` → `storage.js`'s `migrateFromLocalStorage({ shouldAbort })`. The copy loop checks `shouldAbort()` before copying each key and stops there if it's true.

This is safe specifically because `migrateFromLocalStorage()` is **not destructive**: it only ever writes to IndexedDB and never deletes or clears the `localStorage` originals (see the "DO NOT clear localStorage" comment in `storage.js` - the originals stay live so the app can keep reading from them either way). Stopping mid-loop leaves already-copied keys in IndexedDB (harmless - a later full copy just overwrites them, idempotently) and, critically, never writes the `MIGRATION_KEY` completion flag. `needsMigration()` therefore still reports `true` on a later boot, so an aborted migration is finished by whichever future boot next runs with maintenance off, without the veteran ever noticing a partial state. If a future change ever adds a genuinely destructive step to this migration (e.g. clearing the originals after a verified copy), it must sit _after_ the `shouldAbort()` check and before nothing else does - this decision is what makes that check load-bearing rather than decorative today.

The cache read/write and the abort check are both designed to fail open on a storage error (private-browsing/quota `localStorage` throwing): a failed cache read is treated as "not in maintenance", a failed cache write just means the next successful fetch overwrites it again, and neither ever blocks boot or loses data.

### 3. Pre-mount `open*` dialog events are no-ops by design

Every tool dialog in this app opens via a `window.addEventListener("openXyz", ...)` registered in a `useEffect` on mount (e.g. `MyPacketModal.jsx`'s `openMyPacket`). Those components do not exist in the DOM - and so are not listening - until the interactive tree mounts, which `isBooting` holds back for exactly as long as described above. A `dispatchEvent` fired at `window` before that point has zero listeners to reach; it is inert by ordinary `EventTarget` semantics, not by any special-cased guard in this codebase.

No production code dispatches an `openXyz` event before mount today. This is recorded as a decision (not left as an implicit assumption) because it's the reason `boot-migration.spec.ts`'s dialog-survival tests can safely fire a raw `dispatchEvent` immediately after `page.goto("/")` and treat it as a guaranteed no-op rather than a race - and because it means a future feature that needs to queue a dialog-open request across the boot gate (e.g. a deep link) must explicitly buffer and replay it once `isBooting` clears, rather than assuming today's fire-and-forget dispatch pattern will still reach anything.

## Consequences

- `MIGRATION_DECISION_TIMEOUT_MS`, the kill switch, and the pre-mount no-op behavior are all covered by unit tests (`useBootSequence.test.js`, `storage.test.js`, `maintenanceMode.test.js`) and the existing `boot-migration.spec.ts` e2e coverage - a future change to any of the three should update those, not just this document.
- Product-visible behavior: a returning user who loads the app while maintenance just turned on gets the maintenance page without ever having started (or partway through) a migration copy; a user already mid-copy when maintenance turns on is not shown an error - the copy silently completes on their next real visit.
- If a genuinely destructive step is ever added to `migrateFromLocalStorage()` (see the note in Decision 2), revisit this ADR - the `shouldAbort()` contract was designed for that day, but nothing currently exercises it against an actual deletion.
