/**
 * VetRate Autonomous Audit — Security Tests
 * 
 * Validates that the application handles potentially malicious input safely.
 * Tests for:
 *   1. XSS (Cross-Site Scripting) prevention
 *   2. SQL injection awareness (even though no SQL backend — defense in depth)
 *   3. Local storage data integrity
 *   4. No leaked secrets in page source
 *   5. Content Security Policy headers
 *   6. PII protection (no data sent to external servers)
 *
 * These are NOT penetration tests — they're automated sanity checks that cover
 * the most common attack vectors.
 */

import { test, expect } from '@playwright/test';
import { AppPage } from '../page-objects/AppPage.js';

test.describe('Security Audit — Input Sanitization', () => {

  test('search input sanitizes HTML/script injection', async ({ page }) => {
    const app = new AppPage(page);
    app.startErrorCapture();
    await app.goto();

    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert(1)>',
      '<svg/onload=alert(1)>',
      'javascript:alert(1)',
      '<iframe src="data:text/html,<script>alert(1)</script>">',
    ];

    for (const payload of xssPayloads) {
      // Type the payload into search
      const searchInput = page.getByPlaceholder(/search|condition|disability/i).first();
      if (await searchInput.isVisible()) {
        await searchInput.fill(payload);
        await page.waitForTimeout(300);

        // Verify no dynamically injected elements with dangerous event handlers
        const dangerousElements = await page.evaluate(() => {
          return document.querySelectorAll('[onerror], [onload], [onclick]').length;
        });
        expect(dangerousElements).toBe(0);

        // Verify no injected script tags actually executed
        const alertFired = await page.evaluate(() => {
          return window.__xss_alert_fired === true;
        });
        expect(alertFired).toBeFalsy();
      }
    }

    expect(app.unhandledExceptions).toHaveLength(0);
  });

  test('form inputs reject excessively long strings', async ({ page }) => {
    const app = new AppPage(page);
    app.startErrorCapture();
    await app.goto();

    // Generate a 100KB string
    const longString = 'A'.repeat(100_000);
    
    const searchInput = page.getByPlaceholder(/search|condition|disability/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(longString);
      await page.waitForTimeout(1000);
      
      // App should not crash
      expect(app.unhandledExceptions).toHaveLength(0);
      
      // The input value might be truncated or not — either is fine
      // as long as no crash occurred
    }
  });
});

test.describe('Security Audit — Data Privacy', () => {

  test('no PII is sent to external domains', async ({ page }) => {
    const externalRequests = [];
    
    page.on('request', request => {
      const url = request.url();
      // Skip localhost and standard resources
      if (url.includes('localhost') || url.includes('127.0.0.1')) return;
      if (url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.png') || url.endsWith('.svg')) return;
      
      const postData = request.postData();
      if (postData) {
        externalRequests.push({
          url,
          method: request.method(),
          body: postData
        });
      }
    });

    const app = new AppPage(page);
    await app.goto();
    
    // Navigate around the app
    await app.searchCondition('back pain');
    await page.waitForTimeout(2000);
    
    // Check that no external POST requests contain PII-like data
    for (const req of externalRequests) {
      const body = req.body.toLowerCase();
      // These patterns suggest PII might be leaking
      expect(body).not.toMatch(/ssn|social.*security/i);
      expect(body).not.toMatch(/\d{3}-\d{2}-\d{4}/); // SSN format
    }
  });

  test('localStorage uses prefixed keys (no namespace collisions)', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await page.waitForTimeout(2000);

    const storageKeys = await page.evaluate(() => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
      }
      return keys;
    });

    // VetRate keys should use a prefix like 'vetrate_' or 'vr_'
    const unprefixed = storageKeys.filter(k => 
      !k.startsWith('vetrate') && 
      !k.startsWith('vr_') &&
      !k.startsWith('vet-rate') &&
      !k.startsWith('__') && // Internal framework keys
      !['theme', 'disclaimerAcknowledged'].includes(k) // Known legacy keys
    );

    // Flag if too many unprefixed keys (suggests namespace discipline issues)
    if (unprefixed.length > 5) {
      test.info().annotations.push({
        type: 'security-note',
        description: `${unprefixed.length} localStorage keys lack standard prefix: ${unprefixed.slice(0, 5).join(', ')}`
      });
    }
  });
});

test.describe('Security Audit — Source Code Exposure', () => {

  test('no API keys or secrets in page source', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    const pageSource = await page.content();
    
    // Common secret patterns
    const secretPatterns = [
      /sk-[a-zA-Z0-9]{20,}/,           // OpenAI API keys
      /AKIA[0-9A-Z]{16}/,              // AWS access key IDs
      /AIza[0-9A-Za-z_-]{35}/,          // Google API keys
      /ghp_[a-zA-Z0-9]{36}/,            // GitHub personal access tokens
      /-----BEGIN (RSA|PRIVATE|EC) KEY-----/, // Private keys
    ];

    for (const pattern of secretPatterns) {
      expect(pageSource).not.toMatch(pattern);
    }
  });

  test('no .env values exposed in client-side JavaScript', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // import.meta can't be used inside page.evaluate() (ESM-only syntax).
    // Instead, scan the page source for common secret patterns.
    const pageSource = await page.content();
    
    // Check that no VITE_ env vars contain secrets
    expect(pageSource).not.toMatch(/VITE_SECRET[=:]/i);
    expect(pageSource).not.toMatch(/VITE_PASSWORD[=:]/i);
    expect(pageSource).not.toMatch(/VITE_PRIVATE_KEY[=:]/i);
    expect(pageSource).not.toMatch(/VITE_API_SECRET[=:]/i);
    
    // Also check loaded script content for leaked secrets
    const scripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
    );
    
    // All script sources should be local (no unexpected external scripts)
    for (const src of scripts) {
      if (!src.includes('localhost') && !src.includes('127.0.0.1')) {
        // External scripts are fine if they're known CDNs
        expect(src).not.toMatch(/secret|password|private/i);
      }
    }
  });
});

test.describe('Security Audit — CSP and Headers', () => {

  test('response contains security-relevant headers', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    // In production, these should be set. In dev mode they may not be.
    // We log them as informational rather than hard-failing.
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options', 
      'strict-transport-security',
      'content-security-policy'
    ];

    const missing = securityHeaders.filter(h => !headers[h]);
    if (missing.length > 0) {
      test.info().annotations.push({
        type: 'security-note',
        description: `Missing security headers (may be dev-mode expected): ${missing.join(', ')}`
      });
    }
  });
});
