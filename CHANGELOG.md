# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.30.1] - 2026-08-25

### Fixed

- 🐛 let HMR follow the dev server port so E2E can run alongside it
- 🐛 correct document extraction and combat-service determination

### Documentation

- 📚 document combat-service determination; correct stale extraction claims

### Added

- ✨ **Combat Service**: combat participation is now determined from VA's own decoration list (M21-1, Part VIII, Subpart iv, 1.A.3.h) in a single shared module, replacing three call sites that disagreed with each other. The finding is stored on your record, shown on the My Packet Service tab with its citation, and passed to every AI tool along with the 38 U.S.C. 1154(b) / 38 CFR 3.304(f)(2) rules it invokes
- ✨ **Rating Decisions**: decision letters are classified distinctly from generic correspondence, and per-issue outcomes, decision tables, effective dates and combined-rating history are extracted from them
- ✨ **Service History**: NGB-22 Box 18 activation-window (IADT/AD) date ranges now feed the multi-period service-history model as additional periods, alongside the primary DD214 period
- ✨ **Ribbon Rack**: award/ribbon matching now covers 780 state and territory National Guard awards across all 54 jurisdictions (50 states + DC/PR/GU/VI), on top of the existing 89 federal awards
- ✨ **My Packet**: derived TL;DR and per-document findings surfaced from ingested C-File/DD214 documents
- ✨ **Tools Menu**: Appeals Lane Advisor, Remand Risk Checker, and Knowledge Base added to the desktop Tools menu (previously reachable only via direct event dispatch or the mobile menu); Claim Navigator added to the tools registry (single source of truth), correcting the published tool count to 45

### Fixed

- 🐛 **Combat Service**: the Combat Action Badge, Combat Infantryman Badge and Purple Heart were all recorded as non-combat awards, because combat status was decided by looking for a "V"/"C" device and none of those decorations carry one
- 🐛 **Combat Service**: the bulk-import path never produced a combat determination at all, so a veteran with a qualifying decoration reached the profile, knowledge base, packet export and AI context as a non-combat veteran regardless of what Block 13 said
- 🐛 **Combat Service**: campaign, expeditionary and service medals (including the Global War on Terrorism Service Medal) were presented as establishing combat service; they are now reported separately as evidence of service in a theater, which corroborates presence rather than participation. A Bronze Star without the valor device no longer counts, and hostile-fire/imminent-danger pay is reported without marking the veteran as a combat veteran
- 🐛 **Combat Service**: a decoration matching as both a badge and a ribbon was listed twice; a combat medal that produced no badge match (Purple Heart, Silver Star) showed no combat panel at all; and combat established by one page of a multi-page DD214 could be retracted by a later page that simply had no Block 13
- 🐛 **DD214/NGB-22**: scanned service records are read by the OCR ensemble rather than the vision model, which on real scans produced confident but invented names; vision output must now clear a field-level confidence bar before it can replace OCR text
- 🐛 **DD214/NGB-22**: zero-for-O OCR correction now runs before the l/I digit rules, which had been turning "NATI0NAL" into "NAT1ONAL" and losing the NGB22 form type
- 🐛 **Intelligence Briefing**: fixed a crash that blanked the review screen for any veteran with a combat award (award objects in ribbon-rack shape hit `.toUpperCase()` on an object)
- 🐛 **AI Tools**: the SERVICE HISTORY block of the AI system prompt was an empty header for every veteran - branch, MOS, service dates and combat status were read from the wrong level of the stored service-history object
- 🐛 **DD214/NGB-22**: name extraction survives OCR reading-order scrambling (Box 1 no longer requires "2. DEPARTMENT" to appear after "1. NAME" in the OCR text stream)
- 🐛 **DD214/NGB-22**: recover NGB-22 Box 18 label OCR misses (e.g. "1A DT" for "IADT") and fix Box 7a place-of-entry box numbering
- 🐛 **DD214/NGB-22**: extracted name now reaches the Profile and Service tabs (whitelist + profile-mapping gaps silently dropped it before); Service tab shows the real source form (DD214/NGB22/DD256/DD257) instead of a hardcoded "DD-214, Block 1" citation
- 🐛 **C-File**: ingestion pipeline now actually extracts, stores, and surfaces findings end to end for large consolidated C-Files (documentClassifier was scoring only the first 10,000 characters, misrouting 2,000+ page files away from the medical-segmentation path)
- 🐛 **My Packet**: dedupe re-imported documents instead of appending duplicate rows on every re-import
- 🐛 **Tools Menu**: fix hardcoded "Knowledge Base" / "🎖️ BDD Builder" strings to use translation keys; reconcile the "Record Search" / "PDF Evidence Finder" naming split between the live menu and the tools registry

