/**
 * VA.gov Authentication Context
 *
 * Provides authentication state and methods throughout the application.
 * Handles token storage, user info, and authentication status.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { STORAGE_KEYS } from "../config/vaAuth";

// Create the context
const VaAuthContext = createContext(null);

/**
 * Listen for OAuth popup completion messages and apply the resulting
 * auth state. Extracted so VaAuthProvider stays within line limits.
 */
function useOAuthPopupListener({
  setAccessToken,
  setRefreshToken,
  setTokenExpiry,
  setUserInfo,
  setIsAuthenticated,
  setError,
}) {
  useEffect(() => {
    const handleMessage = (event) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) return;

      const { type, data, error: authErr } = event.data || {};

      if (type === "VA_AUTH_SUCCESS" && data) {
        // eslint-disable-next-line no-console
        console.log(
          "[VA Auth] Received success message from popup with token data",
        );

        // The popup sends us the actual token data since sessionStorage isn't shared
        const {
          access_token,
          refresh_token,
          expires_in,
          userInfo: popupUserInfo,
          autoImport,
        } = data;

        if (access_token) {
          // Calculate expiry time
          const expiryTime = Date.now() + (expires_in || 3600) * 1000;

          // Update React state
          setAccessToken(access_token);
          setRefreshToken(refresh_token || null);
          setTokenExpiry(expiryTime);
          setUserInfo(popupUserInfo || null);
          setIsAuthenticated(true);
          setError(null);

          // Set auto-import flag so MyPacket will auto-fetch records
          if (autoImport) {
            sessionStorage.setItem("va_auth_just_connected", "true");
          }

          // Also store in sessionStorage for persistence
          sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token);
          if (refresh_token) {
            sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token);
          }
          sessionStorage.setItem(
            STORAGE_KEYS.TOKEN_EXPIRY,
            expiryTime.toString(),
          );
          if (popupUserInfo) {
            sessionStorage.setItem(
              STORAGE_KEYS.USER_INFO,
              JSON.stringify(popupUserInfo),
            );
          }

          // eslint-disable-next-line no-console
          console.log("[VA Auth] Authentication state updated from popup");
        }
      } else if (type === "VA_AUTH_ERROR") {
        console.error("[VA Auth] Received error from popup:", authErr);
        setError(authErr);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    setAccessToken,
    setRefreshToken,
    setTokenExpiry,
    setUserInfo,
    setIsAuthenticated,
    setError,
  ]);
}

/**
 * Initialize authentication state from sessionStorage on mount.
 * Extracted so VaAuthProvider stays within line limits.
 */
function useAuthInitFromStorage({
  setAccessToken,
  setRefreshToken,
  setTokenExpiry,
  setUserInfo,
  setIsAuthenticated,
  setIsLoading,
  setError,
  clearAuth,
}) {
  useEffect(() => {
    try {
      const storedAccessToken = sessionStorage.getItem(
        STORAGE_KEYS.ACCESS_TOKEN,
      );
      const storedRefreshToken = sessionStorage.getItem(
        STORAGE_KEYS.REFRESH_TOKEN,
      );
      const storedExpiry = sessionStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
      const storedUserInfo = sessionStorage.getItem(STORAGE_KEYS.USER_INFO);

      if (storedAccessToken) {
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
        setTokenExpiry(storedExpiry ? parseInt(storedExpiry, 10) : null);
        setUserInfo(storedUserInfo ? JSON.parse(storedUserInfo) : null);

        // Check if token is expired
        const now = Date.now();
        if (storedExpiry && parseInt(storedExpiry, 10) > now) {
          setIsAuthenticated(true);
        } else {
          // Token expired, clear it
          clearAuth();
        }
      }
    } catch (err) {
      console.error("[VA Auth] Error loading auth state:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [
    setAccessToken,
    setRefreshToken,
    setTokenExpiry,
    setUserInfo,
    setIsAuthenticated,
    setIsLoading,
    setError,
    clearAuth,
  ]);
}

/**
 * Store authentication tokens in state and sessionStorage.
 * Extracted so VaAuthProvider stays within line limits.
 */
function performSetAuth(
  tokens,
  user,
  {
    setAccessToken,
    setRefreshToken,
    setTokenExpiry,
    setUserInfo,
    setIsAuthenticated,
    setError,
  },
) {
  try {
    const { access_token, refresh_token, expires_in } = tokens;

    // Calculate expiry time (current time + expires_in seconds)
    const expiryTime = Date.now() + expires_in * 1000;

    // Store in state
    setAccessToken(access_token);
    setRefreshToken(refresh_token);
    setTokenExpiry(expiryTime);
    setUserInfo(user);
    setIsAuthenticated(true);
    setError(null);

    // Persist to sessionStorage
    sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token);
    if (refresh_token) {
      sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token);
    }
    sessionStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
    if (user) {
      sessionStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user));
    }

    // eslint-disable-next-line no-console
    console.log("[VA Auth] Authentication successful");
  } catch (err) {
    console.error("[VA Auth] Error storing auth:", err);
    setError(err.message);
  }
}

