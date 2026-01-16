# Veteran Disability Search

A comprehensive, production-ready web application for veterans to search VA disability ratings by condition name or diagnostic code. Features official 38 CFR Part 4 data with smart search, PDF generation, and veteran resources.

## 🎯 Features

- **Smart Search**: Find disabilities by condition name, diagnostic code, or synonyms (e.g., PTSD, posttraumatic stress disorder)
- **Official Data**: Direct links to eCFR 38 CFR Part 4 rating schedules
- **Documentation Requirements**: Formatted medical provider guidance for each condition
- **Related Conditions**: Discover secondary conditions associated with primary disabilities
- **PDF Generation**: Create comprehensive, downloadable disability reports with veteran resources
- **Veteran Resources**: Emergency support numbers, benefits links, and glossary
- **Secure & Private**: Client-side processing with no external data transmission
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Accessibility**: WCAG compliant with keyboard navigation and screen reader support

## 📋 Requirements

- Node.js 18.x or higher
- npm 9.x or higher
- Modern browser (Chrome, Firefox, Safari, Edge)

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/vet-disability-search.git
cd vet-disability-search

# Install dependencies
npm install
```

### 2. Development Server

```bash
# Start development server (opens at http://localhost:5173)
npm run dev
```

### 3. Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

## 📁 Project Structure

```
vet-disability-search/
├── src/
│   ├── components/
│   │   ├── App.jsx              # Main application component
│   │   ├── Header.jsx           # VA branding and navigation
│   │   ├── SearchBar.jsx        # Search input with suggestions
│   │   ├── SearchResultCard.jsx # Result card display
│   │   ├── DisabilityDetails.jsx # Full details view
│   │   └── PDFButton.jsx        # PDF generation button
│   ├── utils/
│   │   ├── searchUtils.js       # Advanced search with fuzzy matching
│   │   └── pdfGenerator.js      # PDF creation with VA resources
│   ├── data/
│   │   └── disabilityData.json  # 25+ disabilities with full metadata
│   ├── App.jsx                  # App root component
│   ├── main.jsx                 # React entry point
│   └── index.css                # Global styles
├── index.html                   # HTML entry point
├── package.json                 # Dependencies and scripts
├── vite.config.js              # Vite configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── postcss.config.js           # PostCSS configuration
├── .env.example                # Environment variable template
└── README.md                    # This file
```

## 🔍 Search Features

### Search by Condition Name
```
PTSD
Arthritis
Migraine
Fibromyalgia
```

### Search by Diagnostic Code
```
9411        # PTSD
5002        # Osteomyelitis
5235        # Degenerative Arthritis
```

### Search by Synonym
```
posttraumatic stress disorder  # finds PTSD
rheumatoid arthritis          # finds RA
post-traumatic stress         # finds PTSD
```

### Advanced Matching
- **Exact Match**: Direct diagnostic code or condition name (100 points)
- **Partial Match**: Substring matching (80 points)
- **Fuzzy Match**: Levenshtein distance algorithm (30-50 points)
- **Synonym Match**: Dictionary lookup (70 points)

## 📊 Database

The application includes 25 pre-configured disabilities with:

- Diagnostic codes (38 CFR Part 4)
- Condition names and aliases
- Search terms and synonyms
- Documentation requirements
- Related secondary conditions
- Direct eCFR links
- Rating schedules

### Included Conditions

1. **5000** - Osteomyelitis
2. **5002** - Osteomyelitis (other sites)
3. **5003** - Osteomyelitis (sequelae)
4. **5010** - Tuberculosis (bone/joint)
5. **5235** - Degenerative Arthritis
6. **5240** - Rheumatoid Arthritis
7. **5243** - Psoriatic Arthritis
8. **6002** - Diabetes Mellitus (Type 1)
9. **7005** - Loss of One Arm
10. **8045** - Limitation of Motion (ankle)
11. **8100** - Loss of Toes (multiple)
12. **9411** - PTSD (Service-Connected)
13. **9434** - Anxiety Disorder
14. **9400** - Depression
15. **6602** - Thyroid Condition
16. **6604** - Hyperthyroidism
17. **7700** - Hypertension
18. **7004** - Loss of One Leg
19. **7312** - Limitation of Motion (knee)
20. **7354** - Limitation of Motion (shoulder)
21. **8018** - Loss of Function (toe)
22. **8025** - Loss of Function (foot)
23. **7522** - Loss of Function (ankle)
24. **6350** - Scars (disfiguring)
25. **5025** - Fibromyalgia

## 📄 PDF Generation

Generated PDFs include:

- **Disability Details**: Condition name, diagnostic code, rating schedule
- **Documentation Requirements**: Medical provider guidance
- **Related Conditions**: Secondary disabilities
- **Veteran Resources**:
  - Emergency support (Crisis Line, Homeless Vet Center)
  - Essential VA benefits (Claims, Records, Education, Housing)
  - VA programs and links
- **Glossary**: Key VA terms and definitions
- **Claims Toolkit**: Personal statement methodology, C&P exam tips
- **Legal Notices**: Disclaimers and privacy information

PDFs are generated client-side and named: `VA-Disability-{code}-{timestamp}.pdf`

## 🔐 Security

### Data Privacy
- **Client-Side Processing**: All searches and operations happen in your browser
- **No External Data Transmission**: Search terms and results never leave your device
- **No User Tracking**: No analytics or telemetry data collection
- **No Cookies**: No session or tracking cookies

### Input Validation
- **Search Term Validation**: Alphanumeric, spaces, hyphens, slashes only
- **Max Length**: 100 characters (prevents DoS)
- **XSS Prevention**: Sanitized HTML rendering

### Content Security Policy
```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'unsafe-inline'; 
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
```

## 🎨 Styling

Uses **Tailwind CSS 3.3.0** with custom VA colors:

- **VA Blue**: `#003f87` (Primary)
- **VA Gold**: `#fdb913` (Accent)
- **Gray Scale**: Neutral backgrounds and text

