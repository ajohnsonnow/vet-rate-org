# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