## [1.23.1] - 2026-06-08

### Fixed

- 🐛 **AI Service**: MEDIUM audit fixes — routing and tool-count mismatches from mega-audit 2026-06-08
- 🐛 **UX/Safety**: CRITICAL+HIGH fixes from mega-audit 2026-06-08 (UI dead-ends, safety guardrails)
- 🐛 **Diamond Swarm**: apply WebGPU adapter patch + fail loudly when all models fail
- 🐛 **Discovery**: hydrate NexusBuilder from localStorage when no event detail present

### Documentation

- 📚 add 2026-06-08 mega-audit reports and sprint instructions to docs/

## [1.23.0] - 2026-06-08

### Added

- ✨ unlock/deauth UI + cloudSync default-key retirement (commit G)
- ✨ at-rest device-passphrase keystore (KEK-wraps-DEK) (commit F)
- ✨ **Infrastructure**: emit brand-aware robots.txt + sitemap.xml at build
- ✨ add Open Graph / Twitter / canonical + iOS PWA meta
- ✨ hand-apply focus-trap + dialog a11y to bespoke overlays (Chunk 1)
- ✨ add error boundaries — app-level + per-cluster, one-tap crash report
- ✨ **UI/UX**: add header slot + gate props to ResponsiveModal (additive)

### Fixed

- 🐛 **Security**: resolve 7 Snyk/cSpell problems tab findings
- 🐛 close keystore adversarial findings (verify-before-commit, KEYSTORE_LOCKED, corruption/crash detection, Web Locks)
- 🐛 NFKC-normalize before PII scan; fix leaky legalAnswerer scrub
- 🐛 repair PWA manifest icons (generate 192/512 + maskable)
- 🐛 close no-undef + no-dupe-keys correctness backlog
- 🐛 **AI Configuration**: no-AI path opens AI settings instead of crashing (3 tools)
- 🐛 restore corrupted glyphs (U+FFFD) in legal + reference text
- 🐛 **UI/UX**: detect child col-span fixed layouts in grid audit

### Documentation

- 📚 record piiScrubber + lhci closure; pause rotation/deauth at owner gate
- 📚 record PWA/offline + SEO worklist (manifest, meta, robots/sitemap)
- 📚 mark S13 worklist complete (type-check job committed)
- 📚 **UI/UX**: record hard-redesign chunk (AIAssistant, DocIntel, VeteranTranslator, TheTribunal)
- 📚 **Support**: author NVDA/VoiceOver/TalkBack SR manual checklist
- 📚 record Bucket E verification — passive surfaces compliant, no code change
- 📚 record S10 verification gate green + closeout
- 📚 record grid mobile workstream — detector, apply, deferrals
- 📚 record Cluster H migration + critic-surface deferrals
- 📚 **Support**: mark Cluster G complete (G1+G2) with honest UserManual deferral note
- 📚 mark Cluster F complete + record F1-F9 migration
- 📚 record Cluster E migration in worklist
- 📚 record Cluster C + D migration in progress log
- 📚 record consent-gate migration + honest overflow metric in worklist
- 📚 discovery worklist + verified inventory (audit S9-S17)
