/**
 * VA.gov Login Button Component
 *
 * Example component showing how to use the VA authentication.
 * Displays login/logout buttons and user information when authenticated.
 */

import React from "react";
import { useVaAuth } from "../hooks/useVaAuth";
import { useLanguage } from "../contexts/LanguageContext";

export default function VaLoginButton() {
  const { t } = useLanguage();
  const { isAuthenticated, isLoading, userInfo, error, login, logout } =
    useVaAuth();

  // Loading state
  if (isLoading) {
    return (
      <div className="inline-flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-va-blue mr-2"></div>
        <span className="text-gray-700 dark:text-gray-300">Loading...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
        <p className="text-red-800 dark:text-red-200 text-sm">
          <strong>Error:</strong> {error}
        </p>
      </div>
    );
  }

  // Authenticated state
  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-4">
        {userInfo && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-va-blue rounded-full flex items-center justify-center text-white font-bold">
              {userInfo.given_name?.[0] || "V"}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {userInfo.name || "Veteran"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                VA.gov Connected
              </p>
            </div>
          </div>
        )}

        <button
          onClick={logout}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Not authenticated - show login button
  return (
    <button
      onClick={login}
      className="inline-flex items-center px-6 py-3 bg-va-blue hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl"
    >
      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
          clipRule="evenodd"
        />
      </svg>
      Sign In with VA.gov
    </button>
  );
}
