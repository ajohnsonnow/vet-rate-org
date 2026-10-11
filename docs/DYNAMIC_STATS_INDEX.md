# 📚 Dynamic Stats System Documentation

## Quick Links

- **🚀 Get Started** - Implementation checklist (not part of the public repository; the [Quick Start](DYNAMIC_STATS_GUIDE.md#quick-start) section of the guide covers setup)
- **📖 [Complete Guide](DYNAMIC_STATS_GUIDE.md)** - Full API documentation
- **🎨 Examples** - Real component examples (not part of the public repository; see [Working Examples](../src/components/examples/DynamicCopyExamples.jsx))
- **📊 Visual Flow** - System architecture diagram (not part of the public repository; the guide has an [Architecture](DYNAMIC_STATS_GUIDE.md#architecture) section)
- **📋 Summary** - Executive overview (not part of the public repository; the guide opens with an [Overview](DYNAMIC_STATS_GUIDE.md#overview))

---

## What Is This?

A content management system that keeps your marketing copy synchronized with your actual project statistics. No more stale data!

## The Problem

Your README says "7,200 hours" but your About page still says "6,500 hours" from last month.

## The Solution

Edit README.md once → Run `npm run update-stats` → Everything updates automatically.

---

## File Structure

```
scripts/
  update-stats.js           # Extracts stats from README

src/
  data/
    projectStats.json       # Generated stats (26 metrics)
    dynamicCopy.json        # Template content with {{placeholders}}

  hooks/
    useDynamicCopy.js       # React hook for components

  components/
    examples/
      DynamicCopyExamples.jsx  # 5 working examples

docs/
  DYNAMIC_STATS_GUIDE.md   # You are here (index)

DYNAMIC_STATS_CHECKLIST.md # Quick start guide (not in the public repository)
MIGRATION_EXAMPLE.md        # Before/after comparisons (not in the public repository)
DYNAMIC_STATS_SUMMARY.md    # Executive summary (not in the public repository)
VISUAL_FLOW.md              # Architecture diagram (not in the public repository)
```

---

## Quick Start

### 1. Generate Stats

```bash
npm run update-stats
```

### 2. Use in Components

```jsx
import { useDynamicCopy } from "../hooks/useDynamicCopy";

function MyComponent() {
  const { replace, stats } = useDynamicCopy();

  return (
    <div>
      <p>{replace("Built with {{total_hours}} hours")}</p>
      <p>{stats.validation_count} conditions validated</p>
    </div>
  );
}
```

### 3. Update When README Changes

```bash
# Edit README.md to change any numbers
npm run update-stats
# All components automatically update!
```

---

## Available Documentation

### For New Users

Start here if you're just learning about the system:

1. **`DYNAMIC_STATS_SUMMARY.md`** (not part of the public repository)
   - Executive overview
   - What problem it solves
   - Quick examples
   - 5-minute read

2. **`VISUAL_FLOW.md`** (not part of the public repository)
   - Visual architecture
   - Data flow diagrams
   - Before/after comparisons
   - Usage patterns

### For Implementation

Read these when you're ready to integrate:

1. **`DYNAMIC_STATS_CHECKLIST.md`** (not part of the public repository)
   - Step-by-step setup
   - Testing instructions
   - Quick wins
   - Troubleshooting

2. **`MIGRATION_EXAMPLE.md`** (not part of the public repository)
   - Real code from your project
   - DisclaimerSplash.jsx example
   - AboutUs.jsx example
   - Before/after diffs

### For Advanced Usage

Reference these for deep knowledge:

1. **[DYNAMIC_STATS_GUIDE.md](DYNAMIC_STATS_GUIDE.md)**
   - Complete API reference
   - All 26 available stats
   - Advanced patterns
   - Customization guide

2. **[Working Examples](../src/components/examples/DynamicCopyExamples.jsx)**
   - 5 complete components
   - Copy-paste ready
   - Best practices

---

## Common Tasks

### Update Project Stats

```bash
npm run update-stats
```

### Find Hardcoded Stats

```bash
grep -r "7,200\|111,440\|751" src/
```

### Add New Stat

Edit `scripts/update-stats.js`:

```javascript
const stats = {
  // ... existing stats
  my_new_stat: extractFirstNumber(/Your Pattern.*?(\d+)/i, "default"),
};
```

### Add New Copy Template

Edit `src/data/dynamicCopy.json`:

```json
{
  "mySection": {
    "text": "Your text with {{placeholders}}"
  }
}
```

---

## Usage Patterns

### Direct Access (Simple)

```jsx
const { stats } = useDynamicCopy();
<p>{stats.total_hours} hours</p>;
```

### Replace Function (Flexible)

```jsx
const { replace } = useDynamicCopy();
<p>{replace("Built with {{total_hours}} hours")}</p>;
```

### Pre-Made Copy (Ready-to-Use)

```jsx
const { copy } = useDynamicCopy();
<p>{copy.aboutUs.theCodebase.paragraphs[0]}</p>;
```

### Specialized Hooks (Organized)

```jsx
const aboutUs = useAboutUsContent();
const coffee = useBuyMeACoffeeContent();
const ui = useUIMessages();
```

---

## Available Stats (26 Total)

### Core Metrics

- `total_hours` - "7,200"
- `years_dev` - "3.5"
- `loc_count` - "111,440"
- `validation_count` - "751"
- `market_value` - "$360K"

[See complete list in DYNAMIC_STATS_GUIDE.md](DYNAMIC_STATS_GUIDE.md#available-stats)

---

## Pre-Written Content

### About Us

- The Codebase (4 paragraphs)
- Why It's Free
- The Real Cost

### Buy Me a Coffee

- 10 punchy captions
- Long-form donation pitch

### UI Messages

- 10 loading screen variations
- Welcome modal content
- 5 footer variations
- Tooltips
- Error/success messages

### Social Proof

- 6 stat callouts
- 4 competitive comparisons

---

## Examples

### Loading Screen

```jsx
import { useUIMessages } from "../hooks/useDynamicCopy";

function LoadingScreen() {
  const ui = useUIMessages();
  return <div>{ui.loadingScreens[0]}</div>;
}
```

Result: "Parsing 111,440 lines of code to find your answer..."

### About Section

```jsx
import { useAboutUsContent } from "../hooks/useDynamicCopy";

function AboutUs() {
  const aboutUs = useAboutUsContent();
  return (
    <div>
      <h2>{aboutUs.theCodebase.heading}</h2>
      {aboutUs.theCodebase.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
```

### Footer

```jsx
import { useDynamicCopy } from "../hooks/useDynamicCopy";

function Footer() {
  const { stats, copy } = useDynamicCopy();
  return (
    <footer>
      <p>{copy.uiMessages.footerMicroCopy[0]}</p>
      <small>v{stats.version}</small>
    </footer>
  );
}
```

---

## Workflow

### Development

```bash
# Edit README.md
vim README.md

# Update stats
npm run update-stats

# Start dev server
npm run dev

# Verify changes
```

### Production

```bash
# Build automatically updates stats
npm run build

# Deploy
```

---

## Benefits

✅ **Single Source of Truth** - README.md is master
✅ **No Stale Data** - Components always sync
✅ **Time Savings** - 30 min → 30 sec per update
✅ **Professional** - Consistent everywhere
✅ **Future-Proof** - Scales as project grows
✅ **Git-Tracked** - Changes are versioned

---

## Support

### Troubleshooting

See [DYNAMIC_STATS_GUIDE.md - Troubleshooting](DYNAMIC_STATS_GUIDE.md#troubleshooting)

### Commands

```bash
# Update stats
npm run update-stats

# Build with fresh stats
npm run build

# Find hardcoded numbers
grep -r "7,200\|111,440\|751" src/
```

### Documentation Issues

If something's unclear:

1. Check [DYNAMIC_STATS_GUIDE.md](DYNAMIC_STATS_GUIDE.md) for details
2. Review [Working Examples](../src/components/examples/DynamicCopyExamples.jsx)

---

## Architecture

```
README.md → update-stats.js → projectStats.json → useDynamicCopy() → Components
```

The guide's [Architecture](DYNAMIC_STATS_GUIDE.md#architecture) section describes the flow in more detail.

---

## Next Steps

1. ✅ Run `npm run update-stats`
2. ✅ Try example components
3. ✅ Update your first component
4. ✅ Gradually migrate existing code
5. ✅ Enjoy automated sync!

---

## Files You'll Use Most

- `npm run update-stats` - Command you'll run
- `useDynamicCopy()` - Hook you'll import
- `projectStats.json` - Generated stats file
- `dynamicCopy.json` - Template content

---

## Quick Reference Card

```jsx
// Import the hook
import { useDynamicCopy } from '../hooks/useDynamicCopy';

// In your component
function MyComponent() {
  const { stats, replace, copy } = useDynamicCopy();

  // Direct access
  <p>{stats.total_hours} hours</p>

  // Replace function
  <p>{replace("Built with {{total_hours}} hours")}</p>

  // Pre-made copy
  <p>{copy.aboutUs.theCodebase.paragraphs[0]}</p>
}
```

---

🎉 **You're all set!** Start with the [Quick Start](DYNAMIC_STATS_GUIDE.md#quick-start) in the guide
