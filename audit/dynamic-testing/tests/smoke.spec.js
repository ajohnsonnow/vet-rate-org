/**
 * VetRate Autonomous Audit — Smoke Tests
 * 
 * The most basic "is the building still standing?" tests.
 * These verify that:
 *   1. The app loads without crashing
 *   2. No unhandled JavaScript exceptions fire
 *   3. No critical network requests fail
 *   4. The DOM reaches a usable state
 *   5. Core page elements render
 *
 * If these fail, nothing else matters — fix the smoke first.
 */

import { test, expect } from '@playwright/test';
import { AppPage } from '../page-objects/AppPage.js';

test.describe('Smoke Tests — App Health Check', () => {

  test('app loads without fatal JavaScript errors', async ({ page }) => {
    const app = new AppPage(page);
    app.startErrorCapture();
    
    await app.goto();
    await app.verifyAppLoaded();
    
    // Allow 2 seconds for async initialization
    await page.waitForTimeout(2000);
    
    const errors = app.getErrors();
    
    // No unhandled exceptions (these are crashes)
    expect(errors.unhandledExceptions, 
      `Found ${errors.unhandledExceptions.length} unhandled exceptions: ` +
      errors.unhandledExceptions.map(e => e.message).join('; ')
    ).toHaveLength(0);
  });

  test('app renders header and navigation', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    
    // Header should exist
    await expect(app.header).toBeVisible();
    
    // There should be at least some interactive elements
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(5);
  });

  test('no critical network failures on initial load', async ({ page }) => {
    const app = new AppPage(page);
    app.startErrorCapture();
    
    await app.goto();
    await page.waitForTimeout(2000);
    
    // Filter to critical failures only (internal resources)
    const criticalFailures = app.networkFailures.filter(f => 
      f.url.includes('localhost') || f.url.includes('vet-rate')
    );
    
    expect(criticalFailures, 
      `Critical network failures: ${criticalFailures.map(f => f.url).join(', ')}`
    ).toHaveLength(0);
  });

  test('page title is set correctly', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title).toMatch(/vet.rate|supply.locker|va.*claims/i);
  });

  test('no broken images on initial load', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    
    const images = page.locator('img');
    const count = await images.count();
    
    const broken = [];
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const naturalWidth = await img.evaluate(el => el.naturalWidth);
      const src = await img.getAttribute('src');
      if (naturalWidth === 0 && src) {
        broken.push(src);
      }
    }
    
    expect(broken, `Broken images: ${broken.join(', ')}`).toHaveLength(0);
  });

  test('localStorage is accessible (privacy compliance)', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    
    // Verify localStorage works (app depends on it for all data persistence)
    const canUseStorage = await page.evaluate(() => {
      try {
        localStorage.setItem('__audit_test__', 'ok');
        localStorage.removeItem('__audit_test__');
        return true;
      } catch {
        return false;
      }
    });
    
    expect(canUseStorage).toBe(true);
  });

  test('search bar is functional and accepts input', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    
    // Find search input
    const searchInput = page.getByPlaceholder(/search|condition|disability/i).first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('PTSD');
      const value = await searchInput.inputValue();
      expect(value).toBe('PTSD');
    }
  });

  test('dark mode toggle does not crash the app', async ({ page }) => {
    const app = new AppPage(page);
    app.startErrorCapture();
    await app.goto();
    
    // Look for theme/dark mode toggle
    const darkModeToggle = page.locator('button:has-text("dark"), button:has-text("theme"), [aria-label*="dark" i], [aria-label*="theme" i]').first();
    
    if (await darkModeToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await darkModeToggle.click();
      await page.waitForTimeout(500);
      
      expect(app.unhandledExceptions).toHaveLength(0);
    }
  });
});

test.describe('Smoke Tests — Responsive Design', () => {

  test('app renders on mobile viewport without crash', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const app = new AppPage(page);
    app.startErrorCapture();
    
    await app.goto();
    
    expect(app.unhandledExceptions).toHaveLength(0);
  });

  test('app renders on tablet viewport without crash', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const app = new AppPage(page);
    app.startErrorCapture();
    
    await app.goto();
    
    expect(app.unhandledExceptions).toHaveLength(0);
  });
});
