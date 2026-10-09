# ADR-012: VSO multi-veteran silos

**Status:** Proposed. S0 and S1 are implemented; nothing at runtime uses the S1 modules yet. Accepting this ADR is Anth's call after Vera's V1 and V2 reports.
**Date:** 2026-10-08.
**Decided under:** [docs/VSO_SILOS_SPEC.md](../VSO_SILOS_SPEC.md) (decisions recorded 2026-09-24) and its companion [docs/VSO_ENCRYPTION_BRIEF.md](../VSO_ENCRYPTION_BRIEF.md).
**Numbering:** the spec calls this `ADR-004`. That number is taken by `ADR-004-service-entry-date-single-source-of-truth.md`, so this record uses the next free number, 012.

## 1. Context

A Veterans Service Officer may need to help several veterans on one device. The app has no multi-user code: every veteran-related value lives in `localStorage` under string-literal keys spread across about 100 files, in eleven or so IndexedDB opening sites, and in in-memory state. No veteran's data may appear in, be readable from, or be written into another veteran's workspace.

## 2. Decision

1. **Swap, do not prefix.** Everything that is not on an explicit device list belongs to a veteran. On a switch the veteran's `localStorage` keys are parked in a per-veteran store and removed, the incoming veteran's are loaded, and the page reloads. S1 supplies the classifier (`isDeviceKey` in `src/utils/siloScope.js`); the switch engine is S2.
2. **Fail closed on the classifier.** A key the list has never seen is veteran data (spec AC3). The device list is exact names plus four keystore prefixes. It is matched case-sensitively with no trimming, non-strings are veteran data, and a near miss such as `vet_rate_kek` (no trailing underscore) is veteran data. The cost of a wrong "veteran" is a preference that resets per veteran; the cost of a wrong "device" is a leak.
3. **Per-veteran database names.** `siloDbName(base)` in `src/utils/siloDb.js` returns `base` for the legacy (first) veteran, or when no registry exists, and `${base}__s_${id}` for every other veteran. It resolves the active veteran once at module load, which is safe because every switch reloads the page. If a registry exists but the active veteran cannot be resolved (no active id, an id the registry does not list, or an unreadable registry), the call throws `SiloScopeError`. It never falls back to the unsuffixed names, because those are the legacy veteran's data. The per-veteran base names are one frozen list (`PER_VETERAN_DB_BASES`, nine entries); shared databases (`VetRate_DKB`, `vet-rate-dbq-cache`) and model caches are deliberately not on it, and a test reads the source files that open databases to catch a new database that is on neither list.
4. **Registry.** `vetrate_vso_registry` is stored in shared `localStorage` with the fields in spec section 3.1. `src/utils/vsoRegistry.js` validates the exact field set on every read and write. An unreadable or malformed registry is a distinct `corrupt` state, never "absent", and the mutating functions refuse to overwrite it. The display label is derived from `initials` and `caseRef` and never stored. Timestamps are ISO 8601 UTC strings; `reviewBy` is a `YYYY-MM-DD` date or null. `addSilo` throws unless the authorization acknowledgement is true, and records `authAckAt`.
5. **Entry-point flag.** `VITE_VSO_MODE_ENABLED` (default `false`) is read by `src/config/vsoMode.js`, next to `vaAuth.js` and in the same style: only the string `true`, case-insensitively, turns it on. It is not routed through `featureFlags.js`, which treats unknown features as enabled. It gates the entry point only; `isVsoModeActive()` is true whenever a registry key exists, whatever the flag says (AC8), so data is never stranded by a build that turns the flag off.
6. **Label rules (Q6)** live in `src/utils/vsoLabel.js`. They are set out in section 3 below.
7. **Help page first (Q8, S0).** The "one browser profile per veteran" guidance ships now, with no flag, from the footer and from VSO Finder. It is the isolation a representative can have today.

## 3. Label rules as implemented

- Initials: one to four letters (any script), each optionally followed by one period, so `J.D.S.` and `JDS` pass and `JD.S.X` does not. The spec says "1-4 characters, with periods allowed" in one place and "1-4 letters" in another; this reading satisfies both and bounds the length at eight characters.
- Case reference: 1 to 24 characters from `A-Z a-z 0-9 space - _ / # .`.
- Both fields are normalised with NFKC and trimmed before any check, so full-width and other compatibility digits and letters fold to ASCII. Characters outside the allowed set (zero-width characters, soft hyphens, non-ASCII digits that survive NFKC) fail the format check, and are still counted as digits by the privacy check.
- Blocked: the digits are counted with every non-digit ignored, so separators of any kind, repeated or mixed separators, letters between digit groups and a `C` or `c` prefix make no difference. Nine or more digits are reported as an SSN; exactly eight as a VA file number. The count is taken per field and over the two fields together, so an identifier split across initials and case reference is caught. This is stricter than the spec's `\d{3}[-\s]?\d{2}[-\s]?\d{4}` and "8 to 9 digits in a row" patterns, which `123.45.6789`, `123/45/6789` or `1 2 3 4 5 6 7 8 9` slip past.
- Cost of that choice: a case reference with eight or more digits in total is refused, for example `2024-0042`, `2024-12-31`, or `CASE 1234 5678`. References with seven or fewer digits pass, for example `2024-042` or `CASE-1042`. Eight is the smallest count that can be a VA file number; a VSO whose scheme needs more digits has to add letters or shorten the number.
- Warned, not blocked: two consecutive capitalised alphabetic words (`Jane Roe`) in the case reference.
- Error messages never include the text that was entered, and a rejected result carries no value, so an SSN-shaped string typed into the field is not handed back to code that might log it.

## 4. Rejected alternatives

- Adding a veteran prefix to keys at all of the roughly 100 `localStorage` call sites: any key added later leaks by default.
- A proxy on `Storage.prototype` that rewrites keys: breaks the `key(i)` and `length` loops in `cloudEncryption.js` and `storage.js`.
- A separate subdomain per veteran: the strongest isolation, but every veteran would re-download the multi-gigabyte AI models, and it needs DNS changes.

## 5. Consequences and limits

- S1 changes no runtime behaviour. Only the S0 help page's own code is reachable from the app; the S1 modules have no importers outside their tests.
- The registry is read-modify-written with synchronous `localStorage` calls. Two tabs editing the registry at the same moment could interleave. The switch engine (S2) and the dialogs (S3) hold the `vetrate_silo_switch` web lock while they change it; the registry module does not take that lock itself.
- Browser-profile separation (the help page) protects veterans from each other, not the files if the device is lost. Per-veteran encryption is the companion brief and is required before VSO mode is turned on in production (spec F1, AC17).
- Legal questions Q3 and Q5 stay open for counsel. The authorization acknowledgement and the review-by reminder are product safeguards only; neither deletes anything.
