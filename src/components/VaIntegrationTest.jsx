/**
 * VA Integration Demo Dashboard
 *
 * A comprehensive proof-of-concept component for VA.gov API integration.
 * Designed to showcase functionality during VA Production Access Demo.
 *
 * Features:
 * - OAuth 2.0 PKCE authentication with VA.gov
 * - Service History display
 * - Claims tracking
 * - Appealable issues listing
 * - Raw JSON toggle for technical review
 */

import { useState, useEffect, useCallback } from "react";
import { useVaAuth } from "../hooks/useVaAuth";
import {
  getServiceHistory,
  getClaims,
  getAppealableIssues,
  formatServiceHistory,
  formatClaims,
  formatAppealableIssues,
} from "../api/va";
import ResponsiveModal from "./common/ResponsiveModal";
import VaSandboxTest from "./VaSandboxTest";
import { useLanguage } from "../contexts/LanguageContext";

// Icons from lucide-react
import {
  Shield,
  FileText,
  AlertTriangle,
  RefreshCw,
  LogIn,
  LogOut,
  User,
  Calendar,
  Award,
  ChevronDown,
  ChevronUp,
  Code,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  ExternalLink,
  Info,
  AlertCircle,
  Medal,
} from "lucide-react";

function _authStatusLabel(authLoading, isAuthenticated) {
  if (authLoading) return "Checking authentication...";
  return isAuthenticated ? "Connected to VA.gov" : "Not Connected";
}

async function _fetchServiceHistoryData(accessToken, ctx) {
  const { setLoading, setErrors, setRawServiceHistory, setServiceHistory } = ctx;
  setLoading((prev) => ({ ...prev, serviceHistory: true }));
  setErrors((prev) => ({ ...prev, serviceHistory: null }));

  try {
    const data = await getServiceHistory(accessToken);
    setRawServiceHistory(data);
    setServiceHistory(formatServiceHistory(data));
  } catch (err) {
    // 403 is expected in sandbox - test user may not have service history
    const isSandboxLimit =
      err.code === "FORBIDDEN" || err.message?.includes("Access denied");
    if (!isSandboxLimit) {
      console.error("[VA Demo] Service history error:", err);
    }
    setErrors((prev) => ({
      ...prev,
      serviceHistory: isSandboxLimit
        ? "Sandbox limitation: Test user has no service history. Production access required."
        : err.message,
    }));
  } finally {
    setLoading((prev) => ({ ...prev, serviceHistory: false }));
  }
}

async function _fetchClaimsData(accessToken, ctx) {
  const { setLoading, setErrors, setRawClaims, setClaims } = ctx;
  setLoading((prev) => ({ ...prev, claims: true }));
  setErrors((prev) => ({ ...prev, claims: null }));

  try {
    const data = await getClaims(accessToken);
    setRawClaims(data);
    setClaims(formatClaims(data));
  } catch (err) {
    // 403 is expected in sandbox - test user may not have claims data
    const isSandboxLimit =
      err.code === "FORBIDDEN" || err.message?.includes("Access denied");
    if (!isSandboxLimit) {
      console.error("[VA Demo] Claims error:", err);
    }
    setErrors((prev) => ({
      ...prev,
      claims: isSandboxLimit
        ? "Sandbox limitation: Test user has no claims data. Production access required."
        : err.message,
    }));
  } finally {
    setLoading((prev) => ({ ...prev, claims: false }));
  }
}

// Note: Appeals API is Future Scope - this function is available but not auto-called
async function _fetchAppealableIssuesData(accessToken, ctx) {
  const { setLoading, setErrors, setRawAppealableIssues, setAppealableIssues } = ctx;
  setLoading((prev) => ({ ...prev, appealableIssues: true }));
  setErrors((prev) => ({ ...prev, appealableIssues: null }));

  try {
    const data = await getAppealableIssues(accessToken);
    setRawAppealableIssues(data);
    setAppealableIssues(formatAppealableIssues(data));
  } catch (err) {
    // 404 is expected - Appeals API endpoint may not exist in sandbox
    const isNotFound =
      err.message?.includes("Not Found") || err.message?.includes("404");
    if (!isNotFound) {
      console.error("[VA Demo] Appealable issues error:", err);
    }
    setErrors((prev) => ({
      ...prev,
      appealableIssues: isNotFound
        ? "Future Scope: Appeals API not available in current sandbox."
        : err.message,
    }));
  } finally {
    setLoading((prev) => ({ ...prev, appealableIssues: false }));
  }
}

