/**
 * Legal Pages Auto-Generator
 * 
 * AUTOMATICALLY generates standalone HTML files from React components.
 * NO manual intervention. NO shortcuts. FULL content generation.
 * 
 * Usage: npm run sync-legal-pages
 * 
 * This script:
 * 1. Reads the React component JSX
 * 2. Converts JSX to valid HTML
 * 3. Wraps in standalone HTML document with embedded CSS
 * 4. Writes the complete HTML file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { APP_TRANSLATIONS } from '../src/i18n/translations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const COMPONENTS_DIR = path.join(ROOT_DIR, 'src', 'components');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// ═══════════════════════════════════════════════════════════════════════════════
// Tailwind to CSS Mapping (for standalone HTML)
// ═══════════════════════════════════════════════════════════════════════════════

const EMBEDDED_CSS = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
    }

    .header {
      background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%);
      color: white;
      padding: 2rem 1.5rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      border-bottom: 4px solid #991b1b;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .header h1 {
      font-size: 2rem;
      font-weight: bold;
    }

    .header p {
      color: #fecaca;
      font-size: 0.9rem;
      margin-top: 0.25rem;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      background: white;
      box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
      min-height: calc(100vh - 180px);
    }

    .effective-date {
      text-align: center;
      padding: 1.5rem;
      background: #f3f4f6;
      border-radius: 0.5rem;
      margin-bottom: 2rem;
    }

    .effective-date strong {
      color: #1f2937;
    }

    section {
      margin-bottom: 3rem;
    }

    h2 {
      font-size: 1.75rem;
      font-weight: bold;
      color: #111827;
      margin-bottom: 1.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 3px solid #e5e7eb;
    }

    h3 {
      font-size: 1.3rem;
      font-weight: 600;
      color: #374151;
      margin: 1.5rem 0 1rem 0;
    }

    h4 {
      font-size: 1.1rem;
      font-weight: 600;
      color: #4b5563;
      margin: 1rem 0 0.75rem 0;
    }

    p {
      margin-bottom: 1rem;
      line-height: 1.8;
    }

    ul, ol {
      margin: 1rem 0 1rem 2rem;
      line-height: 1.8;
    }

    ul li, ol li {
      margin-bottom: 0.5rem;
    }

    .alert {
      padding: 1.5rem;
      border-radius: 0.5rem;
      margin: 1.5rem 0;
      border-left: 4px solid;
    }

    .alert-yellow {
      background: #fef3c7;
      border-color: #f59e0b;
      color: #92400e;
    }

    .alert-blue {
      background: #dbeafe;
      border-color: #3b82f6;
      color: #1e3a8a;
    }

    .alert-green {
      background: #d1fae5;
      border-color: #10b981;
      color: #065f46;
    }

    .alert-red {
      background: #fee2e2;
      border-color: #ef4444;
      color: #991b1b;
    }

    .alert-orange {
      background: #fed7aa;
      border-color: #f97316;
      color: #9a3412;
    }

    .alert-purple {
      background: #e9d5ff;
      border-color: #a855f7;
      color: #6b21a8;
    }

    .alert h3, .alert h4 {
      color: inherit;
      margin-top: 0;
    }

    .alert strong {
      font-weight: 700;
    }

    .warning-box {
      background: #fee2e2;
      border: 4px solid #dc2626;
      border-radius: 0.5rem;
      padding: 2rem;
      margin: 2rem 0;
    }

    .warning-box h3 {
      color: #991b1b;
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }

    .warning-box ul {
      color: #991b1b;
    }

    .code {
      background: #e5e7eb;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }

    .section-border {
      border-left: 4px solid;
      padding-left: 1.5rem;
      margin-left: 0.5rem;
    }

    .section-border-blue { border-color: #3b82f6; }
    .section-border-green { border-color: #10b981; }
    .section-border-purple { border-color: #a855f7; }
    .section-border-orange { border-color: #f97316; }
    .section-border-red { border-color: #ef4444; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }

    .grid-item {
      background: white;
      border: 1px solid #d1d5db;
      padding: 1rem;
      border-radius: 0.5rem;
    }

    .grid-item h4 {
      margin-top: 0;
      font-size: 0.95rem;
    }

    .grid-item p {
      font-size: 0.85rem;
      color: #6b7280;
      margin: 0;
    }

    .acceptance-box {
      background: #d1fae5;
      border: 4px solid #10b981;
      border-radius: 0.5rem;
      padding: 2rem;
      margin: 2rem 0;
    }

    .acceptance-box h2 {
      color: #065f46;
      border: none;
      margin-bottom: 1rem;
    }

    .acceptance-box ol {
      color: #065f46;
    }

    .footer-box {
      text-align: center;
      padding: 2rem;
      border-top: 2px solid #e5e7eb;
      margin-top: 3rem;
    }

    .footer-box p {
      margin-bottom: 0.5rem;
    }

    .btn {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      border-radius: 0.5rem;
      font-weight: 600;
      transition: background 0.3s;
      border: none;
      cursor: pointer;
      font-size: 1rem;
    }

    .btn:hover {
      background: #2563eb;
    }

    a {
      color: #2563eb;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 1.5rem;
      }
      .container {
        padding: 1rem;
      }
      h2 {
        font-size: 1.4rem;
      }
      .grid {
        grid-template-columns: 1fr;
      }
    }

    /* Dark Mode Support */
    @media (prefers-color-scheme: dark) {
      body {
        color: #f3f4f6;
        background: #111827;
      }

      .container {
        background: #1f2937;
      }

      .effective-date {
        background: #374151;
      }

      .effective-date strong {
        color: #f3f4f6;
      }

      h2 {
        color: #f9fafb;
        border-bottom-color: #4b5563;
      }

      h3 {
        color: #e5e7eb;
      }

      h4 {
        color: #d1d5db;
      }

      .alert-yellow {
        background: rgba(251, 191, 36, 0.2);
        color: #fde047;
      }

      .alert-blue {
        background: rgba(59, 130, 246, 0.2);
        color: #93c5fd;
      }

      .alert-green {
        background: rgba(16, 185, 129, 0.2);
        color: #6ee7b7;
      }

      .alert-red {
        background: rgba(239, 68, 68, 0.2);
        color: #fca5a5;
      }

      .alert-orange {
        background: rgba(249, 115, 22, 0.2);
        color: #fdba74;
      }

      .alert-purple {
        background: rgba(168, 85, 247, 0.2);
        color: #d8b4fe;
      }

      .warning-box {
        background: rgba(239, 68, 68, 0.2);
        border-color: #dc2626;
      }

      .warning-box h3,
      .warning-box ul {
        color: #fca5a5;
      }

      .code {
        background: #374151;
        color: #e5e7eb;
      }

      .grid-item {
        background: #374151;
        border-color: #4b5563;
      }

      .grid-item p {
        color: #9ca3af;
      }

      .acceptance-box {
        background: rgba(16, 185, 129, 0.2);
        border-color: #10b981;
      }

      .acceptance-box h2,
      .acceptance-box ol {
        color: #6ee7b7;
      }

      .footer-box {
        border-top-color: #4b5563;
      }

      a {
        color: #60a5fa;
      }
    }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// JSX to HTML Converter
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Escape text for safe insertion into HTML body content.
 */
