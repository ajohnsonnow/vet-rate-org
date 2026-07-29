/**
 * Vet-Rate.org - Admin Authentication Context
 * Gold Standard Security Implementation
 *
 * Security Features:
 * - PIN-based authentication with SHA-256 hashing
 * - Session timeout (30 minutes of inactivity)
 * - Account lockout after failed attempts
 * - Audit logging of all authentication events
 * - No credentials stored in localStorage (session only)
 *
 * IMPORTANT: Admin features are completely hidden from regular users.
 * Access is only via secret keyboard shortcut (Ctrl+Shift+A).
 *
 * Built by a fellow veteran. "Security is mission-critical."
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

// ============================================
// SECURITY CONFIGURATION
// ============================================

const SECURITY_CONFIG = {
  // Session timeout in milliseconds (30 minutes)
  SESSION_TIMEOUT: 30 * 60 * 1000,

  // Maximum failed login attempts before lockout
  MAX_FAILED_ATTEMPTS: 5,

  // Lockout duration in milliseconds (15 minutes)
  LOCKOUT_DURATION: 15 * 60 * 1000,

  // Session check interval (1 minute)
  SESSION_CHECK_INTERVAL: 60 * 1000,

  // Minimum PIN length
  MIN_PIN_LENGTH: 6,
};

// ============================================
// ADMIN CONFIGURATION
// Pre-hashed PINs for security (SHA-256)
// To add a new admin: hash their PIN and add to this array
// ============================================

// SHA-256 hash of admin PINs
// IMPORTANT: These are hashed values, not plaintext PINs
// To generate: await hashPin('your-pin-here')
const ADMIN_CREDENTIALS = [
  {
    id: "admin_001",
    name: "Anthony Johnson",
    email: "Anth@StructuredForGrowth.com",
    // This is a placeholder - you'll need to set your actual PIN hash
    // Generate with: console.log(await hashPin('your-secure-pin'))
    pinHash: import.meta.env.VITE_ADMIN_PIN_HASH || "SET_YOUR_PIN_HASH_IN_ENV",
    role: "super_admin",
    createdAt: "2024-01-01",
  },
  // Future admins can be added here
];

// ============================================
// CRYPTO UTILITIES
// ============================================

/**
 * Hash a PIN using SHA-256
 * @param {string} pin - The PIN to hash
 * @returns {Promise<string>} - The hashed PIN
 */
export const hashPin = async (pin) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "vetrate_salt_2024"); // Add salt
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * Verify a PIN against a hash
 * @param {string} pin - The PIN to verify
 * @param {string} hash - The hash to compare against
 * @returns {Promise<boolean>} - Whether the PIN matches
 */
