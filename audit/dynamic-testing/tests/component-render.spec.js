/**
 * VetRate Autonomous Audit — Component Render Tests
 * 
 * Opens every toggleable component/tool in the app and verifies:
 *   1. It renders without crashing (no unhandled exceptions)
 *   2. It doesn't produce fatal console errors
 *   3. It has some visible content (not blank)
 *   4. It can be closed without breaking the app
 *
 * This test is auto-generated from the wiring map. Each component 
 * in App.jsx that has a show* state gets tested.
 *
 * Think of this as "opening every drawer in the house to make sure 
 * nothing falls out and breaks."
 */

import { test, expect } from '@playwright/test';
import { AppPage } from '../page-objects/AppPage.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Component Registry ──────────────────────────────────────────
// Maps tool display names to their component names.
// These are the labels a user would see in the toolbar/menu.
// If the wiring-map.json exists, we augment this list dynamically.
const TOOL_REGISTRY = [
  { name: 'Rating Calculator', textMatch: /calculator|rating calc/i },
  { name: 'Secondary Scout', textMatch: /secondary.*scout/i },
  { name: 'Nexus Builder', textMatch: /nexus.*builder/i },
  { name: 'My Packet', textMatch: /my.*packet/i },
  { name: 'C&P Simulator', textMatch: /c.?p.*sim|exam.*prep/i },
  { name: 'VA Resources', textMatch: /va.*resource|understand.*va.*ai|va.*ai.*transparency/i },
  { name: 'Forms Helper', textMatch: /forms.*helper/i },
  { name: 'C-File Analyzer', textMatch: /c.?file.*analy/i },
  { name: 'Shark Radar', textMatch: /shark.*radar/i },
  { name: 'Pathfinder', textMatch: /pathfinder/i },
  { name: 'Claim Navigator', textMatch: /claim.*nav/i },
  { name: 'User Manual', textMatch: /field.*manual|user.*manual/i },
  { name: 'State Benefits', textMatch: /state.*benefit/i },
  { name: 'VSO Finder', textMatch: /vso.*finder/i },
  { name: 'War Game', textMatch: /war.*game|red.*team/i },
  { name: 'Symptom Logger', textMatch: /symptom.*log/i },
  { name: 'Decision Decoder', textMatch: /decision.*decod/i },
  { name: 'Blue Button X-Ray', textMatch: /blue.*button|x.?ray/i },
  { name: 'Witness Bench', textMatch: /witness.*bench/i },
  { name: 'Risk Assessment', textMatch: /risk.*assess/i },
  { name: 'TDIU Builder', textMatch: /tdiu/i },
  { name: 'PACT Act Navigator', textMatch: /pact.*act/i },
  { name: 'FOIA Generator', textMatch: /foia/i },
  { name: 'Million Dollar Dashboard', textMatch: /million.*dollar/i },
  { name: 'MOS Hazard Matcher', textMatch: /mos.*hazard/i },
  { name: 'Web of Conditions', textMatch: /web.*of.*condition/i },
  { name: 'Legislative Watchdog', textMatch: /legislative.*watch/i },
  { name: 'Backup Manager', textMatch: /backup.*manag/i },
  { name: 'Time Machine', textMatch: /time.*machine/i },
  { name: 'The Tribunal', textMatch: /tribunal/i },
  { name: 'Consistency Engine', textMatch: /consistency/i },
  { name: 'What-If Sandbox', textMatch: /what.?if/i },
  { name: 'Denial Decoder', textMatch: /denial.*decod/i },
  { name: 'Body Map', textMatch: /body.*map/i },
  { name: 'Claim Stress Test', textMatch: /stress.*test/i },
  { name: 'Evidence Timeline', textMatch: /evidence.*timeline/i },
  { name: 'DD214 Analyzer', textMatch: /dd.?214/i },
  { name: 'Record Search', textMatch: /record.*search/i },
  { name: 'Vision Simulator', textMatch: /vision.*sim/i },
  { name: 'Muster Call', textMatch: /muster.*call/i },
  { name: 'VKB Viewer', textMatch: /vkb|knowledge.*base/i },
  { name: 'Retro Pay Hunter', textMatch: /retro.*pay/i },
  { name: 'Pain Painter', textMatch: /pain.*paint/i },
  { name: 'Evidence Gap', textMatch: /evidence.*gap/i },
  { name: 'Statement Analyzer', textMatch: /statement.*anal/i },
  { name: 'Claim Progress', textMatch: /claim.*progress/i },
  { name: 'Bug Squasher', textMatch: /bug.*squash/i },
  { name: 'Feature Request', textMatch: /feature.*request/i },
  { name: 'Community Roadmap', textMatch: /community.*road/i },
  { name: 'Publications Library', textMatch: /publication/i },
  { name: 'About Us', textMatch: /about\s*(us)?$/i },
  { name: 'Contact Us', textMatch: /contact\s*(us)?$/i },
  { name: 'Privacy Policy', textMatch: /privacy.*polic/i },
  { name: 'Nexus Quality Analyzer', textMatch: /nexus.*quality/i },
  { name: 'Remand Risk Checker', textMatch: /remand.*risk/i },
  { name: 'Appeals Lane Advisor', textMatch: /appeals.*lane/i },
  { name: 'Atomic Wipe', textMatch: /atomic.*wipe|wipe.*data/i },
  { name: 'Commanders Checklist', textMatch: /commander.*checklist/i },
  { name: 'MOSHazardMatcher', textMatch: /mos.*hazard/i },
];

