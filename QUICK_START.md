# Quick Start Guide

Get the Veteran Disability Search application up and running in 5 minutes!

## 📋 Prerequisites

Before you begin, ensure you have:
- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm 9+** - Comes with Node.js
- **Git** - [Download](https://git-scm.com/)
- **Text Editor** - VS Code, WebStorm, etc.

## ⚡ 5-Minute Startup

### Step 1: Clone the Repository
```bash
git clone https://github.com/yourusername/vet-disability-search.git
cd vet-disability-search
```

### Step 2: Install Dependencies
```bash
npm install
```
⏱️ Takes ~2-3 minutes

### Step 3: Start Development Server
```bash
npm run dev
```

### Step 4: Open in Browser
```
http://localhost:5173
```

**Done!** ✅ You should see the Veteran Disability Search app running.

## 🎯 What You Can Do

### Search for Disabilities
- Type a condition name: `PTSD`, `arthritis`, `migraine`
- Type a diagnostic code: `9411`, `5002`, `5240`
- Type a synonym: `posttraumatic stress`, `rheumatoid arthritis`

### View Details
- Click any search result to see full details
- Read documentation requirements
- Find related secondary conditions
- Access VA resources

### Generate PDF
- Click "Download PDF" button
- Get a comprehensive report with all information
- Includes VA resources, glossary, and support info

## 🛠️ Common Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Format code
npm run format
```

## 📁 Project Structure

```
vet-disability-search/
├── src/
│   ├── components/           # React components
│   ├── utils/               # Helper functions
│   ├── data/                # Database
│   ├── App.jsx              # Main component
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── index.html               # HTML file
├── package.json             # Dependencies
├── vite.config.js           # Vite config
├── tailwind.config.js       # Tailwind config
├── README.md                # Full documentation
├── SECURITY.md              # Security guide
└── DEPLOYMENT.md            # Deployment guide
```

## 🚀 Quick Deployments

### Deploy to Vercel (Easiest)
```bash
npm i -g vercel
vercel
```

### Deploy to Netlify
```bash
npm i -g netlify-cli
netlify deploy --prod
```

### Deploy to GitHub Pages
```bash
npm install --save-dev gh-pages
npm run build
npm run deploy
```

## 🔍 Testing

### Test Search
1. Go to `http://localhost:5173`
2. Type "PTSD" → Should find result
3. Type "9411" → Should find PTSD
4. Type "posttraumatic stress" → Should find PTSD

### Test PDF Generation
1. Search for a disability
2. Click result to view details
3. Click "Download PDF" button
4. PDF should download automatically

### Test Responsive Design
1. Open DevTools (F12)
2. Click mobile device icon
3. Resize window to test all breakpoints
4. Should work smoothly on all sizes

## 🐛 Troubleshooting

### "npm: command not found"
→ Install Node.js from https://nodejs.org/

### "Port 5173 is in use"
→ Kill the process or use different port:
```bash
npm run dev -- --port 3000
```

### "Can't find module"
→ Run `npm install` again:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Search not working
1. Open DevTools (F12)
2. Check Console tab for errors
3. Ensure `disabilityData.json` is in correct location

### PDF generation fails
1. Check browser console for errors
2. Ensure you have latest Chrome/Firefox
3. Try incognito/private window

## 📚 Learn More

- [Full README](README.md) - Complete documentation
- [Deployment Guide](DEPLOYMENT.md) - Deploy to production
- [Security Guide](SECURITY.md) - Security best practices
- [eCFR Reference](https://www.ecfr.gov/current/title-38/chapter-I/part-4) - Official ratings

## 💡 Tips & Tricks

### Search Tips
- Search is case-insensitive
- Partial matches work: "arth" finds "arthritis"
- Synonyms supported: "RA" finds "rheumatoid arthritis"

### Performance
- App loads in <1 second
- Searches in ~50ms
- PDF generation in <5 seconds
- Works offline after first load

### Browser Support
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🤝 Contributing

Found a bug? Want to add a feature?

1. Fork the repository
2. Create a branch: `git checkout -b feature/amazing-feature`
3. Make changes: `npm run format`
4. Test thoroughly
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## ❓ Need Help?

- 📖 Read [README.md](README.md)
- 🔐 Security issues? See [SECURITY.md](SECURITY.md)
- 🚀 Deployment help? See [DEPLOYMENT.md](DEPLOYMENT.md)
- 🐛 Found a bug? [Open an issue](https://github.com/yourusername/vet-disability-search/issues)

## ⚖️ License

MIT License - See LICENSE file

## 🙏 Thank You!

This tool is built to help veterans. Your feedback makes it better!

---

**Ready to get started? Run `npm install && npm run dev` now!** 🎉
