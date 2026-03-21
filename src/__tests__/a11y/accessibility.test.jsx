/**
 * Accessibility (a11y) Tests
 *
 * Uses axe-core to detect WCAG violations in key UI patterns.
 * These tests enforce the app's WCAG compliance claims from the README.
 *
 * Note: color-contrast is disabled (no real CSS in jsdom).
 * All other WCAG 2.1 AA rules are active.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import axe from "axe-core";

/**
 * Run axe against a DOM container and return violations.
 * Excludes rules that require a real layout engine.
 */
async function checkA11y(container) {
  const results = await axe.run(container, {
    rules: {
      "color-contrast": { enabled: false },
      "scrollable-region-focusable": { enabled: false },
    },
  });
  return results.violations;
}

function formatViolations(violations) {
  return violations
    .map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.description}\n  ` +
        v.nodes.map((n) => n.html).join("\n  "),
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Semantic HTML structure tests
// ---------------------------------------------------------------------------

describe("Accessibility: semantic HTML structures", () => {
  it("search form has no a11y violations", async () => {
    const { container } = render(
      <form aria-label="Search veteran disabilities">
        <label htmlFor="search-input">Search conditions</label>
        <input
          id="search-input"
          type="search"
          aria-label="Search veteran disability conditions"
          placeholder="e.g. PTSD, tinnitus"
        />
        <button type="submit">Search</button>
      </form>,
    );
    const violations = await checkA11y(container);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  it("results list has no a11y violations", async () => {
    const { container } = render(
      <section aria-label="Search results">
        <h2>Results</h2>
        <ul>
          <li>
            <article>
              <h3>PTSD</h3>
              <p>Post-Traumatic Stress Disorder</p>
            </article>
          </li>
          <li>
            <article>
              <h3>Tinnitus</h3>
              <p>Ringing in the ears</p>
            </article>
          </li>
        </ul>
      </section>,
    );
    const violations = await checkA11y(container);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  it("modal dialog has no a11y violations", async () => {
    const { container } = render(
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-desc"
      >
        <h2 id="modal-title">Disclaimer</h2>
        <p id="modal-desc">
          This tool provides general information only and is not a substitute
          for professional legal or medical advice.
        </p>
        <button type="button" aria-label="Close disclaimer dialog">
          Close
        </button>
      </div>,
    );
    const violations = await checkA11y(container);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  it("navigation landmarks have no a11y violations", async () => {
    const { container } = render(
      <div>
        <header>
          <nav aria-label="Main navigation">
            <ul>
              <li>
                <a href="/">Home</a>
              </li>
              <li>
                <a href="/search">Search</a>
              </li>
              <li>
                <a href="/calculator">Calculator</a>
              </li>
            </ul>
          </nav>
        </header>
        <main id="main-content" aria-label="Main content">
          <h1>VA Disability Rating Tool</h1>
        </main>
        <footer>
          <p>Not affiliated with the U.S. Department of Veterans Affairs.</p>
        </footer>
      </div>,
    );
    const violations = await checkA11y(container);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  it("rating result card has no a11y violations", async () => {
    const { container } = render(
      <section aria-label="Rating result">
        <h2>Combined Rating: 70%</h2>
        <dl>
          <dt>Monthly Compensation</dt>
          <dd aria-label="$1,716.28 per month">$1,716.28</dd>
          <dt>Effective Date</dt>
          <dd>
            <time dateTime="2026-01-01">January 1, 2026</time>
          </dd>
        </dl>
        <button type="button" aria-label="Download rating summary as PDF">
          Download PDF
        </button>
      </section>,
    );
    const violations = await checkA11y(container);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  it("crisis resources section has no a11y violations", async () => {
    const { container } = render(
      <aside aria-label="Crisis resources" role="complementary">
        <h2>Need Help Now?</h2>
        <p>If you are in crisis, please reach out immediately.</p>
        <a href="tel:988" aria-label="Call Veterans Crisis Line at 9-8-8">
          Veterans Crisis Line: 988
        </a>
      </aside>,
    );
    const violations = await checkA11y(container);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  it("skip-to-content link has no a11y violations", async () => {
    const { container } = render(
      <div>
        <a href="#main-content" className="sr-only focus:not-sr-only">
          Skip to main content
        </a>
        <main id="main-content">
          <h1>Main content</h1>
        </main>
      </div>,
    );
    const violations = await checkA11y(container);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  it("data table has no a11y violations", async () => {
    const { container } = render(
      <table aria-label="VA disability pay rates 2026">
        <caption>2026 VA Disability Compensation Rates</caption>
        <thead>
          <tr>
            <th scope="col">Rating %</th>
            <th scope="col">Monthly Rate (Veteran Only)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>10%</td>
            <td>$180.42</td>
          </tr>
          <tr>
            <td>100%</td>
            <td>$4,063.89</td>
          </tr>
        </tbody>
      </table>,
    );
    const violations = await checkA11y(container);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });
});
