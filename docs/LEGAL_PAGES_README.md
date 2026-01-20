# Legal Pages Sync System

## Overview

The Terms of Service and Privacy Policy pages exist in **two formats** to serve different purposes:

### 1. React Components (Interactive)
- **Location**: `src/components/TermsOfServicePage.jsx` and `src/components/PrivacyPolicy.jsx`
- **Purpose**: Used within the app as modal/page components
- **Features**: Interactive, styled with Tailwind, integrated with app state

### 2. Standalone HTML (Public Access)
- **Location**: `public/terms-of-service.html` and `public/privacy-policy.html`
- **Purpose**: Required for VA.gov API registration and direct public access
- **URLs**: 
  - https://vet-rate.org/terms-of-service.html
  - https://vet-rate.org/privacy-policy.html

## 🔄 Keeping Pages in Sync

### Automated Checking

Run the sync checker to see if HTML pages need updating:

```bash
npm run check-legal-pages
```

This command:
- ✅ Compares modification dates of React components vs HTML files
- ✅ Shows when each file was last modified
- ✅ Displays effective dates from content
- ✅ Warns if HTML is out of date
- ✅ Automatically runs before `npm run build`

### When to Update

Update the HTML pages whenever you:
- Change legal content in React components
- Update effective dates
- Add or modify disclaimers
- Change contact information
- Modify section headings or structure

### How to Update

#### Step 1: Edit the React Component
```bash
# Edit the source of truth
code src/components/TermsOfServicePage.jsx
# or
code src/components/PrivacyPolicy.jsx
```

Update the "Last Updated" date in the component!

#### Step 2: Check for Sync Issues
```bash
npm run check-legal-pages
```

If out of sync, you'll see: `❌ Legal pages are OUT OF SYNC`

#### Step 3: Update the HTML File
**Option A - Manual Edit:**
```bash
code public/terms-of-service.html
# Carefully copy content from React component to HTML
```

**Option B - AI Assistance:**
```bash
# Copy React component JSX
# Use ChatGPT/Claude: "Convert this JSX to standalone HTML with inline CSS"
# Paste result into HTML file
```

**Option C - Side-by-Side:**
```bash
# Open both files side by side
# Update HTML to match React component content
```

#### Step 4: Update the Sync Date Comment
In the HTML file header, update:
```html
Last Manual Sync: [Today's Date]
```

#### Step 5: Verify Changes
```bash
# Open in browser to test
start public/terms-of-service.html

# Check sync status
npm run check-legal-pages
```

#### Step 6: Commit Both Files
```bash
git add src/components/TermsOfServicePage.jsx public/terms-of-service.html
git commit -m "Update Terms of Service - clarify AI disclaimer"
git push origin main
```

## 📋 Content Checklist

When syncing, ensure these match:

### Required Matches
- [ ] **Effective Date** - "Last Updated: [date]"
- [ ] **Section Headings** - All h2, h3, h4 titles
- [ ] **Disclaimer Text** - Word-for-word accuracy
- [ ] **Bullet Points** - All list items
- [ ] **Legal Citations** - 38 U.S.C. references, etc.
- [ ] **URLs** - Contact links, VA.gov links
- [ ] **Version Numbers** - If applicable

### Visual Differences (OK)
- ✅ Styling (Tailwind classes vs inline CSS)
- ✅ Structure (React components vs HTML divs)
- ✅ Interactivity (onClick handlers not in HTML)

## 🛠️ NPM Scripts

### `npm run check-legal-pages`
Checks if HTML pages are in sync with React components. Exits with error code if out of sync.

```bash
# Check manually
npm run check-legal-pages

# Runs automatically before build
npm run build
```

### `npm run legal-sync` 
Alias for `check-legal-pages` (shorter command).

```bash
npm run legal-sync
```

## 📁 File Structure

```
vet-rate-org-official/
├── src/components/
│   ├── TermsOfServicePage.jsx    ← SOURCE OF TRUTH
│   └── PrivacyPolicy.jsx          ← SOURCE OF TRUTH
├── public/
│   ├── terms-of-service.html      ← MUST SYNC MANUALLY
│   └── privacy-policy.html        ← MUST SYNC MANUALLY
├── scripts/
│   └── generate-legal-pages.js    ← Sync checker script
└── docs/
    ├── LEGAL_PAGES_SYNC.md        ← Auto-generated instructions
    └── LEGAL_PAGES_README.md      ← This file
```

## ⚠️ Important Notes

### Why Two Formats?
1. **React Components**: Best user experience within the app
2. **HTML Pages**: Required by VA.gov API registration (they need direct URLs)

### Why Not Fully Automated?
Converting JSX to HTML requires:
- Stripping React-specific syntax
- Converting Tailwind classes to inline CSS
- Handling conditional rendering
- Managing event handlers

Manual syncing ensures:
- 100% content accuracy
- Proper HTML structure
- Consistent styling
- No build complexity

### React Components Are Source of Truth
Always edit React components first, then update HTML to match.

## 🚀 Future Enhancements

Potential improvements:
- [ ] Full JSX-to-HTML parser
- [ ] Shared content JSON file
- [ ] Automated content extraction
- [ ] CI/CD integration with sync checking
- [ ] GitHub Actions workflow for reminders

## 🆘 Troubleshooting

### Script says "out of sync" but content matches
The script compares file modification times. If you've edited the React component (even whitespace), it flags as out of sync. Manually verify content, then touch the HTML file:

```bash
# Update HTML file timestamp without editing
(Get-Item public/terms-of-service.html).LastWriteTime = Get-Date
```

### HTML file won't update
Make sure:
- File isn't open in another program
- You have write permissions
- File path is correct

### Build fails due to legal pages check
If you're in the middle of updating and build fails:

```bash
# Temporarily skip the check
npm run update-stats && vite build

# Or fix the sync issue first
npm run check-legal-pages
```

## 📞 Questions?

See [LEGAL_PAGES_SYNC.md](./LEGAL_PAGES_SYNC.md) for detailed instructions or contact through the app's support page.

---

**Last Updated**: January 19, 2026  
**Maintainer**: Anthony Johnson  
**Repository**: github.com/ajohnsonnow/vet-rate-org
