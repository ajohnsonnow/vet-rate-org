# Deployment Guide

Complete instructions for deploying Vet-Rate.org to various hosting platforms.

## Pre-Deployment Checklist (v1.3.2)

### ⚠️ PRE-DEPLOYMENT CHECK - DO NOT PUSH TO GITHUB UNTIL COMPLETE

**Run automated validation:**

```bash
npm run pre-deploy
```

**If all checks pass, perform manual review:**

---

#### 🖥️ VISUAL REVIEW

1. `npm run dev` - Visual review in browser
2. Mobile responsive check (Chrome DevTools - iPhone, iPad, Android)
3. Dark mode toggle works correctly
4. Accessibility menu functions (font size, contrast)

---

#### 🔍 CORE FEATURES - Research & Discovery

1. **Search** - conditions, diagnostic codes, synonyms all return results
2. **Secondary Scout** - finds medically-connected conditions with probability ratings
3. **C&P Exam Simulator** - exam flow works, DBQ questions display
4. **Pathfinder** - AI roadmap generates strategic recommendations
5. **MOS Hazard Matcher** - links occupations to exposures
6. **PACT Act Navigator** - identifies presumptive conditions
7. **Web of Conditions** - force-directed graph visualization renders

---

#### 📊 CALCULATORS & ANALYTICS

1. **Tactical Calculator** - VA math with bilateral factors, 2026 pay rates
2. **Million Dollar Dashboard** - lifetime benefit projections calculate
3. **What-If Sandbox** - drag-and-drop scenario planning works
4. **Retro Pay Hunter** - backpay calculations from CUE claims
5. **Time Machine** - Intent to File countdown timer functions

---

#### 📋 EVIDENCE BUILDING TOOLS

1. **C-File AI Analyzer** - PDF upload parses and finds evidence
2. **Blue Button X-Ray** - VA health records parse correctly
3. **PDF Evidence Finder** - keyword search in STRs works ("The Needle")
4. **Nexus Builder** - generates nexus statements (check AI mode)
5. **Witness Bench** - buddy statement generator with interview flow
6. **Forms Helper** - all 16+ VA forms load with Auto-Scribe PDF filling
7. **Symptom Logger** - daily symptom tracking with body map
8. **Pain Painter / Somatic Target** - body map clicks translate to medical terms
9. **Evidence Timeline** - visual tracker shows gaps correctly
10. **FOIA Keysmith** - generates FOIA request templates

---

#### ✅ QUALITY CONTROL TOOLS

1. **Red Team** - AI devil's advocate finds weak language
2. **The War Game (Claim Stress Test)** - adversarial review stress-tests claims
3. **Decision Decoder** - translates VA letters to plain English
4. **Denial Decoder** - OCR scan + AI analysis of denial letters
5. **Consistency Engine** - detects contradictions in statements
6. **Evidence Gap Finder** - shows missing evidence for target rating
7. **Shark Radar** - predatory service detection working
8. **Risk Assessment** - "Poke the Bear" calculator shows protections

---

#### 💰 MAXIMIZE & STRATEGY

1. **TDIU Builder** - unemployability calculator with forms guidance
2. **State Benefit Hunter** - all 50 states + DC benefits load
3. **The Tribunal** - voice-interactive mock BVA hearing works
4. **Legislative Watchdog** - Federal Register tracking functional

---

#### 🤖 AI FEATURES (Faraday Cage Protocol)

1. **Local AI** - WebLLM model loads without `ModelNotLoadedError`
2. **Cloud AI (Gemini)** - generates statements with proper API key
3. **Device-aware UI** - legacy devices see Cloud AI recommendation
4. **AI Mode Selector** - toggles between Local/Cloud/Hybrid
5. **AI Settings Modal** - configuration saves properly
6. **Error handling** - graceful failures with user-friendly messages

---

#### 🤝 SUPPORT & DATA MANAGEMENT

1. **VSO Finder** - locates accredited Veterans Service Officers
2. **The Bunker** - export/import all data works (JSON backup)
3. **Cloud Sync** - Google Drive backup connects and syncs
4. **VA.gov Integration** - demo mode shows claims/service history
5. **My Packet** - saves and retrieves evidence items
6. **VA Resources Hub** - all external links work
7. **User Manual** - comprehensive docs accessible

---

#### 📱 CROSS-DEVICE TESTING

1. Test on Android (if available) - especially Android 10/11
2. iOS Safari works correctly (WebGPU fallback)
3. WebGPU detection shows correct status per device
4. PWA install prompt appears on mobile

---

#### 💰 INTEGRATIONS & MODALS

1. Review **What's New** modal content matches deployed features
2. Verify **BuyMeCoffee** messaging is on-brand
3. **VA API connections** work (if enabled in .env.local)
4. **Ribbon Rack** - military ribbons render correctly
5. **DD214 Analyzer** - document parsing functional (PDF/Word/Text/RTF support)
6. **PDF Import Confirmation** - DD214 analyzer shows review modal before saving to profile

---

#### 🐛 BUG & CRISIS SYSTEMS

