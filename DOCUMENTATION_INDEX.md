# 📚 Vet-Rate.org Documentation Index

**Master Guide to All Documentation**

*Last Updated: January 18, 2026*

---

## 🎯 Quick Links - Start Here

| Document | Purpose | Audience |
|----------|---------|----------|
| [DIAMOND_FEATURES_USER_GUIDE.md](DIAMOND_FEATURES_USER_GUIDE.md) | **Complete User Guide** - Every feature explained | Veterans, VSOs |
| [README.md](README.md) | Project overview and setup | Developers |
| [QOL_QUICK_START.md](QOL_QUICK_START.md) | Quick start for Bunker, Time Machine, Checklist | Veterans |

---

## �- For Veterans & VSOs

### Getting Started
| Document | Description |
|----------|-------------|
| **[DIAMOND_FEATURES_USER_GUIDE.md](DIAMOND_FEATURES_USER_GUIDE.md)** | 🌟 **START HERE** - Complete guide to all 30+ features |
| [QOL_QUICK_START.md](QOL_QUICK_START.md) | Quick guide to Bunker, Time Machine, Commander's Checklist |
| [DIAMOND_TIER_QUICK_START.md](DIAMOND_TIER_QUICK_START.md) | Quick guide to AI-powered features |

### Feature Guides
| Document | Features Covered |
|----------|-----------------|
| [AUTO_SCRIBE_FEATURE_GUIDE.md](AUTO_SCRIBE_FEATURE_GUIDE.md) | PDF form filling, multi-page support, preview |
| [AUTO_SCRIBE_VSO_QUICK_REFERENCE.md](AUTO_SCRIBE_VSO_QUICK_REFERENCE.md) | VSO-specific Auto-Scribe instructions |
| [FORCE_MULTIPLIER_QUICK_REFERENCE.md](FORCE_MULTIPLIER_QUICK_REFERENCE.md) | Body Map, Stress Test, Evidence Timeline |
| [GOLD_STANDARD_FEATURES.md](GOLD_STANDARD_FEATURES.md) | Tribunal, Consistency Engine, Statement Analyzer |

### Security & Privacy
| Document | Description |
|----------|-------------|
| [SECURITY_QUICK_START.md](SECURITY_QUICK_START.md) | Security features overview |
| [docs/privacy/](docs/privacy/) | Detailed privacy documentation |

---

## 🛠️ For Developers

### Setup & Deployment
| Document | Description |
|----------|-------------|
| [README.md](README.md) | Installation, project structure, requirements |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment guide |
| [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) | Pre-deployment verification |
| [docs/BUILD.md](docs/BUILD.md) | Build configuration |

### Technical Implementation
| Document | Features Documented |
|----------|---------------------|
| [FORCE_MULTIPLIER_FEATURES.md](FORCE_MULTIPLIER_FEATURES.md) | Body Map, Stress Test, Timeline implementation |
| [DIAMOND_TIER_FEATURES.md](DIAMOND_TIER_FEATURES.md) | AI feature implementation details |
| [PHASE_2_IMPLEMENTATION.md](PHASE_2_IMPLEMENTATION.md) | Secondary conditions, Nexus Builder |
| [QOL_FEATURES_README.md](QOL_FEATURES_README.md) | QoL feature implementation |

### Security
| Document | Description |
|----------|-------------|
| [SECURITY.md](SECURITY.md) | Security architecture overview |
| [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) | Detailed security implementation |
| [SECURITY_IMPLEMENTATION_COMPLETE.md](SECURITY_IMPLEMENTATION_COMPLETE.md) | Security audit report |
| [CRISIS_SAFETY_IMPLEMENTATION.md](CRISIS_SAFETY_IMPLEMENTATION.md) | Crisis intervention system |

### Data & Validation
| Document | Description |
|----------|-------------|
| [ECFR_VALIDATION_REPORT.md](ECFR_VALIDATION_REPORT.md) | eCFR compliance validation (751 conditions) |
| [PACKET_COMMANDER_INDEXEDDB.md](PACKET_COMMANDER_INDEXEDDB.md) | Data storage architecture |

---

## 🧪 Testing & QA

