# Dynamic Stats & Copy System

## Overview

This system prevents "stale data drift" by treating the `README.md` as the **Single Source of Truth** for project statistics. All UI copy automatically updates when you change the README.

## Architecture

```
README.md (Source of Truth)
    ↓
scripts/update-stats.js (Extracts stats)
    ↓
src/data/projectStats.json (Generated stats file)
    ↓
src/data/dynamicCopy.json (Template content with {{placeholders}})
    ↓
src/hooks/useDynamicCopy.js (React hook for components)
    ↓
Your React Components (Auto-updating UI)
```

---

## Quick Start

### 1. Update Stats Manually

When you change numbers in README.md, run:

```bash
npm run update-stats
```

This extracts the latest stats and updates `src/data/projectStats.json`.

### 2. Update Stats Automatically on Build

Stats are **automatically updated** when you run:

```bash
npm run build
```

The build script runs `update-stats` first, ensuring production always has fresh data.

### 3. Use in React Components

```jsx
import { useDynamicCopy } from '../hooks/useDynamicCopy';

function MyComponent() {
  const { copy, stats, replace } = useDynamicCopy();

  return (
    <div>
      {/* Option 1: Use pre-made copy sections */}
      <p>{copy.aboutUs.theCodebase.paragraphs[0]}</p>

      {/* Option 2: Use raw stats */}
      <p>Built with {stats.total_hours} hours of work</p>

      {/* Option 3: Use replace() for custom text */}
      <p>{replace("This tool has {{loc_count}} lines of code!")}</p>
    </div>
  );
}
```

---

## Available Stats

After running `npm run update-stats`, the following variables are available:

### Core Metrics
- `{{total_hours}}` - Total development time (e.g., "7,200")
- `{{actual_hours}}` - Actual time with AI (e.g., "50-55")
- `{{years_dev}}` - Full-time equivalent years (e.g., "3.5")
- `{{loc_count}}` - Lines of code (e.g., "111,440")

### Research & Validation
- `{{research_hours}}` - Hours reading 38 CFR (e.g., "150")
- `{{validation_hours}}` - Hours validating data (e.g., "250")
- `{{validation_count}}` - Number of validated conditions (e.g., "751")
- `{{validation_lines}}` - Lines of data validated (e.g., "15,000")

### Project Metrics
- `{{total_files}}` - Total files (e.g., "1,135")
- `{{total_commits}}` - Git commits (e.g., "52")
- `{{component_count}}` - React components (e.g., "111")
- `{{major_tools}}` - Major features (e.g., "40")
- `{{utility_count}}` - Helper modules (e.g., "47")
- `{{days_dev}}` - Days of development (e.g., "4.5")
- `{{productivity_multiplier}}` - AI speedup (e.g., "131")

### Features
- `{{secondary_conditions}}` - Secondary conditions (e.g., "500")
- `{{forms_supported}}` - VA forms supported (e.g., "16")

### Financial
- `{{market_value}}` - Estimated value (e.g., "$360K")
- `{{competitor_price}}` - Competitor pricing (e.g., "500")

### Dates
- `{{first_commit}}` - First commit date
- `{{last_updated}}` - Last stats update (YYYY-MM-DD)
- `{{version}}` - Version number (YYYYMMDD)

---

## Pre-Made Copy Sections

The system includes ready-to-use content in `src/data/dynamicCopy.json`:

### About Us Section

```jsx
import { useAboutUsContent } from '../hooks/useDynamicCopy';

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

**Includes:**
- `theCodebase` - The main "About Us" narrative
- `whyFree` - Explanation of free model
- `theRealCost` - Market value discussion

### Buy Me a Coffee Content

```jsx
import { useBuyMeACoffeeContent } from '../hooks/useDynamicCopy';

function CoffeeCTA() {
  const coffee = useBuyMeACoffeeContent();
  
  // 10 pre-written captions
  const randomCaption = coffee.captions[Math.floor(Math.random() * coffee.captions.length)];
  
  return (
    <div>
      <h3>{coffee.longForm.header}</h3>
      <p>{coffee.longForm.body}</p>
      <button>{coffee.longForm.cta}</button>
      <p className="caption">{randomCaption}</p>
    </div>
  );
}
```

**Includes:**
- `captions` - 10 punchy one-liners
- `longForm` - Full coffee donation pitch

### UI Messages

```jsx
import { useUIMessages } from '../hooks/useDynamicCopy';

function LoadingScreen() {
  const ui = useUIMessages();
  
  // 10 different loading messages
  const message = ui.loadingScreens[Math.floor(Math.random() * 10)];
  
  return <div>{message}</div>;
}
```

**Includes:**
- `loadingScreens` - 10 loading message variations
- `welcomeModal` - Welcome screen content
- `footerMicroCopy` - Footer text variations
- `tooltips` - Hover text for features
- `errorMessages` - Error screen content
- `successMessages` - Success confirmations

### Social Proof

```jsx
import { useSocialProof } from '../hooks/useDynamicCopy';

