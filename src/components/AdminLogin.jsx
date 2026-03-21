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

import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAdminAuth } from "../contexts/AdminAuthContext";
import { useBodyScrollLock } from "../utils/useBodyScrollLock";
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export default function AdminLogin() {
  const { t } = useLanguage();
  const { showAdminLogin, closeAdminLogin, authenticate, lockoutInfo } =
    useAdminAuth();

  useBodyScrollLock(showAdminLogin);

  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  // Focus input when modal opens
  useEffect(() => {
    if (showAdminLogin && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showAdminLogin]);

  // Clear state when modal closes
  useEffect(() => {
    if (!showAdminLogin) {
      setPin("");
      setShowPin(false);
      setError("");
      setIsLoading(false);
    }
  }, [showAdminLogin]);

  // Handle PIN submission
  const handleSubmit = async (e) => {
    e.preventDefault();

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
  };

  // Handle PIN input - only allow digits
  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, "");
    setPin(value);
    setError("");
  };

  // Format lockout time
  const formatLockoutTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!showAdminLogin) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && closeAdminLogin()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 border-b border-slate-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Shield className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Admin Authentication
              </h2>
              <p className="text-xs text-slate-400">Secure access required</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Lockout Warning */}
          {lockoutInfo.isLocked && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-medium">
                    Account Temporarily Locked
                  </p>
                  <p className="text-red-300/70 text-sm mt-1">
                    Too many failed attempts. Please wait before trying again.
                  </p>
                  <p className="text-red-400 font-mono text-lg mt-2">
                    {formatLockoutTime(lockoutInfo.remainingTime)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* PIN Input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Admin PIN
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <Lock className="w-5 h-5 text-slate-500" />
                  </div>
                  <input
                    ref={inputRef}
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={handlePinChange}
                    placeholder="Enter your PIN"
                    maxLength={12}
                    disabled={lockoutInfo.isLocked || isLoading}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    className={`w-full pl-10 pr-12 py-3 bg-slate-800 border rounded-lg text-white placeholder-slate-500 font-mono text-lg tracking-widest focus:outline-none focus:ring-2 transition-all ${
                      error
                        ? "border-red-500 focus:ring-red-500"
                        : "border-slate-600 focus:ring-amber-500"
                    } ${lockoutInfo.isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPin ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={lockoutInfo.isLocked || isLoading || pin.length < 6}
                className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                  lockoutInfo.isLocked || isLoading || pin.length < 6
                    ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-400 text-slate-900"
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Authenticate
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-4 border-t border-slate-700">
            <p className="text-xs text-slate-500 text-center">
              🔒 This session will expire after 30 minutes of inactivity.
              <br />
              All access attempts are logged for security.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-800/50 px-6 py-3 border-t border-slate-700">
          <button
            onClick={closeAdminLogin}
            className="w-full py-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
