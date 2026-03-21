/**
 * VA.gov OAuth Callback Handler (No Router Version)
 *
 * Alternative implementation for apps WITHOUT React Router.
 * This component manually handles the callback by checking window.location
 * and can be conditionally rendered in your main App component.
 */

import React, { useEffect, useState } from "react";
import { useVaAuth } from "../hooks/useVaAuth";
import { useLanguage } from "../contexts/LanguageContext";

export default function VaAuthCallbackNoRouter() {
  const { t } = useLanguage();
  const { handleCallback } = useVaAuth();
  const [status, setStatus] = useState("processing");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const state = urlParams.get("state");
        const error = urlParams.get("error");
        const errorDescription = urlParams.get("error_description");

        // Check for authorization errors
        if (error) {
          throw new Error(errorDescription || error);
        }

        // Validate required parameters
        if (!code || !state) {
          throw new Error("Missing authorization code or state parameter");
        }

        // Exchange code for tokens
        const result = await handleCallback(code, state);

        if (result.success) {
          setStatus("success");
          // Clear the URL parameters and redirect to home
          setTimeout(() => {
            window.history.replaceState({}, document.title, "/");
            window.location.reload();
          }, 1500);
        } else {
          throw new Error(result.error || "Authentication failed");
        }
      } catch (err) {
        console.error("[VA Auth Callback] Error:", err);
        setStatus("error");
        setErrorMessage(err.message);
      }
    };

    processCallback();
  }, [handleCallback]);

  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        {status === "processing" && (
          <div className="text-center">
            <div className="mb-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Completing Sign In
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Securely connecting to VA.gov...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Sign In Successful!
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Redirecting you now...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Authentication Failed
            </h2>
            <p className="text-red-600 dark:text-red-400 mb-4">
              {errorMessage || "An error occurred during sign in"}
            </p>
            <button
              onClick={() => {
                window.history.replaceState({}, document.title, "/");
                window.location.reload();
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return to Home
            </button>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            🔒 Secure OAuth 2.0 with PKCE
          </p>
        </div>
      </div>
    </div>
  );
}
