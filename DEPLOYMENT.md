# Deployment Guide

Complete instructions for deploying the Veteran Disability Search application to various hosting platforms.

## Pre-Deployment Checklist

```bash
# 1. Build production bundle
npm run build

# 2. Verify build output
ls -la dist/

# 3. Run security audit
npm audit

# 4. Test production build locally
npm run preview

# 5. Check environment variables
cat .env.local
```

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
