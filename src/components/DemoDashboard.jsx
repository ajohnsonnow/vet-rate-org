/**
 * VA Production Access Demo Dashboard
 *
 * Professional demonstration component for VA.gov API integration showcase.
 * Designed for Nathan's Production Access Review meeting.
 *
 * Features:
 * - System Status Overview with visual indicators
 * - OAuth 2.0 PKCE authentication workflow
 * - Real-time API connection testing
 * - Raw JSON inspector for technical proof
 * - Professional presentation mode
 */

import { useState, useEffect, useCallback } from "react";
import { useVaAuth } from "../hooks/useVaAuth";
import {
  getServiceHistory,
  getClaims,
  getFacilities,
  searchForms,
  getBenefitsReferenceDisabilities,
  formatServiceHistory,
  formatClaims,
  formatForms,
  formatBenefitsDisabilities,
  formatFacilities,
} from "../api/va";
import {
  VA_FACILITIES_API_KEY,
  VA_FORMS_API_KEY,
  VA_BENEFITS_REF_API_KEY,
  VA_AUTH_CONFIG,
} from "../config/vaAuth";
import ResponsiveModal from "./common/ResponsiveModal";

// Icons
import {
  Shield,
  FileText,
  LogIn,
  LogOut,
  User,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  AlertCircle,
  MapPin,
  Database,
  Briefcase,
  Medal,
  Lock,
  Unlock,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  Play,
  Terminal,
  Activity,
  Zap,
} from "lucide-react";

// =============================================================================
// STATUS HELPERS
// =============================================================================

const PENDING_ENTRY = { status: "pending", data: null, rawData: null, error: null };
const SKIPPED_ENTRY = { status: "skipped", data: null, rawData: null, error: null };

const INITIAL_API_STATUS = {
  // OAuth-protected APIs
  serviceHistory: { ...PENDING_ENTRY },
  claims: { ...PENDING_ENTRY },
  // API Key APIs (Open Data)
  facilities: { ...PENDING_ENTRY },
  forms: { ...PENDING_ENTRY },
  benefitsRef: { ...PENDING_ENTRY },
  // Skipped/Future APIs
  appealsStatus: { ...SKIPPED_ENTRY },
  appealableIssues: { ...SKIPPED_ENTRY },
};

function getStatusCounts(apiStatus) {
  const statuses = Object.values(apiStatus);
  return {
    success: statuses.filter((s) => s.status === "success").length,
    error: statuses.filter((s) => s.status === "error").length,
    pending: statuses.filter(
      (s) => s.status === "pending" || s.status === "loading",
    ).length,
    skipped: statuses.filter((s) => s.status === "skipped").length,
    sandbox_limit: statuses.filter((s) => s.status === "sandbox_limit")
      .length,
  };
}

function getCardBorderClass(statusValue) {
  if (statusValue === "success") return "border-green-200 dark:border-green-800";
  if (statusValue === "sandbox_limit")
    return "border-orange-200 dark:border-orange-800";
  if (statusValue === "error") return "border-red-200 dark:border-red-800";
  if (statusValue === "skipped")
    return "border-gray-200 dark:border-gray-700 opacity-60";
  return "border-gray-200 dark:border-gray-700";
}

function getCardIconWrapperClass(statusValue) {
  if (statusValue === "success")
    return "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400";
  if (statusValue === "sandbox_limit")
    return "bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400";
  if (statusValue === "error")
    return "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400";
  if (statusValue === "skipped")
    return "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500";
  return "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400";
}

// =============================================================================
// API TEST HELPERS (plain async functions - no hooks, receive setApiStatus)
// =============================================================================

async function testFacilitiesApi(setApiStatus) {
  setApiStatus((prev) => ({
    ...prev,
    facilities: { ...prev.facilities, status: "loading" },
  }));
  try {
    const data = await getFacilities(VA_FACILITIES_API_KEY, {
      lat: 38.9072,
      lng: -77.0369,
      radius: 50,
    });
    setApiStatus((prev) => ({
      ...prev,
      facilities: {
        status: "success",
        data: formatFacilities(data),
        rawData: data,
        error: null,
      },
    }));
  } catch (err) {
    setApiStatus((prev) => ({
      ...prev,
      facilities: { status: "error", data: null, rawData: null, error: err.message },
    }));
  }
}

