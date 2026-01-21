# Security Policy

## 🛡️ Our Philosophy: "Trust No One (Not Even Us)"

Vet-Rate.org is built on a **Zero-Trust, Client-Side Architecture**. We believe that the safest place for veteran data is on the veteran's own device, never on our servers.

Our security model relies on three pillars:
1. **Client-Side Execution**: Code runs in the browser. We have no backend database to hack.
2. **Transparency**: Our code is open source (AGPLv3) so it can be audited by anyone.
3. **Data Isolation**: User data never leaves the current session unless explicitly exported by the user.

## 🐛 Reporting a Vulnerability

We take security issues seriously. If you discover a vulnerability, please report it responsibly so we can fix it before bad actors exploit it.

**DO NOT file a public issue on GitHub.**

### How to Report
Please use the secure **Bug Report / Feedback** tool located directly within the Vet-Rate.org application:

1. Open the application menu.
2. Select **"Report a Bug"**.
3. **CRITICAL**: Start your message with the tag `[SECURITY]`.
4. Describe the vulnerability and steps to reproduce it.

These reports are routed to a private, high-priority channel for immediate review by the lead developer.

We aim to acknowledge reports within **48 hours** and will provide a timeline for the fix.

## 🔒 Security Architecture

### 1. Data Residency
* **Storage**: All user inputs (ratings, medical history, logs) are stored in the browser's `localStorage` or `sessionStorage`.
* **Encryption**: Sensitive data exported to "The Bunker" (backup files) is AES-encrypted before being generated.
* **Transmission**: We do not transmit user data to any first-party server.

### 2. AI Safety (Google Gemini & Local LLMs)
* **Consent**: Users must explicitly enable AI features.
* **Anonymization**: The application logic strips PII (names, SSNs, addresses) before sending prompts to the Google Gemini API.
* **Local Option**: Users are encouraged to use the "Local AI" (WebLLM) features, which run entirely on-device with zero network requests after model download.

### 3. Third-Party Services
We minimize external dependencies. Our only external connections are:
* **Google Gemini API** (Optional, for Cloud AI features)
* **Google Drive API** (Optional, for user-managed Cloud Sync)
* **eCFR.gov** (For fetching updated regulations)

### 4. Content Security Policy (CSP)
We enforce a strict CSP to prevent Cross-Site Scripting (XSS).
* `script-src`: 'self' (and necessary analytics if applicable, otherwise strict)
* `connect-src`: 'self', `generativelanguage.googleapis.com` (Gemini), `www.googleapis.com` (Drive)

## 🚫 Out of Scope
The following are **not** considered security vulnerabilities:
* Attacks requiring physical access to the user's unlocked device.
* Social engineering (phishing) of the user.
* Vulnerabilities in the user's own browser or operating system.
* "Self-XSS" (pasting malicious code into the console).

## 📜 Disclosure Policy
We follow a **90-day disclosure deadline**. We ask that you give us reasonable time to fix the issue before making it public. In return, we commit to being transparent about the fix.

---
*Last Updated: January 2026*

# Prevent clickjacking
X-Frame-Options: DENY

# Enforce HTTPS
Strict-Transport-Security: max-age=31536000; includeSubDomains

# Referrer policy
Referrer-Policy: no-referrer

# Permissions policy
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### Nginx Configuration Example

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        root /var/www/vet-disability-search/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

### Apache Configuration Example

```apache
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set X-Frame-Options "DENY"
    Header always set Referrer-Policy "no-referrer"
    Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
</IfModule>

<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

## Dependency Security

### Regular Updates

```bash
# Check for vulnerabilities
npm audit

# Fix automatically
npm audit fix

# Update packages
npm update

# Check outdated packages
npm outdated
```

### Dependency List (Audited)

Production dependencies are minimal:
- **react**: 18.2.0 - UI framework
- **react-dom**: 18.2.0 - DOM renderer
- **jspdf**: 2.5.1 - PDF generation
- **html2canvas**: 1.4.1 - HTML to canvas

All dependencies are from reputable sources and regularly audited.

## Secure Development Practices

### Code Review Checklist
- [ ] No hardcoded secrets or API keys
- [ ] Input validation on all user inputs
- [ ] No console.log with sensitive data
- [ ] No eval() or dynamic code execution
- [ ] XSS protection in place
- [ ] CORS properly configured

### Git Security
```bash
# Install git secrets to prevent commits with secrets
brew install git-secrets
git secrets --install
git secrets --register-aws
```

### Environment Variables
Never commit `.env` files:

```bash
# Copy template
cp .env.example .env.local

# Add to gitignore
echo ".env.local" >> .gitignore
```

## Deployment Security Checklist

### Pre-Deployment
- [ ] Run `npm audit` - no vulnerabilities
- [ ] Run `npm run build` - successful build
- [ ] Test all features in staging
- [ ] Security headers configured
- [ ] HTTPS/SSL certificate installed
- [ ] Firewall rules configured
- [ ] Rate limiting enabled

### Post-Deployment
- [ ] Monitor error logs for suspicious activity
- [ ] Regular security scans
- [ ] Update dependencies monthly
- [ ] Review access logs periodically

## Incident Response

### Reporting Security Issues

**DO NOT** open public GitHub issues for security vulnerabilities.

Instead, email security concerns to: **security@example.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 24-48 hours.

## Third-Party Services

### External Links
The application links to:
- https://www.ecfr.gov - Official eCFR data
- https://www.va.gov - Official VA website
- https://www.va.gov/health-care/manage-health/ - VA health portal

These are trusted government sources.

### No Analytics or Tracking
This application does NOT use:
- Google Analytics
- Mixpanel
- Amplitude
- Any third-party trackers

## Legal Compliance

### WCAG 2.1 Accessibility
- Level AA compliant
- Keyboard navigation
- Screen reader support
- Proper color contrast

### Browser Compatibility
- No deprecated APIs
- Progressive enhancement
- Tested on major browsers

## Maintenance

### Security Updates
- Node.js security patches: Applied immediately
- npm packages: Checked weekly
- Browser compatibility: Tested monthly

## Questions?

For security questions:
- Email: security@example.com
- GitHub Issues: For non-sensitive questions only