function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** Look up the English string for a t("section","key") call, or null. */
function lookupEnglish(section, key) {
  const leaf = APP_TRANSLATIONS?.[section]?.[key];
  return leaf && typeof leaf.en === 'string' ? leaf.en : null;
}

/**
 * Resolve {t("section","key")} i18n calls to their English string before JSX→HTML
 * conversion. The standalone legal pages are English-only, but the React source
 * renders its body through t(); without this, literal {t(...)} expressions leaked
 * verbatim into the public HTML (A-H10 / D-H04). An unknown key is left intact so
 * the post-generation guard fails loudly rather than shipping a blank legal page.
 */
function resolveTranslationCalls(source) {
  // First, the split idiom the privacy page uses to interleave links:
  //   {t("s","k").split("X")[0]}  /  {t("s","k").split(".")[1]?.trim() || "fallback"}
  // Evaluated deterministically against the resolved English string (no eval).
  let out = source.replace(
    /\{\s*t\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3\s*\)\.split\(\s*(['"])(.*?)\5\s*\)\s*\[\s*(\d+)\s*\]\s*(\?\.trim\(\))?\s*(?:\|\|\s*(['"])([\s\S]*?)\9)?\s*\}/g,
    (match, _q1, section, _q2, key, _q3, sep, idx, trim, _q4, fallback) => {
      const en = lookupEnglish(section, key);
      if (en == null) return match;
      let part = en.split(sep)[Number(idx)];
      if (trim && typeof part === 'string') part = part.trim();
      if (part === undefined || part === '') part = fallback ?? '';
      return escapeHtml(part);
    },
  );

  // Then plain {t("section","key")} calls.
  out = out.replace(
    /\{\s*t\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3\s*\)\s*\}/g,
    (match, _q1, section, _q2, key) => {
      const en = lookupEnglish(section, key);
      return en == null ? match : escapeHtml(en);
    },
  );

  return out;
}

/**
 * Map background + border combinations to alert classes
 */
function mapAlertClass(classString) {
  if (classString.includes('bg-yellow-50') || classString.includes('border-yellow')) {
    return 'alert alert-yellow';
  }
  if (classString.includes('bg-blue-50') || classString.includes('border-blue-600')) {
    return 'alert alert-blue';
  }
  if (classString.includes('bg-green-50') || classString.includes('border-green')) {
    return 'alert alert-green';
  }
  if (classString.includes('bg-red-50') || classString.includes('border-red')) {
    return 'alert alert-red';
  }
  if (classString.includes('bg-purple-50') || classString.includes('border-purple')) {
    return 'alert alert-purple';
  }
  return '';
}

/**
 * Map left-border section combinations to section-border classes
 */
function mapSectionBorderClass(classString) {
  if (!classString.includes('border-l-4')) return '';
  if (classString.includes('border-blue')) return 'section-border section-border-blue';
  if (classString.includes('border-green')) return 'section-border section-border-green';
  if (classString.includes('border-purple')) return 'section-border section-border-purple';
  if (classString.includes('border-orange')) return 'section-border section-border-orange';
  if (classString.includes('border-red')) return 'section-border section-border-red';
  return '';
}

/**
 * Convert Tailwind classes to semantic CSS classes for alerts/sections
 */
function mapTailwindClasses(classString) {
  if (!classString) return '';
  return mapAlertClass(classString) || mapSectionBorderClass(classString);
}

/**
 * Extract all sections from the JSX content
 */
function extractSections(jsx) {
  const sections = [];
  
  // Match section tags with their content
  const sectionRegex = /<section[^>]*>([\s\S]*?)<\/section>/gi;
  let match;
  
  while ((match = sectionRegex.exec(jsx)) !== null) {
    sections.push(match[0]);
  }
  
  return sections;
}

/**
 * Convert a single JSX section to HTML
 */
function convertSectionToHTML(jsxSection) {
  let html = jsxSection;
  
  // Extract className for section styling
  const classMatch = html.match(/<section\s+className="([^"]*)"/);
  const sectionClass = classMatch ? mapTailwindClasses(classMatch[1]) : '';
  
  // Convert className to class
  html = html.replace(/className=/g, 'class=');
  
  // Convert JSX expressions {' '} to space
  html = html.replace(/\{'\s*'\}/g, ' ');
  html = html.replace(/\{\s*'\s+'\s*\}/g, ' ');
  
  // Convert JSX curly brace text expressions
  html = html.replace(/\{"([^"]*)"\}/g, '$1');
  html = html.replace(/\{'([^']*)'\}/g, '$1');
  
  // Remove JSX comments
  html = html.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  
  // Convert self-closing JSX tags
  html = html.replace(/<(\w+)([^>]*)\s*\/>/g, '<$1$2></$1>');
  
  // Remove React-specific attributes
  html = html.replace(/\s+onClick=\{[^}]*\}/g, '');
  html = html.replace(/\s+onClose=\{[^}]*\}/g, '');
  html = html.replace(/\s+aria-label="[^"]*"/g, '');
  
  // Remove SVG completely and their containers
  html = html.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  
  // Remove empty spans/divs left by SVG removal
  html = html.replace(/<span[^>]*>\s*<\/span>/gi, '');
  
  // Clean up Tailwind classes - convert to semantic classes or remove
  html = html.replace(/class="[^"]*"/g, (match) => {
    const classes = match.slice(7, -1);
    const mapped = mapTailwindClasses(classes);
    return mapped ? `class="${mapped}"` : '';
  });
  
  // Fix the section tag with proper class
  if (sectionClass) {
    html = html.replace(/<section[^>]*>/, `<section class="${sectionClass}">`);
  } else {
    html = html.replace(/<section\s+class="">/g, '<section>');
  }
  
  // Remove empty class attributes
  html = html.replace(/\s+class=""/g, '');
  
  // Clean up whitespace
  html = html.replace(/>\s+</g, '>\n        <');
  
  return html;
}