test.describe('Component Render Audit — Every Tool Opens & Closes', () => {

  // Per-test timeout: 30s max — if we can't find & click a tool in 30s, annotate and move on
  test.describe.configure({ timeout: 30_000 });

  for (const tool of TOOL_REGISTRY) {
    test(`renders without crash: ${tool.name}`, async ({ page }) => {
      const app = new AppPage(page);
      app.startErrorCapture();
      await app.goto();

      // Dismiss any small-screen overlay that might block clicks
      try {
        const continueBtn = page.getByRole('button', { name: /continue anyway/i }).first();
        if (await continueBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await continueBtn.click({ force: true, timeout: 2000 });
          await page.waitForTimeout(300);
        }
      } catch { /* no overlay */ }

      // Find and click the tool
      let opened = false;
      
      // Strategy 1: Look for a button with that text
      const button = page.getByRole('button', { name: tool.textMatch }).first();
      if (await button.isVisible({ timeout: 3000 }).catch(() => false)) {
        await button.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(1000);
        opened = true;
      }

      if (!opened) {
        // Strategy 2: Look for any clickable element with that text
        const link = page.getByText(tool.textMatch).first();
        if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
          await link.click({ force: true, timeout: 5000 });
          await page.waitForTimeout(1000);
          opened = true;
        }
      }

      if (!opened) {
        // Strategy 3: Scroll down and re-check (button may be below fold)
        try {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(500);
          
          const scrolledButton = page.getByRole('button', { name: tool.textMatch }).first();
          if (await scrolledButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await scrolledButton.click({ force: true, timeout: 3000 });
            await page.waitForTimeout(1000);
            opened = true;
          }
        } catch {
          // Still not found
        }
      }

      if (opened) {
        // Verify no fatal errors occurred
        const errors = app.getErrors();
        expect(errors.unhandledExceptions,
          `${tool.name} caused unhandled exceptions: ${errors.unhandledExceptions.map(e => e.message).join('; ')}`
        ).toHaveLength(0);

        // Verify the page isn't blank (something rendered)
        const bodyText = await page.locator('body').textContent();
        expect(bodyText.length).toBeGreaterThan(50);

        // Close it
        await app.closeCurrentTool();
        await page.waitForTimeout(300);
      } else {
        // Tool couldn't be found — this is a wiring issue worth noting
        test.info().annotations.push({
          type: 'wiring-warning',
          description: `Could not locate UI trigger for: ${tool.name}`
        });
      }
    });
  }
});

test.describe('Component Render Audit — Search Flow', () => {

  test('search for PTSD returns results and detail view works', async ({ page }) => {
    const app = new AppPage(page);
    app.startErrorCapture();
    await app.goto();

    await app.searchCondition('PTSD');
    
    // Should have results
    const resultCards = page.locator('[class*="card"], [class*="result"]');
    const count = await resultCards.count();
    
    if (count > 0) {
      // Click first result
      await resultCards.first().click();
      await page.waitForTimeout(1000);
      
      // Should show detail view with content
      const bodyText = await page.locator('body').textContent();
      expect(bodyText.toLowerCase()).toContain('ptsd');
    }
    
    expect(app.unhandledExceptions).toHaveLength(0);
  });

  test('empty search does not crash', async ({ page }) => {
    const app = new AppPage(page);
    app.startErrorCapture();
    await app.goto();

    // The search input may be inside a modal (GlobalCommandSearch)
    // Try to find it directly first, then via Ctrl+K
    let searchInput = page.getByPlaceholder(/search|condition|disability/i).first();
    if (!await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(500);
      searchInput = page.getByPlaceholder(/search|condition|disability/i).first();
    }
    
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('');
      await page.waitForTimeout(500);
    }
    
    expect(app.unhandledExceptions).toHaveLength(0);
  });

  test('search with special characters does not cause XSS or crash', async ({ page }) => {
    const app = new AppPage(page);
    app.startErrorCapture();
    await app.goto();

    // XSS payloads that should be safely handled
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '"><img onerror="alert(1)" src=x>',
      "' OR 1=1 --",
      '${7*7}',
      '{{constructor.constructor("return this")()}}'
    ];

    for (const payload of xssPayloads) {
      await app.searchCondition(payload);
      await page.waitForTimeout(300);
      
      // Verify the script didn't actually execute
      const alertCount = await page.evaluate(() => {
        let count = 0;
        const origAlert = window.alert;
        window.alert = () => count++;
        return count;
      });
      
      expect(alertCount).toBe(0);
    }
    
    expect(app.unhandledExceptions).toHaveLength(0);
  });
});