1. **Bug Report Button** - reports generate properly
2. **Crisis Modal** - 988 hotline triggers on crisis keywords
3. **Squashed Bugs counter** - displays in footer

---

### 🎨 COLOR SCHEMA COMPLIANCE

Tool cards and modals must match their category color scheme:

| Category | Color | Tools |
|----------|-------|-------|
| Calculate Your Rating | **Blue** | Tactical Calculator, Million Dollar Dashboard, What-If Sandbox, Retro Pay Hunter, Time Machine |
| Discover Your Claims | **Teal** | Secondary Scout, C&P Simulator, Pathfinder, MOS Hazard Matcher, PACT Navigator, Web of Conditions |
| Build Your Evidence | **Violet** | C-File Analyzer, Blue Button X-Ray, PDF Finder, Nexus Builder, Witness Bench, Forms Helper, Symptom Logger, Pain Painter, Evidence Timeline, FOIA Keysmith |
| Quality Control | **Rose** | Red Team, The War Game, Decision Decoder, Denial Decoder, Consistency Engine, Evidence Gap Finder, Shark Radar, Risk Assessment |
| Maximize Your Rating | **Amber** | TDIU Builder, State Benefit Hunter, The Tribunal, Legislative Watchdog |
| Support & Resources | **Sky** | VSO Finder, The Bunker, Cloud Sync, VA.gov Integration, My Packet, VA Resources, User Manual |

**Check each tool:**

- Card border/accent matches category color
- Modal header gradient uses category color
- Icons use category-appropriate color tones
- Hover states maintain color consistency

---

### 📝 Text & Code Quality Rules

- No em-dash (—) or en-dash (–), only hyphens (-)
- All stats must use dynamic imports (`getTotalToolCount`, `PROJECT_STATS`)
- Version numbers synced across all files (package.json, version.json)
- No hardcoded "39+ tools" or "751 conditions" - use dynamic values
- All new tools marked with `isNew: true` in toolkitData.js for What's New

---

### 🔧 Quick Re-check

If issues found, fix and re-run:

```bash
npm run pre-deploy:quick
```

### 🏗️ Final Clean Build

```bash
npm run build
```

### 🖥️ Start Dev Server for Visual Review

```powershell
taskkill /F /IM node.exe 2>$null; Remove-Item -Path "node_modules\.vite" -Recurse -Force -ErrorAction SilentlyContinue; npm run dev
```

**Ready to deploy when all green!** ✅

---

## One-Command Deployment Prep

For the smoothest deployment experience, use our push-prep script:

```bash
# Full prep with smart version bump
npm run push-prep

# Force specific version bumps
npm run push-prep:patch   # Bug fixes only
npm run push-prep:minor   # New features

# Quick mode (skip checks, auto-confirm)
npm run push-prep:quick
```

---

## Platform-Specific Guides

## 1. Vercel (Recommended - Easiest)

### Setup

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

### Configuration (vercel.json)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_APP_NAME": "Veteran Disability Search"
  }
}
```

### Features

- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Zero-config deployments
- ✅ Git integration
- ✅ Free tier available

### Post-Deploy

```bash
# Verify deployment
vercel --prod

# View logs
vercel logs
```

---

## 2. Netlify

### Setup via CLI

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

### Setup via GitHub

1. Push code to GitHub
2. Connect repository in Netlify dashboard
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Deploy

### netlify.toml Configuration

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    X-Frame-Options = "DENY"
```

### Features

- ✅ Easy GitHub integration
- ✅ Automatic deployments on push
- ✅ Built-in HTTPS
- ✅ Analytics included

---

## 3. GitHub Pages

### Setup

```bash
# 1. Update vite.config.js for GitHub Pages
# Set base: '/vet-disability-search/' (replace with your repo name)

# 2. Build
npm run build

# 3. Deploy script (add to package.json)
"deploy": "gh-pages -d dist"

# 4. Install gh-pages
npm install --save-dev gh-pages

# 5. Deploy
npm run deploy
```

### vite.config.js Update

```javascript
export default defineConfig({
  base: '/vet-disability-search/', // Your repo name
  plugins: [react()],
  // ... rest of config
})
```

### Features

- ✅ Free hosting
- ✅ GitHub integrated
- ✅ No build server needed

### Limitations

- ⚠️ Username-based pages only (org.github.io)
- ⚠️ No serverless functions
- ⚠️ Limited analytics

---

## 4. Docker Deployment

### Docker Configuration

