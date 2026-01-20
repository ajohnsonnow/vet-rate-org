/**
 * VA.gov Authentication Context
 * 
 * Provides authentication state and methods throughout the application.
 * Handles token storage, user info, and authentication status.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '../config/vaAuth';

// Create the context
const VaAuthContext = createContext(null);

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
   * Initialize authentication state from sessionStorage on mount
   */
  useEffect(() => {
    try {
      const storedAccessToken = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const storedRefreshToken = sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
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
      console.error('[VA Auth] Error loading auth state:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Store authentication tokens
   */
  const setAuth = useCallback((tokens, user = null) => {
    try {
      const { access_token, refresh_token, expires_in } = tokens;
      
      // Calculate expiry time (current time + expires_in seconds)
      const expiryTime = Date.now() + (expires_in * 1000);
      
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
      
      console.log('[VA Auth] Authentication successful');
    } catch (err) {
      console.error('[VA Auth] Error storing auth:', err);
      setError(err.message);
    }
  }, []);

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
    
    console.log('[VA Auth] Authentication cleared');
  }, []);

  /**
   * Check if the access token is expired
   */
  const isTokenExpired = useCallback(() => {
    if (!tokenExpiry) return true;
    
    // Add 60 second buffer for clock skew
    return Date.now() >= (tokenExpiry - 60000);
  }, [tokenExpiry]);

  /**
   * Set error state
   */
  const setAuthError = useCallback((errorMessage) => {
    setError(errorMessage);
    console.error('[VA Auth] Error:', errorMessage);
  }, []);

  // Context value
  const value = {
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

  return (
    <VaAuthContext.Provider value={value}>
      {children}
    </VaAuthContext.Provider>
  );
}

/**
 * Hook to access VA Auth context
 * Must be used within VaAuthProvider
 */
export function useVaAuthContext() {
  const context = useContext(VaAuthContext);
  
  if (!context) {
    throw new Error('useVaAuthContext must be used within VaAuthProvider');
  }
  
  return context;
}
