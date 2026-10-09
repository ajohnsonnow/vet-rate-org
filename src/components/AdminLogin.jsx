/**
 * Vet-Rate.org - Admin Login Component
 * Secure PIN-based authentication modal
 *
 * Security Features:
 * - PIN masking with show/hide toggle
 * - Rate limiting display
 * - Lockout notification
 * - No credentials in DOM
 * - Auto-clear on close
 *
 * This component is ONLY shown when triggered via Ctrl+Shift+A.
 * Regular users have no way to discover this exists.
 *
 * Built by a fellow veteran. "Authentication is the first line of defense."
 */

import { useState, useEffect, useRef } from "react";
import { useAdminAuth } from "../contexts/AdminAuthContext";
import ResponsiveModal from "./common/ResponsiveModal";
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  AlertTriangle,
  Loader2,
} from "lucide-react";

// Format lockout time
function formatLockoutTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Focus input when modal opens
function useFocusOnOpen(showAdminLogin, inputRef) {
  useEffect(() => {
    if (showAdminLogin && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showAdminLogin, inputRef]);
}

// Clear state when modal closes
function useClearOnClose(
  showAdminLogin,
  setPin,
  setShowPin,
  setError,
  setIsLoading,
) {
  useEffect(() => {
    if (!showAdminLogin) {
      setPin("");
      setShowPin(false);
      setError("");
      setIsLoading(false);
    }
  }, [showAdminLogin, setPin, setShowPin, setError, setIsLoading]);
}

// Handle PIN submission
async function submitPin({
  pin,
  lockoutInfo,
  authenticate,
  setPin,
  setError,
  setIsLoading,
  inputRef,
}) {
  if (lockoutInfo.isLocked) {
    return;
  }

  setIsLoading(true);
  setError("");

  try {
    const result = await authenticate(pin);

    if (!result.success) {
      setError(result.error);
      setPin("");
      inputRef.current?.focus();
    }
  } catch (err) {
    setError("Authentication error. Please try again.");
    console.error("Auth error:", err);
  }

  setIsLoading(false);
}

function AdminLoginHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-slate-600 dark:bg-slate-800">
      <div className="rounded-lg bg-amber-500/20 p-2">
        <Shield className="h-6 w-6 text-amber-500" />
      </div>
      <div>
        <h2
          id="admin-login-title"
          className="text-lg font-bold text-gray-900 dark:text-white"
        >
          Admin Authentication
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Secure access required
        </p>
      </div>
    </div>
  );
}

function AdminLoginFooter({ onCancel }) {
  return (
    <button
      onClick={onCancel}
      className="w-full py-2 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
    >
      Cancel
    </button>
  );
}

function LockoutWarning({ remainingTime }) {
  return (
    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
        <div>
          <p className="font-medium text-red-700 dark:text-red-400">
            Account Temporarily Locked
          </p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-300/70">
            Too many failed attempts. Please wait before trying again.
          </p>
          <p className="mt-2 font-mono text-lg text-red-700 dark:text-red-400">
            {formatLockoutTime(remainingTime)}
          </p>
        </div>
      </div>
    </div>
  );
}

function PinInputField({
  inputRef,
  showPin,
  setShowPin,
  pin,
  onPinChange,
  error,
  isLocked,
  isLoading,
}) {
  return (
    <div>
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
        Admin PIN
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <Lock className="h-5 w-5 text-gray-400 dark:text-slate-500" />
        </div>
        <input
          ref={inputRef}
          type={showPin ? "text" : "password"}
          value={pin}
          onChange={onPinChange}
          placeholder="Enter your PIN"
          maxLength={12}
          disabled={isLocked || isLoading}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          className={`w-full rounded-lg border bg-white py-3 pl-10 pr-12 font-mono text-lg tracking-widest text-gray-900 transition-all placeholder:text-gray-400 focus:outline-none focus:ring-2 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 ${
            error
              ? "border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:ring-amber-500 dark:border-slate-600"
          } ${isLocked ? "cursor-not-allowed opacity-50" : ""}`}
        />
        <button
          type="button"
          onClick={() => setShowPin(!showPin)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
          tabIndex={-1}
        >
          {showPin ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}

function SubmitButton({ isLocked, isLoading, pin }) {
  const isDisabled = isLocked || isLoading || pin.length < 6;
  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 font-semibold transition-all ${
        isDisabled
          ? "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-slate-700 dark:text-slate-500"
          : "bg-amber-500 text-slate-900 hover:bg-amber-400"
      }`}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Authenticating...
        </>
      ) : (
        <>
          <Shield className="h-5 w-5" />
          Authenticate
        </>
      )}
    </button>
  );
}

function SecurityNotice() {
  return (
    <div className="mt-6 border-t border-gray-200 pt-4 dark:border-slate-700">
      <p className="text-center text-xs text-gray-500 dark:text-slate-500">
        🔒 This session will expire after 30 minutes of inactivity.
        <br />
        All access attempts are logged for security.
      </p>
    </div>
  );
}

export default function AdminLogin() {
  const { showAdminLogin, closeAdminLogin, authenticate, lockoutInfo } =
    useAdminAuth();

  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  useFocusOnOpen(showAdminLogin, inputRef);
  useClearOnClose(showAdminLogin, setPin, setShowPin, setError, setIsLoading);

  const handleSubmit = (e) => {
    e.preventDefault();
    submitPin({
      pin,
      lockoutInfo,
      authenticate,
      setPin,
      setError,
      setIsLoading,
      inputRef,
    });
  };

  // Handle PIN input - only allow digits
  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, "");
    setPin(value);
    setError("");
  };

  return (
    <ResponsiveModal
      isOpen={showAdminLogin}
      onClose={closeAdminLogin}
      header={<AdminLoginHeader />}
      labelledBy="admin-login-title"
      size="sm"
      footer={<AdminLoginFooter onCancel={closeAdminLogin} />}
    >
      {/* Lockout Warning */}
      {lockoutInfo.isLocked && (
        <LockoutWarning remainingTime={lockoutInfo.remainingTime} />
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <PinInputField
            inputRef={inputRef}
            showPin={showPin}
            setShowPin={setShowPin}
            pin={pin}
            onPinChange={handlePinChange}
            error={error}
            isLocked={lockoutInfo.isLocked}
            isLoading={isLoading}
          />

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <SubmitButton
            isLocked={lockoutInfo.isLocked}
            isLoading={isLoading}
            pin={pin}
          />
        </div>
      </form>

      {/* Security Notice */}
      <SecurityNotice />
    </ResponsiveModal>
  );
}