/**
 * Extract metadata from component (effective date, title, etc.)
 */
function extractMetadata(componentSource) {
  const metadata = {
    effectiveDate: null,
    documentVersion: null,
    title: null
  };
  
  // Extract effective date - try multiple patterns
  let dateMatch = componentSource.match(/Last Updated:.*?<strong>(.*?)<\/strong>/);
  if (!dateMatch) {
    dateMatch = componentSource.match(/Effective:\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,?\s+\d{4}/i);
  }
  if (dateMatch) {
    metadata.effectiveDate = dateMatch[1];
  }
  
  // Extract document version
  const versionMatch = componentSource.match(/Document Version:\s*([\d.]+)/);
  if (versionMatch) {
    metadata.documentVersion = versionMatch[1];
  }
  
  return metadata;
}

/**
 * Process Terms of Service specifically
 */
function processTermsOfService(componentSource) {
  const metadata = extractMetadata(componentSource);

  // Build HTML content section by section
  let htmlContent = '';

  // Resolve i18n calls to English before extraction so no {t(...)} leaks (A-H10).
  const resolvedSource = resolveTranslationCalls(componentSource);

  // Extract and convert each section
  const sections = extractSections(resolvedSource);
  
  for (const section of sections) {
    htmlContent += '\n        ' + convertSectionToHTML(section) + '\n';
  }
  
  // If no sections found, do basic conversion of the whole content
  if (sections.length === 0) {
    console.log('   ⚠️  No sections found, using full content extraction');
    htmlContent = basicJSXtoHTML(componentSource);
  }
  
  return { htmlContent, metadata };
}

