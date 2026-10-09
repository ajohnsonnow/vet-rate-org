/**
 * Generate Legal Pages Script
 * 
 * This script generates standalone HTML versions of Terms of Service and Privacy Policy
 * from their React component sources. Run this whenever you update the React components
 * to keep the standalone HTML pages in sync.
 * 
 * Usage: npm run generate-legal-pages
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const ROOT_DIR = path.join(__dirname, '..');
const COMPONENTS_DIR = path.join(ROOT_DIR, 'src', 'components');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// Source React components
const TOS_COMPONENT = path.join(COMPONENTS_DIR, 'TermsOfServicePage.jsx');
const PRIVACY_COMPONENT = path.join(COMPONENTS_DIR, 'PrivacyPolicyPage.jsx');

// Output HTML files
const TOS_HTML = path.join(PUBLIC_DIR, 'terms-of-service.html');
const PRIVACY_HTML = path.join(PUBLIC_DIR, 'privacy-policy.html');

/**
 * Check if React component has been modified since last HTML generation
 * The HTML file should be newer than (or within tolerance of) the component
 * after running sync-legal-pages.js
 */
function needsRegeneration(componentPath, htmlPath) {
  if (!fs.existsSync(htmlPath)) {
    return true;
  }
  
  const componentStats = fs.statSync(componentPath);
  const htmlStats = fs.statSync(htmlPath);
  
  // Component modification time minus HTML modification time
  // Positive = component is newer (needs sync)
  // Negative or zero = HTML is newer or same (already synced)
  const timeDiffSeconds = (componentStats.mtime - htmlStats.mtime) / 1000;
  
  // Allow 120 second tolerance for build pipeline timing
  // HTML should be same time or newer than component after sync
  return timeDiffSeconds > 120;
}

/**
 * Extract metadata from existing HTML file
 */
function extractHTMLMetadata(htmlPath) {
  if (!fs.existsSync(htmlPath)) {
    return null;
  }
  
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  const generatedMatch = htmlContent.match(/Generated on: (.*)/);
  const effectiveDateMatch = htmlContent.match(/Last Updated:.*?<strong>(.*?)<\/strong>/);
  
  return {
    lastGenerated: generatedMatch ? new Date(generatedMatch[1]) : null,
    effectiveDate: effectiveDateMatch ? effectiveDateMatch[1] : null
  };
}

/**
 * Main function to check and regenerate pages
 */
function checkAndGenerate() {
  console.log('🔍 Checking legal pages for updates...\n');
  
  const checks = [
    {
      name: 'Terms of Service',
      component: TOS_COMPONENT,
      html: TOS_HTML
    },
    {
      name: 'Privacy Policy',
      component: PRIVACY_COMPONENT,
      html: PRIVACY_HTML
    }
  ];
  
  let needsUpdate = false;
  
  checks.forEach(check => {
    const componentExists = fs.existsSync(check.component);
    const htmlExists = fs.existsSync(check.html);
    
    console.log(`📄 ${check.name}:`);
    console.log(`   Component: ${componentExists ? '✅ Found' : '❌ Missing'}`);
    console.log(`   HTML:      ${htmlExists ? '✅ Found' : '❌ Missing'}`);
    
    if (componentExists && htmlExists) {
      const componentStats = fs.statSync(check.component);
      const htmlStats = fs.statSync(check.html);
      const metadata = extractHTMLMetadata(check.html);
      
      console.log(`   Component modified: ${componentStats.mtime.toLocaleString()}`);
      console.log(`   HTML generated:     ${htmlStats.mtime.toLocaleString()}`);
      
      if (metadata && metadata.effectiveDate) {
        console.log(`   Effective date:     ${metadata.effectiveDate}`);
      }
      
      if (needsRegeneration(check.component, check.html)) {
        const componentStats = fs.statSync(check.component);
        const htmlStats = fs.statSync(check.html);
        const timeDiffSeconds = Math.round((componentStats.mtime - htmlStats.mtime) / 1000);
        console.log(`   ⚠️  STATUS: Component is ${timeDiffSeconds}s newer - HTML needs update!`);
        needsUpdate = true;
      } else {
        console.log(`   ✅ STATUS: HTML is up to date`);
      }
    } else if (componentExists && !htmlExists) {
      console.log(`   ⚠️  STATUS: HTML missing - needs generation!`);
      needsUpdate = true;
    }
    
    console.log('');
  });
  
  if (needsUpdate) {
    console.log('❌ Legal pages are OUT OF SYNC with React components!\n');
    console.log('To regenerate:');
    console.log('   1. Ensure React components are finalized');
    console.log('   2. Update effective dates in components if needed');
    console.log('   3. Manually update the HTML files (or implement full auto-generation)');
    console.log('   4. Run: git add public/terms-of-service.html public/privacy-policy.html');
    console.log('   5. Run: git commit -m "Update legal pages from React components"');
    console.log('   6. Run: git push origin main\n');
    return false;
  } else {
    console.log('✅ All legal pages are up to date!\n');
    return true;
  }
}