async function testFormsApi(setApiStatus) {
  setApiStatus((prev) => ({
    ...prev,
    forms: { ...prev.forms, status: "loading" },
  }));
  try {
    const data = await searchForms(VA_FORMS_API_KEY, "21-526EZ");
    setApiStatus((prev) => ({
      ...prev,
      forms: {
        status: "success",
        data: formatForms(data),
        rawData: data,
        error: null,
      },
    }));
  } catch (err) {
    setApiStatus((prev) => ({
      ...prev,
      forms: { status: "error", data: null, rawData: null, error: err.message },
    }));
  }
}

async function testBenefitsRefApi(setApiStatus) {
  setApiStatus((prev) => ({
    ...prev,
    benefitsRef: { ...prev.benefitsRef, status: "loading" },
  }));
  try {
    const data = await getBenefitsReferenceDisabilities(
      VA_BENEFITS_REF_API_KEY,
    );
    setApiStatus((prev) => ({
      ...prev,
      benefitsRef: {
        status: "success",
        data: formatBenefitsDisabilities(data),
        rawData: data,
        error: null,
      },
    }));
  } catch (err) {
    setApiStatus((prev) => ({
      ...prev,
      benefitsRef: { status: "error", data: null, rawData: null, error: err.message },
    }));
  }
}

async function testServiceHistoryApi(setApiStatus, accessToken) {
  setApiStatus((prev) => ({
    ...prev,
    serviceHistory: { ...prev.serviceHistory, status: "loading" },
  }));
  try {
    const data = await getServiceHistory(accessToken);
    setApiStatus((prev) => ({
      ...prev,
      serviceHistory: {
        status: "success",
        data: formatServiceHistory(data),
        rawData: data,
        error: null,
      },
    }));
  } catch (err) {
    // Check if this is a sandbox limitation (403/Forbidden)
    const isSandboxLimit =
      err.code === "FORBIDDEN" ||
      err.message?.includes("Access denied") ||
      err.message?.includes("403");
    setApiStatus((prev) => ({
      ...prev,
      serviceHistory: {
        status: isSandboxLimit ? "sandbox_limit" : "error",
        data: null,
        rawData: null,
        error: isSandboxLimit
          ? "Sandbox test data not available for this user. Production access will enable real veteran data."
          : err.message,
      },
    }));
  }
}

async function testClaimsApi(setApiStatus, accessToken) {
  setApiStatus((prev) => ({
    ...prev,
    claims: { ...prev.claims, status: "loading" },
  }));
  try {
    const data = await getClaims(accessToken);
    setApiStatus((prev) => ({
      ...prev,
      claims: {
        status: "success",
        data: formatClaims(data),
        rawData: data,
        error: null,
      },
    }));
  } catch (err) {
    // Check if this is a sandbox limitation (403/Forbidden)
    const isSandboxLimit =
      err.code === "FORBIDDEN" ||
      err.message?.includes("Access denied") ||
      err.message?.includes("403");
    setApiStatus((prev) => ({
      ...prev,
      claims: {
        status: isSandboxLimit ? "sandbox_limit" : "error",
        data: null,
        rawData: null,
        error: isSandboxLimit
          ? "Sandbox test data not available for this user. Production access will enable real claims data."
          : err.message,
      },
    }));
  }
}

// =============================================================================
// API TEST HOOK
// =============================================================================

