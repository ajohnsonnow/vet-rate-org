/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * THE REDACTOR - Safe Screenshot Mode
 * Blur sensitive personal information for safe sharing with VSOs/buddies
 * Protects SSN, Name, Address, Claim Numbers from accidental disclosure
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";

// Context for redaction state
const RedactionContext = createContext();

export const useRedaction = () => {
  const context = useContext(RedactionContext);
  if (!context) {
    throw new Error("useRedaction must be used within RedactionProvider");
  }
  return context;
};

// Provider component
export const RedactionProvider = ({ children }) => {
  const [isRedacting, setIsRedacting] = useState(() => {
    const saved = localStorage.getItem("vet-rate-redaction-mode");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("vet-rate-redaction-mode", isRedacting.toString());

    // Add/remove class to body for global CSS targeting
    if (isRedacting) {
      document.body.classList.add("redaction-active");
    } else {
      document.body.classList.remove("redaction-active");
    }
  }, [isRedacting]);

  const toggleRedaction = () => {
    setIsRedacting((prev) => !prev);
  };

  return (
    <RedactionContext.Provider value={{ isRedacting, toggleRedaction }}>
      {children}
    </RedactionContext.Provider>
  );
};

// HOC to wrap sensitive data
export const Redactable = ({
  children,
  type = "text", // 'text', 'ssn', 'name', 'address', 'phone', 'claim-number'
  className = "",
  alwaysShow = false,
}) => {
  const { t } = useLanguage();
  const { isRedacting } = useRedaction();

  if (!isRedacting || alwaysShow) {
    return <>{children}</>;
  }

  const redactionClasses = {
    text: "blur-sm",
    ssn: "blur-md",
    name: "blur-sm",
    address: "blur-md",
    phone: "blur-sm",
    "claim-number": "blur-sm",
  };

  return (
    <span
      className={`
        redacted-sensitive 
        ${redactionClasses[type] || "blur-sm"}
        ${className}
        select-none
        transition-all duration-300
        relative
      `}
      data-redaction-type={type}
      title="Sensitive information hidden for screenshot safety"
    >
      {children}
    </span>
  );
};

// Toggle component for navbar/header
export const RedactionToggle = ({ className = "" }) => {
  const { t } = useLanguage();
  const { isRedacting, toggleRedaction } = useRedaction();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={toggleRedaction}
        className={`
          px-4 py-2 rounded-lg font-medium text-sm
          flex items-center gap-2 transition-all duration-300
          ${
            isRedacting
              ? "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/50"
              : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
          }
        `}
        title={
          isRedacting
            ? "Safe screenshot mode active - personal info is blurred"
            : "Click to blur personal info for safe screenshots"
        }
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isRedacting ? (
            // Eye-off icon (redacting)
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
            />
          ) : (
            // Eye icon (not redacting)
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          )}
        </svg>
        {isRedacting ? (
          <span>Redacting Personal Info</span>
        ) : (
          <span>Redact for Screenshot</span>
        )}
      </button>

      {isRedacting && (
        <div className="flex items-center gap-1 text-green-600 dark:text-green-400 animate-fade-in">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs font-medium">Safe to Screenshot</span>
        </div>
      )}
    </div>
  );
};

// Redaction banner (shows when active)
export const RedactionBanner = () => {
  const { isRedacting, toggleRedaction } = useRedaction();

  if (!isRedacting) return null;

  return (
    <div className="bg-green-500 text-white px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <svg
          className="w-5 h-5 animate-pulse"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <p className="font-semibold text-sm">
            🔒 Safe Screenshot Mode Active
          </p>
          <p className="text-xs text-green-100">
            Personal information is blurred. Safe to share screenshots with VSOs
            or buddies.
          </p>
        </div>
      </div>
      <button
        onClick={toggleRedaction}
        className="px-3 py-1 bg-white text-green-600 rounded hover:bg-green-50 transition-colors text-sm font-medium"
      >
        Disable
      </button>
    </div>
  );
};

// CSS to inject into global styles
export const redactionStyles = `
  /* Redaction Mode Styles */
  .redaction-active .redacted-sensitive {
    filter: blur(8px);
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }

  .redaction-active .redacted-sensitive::selection {
    background: transparent;
  }

  /* Prevent screenshot tools from capturing clear text */
  .redaction-active .redacted-sensitive::before {
    content: '';
    position: absolute;
    inset: -2px;
    background: rgba(0, 0, 0, 0.1);
    z-index: 1;
  }

  /* Animation for fade-in */
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
`;

// Helper function to automatically detect and wrap sensitive data
export const autoRedact = (text, type = "text") => {
  if (!text) return text;

  // SSN pattern
  const ssnPattern = /\b\d{3}-?\d{2}-?\d{4}\b/g;

  // Phone pattern
  const phonePattern =
    /\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

  // Claim number pattern (VA format)
  const claimPattern = /\b\d{8,9}\b/g;

  let redacted = text;

  if (type === "auto" || type === "ssn") {
    redacted = redacted.replace(
      ssnPattern,
      (match) =>
        `<span class="redacted-sensitive" data-redaction-type="ssn">${match}</span>`,
    );
  }

  if (type === "auto" || type === "phone") {
    redacted = redacted.replace(
      phonePattern,
      (match) =>
        `<span class="redacted-sensitive" data-redaction-type="phone">${match}</span>`,
    );
  }

  if (type === "auto" || type === "claim-number") {
    redacted = redacted.replace(
      claimPattern,
      (match) =>
        `<span class="redacted-sensitive" data-redaction-type="claim-number">${match}</span>`,
    );
  }

  return redacted;
};

export default Redactable;
