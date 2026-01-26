# Multi-Brand Build System

This project supports building two branded versions from a single codebase:

| Brand | Description | Build Command |
|-------|-------------|---------------|
| **Vet-Rate.org** | Free version for all veterans | `npm run build` or `npm run build:vetrate` |
| **Supply Locker** | Supporter version ("buy me a coffee") | `npm run build:supplylocker` |

## How It Works

### 1. Centralized Branding Config
All branding is controlled by a single file: `src/config/branding.js`

```javascript
import BRAND from '../config/branding';

// Use in components:
<h1>{BRAND.appName}</h1>        // "Vet-Rate.org" or "Supply Locker"
<img src={BRAND.logo} />        // Different logo per brand
```

### 2. Environment Variable
Set `VITE_BRAND_MODE` to switch brands:
- `vetrate` (default) → Vet-Rate.org
- `supplylocker` → Supply Locker

### 3. Build-Time HTML Transformation
The `vite.config.js` transforms index.html with brand-specific:
- Page title
- Meta description
- Favicon/logo paths
- Analytics endpoints
- Theme colors

## Development

```bash
# Develop as Vet-Rate.org (default)
npm run dev

# Develop as Supply Locker
npm run dev:supplylocker
```

## Building

```bash
# Build Vet-Rate.org → dist/
npm run build

# Build Supply Locker → dist-supplylocker/
npm run build:supplylocker

# Build BOTH versions
npm run build:all
```

## Deployment

Each build outputs to a separate directory:
- `dist/` → Deploy to vet-rate.org
- `dist-supplylocker/` → Deploy to supplylocker.vet

## Adding Brand-Specific Features

### In Components
```javascript
import BRAND, { isSupplyLocker } from '../config/branding';

function MyComponent() {
  return (
    <div>
      <h1>{BRAND.appName}</h1>
      
      {/* Supporter-only features */}
      {isSupplyLocker() && (
        <div className="premium-badge">⭐ Supporter Edition</div>
      )}
    </div>
  );
}
```

### Storage Keys
Use `getStorageKey()` to namespace localStorage:
```javascript
import { getStorageKey } from '../config/branding';

// Will be 'vetrate_settings' or 'supplylocker_settings'
localStorage.setItem(getStorageKey('settings'), data);
```

## Brand Configuration

Edit `src/config/branding.js` to customize:

| Property | VetRate | SupplyLocker |
|----------|---------|--------------|
| `appName` | "Vet-Rate.org" | "Supply Locker" |
| `logo` | `/images/Vet-Rate-org-logo-official.png` | `/images/supply-locker-logo.png` |
| `primaryColor` | Blue (#1e40af) | Emerald (#065f46) |
| `showSupportBanner` | false | true |
| `premiumFeatures` | false | true |

## Logo Assets

Ensure both logo files exist in `public/images/`:
- `Vet-Rate-org-logo-official.png` (VetRate)
- `supply-locker-logo.png` (SupplyLocker)

## Keeping Versions in Sync

**Single codebase = automatic sync!**

1. Make all changes in `vet-rate-org-official`
2. Run `npm run build:all` to generate both versions
3. Deploy each `dist` folder to its respective domain

No need to maintain two repos or cherry-pick changes. Both versions share:
- All features
- All bug fixes
- All updates

The only differences are cosmetic (branding) and controlled by the config file.

## CI/CD Example

```yaml
# GitHub Actions example
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      
      # Build both versions
      - run: npm run build:vetrate
      - run: npm run build:supplylocker
      
      # Deploy VetRate
      - name: Deploy VetRate
        uses: cloudflare/pages-action@v1
        with:
          directory: dist
          project: vet-rate-org
      
      # Deploy SupplyLocker  
      - name: Deploy SupplyLocker
        uses: cloudflare/pages-action@v1
        with:
          directory: dist-supplylocker
          project: supply-locker
```
