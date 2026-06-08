/**
 * EXAMPLE: How to Add Security Features to Existing Components
 * Copy these patterns into your actual components
 */

// ============================================
// EXAMPLE 1: Add Voice Dictation to Text Area
// ============================================

import React, { useState } from "react";
import DictationButton from "../components/DictationButton";

function MyTextAreaWithDictation() {
  const [text, setText] = useState("");

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Personal Statement</label>

      {/* The textarea container needs to be relative */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full p-4 border rounded-lg min-h-[200px]"
          placeholder="Describe your condition and how it affects your daily life..."
        />

        {/* Add dictation button in top-right corner */}
        <div className="absolute right-3 top-3">
          <DictationButton
            onTranscript={(spokenText) => {
              // Append spoken text to existing text with space
              setText((prev) => prev + (prev ? " " : "") + spokenText);
            }}
            size="md"
          />
        </div>
      </div>

      <p className="text-xs text-gray-500">
        💡 Click the microphone to speak your statement instead of typing
      </p>
    </div>
  );
}

// ============================================
// EXAMPLE 2: Protect Sensitive Data with Redaction
// ============================================

import { Redactable } from "../components/RedactionMode";

function VeteranInfoCard({ veteran }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg">
      <h3 className="font-bold mb-4">Veteran Information</h3>

      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-600">Name:</span>{" "}
          <Redactable type="name">{veteran.fullName}</Redactable>
        </div>

        <div>
          <span className="text-gray-600">SSN:</span>{" "}
          <Redactable type="ssn">{veteran.ssn}</Redactable>
        </div>

        <div>
          <span className="text-gray-600">Address:</span>{" "}
          <Redactable type="address">{veteran.address}</Redactable>
        </div>

        <div>
          <span className="text-gray-600">Phone:</span>{" "}
          <Redactable type="phone">{veteran.phone}</Redactable>
        </div>

        <div>
          <span className="text-gray-600">Claim Number:</span>{" "}
          <Redactable type="claim-number">{veteran.claimNumber}</Redactable>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4">
        💡 Use "Redact for Screenshot" mode to safely share this info
      </p>
    </div>
  );
}

// ============================================
// EXAMPLE 3: Add Security Settings to Header
// ============================================

import React, { useState } from "react";
import { RedactionToggle, RedactionBanner } from "../components/RedactionMode";
import SecuritySettings from "../components/SecuritySettings";

function HeaderWithSecurity({ securityContext }) {
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);

  return (
    <>
      {/* Show banner when redaction is active */}
      <RedactionBanner />

      <header className="bg-white dark:bg-gray-800 shadow-lg">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/* Your existing logo/brand */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Vet-Rate.org" className="h-10" />
            <h1 className="text-xl font-bold">Vet-Rate.org</h1>
          </div>

          {/* Security Controls */}
          <div className="flex items-center gap-4">
            {/* Redaction Toggle */}
            <RedactionToggle />

            {/* Security Settings Button */}
            <button
              onClick={() => setShowSecuritySettings(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 
                       rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 
                       transition-colors text-sm font-medium"
              aria-label="Security & Privacy Settings"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span className="hidden md:inline">Security</span>
            </button>

            {/* Vault Status Indicator (optional) */}
            {securityContext?.isVaultEnabled && (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="hidden lg:inline font-medium">Encrypted</span>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Security Settings Modal */}
      <SecuritySettings
        isOpen={showSecuritySettings}
        onClose={() => setShowSecuritySettings(false)}
        securityContext={securityContext}
      />
    </>
  );
}

// ============================================
// EXAMPLE 4: Use Encrypted Storage
// ============================================

import { secureSetItem, secureGetItem } from "../utils/secureStorage";

function ComponentWithEncryptedStorage({ securityContext }) {
  const [claims, setClaims] = useState([]);

  // Load encrypted data on mount
  useEffect(() => {
    async function loadData() {
      if (securityContext?.currentPin) {
        try {
          const data = await secureGetItem(
            "vet_rate_saved_claims",
            securityContext.currentPin,
          );
          if (data) {
            setClaims(data);
          }
        } catch (error) {
          console.error("Failed to load encrypted data:", error);
        }
      }
    }

    loadData();
  }, [securityContext?.currentPin]);

  // Save encrypted data
  const saveClaims = async (newClaims) => {
    if (securityContext?.currentPin) {
      try {
        await secureSetItem(
          "vet_rate_saved_claims",
          newClaims,
          securityContext.currentPin,
        );
        setClaims(newClaims);
      } catch (error) {
        console.error("Failed to save encrypted data:", error);
      }
    } else {
      // Fallback to regular storage if vault not enabled
      localStorage.setItem("vet_rate_saved_claims", JSON.stringify(newClaims));
      setClaims(newClaims);
    }
  };

  return <div>{/* Your component UI */}</div>;
}

// ============================================
// EXAMPLE 5: Complete Integration in App.jsx
// ============================================

import React from "react";
import SecurityManager from "./components/SecurityManager";
import { RedactionProvider } from "./components/RedactionMode";
import HeaderWithSecurity from "./components/HeaderWithSecurity";

function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header receives securityContext from SecurityManager */}
      <HeaderWithSecurity />

      {/* Your main content */}
      <main className="container mx-auto px-4 py-8">
        {/* Your components here */}
      </main>
    </div>
  );
}