/**
 * Basic JSX to HTML conversion for fallback
 */
function basicJSXtoHTML(jsx) {
  let html = jsx;
  
  // Remove React wrapper elements
  html = html.replace(/<div className="fixed inset-0[\s\S]*?<div className="px-8 py-8/gi, '<div class="content"');
  
  // Convert className to class
  html = html.replace(/className=/g, 'class=');
  
  // Remove JSX expressions
  html = html.replace(/\{[^}]*\}/g, '');
  
  // Remove SVGs
  html = html.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  
  return html;
}

/**
 * Generate complete standalone HTML document for Terms of Service
 */
function generateTOSHTML(componentSource) {
  const { htmlContent, metadata } = processTermsOfService(componentSource);
  
  const now = new Date();
  const generatedDate = now.toISOString();
  const effectiveDate = metadata.effectiveDate || 'January 18, 2026';
  
  return `<!DOCTYPE html>
<!--
  ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY!
  
  This HTML file is automatically generated from:
  Source: src/components/TermsOfServicePage.jsx
  
  To update this page:
  1. Edit the React component: src/components/TermsOfServicePage.jsx
  2. Run: npm run build (auto-syncs) OR npm run sync-legal-pages
  3. This HTML will be regenerated automatically
  
  Generated: ${generatedDate}
  Generator: scripts/sync-legal-pages.js
-->
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terms of Service - Vet-Rate.org</title>
    <meta name="description" content="Vet-Rate.org Terms of Service and Liability Waiver - Legal framework for using our free VA disability claims toolkit.">
    <meta name="generator" content="Vet-Rate.org Legal Pages Auto-Generator">
    <meta name="generated-date" content="${generatedDate}">
    <link rel="icon" type="image/x-icon" href="/images/favicon.ico">
    <style>${EMBEDDED_CSS}
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="header-content">
            <div>
                <h1>Terms of Service &amp; Liability Waiver</h1>
                <p>Vet-Rate.org Legal Framework</p>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <div class="container">
        <!-- Effective Date -->
        <div class="effective-date">
            <p>Last Updated: <strong>${effectiveDate}</strong></p>
            <p style="font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem;">
                By using Vet-Rate.org, you accept these terms in full
            </p>
        </div>

${htmlContent}

        <!-- Footer -->
        <div class="footer-box">
            <p style="font-size: 1.2rem; font-weight: 600; color: #111827;">Thank you for using Vet-Rate.org</p>
            <p style="color: #6b7280; margin-top: 1rem;">
                I'm honored to serve those who served. Stay safe, document everything, and never give up on your claim.
            </p>
            <p style="color: #9ca3af; font-size: 0.85rem; margin-top: 1.5rem;">
                Document Version: ${metadata.documentVersion || '1.0'} | Effective: ${effectiveDate}
            </p>
            <a href="/" class="btn" style="margin-top: 1.5rem;">Return to Vet-Rate.org</a>
        </div>
    </div>
</body>
</html>
`;
}

/**
 * Generate Privacy Policy HTML
 */
