/**
 * VA.gov OAuth 2.0 Authentication Hook
 *
 * Implements Authorization Code Grant with PKCE (Proof Key for Code Exchange)
 * for secure client-side authentication without a backend server.
 *
 * PKCE Flow:
 * 1. Generate code_verifier (random string) and code_challenge (SHA256 hash)
 * 2. Store code_verifier in sessionStorage
 * 3. Redirect to VA.gov with code_challenge
 * 4. VA.gov redirects back with authorization code
 * 5. Exchange code + code_verifier for tokens
 *
 * @see https://developer.va.gov/explore/authorization/docs/authorization-code
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  VA_AUTH_CONFIG,
  VA_ENDPOINTS,
  VA_SCOPES,
  STORAGE_KEYS,
  isVaApiEnabled,
  VaApiDisabledError,
} from "../config/vaAuth";

// ============================================================================
// PKCE UTILITIES
// ============================================================================

/**
 * Generate a cryptographically random string for the code verifier
 * Must be between 43-128 characters
 */
function generateCodeVerifier() {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Generate the code challenge from the verifier using SHA-256
 */
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64URLEncode(new Uint8Array(hash));
}

/**
 * Base64 URL encode (RFC 4648)
 * Standard base64 with URL-safe characters
 */
function base64URLEncode(buffer) {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generate a random state parameter for CSRF protection
 */
function generateState() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

// ============================================================================
// TOKEN STORAGE
// ============================================================================

function saveTokens(tokenResponse) {
  const expiresAt = Date.now() + tokenResponse.expires_in * 1000;

  sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokenResponse.access_token);
  sessionStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiresAt.toString());

  if (tokenResponse.refresh_token) {
    sessionStorage.setItem(
      STORAGE_KEYS.REFRESH_TOKEN,
      tokenResponse.refresh_token,
    );
  }

  console.log(
    "[VA Auth] Tokens saved, expires at:",
    new Date(expiresAt).toLocaleString(),
  );
}

function getStoredTokens() {
  const accessToken = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  const expiryStr = sessionStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
  const expiry = expiryStr ? parseInt(expiryStr, 10) : null;

  return { accessToken, refreshToken, expiry };
}

function clearTokens() {
  sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  sessionStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  sessionStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
  sessionStorage.removeItem(STORAGE_KEYS.USER_INFO);
  sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
  sessionStorage.removeItem(STORAGE_KEYS.STATE);
  console.log("[VA Auth] Tokens cleared");
}