/**
 * Generate instruction file for manual updates
 */
function generateInstructions() {
  const instructions = `# Legal Pages Generation Instructions

## Overview
The Terms of Service and Privacy Policy exist in two formats:
1. **React Components** (src/components/) - Used in the app
2. **Standalone HTML** (public/) - Used for VA API registration and direct access

## Keeping Pages in Sync

### When you update React components:

1. **Edit the React component** (TermsOfServicePage.jsx or PrivacyPolicy.jsx)
   - Update content, dates, sections as needed
   - Update "Last Updated" date

2. **Check for sync issues**:
   \`\`\`bash
   npm run check-legal-pages
   \`\`\`

3. **Update the HTML version**:
   - Option A: Manually edit public/terms-of-service.html or public/privacy-policy.html
   - Option B: Copy content structure from React component to HTML
   - Option C: Use AI to convert JSX to HTML (ChatGPT, Claude, etc.)

4. **Verify changes**:
   - Open HTML files in browser to test
   - Check that dates, content match React components
   - Ensure styling is consistent

5. **Commit both files**:
   \`\`\`bash
   git add src/components/TermsOfServicePage.jsx public/terms-of-service.html
   git commit -m "Update Terms of Service - [describe changes]"
   git push origin main
   \`\`\`

## File Locations

- **React Components**:
  - \`src/components/TermsOfServicePage.jsx\`
  - \`src/components/PrivacyPolicy.jsx\`

- **HTML Pages**:
  - \`public/terms-of-service.html\`
  - \`public/privacy-policy.html\`

- **URLs (after deployment)**:
  - https://vet-rate.org/terms-of-service.html
  - https://vet-rate.org/privacy-policy.html

## Content Checklist

When updating, ensure these match between React and HTML:
- [ ] Effective/Last Updated date
- [ ] All section headings
- [ ] All disclaimer text
- [ ] All bullet points and lists
- [ ] Legal citations and references
- [ ] Contact information
- [ ] Version numbers (if applicable)

## Future Enhancement

For fully automated generation, consider:
- Using a JSX to HTML parser
- Creating a shared content JSON/JS file
- Building a more sophisticated generation script
- Adding to CI/CD pipeline

Generated: ${new Date().toISOString()}
`;

  const instructionsPath = path.join(ROOT_DIR, 'docs', 'LEGAL_PAGES_SYNC.md');
  fs.writeFileSync(instructionsPath, instructions, 'utf-8');
  console.log(`📝 Generated instructions: ${instructionsPath}\n`);
}

/**
 * CI gate (A-H10 / D-H04): generated legal HTML must contain no unresolved
 * {t(...)} i18n calls. A leaked call means the JSX→HTML generator failed to
 * resolve a translation and a raw `{t("...")}` would render to the user.
 */
function assertNoUnresolvedTranslations() {
  let ok = true;
  for (const html of [TOS_HTML, PRIVACY_HTML]) {
    if (!fs.existsSync(html)) continue;
    const leaked = fs.readFileSync(html, 'utf-8').match(/\{\s*t\(/g);
    if (leaked) {
      ok = false;
      console.error(
        `❌ ${path.basename(html)} has ${leaked.length} unresolved {t(...)} call(s). Run "npm run sync-legal-pages".`
      );
    }
  }
  if (ok) {
    console.log('✅ No unresolved {t(...)} i18n calls in generated legal pages.\n');
  }
  return ok;
}

// Run the check
console.log('═══════════════════════════════════════════════════════════════');
console.log('        Vet-Rate.org Legal Pages Sync Checker');
console.log('═══════════════════════════════════════════════════════════════\n');

const isSync = checkAndGenerate();
generateInstructions();
const noLeaks = assertNoUnresolvedTranslations();

console.log('═══════════════════════════════════════════════════════════════');

// Exit with error code if out of sync or i18n leaked (useful for CI/CD)
process.exit(isSync && noLeaks ? 0 : 1);