function generatePrivacyHTML(componentSource) {
  const metadata = extractMetadata(componentSource);

  // Resolve i18n calls to English before extraction so no {t(...)} leaks (A-H10).
  const resolvedSource = resolveTranslationCalls(componentSource);

  // Extract sections
  const sections = extractSections(resolvedSource);
  let htmlContent = '';
  
  for (const section of sections) {
    htmlContent += '\n        ' + convertSectionToHTML(section) + '\n';
  }
  
  const now = new Date();
  const generatedDate = now.toISOString();
  const effectiveDate = metadata.effectiveDate || 'January 18, 2026';
  
  return `<!DOCTYPE html>
<!--
  ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY!
  
  This HTML file is automatically generated from:
  Source: src/components/PrivacyPolicyPage.jsx
  
  To update this page:
  1. Edit the React component: src/components/PrivacyPolicyPage.jsx
  2. Run: npm run build (auto-syncs) OR npm run sync-legal-pages
  3. This HTML will be regenerated automatically
  
  Generated: ${generatedDate}
  Generator: scripts/sync-legal-pages.js
-->
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - Vet-Rate.org</title>
    <meta name="description" content="Vet-Rate.org Privacy Policy - How we protect your data with our privacy-first, browser-based approach.">
    <meta name="generator" content="Vet-Rate.org Legal Pages Auto-Generator">
    <meta name="generated-date" content="${generatedDate}">
    <link rel="icon" type="image/x-icon" href="/images/favicon.ico">
    <style>${EMBEDDED_CSS}
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="header-content">
            <div>
                <h1>Privacy Policy</h1>
                <p>Vet-Rate.org Data Protection</p>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <div class="container">
        <!-- Effective Date -->
        <div class="effective-date">
            <p>Last Updated: <strong>${effectiveDate}</strong></p>
            <p style="font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem;">
                Your privacy is protected by design
            </p>
        </div>

${htmlContent}

        <!-- Footer -->
        <div class="footer-box">
            <p style="font-size: 1.2rem; font-weight: 600; color: #111827;">Your Privacy Matters</p>
            <p style="color: #6b7280; margin-top: 1rem;">
                Vet-Rate.org is built with privacy-first architecture. Your data stays on your device.
            </p>
            <p style="color: #9ca3af; font-size: 0.85rem; margin-top: 1.5rem;">
                Document Version: ${metadata.documentVersion || '1.0'} | Effective: ${effectiveDate}
            </p>
            <a href="/" class="btn" style="margin-top: 1.5rem;">Return to Vet-Rate.org</a>
        </div>
    </div>
</body>
</html>
`;
}

/**
 * Process a single page
 */
function processPage(config) {
  const { name, componentPath, htmlPath, generator } = config;
  
  console.log(`\n📄 ${name}:`);
  
  // Check component exists
  if (!fs.existsSync(componentPath)) {
    console.log(`   ❌ Component not found: ${componentPath}`);
    return false;
  }
  
  // Read component source
  const componentSource = fs.readFileSync(componentPath, 'utf-8');
  console.log(`   📖 Read component: ${path.basename(componentPath)} (${componentSource.length} chars)`);
  
  // Extract metadata for logging
  const metadata = extractMetadata(componentSource);
  console.log(`   📅 Effective date: ${metadata.effectiveDate || 'Using default'}`);
  
  try {
    // Generate HTML using the appropriate generator
    const html = generator(componentSource);
    console.log(`   ✨ Generated HTML (${html.length} chars)`);
    
    // Guard (A-H10/D-H04): never ship unresolved {t(...)} JSX in a public legal
    // page — a missing translation key would render as raw code to the user.
    const leaked = html.match(/\{\s*t\(/g);
    if (leaked) {
      console.log(
        `   ❌ ${leaked.length} unresolved t() call(s) in generated HTML — a translation key is missing.`,
      );
      return false;
    }

    // Write HTML file
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`   ✅ Written: ${path.basename(htmlPath)}`);

    return true;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('        🔄 Legal Pages Auto-Generator');
  console.log('        Vet-Rate.org - AUTOMATIC HTML Generation');
  console.log('        NO manual edits. NO shortcuts. FULL rebuild.');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n⚡ Generating HTML files from React components...');
  
  const pages = [
    {
      name: 'Terms of Service',
      componentPath: path.join(COMPONENTS_DIR, 'TermsOfServicePage.jsx'),
      htmlPath: path.join(PUBLIC_DIR, 'terms-of-service.html'),
      generator: generateTOSHTML
    },
    {
      name: 'Privacy Policy',
      componentPath: path.join(COMPONENTS_DIR, 'PrivacyPolicyPage.jsx'),
      htmlPath: path.join(PUBLIC_DIR, 'privacy-policy.html'),
      generator: generatePrivacyHTML
    }
  ];
  
  let successCount = 0;
  
  for (const page of pages) {
    if (processPage(page)) {
      successCount++;
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  if (successCount === pages.length) {
    console.log(`  ✅ All ${successCount} legal pages REGENERATED from React components!`);
  } else {
    console.log(`  ⚠️  Generated ${successCount}/${pages.length} pages`);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  return successCount === pages.length;
}

// Run
const success = main();
process.exit(success ? 0 : 1);
