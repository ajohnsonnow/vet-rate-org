# Vet-Rate.org - VA Disability Claims Command Center

A comprehensive, production-ready web application for veterans to research VA disability ratings, discover secondary conditions, practice C&P exams, and build evidence packets. Features official 38 CFR Parts 3 & 4 data fully validated against the eCFR.

**🌐 Live Site:** [https://vet-rate.org](https://vet-rate.org)

## 🎯 Features

### Core Functionality
- **Smart Search**: Find disabilities by condition name, diagnostic code, or synonyms
- **748 VA Disabilities**: Complete coverage of all body systems from 38 CFR Part 4
- **Rating Criteria**: Detailed percentage breakdowns for every condition
- **Secondary Scout**: Discover medically-recognized secondary conditions
- **C&P Exam Simulator**: Practice compensation & pension exam questions
- **Nexus Builder**: Generate nexus letter templates with optional AI enhancement
- **AI Statement Assistant**: ✨ Optional AI-powered statement drafting using "Three Pillars" approach (Google Gemini)
  - Personal statements (VA Form 21-4138)
  - Buddy/Lay statements (VA Form 21-10210)
  - PTSD Stressor statements (VA Form 21-0781)
  - Secondary claim statements
- **🔬 C-File AI Analyzer**: What competitors charge $500+ for, FREE
  - Upload your Claims File (C-File) PDF
  - AI analyzes thousands of pages in minutes
  - Finds in-service events, diagnoses, and nexus evidence
  - PDF processed locally—only text goes to AI
  - Interactive dashboard with timeline, claims, and action items
- **My Packet**: Save and manage your claims evidence
- **PDF Reports**: Download comprehensive condition guides with VA resources
- **VA Forms Helper**: Access and fill common VA claim forms with AI enhancement option

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
│   ├── components/           # 27 React components
│   │   ├── AboutUs.jsx
│   │   ├── AccessibilityMenu.jsx
│   │   ├── CAPSimulator.jsx      # C&P Exam practice
│   │   ├── DisabilityDetails.jsx
│   │   ├── FormsHelper.jsx       # VA forms assistant
│   │   ├── Header.jsx
│   │   ├── MyPacket.jsx          # Claims evidence manager
│   │   ├── NexusBuilder.jsx      # Nexus letter generator
│   │   ├── PDFButton.jsx
│   │   ├── SearchBar.jsx
│   │   ├── SecondaryScout.jsx    # Secondary conditions finder
│   │   └── ... (15 more)
│   ├── utils/                # 11 utility modules
│   │   ├── capSimulatorLogic.js
│   │   ├── claimsStorage.js
│   │   ├── pdfGenerator.js
│   │   ├── searchUtils.js
│   │   └── ... (7 more)
│   ├── data/                 # Data files
│   │   ├── disabilityData.json       # 748 disabilities
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
- **748 VA Disabilities**: Complete coverage of all body systems with validated rating criteria
- **100% Rating Criteria Validated**: All conditions include detailed percentage breakdowns
- **Secondary Conditions Database**: Medically-recognized secondary conditions linked to primary disabilities

**Official Sources:**
- **eCFR Part 3**: https://www.ecfr.gov/current/title-38/chapter-I/part-3
- **eCFR Part 4**: https://www.ecfr.gov/current/title-38/chapter-I/part-4
- **VA Benefits**: https://www.va.gov/disability/

*Last validated: January 2026 against eCFR Title 38, Parts 3 & 4*

## ✨ AI Statement Assistant

Vet-Rate.org includes an optional AI-powered statement assistant that helps veterans write more professional VA claim statements.

### Features
- **Powered by Google Gemini** (free tier)
- **Explicit consent required** before any data is sent
- **No PII shared** - only condition names and symptom descriptions
- **Completely optional** - standard templates always available

### Setup (Optional)
1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Copy `.env.example` to `.env.local`
3. Add your key: `VITE_GEMINI_API_KEY=your_key_here`
4. Restart the dev server

### Privacy
- Users must explicitly consent before each AI use
- No names, SSN, dates, or addresses are ever sent
- Google's free tier doesn't use prompts for model training
- Full disclosure shown before any data transmission

See [AI Privacy Documentation](docs/privacy/ai-assistant.md) for complete details.

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
