/**
 * VA.gov OAuth Callback Component
 * 
 * Handles the redirect back from VA.gov after user authorization.
 * Extracts the authorization code and exchanges it for tokens.
 * 
 * Add this route to your React Router:
 * <Route path="/callback" element={<VaAuthCallback />} />
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVaAuth } from '../hooks/useVaAuth';

export default function VaAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useVaAuth();
  const [status, setStatus] = useState('processing');
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Extract parameters from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Check for authorization errors
        if (error) {
          throw new Error(errorDescription || error);
        }

        // Validate required parameters
        if (!code || !state) {
          throw new Error('Missing authorization code or state parameter');
        }

        // Exchange code for tokens
        const result = await handleCallback(code, state);

        if (result.success) {
          setStatus('success');
          // Redirect to the main app after successful authentication
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 1500);
        } else {
          throw new Error(result.error || 'Authentication failed');
        }
      } catch (err) {
        console.error('[VA Auth Callback] Error:', err);
        setStatus('error');
        setErrorMessage(err.message);
      }
    };

    processCallback();
  }, [searchParams, handleCallback, navigate]);

  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        {status === 'processing' && (
          <div className="text-center">
            <div className="mb-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-va-blue"></div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Completing Sign In
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Securely connecting to VA.gov...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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

        {status === 'error' && (
          <div className="text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Authentication Failed
            </h2>
            <p className="text-red-600 dark:text-red-400 mb-4">
              {errorMessage || 'An error occurred during sign in'}
            </p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="px-6 py-2 bg-va-blue text-white rounded-lg hover:bg-blue-700 transition-colors"
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
