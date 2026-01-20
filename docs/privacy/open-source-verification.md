# Open Source Verification Guide

**How to audit Vet-Rate.org yourself - No programming required**

---

## Why Audit Open Source?

Anyone can claim their software is secure. Open source lets you **prove** it.

This guide shows how to verify:
- ✅ Code matches what's running on the live site
- ✅ No hidden data collection
- ✅ No tracking or analytics
- ✅ Security claims are truthful

---

## Table of Contents

- [Quick Start (5 minutes)](#quick-start-5-minutes)
- [Basic Verification (Non-Programmers)](#basic-verification-non-programmers)
- [Intermediate Audit (Some Technical Knowledge)](#intermediate-audit-some-technical-knowledge)
- [Advanced Security Review (Developers)](#advanced-security-review-developers)
- [Red Flags to Watch For](#red-flags-to-watch-for)

---

## Quick Start (5 minutes)

### What You Need
- Web browser (Chrome, Firefox, Edge, Safari)
- No programming knowledge required

### Steps

1. **Visit the GitHub Repository**
   ```
   https://github.com/ajohnsonnow/vet-rate-org
   ```

2. **Check Recent Commits**
   - Look at "Commits" tab
   - See what changes were made recently
   - Suspicious: Hidden commits, deleted history

3. **Read the README**
   - Describes what the project does
   - Should match what you see on the live site
   - Red flag: Vague or misleading descriptions

4. **Check the License**
   - Should be MIT or another permissive license
   - Means you can audit, fork, and modify
   - Red flag: Proprietary or restrictive license

5. **Browse Key Files**
   - `package.json` - Lists all dependencies
   - `src/` folder - Application code
   - Look for analytics, tracking, or suspicious code

---

## Basic Verification (Non-Programmers)

### Goal: Confirm the site does what it claims

#### 1. Compare Live Site to Code

**Open Two Browser Tabs:**
- Tab 1: `https://vet-rate.org`
- Tab 2: `https://github.com/ajohnsonnow/vet-rate-org`

**Check:**
- Do features match the README description?
- Does the UI match screenshots in the repo?
- Are there features on the live site not in the code? (red flag)

#### 2. Check Dependencies (What Libraries Are Used)

**Go to `package.json` on GitHub:**
```
https://github.com/ajohnsonnow/vet-rate-org/blob/main/package.json
```

**Look for suspicious packages:**

**✅ Good (Normal for web apps):**
- `react` - Frontend framework
- `vite` - Build tool
- `lucide-react` - Icon library
- `jspdf` - PDF generation (client-side)

**🚨 Bad (Data collection):**
- `google-analytics` - Tracking
- `facebook-pixel` - Tracking
- `mixpanel` - Analytics
- `sentry` - Error tracking (sends data)
- Any package with "analytics", "tracking", or "telemetry" in the name

**If you see suspicious packages:**
1. Search GitHub for how they're used
2. Check if data collection is opt-in
3. Report via Bug Squasher if privacy claims don't match

#### 3. Search for Known Tracking Code

**Use GitHub's Search Feature:**

Go to the repo and search for:
- `analytics.google.com`
- `facebook.com/pixel`
- `mixpanel.com`
- `segment.io`

**Expected Result:** No matches (or false positives like "no analytics")

**If you find matches:** Investigate whether they're active or just comments/documentation.

#### 4. Check for Hidden Configuration

**Look for these files:**
- `.env` - Environment variables
- `.env.example` - Example env file (should be public)
- `src/config.js` - App configuration

**Check for:**
- API keys (should be user-provided, not hardcoded)
- Analytics IDs (shouldn't exist)
- Server URLs (should only be Google Gemini or eCFR)

---

## Intermediate Audit (Some Technical Knowledge)

### Goal: Verify architecture and network behavior

#### 1. Clone the Repository (Optional)

**If you know Git:**
```bash
git clone https://github.com/ajohnsonnow/vet-rate-org.git
cd vet-rate-org
```

**Benefits:**
- Search code locally (faster)
- Run your own version
- Compare files to live site

#### 2. Search for Network Requests

**Look for API calls in the code:**
```bash
# In the repo directory:
grep -r "fetch(" src/
grep -r "axios" src/
grep -r "XMLHttpRequest" src/
```

**Expected:**
- `fetch()` to Google Gemini (AI feature)
- External links to eCFR.gov (regulations)
- No internal API calls (`/api/...`)

**Red flags:**
- `fetch()` to unknown domains
- POST requests with form data
- Hidden API endpoints

#### 3. Check Build Configuration

**File: `vite.config.js`**

**Should see:**
```javascript
// Simple static build config
export default {
  // No API proxy
  // No backend server
  // Just build settings
}
```

**Red flags:**
```javascript
// Server proxy (means backend exists)
server: {
  proxy: {
    '/api': 'http://backend.example.com'
  }
}
```

#### 4. Inspect Package Lock File

**File: `package-lock.json` or `yarn.lock`**

**Why:** Shows ALL dependencies, including transitive ones

**What to check:**
- Do dependencies of dependencies include tracking?
- Are there security vulnerabilities? (GitHub should flag these)

**Tool:** Use `npm audit` or `yarn audit` after cloning

```bash
npm install
npm audit
```

Look for high/critical vulnerabilities in dependencies.

#### 5. Compare Built Code to Source

**Advanced:** Compare minified production code to source

**Why:** Ensures build doesn't inject tracking

**How:**
1. Build locally: `npm run build`
2. Inspect `dist/` folder
3. Look for unexpected files or scripts
4. Compare to live site's Network tab

---

## Advanced Security Review (Developers)

### Goal: Full security audit

#### 1. Analyze Data Flow

**Trace how user data moves:**

**Example: User enters name in form**

1. Where is it stored?
   ```javascript
   // Should be: localStorage
   localStorage.setItem('vetrate_profile', JSON.stringify(data));
   ```

2. Is it sent anywhere?
   ```javascript
   // Should NOT see:
   fetch('/api/save-profile', { body: data });
   ```

3. Is it encrypted?
   ```javascript
   // For localStorage, not necessary (stays local)
   // For network: should use HTTPS (check site URL)
   ```

#### 2. Review Authentication (If Any)

**Expected:** No authentication system

**If auth exists:**
- How are passwords stored? (should be hashed)
- Are tokens secure? (httpOnly cookies, not localStorage)
- Is there session management?

**Red flag:** Authentication in a "client-side only" app means server-side processing exists.

#### 3. Check for Backdoors

**Search for suspicious patterns:**

```bash
# Eval (can execute arbitrary code)
grep -r "eval(" src/

# Base64 encoded code (obfuscation)
grep -r "atob\|btoa" src/

# Hidden iframes (tracking)
grep -r "iframe" src/

# Remote script loading
grep -r "createElement('script')" src/
```

**Expected:** Minimal or justified usage with comments

**Red flag:** Obfuscated code, unexplained eval usage

#### 4. Dependency Audit

**Check for known vulnerabilities:**

```bash
npm audit --production

# Or use Snyk
npx snyk test
```

**Check for malicious packages:**
- Research any unknown dependencies
- Check npm/GitHub for security issues
- Look at download stats (very low = suspicious)

#### 5. API Key Handling

**How are API keys stored?**

**Expected:**
```javascript
// User-provided, stored in localStorage
const apiKey = localStorage.getItem('vetrate_gemini_key');
```

**Red flags:**
```javascript
// Hardcoded in code
const apiKey = 'AIza...';

// Sent to server for "validation"
fetch('/api/validate-key', { body: { key: apiKey } });
```

#### 6. Content Security Policy Review

**Check if CSP is implemented:**

**Live Site:**
1. Open DevTools → Network tab
2. Click main document request
3. Check Response Headers for `Content-Security-Policy`

**Expected CSP:**
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
connect-src 'self' https://generativelanguage.googleapis.com https://ecfr.gov;
```

**Red flags in CSP:**
```
connect-src *;  // Allows any connection
script-src 'unsafe-eval';  // Allows eval()
```

#### 7. Secrets Scanning

**Search for accidentally committed secrets:**

```bash
# API keys
grep -r "AIza" .
grep -r "api_key" .

# Passwords
grep -r "password" .

# Private keys
grep -r "BEGIN PRIVATE KEY" .
```

**Expected:** Only example/placeholder values, no real secrets

#### 8. Build Reproducibility

**Verify builds are deterministic:**

```bash
# Build twice
npm run build
cp -r dist dist-1

npm run build
cp -r dist dist-2

# Compare
diff -r dist-1 dist-2
```

**Expected:** Identical or minimal differences (timestamps)

**Red flag:** Significant differences suggest non-deterministic builds

---

## Red Flags to Watch For

### Critical (Report Immediately)

🚨 **Code Red:**
- Active tracking/analytics code
- Data POSTed to unknown servers
- Hardcoded API keys
- Hidden authentication system
- Obfuscated/encrypted code sections
- Malicious dependencies

### High Priority (Investigate)

⚠️ **Yellow Alert:**
- Vague commit messages
- Large binary files added
- Deleted git history
- Conflicting privacy claims
- Server-side code in a "client-only" app
- Unapproved external connections

### Medium (Monitor)

ℹ️ **Worth Noting:**
- Old dependencies with known vulnerabilities
- Poor code quality
- Missing documentation
- Inconsistent licensing

---

## How to Report Issues

### Found Something Suspicious?

#### 1. Document It
- Which file? (path + line number)
- What did you find?
- Why is it concerning?
- Screenshots or code snippets

#### 2. Verify It's Not a False Positive
- Check if it's commented-out code
- Look for explanation in comments
- Search issues/discussions for context

#### 3. Report It

**Public (Preferred for Security Issues):**
- GitHub Issues: [github.com/ajohnsonnow/vet-rate-org/issues](https://github.com/ajohnsonnow/vet-rate-org/issues)
- Tag: `security` or `privacy`

**Anonymous:**
- Use Bug Squasher tool on vet-rate.org
- Email: (See repo README for contact)

#### 4. Responsible Disclosure

For **critical** vulnerabilities (data breach risk):
1. Report privately first (GitHub Security Advisories)
2. Give 90 days for fix
3. Public disclosure after patch

For **privacy violations** (tracking discovered):
1. Report publicly immediately
2. Veterans deserve to know

---

## Community Verification

### How to Stay Informed

#### Watch the Repository
1. Star the repo on GitHub
2. Click "Watch" → "All Activity"
3. Get notified of all changes

#### Review Pull Requests
- See what changes are proposed
- Comment on suspicious additions
- Help review for security

#### Join Discussions
- GitHub Discussions tab
- Ask questions about architecture
- Share audit findings

---

## Forking & Self-Hosting

### Why Self-Host?

**Reasons:**
- 100% control
- No trust required
- Custom modifications
- Air-gapped deployment

### How to Self-Host

```bash
# 1. Fork on GitHub (click "Fork" button)

# 2. Clone your fork
git clone https://github.com/YOUR-USERNAME/vet-rate-org.git
cd vet-rate-org

# 3. Install dependencies
npm install

# 4. Build
npm run build

# 5. Host the dist/ folder
# Options:
# - Netlify
# - Vercel
# - GitHub Pages
# - Your own server
```

### Verify Your Build

**Compare to official site:**
```bash
# Get checksums
sha256sum dist/index.html
sha256sum dist/assets/*

# Compare to official site checksums
# (We should publish these for verification)
```

---

## Continuous Monitoring

### Stay Vigilant

**Monthly checks:**
- Review recent commits
- Check for new dependencies
- Re-run `npm audit`
- Compare live site behavior

**Automated tools:**
- GitHub Dependabot (auto-enabled)
- CodeQL security scanning
- Community security reviews

**Red flag events:**
- Sudden code obfuscation
- Unexplained dependency additions
- Changes to data handling
- Privacy policy updates

---

## Resources

### Learn More

**Git & GitHub:**
- [GitHub Docs](https://docs.github.com/)
- [Git Basics](https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control)

**Web Security:**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [MDN Security](https://developer.mozilla.org/en-US/docs/Web/Security)

**Open Source Auditing:**
- [Linux Foundation Best Practices](https://bestpractices.coreinfrastructure.org/)
- [Supply Chain Security](https://slsa.dev/)

---

## Credits

**Security Researchers:**
- Report credited security findings (with permission)
- Hall of Fame for responsible disclosures

**Community Auditors:**
- Anyone who reviews the code
- Contributors who improve security

---

## Questions?

- 📖 Docs: [vet-rate.org/docs](https://vet-rate.org/docs)
- 💬 Discussions: [GitHub Discussions](https://github.com/ajohnsonnow/vet-rate-org/discussions)
- 🐛 Issues: [GitHub Issues](https://github.com/ajohnsonnow/vet-rate-org/issues)

---

**Last Updated:** January 19, 2026  
**Author:** AJ Johnson  
**License:** MIT
