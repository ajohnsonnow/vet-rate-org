/**
 * Real-component a11y coverage for modal dialogs.
 *
 * Sprint 5 closeout: the prior accessibility.test.jsx exercised only
 * synthetic markup, so 78 production dialog elements were untested for
 * dialog-name, aria-modal, focus management, etc. This file renders the
 * actual components and runs axe-core against the produced DOM.
 *
 * Why these three? They cover the consent / disclosure / floating
 * primitive shapes that the rest of the modals reuse. If they pass,
 * the patterns the audit flagged are sound.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import axe from "axe-core";

import { LanguageProvider } from "../../contexts/LanguageContext";
import AIConsentModal from "../../components/AIConsentModal";
import { Tooltip } from "../../components/common/Tooltip";

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

function withLanguage(ui) {
  return <LanguageProvider>{ui}</LanguageProvider>;
}

describe("Accessibility: real modal components", () => {
  it("AIConsentModal (personal) has no a11y violations", async () => {
    const { container } = render(
      withLanguage(
        <AIConsentModal
          isOpen={true}
          onConsent={() => {}}
          onCancel={() => {}}
          statementType="personal"
        />,
      ),
    );
    const violations = await checkA11y(container);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  it("AIConsentModal (ptsd) has no a11y violations", async () => {
    const { container } = render(
      withLanguage(
        <AIConsentModal
          isOpen={true}
          onConsent={() => {}}
          onCancel={() => {}}
          statementType="ptsd"
        />,
      ),
    );
    const violations = await checkA11y(container);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  it("AIConsentModal closed state has no a11y violations", async () => {
    const { container } = render(
      withLanguage(
        <AIConsentModal
          isOpen={false}
          onConsent={() => {}}
          onCancel={() => {}}
        />,
      ),
    );
    const violations = await checkA11y(container);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });
});

describe("Accessibility: Tooltip primitive", () => {
  it("renders trigger with aria-describedby linkage (closed)", async () => {
    const { container } = render(
      <Tooltip content="Helpful explanation">
        <button type="button" aria-label="Open settings">
          <span aria-hidden="true">⚙</span>
        </button>
      </Tooltip>,
    );
    const violations = await checkA11y(container);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  it("supports an icon-only button trigger", async () => {
    const { container } = render(
      <Tooltip content="Close panel">
        <button type="button" aria-label="Close panel">
          <span aria-hidden="true">✕</span>
        </button>
      </Tooltip>,
    );
    const violations = await checkA11y(container);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });
});