| Document | Description |
|----------|-------------|
| [QA_BATTLE_DRILL_CHECKLIST.md](QA_BATTLE_DRILL_CHECKLIST.md) | 109+ test cases for all features |
| [TERMS_TESTING_GUIDE.md](TERMS_TESTING_GUIDE.md) | Terms of Service testing |

---

## 📋 Feature Summary by Category

### 📊 Calculate Your Rating
- **Tactical Calculator** - VA Math with 2026 rates, bilateral factors

### 🔍 Discover Your Claims
- **Secondary Scout** - Find 500+ secondary conditions
- **C&P Exam Simulator** - Practice DBQ questions
- **Exam Prep Room** - See DBQ before your exam 🆕
- **Pathfinder** - AI-powered claims strategy

### 📋 Build Your Evidence
- **C-File AI Analyzer** - AI analysis of claims file
- **Blue Button X-Ray** - Parse VA health records
- **PDF Evidence Finder** - Search STRs 🆕
- **Witness Bench** - AI buddy statement generator
- **Nexus Builder** - Medical connection statements
- **Forms Helper** - 16+ VA forms with Auto-Scribe
- **Symptom Logger** - Track symptoms with body map

### 🎯 Quality Control
- **Red Team** - Find weak language
- **Decision Decoder** - Translate VA decisions
- **Denials Decoder** - OCR + AI analysis 🆕
- **Shark Radar** - Detect predatory services
- **Consistency Engine** - Find contradictions 🆕
- **Statement Analyzer** - Remove emotional language 🆕
- **Claim Stress Test** - Adversarial review 🆕

### ⚡ Advanced Strategy
- **TDIU Builder** - Unemployability evaluation
- **Risk Assessment** - "Poke the Bear" calculator
- **PACT Act Navigator** - Toxic exposure claims
- **FOIA Keysmith** - Records requests
- **The Tribunal** - Mock BVA hearing 🆕

### 💎 Shock & Awe
- **Million Dollar Dashboard** - Lifetime benefits value
- **MOS Hazard Matcher** - MOS-specific conditions
- **Web of Conditions** - Visual condition map

### 🤝 Support & Resources
- **The Bunker** - Backup/restore 🆕
- **Cloud Sync** - Google Drive backup 🆕
- **Time Machine** - ITF countdown 🆕
- **VSO Finder** - Locate free VSOs
- **State Benefit Hunter** - State-specific benefits
- **Legislative Watchdog** - Track VA rule changes

### 🔒 Security
- **Session Lock** - Auto-lock after inactivity
- **PIN Protection** - Encrypted data vault
- **Panic Button** - Emergency data wipe

---

## 📁 Project Structure

```
vet-rate-org/
├── src/
│   ├── components/          # 95+ React components
│   ├── utils/               # 19 utility modules
│   ├── data/                # Disability data (751 conditions)
│   └── contexts/            # React contexts
├── public/
│   ├── forms/               # 16 VA PDF forms
│   └── images/              # Assets
├── docs/                    # MkDocs documentation site
└── scripts/                 # Development utilities
```

---

## 🆕 Recent Updates (January 2026)

### eCFR Validation Complete
- All 751 diagnostic codes validated against official eCFR
- Added `lastVerifiedDate` and `ecfrLastAmended` to all entries
- Updated DC 9905 (TMD) with interincisal ROM criteria
- Added complete Tables VI, VIa, VII to DC 6100 (Hearing Loss)

### New Features
- **Exam Prep Room** - See DBQ questions before C&P exam
- **PDF Evidence Finder** - Search 2,000+ page STRs
- **Denials Decoder** - OCR scan denial letters
- **Consistency Engine** - Auto-detect contradictions
- **Statement Analyzer** - Remove emotional language
- **Claim Stress Test** - Adversarial claim review
- **The Tribunal** - Voice-interactive mock BVA hearing
- **Cloud Sync** - Google Drive backup
- **Time Machine** - ITF countdown tracker

---

## 📞 Support

- **In-App:** Click "🐛 Report Bug" in footer
- **GitHub:** [github.com/ajohnsonnow/vet-rate-org/issues](https://github.com/ajohnsonnow/vet-rate-org/issues)
- **Veterans Crisis Line:** 988, Press 1

---

*Built by a veteran, for veterans. �-️*
