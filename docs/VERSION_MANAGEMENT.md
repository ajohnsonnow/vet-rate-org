# Version Management Guide

## Overview

Vet-Rate.org uses a centralized version management system that automatically updates version numbers everywhere in the application. This document explains how the system works and how to deploy updates.

## Version Sources

### Single Source of Truth: `package.json`

The application version is defined in `package.json` and automatically synchronized throughout the application:

```json
{
  "name": "veteran-disability-search",
  "version": "1.2.0",
  ...
}
```

### Version Import Chain

1. **package.json** → Contains the authoritative version number
2. **src/utils/version.js** → Imports from package.json and exports `APP_VERSION`
3. **All other files** → Import `APP_VERSION` from version.js

## Dynamic Stats System

### Conditions Count

The conditions count is **dynamically calculated** from the actual data:

```javascript
// src/data/projectStats.js
export const PROJECT_STATS = {
  disabilitiesValidated: 748,  // Updated manually when data changes
  ...
};
```

Usage throughout the app:
```javascript
import { PROJECT_STATS } from '../data/projectStats';
// Use: {PROJECT_STATS.disabilitiesValidated}
```

### Tools Count

The tools count is **automatically calculated** from toolkitData.js:

```javascript
// src/data/toolkitData.js
export const getTotalToolCount = () => {
  return TOOLKIT_CATEGORIES.reduce((total, category) => 
    total + category.tools.length, 0
  );
};
```

Usage throughout the app:
```javascript
import { getTotalToolCount } from '../data/toolkitData';
// Use: {getTotalToolCount()}+
```

## Deployment Process

### Step 1: Smart Version Bump (Recommended)

The **smart versioning system** automatically analyzes your commits and file changes to determine the correct version bump type:

```powershell
# Preview what version bump would be recommended (no changes made)
npm run version-preview

# Auto-detect and apply the recommended version bump
npm run version-auto
```

The smart version script follows **Semantic Versioning (SemVer)** best practices:

| Bump Type | When Used | Example |
|-----------|-----------|---------|
| **MAJOR** | Breaking changes, schema changes, removed features | `1.2.0 → 2.0.0` |
| **MINOR** | New features, new components, new tools | `1.2.0 → 1.3.0` |
| **PATCH** | Bug fixes, documentation, refactoring | `1.2.0 → 1.2.1` |

**Commit Message Keywords (Conventional Commits):**
- `BREAKING CHANGE:`, `BREAKING:` → MAJOR
- `feat:`, `feature:`, `add:`, `new:` → MINOR  
- `fix:`, `bugfix:`, `docs:`, `refactor:`, `chore:` → PATCH

**File Pattern Analysis:**
- New files in `src/components/` → MINOR (new component)
- New files in `src/utils/` → MINOR (new utility)
- Schema/migration changes → MAJOR

### Alternative: Manual Version Control

If you prefer manual control, use npm's built-in commands:

```powershell
# For bug fixes (1.2.0 → 1.2.1)
npm version patch

# For new features (1.2.0 → 1.3.0)
npm version minor

# For breaking changes (1.2.0 → 2.0.0)
npm version major
```

This automatically:
- Updates `package.json`
- Creates a git commit
- Creates a git tag

### Step 2: Build (Version Syncs Automatically!)

```powershell
npm run build
```

The build process now **automatically** syncs the version:

1. **`npm run sync-version`** runs first and:
   - Updates `public/version.json` to match `package.json`
   - Updates `LAST_UPDATE_DATE` in `src/utils/version.js`
   
2. **`npm run update-stats`** updates project statistics

3. **`npm run check-legal-pages`** verifies legal page sync

4. **`vite build`** compiles the production bundle

**No manual version.json updates needed!**

### Step 3: Update What's New Content (Optional)

Edit `src/utils/changelogGenerator.js` to add new features:

```javascript
export function generateWhatsNewChangelog() {
  const curatedChangelog = [
    // Add NEW features at the top with isNew: true
    {
      type: 'feature',
      title: 'New Feature Name',
      description: 'What it does and why it matters',
      isNew: true  // ← This makes it appear in "Just Deployed" section
    },
    // Existing features follow...
  ];
  ...
}
```

### Step 4: Build and Deploy

```powershell
# Build the application
npm run build

# Deploy (method depends on your hosting)
# For example, with Render.io:
git push origin main
```

### Step 5: Verify

After deployment:
1. Clear browser cache and reload
2. Verify version number appears correctly in:
   - Footer version badge
   - About page
   - What's New modal (should appear automatically for users)
3. Check that stats show correctly:
   - Splash page: "{toolCount}+ tools" and "{conditionsCount} conditions"
   - Tour: Dynamic numbers throughout
   - About page: All stats

## Files That Use Dynamic Stats

