/**
 * VA.gov Authentication Hook
 * 
 * Main hook for handling VA.gov OAuth 2.0 authentication with PKCE.
 * Provides login, logout, token exchange, and user info fetching.
 */

import { useCallback } from 'react';
import { useVaAuthContext } from '../contexts/VaAuthContext';
import { VA_AUTH_CONFIG, VA_ENDPOINTS, VA_SCOPES, STORAGE_KEYS, validateConfig } from '../config/vaAuth';
import { generatePKCEPair, generateState } from '../utils/pkce';

export function useVaAuth() {
  const {
    isAuthenticated,
    accessToken,
    userInfo,
    isLoading,
    error,
    setAuth,
    clearAuth,
    isTokenExpired,
    setError,
  } = useVaAuthContext();

  /**
   * Initiate the OAuth login flow
   * Generates PKCE parameters and redirects to VA.gov
   */
  const login = useCallback(async () => {
    try {
      // Validate configuration
      if (!validateConfig()) {
        throw new Error('Invalid VA.gov OAuth configuration. Check your environment variables.');
      }

      console.log('[VA Auth] Starting login flow...');

      // Generate PKCE parameters
      const { verifier, challenge } = await generatePKCEPair();
      const state = generateState();

      // Store the code_verifier and state in sessionStorage
      // We'll need these when handling the callback
      sessionStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, verifier);
      sessionStorage.setItem(STORAGE_KEYS.STATE, state);

      // Build the authorization URL
      const authUrl = new URL(VA_ENDPOINTS.authorization);
      authUrl.searchParams.set('client_id', VA_AUTH_CONFIG.clientId);
      authUrl.searchParams.set('redirect_uri', VA_AUTH_CONFIG.redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', VA_SCOPES);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      console.log('[VA Auth] Redirecting to VA.gov authorization...');
      
      // Redirect to VA.gov
      window.location.href = authUrl.toString();
    } catch (err) {
      console.error('[VA Auth] Login error:', err);
      setError(err.message);
    }
  }, [setError]);

  /**
   * Handle the OAuth callback after VA.gov redirects back
   * Exchange the authorization code for an access token
   */
  const handleCallback = useCallback(async (code, state) => {
    try {
      console.log('[VA Auth] Handling callback...');

      // Validate state parameter (CSRF protection)
      const storedState = sessionStorage.getItem(STORAGE_KEYS.STATE);
      if (state !== storedState) {
        throw new Error('State mismatch - possible CSRF attack');
      }

      // Retrieve the code_verifier
      const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
      if (!codeVerifier) {
        throw new Error('Code verifier not found - session may have expired');
      }

      // Clean up stored PKCE parameters
      sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
      sessionStorage.removeItem(STORAGE_KEYS.STATE);

      // Exchange the authorization code for tokens
      console.log('[VA Auth] Exchanging code for tokens...');
      const tokenResponse = await fetch(VA_ENDPOINTS.token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: VA_AUTH_CONFIG.redirectUri,
          client_id: VA_AUTH_CONFIG.clientId,
          code_verifier: codeVerifier,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error_description || 
          errorData.error || 
          `Token exchange failed: ${tokenResponse.status}`
        );
      }

      const tokens = await tokenResponse.json();
      console.log('[VA Auth] Tokens received successfully');

      // Fetch user info
      const user = await fetchUserInfo(tokens.access_token);

      // Store authentication
      setAuth(tokens, user);

      return { success: true };
    } catch (err) {
      console.error('[VA Auth] Callback error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [setAuth, setError]);

  /**
   * Fetch user information from VA.gov
   */
  const fetchUserInfo = async (token) => {
    try {
      console.log('[VA Auth] Fetching user info...');
      
      const response = await fetch(VA_ENDPOINTS.userInfo, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }

      const userInfo = await response.json();
      console.log('[VA Auth] User info retrieved');
      
      return userInfo;
    } catch (err) {
      console.error('[VA Auth] Error fetching user info:', err);
      // Don't fail the whole auth flow if user info fails
      return null;
    }
  };

  /**
   * Refresh the access token using the refresh token
   */
  const refreshAccessToken = useCallback(async (refreshToken) => {
    try {
      console.log('[VA Auth] Refreshing access token...');

      const response = await fetch(VA_ENDPOINTS.token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: VA_AUTH_CONFIG.clientId,
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokens = await response.json();
      
      // Fetch updated user info
      const user = await fetchUserInfo(tokens.access_token);
      
      // Update stored authentication
      setAuth(tokens, user);

      console.log('[VA Auth] Token refreshed successfully');
      return { success: true };
    } catch (err) {
      console.error('[VA Auth] Token refresh error:', err);
      // If refresh fails, user needs to log in again
      clearAuth();
      return { success: false, error: err.message };
    }
  }, [setAuth, clearAuth]);

  /**
   * Revoke the access token and log out
   */
  const logout = useCallback(async () => {
    try {
      console.log('[VA Auth] Logging out...');

      // Attempt to revoke the token at VA.gov
      if (accessToken) {
        try {
          await fetch(VA_ENDPOINTS.revoke, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              token: accessToken,
              client_id: VA_AUTH_CONFIG.clientId,
            }),
          });
        } catch (err) {
          // Log but don't fail logout if revocation fails
          console.warn('[VA Auth] Token revocation failed:', err);
        }
      }

      // Clear local authentication state
      clearAuth();
      
      console.log('[VA Auth] Logout successful');
    } catch (err) {
      console.error('[VA Auth] Logout error:', err);
      // Clear local state even if remote revocation fails
      clearAuth();
    }
  }, [accessToken, clearAuth]);

  /**
   * Make an authenticated API request to VA.gov
   */
  const fetchVaApi = useCallback(async (endpoint, options = {}) => {
    try {
      // Check if token is expired and try to refresh
      if (isTokenExpired() && refreshAccessToken) {
        const refreshResult = await refreshAccessToken();
        if (!refreshResult.success) {
          throw new Error('Session expired. Please log in again.');
        }
      }

      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(endpoint, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('[VA Auth] API request error:', err);
      throw err;
    }
  }, [accessToken, isTokenExpired, refreshAccessToken]);

  return {
    // Authentication state
    isAuthenticated,
    isLoading,
    error,
    accessToken,
    userInfo,
    
    // Authentication methods
    login,
    logout,
    handleCallback,
    refreshAccessToken,
    
    // API helper
    fetchVaApi,
  };
}