Create `Dockerfile`:

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Remove default nginx files
RUN rm -rf ./*

# Copy built app from builder
COPY --from=builder /app/dist .

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # SPA routing - redirect all requests to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
}
```

Create `.dockerignore`:

```
node_modules
npm-debug.log
dist
.git
.gitignore
README.md
.env
.DS_Store
```

### Build and Run

```bash
# Build image
docker build -t vet-disability-search:latest .

# Run container
docker run -d \
  --name vet-search \
  -p 80:80 \
  vet-disability-search:latest

# View logs
docker logs vet-search

# Stop container
docker stop vet-search

# Remove container
docker rm vet-search
```

### Docker Compose

```yaml
version: '3.8'

services:
  vet-disability-search:
    build: .
    container_name: vet-search
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    networks:
      - web

networks:
  web:
    driver: bridge
```

Run with Compose:

```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
```

---

## 5. Self-Hosted (VPS)

### Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install nginx
sudo apt install -y nginx

# Install certbot for HTTPS
sudo apt install -y certbot python3-certbot-nginx
```

### Setup Application

```bash
# Clone repository
cd /var/www
git clone https://github.com/yourusername/vet-disability-search.git
cd vet-disability-search

# Install dependencies
npm install

# Build
npm run build

# Set permissions
sudo chown -R www-data:www-data /var/www/vet-disability-search
```

### Nginx Configuration

```bash
# Create nginx config
sudo nano /etc/nginx/sites-available/vet-search

# Add this content (see below)
# Enable site
sudo ln -s /etc/nginx/sites-available/vet-search /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

### Nginx Config File

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/vet-disability-search/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
}
```

### Setup HTTPS

```bash
# Generate SSL certificate
sudo certbot certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

### Monitoring and Logs

```bash
# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Monitor service
sudo systemctl status nginx

# View service logs
sudo journalctl -u nginx -n 50
```

---

## 6. AWS S3 + CloudFront

### Setup S3 Bucket

```bash
# Create bucket
aws s3 mb s3://vet-disability-search

# Enable static hosting
aws s3 website s3://vet-disability-search \
  --index-document index.html \
  --error-document index.html

# Upload files
aws s3 sync dist/ s3://vet-disability-search --delete
```

### Upload Script

```bash
#!/bin/bash
# deploy.sh

npm run build

aws s3 sync dist/ s3://vet-disability-search \
  --delete \
  --cache-control "max-age=0" \
  --include "*.html"

aws s3 sync dist/ s3://vet-disability-search \
  --delete \
  --cache-control "max-age=31536000" \
  --exclude "*.html"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

---

## Post-Deployment Verification

### Health Checks

```bash
# 1. Test homepage loads
curl -I https://yourdomain.com

# 2. Check HTTP headers
curl -I https://yourdomain.com

# 3. Test search functionality
# Open in browser and test

# 4. Check console for errors
# Open browser DevTools (F12)

# 5. Test on mobile
# Use browser mobile view or physical device

# 6. Check performance
# Use Lighthouse in DevTools
# Run: npm run build && npm run preview
```

### Security Verification

```bash
# Test SSL/TLS
ssl-test-verify https://yourdomain.com

# Check security headers
curl -I https://yourdomain.com | grep -E "X-|Content-Security|Strict"

# Verify CSP
curl -I https://yourdomain.com | grep "Content-Security-Policy"
```

### Monitoring Setup

#### Sentry (Error Tracking)

```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

#### Analytics (Privacy-Preserving)

```javascript
// Example: Plausible Analytics
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
```

---

## Continuous Deployment (GitHub Actions)

### GitHub Actions Workflow

```yaml
name: Deploy to Vercel

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run security audit
        run: npm audit
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Vercel
        uses: BerylBit/vercel-deploy@v1
        with:
          token: ${{ secrets.VERCEL_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          production: true
```

---

## Troubleshooting

### "Cannot GET /"

- Ensure `dist` folder exists: `npm run build`
- Check web server is serving `dist` directory
- Verify nginx/apache configuration for SPA routing

### PDFs not generating

- Check browser console for errors
- Verify jsPDF is installed: `npm list jspdf`
- Check browser storage permissions

### Search not working

- Open DevTools (F12) → Console
- Check for JavaScript errors
- Verify `disabilityData.json` is in `dist` folder

### Slow load times

- Run `npm run build` and check bundle size
- Enable gzip compression on server
- Use CDN for static assets
- Enable browser caching

### HTTPS not working

- Verify SSL certificate is installed
- Check certificate expiration: `openssl s_client -connect yourdomain.com:443`
- Redirect HTTP to HTTPS in nginx

---

## Rollback Procedures

### Vercel

```bash
vercel rollback
```

### Netlify

- Dashboard → Deploys → Click previous deployment

### Manual Rollback

```bash
# Keep previous build backup
cp -r dist dist.backup
git checkout previous-commit
npm run build
# Deploy
npm run deploy
```

---

## Performance Optimization

### Build Size Optimization

```bash
# Analyze bundle
npm install -g webpack-bundle-analyzer

# Check tree-shaking
npm run build -- --analyze
```

### Caching Strategy

```nginx
# Static assets - 1 year
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# HTML - no cache
location ~* \.html?$ {
    add_header Cache-Control "public, max-age=0, must-revalidate";
}
```

---

## Support & Troubleshooting

For deployment issues:

1. Check logs: `docker logs` or `npm run preview`
2. Review SECURITY.md for security headers
3. Verify all environment variables are set
4. Test with `npm run build && npm run preview`

---

**Happy deploying! 🚀**