### Condition Count (PROJECT_STATS.disabilitiesValidated)

- `src/components/DisclaimerSplash.jsx` - Welcome splash
- `src/components/BootCampTour.jsx` - Welcome tour
- `src/components/AboutUs.jsx` - About page
- `src/components/UserManual.jsx` - Documentation

### Tool Count (getTotalToolCount())

- `src/components/DisclaimerSplash.jsx` - Welcome splash  
- `src/components/BootCampTour.jsx` - Welcome tour
- `src/components/AboutUs.jsx` - About page
- `src/utils/componentStats.js` - Component metadata
- `src/components/UserManual.jsx` - Documentation

### Version (APP_VERSION)

- `src/components/AboutUs.jsx` - Version dropdown
- `src/components/Header.jsx` - Header version badge
- `src/components/WhatsNewModal.jsx` - What's New modal
- `src/utils/changelogGenerator.js` - Changelog system
- `public/version.json` - Version file (manual update required)

## Adding New Tools

When you add a new tool:

1. Add it to the appropriate category in `src/data/toolkitData.js`:

```javascript
{
  id: 'evidenceBuilding',
  tools: [
    // Add new tool here
    { 
      name: 'New Tool Name', 
      description: 'What it does',
      isNew: true  // ← Mark as new
    },
    ...
  ]
}
```

2. The tool count will **automatically update** everywhere
3. Update the changelog in `changelogGenerator.js`
4. Bump the version and deploy

## Updating Condition Count

When the conditions database is updated:

1. Count actual conditions:
```powershell
Get-Content "src/data/disabilityData.json" -Raw | ConvertFrom-Json | Select-Object -ExpandProperty disabilities | Measure-Object | Select-Object -ExpandProperty Count
```

2. Update `src/data/projectStats.js`:
```javascript
export const PROJECT_STATS = {
  disabilitiesValidated: 748,  // ← Update this number
  ...
};
```

3. The count will **automatically update** everywhere

## Troubleshooting

### Version not updating after deployment

1. Check that `package.json` was updated
2. Verify build process completed successfully
3. Hard reload browser (Ctrl+Shift+R)
4. Check that version.js is importing correctly:
   ```javascript
   import packageJson from '../../package.json';
   export const APP_VERSION = packageJson.version;
   ```

### Stats showing wrong numbers

1. Verify `PROJECT_STATS.disabilitiesValidated` matches actual data count
2. Check that `getTotalToolCount()` is imported correctly
3. Look for hardcoded numbers that weren't updated to dynamic imports

### What's New modal not appearing

1. Clear localStorage: `localStorage.clear()`
2. Verify version changed in `package.json`

## Smart Version Script Reference

### Commands

| Command | Description |
|---------|-------------|
| `npm run version-preview` | Preview recommended version bump (dry run) |
| `npm run version-auto` | Auto-detect and apply version bump |
| `npm run version-bump` | Manual patch version bump |
| `npm run sync-version` | Sync version to all files (runs in build) |

### Force Override

Override automatic detection when needed:

```powershell
# Force a specific version bump type
node scripts/smart-version.js --force major
node scripts/smart-version.js --force minor
node scripts/smart-version.js --force patch

# Combine with dry-run to preview
node scripts/smart-version.js --force major --dry-run
```

### How Detection Works

The script analyzes:

1. **Git Commits** - Scans commit messages since last version tag for keywords
2. **Changed Files** - Detects new components, utilities, hooks
3. **Schema Changes** - Detects data structure modifications

Priority order: MAJOR > MINOR > PATCH

### Conventional Commits Format

For best results, use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat: add new CAP Simulator calculator
fix: correct calculation in rating combiner
docs: update README with new tool count
refactor: clean up search component
chore: update dependencies
BREAKING CHANGE: restructure data format
```
3. Check that `generateWhatsNewChangelog()` returns current version
4. Ensure `shouldShowWhatsNew()` logic is working

## Best Practices

1. **Always use dynamic imports** - Never hardcode stats
2. **Update changelog first** - Before bumping version
3. **Test locally** - Run `npm run build` and preview before deploying
4. **Clear cache** - After deployment, test with hard reload
5. **Document features** - Add meaningful descriptions in changelog
6. **Mark new features** - Use `isNew: true` for actual new additions

## Quick Reference

```javascript
// Import dynamic stats
import { PROJECT_STATS } from '../data/projectStats';
import { getTotalToolCount } from '../data/toolkitData';
import { APP_VERSION } from '../utils/version';

// Use in JSX
<p>{PROJECT_STATS.disabilitiesValidated} conditions</p>
<p>{getTotalToolCount()}+ professional tools</p>
<p>Version {APP_VERSION}</p>
```

---

**Built by a Veteran, For Veterans** 🎖️
