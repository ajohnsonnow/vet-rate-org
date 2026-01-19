# Security Configuration

This document outlines security best practices and configurations for Vet-Rate.org.

## Data Privacy & Protection

### Client-Side Processing
- All searches and operations are processed in the browser
- No personal data is sent to external servers
- Search history is stored only in browser memory (cleared on page refresh)
- No cookies or local storage of user searches

### Input Validation
```javascript
// Search term validation pattern
const SEARCH_PATTERN = /^[a-zA-Z0-9\s\-\/]*$/;
const MAX_SEARCH_LENGTH = 100;

// Prevents XSS attacks
validateSearchTerm(term) {
  return term.length <= MAX_SEARCH_LENGTH && 
         SEARCH_PATTERN.test(term);
}
```

## Content Security Policy

Set appropriate CSP headers on your server:

```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'unsafe-inline'; 
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self' https://www.ecfr.gov;
  frame-ancestors 'none';
```

## HTTP Security Headers

Configure these headers on your web server:

```
# Prevent MIME type sniffing
X-Content-Type-Options: nosniff

# Enable browser XSS protection
X-XSS-Protection: 1; mode=block

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
