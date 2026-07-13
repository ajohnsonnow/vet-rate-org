import BRAND from "../../config/branding";
import { createDebugDumpHandler } from "../../utils/debugDump";
import { getTotalToolCount } from "../../data/toolkitData";
import { getSquashedBugCount } from "../../data/squashedBugs";
import AnimatedBug from "../../components/AnimatedBug";

function FooterAboutColumn() {
  return (
    <div>
      <h4 className="font-bold mb-3">ℹ️ About {BRAND.appName}</h4>
      <p className="text-gray-400 text-sm mb-3">
        The most comprehensive free VA claims arsenal - {getTotalToolCount()}{" "}
        professional-grade tools covering research, calculators, AI analysis,
        C&P prep, evidence builders, and strategic planning. What claim sharks
        charge thousands for, absolutely free.
      </p>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openAboutUs"))}
        className="text-va-gold hover:underline text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-va-gold rounded"
      >
        Learn More →
      </button>
    </div>
  );
}

function FooterPrivacyColumn() {
  return (
    <div>
      <h4 className="font-bold mb-3">🔒 Data Privacy</h4>
      <p className="text-gray-400 text-sm mb-3">
        This system operates locally and does not store Personally Identifiable
        Information (PII) on external servers. All data processing happens in
        your browser.
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={() =>
            window.dispatchEvent(new CustomEvent("openPrivacyPolicy"))
          }
          className="text-va-gold hover:underline text-sm font-semibold text-left"
        >
          Privacy Policy →
        </button>
        <a
          href={BRAND.goatCounterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-400 hover:underline text-sm font-semibold inline-flex items-center gap-1"
        >
          📊 View Live Analytics →
        </a>
      </div>
    </div>
  );
}

function FooterLegalColumn() {
  return (
    <div>
      <h4 className="font-bold mb-3">⚖️ Legal Notice</h4>
      <p className="text-gray-400 text-sm mb-3">
        This tool is for educational purposes only. It does not constitute legal
        or medical advice. Consult with VA officials or qualified professionals
        for specific guidance.
      </p>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openTermsOfService"))
        }
        className="text-va-gold hover:underline text-sm font-semibold"
      >
        Terms of Service →
      </button>
    </div>
  );
}

function FooterLinksPrimary() {
  return (
    <>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openPrivacyPolicy"))
        }
        className="text-gray-400 hover:text-va-gold text-sm transition-colors"
      >
        Privacy Policy
      </button>
      <span className="text-gray-600">|</span>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openAboutUs"))}
        className="text-gray-400 hover:text-va-gold text-sm transition-colors"
      >
        About Us
      </button>
      <span className="text-gray-600">|</span>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openMissionProtocol"))
        }
        className="text-gray-400 hover:text-va-gold text-sm transition-colors"
      >
        🎖️ Our Promise
      </button>
      <span className="text-gray-600">|</span>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openWorkflowGuide"))
        }
        className="text-gray-400 hover:text-va-gold text-sm transition-colors"
      >
        🗺️ Workflow Guide
      </button>
      <span className="text-gray-600">|</span>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openContactUs"))}
        className="text-gray-400 hover:text-va-gold text-sm transition-colors"
      >
        Contact Us
      </button>
    </>
  );
}

function FooterLinksSecondary() {
  return (
    <>
      <span className="text-gray-600">|</span>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openTermsOfService"))
        }
        className="text-gray-400 hover:text-va-gold text-sm transition-colors"
      >
        Terms of Service
      </button>
      <span className="text-gray-600">|</span>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openFormsHelper"))}
        className="text-gray-400 hover:text-va-gold text-sm transition-colors"
      >
        📋 Forms Helper
      </button>
      <span className="text-gray-600">|</span>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openUserManual"))}
        className="text-gray-400 hover:text-va-gold text-sm transition-colors"
      >
        📖 Field Manual
      </button>
      <span className="text-gray-600">|</span>
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("openPublicationsLibrary"))
        }
        className="text-gray-400 hover:text-va-gold text-sm transition-colors"
      >
        📚 Pubs Library
      </button>
      <span className="text-gray-600">|</span>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openBugSquasher"))}
        className="text-gray-400 hover:text-red-400 text-sm transition-colors flex items-center gap-1 group"
      >
        🐛 Report Bug
        <span
          className="bg-green-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full group-hover:bg-green-500 transition-colors"
          aria-label={`${getSquashedBugCount()} bugs squashed`}
        >
          {getSquashedBugCount()}
          <AnimatedBug size="xs" />✓
        </span>
      </button>
    </>
  );
}

function FooterLinkBar() {
  return (
    <div className="flex flex-wrap justify-center gap-4 mb-6">
      <FooterLinksPrimary />
      <FooterLinksSecondary />
    </div>
  );
}

function FooterCopyright({ debugDumpHandler }) {
  return (
    <p className="text-center text-gray-400 text-sm">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <span
        onClick={debugDumpHandler}
        className="cursor-default select-none"
        aria-label="Copyright Notice"
      >
        {BRAND.copyright}
      </span>{" "}
      - Your Complete VA Claims Toolkit. Data sourced from{" "}
      <a
        href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
        target="_blank"
        rel="noopener noreferrer"
        className="text-va-gold hover:underline"
      >
        38 CFR Part 4
      </a>
    </p>
  );
}

function FooterDisclaimerNotice() {
  return (
    <p className="text-center text-gray-500 text-xs mt-3 border-t border-gray-800 pt-3">
      <strong>Important:</strong> {BRAND.appName} is a private, veteran-built
      project and is{" "}
      <strong>
        not affiliated with, endorsed by, or a part of the Department of
        Veterans Affairs or the United States Government.
      </strong>
    </p>
  );
}

/**
 * Global app footer — three info columns (About / Privacy / Legal),
 * a flat link bar to legal/help modals, the copyright + debug-dump
 * easter egg, and the "not affiliated with the VA" disclaimer.
 *
 * All link actions are window CustomEvent dispatches handled by the
 * relevant feature modal listeners. The copyright span hides a click
 * handler that triggers the debug-dump utility.
 *
 * Extracted from App.jsx (audit #35, B62).
 */
export default function AppFooter() {
  const debugDumpHandler = createDebugDumpHandler();

  return (
    <footer
      className="bg-gray-900 dark:bg-black text-white py-8 mt-12"
      role="contentinfo"
    >
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <FooterAboutColumn />
          <FooterPrivacyColumn />
          <FooterLegalColumn />
        </div>

        <div className="border-t border-gray-700 pt-6">
          <FooterLinkBar />
          <FooterCopyright debugDumpHandler={debugDumpHandler} />
          <FooterDisclaimerNotice />
        </div>
      </div>
    </footer>
  );
}