function StatsGrid() {
  const social = useSocialProof();
  
  return (
    <div className="grid">
      {social.stats.map((stat, i) => (
        <div key={i}>{stat}</div>
      ))}
    </div>
  );
}
```

**Includes:**
- `stats` - Short stat callouts
- `comparisons` - Competitive comparisons

---

## Example Components

Full working examples are in `src/components/examples/DynamicCopyExamples.jsx`:

1. **AboutUsExample** - Complete "About Us" page
2. **BuyMeACoffeeExample** - Coffee donation modal
3. **LoadingScreenExample** - Rotating loading messages
4. **FooterExample** - Dynamic footer text
5. **CustomTextExample** - Custom text with replace()

---

## Workflow

### When README.md Changes

1. You update a number in README.md (e.g., "7,200 hours" → "8,000 hours")
2. Run `npm run update-stats` (or it runs automatically on `npm run build`)
3. `scripts/update-stats.js` reads README.md and extracts all stats
4. `src/data/projectStats.json` is updated with new values
5. All components using `useDynamicCopy()` automatically show new numbers

### Example Update Flow

```bash
# You edit README.md
vim README.md  # Change "7,200 hours" to "8,000 hours"

# Update stats
npm run update-stats

# Output:
# ✅ Project stats updated successfully!
# 📊 Stats extracted from: README.md
# 💾 Stats saved to: src/data/projectStats.json
# 
# Current Statistics:
#   • Total Development: 8,000 hours (3.8 years FTE)
#   • Lines of Code: 111,440
#   • Validated Conditions: 751
#   • Market Value: $400K
```

Now every component shows "8,000 hours" instead of "7,200 hours".

---

## Advanced Usage

### Custom Placeholder Text

```jsx
const { replace } = useDynamicCopy();

// Inline replacement
<h1>{replace("Welcome! We've built {{total_hours}} hours of tools.")}</h1>

// Multiple placeholders
<p>{replace("{{loc_count}} lines across {{total_files}} files")}</p>
```

### Deep Object Replacement

```jsx
const { replaceDeep } = useDynamicCopy();

const myContent = {
  title: "About {{total_hours}} Hours",
  sections: [
    "We validated {{validation_count}} conditions",
    "Over {{years_dev}} years of work"
  ]
};

const populated = replaceDeep(myContent);
// All {{placeholders}} replaced throughout object
```

### Direct Stats Access

```jsx
const { stats } = useDynamicCopy();

// Use numeric values for calculations
const hourlyRate = 50;
const value = stats.total_hours_numeric * hourlyRate;

console.log(`Project value: $${value.toLocaleString()}`);
// Output: "Project value: $360,000"
```

---

## Customization

### Add New Stats

Edit `scripts/update-stats.js` to extract new values:

```javascript
const stats = {
  // ... existing stats
  
  // Add your custom stat
  my_new_stat: extractFirstNumber(/My Pattern.*?(\d+)/i, 'default_value')
};
```

Then use it:

```jsx
<p>{replace("We now have {{my_new_stat}} new features!")}</p>
```

### Add New Copy Templates

Edit `src/data/dynamicCopy.json`:

```json
{
  "myNewSection": {
    "heading": "New Section",
    "content": "This section has {{total_hours}} hours of {{validation_count}} conditions."
  }
}
```

Use it:

```jsx
const { copy } = useDynamicCopy();
<p>{copy.myNewSection.content}</p>
```

---

## Benefits

✅ **Single Source of Truth** - README.md is the master
✅ **No Stale Data** - Copy always matches current stats
✅ **Developer Friendly** - Simple {{placeholder}} syntax
✅ **Type Safe** - JSON structure is consistent
✅ **Build Integration** - Auto-updates on production builds
✅ **Reusable** - Write once, use everywhere
✅ **Future Proof** - As your project grows, copy grows with it

---

## Troubleshooting

### Stats not updating?

```bash
# Manually run the script with verbose output
node scripts/update-stats.js
```

### Placeholders not replacing?

Check that:
1. Your placeholder uses double curly braces: `{{variable}}`
2. The variable exists in `projectStats.json`
3. You're using the `replace()` or `replaceDeep()` function

### Want to change the extraction pattern?

Edit the regex patterns in `scripts/update-stats.js`:

```javascript
// Current pattern
total_hours: extractFirstNumber(/Total Development Time.*?~?([\d,]+)\s*hours/i)

// Change to match your README format
total_hours: extractFirstNumber(/Your Custom Pattern.*?(\d+)/i)
```

---

## Integration Examples

### Loading Screen

```jsx
function LoadingScreen() {
  const { copy } = useDynamicCopy();
  const [msgIndex, setMsgIndex] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex(i => (i + 1) % copy.uiMessages.loadingScreens.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="loading">
      <Spinner />
      <p>{copy.uiMessages.loadingScreens[msgIndex]}</p>
    </div>
  );
}
```

### Footer

```jsx
function Footer() {
  const { stats, copy } = useDynamicCopy();
  
  return (
    <footer>
      <p>{copy.uiMessages.footerMicroCopy[0]}</p>
      <small>v{stats.version} • Updated {stats.last_updated}</small>
    </footer>
  );
}
```

### About Page

```jsx
function AboutPage() {
  const aboutUs = useAboutUsContent();
  
  return (
    <div className="about">
      <h1>{aboutUs.theCodebase.heading}</h1>
      {aboutUs.theCodebase.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      
      <div className="callout">
        <h2>{aboutUs.whyFree.heading}</h2>
        <p>{aboutUs.whyFree.content}</p>
      </div>
      
      <div className="callout">
        <h2>{aboutUs.theRealCost.heading}</h2>
        <p>{aboutUs.theRealCost.content}</p>
      </div>
    </div>
  );
}
```

---

## Next Steps

1. ✅ Run `npm run update-stats` to generate initial stats
2. ✅ Import `useDynamicCopy` in your components
3. ✅ Replace hardcoded stats with `{{placeholders}}`
4. ✅ Test that stats update when you change README.md
5. ✅ Add custom copy sections as needed

**Your marketing copy will never be out of sync again!** 🎉