function useDemoApiTests(accessToken, isAuthenticated) {
  const [apiStatus, setApiStatus] = useState(INITIAL_API_STATUS);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const hasApiKey = Boolean(
    VA_FACILITIES_API_KEY && VA_FACILITIES_API_KEY !== "your_va_api_key_here",
  );

  const testOpenDataAPIs = useCallback(async () => {
    await testFacilitiesApi(setApiStatus);
    await testFormsApi(setApiStatus);
    await testBenefitsRefApi(setApiStatus);
  }, []);

  const testOAuthAPIs = useCallback(async () => {
    if (!accessToken) return;
    await testServiceHistoryApi(setApiStatus, accessToken);
    await testClaimsApi(setApiStatus, accessToken);
  }, [accessToken]);

  const runAllTests = async () => {
    setIsRunningTests(true);
    await testOpenDataAPIs();
    if (isAuthenticated) {
      await testOAuthAPIs();
    }
    setIsRunningTests(false);
  };

  // Auto-run Open Data tests on mount
  useEffect(() => {
    if (hasApiKey) {
      testOpenDataAPIs();
    }
  }, [hasApiKey, testOpenDataAPIs]);

  // Auto-run OAuth tests when authenticated
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      testOAuthAPIs();
    }
  }, [isAuthenticated, accessToken, testOAuthAPIs]);

  const resetAuthenticatedStatuses = () => {
    setApiStatus((prev) => ({
      ...prev,
      serviceHistory: { ...PENDING_ENTRY },
      claims: { ...PENDING_ENTRY },
    }));
  };

  return {
    apiStatus,
    counts: getStatusCounts(apiStatus),
    isRunningTests,
    runAllTests,
    resetAuthenticatedStatuses,
  };
}

// =============================================================================
// STATUS BADGE
// =============================================================================

const StatusBadge = ({ status }) => {
  const configs = {
    success: {
      icon: CheckCircle,
      color: "text-green-500",
      bg: "bg-green-100 dark:bg-green-900/30",
      label: "Active",
    },
    error: {
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-100 dark:bg-red-900/30",
      label: "Error",
    },
    loading: {
      icon: Loader2,
      color: "text-blue-500",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      label: "Testing",
      animate: true,
    },
    pending: {
      icon: Clock,
      color: "text-yellow-500",
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      label: "Pending",
    },
    skipped: {
      icon: Clock,
      color: "text-gray-400",
      bg: "bg-gray-100 dark:bg-gray-700",
      label: "Future Scope",
    },
    sandbox_limit: {
      icon: Lock,
      color: "text-orange-500",
      bg: "bg-orange-100 dark:bg-orange-900/30",
      label: "Sandbox Limited",
    },
  };
  const config = configs[status] || configs.pending;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
    >
      <Icon
        className={`w-3.5 h-3.5 ${config.animate ? "animate-spin" : ""}`}
      />
      {config.label}
    </span>
  );
};

// =============================================================================
// API CARD
// =============================================================================

const ApiCardHeader = ({ name, icon: Icon, status, isOAuth }) => (
  <div
    className={`px-4 py-3 flex items-center justify-between ${
      status.status === "skipped"
        ? "bg-gray-50 dark:bg-gray-800/50"
        : "bg-white dark:bg-gray-800"
    }`}
  >
    <div className="flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${getCardIconWrapperClass(status.status)}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h4
          className={`font-semibold ${status.status === "skipped" ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white"}`}
        >
          {name}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          {isOAuth ? (
            <Lock className="w-3 h-3" />
          ) : (
            <Unlock className="w-3 h-3" />
          )}
          {isOAuth ? "OAuth Protected" : "API Key"}
          {status.status === "skipped" && (
            <span className="ml-2 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-[10px] font-medium">
              COMING SOON
            </span>
          )}
        </p>
      </div>
    </div>
    <StatusBadge status={status.status} />
  </div>
);