// Format date for display
function formatDate(dateString) {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

// Get discharge status badge color
function getDischargeStatusColor(status) {
  const statusLower = status?.toLowerCase() || "";
  if (statusLower.includes("honorable"))
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (statusLower.includes("general"))
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  if (
    statusLower.includes("other than honorable") ||
    statusLower.includes("oth")
  )
    return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  if (
    statusLower.includes("bad conduct") ||
    statusLower.includes("dishonorable")
  )
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
}

// Get claim status badge
function getClaimStatusBadge(phase) {
  if (!phase)
    return {
      icon: Clock,
      color: "text-gray-500",
      bg: "bg-gray-100 dark:bg-gray-700",
    };

  const phaseName = phase.name?.toLowerCase() || "";

  if (phaseName.includes("complete")) {
    return {
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-100 dark:bg-green-900",
    };
  }
  if (phaseName.includes("error") || phaseName.includes("cancel")) {
    return {
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-100 dark:bg-red-900",
    };
  }
  return {
    icon: Clock,
    color: "text-blue-600",
    bg: "bg-blue-100 dark:bg-blue-900",
  };
}

// Render loading spinner
function LoadingSpinner({ text = "Loading..." }) {
  return (
    <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" />
      <span>{text}</span>
    </div>
  );
}

// Render error message
function ErrorMessage({ message, onRetry }) {
  return (
    <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-red-700 dark:text-red-300 text-sm">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Render Raw JSON toggle
function RawJsonToggle({ isOpen, onToggle, data }) {
  return (
    <div className="mt-4">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <Code className="w-4 h-4" />
        {isOpen ? "Hide" : "Show"} Raw JSON
        {isOpen ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>
      {isOpen && data && (
        <pre className="mt-2 p-4 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-auto max-h-96 font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function VaIntegrationHeaderTop({ onClose, setShowSandboxTest }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
          <Shield className="w-7 h-7" />
        </div>
        <div>
          <h2 id="va-integration-title" className="text-2xl font-bold">
            VA.gov Integration Demo{" "}
            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
              BETA
            </span>
          </h2>
          <p className="text-blue-200 text-sm mt-1">
            Production Access Demonstration • Sandbox Environment
          </p>
        </div>
        {/* Verify Sandbox Button */}
        <button
          onClick={() => setShowSandboxTest(true)}
          className="ml-2 flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all bg-yellow-500/20 border border-yellow-400/50 text-yellow-200 hover:bg-yellow-500/30"
        >
          <Shield className="w-4 h-4" />
          Verify Sandbox
        </button>
      </div>
      <button
        onClick={onClose}
        className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors"
        aria-label="Close"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

function VaIntegrationAuthStatusBar({
  isAuthenticated,
  userInfo,
  authLoading,
  authError,
  handleLogin,
  handleLogout,
}) {
  return (
    <>
      <div className="mt-4 flex items-center justify-between bg-white/10 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${isAuthenticated ? "bg-green-400" : "bg-yellow-400"} animate-pulse`}
          />
          <span className="font-medium">
            {_authStatusLabel(authLoading, isAuthenticated)}
          </span>
          {isAuthenticated && userInfo && (
            <span className="text-blue-200 text-sm ml-2">
              • {userInfo.given_name || userInfo.name || "Veteran"}
            </span>
          )}
        </div>
        {isAuthenticated ? (
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleLogin}
            disabled={authLoading}
            className="flex items-center gap-2 bg-white text-blue-900 hover:bg-blue-50 px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            Connect VA Account
          </button>
        )}
      </div>

      {authError && (
        <div className="mt-3 bg-red-500/20 border border-red-300/30 rounded-lg p-3 text-sm text-red-100">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {authError}
        </div>
      )}
    </>
  );
}

function VaIntegrationHeader({
  onClose,
  isAuthenticated,
  userInfo,
  authLoading,
  authError,
  handleLogin,
  handleLogout,
  setShowSandboxTest,
}) {
  return (
    <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white p-6">
      <VaIntegrationHeaderTop onClose={onClose} setShowSandboxTest={setShowSandboxTest} />
      <VaIntegrationAuthStatusBar
        isAuthenticated={isAuthenticated}
        userInfo={userInfo}
        authLoading={authLoading}
        authError={authError}
        handleLogin={handleLogin}
        handleLogout={handleLogout}
      />
    </div>
  );
}

function VaNotAuthenticatedView({ handleLogin, authLoading }) {
  return (
    <div className="text-center py-12">
      <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
        <User className="w-12 h-12 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Connect Your VA.gov Account
      </h3>
      <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto mb-6">
        This demo securely connects to VA.gov using OAuth 2.0 with PKCE. Your
        credentials are never shared with this application.
      </p>

      {/* Scopes Info */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 max-w-md mx-auto text-left mb-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          Requested Permissions
        </h4>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <li className="flex items-center gap-2">
            <Medal className="w-4 h-4 text-blue-500" />
            <span>
              <strong>service_history.read</strong> - View military service
              records
            </span>
          </li>
          <li className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-500" />
            <span>
              <strong>claim.read</strong> - View disability claims
            </span>
          </li>
          <li className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span>
              <strong>appealable_issues.read</strong> - View appealable
              decisions
            </span>
          </li>
        </ul>
      </div>

      <button
        onClick={handleLogin}
        disabled={authLoading}
        className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
      >
        {authLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <LogIn className="w-5 h-5" />
        )}
        Connect with VA.gov
      </button>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
        🔒 Secured with OAuth 2.0 PKCE • Sandbox Environment
      </p>
    </div>
  );
}

function ServiceHistoryEntry({ service }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white text-lg">
            {service.branch}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-600 dark:text-gray-300">
            <Calendar className="w-4 h-4" />
            {formatDate(service.startDate)} - {formatDate(service.endDate)}
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${getDischargeStatusColor(service.dischargeStatus)}`}
        >
          {service.dischargeStatus || "Unknown"}
        </span>
      </div>
      {service.payGrade && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Pay Grade: {service.payGrade}
        </p>
      )}
      {service.deployments && service.deployments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Deployments:
          </p>
          <div className="flex flex-wrap gap-2">
            {service.deployments.map((dep, depIdx) => (
              <span
                key={depIdx}
                className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 px-2 py-1 rounded"
              >
                {dep.location || dep.country || "Deployment"} (
                {formatDate(dep.startDate)} - {formatDate(dep.endDate)})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceHistoryList({ loading, errors, serviceHistory, fetchServiceHistory }) {
  if (loading.serviceHistory) {
    return <LoadingSpinner text="Fetching service history..." />;
  }
  if (errors.serviceHistory) {
    return <ErrorMessage message={errors.serviceHistory} onRetry={fetchServiceHistory} />;
  }
  if (!serviceHistory || serviceHistory.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No service history found</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {serviceHistory.map((service, idx) => (
        <ServiceHistoryEntry key={service.id || idx} service={service} />
      ))}
    </div>
  );
}

function ServiceHistoryCard({
  loading,
  errors,
  serviceHistory,
  rawServiceHistory,
  showRawJson,
  fetchServiceHistory,
  toggleRawJson,
}) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Medal className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Service History
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Military service records from VA.gov
            </p>
          </div>
        </div>
        <button
          onClick={fetchServiceHistory}
          disabled={loading.serviceHistory}
          className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw
            className={`w-5 h-5 ${loading.serviceHistory ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      <ServiceHistoryList
        loading={loading}
        errors={errors}
        serviceHistory={serviceHistory}
        fetchServiceHistory={fetchServiceHistory}
      />

      <RawJsonToggle
        isOpen={showRawJson.serviceHistory}
        onToggle={() => toggleRawJson("serviceHistory")}
        data={rawServiceHistory}
      />
    </div>
  );
}

function ClaimEntry({ claim, isExpanded, onToggleExpand }) {
  const statusBadge = getClaimStatusBadge(claim.phase);
  const StatusIcon = statusBadge.icon;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      <button
        onClick={onToggleExpand}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <StatusIcon className={`w-5 h-5 ${statusBadge.color}`} />
          <div className="text-left">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {claim.type} Claim
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Filed: {formatDate(claim.dateFiled)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.color}`}
          >
            Phase {claim.phase?.number || "?"}: {claim.phase?.name || claim.status}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Claim ID:</span>
              <span className="ml-2 text-gray-900 dark:text-white font-mono text-xs">
                {claim.id}
              </span>
            </div>
            {claim.closeDate && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Closed:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {formatDate(claim.closeDate)}
                </span>
              </div>
            )}
            {claim.documentsNeeded && (
              <div className="col-span-2">
                <span className="text-orange-600 dark:text-orange-400 font-medium">
                  ⚠️ Documents Needed
                </span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progress</span>
              <span>Phase {claim.phase?.number || 0} of 8</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                style={{
                  width: `${((claim.phase?.number || 0) / 8) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClaimsList({ loading, errors, claims, fetchClaims, expandedClaim, setExpandedClaim }) {
  if (loading.claims) {
    return <LoadingSpinner text="Fetching claims..." />;
  }
  if (errors.claims) {
    return <ErrorMessage message={errors.claims} onRetry={fetchClaims} />;
  }
  if (!claims || claims.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No claims found</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {claims.map((claim, idx) => {
        const isExpanded = expandedClaim === claim.id;
        return (
          <ClaimEntry
            key={claim.id || idx}
            claim={claim}
            isExpanded={isExpanded}
            onToggleExpand={() => setExpandedClaim(isExpanded ? null : claim.id)}
          />
        );
      })}
    </div>
  );
}

function ClaimsTrackerCard({
  loading,
  errors,
  claims,
  rawClaims,
  showRawJson,
  fetchClaims,
  toggleRawJson,
  expandedClaim,
  setExpandedClaim,
}) {
  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Claims Tracker
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Active and past disability claims
            </p>
          </div>
        </div>
        <button
          onClick={fetchClaims}
          disabled={loading.claims}
          className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-800/50 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading.claims ? "animate-spin" : ""}`} />
        </button>
      </div>

      <ClaimsList
        loading={loading}
        errors={errors}
        claims={claims}
        fetchClaims={fetchClaims}
        expandedClaim={expandedClaim}
        setExpandedClaim={setExpandedClaim}
      />

      <RawJsonToggle
        isOpen={showRawJson.claims}
        onToggle={() => toggleRawJson("claims")}
        data={rawClaims}
      />
    </div>
  );
}

function AppealableIssueEntry({ issue }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 dark:text-white">
            {issue.subject}
          </h4>
          {issue.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {issue.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Decision: {formatDate(issue.decisionDate)}
            </span>
            {issue.percentNumber !== undefined && (
              <span className="font-medium text-orange-600 dark:text-orange-400">
                Rated: {issue.percentNumber}%
              </span>
            )}
          </div>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${issue.isRating ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200" : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"}`}
        >
          {issue.isRating ? "Rating Issue" : "Non-Rating"}
        </span>
      </div>
    </div>
  );
}

function AppealableIssuesList({ loading, errors, appealableIssues, fetchAppealableIssues }) {
  if (loading.appealableIssues) {
    return <LoadingSpinner text="Fetching appealable issues..." />;
  }
  if (errors.appealableIssues) {
    return (
      <ErrorMessage message={errors.appealableIssues} onRetry={fetchAppealableIssues} />
    );
  }
  if (!appealableIssues || appealableIssues.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No appealable issues found</p>
        <p className="text-xs mt-1">This is good news! 🎉</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {appealableIssues.map((issue, idx) => (
        <AppealableIssueEntry key={issue.id || idx} issue={issue} />
      ))}
    </div>
  );
}

function AppealableIssuesCard({
  loading,
  errors,
  appealableIssues,
  rawAppealableIssues,
  showRawJson,
  fetchAppealableIssues,
  toggleRawJson,
}) {
  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 border border-orange-200 dark:border-orange-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Appealable Issues
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Decisions eligible for appeal
            </p>
          </div>
        </div>
        <button
          onClick={fetchAppealableIssues}
          disabled={loading.appealableIssues}
          className="p-2 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-800/50 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw
            className={`w-5 h-5 ${loading.appealableIssues ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      <AppealableIssuesList
        loading={loading}
        errors={errors}
        appealableIssues={appealableIssues}
        fetchAppealableIssues={fetchAppealableIssues}
      />

      <RawJsonToggle
        isOpen={showRawJson.appealableIssues}
        onToggle={() => toggleRawJson("appealableIssues")}
        data={rawAppealableIssues}
      />
    </div>
  );
}

function VaSandboxNoticeFooter() {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4 mt-6">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p className="font-semibold">Sandbox Environment Notice</p>
          <p className="mt-1">
            This demo uses VA.gov Sandbox APIs with test data. Production
            access requires VA approval. All data shown is synthetic test
            data provided by VA for development purposes.
          </p>
          <a
            href="https://developer.va.gov/explore"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-blue-600 dark:text-blue-400 hover:underline"
          >
            Learn more at developer.va.gov <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function VaAuthenticatedView({
  loading,
  errors,
  serviceHistory,
  rawServiceHistory,
  claims,
  rawClaims,
  appealableIssues,
  rawAppealableIssues,
  showRawJson,
  fetchAllData,
  fetchServiceHistory,
  fetchClaims,
  fetchAppealableIssues,
  toggleRawJson,
  expandedClaim,
  setExpandedClaim,
}) {
  const anyLoading = loading.serviceHistory || loading.claims || loading.appealableIssues;
  return (
    <div className="space-y-6">
      {/* Refresh All Button */}
      <div className="flex justify-end">
        <button
          onClick={fetchAllData}
          disabled={anyLoading}
          className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${anyLoading ? "animate-spin" : ""}`} />
          Refresh All Data
        </button>
      </div>

      <ServiceHistoryCard
        loading={loading}
        errors={errors}
        serviceHistory={serviceHistory}
        rawServiceHistory={rawServiceHistory}
        showRawJson={showRawJson}
        fetchServiceHistory={fetchServiceHistory}
        toggleRawJson={toggleRawJson}
      />

      <ClaimsTrackerCard
        loading={loading}
        errors={errors}
        claims={claims}
        rawClaims={rawClaims}
        showRawJson={showRawJson}
        fetchClaims={fetchClaims}
        toggleRawJson={toggleRawJson}
        expandedClaim={expandedClaim}
        setExpandedClaim={setExpandedClaim}
      />

      <AppealableIssuesCard
        loading={loading}
        errors={errors}
        appealableIssues={appealableIssues}
        rawAppealableIssues={rawAppealableIssues}
        showRawJson={showRawJson}
        fetchAppealableIssues={fetchAppealableIssues}
        toggleRawJson={toggleRawJson}
      />

      <VaSandboxNoticeFooter />
    </div>
  );
}

const VaIntegrationTest = ({ onClose }) => {
  const { t: _t } = useLanguage();

  // State for sandbox test modal
  const [showSandboxTest, setShowSandboxTest] = useState(false);

  const {
    isAuthenticated,
    isLoading: authLoading,
    userInfo,
    login,
    logout,
    accessToken,
    error: authError,
  } = useVaAuth();

  // Data states
  const [serviceHistory, setServiceHistory] = useState(null);
  const [claims, setClaims] = useState(null);
  const [appealableIssues, setAppealableIssues] = useState(null);

  // Raw JSON states
  const [rawServiceHistory, setRawServiceHistory] = useState(null);
  const [rawClaims, setRawClaims] = useState(null);
  const [rawAppealableIssues, setRawAppealableIssues] = useState(null);

  // UI states
  const [loading, setLoading] = useState({
    serviceHistory: false,
    claims: false,
    appealableIssues: false,
  });
  const [errors, setErrors] = useState({
    serviceHistory: null,
    claims: null,
    appealableIssues: null,
  });
  const [showRawJson, setShowRawJson] = useState({
    serviceHistory: false,
    claims: false,
    appealableIssues: false,
  });
  const [expandedClaim, setExpandedClaim] = useState(null);

  const fetchServiceHistory = () =>
    _fetchServiceHistoryData(accessToken, {
      setLoading,
      setErrors,
      setRawServiceHistory,
      setServiceHistory,
    });

  const fetchClaims = () =>
    _fetchClaimsData(accessToken, {
      setLoading,
      setErrors,
      setRawClaims,
      setClaims,
    });

  // Note: Appeals API is Future Scope - this function is available but not auto-called
  const fetchAppealableIssues = () =>
    _fetchAppealableIssuesData(accessToken, {
      setLoading,
      setErrors,
      setRawAppealableIssues,
      setAppealableIssues,
    });

  // Fetch all data when authenticated
  const fetchAllData = useCallback(async () => {
    if (!accessToken) return;

    // Fetch service history
    fetchServiceHistory();
    // Fetch claims
    fetchClaims();
    // Note: Appeals API (fetchAppealableIssues) is Future Scope - not called automatically
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Auto-fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchAllData();
    }
  }, [isAuthenticated, accessToken, fetchAllData]);

  const toggleRawJson = (key) => {
    setShowRawJson((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogin = async () => {
    await login();
  };

  const handleLogout = async () => {
    await logout();
    setServiceHistory(null);
    setClaims(null);
    setAppealableIssues(null);
    setRawServiceHistory(null);
    setRawClaims(null);
    setRawAppealableIssues(null);
  };

  const header = (
    <VaIntegrationHeader
      onClose={onClose}
      isAuthenticated={isAuthenticated}
      userInfo={userInfo}
      authLoading={authLoading}
      authError={authError}
      handleLogin={handleLogin}
      handleLogout={handleLogout}
      setShowSandboxTest={setShowSandboxTest}
    />
  );

  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={onClose}
        size="2xl"
        labelledBy="va-integration-title"
        header={header}
      >
        {/* Content */}
        <div>
          {!isAuthenticated ? (
            <VaNotAuthenticatedView
              handleLogin={handleLogin}
              authLoading={authLoading}
            />
          ) : (
            <VaAuthenticatedView
              loading={loading}
              errors={errors}
              serviceHistory={serviceHistory}
              rawServiceHistory={rawServiceHistory}
              claims={claims}
              rawClaims={rawClaims}
              appealableIssues={appealableIssues}
              rawAppealableIssues={rawAppealableIssues}
              showRawJson={showRawJson}
              fetchAllData={fetchAllData}
              fetchServiceHistory={fetchServiceHistory}
              fetchClaims={fetchClaims}
              fetchAppealableIssues={fetchAppealableIssues}
              toggleRawJson={toggleRawJson}
              expandedClaim={expandedClaim}
              setExpandedClaim={setExpandedClaim}
            />
          )}
        </div>
      </ResponsiveModal>

      {/* Sandbox Test Modal — lifted above the z-60 shell */}
      {showSandboxTest && (
        <div className="relative z-[70]">
          <VaSandboxTest onClose={() => setShowSandboxTest(false)} />
        </div>
      )}
    </>
  );
};

export default VaIntegrationTest;