Responsive breakpoints:
- Mobile: 320px - 640px
- Tablet: 640px - 1024px
- Desktop: 1024px+

## ♿ Accessibility

- **WCAG 2.1 Level AA** compliant
- **Keyboard Navigation**: Full keyboard support (Tab, Enter, Escape)
- **Screen Readers**: Semantic HTML with aria labels
- **Focus Indicators**: Clear visual focus states
- **Color Contrast**: Meets WCAG AA standards
- **Responsive Text**: Scales appropriately on all devices

## 📱 Browser Support

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome  | ✅ 90+  | ✅ 90+ |
| Firefox | ✅ 88+  | ✅ 88+ |
| Safari  | ✅ 14+  | ✅ 14+ |
| Edge    | ✅ 90+  | ✅ 90+ |

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Netlify

```bash
# Build production bundle
npm run build

# Deploy 'dist' folder to Netlify
```

### GitHub Pages

```bash
# Build
npm run build

# Deploy 'dist' folder to GitHub Pages
```

### Docker

```dockerfile
# Dockerfile example
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Build and run
docker build -t vet-disability-search .
docker run -p 80:80 vet-disability-search
```

## 🔧 Development

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

### Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Format code (requires Prettier)
npm run format

# Lint code (requires ESLint)
npm run lint
```

### Adding New Disabilities

Edit `src/data/disabilityData.json`:

```json
{
  "id": 26,
  "diagnosticCode": "5099",
  "conditionName": "New Condition",
  "aliases": ["Alias 1", "Alias 2"],
  "searchTerms": ["term1", "term2"],
  "ecfrUrl": "https://www.ecfr.gov/current/title-38/chapter-I/part-4/...",
  "ratingSchedule": "38 CFR §4.XX",
  "documentationRequirements": "Required medical documentation...",
  "relatedSecondaryConditions": ["Related Condition 1", "Related Condition 2"]
}
```

## 📚 Documentation

### Data Sources

- **eCFR**: https://www.ecfr.gov/current/title-38/chapter-I/part-4
- **VA Benefits**: https://www.va.gov/disability/
- **Rating Schedule**: 38 CFR Part 4

### External Resources

- [VA Disability Benefits](https://www.va.gov/disability/)
- [Veterans Crisis Line](https://www.veteranscrisisline.net/)
- [VA Health Benefits](https://www.va.gov/health-care/)
- [GI Bill Information](https://www.va.gov/education/)

## 📝 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## ⚠️ Legal Disclaimer

**This application is for informational purposes only.** It does not constitute legal, medical, or official VA guidance. Always consult with:

- VA Regional Office representatives
- Accredited VA claim representatives or Veterans Service Officers
- Medical professionals for health-related matters
- Qualified attorneys for legal advice

The information provided is based on publicly available eCFR data and should be verified with official VA sources.

## 📧 Support

For issues, questions, or feedback:

- **GitHub Issues**: [Open an issue](https://github.com/yourusername/vet-disability-search/issues)
- **Email**: support@example.com
- **VA Resources**: https://www.va.gov/contact-us/

## 🙏 Acknowledgments

- Data sourced from [eCFR Title 38, Chapter I, Part 4](https://www.ecfr.gov/current/title-38/chapter-I/part-4)
- VA Disability Rating Schedule
- Veteran community feedback and testing

---

**Made with ❤️ for veterans and their families**

*This is an independent tool created to help veterans understand their disability ratings. It is not affiliated with or endorsed by the U.S. Department of Veterans Affairs.*