// Wrap in security providers in main.jsx
export default function WrappedApp() {
  return (
    <SecurityManager>
      <RedactionProvider>
        <App />
      </RedactionProvider>
    </SecurityManager>
  );
}

// ============================================
// EXAMPLE 6: Multiple Dictation Buttons
// ============================================

function FormWithMultipleDictationFields() {
  const [personalStatement, setPersonalStatement] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [impacts, setImpacts] = useState("");

  return (
    <form className="space-y-6">
      {/* Field 1: Personal Statement */}
      <div className="relative">
        <label className="block text-sm font-medium mb-2">
          Personal Statement
        </label>
        <textarea
          value={personalStatement}
          onChange={(e) => setPersonalStatement(e.target.value)}
          className="w-full p-4 border rounded-lg min-h-[150px]"
        />
        <div className="absolute right-3 top-10">
          <DictationButton
            onTranscript={(text) =>
              setPersonalStatement((prev) => prev + " " + text)
            }
            size="sm"
          />
        </div>
      </div>

      {/* Field 2: Symptoms */}
      <div className="relative">
        <label className="block text-sm font-medium mb-2">Symptoms</label>
        <textarea
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          className="w-full p-4 border rounded-lg min-h-[150px]"
        />
        <div className="absolute right-3 top-10">
          <DictationButton
            onTranscript={(text) => setSymptoms((prev) => prev + " " + text)}
            size="sm"
          />
        </div>
      </div>

      {/* Field 3: Daily Life Impacts */}
      <div className="relative">
        <label className="block text-sm font-medium mb-2">
          How It Affects Your Daily Life
        </label>
        <textarea
          value={impacts}
          onChange={(e) => setImpacts(e.target.value)}
          className="w-full p-4 border rounded-lg min-h-[150px]"
        />
        <div className="absolute right-3 top-10">
          <DictationButton
            onTranscript={(text) => setImpacts((prev) => prev + " " + text)}
            size="sm"
          />
        </div>
      </div>
    </form>
  );
}

// ============================================
// PRO TIP: Keyboard Shortcuts
// ============================================

// Add this to enable Ctrl+Shift+S to toggle redaction
useEffect(() => {
  const handleKeyPress = (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "S") {
      e.preventDefault();
      toggleRedaction(); // From useRedaction() hook
    }
  };

  window.addEventListener("keydown", handleKeyPress);
  return () => window.removeEventListener("keydown", handleKeyPress);
}, []);

// ============================================
// MIGRATION EXAMPLE
// ============================================

// If you have existing localStorage calls, migrate them like this:

// BEFORE:
const claims = JSON.parse(
  localStorage.getItem("vet_rate_saved_claims") || "[]",
);
localStorage.setItem("vet_rate_saved_claims", JSON.stringify(claims));

// AFTER:
import { secureGetItem, secureSetItem } from "../utils/secureStorage";

// Check if vault is enabled
if (securityContext?.isVaultEnabled && securityContext?.currentPin) {
  // Use encrypted storage
  const claims =
    (await secureGetItem(
      "vet_rate_saved_claims",
      securityContext.currentPin,
    )) || [];
  await secureSetItem(
    "vet_rate_saved_claims",
    claims,
    securityContext.currentPin,
  );
} else {
  // Fall back to plain storage
  const claims = JSON.parse(
    localStorage.getItem("vet_rate_saved_claims") || "[]",
  );
  localStorage.setItem("vet_rate_saved_claims", JSON.stringify(claims));
}
