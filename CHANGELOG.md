# Changelog

All notable changes to Vet-Rate.org will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.2.4] - 2026-01-21

### Fixed
- **DD214 Analyzer UX**: Analysis now automatically displays ProfileImportConfirmModal after completion
- Users no longer confused about where extracted data went
- Modal shows side-by-side comparison with automatic field selection
- Provides clear confirmation and review flow for imported data

## [1.4.2.3] - 2026-01-21

### Fixed
- **AI Badge Model Name Race Condition**: AI status badge now correctly displays current model name
- Fixed issue where previous model name persisted after loading new model
- Resolved by saving model ID to localStorage BEFORE registering engine
- Badge now updates immediately when model loads

## [1.4.2.2] - 2026-01-21

### Fixed
- **WebGPU Adapter Consumed Error**: Fixed "adapter is 'consumed'" error when toggling experimental mode
- Implemented `forceReinit` option that properly destroys old device and requests fresh adapter
- WebGPU devices can now be reinitialized without browser reload
- Experimental mode toggle now works reliably without crashes

## [1.4.2.1] - 2026-01-21

### Fixed
- **Local AI Panel Crash**: Fixed `experimentalMode` undefined ReferenceError
- Exposed experimental mode states through LocalAIContext
- Added missing context values: experimentalMode, setExperimentalMode, dawnFeaturesEnabled, setDawnFeaturesEnabled
- **WebGPU WGSL Shader Error**: Added `chromium_experimental_subgroup_matrix` to experimental features
- Enables u8 type support in WGSL shaders required by WebLLM models
- Models like Llama, Phi, Qwen, DeepSeek now load without type errors

### Documentation
- **Local AI Setup Guide**: Added comprehensive FAQ section for Faraday Cage (Local AI)
- Step-by-step Chrome flags configuration for Windows, Mac, Linux
- WebGPU troubleshooting guide with 5-step resolution process
- Cloud AI vs Local AI comparison table
- Privacy and data handling clarifications

## [1.4.2] - 2026-01-21

### Added
- **WebGPU Local AI (Faraday Cage Protocol)**: Run AI models 100% locally in browser using WebGPU
  - Zero data leaves your device - complete offline operation
  - Supports Llama, Phi, Qwen, DeepSeek, and other WebLLM models
  - GPU acceleration for fast inference
  - WebGPU adapter selection with automatic best GPU detection
  - Experimental features support for advanced models
- **AI Settings Modal Enhancement**: Global AI configuration interface
  - Switch between Cloud AI (Gemini) and Local AI modes
  - Model selection and loading interface
  - Real-time AI status badge showing current mode and model
  - WebGPU adapter management and feature toggles
- **DD214 Analyzer Improvements**: Enhanced document processing
  - AI-powered extraction of service history, awards, discharge info
  - Automatic field mapping to veteran profile
  - Profile import confirmation with selective field import
- **Dynamic Stats System**: All feature counts now update from single source of truth
  - Eliminates hardcoded numbers across codebase
  - Automatic consistency across What's New modal, README, docs
  - Central projectStats.js manages all counts

### Changed
- Updated What's New modal to use dynamic stats from projectStats.js
- Improved AI configuration workflow for better user experience
- Enhanced privacy messaging for local vs cloud AI operation

### Fixed
- Resolved hardcoded feature count inconsistencies
- Fixed modal scrollbar behavior
- Improved error handling in AI service layer

## [1.3.2] - 2026-01-20

### Changed
- Updated What's New modal to display dynamic feature statistics
- All stats now source from central projectStats.js module

### Fixed
- Fixed hardcoded feature counts in changelog display
- Improved consistency across UI stat displays

## [1.2.0] - 2026-01-19

### Added
- **Calculate Your Rating Section**
  - Tactical Calculator: Advanced combined rating with VA math, bilateral factors, dependents
  - Million Dollar Dashboard: Lifetime benefit value calculator ($1-2.5M+)
  - What-If Sandbox: Drag-and-drop rating scenario planner
  - Retro Pay Hunter: Find missed backpay from rating history errors
  - Time Machine: Intent to File countdown with backpay tracking

