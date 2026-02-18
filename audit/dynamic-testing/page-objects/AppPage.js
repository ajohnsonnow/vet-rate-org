/**
 * VetRate Page Object Model — Main Application Page
 * 
 * This is the "remote control" for the VetRate app during automated testing.
 * Instead of scattering CSS selectors across every test file, we centralize
 * all UI interactions here. If a button moves or gets renamed, we fix it
 * in ONE place.
 * 
 * Design principle: Use role-based and text-based locators wherever possible.
 * These are resilient to CSS/classname changes and match how real users find things.
 */

export class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // ─── Core Navigation ────────────────────────────────
    this.header = page.locator('header').first();
    this.searchBar = page.getByPlaceholder(/search|condition/i);
    this.searchButton = page.getByRole('button', { name: /search/i });
    
    // ─── Disclaimer / TOS Gate ──────────────────────────
    this.disclaimerModal = page.locator('[class*="disclaimer"], [data-testid="disclaimer"]');
    this.disclaimerAcceptButton = page.getByRole('button', { name: /accept|acknowledge|understand|agree|continue/i });
    this.tosAcceptButton = page.getByRole('button', { name: /accept|agree|i understand/i });
    
    // ─── Console Error Tracker ──────────────────────────
    this.consoleErrors = [];
    this.networkFailures = [];
    this.unhandledExceptions = [];
  }

  // ─── Lifecycle Methods ──────────────────────────────────
  
  /**
   * Navigate to the app with all gate modals pre-bypassed.
   * 
   * Instead of clicking through the DisclaimerSplash (1.5s) and TOS countdown
   * (3-6s), we pre-seed localStorage keys BEFORE navigation so those components
   * short-circuit and never render.  This is 10x faster and bulletproof in
   * headless mode where countdown timers can be unreliable.
   * 
   * Keys we set:
   *   vetrate_disclaimer-acknowledged → DisclaimerSplash reads this via getStorageKey()
   *   vet-rate-tos-accepted           → TermsOfServiceModal reads this directly
   */
  async goto() {
    // Pre-seed localStorage so the disclaimer + TOS gates never appear
    await this.page.addInitScript(() => {
      localStorage.setItem('vetrate_disclaimer-acknowledged', 'true');
      localStorage.setItem('vet-rate-tos-accepted', 'true');
      localStorage.setItem('vet-rate-tos-accepted-date', new Date().toISOString());
      // Prevent "What's New" modal (version key)
      localStorage.setItem('vet_rate_last_seen_version', '1.19.4');
      // Prevent BootCampTour
      localStorage.setItem('vetrate-tour-completed', 'true');
    });

    await this.page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Brief settle for React hydration
    await this.page.waitForTimeout(1500);

    // Dismiss any remaining overlay (e.g., What's New modal)
    await this.dismissRemainingModals();
  }

  /**
   * Close any non-gate modals that may pop up after load
   * (What's New, announcements, etc.)
   * 
   * Important: We avoid matching notification banner "Dismiss" buttons
   * (like VA Status or Mobile-Optimized notices) because on narrow
   * viewports they may be obscured, causing Playwright's click() to
   * wait indefinitely for actionability.
   */
  async dismissRemainingModals() {
    try {
      // Target only true overlay modals, not inline notification banners
      const closeBtn = this.page.getByRole('button', { name: /^close$|got it|×|✕/i }).first();
      if (await closeBtn.isVisible({ timeout: 2000 })) {
        await closeBtn.click({ timeout: 3000 });
        await this.page.waitForTimeout(300);
      }
    } catch {
      // No lingering modal — that's fine
    }
  }

  /** Alias for backward compat — gates are now bypassed via localStorage */
  async dismissGates() {
    await this.dismissRemainingModals();
  }

  /** Start capturing all console errors and network failures */
  startErrorCapture() {
    this.consoleErrors = [];
    this.networkFailures = [];
    this.unhandledExceptions = [];

    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.page.on('pageerror', error => {
      this.unhandledExceptions.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    this.page.on('requestfailed', request => {
      this.networkFailures.push({
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText,
        timestamp: new Date().toISOString()
      });
    });
  }

  /** Get all captured errors */
  getErrors() {
    return {
      consoleErrors: this.consoleErrors,
      networkFailures: this.networkFailures,
      unhandledExceptions: this.unhandledExceptions,
      totalErrors: this.consoleErrors.length + this.networkFailures.length + this.unhandledExceptions.length
    };
  }

  // ─── Search Functionality ───────────────────────────────

  /** Search for a condition — handles both inline and modal search */
  async searchCondition(term) {
    // Try the inline search bar first
    let filled = false;
    if (await this.searchBar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.searchBar.fill(term);
      filled = true;
    }
    
    // If inline search isn't visible, try opening via Ctrl+K
    if (!filled) {
      await this.page.keyboard.press('Control+k');
      await this.page.waitForTimeout(500);
      const modalInput = this.page.getByPlaceholder(/search|condition|disability/i).first();
      if (await modalInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await modalInput.fill(term);
        filled = true;
      }
    }
    
    // Click search button only if it exists and is visible
    if (filled && await this.searchButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await this.searchButton.click({ force: true, timeout: 3000 });
    }
    
    await this.page.waitForTimeout(500);
  }

  /** Get search results count */
  async getSearchResultCount() {
    const results = this.page.locator('[class*="result"], [data-testid*="result"]');
    return await results.count();
  }

  /** Click the first search result */
  async clickFirstResult() {
    const firstResult = this.page.locator('[class*="result"], [data-testid*="result"]').first();
    await firstResult.click();
    await this.page.waitForTimeout(500);
  }

  // ─── Component Navigation ──────────────────────────────
  // Each method opens a specific tool/component

  /** Find and click a tool button by its text label */
  async openToolByText(toolName) {
    // Try multiple strategies to find the tool
    const strategies = [
      () => this.page.getByRole('button', { name: new RegExp(toolName, 'i') }),
      () => this.page.getByText(new RegExp(toolName, 'i'), { exact: false }),
      () => this.page.locator(`[aria-label*="${toolName}" i]`),
      () => this.page.locator(`button:has-text("${toolName}")`),
    ];

    for (const strategy of strategies) {
      try {
        const locator = strategy();
        if (await locator.first().isVisible({ timeout: 2000 })) {
          await locator.first().click({ force: true, timeout: 3000 });
          await this.page.waitForTimeout(500);
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  }

  /** Close the currently open modal/overlay */
  async closeCurrentTool() {
    const strategies = [
      () => this.page.getByRole('button', { name: /close|back|×|✕/i }),
      () => this.page.locator('[class*="close"]'),
      () => this.page.locator('button:has-text("×")'),
      () => this.page.locator('button:has-text("✕")'),
    ];

    for (const strategy of strategies) {
      try {
        const locator = strategy();
        if (await locator.first().isVisible({ timeout: 1000 })) {
          await locator.first().click({ force: true, timeout: 3000 });
          await this.page.waitForTimeout(300);
          return true;
        }
      } catch {
        continue;
      }
    }
    
    // Escape key fallback
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
    return true;
  }

  // ─── Assertions ─────────────────────────────────────────

  /** Verify the app loaded without fatal errors */
  async verifyAppLoaded() {
    // Try header first, then any main content as fallback
    try {
      await this.header.waitFor({ state: 'visible', timeout: 15_000 });
    } catch {
      // Fallback: look for any substantive content (h1, main, search input, buttons)
      const fallbacks = [
        this.page.locator('h1').first(),
        this.page.locator('main').first(),
        this.page.getByRole('heading').first(),
        this.searchBar
      ];
      let found = false;
      for (const locator of fallbacks) {
        try {
          if (await locator.isVisible({ timeout: 3000 })) {
            found = true;
            break;
          }
        } catch { continue; }
      }
      if (!found) {
        throw new Error('App did not load — no header, heading, or main content found within 15s');
      }
    }
  }

  /** Verify no unhandled exceptions occurred */
  hasNoFatalErrors() {
    return this.unhandledExceptions.length === 0;
  }

  /** Verify no network requests failed */
  hasNoNetworkFailures() {
    // Filter out expected failures (external APIs that may be down)
    const realFailures = this.networkFailures.filter(f => 
      !f.url.includes('goatcounter.com') &&
      !f.url.includes('google-analytics') &&
      !f.url.includes('analytics')
    );
    return realFailures.length === 0;
  }

  // ─── Accessibility ──────────────────────────────────────

  /** Get basic accessibility metrics */
  async getA11ySnapshot() {
    const snapshot = await this.page.accessibility.snapshot();
    return snapshot;
  }

  /** Check for images without alt text */
  async checkImagesHaveAlt() {
    const images = this.page.locator('img');
    const count = await images.count();
    const missing = [];
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const src = await img.getAttribute('src');
      if (!alt && alt !== '') {
        missing.push(src);
      }
    }
    
    return { total: count, missingAlt: missing };
  }

  /** Check for buttons without accessible labels */
  async checkButtonsHaveLabels() {
    const buttons = this.page.locator('button');
    const count = await buttons.count();
    const unlabeled = [];
    
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');
      
      if (!text?.trim() && !ariaLabel && !title) {
        unlabeled.push({
          index: i,
          html: await btn.evaluate(el => el.outerHTML.substring(0, 200))
        });
      }
    }
    
    return { total: count, unlabeled };
  }
}