const verifyPin = async (pin, hash) => {
  const pinHash = await hashPin(pin);
  // Constant-time comparison to prevent timing attacks
  if (pinHash.length !== hash.length) return false;
  let result = 0;
  for (let i = 0; i < pinHash.length; i++) {
    result |= pinHash.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return result === 0;
};

// ============================================
// AUDIT LOGGING
// ============================================

const AUDIT_LOG_KEY = "vetrate_admin_audit";

/**
 * Log an authentication event
 * @param {string} event - Event type
 * @param {Object} details - Event details
 */
const logAuthEvent = (event, details = {}) => {
  try {
    const logs = JSON.parse(sessionStorage.getItem(AUDIT_LOG_KEY) || "[]");
    logs.push({
      timestamp: new Date().toISOString(),
      event,
      ...details,
      userAgent: navigator.userAgent.substring(0, 100), // Truncate for privacy
    });
    // Keep only last 100 events
    if (logs.length > 100) logs.shift();
    sessionStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error("Audit log error:", error);
  }
};

/**
 * Get audit log
 * @returns {Array} - Audit log entries
 */
export const getAuthAuditLog = () => {
  try {
    return JSON.parse(sessionStorage.getItem(AUDIT_LOG_KEY) || "[]");
  } catch {
    return [];
  }
};

// ============================================
// LOCKOUT MANAGEMENT
// ============================================

const LOCKOUT_KEY = "vetrate_admin_lockout";

/**
 * Get lockout status
 * @returns {Object} - Lockout status
 */
const getLockoutStatus = () => {
  try {
    const data = JSON.parse(localStorage.getItem(LOCKOUT_KEY) || "{}");
    return {
      failedAttempts: data.failedAttempts || 0,
      lockedUntil: data.lockedUntil || null,
    };
  } catch {
    return { failedAttempts: 0, lockedUntil: null };
  }
};

/**
 * Update lockout status
 * @param {number} failedAttempts - Number of failed attempts
 * @param {number|null} lockedUntil - Lockout expiry timestamp
 */
const setLockoutStatus = (failedAttempts, lockedUntil = null) => {
  localStorage.setItem(
    LOCKOUT_KEY,
    JSON.stringify({ failedAttempts, lockedUntil }),
  );
};

/**
 * Clear lockout status
 */
const clearLockout = () => {
  localStorage.removeItem(LOCKOUT_KEY);
};

/**
 * Check if currently locked out
 * @returns {Object} - { isLocked, remainingTime }
 */
const checkLockout = () => {
  const { lockedUntil } = getLockoutStatus();
  if (!lockedUntil) return { isLocked: false, remainingTime: 0 };

  const remaining = lockedUntil - Date.now();
  if (remaining <= 0) {
    clearLockout();
    return { isLocked: false, remainingTime: 0 };
  }

  return { isLocked: true, remainingTime: remaining };
};

// ============================================
// CONTEXT
// ============================================

const AdminAuthContext = createContext(null);

/**
 * Check lockout status on mount and keep it ticking while locked.
 */
function useLockoutMountEffect(setLockoutInfo) {
  useEffect(() => {
    const status = checkLockout();
    setLockoutInfo(status);

    // Update lockout timer
    if (status.isLocked) {
      const timer = setInterval(() => {
        const newStatus = checkLockout();
        setLockoutInfo(newStatus);
        if (!newStatus.isLocked) clearInterval(timer);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [setLockoutInfo]);
}

/**
 * Session timeout checker
 */
function useSessionTimeoutEffect(isAuthenticated, sessionExpiry, logout) {
  useEffect(() => {
    if (!isAuthenticated || !sessionExpiry) return;

    const checkSession = () => {
      if (Date.now() > sessionExpiry) {
        logout("Session expired");
      }
    };

    const interval = setInterval(
      checkSession,
      SECURITY_CONFIG.SESSION_CHECK_INTERVAL,
    );
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, sessionExpiry]);
}

/**
 * Listen for user activity to extend session
 */
function useActivityListenerEffect(isAuthenticated, extendSession) {
  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    const handler = () => extendSession();

    events.forEach((event) =>
      window.addEventListener(event, handler, { passive: true }),
    );
    return () =>
      events.forEach((event) => window.removeEventListener(event, handler));
  }, [isAuthenticated, extendSession]);
}

/**
 * Secret keyboard shortcut: Ctrl+Shift+A
 */
function useAdminKeyboardShortcut(
  openAdminLogin,
  showAdminLogin,
  showAdminPanel,
  setShowAdminLogin,
  setShowAdminPanel,
) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Shift+A to open admin login/panel
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        openAdminLogin();
      }

      // Escape to close modals
      if (e.key === "Escape") {
        if (showAdminLogin) setShowAdminLogin(false);
        if (showAdminPanel) setShowAdminPanel(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    openAdminLogin,
    showAdminLogin,
    showAdminPanel,
    setShowAdminLogin,
    setShowAdminPanel,
  ]);
}

/**
 * Bundles the admin login/panel open/close actions.
 */
function useAdminPanelActions(
  isAuthenticated,
  extendSession,
  currentAdmin,
  setShowAdminLogin,
  setShowAdminPanel,
) {
  /**
   * Open admin login modal (via secret shortcut)
   */
  const openAdminLogin = useCallback(() => {
    if (!isAuthenticated) {
      setShowAdminLogin(true);
      logAuthEvent("LOGIN_MODAL_OPENED");
    } else {
      setShowAdminPanel(true);
      extendSession();
    }
  }, [isAuthenticated, extendSession, setShowAdminLogin, setShowAdminPanel]);

  /**
   * Close admin login modal
   */
  const closeAdminLogin = useCallback(() => {
    setShowAdminLogin(false);
  }, [setShowAdminLogin]);

  /**
   * Open admin panel (if authenticated)
   */
  const openAdminPanel = useCallback(() => {
    if (isAuthenticated) {
      setShowAdminPanel(true);
      extendSession();
      logAuthEvent("ADMIN_PANEL_OPENED", { adminId: currentAdmin?.id });
    }
  }, [isAuthenticated, extendSession, currentAdmin, setShowAdminPanel]);

  /**
   * Close admin panel
   */
  const closeAdminPanel = useCallback(() => {
    setShowAdminPanel(false);
  }, [setShowAdminPanel]);

  return { openAdminLogin, closeAdminLogin, openAdminPanel, closeAdminPanel };
}

/**
 * Attempt to authenticate with PIN
 * @param {string} pin - The PIN to authenticate with
 * @param {Object} setters - State setters from AdminAuthProvider
 * @returns {Promise<Object>} - { success, error }
 */
async function performAuthenticate(pin, setters) {
  const {
    setIsAuthenticated,
    setCurrentAdmin,
    setSessionExpiry,
    setShowAdminLogin,
    setLockoutInfo,
  } = setters;

  // Check lockout first
  const lockStatus = checkLockout();
  if (lockStatus.isLocked) {
    const minutes = Math.ceil(lockStatus.remainingTime / 60000);
    logAuthEvent("LOGIN_BLOCKED", { reason: "lockout" });
    return {
      success: false,
      error: `Account locked. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`,
    };
  }

  // Validate PIN format
  if (!pin || pin.length < SECURITY_CONFIG.MIN_PIN_LENGTH) {
    return { success: false, error: "Invalid PIN format" };
  }

  // Try to authenticate against each admin
  for (const admin of ADMIN_CREDENTIALS) {
    const isValid = await verifyPin(pin, admin.pinHash);

    if (isValid) {
      // Success!
      clearLockout();
      setIsAuthenticated(true);
      setCurrentAdmin(admin);
      setSessionExpiry(Date.now() + SECURITY_CONFIG.SESSION_TIMEOUT);
      setShowAdminLogin(false);

      logAuthEvent("LOGIN_SUCCESS", {
        adminId: admin.id,
        role: admin.role,
      });

      return { success: true };
    }
  }

  // Failed attempt
  const { failedAttempts } = getLockoutStatus();
  const newAttempts = failedAttempts + 1;

  logAuthEvent("LOGIN_FAILED", { attempts: newAttempts });

  if (newAttempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
    const lockedUntil = Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION;
    setLockoutStatus(newAttempts, lockedUntil);
    setLockoutInfo({
      isLocked: true,
      remainingTime: SECURITY_CONFIG.LOCKOUT_DURATION,
    });

    logAuthEvent("ACCOUNT_LOCKED", {
      duration: SECURITY_CONFIG.LOCKOUT_DURATION,
    });

    return {
      success: false,
      error: "Too many failed attempts. Account locked for 15 minutes.",
    };
  }

  setLockoutStatus(newAttempts);
  const remaining = SECURITY_CONFIG.MAX_FAILED_ATTEMPTS - newAttempts;

  return {
    success: false,
    error: `Invalid PIN. ${remaining} attempt${remaining > 1 ? "s" : ""} remaining.`,
  };
}

export function AdminAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [sessionExpiry, setSessionExpiry] = useState(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState({
    isLocked: false,
    remainingTime: 0,
  });

  useLockoutMountEffect(setLockoutInfo);

  /**
   * Logout and clear session
   * @param {string} reason - Logout reason for audit
   */
  const logout = useCallback(
    (reason = "User logout") => {
      logAuthEvent("LOGOUT", { reason, adminId: currentAdmin?.id });

      setIsAuthenticated(false);
      setCurrentAdmin(null);
      setSessionExpiry(null);
      setShowAdminPanel(false);
    },
    [currentAdmin],
  );

  useSessionTimeoutEffect(isAuthenticated, sessionExpiry, logout);

  // Extend session on activity
  const extendSession = useCallback(() => {
    if (isAuthenticated) {
      setSessionExpiry(Date.now() + SECURITY_CONFIG.SESSION_TIMEOUT);
    }
  }, [isAuthenticated]);

  useActivityListenerEffect(isAuthenticated, extendSession);

  /**
   * Attempt to authenticate with PIN
   * @param {string} pin - The PIN to authenticate with
   * @returns {Promise<Object>} - { success, error }
   */
  const authenticate = (pin) =>
    performAuthenticate(pin, {
      setIsAuthenticated,
      setCurrentAdmin,
      setSessionExpiry,
      setShowAdminLogin,
      setLockoutInfo,
    });

  const { openAdminLogin, closeAdminLogin, openAdminPanel, closeAdminPanel } =
    useAdminPanelActions(
      isAuthenticated,
      extendSession,
      currentAdmin,
      setShowAdminLogin,
      setShowAdminPanel,
    );

  useAdminKeyboardShortcut(
    openAdminLogin,
    showAdminLogin,
    showAdminPanel,
    setShowAdminLogin,
    setShowAdminPanel,
  );

  const value = {
    // State
    isAuthenticated,
    currentAdmin,
    sessionExpiry,
    showAdminLogin,
    showAdminPanel,
    lockoutInfo,

    // Actions
    authenticate,
    logout,
    openAdminLogin,
    closeAdminLogin,
    openAdminPanel,
    closeAdminPanel,
    extendSession,

    // Config (for display)
    sessionTimeout: SECURITY_CONFIG.SESSION_TIMEOUT,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

/**
 * Hook to use admin auth context
 */
export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
}

export default AdminAuthContext;
