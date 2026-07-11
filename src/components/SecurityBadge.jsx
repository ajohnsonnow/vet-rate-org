import { useState } from "react";
import {
  Shield,
  Lock,
  Eye,
  Code,
  Network,
  AlertCircle,
  CheckCircle,
  X,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";

/**
 * SecurityBadge - Prominent, always-visible proof of client-side security
 *
 * Addresses trust concerns by providing:
 * - Visible security status
 * - Proof of no data collection
 * - How to verify yourself
 * - What skeptics should check
 */
const SecurityBadge = () => {
  const { _t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <>
      {/* Floating Badge */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-green-500 to-blue-500 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2 font-semibold"
        aria-label="View Security Proof"
      >
        <Shield className="w-5 h-5" />
        <span className="hidden sm:inline">🔒 100% Private</span>
        <span className="sm:hidden">🔒</span>
      </button>

      {showModal && (
        <SecurityProofModal
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};

// Modal shell: header/tabs + active tab content
const SecurityProofModal = ({ activeTab, onTabChange, onClose }) => (
  <ResponsiveModal
    isOpen
    onClose={onClose}
    size="xl"
    zIndex={9999}
    labelledBy="security-proof-title"
    header={
      <SecurityModalHeader
        activeTab={activeTab}
        onTabChange={onTabChange}
        onClose={onClose}
      />
    }
  >
    {activeTab === "overview" && <OverviewTab />}
    {activeTab === "proof" && <ProofTab />}
    {activeTab === "verify" && <VerifyTab />}
    {activeTab === "faq" && <FAQTab />}
  </ResponsiveModal>
);

// Modal title bar + tab navigation
const SecurityModalHeader = ({ activeTab, onTabChange, onClose }) => (
  <>
    <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2
            id="security-proof-title"
            className="text-3xl font-bold flex items-center gap-3 mb-2"
          >
            <Shield className="w-8 h-8" />
            Security Proof - Zero BS Transparency
          </h2>
          <p className="text-green-100 text-sm">
            Don&apos;t trust us. Verify us. Here&apos;s exactly how.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>

    {/* Tabs */}
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-6">
      <div className="flex gap-2 overflow-x-auto">
        {[
          { id: "overview", label: "Overview", icon: Eye },
          { id: "proof", label: "Technical Proof", icon: Network },
          { id: "verify", label: "Verify Yourself", icon: Code },
          { id: "faq", label: "Skeptic FAQ", icon: AlertCircle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  </>
);

// Overview Tab Content
const OverviewTab = () => (
  <div className="space-y-6">
    <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 p-4">
      <h3 className="font-bold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
        <CheckCircle className="w-5 h-5" />
        Our Privacy Guarantee
      </h3>
      <p className="text-green-800 dark:text-green-200">
        <strong>Your data NEVER leaves your device.</strong> Everything runs in
        your browser. We don&apos;t have servers to collect your information -
        by design, not by promise.
      </p>
    </div>

    <div className="grid md:grid-cols-2 gap-4">
      <SecurityFeature
        icon={Lock}
        title="100% Client-Side"
        description="All processing happens in your browser. No backend, no servers, no databases."
        color="blue"
      />
      <SecurityFeature
        icon={Network}
        title="Privacy-First Analytics"
        description="Only basic page views via GoatCounter (no cookies, no personal data). See our public stats!"
        color="purple"
      />
      <SecurityFeature
        icon={Eye}
        title="Open Source"
        description="All code is on GitHub. Read every line. Fork it. Audit it."
        color="green"
      />
      <SecurityFeature
        icon={Shield}
        title="Verifiable"
        description="Use browser dev tools to see exactly what network requests are made (spoiler: almost none)."
        color="orange"
      />
    </div>

    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 rounded-lg">
      <h4 className="font-bold mb-3 dark:text-gray-100">
        What Data Stays Local:
      </h4>
      <ul className="space-y-2">
        {[
          "Your name, DOB, SSN, service dates",
          "Your medical conditions and symptoms",
          "Your personal statements and buddy letters",
          "Your uploaded PDFs and C-Files",
          "Your rating calculations",
          "Your saved packets",
          "Everything you type or create",
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-2 dark:text-gray-200">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>

    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-4 rounded-lg">
      <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
        Optional AI Feature:
      </h4>
      <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
        When you click &quot;Enhance with AI&quot; (100% optional), only{" "}
        <strong>condition names and symptoms</strong> are sent to Google Gemini
        - never your name, SSN, or personal details.
      </p>
      <p className="text-sm text-blue-800 dark:text-blue-200">
        <strong>You control this:</strong> You provide your own API key (free).
        We don&apos;t even have access to it.
      </p>
    </div>
  </div>
);

// Technical stack summary block
const TechStackDiagram = () => (
  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm mb-4">
    <div className="mb-2 text-gray-400">{"// Our entire stack:"}</div>
    <div>Frontend: React (Vite) ✅</div>
    <div>
      Backend: <span className="line-through">None</span> ❌
    </div>
    <div>
      Database: <span className="line-through">None</span> ❌
    </div>
    <div>
      API Server: <span className="line-through">None</span> ❌
    </div>
    <div>Analytics: GoatCounter (privacy-first) 🔒</div>
    <div className="mt-2 text-gray-400">
      {"// Just static files served to your browser"}
    </div>
  </div>
);

// Table of network requests the app can make
const NetworkActivityTable = () => (
  <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-600 mt-2">
    <thead className="bg-gray-100 dark:bg-gray-700">
      <tr>
        <th className="border border-gray-300 dark:border-gray-600 p-2 text-left dark:text-gray-100">
          Request
        </th>
        <th className="border border-gray-300 dark:border-gray-600 p-2 text-left dark:text-gray-100">
          Purpose
        </th>
        <th className="border border-gray-300 dark:border-gray-600 p-2 text-left dark:text-gray-100">
          Your Data?
        </th>
      </tr>
    </thead>
    <tbody className="dark:bg-gray-800 dark:text-gray-200">
      <tr>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          vet-rate.org/assets/...
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          Loading app files (JS/CSS)
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2 text-green-700 dark:text-green-400 font-bold">
          ❌ No
        </td>
      </tr>
      <tr>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          ecfr.gov/...
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          External link to VA regulations
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2 text-green-700 dark:text-green-400 font-bold">
          ❌ No
        </td>
      </tr>
      <tr>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          generativelanguage.googleapis.com
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          AI feature (when you click &quot;Enhance&quot;)
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2 text-yellow-700 dark:text-yellow-400">
          ⚠️ Symptoms only
        </td>
      </tr>
      <tr>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          gc.zgo.at (GoatCounter)
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          Privacy-first page view analytics
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2 text-green-700 dark:text-green-400 font-bold">
          ❌ No PII
        </td>
      </tr>
      <tr>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          <em>Anything else</em>
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2 font-bold">
          Should NOT exist
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2 text-red-700 dark:text-red-400 font-bold">
          🚨 Report it!
        </td>
      </tr>
    </tbody>
  </table>
);

const GoatCounterNotice = () => (
  <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 mt-4 mb-4">
    <p className="font-bold text-blue-900 dark:text-blue-200">
      🔒 About GoatCounter Analytics:
    </p>
    <ul className="list-disc ml-5 mt-2 text-blue-800 dark:text-blue-300 text-sm">
      <li>Open-source, privacy-first analytics</li>
      <li>No cookies, no fingerprinting, no tracking across sites</li>
      <li>Only counts page views, referrers, and screen sizes</li>
      <li>GDPR-compliant by design</li>
      <li>
        See:{" "}
        <a
          href="https://www.goatcounter.com/help/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          GoatCounter Privacy Policy
        </a>
      </li>
    </ul>
    <p className="text-xs text-blue-700 dark:text-blue-400 mt-2 italic">
      📱 Fun fact: GoatCounter helped us realize how many veterans use
      mobile devices - sorry for the early UI struggles, small screen folks!
      We&apos;re on it! 🫡
    </p>
  </div>
);

const SuspiciousTrafficWarning = () => (
  <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 mt-4">
    <p className="font-bold text-red-900 dark:text-red-200">
      🚨 If you see requests to:
    </p>
    <ul className="list-disc ml-5 mt-2 text-red-800 dark:text-red-300 text-sm">
      <li>analytics.google.com</li>
      <li>facebook.com/pixel</li>
      <li>Any other tracking domain</li>
      <li>Any unknown API</li>
    </ul>
    <p className="mt-2 text-red-800 dark:text-red-300 font-semibold">
      → Report it immediately via Bug Squasher. That would mean we&apos;ve
      been compromised.
    </p>
  </div>
);

// Technical Proof Tab
const ProofTab = () => (
  <div className="space-y-6">
    <div className="prose max-w-none dark:prose-invert">
      <h3 className="text-xl font-bold mb-4 dark:text-gray-100">
        Technical Architecture Proof
      </h3>

      <TechStackDiagram />

      <h4 className="font-bold mt-6 mb-2 dark:text-gray-100">Hosting Model:</h4>
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-4">
        <p className="text-sm dark:text-yellow-200">
          <strong>Render.com Static Site:</strong> We use Render&apos;s static
          site hosting, which serves pre-built HTML/CSS/JS files. This is NOT a
          server that can process or store your data - it&apos;s like serving
          files from a USB drive.
        </p>
      </div>

      <h4 className="font-bold mt-6 mb-2 dark:text-gray-100">
        Network Activity You&apos;ll See:
      </h4>
      <NetworkActivityTable />

      <GoatCounterNotice />

      <SuspiciousTrafficWarning />
    </div>
  </div>
);

// The six-step "verify it yourself" walkthrough
const VerificationStepsList = () => (
  <div className="space-y-6">
    <VerificationStep
      number={1}
      title="Open Browser Developer Tools"
      steps={[
        "Right-click anywhere on the page",
        'Select "Inspect" or "Inspect Element"',
        "Or press F12 (Windows) or Cmd+Option+I (Mac)",
      ]}
    />

    <VerificationStep
      number={2}
      title="Open Network Tab"
      steps={[
        'Click the "Network" tab in DevTools',
        "Refresh the page (F5 or Cmd+R)",
        "Watch what requests are made",
      ]}
    />

    <VerificationStep
      number={3}
      title="Enter Sensitive Info"
      steps={[
        "Enter fake personal data (name, SSN, etc.)",
        "Search for conditions",
        "Save a packet",
        "Generate a form",
      ]}
    />

    <VerificationStep
      number={4}
      title="Check Network Activity"
      steps={[
        "Look at the Network tab",
        "You should see ZERO requests to our servers",
        "Everything happens locally",
        "Click any request to see what data was sent (should be none)",
      ]}
    />

    <VerificationStep
      number={5}
      title="Check Local Storage"
      steps={[
        'Click "Application" (Chrome) or "Storage" (Firefox) tab',
        'Expand "Local Storage"',
        "Click on vet-rate.org",
        "See your data? It's ONLY on your device.",
      ]}
    />

    <VerificationStep
      number={6}
      title="Audit the Code (Advanced)"
      steps={[
        "Visit: github.com/ajohnsonnow/vet-rate-org",
        "Read the source code",
        'Search for "fetch", "axios", "api" - see what they call',
        "Fork it and host it yourself if you want",
      ]}
    />
  </div>
);

// "What you should find" + "red flags" summary boxes
const VerifyOutcomeSummary = () => (
  <>
    <div className="bg-green-50 dark:bg-green-900/30 border border-green-500 p-4 rounded-lg mt-6">
      <h4 className="font-bold text-green-900 dark:text-green-200 mb-2">
        ✅ What You Should Find:
      </h4>
      <ul className="space-y-1 text-sm text-green-800 dark:text-green-300">
        <li>• No POST requests with your data</li>
        <li>• No tracking cookies</li>
        <li>• No analytics scripts</li>
        <li>• All your data in localStorage (your device)</li>
        <li>• Source code matches what you see</li>
      </ul>
    </div>

    <div className="bg-red-50 dark:bg-red-900/30 border border-red-500 p-4 rounded-lg mt-4">
      <h4 className="font-bold text-red-900 dark:text-red-200 mb-2">
        🚨 Red Flags (Report These):
      </h4>
      <ul className="space-y-1 text-sm text-red-800 dark:text-red-300">
        <li>• Requests to unknown domains</li>
        <li>• POST requests with form data</li>
        <li>• Tracking pixels loading</li>
        <li>• Data sent to third parties</li>
        <li>• Code doesn&apos;t match GitHub repo</li>
      </ul>
    </div>
  </>
);

// Verify Yourself Tab
const VerifyTab = () => (
  <div className="space-y-6">
    <div className="prose max-w-none dark:prose-invert">
      <h3 className="text-xl font-bold mb-4 dark:text-gray-100">
        Don&apos;t Trust - Verify
      </h3>

      <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 mb-6">
        <p className="font-semibold text-blue-900 dark:text-blue-200">
          Anyone can claim they&apos;re private. Here&apos;s how to PROVE we are
          (or catch us if we&apos;re not).
        </p>
      </div>

      <VerificationStepsList />

      <VerifyOutcomeSummary />
    </div>
  </div>
);

const FAQFreeAnswer = () => (
  <div className="space-y-2 text-sm">
    <p>
      <strong>Not here.</strong> That business model requires collecting
      your data to sell or monetize. We can&apos;t sell what we don&apos;t
      have.
    </p>
    <p>
      <strong>Why it&apos;s free:</strong>
    </p>
    <ul className="list-disc ml-5 space-y-1">
      <li>Built by a veteran for veterans (me, AJ Johnson)</li>
      <li>Static hosting costs ~$0/month (Render free tier)</li>
      <li>No servers = no infrastructure costs</li>
      <li>No employees to pay (just me volunteering time)</li>
      <li>Open source - community can verify everything</li>
    </ul>
    <p className="font-semibold mt-2">
      The &quot;product&quot; is helping veterans get what they deserve
      without predatory claim sharks taking 20-30% of your backpay.
    </p>
  </div>
);

const FAQMoneyAnswer = () => (
  <div className="space-y-2 text-sm">
    <p>
      <strong>I don&apos;t.</strong> This is a passion project, not a
      business.
    </p>
    <p>
      There&apos;s a donation link for those who want to support
      hosting/development, but it&apos;s 100% optional. No features are
      paywalled. No subscriptions. No upsells.
    </p>
    <p className="font-semibold">
      Veterans shouldn&apos;t have to pay to understand their benefits.
      Full stop.
    </p>
  </div>
);

const FAQTrainingAnswer = () => (
  <div className="space-y-2 text-sm">
    <p>
      <strong>We don&apos;t train any models.</strong> When you use AI
      features:
    </p>
    <ul className="list-disc ml-5 space-y-1">
      <li>You provide your own API key (Google Gemini - free tier)</li>
      <li>Only condition names/symptoms are sent (no PII)</li>
      <li>Sent directly from YOUR browser to Google&apos;s servers</li>
      <li>We never see the requests or responses</li>
      <li>100% optional - everything works without AI</li>
    </ul>
    <p className="font-semibold mt-2">
      Google&apos;s privacy policy applies to their API, not ours (because
      we don&apos;t have servers).
    </p>
  </div>
);

const FAQRegulationsAnswer = () => (
  <div className="space-y-2 text-sm">
    <p>
      <strong>Good catch!</strong> Yes, disability ratings and regulations
      change. Here&apos;s how we handle it:
    </p>
    <ul className="list-disc ml-5 space-y-1">
      <li>
        All disability data comes from public CFR sources (ecfr.gov)
      </li>
      <li>We update the static JSON files when regulations change</li>
      <li>
        You download the updated files when you visit (like any website
        update)
      </li>
      <li>No continuous sync required - the data is the site itself</li>
    </ul>
    <p className="font-semibold mt-2">
      Think of it like downloading a phone app update - new data replaces
      old, but your personal info stays local.
    </p>
  </div>
);

const FAQTrustAnswer = () => (
  <div className="space-y-2 text-sm">
    <p>
      <strong>GOOD.</strong> You shouldn&apos;t blindly trust anyone.
      That&apos;s why:
    </p>
    <ul className="list-disc ml-5 space-y-1">
      <li>All code is open source on GitHub</li>
      <li>You can audit every line yourself</li>
      <li>You can use browser DevTools to watch network traffic</li>
      <li>You can fork the repo and host it yourself</li>
      <li>Security researchers can (and should) audit it</li>
    </ul>
    <p className="font-semibold mt-2">
      Don&apos;t trust my words - verify with your own eyes. See the
      &quot;Verify Yourself&quot; tab above.
    </p>
  </div>
);

const FAQBreachAnswer = () => (
  <div className="space-y-2 text-sm">
    <p>
      <strong>Can&apos;t breach what doesn&apos;t exist.</strong>
    </p>
    <p>
      Traditional breaches happen when companies store your data on
      servers and those servers get hacked. We have:
    </p>
    <ul className="list-disc ml-5 space-y-1">
      <li>❌ No user database</li>
      <li>❌ No authentication server</li>
      <li>❌ No API server processing data</li>
      <li>❌ No logs of user activity</li>
      <li>✅ Just static files (HTML/CSS/JS)</li>
    </ul>
    <p className="font-semibold mt-2">
      The ONLY way your data could leak is if YOUR device is compromised -
      which is true for any website you use.
    </p>
  </div>
);

// Comparison table used inside FAQComparisonAnswer
const VetRateComparisonTable = () => (
  <table className="w-full border-collapse border border-gray-300 dark:border-gray-600 mt-2 text-xs">
    <thead className="bg-gray-100 dark:bg-gray-700">
      <tr>
        <th className="border border-gray-300 dark:border-gray-600 p-2 dark:text-gray-100">
          Feature
        </th>
        <th className="border border-gray-300 dark:border-gray-600 p-2 dark:text-gray-100">
          Typical VA Tools
        </th>
        <th className="border border-gray-300 dark:border-gray-600 p-2 dark:text-gray-100">
          Vet-Rate.org
        </th>
      </tr>
    </thead>
    <tbody className="dark:bg-gray-800">
      <tr>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          Account Required
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          ✅ Yes
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          ❌ No
        </td>
      </tr>
      <tr>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          Email Collection
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          ✅ Yes
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          ❌ No
        </td>
      </tr>
      <tr>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          Data Stored on Servers
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          ✅ Yes
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          ❌ No
        </td>
      </tr>
      <tr>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          Open Source
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          ❌ No
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          ✅ Yes
        </td>
      </tr>
      <tr>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          Verifiable
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          ❌ No
        </td>
        <td className="border border-gray-300 dark:border-gray-600 p-2">
          ✅ Yes (DevTools)
        </td>
      </tr>
    </tbody>
  </table>
);

const FAQComparisonAnswer = () => (
  <div className="space-y-2 text-sm">
    <p>
      <strong>Don&apos;t.</strong> Verify. But here&apos;s the difference:
    </p>
    <VetRateComparisonTable />
    <p className="font-semibold mt-2">
      But don&apos;t take this table as truth - verify each claim
      yourself.
    </p>
  </div>
);

// FAQ Tab
const FAQTab = () => (
  <div className="space-y-6">
    <h3 className="text-xl font-bold mb-4 dark:text-gray-100">
      Addressing Healthy Skepticism
    </h3>

    <FAQItem
      question="If it's free, I'm the product. Right?"
      answer={<FAQFreeAnswer />}
    />

    <FAQItem
      question="How do you make money then?"
      answer={<FAQMoneyAnswer />}
    />

    <FAQItem
      question="The LLM needs data to train. You must be collecting something."
      answer={<FAQTrainingAnswer />}
    />

    <FAQItem
      question="Can't be entirely client-side - regulations change."
      answer={<FAQRegulationsAnswer />}
    />

    <FAQItem
      question="I don't trust Reddit strangers. Show me proof."
      answer={<FAQTrustAnswer />}
    />

    <FAQItem
      question="What if there's a data breach later?"
      answer={<FAQBreachAnswer />}
    />

    <FAQItem
      question="Why should I believe you over other 'free' VA tools?"
      answer={<FAQComparisonAnswer />}
    />
  </div>
);

// Helper Components
const SecurityFeature = ({ icon: Icon, title, description, color }) => {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-900 dark:text-blue-100",
    purple:
      "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-900 dark:text-purple-100",
    green:
      "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-900 dark:text-green-100",
    orange:
      "bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700 text-orange-900 dark:text-orange-100",
  };

  return (
    <div className={`border p-4 rounded-lg ${colorClasses[color]}`}>
      <Icon className="w-6 h-6 mb-2" />
      <h4 className="font-bold mb-1">{title}</h4>
      <p className="text-sm opacity-90">{description}</p>
    </div>
  );
};

const VerificationStep = ({ number, title, steps }) => (
  <div className="border-l-4 border-blue-500 pl-4">
    <h4 className="font-bold text-lg mb-2 dark:text-gray-100">
      Step {number}: {title}
    </h4>
    <ul className="space-y-1 text-sm dark:text-gray-300">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">
            {i + 1}.
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ul>
  </div>
);

const FAQItem = ({ question, answer }) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-500 transition-colors dark:bg-gray-800/50">
    <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">
      ❓ {question}
    </h4>
    <div className="text-gray-700 dark:text-gray-300">{answer}</div>
  </div>
);

export default SecurityBadge;
