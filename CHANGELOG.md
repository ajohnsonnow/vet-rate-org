# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- ✨ **Service History**: NGB-22 Box 18 activation-window (IADT/AD) date ranges now feed the multi-period service-history model as additional periods, alongside the primary DD214 period
- ✨ **Ribbon Rack**: award/ribbon matching now covers 780 state and territory National Guard awards across all 54 jurisdictions (50 states + DC/PR/GU/VI), on top of the existing 89 federal awards
- ✨ **My Packet**: derived TL;DR and per-document findings surfaced from ingested C-File/DD214 documents
- ✨ **Tools Menu**: Appeals Lane Advisor, Remand Risk Checker, and Knowledge Base added to the desktop Tools menu (previously reachable only via direct event dispatch or the mobile menu); Claim Navigator added to the tools registry (single source of truth), correcting the published tool count to 45

### Fixed

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
