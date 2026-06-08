/**
 * VA OAuth Callback Handler
 *
 * Handles the redirect from VA.gov after authentication.
 * Extracts the authorization code and exchanges it for tokens.
 * Supports both popup and redirect flows.
 */

import { useEffect, useState, useRef } from "react";
import { useVaAuth } from "./useVaAuth";

const VaAuthCallback = () => {
  const { exchangeCodeForTokens, error: authError } = useVaAuth();
  const [status, setStatus] = useState("processing");
  const [error, setError] = useState(null);

  // Prevent double-execution in React StrictMode
  const hasProcessed = useRef(false);

  // Check if we're in a popup window
  const isPopup = window.opener && window.opener !== window;

  useEffect(() => {
    // Prevent double execution from StrictMode
    if (hasProcessed.current) {
      // eslint-disable-next-line no-console
      console.log("[VA Callback] Already processing, skipping duplicate call");
      return;
    }
    hasProcessed.current = true;

    const handleCallback = async () => {
      // eslint-disable-next-line no-console
      console.log(
        "[VA Callback] Processing OAuth callback...",
        isPopup ? "(popup mode)" : "(redirect mode)",
      );

      // Parse URL parameters
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const errorParam = params.get("error");
      const errorDescription = params.get("error_description");

      // Check for OAuth error
      if (errorParam) {
        console.error(
          "[VA Callback] OAuth error:",
          errorParam,
          errorDescription,
        );
        const errMsg = errorDescription || errorParam;
        setError(errMsg);
        setStatus("error");

        // Notify parent window if in popup
        if (isPopup && window.opener) {
          window.opener.postMessage(
            { type: "VA_AUTH_ERROR", error: errMsg },
            window.location.origin,
          );
        }
        return;
      }

      // Validate required parameters
      if (!code) {
        console.error("[VA Callback] Missing authorization code");
        setError("Missing authorization code. Please try again.");
        setStatus("error");
        return;
      }

      if (!state) {
        console.error("[VA Callback] Missing state parameter");
        setError("Missing state parameter. Please try again.");
        setStatus("error");
        return;
      }

      try {
        // Exchange code for tokens
        const tokenData = await exchangeCodeForTokens(code, state);
        // eslint-disable-next-line no-console
        console.log("[VA Callback] Token exchange successful");

        // Set flag so MyPacket knows to auto-import records
        sessionStorage.setItem("va_auth_just_connected", "true");

        setStatus("success");

        // If in popup, notify parent and close
        if (isPopup && window.opener) {
          window.opener.postMessage(
            {
              type: "VA_AUTH_SUCCESS",
              data: { ...tokenData, autoImport: true },
            },
            window.location.origin,
          );
          setTimeout(() => {
            window.close();
          }, 1000);
        } else {
          // Traditional redirect flow - go to main app
          setTimeout(() => {
            window.location.href = "/";
          }, 1500);
        }
      } catch (err) {
        console.error("[VA Callback] Token exchange failed:", err);
        setError(err.message);
        setStatus("error");

        // Notify parent window if in popup
        if (isPopup && window.opener) {
          window.opener.postMessage(
            { type: "VA_AUTH_ERROR", error: err.message },
            window.location.origin,
          );
        }
      }
    };

    handleCallback();
  }, [exchangeCodeForTokens, isPopup]);

  // Processing state
  if (status === "processing") {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Connecting to VA.gov
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Verifying your authentication...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Authentication Failed
          </h1>
          <p className="text-red-600 dark:text-red-400 mb-6">
            {error || authError || "An unknown error occurred"}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => (window.location.href = "/sandbox-test")}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Back to Sandbox Test
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-medium transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-green-600 dark:text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Connected Successfully!
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Your VA.gov account has been connected. Your records will be
          automatically downloaded and saved to My Packet.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isPopup
            ? "This window will close automatically..."
            : "Redirecting..."}
        </p>
      </div>
    </div>
  );
};

export default VaAuthCallback;
