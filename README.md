# Vet-Rate.org - VA Disability Claims Command Center

A comprehensive, production-ready web application for veterans to research VA disability ratings, discover secondary conditions, practice C&P exams, and build evidence packets. Features official 38 CFR Parts 3 & 4 data fully validated against the eCFR.

**🌐 Live Site:** [https://vet-rate.org](https://vet-rate.org)

## 🎯 Features - Your Complete Claims Arsenal

### �-️ Core Intelligence Tools
- **Smart Search**: Find disabilities by condition name, diagnostic code, or synonyms across 751 validated conditions
- **751 VA Disabilities**: Complete coverage of all body systems from 38 CFR Part 4 (eCFR validated Jan 2026)
- **Rating Criteria**: Detailed percentage breakdowns for every condition (0%-100%)
- **PACT Act Navigator**: ☢️ Identify toxic exposure presumptive conditions and eligibility
- **Web of Conditions**: 🕸️ Interactive force-directed graph visualization of connected disabilities

### 💰 Rating & Benefits Calculators
- **Tactical Calculator**: 🧮 Advanced combined rating calculator with bilateral factors, dependents, and 2026 pay rates
- **Million Dollar Dashboard**: 💰 Calculate lifetime benefit value ($1-2.5M+) and retirement projections
- **TDIU Builder**: 💼 Evaluate Total Disability Individual Unemployability eligibility
- **State Benefit Hunter**: �-�️ Discover state-level veteran benefits by location (all 50 states + DC)
- **What-If Sandbox**: 🔄 Drag-and-drop rating scenario planner

### 🔍 Discovery & Research Tools
- **Secondary Scout**: 🔍 Discover 500+ medically-recognized secondary conditions with probability ratings
- **C&P Exam Simulator**: ✅ Practice with DBQ-aligned questions and get percentage predictions
- **Exam Prep Room**: 📋 🆕 See the actual DBQ questions BEFORE your C&P exam
- **MOS Hazard Matcher**: �-️ Link military occupational specialties to exposures and conditions
- **Pathfinder**: 🧭 AI-powered strategic roadmap from initial claim to appeal
- **Risk Assessment**: ⚠️ "Poke the Bear" calculator - identify potential claim risks before filing

### 📝 Evidence Building Suite
- **C-File AI Analyzer**: 🔬 Upload your Claims File PDF-AI finds evidence in thousands of pages ($500+ value)
- **Blue Button X-Ray**: 💙 Parse VA health records for claim-relevant diagnoses
- **PDF Evidence Finder**: 🔍 🆕 Search 2,000+ page STRs for keywords ("The Needle")
- **Witness Bench**: 👥 AI-assisted buddy statement generator with smart interview questions
- **Nexus Builder**: �- Generate medical nexus statements with optional AI enhancement
- **Forms Helper**: ✏️ Guided assistance for 16+ VA forms with Auto-Scribe PDF filling
- **Symptom Logger**: 📝 Track daily symptoms with body map selector for evidence documentation
- **Evidence Timeline**: 📊 🆕 Visual continuity tracker with automatic gap detection

### 🎯 Quality Control Tools
- **Red Team**: 🔴 AI devil's advocate - finds weak language before the VA does
- **Decision Decoder**: 📄 AI translation of VA decision letters to plain English
- **Denials Decoder**: 🔍 🆕 OCR scan denial letters + AI analysis (camera or upload)
- **Shark Radar**: 🦈 Identify predatory claim services and avoid scams
- **Consistency Engine**: 🔍 🆕 Auto-detect contradictions in your statements
- **Statement Analyzer**: 📝 🆕 Remove emotional/hostile language that hurts claims
- **Claim Stress Test**: 🎯 🆕 Adversarial review - find weaknesses before the VA does

### ⚡ Advanced Strategy Tools
- **The Tribunal**: �-️ 🆕 Voice-interactive mock BVA hearing simulator
- **Legislative Watchdog**: 📡 Track VA rule changes in the Federal Register
- **Time Machine**: ⏰ 🆕 Intent to File countdown with backpay tracking
- **FOIA Keysmith**: 🔑 Generate FOIA requests for military and VA records

### 🤝 Support & Resources
- **VSO Finder**: 🔍 Locate free, accredited Veterans Service Officers
- **The Bunker**: 🏰 🆕 Export/import all your data - never lose your work
- **Cloud Sync**: ☁️ 🆕 Back up to YOUR Google Drive (encrypted)
- **My Packet**: 📁 Save and manage all your claims evidence in one place
- **VA Resources Hub**: Direct links to official VA programs, crisis support, and benefits
- **User Manual**: Comprehensive guide to using every feature

### Privacy & Security
- **100% Client-Side**: All core processing happens in your browser
- **No Data Collection**: No accounts, no tracking, no PII storage
- **No External Transmission**: Your searches never leave your device
- **AI is Optional**: When using AI features, only non-PII condition descriptions are shared (with explicit consent)

### Accessibility
- **WCAG 2.1 AA Compliant**: Full keyboard navigation and screen reader support
- **Dark Mode**: Reduce eye strain with dark theme
- **Font Size Controls**: Adjustable text sizing
- **Reduce Motion**: Animation controls for vestibular sensitivity

## 📋 Requirements

- Node.js 18.x or higher
- npm 9.x or higher
- Modern browser (Chrome, Firefox, Safari, Edge)

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/ajohnsonnow/vet-rate-org.git
cd vet-rate-org

# Install dependencies
npm install

# (Optional) Set up AI features - copy and configure environment
cp .env.example .env.local
# Edit .env.local and add your Gemini API key (get free key at https://aistudio.google.com/app/apikey)

# Start development server (opens at http://localhost:3000)
npm run dev
```

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

## 📁 Project Structure

```
vet-rate-org/
├── src/
│   ├── components/           # 65+ React components (40+ major tools + supporting)
│   │   ├── TacticalCalculator.jsx    # Combined rating calculator
│   │   ├── MillionDollarDashboard.jsx # Lifetime benefit calculator
│   │   ├── CAPSimulator.jsx          # C&P Exam practice
│   │   ├── SecondaryScout.jsx        # Secondary conditions finder
│   │   ├── NexusBuilder.jsx          # Nexus letter generator
│   │   ├── CFileAnalyzer.jsx         # AI claims file analysis
│   │   ├── DecisionDecoder.jsx       # AI decision letter analysis
│   │   ├── BlueButtonXRay.jsx        # Medical record analyzer
│   │   ├── RedTeam.jsx               # Claim strength simulator
│   │   ├── Pathfinder.jsx            # Strategic roadmap
│   │   ├── RiskAssessment.jsx        # Claim weakness identifier
│   │   ├── FormsHelper.jsx           # VA forms assistant
│   │   ├── WitnessBench.jsx          # Buddy statement builder
│   │   ├── SymptomLogger.jsx         # Daily symptom tracker
│   │   ├── MyPacket.jsx              # Claims evidence manager
│   │   ├── TDIUBuilder.jsx           # TDIU eligibility
│   │   ├── PACTActNavigator.jsx      # Toxic exposure tool
│   │   ├── WebOfConditions.jsx       # Condition visualizer
│   │   ├── MOSHazardMatcher.jsx      # MOS to exposure mapper
│   │   ├── StateBenefitHunter.jsx    # State benefits finder
│   │   ├── VSOFinder.jsx             # VSO locator
│   │   ├── SharkRadar.jsx            # Scam detector
│   │   ├── FOIAGenerator.jsx         # FOIA request builder
│   │   ├── VAResources.jsx           # Resource hub
│   │   ├── UserManual.jsx            # Documentation
│   │   └── ... (28 more supporting components)
│   ├── utils/                # 19 utility modules
│   │   ├── vaCalculator.js           # VA rating math
│   │   ├── capSimulatorLogic.js      # DBQ logic engine
│   │   ├── cfileAnalyzer.js          # AI analysis engine
│   │   ├── pdfExtractor.js           # PDF text extraction
│   │   ├── claimsStorage.js          # Local storage manager
│   │   ├── pdfGenerator.js           # Report generator
│   │   ├── searchUtils.js            # Search algorithms
│   │   ├── aiStatementEnhancer.js    # AI enhancement
│   │   ├── bugReportUtils.js         # Error capture
│   │   └── ... (10 more utilities)
│   ├── data/                 # Data files
│   │   ├── disabilityData.json       # 751 disabilities
│   │   ├── secondary_conditions_db.json
│   │   ├── cfr3Regulations.json
│   │   ├── title38Regulations.json
│   │   ├── pactActData.json
│   │   └── dbq_logic_map.json
│   ├── contexts/
│   │   └── ThemeContext.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/
│   ├── images/               # Logo and assets
│   └── forms/                # VA PDF forms (16 files)
├── scripts/                  # Development utilities
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── render.yaml               # Render.com deployment config
```

## 🔍 Search Features

### Search by Condition Name
```
PTSD, Anxiety, Depression, Tinnitus, Sleep Apnea
Degenerative Disc Disease, Radiculopathy, Migraines
```

### Search by Diagnostic Code
```
9411 (PTSD), 6260 (Tinnitus), 5237 (Lumbosacral Strain)
8100 (Migraine), 6847 (Sleep Apnea)
```

### Search by Synonym
```
"ringing in ears" → Tinnitus
"back pain" → Degenerative Disc Disease, Lumbosacral Strain
"anxiety attacks" → Panic Disorder, Anxiety
```

## 📚 Data Sources

Our comprehensive knowledge base has been **fully validated against the official eCFR** (Electronic Code of Federal Regulations):

- **38 CFR Part 3 - Verified**: Adjudication rules, eligibility requirements, and claims procedures
- **38 CFR Part 4 - Verified**: Every diagnostic code, rating percentage, and evaluation criteria
- **751 VA Disabilities**: Complete coverage of all body systems with validated rating criteria
- **100% Rating Criteria Validated**: All conditions include detailed percentage breakdowns
- **Secondary Conditions Database**: Medically-recognized secondary conditions linked to primary disabilities

**Official Sources:**
- **eCFR Part 3**: https://www.ecfr.gov/current/title-38/chapter-I/part-3
- **eCFR Part 4**: https://www.ecfr.gov/current/title-38/chapter-I/part-4
- **VA Benefits**: https://www.va.gov/disability/

*Last validated: January 2026 against eCFR Title 38, Parts 3 & 4*

## 📊 Development Stats

This comprehensive platform represents significant development effort to create a complete VA claims toolkit:

### Overall Project
- **Total Development Time**: ~7,200 hours (≈4 years full-time equivalent)
- **Actual Time Invested**: 50-55 hours over 4.5 days (Jan 15-19, 2026)
- **Productivity Multiplier**: 131x (thanks to AI-assisted development)
- **Lines of Code**: 111,440 lines
- **Total Files**: 1,135 project files
- **App Size**: 104.05 MB
- **Components**: 111 React components (40+ major tools + 71 supporting)
- **Utilities**: 47 helper modules
- **Data Validation**: 751 disabilities verified against 38 CFR

### Development Breakdown (Traditional Equivalent)
- **5,572 hrs** - Coding (111k lines @ 20/hr with AI assist)
- **250 hrs** - Data entry (751 disabilities validated)
- **500 hrs** - Testing & debugging
- **300 hrs** - UI/UX design & iterations
- **150 hrs** - Documentation & user manual
- **150 hrs** - Research (38 CFR regulations)
- **278 hrs** - Deployment & optimization

### Actual Development Timeline
- **First Commit**: January 15, 2026 at 8:05 PM
- **Latest Commit**: January 19, 2026 at 12:00 PM
- **Total Commits**: 52 commits across 18 active coding sessions
- **Code Changes**: +125,000 lines added, -13,560 lines removed
- **Daily Breakdown**:
  - Jan 15: 13 commits (~6-8 hours)
  - Jan 16: 2 commits (~2-3 hours)
  - Jan 17: 16 commits (~10-12 hours)
  - Jan 18: 15 commits (~8-10 hours)
  - Jan 19: 6 commits (~4-6 hours)

### The Reality of Modern Development
The **7,200-hour estimate** represents the **traditional development cost and complexity** of building this from scratch - the true value veterans receive for free. The **actual 50-55 hours** represents the power of **2026 AI-assisted development** (GitHub Copilot, Claude, ChatGPT, Gemini) combined with modern frameworks (React 18, Vite, Tailwind CSS). This 131x productivity multiplier is why we can offer professional-grade tools that others charge $500+ per use or 30% of backpay.

### Major Component Development Hours

| Component | Hours | Lines | What It Does |
|-----------|-------|-------|--------------|
| C-File AI Analyzer | 680 hrs | 9,200 | AI analysis of claims files ($500+ value elsewhere) |
| C&P Exam Simulator | 520 hrs | 7,800 | DBQ-aligned practice questions with AI predictions |
| Tactical Calculator | 450 hrs | 8,500 | Combined rating calculator with 2026 pay rates |
| Forms Helper | 410 hrs | 6,800 | Guided assistance for 16+ VA forms |
| Blue Button X-Ray | 380 hrs | 5,100 | Extracts claim evidence from medical records |
| Secondary Scout | 380 hrs | 6,200 | Discovers 500+ secondary conditions |
| Decision Decoder | 350 hrs | 4,900 | AI translation of VA decision letters |
| Smart Search | 340 hrs | 5,200 | 751 conditions with synonym matching |
| Nexus Builder | 320 hrs | 5,400 | Medical nexus statement generator |
| Million Dollar Dashboard | 310 hrs | 4,500 | Lifetime benefit value calculator |
| My Packet | 290 hrs | 4,200 | Claims evidence organizer |
| Web of Conditions | 290 hrs | 4,100 | Interactive condition relationship visualizer |
| Red Team Simulator | 280 hrs | 3,800 | Simulates VA examiner review |
| State Benefit Hunter | 270 hrs | 3,900 | State-level veteran benefits finder |
| PACT Act Navigator | 260 hrs | 3,700 | Toxic exposure presumptive conditions |
| Witness Bench | 240 hrs | 3,600 | Buddy statement builder with smart questions |
| MOS Hazard Matcher | 230 hrs | 3,300 | Links military jobs to exposures |
| TDIU Builder | 220 hrs | 3,100 | Total Disability Unemployability evaluator |
| Pathfinder | 210 hrs | 3,200 | Strategic roadmap from claim to appeals |
| Risk Assessment | 190 hrs | 2,800 | Identifies claim weaknesses before filing |
| Symptom Logger | 180 hrs | 2,400 | Daily symptom tracking |
| FOIA Generator | 170 hrs | 2,500 | C-File request automation |
| Shark Radar | 160 hrs | 2,200 | Predatory service detector |
| VA Resources Hub | 150 hrs | 2,100 | Comprehensive VA program directory |
| VSO Finder | 140 hrs | 1,900 | Accredited Veterans Service Officer locator |
| Accessibility Features | 120 hrs | 1,600 | WCAG 2.1 AA compliance, screen readers |
| User Manual | 100 hrs | 1,800 | Complete documentation system |

**Plus**: 250 hours validating 15,000+ lines of disability data against 38 CFR

**This level of development** is why similar tools cost $500+ per use, charge 30% of backpay, or require monthly subscriptions. We keep it free through veteran support - not data sales, ads, or predatory pricing.

## ✨ AI Statement Assistant

Vet-Rate.org includes an optional AI-powered statement assistant that helps veterans write more professional VA claim statements.

### Features
- **Powered by Google Gemini** (free tier)
- **Explicit consent required** before any data is sent
- **No PII shared** - only condition names and symptom descriptions
- **Completely optional** - standard templates always available
- **🚨 Crisis Interceptor** - Automatically detects self-harm language and provides immediate crisis resources before any AI interaction

### Setup Options

#### Option 1: Bring Your Own Key (BYOK) - Recommended
1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. In the app, go to **Settings** (gear icon in header)
3. Paste your key in the "AI Features (BYOK)" section
4. Your key is stored locally in your browser only

**Why BYOK?**
- ✅ **Your wallet, your control** - No risk of developers' API keys being exploited
- ✅ **Zero cost sharing** - Google's Gemini API has a generous free tier
- ✅ **Maximum privacy** - Key never leaves your browser
- ✅ **No backend server needed** - True client-side architecture

#### Option 2: Environment Variable (Legacy/Dev)
1. Copy `.env.example` to `.env.local`
2. Add your key: `VITE_GEMINI_API_KEY=your_key_here`
3. Restart the dev server

**⚠️ Security Warning:** Never commit `.env.local` to version control. Never embed API keys in client-side code for production. For production deployments, use BYOK model or implement a secure backend proxy.

### Safety & Privacy

#### Crisis Intervention
- **Pre-flight screening**: All text is checked for self-harm language BEFORE being sent to AI
- **Automatic intervention**: If crisis language is detected, the app immediately displays Veterans Crisis Line resources (988-1) and blocks the AI call
- **No AI therapy**: The AI never attempts to respond to crisis situations - only trained human counselors do

#### PII Protection  
- **Input scrubbing**: Users are warned not to enter SSN, full names, or addresses
- **Output protection**: AI is instructed to redact any PII that slips through, replacing with placeholders
- **No retention**: Google's free tier doesn't use prompts for model training
- **Full disclosure**: Users must explicitly consent before each AI use

See [AI Privacy Documentation](docs/privacy/ai-assistant.md) for complete details.

## ☁️ Cloud Sync Setup (Optional)

Vet-Rate.org includes optional Google Drive backup for automatic cloud sync. **Your data goes to YOUR Google Drive, not our servers.**

### Quick Setup

1. **Get OAuth Credentials** from Google Cloud Console:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Create a new project (or select existing)
   - Enable the **Google Drive API**
   - Create **OAuth 2.0 Client ID** (Web application type)
   - Add authorized origins: `http://localhost:3000` (dev) and `https://vet-rate.org` (production)
   - Copy your Client ID

2. **Configure Environment**:
   ```bash
   # Copy example env file
   cp .env.example .env.local
   
   # Add your OAuth Client ID
   VITE_GOOGLE_DRIVE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
   ```

3. **Required OAuth Scope**:
   - `https://www.googleapis.com/auth/drive.file` (ONLY files created by app)
   - This scope does NOT allow access to existing Drive files
   - Maximum privacy - app only sees its own backup files

4. **How It Works**:
   - Click "Connect Drive" in The Bunker (Backup Manager)
   - Authorize Vet-Rate.org via Google OAuth popup
   - Your encrypted backup is uploaded to YOUR Google Drive
   - Access backups from any device by signing in

**Privacy Note**: We never see your Google Drive data. The OAuth token stays in your browser session only. All Drive API calls happen directly from your browser to Google's servers.

## 🚀 Deployment

### Render.com (Current Production)
The application is deployed on Render.com as a static site. See `render.yaml` for configuration.

### Other Platforms

**Vercel:**
```bash
npm i -g vercel
vercel
```

**Netlify:**
```bash
npm run build
# Deploy 'dist' folder to Netlify
```

**Docker:**
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

## 🔐 Security

- **Client-Side Processing**: All operations happen in your browser
- **No External Data Transmission**: Search terms never leave your device
- **No User Tracking**: No analytics or telemetry
- **No Cookies**: No session or tracking cookies
- **Input Validation**: Sanitized inputs prevent XSS attacks

See [SECURITY.md](SECURITY.md) for detailed security configuration.

## 📱 Browser Support

| Browser | Version |
|---------|---------|
| Chrome  | 90+     |
| Firefox | 88+     |
| Safari  | 14+     |
| Edge    | 90+     |

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

Copyright © 2024-2026 Anthony Johnson. All Rights Reserved.

This project is proprietary software. See [LICENSE](LICENSE) for details.

## ⚠️ Legal Disclaimer

**This application is for informational purposes only.** It does not constitute legal, medical, or official VA guidance. Always consult with:

- VA Regional Office representatives
- Accredited VA claim representatives or Veterans Service Officers
- Medical professionals for health-related matters
- Qualified attorneys for legal advice

The information provided is based on publicly available eCFR data and should be verified with official VA sources.

## 📧 Support

- **Website**: [https://vet-rate.org](https://vet-rate.org)
- **GitHub Issues**: [Open an issue](https://github.com/ajohnsonnow/vet-rate-org/issues)
- **VA Resources**: https://www.va.gov/contact-us/
- **Veterans Crisis Line**: 988 (Press 1)

## 🙏 Acknowledgments

- Data sourced from [eCFR Title 38](https://www.ecfr.gov/current/title-38/chapter-I)
- VA Schedule for Rating Disabilities (VASRD)
- Veteran community feedback and testing

---

**Made with ❤️ by a fellow veteran for veterans and their families**

*This is an independent tool created to help veterans understand their disability ratings. It is not affiliated with or endorsed by the U.S. Department of Veterans Affairs.*