function isTokenExpired(expiry) {
  if (!expiry) return true;
  // Consider token expired 5 minutes before actual expiry
  return Date.now() > expiry - 5 * 60 * 1000;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useVaAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  const initRef = useRef(false);

  // Check existing authentication on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const checkAuth = async () => {
      console.log("[VA Auth] Checking existing authentication...");

      const { accessToken: storedToken, expiry } = getStoredTokens();

      if (storedToken && !isTokenExpired(expiry)) {
        console.log("[VA Auth] Found valid token");
        setAccessToken(storedToken);
        setIsAuthenticated(true);

        // Try to load cached user info
        const cachedUserInfo = sessionStorage.getItem(STORAGE_KEYS.USER_INFO);
        if (cachedUserInfo) {
          try {
            setUserInfo(JSON.parse(cachedUserInfo));
          } catch (e) {
            console.warn("[VA Auth] Failed to parse cached user info");
          }
        }

        // Fetch fresh user info
        try {
          const info = await fetchUserInfo(storedToken);
          setUserInfo(info);
          sessionStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(info));
        } catch (err) {
          console.warn("[VA Auth] Failed to fetch user info:", err.message);
        }
      } else if (storedToken && isTokenExpired(expiry)) {
        console.log("[VA Auth] Token expired, attempting refresh...");
        const { refreshToken } = getStoredTokens();
        if (refreshToken) {
          try {
            await refreshAccessToken(refreshToken);
          } catch (err) {
            console.warn("[VA Auth] Refresh failed:", err.message);
            clearTokens();
          }
        } else {
          clearTokens();
        }
      } else {
        console.log("[VA Auth] No valid authentication found");
      }

      setIsLoading(false);
    };

    checkAuth();
  }, []);

  /**
   * Fetch user info from VA.gov
   */
  const fetchUserInfo = async (token) => {
    const response = await fetch(VA_ENDPOINTS.userInfo, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    return response.json();
  };

  /**
   * Refresh the access token using the refresh token
   */
  const refreshAccessToken = async (refreshToken) => {
    if (!isVaApiEnabled()) {
      throw new VaApiDisabledError();
    }
    console.log("[VA Auth] Refreshing access token...");

    const response = await fetch(VA_ENDPOINTS.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: VA_AUTH_CONFIG.clientId,
        scope: VA_SCOPES,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Token refresh failed: ${response.status} - ${errorText}`,
      );
    }

    const tokenResponse = await response.json();
    saveTokens(tokenResponse);
    setAccessToken(tokenResponse.access_token);
    setIsAuthenticated(true);

    return tokenResponse;
  };

  /**
   * Initiate the OAuth login flow
   * Redirects the user to VA.gov for authentication
   */
  const login = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (!isVaApiEnabled()) {
        throw new VaApiDisabledError(
          "VA login is disabled pending re-credentialing. Set VITE_VA_API_ENABLED=true once access is restored.",
        );
      }

      // Validate configuration
      if (!VA_AUTH_CONFIG.clientId) {
        throw new Error("Missing VA Client ID. Check your .env file.");
      }
      if (!VA_AUTH_CONFIG.redirectUri) {
        throw new Error("Missing VA Redirect URI. Check your .env file.");
      }

      // Generate PKCE values
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateState();

      // Store for later verification
      sessionStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
      sessionStorage.setItem(STORAGE_KEYS.STATE, state);

      console.log("[VA Auth] Starting OAuth flow...");
      console.log("[VA Auth] Redirect URI:", VA_AUTH_CONFIG.redirectUri);

      // Build authorization URL
      const authUrl = new URL(VA_ENDPOINTS.authorization);
      authUrl.searchParams.set("client_id", VA_AUTH_CONFIG.clientId);
      authUrl.searchParams.set("redirect_uri", VA_AUTH_CONFIG.redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", VA_SCOPES);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");

      console.log("[VA Auth] Redirecting to:", authUrl.toString());

      // Redirect to VA.gov
      window.location.href = authUrl.toString();
    } catch (err) {
      console.error("[VA Auth] Login error:", err);
      setError(err.message);
      setIsLoading(false);
    }
  }, []);

  /**
   * Exchange authorization code for tokens
   * Called by the callback component after redirect
   */
  const exchangeCodeForTokens = useCallback(async (code, returnedState) => {
    setError(null);
    setIsLoading(true);

    try {
      if (!isVaApiEnabled()) {
        throw new VaApiDisabledError(
          "VA OAuth callback handled while API surface is disabled.",
        );
      }

      // Verify state to prevent CSRF
      const storedState = sessionStorage.getItem(STORAGE_KEYS.STATE);

      // If state is already cleared, this might be a duplicate call (React StrictMode)
      if (!storedState) {
        console.warn(
          "[VA Auth] State already cleared - possible duplicate callback",
        );
        // Check if we're already authenticated
        const existingToken = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        if (existingToken) {
          setIsLoading(false);
          return { success: true, message: "Already authenticated" };
        }
        throw new Error(
          "Authentication session expired. Please try logging in again.",
        );
      }

      if (returnedState !== storedState) {
        throw new Error("State mismatch - possible CSRF attack");
      }

      // Get the code verifier
      const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
      if (!codeVerifier) {
        throw new Error(
          "Missing code verifier - authentication flow corrupted",
        );
      }

      console.log("[VA Auth] Exchanging code for tokens...");

      // Exchange code for tokens
      const response = await fetch(VA_ENDPOINTS.token, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: VA_AUTH_CONFIG.redirectUri,
          client_id: VA_AUTH_CONFIG.clientId,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Token exchange failed: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage =
            errorJson.error_description || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const tokenResponse = await response.json();
      console.log("[VA Auth] Token exchange successful");

      // Save tokens
      saveTokens(tokenResponse);
      setAccessToken(tokenResponse.access_token);
      setIsAuthenticated(true);

      // Clean up PKCE values
      sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
      sessionStorage.removeItem(STORAGE_KEYS.STATE);

      // Fetch user info
      let userInfoData = null;
      try {
        userInfoData = await fetchUserInfo(tokenResponse.access_token);
        setUserInfo(userInfoData);
        sessionStorage.setItem(
          STORAGE_KEYS.USER_INFO,
          JSON.stringify(userInfoData),
        );
      } catch (err) {
        console.warn("[VA Auth] Failed to fetch user info:", err.message);
      }

      // Return token data WITH userInfo for popup communication
      return {
        ...tokenResponse,
        userInfo: userInfoData,
      };
    } catch (err) {
      console.error("[VA Auth] Token exchange error:", err);
      setError(err.message);
      clearTokens();
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout and revoke tokens
   */
  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      const { accessToken: token } = getStoredTokens();

      if (token) {
        // Attempt to revoke the token
        try {
          await fetch(VA_ENDPOINTS.revoke, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              token: token,
              client_id: VA_AUTH_CONFIG.clientId,
            }),
          });
          console.log("[VA Auth] Token revoked");
        } catch (err) {
          console.warn("[VA Auth] Token revocation failed:", err.message);
        }
      }
    } finally {
      clearTokens();
      setAccessToken(null);
      setUserInfo(null);
      setIsAuthenticated(false);
      setError(null);
      setIsLoading(false);
    }
  }, []);

  /**
   * Get a valid access token, refreshing if necessary
   */
  const getValidToken = useCallback(async () => {
    const { accessToken: token, refreshToken, expiry } = getStoredTokens();

    if (token && !isTokenExpired(expiry)) {
      return token;
    }

    if (refreshToken) {
      try {
        const response = await refreshAccessToken(refreshToken);
        return response.access_token;
      } catch (err) {
        console.error("[VA Auth] Failed to refresh token:", err);
        clearTokens();
        setIsAuthenticated(false);
        throw new Error("Session expired. Please log in again.");
      }
    }

    throw new Error("No valid authentication. Please log in.");
  }, []);

  return {
    isAuthenticated,
    isLoading,
    error,
    userInfo,
    accessToken,
    login,
    logout,
    exchangeCodeForTokens,
    getValidToken,
  };
}

export default useVaAuth;
