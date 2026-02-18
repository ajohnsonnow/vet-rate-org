/**
 * Vet-Rate.org - Rate Limiter Hook
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * "The Cooldown" - API Rate Limiting System
 * Prevents users from spamming AI generation buttons.
 * Protects against:
 * - Accidental double-clicks
 * - Bots and abuse
 * - Excessive API costs
 * - Hitting API rate limits
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Configuration
const DEFAULT_COOLDOWN_MS = 10000;       // 10 seconds between requests
const HOURLY_LIMIT = 20;                  // Max requests per hour
const HOURLY_LOCKOUT_MS = 60 * 60 * 1000; // 60 minute lockout when limit exceeded
const STORAGE_KEY_PREFIX = 'vetrate_ratelimit_';

/**
 * Get timestamps from localStorage
 * @param {string} feature - Feature name for namespacing
 * @returns {number[]} Array of timestamps
 */
function getStoredTimestamps(feature) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${feature}_timestamps`;
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Store timestamps to localStorage
 * @param {string} feature - Feature name for namespacing
 * @param {number[]} timestamps - Array of timestamps
 */
function setStoredTimestamps(feature, timestamps) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${feature}_timestamps`;
    localStorage.setItem(key, JSON.stringify(timestamps));
  } catch (e) {
    console.error('Failed to store rate limit timestamps:', e);
  }
}

/**
 * Get lockout expiration time from localStorage
 * @param {string} feature - Feature name for namespacing
 * @returns {number|null} Lockout expiration timestamp or null
 */
function getLockoutExpiration(feature) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${feature}_lockout`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return parseInt(stored, 10);
  } catch {
    return null;
  }
}

/**
 * Set lockout expiration time
 * @param {string} feature - Feature name for namespacing
 * @param {number|null} expiration - Expiration timestamp or null to clear
 */
function setLockoutExpiration(feature, expiration) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${feature}_lockout`;
    if (expiration === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, expiration.toString());
    }
  } catch (e) {
    console.error('Failed to store lockout expiration:', e);
  }
}

/**
 * Clean up old timestamps (older than 1 hour)
 * @param {number[]} timestamps - Array of timestamps
 * @returns {number[]} Filtered timestamps
 */
function cleanOldTimestamps(timestamps) {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  return timestamps.filter(ts => ts > oneHourAgo);
}

/**
 * useRateLimit Hook
 * 
 * @param {string} feature - Unique identifier for the feature (e.g., 'nexus', 'statement', 'ai')
 * @param {Object} options - Configuration options
 * @param {number} options.cooldownMs - Milliseconds between requests (default: 10000)
 * @param {number} options.hourlyLimit - Max requests per hour (default: 20)
 * @param {number} options.lockoutMs - Lockout duration when limit exceeded (default: 3600000)
 * 
 * @returns {Object} Rate limit state and controls
 */
