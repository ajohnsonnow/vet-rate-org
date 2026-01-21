# Changelog System - Quick Reference

## Overview

We now have a **fully automated changelog tracking system** that:
- ✅ Captures all changes from git commits
- ✅ Maintains both CHANGELOG.md (developer view) and changelog.json (user-facing)
- ✅ Automatically categorizes changes by type and feature area
- ✅ Syncs version across package.json, version.js, and all docs
- ✅ Creates git tags and pushes to remote
- ✅ Keeps complete version history

## Quick Commands

### View Current Changelog
```bash
cat CHANGELOG.md                    # Full markdown changelog
cat src/data/changelog.json         # JSON for What's New modal
```

### Update Changelog Manually
```bash
npm run update-changelog            # Generate from recent git commits
npm run changelog-preview           # Preview without writing files
```

### Release New Version

**Patch Release (Bug fixes: 1.4.2 → 1.4.3)**
```bash
npm run release
# OR
npm run release:preview             # Preview first
npm run release                     # Execute
```

**Minor Release (New features: 1.4.2 → 1.5.0)**
```bash
npm run release:minor
```

**Major Release (Breaking changes: 1.4.2 → 2.0.0)**
```bash
npm run release:major
```

## What Happens During Release

The `npm run release` command automatically:

1. **Bumps version** in package.json
2. **Generates changelog** from git commit messages
3. **Syncs version** across all files (version.js, docs, etc.)
4. **Updates stats** (project statistics)
5. **Syncs legal pages** (terms, privacy, etc.)
6. **Stages all changes** for commit
7. **Creates commit** with standardized message
8. **Creates git tag** (e.g., v1.4.3)
9. **Pushes to remote** (with confirmation)

## Commit Message Format

For best changelog generation, use **conventional commits**:

```bash
# Features
git commit -m "feat: Add new calculator feature"
git commit -m "feat(Local AI): Add model management UI"

# Bug Fixes
git commit -m "fix: Resolve calculation error"
git commit -m "fix(DD214): Fix extraction accuracy"

# Documentation
git commit -m "docs: Update setup instructions"
git commit -m "docs(FAQ): Add troubleshooting section"

# Hotfixes (Critical production fixes)
git commit -m "HOTFIX: Fix WebGPU adapter crash"

# Other types
git commit -m "refactor: Improve code structure"
git commit -m "perf: Optimize rendering performance"
git commit -m "test: Add unit tests"
git commit -m "chore: Update dependencies"
```

### Commit Types

| Type | Changelog Section | Description |
|------|------------------|-------------|
| `feat` | Added | New features |
| `fix` | Fixed | Bug fixes |
| `hotfix` | Fixed | Critical production fixes |
| `docs` | Documentation | Documentation changes |
| `perf` | Performance | Performance improvements |
| `refactor` | Refactored | Code refactoring |
| `test` | Tests | Test additions/changes |
| `style` | Style | Code style changes |
| `chore` | Chore | Maintenance tasks |

## Current Version History

✅ **v1.4.2.4** (2026-01-21) - DD214 Analyzer UX fix
✅ **v1.4.2.3** (2026-01-21) - AI badge model name fix
✅ **v1.4.2.2** (2026-01-21) - WebGPU adapter reinit fix
✅ **v1.4.2.1** (2026-01-21) - Local AI crash fixes + FAQ
✅ **v1.4.2** (2026-01-21) - Faraday Cage (Local AI) launch
✅ **v1.3.2** (2026-01-20) - Dynamic stats system
✅ **v1.2.0** (2026-01-19) - Initial feature-complete release (40+ tools)

## File Locations

```
CHANGELOG.md                          # Master changelog (markdown)
src/data/changelog.json               # User-facing changelog (What's New modal)
package.json                          # Version number (single source of truth)
src/utils/version.js                  # Version constants
scripts/update-changelog.js           # Changelog generator
scripts/release.js                    # Automated release script
```

## Manual Workflow (if needed)

If you prefer manual control:

```bash
# 1. Bump version manually
npm version patch              # or minor, or major

# 2. Update changelog
npm run update-changelog

# 3. Review changes
git diff CHANGELOG.md
git diff src/data/changelog.json

# 4. Sync version across files
npm run sync-version

# 5. Commit and tag
git add .
git commit -m "chore: release v1.4.3"
git tag -a v1.4.3 -m "Release v1.4.3"

# 6. Push
git push origin main
git push origin --tags
```

## Tips

### Preview Before Release
Always preview first to see what will change:
```bash
npm run release:preview
```

### Skip Prompts (CI/CD)
For automated deployments:
```bash
npm run release -- -y
```

### Generate Changelog from Specific Version
```bash
node scripts/update-changelog.js --from=v1.4.0
```

### Check Current Version
```bash
npm run version-preview          # Preview next version
node -p "require('./package.json').version"
```

## What's New Modal

The `changelog.json` file powers the "What's New" modal that users see when they first load a new version. It automatically:
- Shows on first visit after version update
- Highlights new features with 🆕 badges
- Groups changes by category
- Displays version number and date
- Only shows last 10 versions (automatically trimmed)

## Troubleshooting

### Changelog not updating?
```bash
# Check git log
git log --oneline -10

# Manually generate
npm run update-changelog

# Preview to debug
npm run changelog-preview
```

### Version mismatch?
```bash
# Sync all version references
npm run sync-version

# Check consistency
grep -r "1.4.2" package.json src/utils/version.js
```

### Release script failed?
- Check for uncommitted changes: `git status`
- Ensure you're on main branch: `git branch`
- Verify remote is configured: `git remote -v`

## Best Practices

1. **Commit Often**: Small, focused commits with descriptive messages
2. **Use Conventional Commits**: Enables automatic categorization
3. **Preview First**: Always run `npm run release:preview` before actual release
4. **Test Locally**: Run `npm run dev` and test changes before releasing
5. **Document Breaking Changes**: Use BREAKING CHANGE: in commit body for major releases
6. **Tag Important Releases**: Git tags help track production deployments

## Integration with CI/CD

To integrate with GitHub Actions or other CI/CD:

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npm run deploy
```

---

## Summary

✅ **You're now tracking all changes automatically!**

Every commit → Captured in changelog → Visible to users in What's New modal

**Next time you want to release:**
```bash
npm run release:preview    # Check what will happen
npm run release            # Do it!
```

That's it! The system handles the rest.