function buildVaAuthContextValue({
  isAuthenticated,
  accessToken,
  refreshToken,
  tokenExpiry,
  userInfo,
  isLoading,
  error,
  setAuth,
  clearAuth,
  isTokenExpired,
  setAuthError,
}) {
  return {
    // State
    isAuthenticated,
    accessToken,
    refreshToken,
    tokenExpiry,
    userInfo,
    isLoading,
    error,

    // Methods
    setAuth,
    clearAuth,
    isTokenExpired,
    setError: setAuthError,
  };
}

/**
 * VA Auth Provider Component
 * Wrap your app with this to provide authentication state
 */
export function VaAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [tokenExpiry, setTokenExpiry] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Clear authentication state
   */
  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setTokenExpiry(null);
    setUserInfo(null);
    setIsAuthenticated(false);
    setError(null);

    // Clear from sessionStorage
    sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    sessionStorage.removeItem(STORAGE_KEYS.USER_INFO);

    // eslint-disable-next-line no-console
    console.log("[VA Auth] Authentication cleared");
  }, []);

  useAuthInitFromStorage({
    setAccessToken,
    setRefreshToken,
    setTokenExpiry,
    setUserInfo,
    setIsAuthenticated,
    setIsLoading,
    setError,
    clearAuth,
  });

  useOAuthPopupListener({
    setAccessToken,
    setRefreshToken,
    setTokenExpiry,
    setUserInfo,
    setIsAuthenticated,
    setError,
  });

  /**
   * Store authentication tokens
   */
  const setAuth = useCallback(
    (tokens, user = null) =>
      performSetAuth(tokens, user, {
        setAccessToken,
        setRefreshToken,
        setTokenExpiry,
        setUserInfo,
        setIsAuthenticated,
        setError,
      }),
    [],
  );

  /**
   * Check if the access token is expired
   */
  const isTokenExpired = useCallback(() => {
    if (!tokenExpiry) return true;

    // Add 60 second buffer for clock skew
    return Date.now() >= tokenExpiry - 60000;
  }, [tokenExpiry]);

  /**
   * Set error state
   */
  const setAuthError = useCallback((errorMessage) => {
    setError(errorMessage);
    console.error("[VA Auth] Error:", errorMessage);
  }, []);

  // Context value
  const value = buildVaAuthContextValue({
    isAuthenticated,
    accessToken,
    refreshToken,
    tokenExpiry,
    userInfo,
    isLoading,
    error,
    setAuth,
    clearAuth,
    isTokenExpired,
    setAuthError,
  });

  return (
    <VaAuthContext.Provider value={value}>{children}</VaAuthContext.Provider>
  );
}

/**
 * Hook to access VA Auth context
 * Must be used within VaAuthProvider
 */
export function useVaAuthContext() {
  const context = useContext(VaAuthContext);

  if (!context) {
    throw new Error("useVaAuthContext must be used within VaAuthProvider");
  }

  return context;
}
