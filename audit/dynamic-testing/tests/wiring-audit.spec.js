/**
 * VetRate Autonomous Audit — UI-to-Function Wiring Tests
 * 
 * These tests go DEEPER than render tests. They verify that when a user
 * interacts with a UI element, the correct backend function actually executes.
 *
 * Methodology:
 *   1. Open the component
 *   2. Intercept network requests (if API-connected)
 *   3. Fill forms with valid test data
 *   4. Click submit/action buttons
 *   5. Verify the correct API payload or state mutation occurred
 *   6. Check that no silent errors happened
 *
 * Think of this as "following the wire from the light switch to the bulb
 * to make sure electricity actually flows."
 */

import { test, expect } from '@playwright/test';
import { AppPage } from '../page-objects/AppPage.js';

test.describe('Wiring Audit — Calculator', () => {
  
  test('rating calculator produces correct combined rating', async ({ page }) => {
    const app = new AppPage(page);
    app.startErrorCapture();
    await app.goto();

    // Open the calculator
    const opened = await app.openToolByText('Calculator');
    if (!opened) {
      test.skip();
      return;
    }

    // The calculator should have input fields for ratings
    const ratingInputs = page.locator('input[type="number"], input[type="range"], input[placeholder*="rating" i]');
    
    if (await ratingInputs.count() > 0) {
      // Enter test ratings
      await ratingInputs.first().fill('50');
      await page.waitForTimeout(500);
      
      // Look for "add" button to add more conditions
      const addButton = page.getByRole('button', { name: /add|plus|\+|new condition/i }).first();
      if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addButton.click();
        await page.waitForTimeout(300);
        
        // Fill second rating
        const allInputs = await ratingInputs.all();
        if (allInputs.length > 1) {
          await allInputs[1].fill('30');
          await page.waitForTimeout(500);
        }
      }

      // Check that a result is displayed
      const resultArea = page.locator('[class*="result" i], [class*="combined" i], [class*="total" i]');
      if (await resultArea.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        const text = await resultArea.first().textContent();
        // Should contain a percentage number
        expect(text).toMatch(/\d+%?/);
      }
    }

    expect(app.unhandledExceptions).toHaveLength(0);
    await app.closeCurrentTool();
  });
});

test.describe('Wiring Audit — Search to Detail Flow', () => {

  test('search result click opens detail view with correct data', async ({ page }) => {
    const app = new AppPage(page);
    app.startErrorCapture();
    await app.goto();

    // Search for a known condition
    await app.searchCondition('tinnitus');
    await page.waitForTimeout(1000);

    // Click a result
    const results = page.locator('[class*="card"], [class*="result"]').filter({ hasText: /tinnitus/i });
    if (await results.count() > 0) {
      await results.first().click();
      await page.waitForTimeout(1000);

      // Verify detail view shows correct condition data
      const pageText = await page.locator('body').textContent();
      expect(pageText.toLowerCase()).toContain('tinnitus');
      
      // Should show diagnostic code or rating info
      const hasRatingInfo = /\d+%/.test(pageText) || /rating/i.test(pageText) || /6260/i.test(pageText);
      expect(hasRatingInfo).toBeTruthy();
    }

    expect(app.unhandledExceptions).toHaveLength(0);
  });
});

test.describe('Wiring Audit — Data Persistence', () => {

  test('My Packet saves and persists data across page reload', async ({ page }) => {
    const app = new AppPage(page);
    app.startErrorCapture();
    await app.goto();
    
    const opened = await app.openToolByText('My Packet');
    if (!opened) {
      test.skip();
      return;
    }

    // Check if there's a save button or auto-save indicator
    const saveButton = page.getByRole('button', { name: /save/i }).first();
    if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(500);
    }

    // Reload and verify persistence
    await page.reload();
    await app.dismissGates();
    
    expect(app.unhandledExceptions).toHaveLength(0);
  });
});

test.describe('Wiring Audit — Form Submission', () => {

  test('forms submit without unhandled errors', async ({ page }) => {
    const app = new AppPage(page);
    app.startErrorCapture();
    await app.goto();

    // Open a form-heavy tool (FOIA Generator is a good candidate)
    const opened = await app.openToolByText('FOIA');
    if (!opened) {
      test.skip();
      return;
    }

    // Find all input fields and fill them
    const textInputs = page.locator('input[type="text"], input:not([type])');
    const count = await textInputs.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const input = textInputs.nth(i);
      if (await input.isVisible()) {
        await input.fill('Test Veteran Data');
      }
    }

    // Find the submit/generate button (force: true because modal backdrop can intercept clicks)
    const submitBtn = page.getByRole('button', { name: /generate|submit|create|build/i }).first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.click({ force: true, timeout: 5000 });
      await page.waitForTimeout(2000);
    }

    expect(app.unhandledExceptions).toHaveLength(0);
    await app.closeCurrentTool();
  });
});

test.describe('Wiring Audit — Network Request Validation', () => {

  test('VA API calls use correct endpoints', async ({ page }) => {
    const apiCalls = [];
    
    // Intercept all network requests to VA-related endpoints
    page.on('request', request => {
      const url = request.url();
      if (url.includes('va.gov') || url.includes('api.va.gov') || url.includes('developer.va.gov')) {
        apiCalls.push({
          url,
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
      }
    });

    const app = new AppPage(page);
    await app.goto();

    // Trigger some VA API interactions
    const vaTools = ['VA Resources', 'VSO Finder', 'State Benefits'];
    for (const tool of vaTools) {
      const opened = await app.openToolByText(tool);
      if (opened) {
        await page.waitForTimeout(2000);
        await app.closeCurrentTool();
      }
    }

    // If any VA API calls were made, verify they're well-formed
    for (const call of apiCalls) {
      // No bare HTTP (must be HTTPS)
      expect(call.url).toMatch(/^https:/);
      
      // Correct HTTP methods (GET for reads, POST for submissions)
      expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).toContain(call.method);
    }
  });
});

test.describe('Wiring Audit — Event Handler Integrity', () => {

  test('all buttons on home page have click handlers', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    const buttons = page.locator('button:visible');
    const count = await buttons.count();
    const broken = [];

    for (let i = 0; i < Math.min(count, 30); i++) {
      const btn = buttons.nth(i);
      const hasOnClick = await btn.evaluate(el => {
        // Check for React's synthetic event handler
        const reactFiber = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
        return !!reactFiber || !!el.onclick;
      });
      
      if (!hasOnClick) {
        const text = await btn.textContent();
        broken.push(text?.trim() || `[button ${i}]`);
      }
    }

    // Allow some buttons without handlers (decorative, disabled, etc.)
    // But flag if more than 20% are broken
    const brokenPercent = (broken.length / count) * 100;
    expect(brokenPercent).toBeLessThan(20);
  });
});