- **Discover Your Claims Section**
  - Secondary Scout: 500+ medically-recognized secondary conditions with probability ratings
  - C&P Exam Simulator: Practice DBQ-aligned questions before your exam
  - Pathfinder: AI-powered strategic roadmap for claims process
  - MOS Hazard Matcher: Link military jobs to exposures and conditions
  - PACT Act Navigator: Identify toxic exposure presumptive conditions
  - Web of Conditions: Interactive visualization of disability connections

- **Build Your Evidence Section**
  - C-File AI Analyzer: AI finds evidence in thousands of pages
  - Blue Button X-Ray: Parse VA health records for claim-relevant diagnoses
  - PDF Evidence Finder (The Needle): Search 2,000+ page STRs for keywords
  - Witness Bench: AI-assisted buddy statement generator
  - Nexus Builder: Generate medical nexus statements
  - Forms Helper with Auto-Scribe: Guided assistance for 16+ VA forms
  - Symptom Logger: Track daily symptoms with body map selector
  - Pain Painter: Interactive body map with diagnostic code suggestions
  - Evidence Timeline: Visual continuity tracker with gap detection
  - FOIA Keysmith: Generate FOIA requests for military and VA records

- **Quality Control Section**
  - Red Team: AI devil's advocate for statement strengthening
  - Claim Stress Test (War Game): Adversarial review before submission
  - Decision Decoder: Translate VA decision letters to plain English
  - Denials Decoder: OCR scan and analyze denial letters
  - Shark Radar: Identify predatory claim services
  - Consistency Engine: Auto-detect contradictions in statements
  - Evidence Gap Visualizer: See exactly what evidence is missing
  - Risk Assessment (Poke the Bear): Check protections before filing

- **Maximize Your Rating Section**
  - TDIU Builder: Total Disability Individual Unemployability assistant
  - State Benefit Hunter: Discover state-level veteran benefits (all 50 states)
  - The Tribunal: Voice-interactive mock BVA hearing simulator
  - Legislative Watchdog: Track VA rule changes in Federal Register

- **Support & Resources Section**
  - VSO Finder: Locate free, accredited Veterans Service Officers
  - The Bunker: Backup manager with export/import functionality
  - Cloud Sync: Encrypted backup to Google Drive
  - My Packet: Claims evidence management system
  - VA Resources Hub: Curated links to official VA programs
  - User Manual: Comprehensive feature guide

- **Privacy & Security Features**
  - 100% Client-Side Processing: All data stays in your browser
  - No accounts, no tracking, no PII storage
  - Sanitize & Share: Screenshot with automatic PII redaction
  - WCAG 2.1 AA Compliance: Full accessibility support

### Data & Content
- **751 VA Disabilities Validated**: Complete coverage from 38 CFR Part 4
- All diagnostic codes verified against eCFR January 2026
- Comprehensive secondary condition database with medical research citations

---

## Version History Summary

- **1.4.2.x Series**: Local AI (Faraday Cage) implementation and critical hotfixes
- **1.3.x Series**: Dynamic stats system and infrastructure improvements  
- **1.2.0**: Initial feature-complete release with 40+ veteran claim tools

---

## Maintenance Notes

**Automatic Updates**: The app checks for updates every 15 minutes and notifies users of new versions.

**Deployment Process**:
1. Update `package.json` version (use `npm version patch|minor|major`)
2. Update this CHANGELOG.md with release notes
3. Update `src/data/changelog.json` for What's New modal
4. Run `npm run sync-version` to sync version across files
5. Run `npm run build` to create production build
6. Deploy to hosting platform

**Version Format**: `MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking changes, major rewrites
- **MINOR**: New features, non-breaking additions
- **PATCH**: Bug fixes, small improvements

---

*For detailed technical documentation, see `/docs` directory.*