const ApiCardSuccessDetail = ({ data, rawData, isExpanded, onToggleRawJson }) => {
  let successMessage;
  if (Array.isArray(data)) {
    successMessage = (
      <p className="font-medium text-green-600 dark:text-green-400">
        ✓ {data.length} record(s) retrieved
      </p>
    );
  } else if (typeof data === "object") {
    successMessage = (
      <p className="font-medium text-green-600 dark:text-green-400">
        ✓ Data retrieved successfully
      </p>
    );
  } else {
    successMessage = (
      <p className="font-medium text-green-600 dark:text-green-400">
        ✓ Connected
      </p>
    );
  }

  return (
    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {successMessage}
      </div>

      {rawData && (
        <div className="mt-3">
          <button
            onClick={onToggleRawJson}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
          >
            {isExpanded ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            {isExpanded ? "Hide" : "Show"} Raw JSON
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {isExpanded && (
            <div className="mt-2 relative">
              <div className="absolute top-2 right-2 px-2 py-1 bg-gray-700 text-gray-300 rounded text-[10px] font-mono">
                VA.gov API Response
              </div>
              <pre className="p-4 bg-gray-900 text-green-400 rounded-lg text-xs overflow-auto max-h-64 font-mono">
                {JSON.stringify(rawData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ApiCardStatusDetail = ({ status, data, rawData, error, isExpanded, onToggleRawJson }) => {
  if (status.status === "sandbox_limit" && error) {
    return (
      <div className="px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border-t border-orange-100 dark:border-orange-800">
        <p className="text-sm text-orange-600 dark:text-orange-400 flex items-start gap-2">
          <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Ready for Production:</strong> {error}
          </span>
        </p>
      </div>
    );
  }

  if (status.status === "error" && error) {
    return (
      <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-800">
        <p className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </p>
      </div>
    );
  }

  if (status.status === "success" && data) {
    return (
      <ApiCardSuccessDetail
        data={data}
        rawData={rawData}
        isExpanded={isExpanded}
        onToggleRawJson={onToggleRawJson}
      />
    );
  }

  return null;
};

const ApiCard = ({
  name,
  icon: Icon,
  status,
  data,
  rawData,
  error,
  isOAuth = false,
  isExpanded,
  onToggleRawJson,
}) => (
  <div
    className={`border rounded-xl overflow-hidden transition-all ${getCardBorderClass(status.status)}`}
  >
    <ApiCardHeader name={name} icon={Icon} status={status} isOAuth={isOAuth} />
    <ApiCardStatusDetail
      status={status}
      data={data}
      rawData={rawData}
      error={error}
      isExpanded={isExpanded}
      onToggleRawJson={onToggleRawJson}
    />
  </div>
);

// =============================================================================
// HEADER / FOOTER / SECTIONS
// =============================================================================

function AuthToggleButton({ isAuthenticated, authLoading, onLogin, onLogout }) {
  let authButtonIcon;
  if (authLoading) {
    authButtonIcon = <Loader2 className="w-4 h-4 animate-spin" />;
  } else if (isAuthenticated) {
    authButtonIcon = <CheckCircle className="w-4 h-4" />;
  } else {
    authButtonIcon = <Shield className="w-4 h-4" />;
  }

  let authButtonLabel;
  if (authLoading) {
    authButtonLabel = "Connecting...";
  } else if (isAuthenticated) {
    authButtonLabel = "VA Connected";
  } else {
    authButtonLabel = "Connect VA Sandbox";
  }

  return (
    <button
      onClick={isAuthenticated ? onLogout : onLogin}
      disabled={authLoading}
      className={`ml-4 flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
        isAuthenticated
          ? "bg-green-500/20 border border-green-400/50 text-green-200 hover:bg-green-500/30"
          : "bg-white/10 border border-white/30 text-white hover:bg-white/20"
      } ${authLoading ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {authButtonIcon}
      {authButtonLabel}
    </button>
  );
}

function StatusSummaryBar({ counts }) {
  return (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      <div className="bg-green-500/20 border border-green-400/30 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-green-300">{counts.success}</p>
        <p className="text-xs text-green-200 mt-1">Active</p>
      </div>
      <div className="bg-orange-500/20 border border-orange-400/30 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-orange-300">
          {counts.sandbox_limit}
        </p>
        <p className="text-xs text-orange-200 mt-1">Sandbox</p>
      </div>
      <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-yellow-300">{counts.pending}</p>
        <p className="text-xs text-yellow-200 mt-1">Pending</p>
      </div>
      <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-red-300">{counts.error}</p>
        <p className="text-xs text-red-200 mt-1">Errors</p>
      </div>
      <div className="bg-gray-500/20 border border-gray-400/30 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-gray-300">{counts.skipped}</p>
        <p className="text-xs text-gray-200 mt-1">Future</p>
      </div>
    </div>
  );
}

function DemoDashboardHeader({ onClose, isAuthenticated, authLoading, onLogin, onLogout, counts }) {
  return (
    <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
            <Activity className="w-8 h-8" />
          </div>
          <div>
            <h2
              id="demo-dashboard-title"
              className="text-2xl font-bold tracking-tight"
            >
              VA.gov API System Status{" "}
              <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
                BETA
              </span>
            </h2>
            <p className="text-blue-200 text-sm mt-1 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Production Access Demo •{" "}
              {VA_AUTH_CONFIG.environment === "sandbox"
                ? "Sandbox"
                : "Production"}{" "}
              Environment
            </p>
          </div>
          <AuthToggleButton
            isAuthenticated={isAuthenticated}
            authLoading={authLoading}
            onLogin={onLogin}
            onLogout={onLogout}
          />
        </div>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors"
          aria-label="Close"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <StatusSummaryBar counts={counts} />
    </div>
  );
}

function DemoDashboardFooter({ counts, totalApis }) {
  return (
    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
      <p>Vet-Rate.org • VA.gov API Integration v1.0</p>
      <p className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-green-500" />
        {counts.success} of {totalApis - counts.skipped}{" "}
        APIs Active
      </p>
    </div>
  );
}

function AuthIdentityBlock({ isAuthenticated, userInfo }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={`w-4 h-4 rounded-full ${isAuthenticated ? "bg-green-500" : "bg-gray-400"} animate-pulse`}
      />
      <div>
        <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Wifi className="w-4 h-4 text-green-500" />
              VA.gov OAuth Connected
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-gray-400" />
              OAuth Not Connected
            </>
          )}
        </p>
        {isAuthenticated && userInfo && (
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
            <User className="w-3.5 h-3.5" />
            {userInfo.given_name || userInfo.name || "Veteran"} •
            Sandbox Test User
          </p>
        )}
      </div>
    </div>
  );
}

function AuthStatusBarActions({
  onRunAllTests,
  isRunningTests,
  isAuthenticated,
  onLogin,
  onLogout,
  authLoading,
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onRunAllTests}
        disabled={isRunningTests}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
      >
        {isRunningTests ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        {isRunningTests ? "Testing..." : "Run All Tests"}
      </button>
      {isAuthenticated ? (
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Disconnect
        </button>
      ) : (
        <button
          onClick={onLogin}
          disabled={authLoading}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <LogIn className="w-4 h-4" />
          Connect VA Account
        </button>
      )}
    </div>
  );
}

function AuthStatusBar({
  isAuthenticated,
  userInfo,
  onRunAllTests,
  isRunningTests,
  onLogin,
  onLogout,
  authLoading,
  authError,
}) {
  return (
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between">
        <AuthIdentityBlock isAuthenticated={isAuthenticated} userInfo={userInfo} />
        <AuthStatusBarActions
          onRunAllTests={onRunAllTests}
          isRunningTests={isRunningTests}
          isAuthenticated={isAuthenticated}
          onLogin={onLogin}
          onLogout={onLogout}
          authLoading={authLoading}
        />
      </div>

      {authError && (
        <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {authError}
          </p>
        </div>
      )}
    </div>
  );
}

function OpenDataApisSection({ apiStatus, showRawJson, onToggleRawJson }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
          <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">
            Open Data APIs
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            API Key Authentication • No Login Required
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <ApiCard
          name="VA Facilities"
          icon={MapPin}
          status={apiStatus.facilities}
          data={apiStatus.facilities.data}
          rawData={apiStatus.facilities.rawData}
          error={apiStatus.facilities.error}
          isExpanded={Boolean(showRawJson.facilities)}
          onToggleRawJson={() => onToggleRawJson("facilities")}
        />
        <ApiCard
          name="VA Forms"
          icon={FileText}
          status={apiStatus.forms}
          data={apiStatus.forms.data}
          rawData={apiStatus.forms.rawData}
          error={apiStatus.forms.error}
          isExpanded={Boolean(showRawJson.forms)}
          onToggleRawJson={() => onToggleRawJson("forms")}
        />
        <ApiCard
          name="Benefits Reference"
          icon={Database}
          status={apiStatus.benefitsRef}
          data={apiStatus.benefitsRef.data}
          rawData={apiStatus.benefitsRef.rawData}
          error={apiStatus.benefitsRef.error}
          isExpanded={Boolean(showRawJson.benefitsRef)}
          onToggleRawJson={() => onToggleRawJson("benefitsRef")}
        />
      </div>
    </div>
  );
}

function OAuthApisSection({ apiStatus, isAuthenticated, showRawJson, onToggleRawJson }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
          <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">
            OAuth Protected APIs
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Requires VA.gov Login • User-Specific Data
          </p>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl">
          <p className="text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Connect your VA.gov account to test Service History and Claims
            APIs
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <ApiCard
          name="Service History"
          icon={Medal}
          status={apiStatus.serviceHistory}
          data={apiStatus.serviceHistory.data}
          rawData={apiStatus.serviceHistory.rawData}
          error={apiStatus.serviceHistory.error}
          isOAuth={true}
          isExpanded={Boolean(showRawJson.serviceHistory)}
          onToggleRawJson={() => onToggleRawJson("serviceHistory")}
        />
        <ApiCard
          name="VA Claims"
          icon={Briefcase}
          status={apiStatus.claims}
          data={apiStatus.claims.data}
          rawData={apiStatus.claims.rawData}
          error={apiStatus.claims.error}
          isOAuth={true}
          isExpanded={Boolean(showRawJson.claims)}
          onToggleRawJson={() => onToggleRawJson("claims")}
        />
      </div>
    </div>
  );
}

function FutureScopeSection({ apiStatus }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
          <Clock className="w-4 h-4 text-gray-400" />
        </div>
        <div>
          <h3 className="font-bold text-gray-500 dark:text-gray-400">
            Future Scope
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Planned for Phase 2 Implementation
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ApiCard
          name="Appeals Status"
          icon={FileText}
          status={apiStatus.appealsStatus}
          data={null}
          rawData={null}
          error={null}
          isOAuth={true}
          isExpanded={false}
          onToggleRawJson={() => {}}
        />
        <ApiCard
          name="Appealable Issues"
          icon={FileText}
          status={apiStatus.appealableIssues}
          data={null}
          rawData={null}
          error={null}
          isOAuth={true}
          isExpanded={false}
          onToggleRawJson={() => {}}
        />
      </div>
    </div>
  );
}

function PrivacyNoticeBanner() {
  return (
    <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
      <div className="flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-blue-900 dark:text-blue-100">
            Privacy & Security
          </h4>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            All data is processed client-side only. No veteran data is
            stored on our servers or in any database. OAuth tokens are
            stored in browser session storage and cleared on logout.
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DEMO DASHBOARD COMPONENT
// =============================================================================

const DemoDashboard = ({ onClose }) => {
  const {
    isAuthenticated,
    isLoading: authLoading,
    userInfo,
    login,
    logout,
    accessToken,
    error: authError,
  } = useVaAuth();

  const {
    apiStatus,
    counts,
    isRunningTests,
    runAllTests,
    resetAuthenticatedStatuses,
  } = useDemoApiTests(accessToken, isAuthenticated);

  const [showRawJson, setShowRawJson] = useState({});

  const toggleRawJson = (key) => {
    setShowRawJson((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogin = async () => {
    await login();
  };

  const handleLogout = async () => {
    await logout();
    resetAuthenticatedStatuses();
  };

  const totalApis = Object.keys(apiStatus).length;

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="2xl"
      labelledBy="demo-dashboard-title"
      header={
        <DemoDashboardHeader
          onClose={onClose}
          isAuthenticated={isAuthenticated}
          authLoading={authLoading}
          onLogin={handleLogin}
          onLogout={handleLogout}
          counts={counts}
        />
      }
      footer={<DemoDashboardFooter counts={counts} totalApis={totalApis} />}
    >
      <div className="-mx-4">
        <AuthStatusBar
          isAuthenticated={isAuthenticated}
          userInfo={userInfo}
          onRunAllTests={runAllTests}
          isRunningTests={isRunningTests}
          onLogin={handleLogin}
          onLogout={handleLogout}
          authLoading={authLoading}
          authError={authError}
        />
        <div className="p-6">
          <OpenDataApisSection
            apiStatus={apiStatus}
            showRawJson={showRawJson}
            onToggleRawJson={toggleRawJson}
          />
          <OAuthApisSection
            apiStatus={apiStatus}
            isAuthenticated={isAuthenticated}
            showRawJson={showRawJson}
            onToggleRawJson={toggleRawJson}
          />
          <FutureScopeSection apiStatus={apiStatus} />
          <PrivacyNoticeBanner />
        </div>
      </div>
    </ResponsiveModal>
  );
};

export default DemoDashboard;