export function useRateLimit(feature = 'default', options = {}) {
  const {
    cooldownMs = DEFAULT_COOLDOWN_MS,
    hourlyLimit = HOURLY_LIMIT,
    lockoutMs = HOURLY_LOCKOUT_MS
  } = options;

  // State
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Timer refs
  const cooldownTimerRef = useRef(null);
  const lockoutTimerRef = useRef(null);

  /**
   * Initialize state from localStorage
   */
  useEffect(() => {
    // Check for existing lockout
    const lockoutExpiration = getLockoutExpiration(feature);
    const now = Date.now();
    
    if (lockoutExpiration && lockoutExpiration > now) {
      setIsLocked(true);
      setLockoutEndTime(lockoutExpiration);
    } else if (lockoutExpiration) {
      // Clear expired lockout
      setLockoutExpiration(feature, null);
    }

    // Load timestamps and count requests in the last hour
    const timestamps = cleanOldTimestamps(getStoredTimestamps(feature));
    setRequestCount(timestamps.length);
    
    // Get the most recent request time
    if (timestamps.length > 0) {
      const mostRecent = Math.max(...timestamps);
      setLastRequestTime(mostRecent);
      
      // Calculate remaining cooldown
      const remaining = cooldownMs - (now - mostRecent);
      if (remaining > 0) {
        setCooldownRemaining(remaining);
      }
    }

    // Cleanup old timestamps in storage
    setStoredTimestamps(feature, timestamps);
  }, [feature, cooldownMs]);

  /**
   * Cooldown countdown timer
   */
  useEffect(() => {
    if (cooldownRemaining <= 0) {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      return;
    }

    cooldownTimerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, cooldownMs - (now - lastRequestTime));
      setCooldownRemaining(remaining);
      
      if (remaining <= 0) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    }, 100);

    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, [cooldownRemaining, lastRequestTime, cooldownMs]);

  /**
   * Lockout countdown timer
   */
  useEffect(() => {
    if (!isLocked || !lockoutEndTime) {
      setLockoutRemaining(0);
      if (lockoutTimerRef.current) {
        clearInterval(lockoutTimerRef.current);
        lockoutTimerRef.current = null;
      }
      return;
    }

    // Initial calculation
    const now = Date.now();
    setLockoutRemaining(Math.max(0, lockoutEndTime - now));

    lockoutTimerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, lockoutEndTime - now);
      setLockoutRemaining(remaining);
      
      if (remaining <= 0) {
        setIsLocked(false);
        setLockoutEndTime(null);
        setLockoutExpiration(feature, null);
        // Clear old timestamps to reset the counter
        setStoredTimestamps(feature, []);
        setRequestCount(0);
        clearInterval(lockoutTimerRef.current);
        lockoutTimerRef.current = null;
      }
    }, 1000);

    return () => {
      if (lockoutTimerRef.current) {
        clearInterval(lockoutTimerRef.current);
      }
    };
  }, [isLocked, lockoutEndTime, feature]);

  /**
   * Check if a request can be made
   * @returns {Object} { canRequest, reason, waitTime }
   */
  const checkCanRequest = useCallback(() => {
    const now = Date.now();

    // Check for lockout
    if (isLocked && lockoutEndTime && lockoutEndTime > now) {
      return {
        canRequest: false,
        reason: 'hourly_limit',
        waitTime: lockoutEndTime - now
      };
    }

    // Check cooldown
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < cooldownMs) {
      return {
        canRequest: false,
        reason: 'cooldown',
        waitTime: cooldownMs - timeSinceLastRequest
      };
    }

    // Check hourly limit
    const timestamps = cleanOldTimestamps(getStoredTimestamps(feature));
    if (timestamps.length >= hourlyLimit) {
      // Trigger lockout
      const lockoutExpiration = now + lockoutMs;
      setIsLocked(true);
      setLockoutEndTime(lockoutExpiration);
      setLockoutExpiration(feature, lockoutExpiration);
      
      return {
        canRequest: false,
        reason: 'hourly_limit',
        waitTime: lockoutMs
      };
    }

    return {
      canRequest: true,
      reason: null,
      waitTime: 0
    };
  }, [feature, cooldownMs, hourlyLimit, lockoutMs, lastRequestTime, isLocked, lockoutEndTime]);

  /**
   * Record a request (call this when the request is made)
   */
  const recordRequest = useCallback(() => {
    const now = Date.now();
    
    // Update state
    setLastRequestTime(now);
    setCooldownRemaining(cooldownMs);
    
    // Update stored timestamps
    const timestamps = cleanOldTimestamps(getStoredTimestamps(feature));
    timestamps.push(now);
    setStoredTimestamps(feature, timestamps);
    setRequestCount(timestamps.length);
    
    return timestamps.length;
  }, [feature, cooldownMs]);

  /**
   * Format remaining time for display
   * @param {number} ms - Milliseconds remaining
   * @returns {string} Formatted time string
   */
  const formatTimeRemaining = useCallback((ms) => {
    if (ms <= 0) return '';
    
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }, []);

  /**
   * Get the button text based on current state
   * @param {string} defaultText - Default button text when not rate limited
   * @returns {string} Button text to display
   */
  const getButtonText = useCallback((defaultText = 'Generate') => {
    if (isLocked) {
      return `Limit Reached (${formatTimeRemaining(lockoutRemaining)})`;
    }
    
    if (cooldownRemaining > 0) {
      return `AI Cooling Down (${formatTimeRemaining(cooldownRemaining)})...`;
    }
    
    return defaultText;
  }, [isLocked, cooldownRemaining, lockoutRemaining, formatTimeRemaining]);

  /**
   * Get status message for user feedback
   * @returns {Object|null} Status object or null if no restrictions
   */
  const getStatusMessage = useCallback(() => {
    if (isLocked) {
      return {
        type: 'error',
        icon: '⏳',
        title: 'Daily Limit Reached',
        message: `You've made ${hourlyLimit} AI requests this hour. Please review your existing drafts while waiting.`,
        timeRemaining: formatTimeRemaining(lockoutRemaining)
      };
    }
    
    if (requestCount >= hourlyLimit - 3 && requestCount < hourlyLimit) {
      return {
        type: 'warning',
        icon: '⚠️',
        title: 'Approaching Limit',
        message: `${hourlyLimit - requestCount} AI requests remaining this hour.`,
        timeRemaining: null
      };
    }
    
    return null;
  }, [isLocked, requestCount, hourlyLimit, lockoutRemaining, formatTimeRemaining]);

  /**
   * Reset the rate limiter (admin/debug function)
   */
  const reset = useCallback(() => {
    setStoredTimestamps(feature, []);
    setLockoutExpiration(feature, null);
    setLastRequestTime(0);
    setRequestCount(0);
    setIsLocked(false);
    setLockoutEndTime(null);
    setCooldownRemaining(0);
    setLockoutRemaining(0);
  }, [feature]);

  return {
    // State
    isLimited: isLocked || cooldownRemaining > 0,
    isLocked,
    isCoolingDown: cooldownRemaining > 0,
    cooldownRemaining,
    lockoutRemaining,
    requestCount,
    remainingRequests: Math.max(0, hourlyLimit - requestCount),
    hourlyLimit,
    
    // Actions
    checkCanRequest,
    recordRequest,
    reset,
    
    // Display helpers
    getButtonText,
    getStatusMessage,
    formatTimeRemaining
  };
}

/**
 * Higher-order function to wrap an async function with rate limiting
 * @param {Function} fn - The async function to wrap
 * @param {Object} rateLimiter - The rate limiter hook return value
 * @returns {Function} Wrapped function
 */
export function withRateLimit(fn, rateLimiter) {
  return async (...args) => {
    const { canRequest, reason, waitTime } = rateLimiter.checkCanRequest();
    
    if (!canRequest) {
      const errorMessage = reason === 'hourly_limit'
        ? `Daily limit reached. Please wait ${rateLimiter.formatTimeRemaining(waitTime)} before trying again.`
        : `Please wait ${rateLimiter.formatTimeRemaining(waitTime)} before making another request.`;
      
      throw new Error(errorMessage);
    }
    
    // Record the request
    rateLimiter.recordRequest();
    
    // Execute the wrapped function
    return fn(...args);
  };
}

export default useRateLimit;
