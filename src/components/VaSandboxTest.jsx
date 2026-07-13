/**
 * VA Sandbox Test Dashboard
 *
 * Comprehensive validation dashboard for VA.gov API integration.
 * Tests ALL requested APIs (both OAuth and API Key endpoints) for Production Demo.
 *
 * OAuth-Protected APIs (User Data):
 * - Service History
 * - Claims
 * - Appealable Issues
 * - Appeals Status
 *
 * API Key APIs (Open Data):
 * - VA Facilities
 * - VA Forms
 * - Benefits Reference Data (Disabilities)
 *
 * Power User Features:
 * - DBQ Finder (Disability Benefits Questionnaire search)
 * - Evidence Upload (Direct claim document submission)
 */

import { useState, useEffect, useCallback } from "react";
import { useVaAuth } from "../hooks/useVaAuth";
import {
  getServiceHistory,
  getClaims,
  getAppealableIssues,
  getAppealsStatus,
  getFacilities,
  searchForms,
  getBenefitsReferenceDisabilities,
  formatServiceHistory,
  formatClaims,
  formatAppealableIssues,
  formatAppealsStatus,
  formatForms,
  formatBenefitsDisabilities,
  formatFacilities,
} from "../api/va";
import {
  VA_FACILITIES_API_KEY,
  VA_FORMS_API_KEY,
  VA_BENEFITS_REF_API_KEY,
  getVaConfigStatus,
  isVaIntegrationConfigured,
} from "../config/vaAuth";
import DbqFinder from "./DbqFinder";
import ClaimEvidenceUpload from "./ClaimEvidenceUpload";
import VaDataConsentPrompt from "./VaDataConsentPrompt";
import { saveVADataWithConsent } from "../utils/vaDataPersistence";
import ResponsiveModal from "./common/ResponsiveModal";

// Icons
import {
  Shield,
  FileText,
  AlertTriangle,
  RefreshCw,
  LogIn,
  LogOut,
  User,
  ChevronDown,
  ChevronUp,
  Code,
  CheckCircle,
  Clock,
  Loader2,
  ExternalLink,
  Info,
  AlertCircle,
  Medal,
  MapPin,
  FileSearch,
  Database,
  Gavel,
  Check,
  X,
  Building2,
  FileType,
  ListChecks,
  Upload,
  Sparkles,
  BookOpen,
} from "lucide-react";

const formatDate = (dateString) => {
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
};

const getTestStatusIcon = (key, testResults) => {
  const status = testResults[key];
  if (status === "pass") return <Check className="w-5 h-5 text-green-500" />;
  if (status === "fail") return <X className="w-5 h-5 text-red-500" />;
  return <Clock className="w-5 h-5 text-gray-400" />;
};

const getTestStatusBg = (key, testResults) => {
  const status = testResults[key];
  if (status === "pass")
    return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700";
  if (status === "fail")
    return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700";
  return "bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600";
};

// Loading spinner component
const LoadingSpinner = ({ text = "Loading..." }) => (
  <div className="flex items-center justify-center py-6 text-gray-500 dark:text-gray-400">
    <Loader2 className="w-5 h-5 animate-spin mr-2" />
    <span className="text-sm">{text}</span>
  </div>
);

// Error component
const ErrorMessage = ({ message, onRetry }) => (
  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3">
    <div className="flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-red-700 dark:text-red-300 text-sm">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-1 text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        )}
      </div>
    </div>
  </div>
);

// Raw JSON toggle component
const RawJsonToggle = ({ isOpen, onToggle, data }) => (
  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
    <button
      onClick={onToggle}
      className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
    >
      <Code className="w-3 h-3" />
      {isOpen ? "Hide" : "Show"} Raw JSON
      {isOpen ? (
        <ChevronUp className="w-3 h-3" />
      ) : (
        <ChevronDown className="w-3 h-3" />
      )}
    </button>
    {isOpen && data && (
      <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-auto max-h-64 font-mono">
        {JSON.stringify(data, null, 2)}
      </pre>
    )}
  </div>
);

function getAuthStatusDotClass(isAuthenticated, isConfigured) {
  if (isAuthenticated) return "bg-green-400";
  if (isConfigured) return "bg-yellow-400";
  return "bg-red-400";
}

function getAuthStatusText(authLoading, isAuthenticated, isConfigured) {
  if (authLoading) return "Checking...";
  if (isAuthenticated) return "Connected to VA.gov";
  if (isConfigured) return "Not Connected";
  return "Configuration Required";
}

/**
 * Modal header: title, VA OAuth config warning, and connect/disconnect status
 */
function SandboxConfigWarning({ configStatus }) {
  return (
    <div className="mt-4 bg-yellow-500/20 border border-yellow-400/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-yellow-100">
            VA OAuth Not Configured
          </p>
          <p className="text-sm text-yellow-200 mt-1">
            Missing environment variables. Set these in your Render Dashboard
            or .env.local:
          </p>
          <ul className="text-xs text-yellow-300 mt-2 space-y-1 font-mono">
            {!configStatus.hasOAuth && (
              <>
                <li>
                  • VITE_VA_AUTH_ID (from sandbox form at
                  developer.va.gov/explore)
                </li>
                <li>
                  • VITE_VA_REDIRECT_URL (must match what you submitted on the
                  VA sandbox form)
                </li>
                <li>
                  • VITE_VA_OAUTH_API_PATH (e.g., veteran-verification/v1)
                </li>
              </>
            )}
            {!configStatus.hasApiKey && (
              <li>• VITE_VA_API_KEY (for Facilities API)</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AuthStatusBar({
  isAuthenticated,
  userInfo,
  authLoading,
  configured,
  login,
  logout,
}) {
  return (
    <div className="mt-4 flex items-center justify-between bg-white/10 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-3 h-3 rounded-full ${getAuthStatusDotClass(isAuthenticated, configured)} animate-pulse`}
        />
        <span className="font-medium">
          {getAuthStatusText(authLoading, isAuthenticated, configured)}
        </span>
        {isAuthenticated && userInfo && (
          <span className="text-green-200 text-sm ml-2">
            • {userInfo.given_name || "Veteran"}
          </span>
        )}
      </div>
      {isAuthenticated ? (
        <button
          onClick={logout}
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg"
        >
          <LogOut className="w-4 h-4" /> Disconnect
        </button>
      ) : (
        <button
          onClick={login}
          disabled={authLoading || !configured}
          className="flex items-center gap-2 bg-white text-green-800 hover:bg-green-50 px-4 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={
            !configured
              ? "Configure environment variables first"
              : "Connect to VA.gov"
          }
        >
          <LogIn className="w-4 h-4" /> Connect VA Account
        </button>
      )}
    </div>
  );
}

function SandboxHeader({
  onClose,
  isAuthenticated,
  userInfo,
  authLoading,
  authError,
  login,
  logout,
}) {
  const configured = isVaIntegrationConfigured();
  const configStatus = getVaConfigStatus();

  return (
    <div className="bg-gradient-to-r from-green-800 via-green-700 to-teal-700 text-white p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center">
            <ListChecks className="w-8 h-8" />
          </div>
          <div>
            <h2 id="va-sandbox-title" className="text-2xl font-bold">
              VA Sandbox Validation Dashboard{" "}
              <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
                BETA
              </span>
            </h2>
            <p className="text-green-200 text-sm mt-1">
              Production Access Demo • All APIs Tested
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-2"
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

      {/* Configuration Status Warning */}
      {!configured && <SandboxConfigWarning configStatus={configStatus} />}

      <AuthStatusBar
        isAuthenticated={isAuthenticated}
        userInfo={userInfo}
        authLoading={authLoading}
        configured={configured}
        login={login}
        logout={logout}
      />

      {authError && (
        <div className="mt-3 bg-red-500/20 border border-red-300/30 rounded-lg p-3 text-sm text-red-100">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {authError}
        </div>
      )}
    </div>
  );
}

/**
 * Section A: Open Data APIs (Facilities, Forms, Benefits Reference) — no
 * OAuth login required, only API keys
 */
function ApiKeyWarningBanner({
  isFacilitiesApiKeyConfigured,
  isFormsApiKeyConfigured,
  isBenefitsApiKeyConfigured,
}) {
  if (
    isFacilitiesApiKeyConfigured &&
    isFormsApiKeyConfigured &&
    isBenefitsApiKeyConfigured
  ) {
    return null;
  }

  return (
    <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-yellow-800 dark:text-yellow-200">
            API Key(s) Required
          </p>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
            {!isFacilitiesApiKeyConfigured && (
              <li>
                •{" "}
                <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">
                  VITE_VA_API_KEY
                </code>{" "}
                (VA Facilities)
              </li>
            )}
            {!isFormsApiKeyConfigured && (
              <li>
                •{" "}
                <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">
                  VITE_VA_FORMS_API_KEY
                </code>{" "}
                (VA Forms)
              </li>
            )}
            {!isBenefitsApiKeyConfigured && (
              <li>
                •{" "}
                <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">
                  VITE_VA_BENEFITS_REF_API_KEY
                </code>{" "}
                (Benefits Reference)
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function FacilitiesApiCard({
  isFacilitiesApiKeyConfigured,
  loading,
  error,
  testResults,
  testFacilitiesApi,
  facilities,
  rawFacilities,
  showRawJson,
  toggleRawJson,
}) {
  return (
    <div
      className={`border rounded-xl p-4 ${getTestStatusBg("facilities", testResults)}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Facilities API
          </h4>
        </div>
        {getTestStatusIcon("facilities", testResults)}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Search ZIP: 97217
      </p>

      <button
        onClick={testFacilitiesApi}
        disabled={loading || !isFacilitiesApiKeyConfigured}
        className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Building2 className="w-4 h-4" />
        )}
        Test Facilities
      </button>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {facilities && (
        <div className="mt-3 text-sm">
          <p className="text-green-600 dark:text-green-400 font-medium">
            ✓ Found {facilities.length} facilities
          </p>
          {facilities.slice(0, 2).map((f, i) => (
            <p
              key={i}
              className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1"
            >
              • {f.name}
            </p>
          ))}
        </div>
      )}
      <RawJsonToggle
        isOpen={showRawJson.facilities}
        onToggle={() => toggleRawJson("facilities")}
        data={rawFacilities}
      />
    </div>
  );
}

function FormsApiCard({
  isFormsApiKeyConfigured,
  loading,
  error,
  testResults,
  testFormsApi,
  forms,
  rawForms,
  showRawJson,
  toggleRawJson,
}) {
  return (
    <div
      className={`border rounded-xl p-4 ${getTestStatusBg("forms", testResults)}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileType className="w-5 h-5 text-purple-600" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Forms API
          </h4>
        </div>
        {getTestStatusIcon("forms", testResults)}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Search: &quot;21-526EZ&quot;
      </p>

      <button
        onClick={testFormsApi}
        disabled={loading || !isFormsApiKeyConfigured}
        className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileSearch className="w-4 h-4" />
        )}
        Test Forms
      </button>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {forms && forms.length > 0 && (
        <div className="mt-3 text-sm">
          <p className="text-green-600 dark:text-green-400 font-medium">
            ✓ Found {forms.length} form(s)
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {forms[0]?.title?.slice(0, 60)}...
          </p>
          {forms[0]?.pdfUrl && (
            <a
              href={forms[0].pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
            >
              <ExternalLink className="w-3 h-3" /> View PDF
            </a>
          )}
        </div>
      )}
      <RawJsonToggle
        isOpen={showRawJson.forms}
        onToggle={() => toggleRawJson("forms")}
        data={rawForms}
      />
    </div>
  );
}

function BenefitsReferenceCard({
  isBenefitsApiKeyConfigured,
  loading,
  error,
  testResults,
  testDisabilitiesApi,
  disabilities,
  rawDisabilities,
  showRawJson,
  toggleRawJson,
}) {
  return (
    <div
      className={`border rounded-xl p-4 ${getTestStatusBg("disabilities", testResults)}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-teal-600" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Reference Data
          </h4>
        </div>
        {getTestStatusIcon("disabilities", testResults)}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Disabilities List
      </p>

      <button
        onClick={testDisabilitiesApi}
        disabled={loading || !isBenefitsApiKeyConfigured}
        className="w-full px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ListChecks className="w-4 h-4" />
        )}
        Test Reference Data
      </button>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {disabilities && (
        <div className="mt-3 text-sm">
          <p className="text-green-600 dark:text-green-400 font-medium">
            ✓ Found {disabilities.length} disabilities
          </p>
          {disabilities.slice(0, 3).map((d, i) => (
            <p
              key={i}
              className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1"
            >
              • {d.name}
            </p>
          ))}
        </div>
      )}
      <RawJsonToggle
        isOpen={showRawJson.disabilities}
        onToggle={() => toggleRawJson("disabilities")}
        data={rawDisabilities}
      />
    </div>
  );
}

/**
 * Section A: Open Data APIs (Facilities, Forms, Benefits Reference) — no
 * OAuth login required, only API keys
 */
function OpenDataSection({
  isFacilitiesApiKeyConfigured,
  isFormsApiKeyConfigured,
  isBenefitsApiKeyConfigured,
  loading,
  errors,
  testResults,
  testFacilitiesApi,
  testFormsApi,
  testDisabilitiesApi,
  facilities,
  rawFacilities,
  forms,
  rawForms,
  disabilities,
  rawDisabilities,
  showRawJson,
  toggleRawJson,
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Database className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Section A: Open Data APIs
        </h3>
        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-bold rounded">
          API KEY
        </span>
      </div>

      <ApiKeyWarningBanner
        isFacilitiesApiKeyConfigured={isFacilitiesApiKeyConfigured}
        isFormsApiKeyConfigured={isFormsApiKeyConfigured}
        isBenefitsApiKeyConfigured={isBenefitsApiKeyConfigured}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FacilitiesApiCard
          isFacilitiesApiKeyConfigured={isFacilitiesApiKeyConfigured}
          loading={loading.facilities}
          error={errors.facilities}
          testResults={testResults}
          testFacilitiesApi={testFacilitiesApi}
          facilities={facilities}
          rawFacilities={rawFacilities}
          showRawJson={showRawJson}
          toggleRawJson={toggleRawJson}
        />
        <FormsApiCard
          isFormsApiKeyConfigured={isFormsApiKeyConfigured}
          loading={loading.forms}
          error={errors.forms}
          testResults={testResults}
          testFormsApi={testFormsApi}
          forms={forms}
          rawForms={rawForms}
          showRawJson={showRawJson}
          toggleRawJson={toggleRawJson}
        />
        <BenefitsReferenceCard
          isBenefitsApiKeyConfigured={isBenefitsApiKeyConfigured}
          loading={loading.disabilities}
          error={errors.disabilities}
          testResults={testResults}
          testDisabilitiesApi={testDisabilitiesApi}
          disabilities={disabilities}
          rawDisabilities={rawDisabilities}
          showRawJson={showRawJson}
          toggleRawJson={toggleRawJson}
        />
      </div>
    </div>
  );
}

function getEvidenceUploadLabel(isAuthenticated, claims) {
  if (!isAuthenticated) return "Login to Upload";
  if (!claims || claims.length === 0) return "No Active Claims";
  return "Upload Evidence";
}

/**
 * Power user tools: DBQ Finder and direct-to-VA Evidence Upload
 */
function DbqFinderCard({ setShowDbqFinder }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-amber-200 dark:border-amber-700 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-lg flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white">
            DBQ Finder
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Find the right medical form
          </p>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Search for Disability Benefits Questionnaires by condition. Get the
        exact form your private doctor needs to fill out.
      </p>
      <button
        onClick={() => setShowDbqFinder(true)}
        className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
      >
        <FileSearch className="w-4 h-4" />
        Find DBQ Forms
      </button>
    </div>
  );
}

function EvidenceUploadCard({
  isAuthenticated,
  claims,
  setSelectedClaimForUpload,
  setShowEvidenceUpload,
  login,
}) {
  const handleUploadClick = () => {
    if (isAuthenticated && claims && claims.length > 0) {
      setSelectedClaimForUpload(claims[0]);
      setShowEvidenceUpload(true);
    } else if (!isAuthenticated) {
      login();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-amber-200 dark:border-amber-700 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
          <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white">
            Evidence Upload
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Submit directly to VA
          </p>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Upload completed DBQs, Nexus Letters, or buddy statements directly to
        your active claim via VA API.
      </p>
      <button
        onClick={handleUploadClick}
        disabled={isAuthenticated && (!claims || claims.length === 0)}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload className="w-4 h-4" />
        {getEvidenceUploadLabel(isAuthenticated, claims)}
      </button>
      {isAuthenticated && claims && claims.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          Will upload to: {claims[0].type || "Compensation"} Claim
        </p>
      )}
    </div>
  );
}

function PowerUserFeatures({
  setShowDbqFinder,
  isAuthenticated,
  claims,
  setSelectedClaimForUpload,
  setShowEvidenceUpload,
  login,
}) {
  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-700">
      <div className="flex items-center gap-3 mb-4">
        <Sparkles className="w-6 h-6 text-amber-600" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Power User Features
        </h3>
        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 text-xs font-bold rounded">
          NEW
        </span>
      </div>

      <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
        Advanced tools for managing your VA claim directly through official
        APIs
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DbqFinderCard setShowDbqFinder={setShowDbqFinder} />
        <EvidenceUploadCard
          isAuthenticated={isAuthenticated}
          claims={claims}
          setSelectedClaimForUpload={setSelectedClaimForUpload}
          setShowEvidenceUpload={setShowEvidenceUpload}
          login={login}
        />
      </div>
    </div>
  );
}

function ServiceHistoryCard({
  testResults,
  loading,
  error,
  serviceHistory,
  onRetry,
  showRawJson,
  toggleRawJson,
  rawServiceHistory,
}) {
  const renderBody = () => {
    if (loading) return <LoadingSpinner text="Fetching service history..." />;
    if (error) return <ErrorMessage message={error} onRetry={onRetry} />;
    if (serviceHistory && serviceHistory.length > 0) {
      return (
        <div className="space-y-2">
          {serviceHistory.map((s, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm"
            >
              <p className="font-medium text-gray-900 dark:text-white">
                {s.branch}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {formatDate(s.startDate)} - {formatDate(s.endDate)}
              </p>
              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded">
                {s.dischargeStatus}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return <p className="text-sm text-gray-500">No service history found</p>;
  };

  return (
    <div
      className={`border rounded-xl p-4 ${getTestStatusBg("serviceHistory", testResults)}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Medal className="w-5 h-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Service History
          </h4>
        </div>
        {getTestStatusIcon("serviceHistory", testResults)}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Scope: service_history.read
      </p>
      {renderBody()}
      <RawJsonToggle
        isOpen={showRawJson.serviceHistory}
        onToggle={() => toggleRawJson("serviceHistory")}
        data={rawServiceHistory}
      />
    </div>
  );
}

function ClaimsCard({
  testResults,
  loading,
  error,
  claims,
  onRetry,
  showRawJson,
  toggleRawJson,
  rawClaims,
}) {
  const renderBody = () => {
    if (loading) return <LoadingSpinner text="Fetching claims..." />;
    if (error) return <ErrorMessage message={error} onRetry={onRetry} />;
    if (claims && claims.length > 0) {
      return (
        <div className="space-y-2">
          {claims.slice(0, 3).map((c, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm"
            >
              <p className="font-medium text-gray-900 dark:text-white">
                {c.type} Claim
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Filed: {formatDate(c.dateFiled)}
              </p>
              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded">
                Phase {c.phase?.number}: {c.phase?.name}
              </span>
            </div>
          ))}
          {claims.length > 3 && (
            <p className="text-xs text-gray-500">
              +{claims.length - 3} more claims
            </p>
          )}
        </div>
      );
    }
    return <p className="text-sm text-gray-500">No claims found</p>;
  };

  return (
    <div
      className={`border rounded-xl p-4 ${getTestStatusBg("claims", testResults)}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-green-600" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Claims
          </h4>
        </div>
        {getTestStatusIcon("claims", testResults)}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Scope: claim.read
      </p>
      {renderBody()}
      <RawJsonToggle
        isOpen={showRawJson.claims}
        onToggle={() => toggleRawJson("claims")}
        data={rawClaims}
      />
    </div>
  );
}

function AppealableIssuesCard({
  testResults,
  loading,
  error,
  appealableIssues,
  onRetry,
  showRawJson,
  toggleRawJson,
  rawAppealableIssues,
}) {
  const renderBody = () => {
    if (loading) return <LoadingSpinner text="Fetching issues..." />;
    if (error) return <ErrorMessage message={error} onRetry={onRetry} />;
    if (appealableIssues && appealableIssues.length > 0) {
      return (
        <div className="space-y-2">
          {appealableIssues.slice(0, 3).map((issue, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm"
            >
              <p className="font-medium text-gray-900 dark:text-white">
                {issue.subject}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Decision: {formatDate(issue.decisionDate)}
              </p>
              {issue.percentNumber !== undefined && (
                <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-200 rounded">
                  Rated: {issue.percentNumber}%
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }
    return (
      <p className="text-sm text-gray-500 flex items-center gap-1">
        <Check className="w-4 h-4 text-green-500" /> No appealable issues
      </p>
    );
  };

  return (
    <div
      className={`border rounded-xl p-4 ${getTestStatusBg("appealableIssues", testResults)}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Appealable Issues
          </h4>
        </div>
        {getTestStatusIcon("appealableIssues", testResults)}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Scope: appealable_issues.read
      </p>
      {renderBody()}
      <RawJsonToggle
        isOpen={showRawJson.appealableIssues}
        onToggle={() => toggleRawJson("appealableIssues")}
        data={rawAppealableIssues}
      />
    </div>
  );
}

function AppealsStatusCard({
  testResults,
  loading,
  error,
  appealsStatus,
  onRetry,
  showRawJson,
  toggleRawJson,
  rawAppealsStatus,
}) {
  const renderBody = () => {
    if (loading) return <LoadingSpinner text="Fetching appeals..." />;
    if (error) return <ErrorMessage message={error} onRetry={onRetry} />;
    if (appealsStatus && appealsStatus.length > 0) {
      return (
        <div className="space-y-2">
          {appealsStatus.slice(0, 3).map((appeal, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm"
            >
              <p className="font-medium text-gray-900 dark:text-white capitalize">
                {appeal.type} Appeal
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Program: {appeal.programArea}
              </p>
              <span
                className={`text-xs px-2 py-0.5 rounded ${appeal.active ? "bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
              >
                {appeal.active ? "Active" : "Closed"}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return <p className="text-sm text-gray-500">No active appeals</p>;
  };

  return (
    <div
      className={`border rounded-xl p-4 ${getTestStatusBg("appealsStatus", testResults)}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gavel className="w-5 h-5 text-purple-600" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Appeals Status
          </h4>
        </div>
        {getTestStatusIcon("appealsStatus", testResults)}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Scope: appeals_status.read
      </p>
      {renderBody()}
      <RawJsonToggle
        isOpen={showRawJson.appealsStatus}
        onToggle={() => toggleRawJson("appealsStatus")}
        data={rawAppealsStatus}
      />
    </div>
  );
}

/**
 * Section B: OAuth-protected user data APIs (service history, claims,
 * appealable issues, appeals status)
 */
function UserDataLoginPrompt({ authLoading, login }) {
  return (
    <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
      <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Login Required
      </h4>
      <p className="text-gray-600 dark:text-gray-300 mb-4">
        Connect your VA.gov account to test user data APIs
      </p>
      <button
        onClick={login}
        disabled={authLoading}
        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2 mx-auto"
      >
        <LogIn className="w-5 h-5" /> Connect VA Account
      </button>
    </div>
  );
}

function RefreshAllUserDataButton({ fetchAllUserData, anyLoading }) {
  return (
    <div className="flex justify-end mb-4">
      <button
        onClick={fetchAllUserData}
        disabled={anyLoading}
        className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1 disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${anyLoading ? "animate-spin" : ""}`} />
        Refresh All User Data
      </button>
    </div>
  );
}

function UserDataCardsGrid({
  fetchAllUserData,
  loading,
  testResults,
  errors,
  serviceHistory,
  fetchServiceHistory,
  claims,
  fetchClaims,
  appealableIssues,
  fetchAppealableIssues,
  appealsStatus,
  fetchAppealsStatus,
  showRawJson,
  toggleRawJson,
  rawServiceHistory,
  rawClaims,
  rawAppealableIssues,
  rawAppealsStatus,
}) {
  const anyLoading =
    loading.serviceHistory ||
    loading.claims ||
    loading.appealableIssues ||
    loading.appealsStatus;

  return (
    <>
      <RefreshAllUserDataButton
        fetchAllUserData={fetchAllUserData}
        anyLoading={anyLoading}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ServiceHistoryCard
          testResults={testResults}
          loading={loading.serviceHistory}
          error={errors.serviceHistory}
          serviceHistory={serviceHistory}
          onRetry={fetchServiceHistory}
          showRawJson={showRawJson}
          toggleRawJson={toggleRawJson}
          rawServiceHistory={rawServiceHistory}
        />
        <ClaimsCard
          testResults={testResults}
          loading={loading.claims}
          error={errors.claims}
          claims={claims}
          onRetry={fetchClaims}
          showRawJson={showRawJson}
          toggleRawJson={toggleRawJson}
          rawClaims={rawClaims}
        />
        <AppealableIssuesCard
          testResults={testResults}
          loading={loading.appealableIssues}
          error={errors.appealableIssues}
          appealableIssues={appealableIssues}
          onRetry={fetchAppealableIssues}
          showRawJson={showRawJson}
          toggleRawJson={toggleRawJson}
          rawAppealableIssues={rawAppealableIssues}
        />
        <AppealsStatusCard
          testResults={testResults}
          loading={loading.appealsStatus}
          error={errors.appealsStatus}
          appealsStatus={appealsStatus}
          onRetry={fetchAppealsStatus}
          showRawJson={showRawJson}
          toggleRawJson={toggleRawJson}
          rawAppealsStatus={rawAppealsStatus}
        />
      </div>
    </>
  );
}

function UserDataSection({
  isAuthenticated,
  authLoading,
  login,
  fetchAllUserData,
  loading,
  testResults,
  errors,
  serviceHistory,
  fetchServiceHistory,
  claims,
  fetchClaims,
  appealableIssues,
  fetchAppealableIssues,
  appealsStatus,
  fetchAppealsStatus,
  showRawJson,
  toggleRawJson,
  rawServiceHistory,
  rawClaims,
  rawAppealableIssues,
  rawAppealsStatus,
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-6 h-6 text-green-600" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Section B: User Data APIs
        </h3>
        <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 text-xs font-bold rounded">
          OAUTH
        </span>
      </div>

      {!isAuthenticated ? (
        <UserDataLoginPrompt authLoading={authLoading} login={login} />
      ) : (
        <UserDataCardsGrid
          fetchAllUserData={fetchAllUserData}
          loading={loading}
          testResults={testResults}
          errors={errors}
          serviceHistory={serviceHistory}
          fetchServiceHistory={fetchServiceHistory}
          claims={claims}
          fetchClaims={fetchClaims}
          appealableIssues={appealableIssues}
          fetchAppealableIssues={fetchAppealableIssues}
          appealsStatus={appealsStatus}
          fetchAppealsStatus={fetchAppealsStatus}
          showRawJson={showRawJson}
          toggleRawJson={toggleRawJson}
          rawServiceHistory={rawServiceHistory}
          rawClaims={rawClaims}
          rawAppealableIssues={rawAppealableIssues}
          rawAppealsStatus={rawAppealsStatus}
        />
      )}
    </div>
  );
}

const TEST_SUMMARY_KEYS = [
  "facilities",
  "forms",
  "disabilities",
  "serviceHistory",
  "claims",
  "appealableIssues",
  "appealsStatus",
];

/**
 * API test summary grid plus the sandbox-environment info footer
 */
function TestSummaryFooter({ testResults }) {
  return (
    <>
      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <ListChecks className="w-5 h-5" /> API Test Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          {TEST_SUMMARY_KEYS.map((key) => (
            <div
              key={key}
              className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg"
            >
              {getTestStatusIcon(key, testResults)}
              <span className="capitalize text-gray-700 dark:text-gray-300">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Scopes Requested:</strong> openid profile offline_access
            claim.read service_history.read appealable_issues.read
            appeals_status.read
          </p>
        </div>
      </div>

      {/* Info Footer */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold">Sandbox Environment</p>
            <p className="mt-1">
              All data shown is synthetic test data from VA.gov Sandbox.
              Production access requires VA approval.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Power-user feature modals, VA data consent prompt, and success toast
 * rendered outside the main ResponsiveModal
 */
function SandboxModals({
  showDbqFinder,
  setShowDbqFinder,
  showEvidenceUpload,
  selectedClaimForUpload,
  accessToken,
  fetchClaims,
  setShowEvidenceUpload,
  setSelectedClaimForUpload,
  showConsentPrompt,
  handleConsent,
  handleSkipConsent,
  claims,
  serviceHistory,
  appealsStatus,
  appealableIssues,
  saveSuccessMessage,
}) {
  return (
    <>
      {/* Power User Feature Modals */}
      {showDbqFinder && <DbqFinder onClose={() => setShowDbqFinder(false)} />}

      {showEvidenceUpload && selectedClaimForUpload && (
        <ClaimEvidenceUpload
          claimId={selectedClaimForUpload.id}
          accessToken={accessToken}
          claimDetails={selectedClaimForUpload}
          onUploadSuccess={() => {
            // Optionally refresh claims after successful upload
            fetchClaims();
          }}
          onClose={() => {
            setShowEvidenceUpload(false);
            setSelectedClaimForUpload(null);
          }}
        />
      )}

      {/* Consent Prompt */}
      {showConsentPrompt && (
        <VaDataConsentPrompt
          onConsent={handleConsent}
          onSkip={handleSkipConsent}
          vaData={{
            claims,
            serviceHistory,
            appeals: appealsStatus,
            appealableIssues,
          }}
        />
      )}

      {/* Success Message Toast */}
      {saveSuccessMessage && (
        <div className="fixed top-4 right-4 z-[10000] max-w-md">
          <div className="bg-green-600 text-white rounded-lg shadow-2xl p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Success!</p>
              <p className="text-sm text-green-100">{saveSuccessMessage}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Runs a single sandbox API fetch, threading it through the shared
 * loading/error/raw-JSON/testResults state slices keyed by `key`.
 */
async function runSandboxFetch({
  fetchFn,
  formatFn,
  setRaw,
  setFormatted,
  setLoading,
  setErrors,
  setTestResults,
  key,
  errorLabel,
}) {
  setLoading((prev) => ({ ...prev, [key]: true }));
  setErrors((prev) => ({ ...prev, [key]: null }));
  try {
    const data = await fetchFn();
    setRaw(data);
    setFormatted(formatFn(data));
    setTestResults((prev) => ({ ...prev, [key]: "pass" }));
  } catch (err) {
    console.error(`[Sandbox Test] ${errorLabel} error:`, err);
    setErrors((prev) => ({ ...prev, [key]: err.message }));
    setTestResults((prev) => ({ ...prev, [key]: "fail" }));
  } finally {
    setLoading((prev) => ({ ...prev, [key]: false }));
  }
}

const SANDBOX_STATUS_KEYS = [
  "serviceHistory",
  "claims",
  "appealableIssues",
  "appealsStatus",
  "facilities",
  "forms",
  "disabilities",
];

const makeStatusDefaults = (value) =>
  Object.fromEntries(SANDBOX_STATUS_KEYS.map((key) => [key, value]));

const isApiKeyConfigured = (key, placeholder) =>
  Boolean(key && key !== placeholder);

function buildUserDataFetchers({
  accessToken,
  setRawServiceHistory,
  setServiceHistory,
  setRawClaims,
  setClaims,
  setRawAppealableIssues,
  setAppealableIssues,
  setRawAppealsStatus,
  setAppealsStatus,
  setLoading,
  setErrors,
  setTestResults,
}) {
  const shared = { setLoading, setErrors, setTestResults };
  return {
    fetchServiceHistory: () =>
      runSandboxFetch({
        ...shared,
        fetchFn: () => getServiceHistory(accessToken),
        formatFn: formatServiceHistory,
        setRaw: setRawServiceHistory,
        setFormatted: setServiceHistory,
        key: "serviceHistory",
        errorLabel: "Service history",
      }),
    fetchClaims: () =>
      runSandboxFetch({
        ...shared,
        fetchFn: () => getClaims(accessToken),
        formatFn: formatClaims,
        setRaw: setRawClaims,
        setFormatted: setClaims,
        key: "claims",
        errorLabel: "Claims",
      }),
    fetchAppealableIssues: () =>
      runSandboxFetch({
        ...shared,
        fetchFn: () => getAppealableIssues(accessToken),
        formatFn: formatAppealableIssues,
        setRaw: setRawAppealableIssues,
        setFormatted: setAppealableIssues,
        key: "appealableIssues",
        errorLabel: "Appealable issues",
      }),
    fetchAppealsStatus: () =>
      runSandboxFetch({
        ...shared,
        fetchFn: () => getAppealsStatus(accessToken),
        formatFn: formatAppealsStatus,
        setRaw: setRawAppealsStatus,
        setFormatted: setAppealsStatus,
        key: "appealsStatus",
        errorLabel: "Appeals status",
      }),
  };
}

function buildOpenDataFetchers({
  setRawFacilities,
  setFacilities,
  setRawForms,
  setForms,
  setRawDisabilities,
  setDisabilities,
  setLoading,
  setErrors,
  setTestResults,
}) {
  const shared = { setLoading, setErrors, setTestResults };
  return {
    testFacilitiesApi: () =>
      runSandboxFetch({
        ...shared,
        fetchFn: () =>
          getFacilities(VA_FACILITIES_API_KEY, { zip: "97217", perPage: 5 }),
        formatFn: formatFacilities,
        setRaw: setRawFacilities,
        setFormatted: setFacilities,
        key: "facilities",
        errorLabel: "Facilities",
      }),
    testFormsApi: () =>
      runSandboxFetch({
        ...shared,
        fetchFn: () => searchForms(VA_FACILITIES_API_KEY, "21-526EZ"),
        formatFn: formatForms,
        setRaw: setRawForms,
        setFormatted: setForms,
        key: "forms",
        errorLabel: "Forms",
      }),
    testDisabilitiesApi: () =>
      runSandboxFetch({
        ...shared,
        fetchFn: () =>
          getBenefitsReferenceDisabilities(VA_FACILITIES_API_KEY),
        formatFn: formatBenefitsDisabilities,
        setRaw: setRawDisabilities,
        setFormatted: setDisabilities,
        key: "disabilities",
        errorLabel: "Disabilities",
      }),
  };
}

/**
 * Encapsulates all VA Sandbox API data: OAuth-protected user data
 * (service history, claims, appealable issues, appeals status) and
 * API-key-protected open data (facilities, forms, benefits reference),
 * plus their loading/error/raw-JSON state and fetchers.
 */
function useVaSandboxDataState() {
  const [serviceHistory, setServiceHistory] = useState(null);
  const [claims, setClaims] = useState(null);
  const [appealableIssues, setAppealableIssues] = useState(null);
  const [appealsStatus, setAppealsStatus] = useState(null);
  const [rawServiceHistory, setRawServiceHistory] = useState(null);
  const [rawClaims, setRawClaims] = useState(null);
  const [rawAppealableIssues, setRawAppealableIssues] = useState(null);
  const [rawAppealsStatus, setRawAppealsStatus] = useState(null);
  const [facilities, setFacilities] = useState(null);
  const [forms, setForms] = useState(null);
  const [disabilities, setDisabilities] = useState(null);
  const [rawFacilities, setRawFacilities] = useState(null);
  const [rawForms, setRawForms] = useState(null);
  const [rawDisabilities, setRawDisabilities] = useState(null);
  const [loading, setLoading] = useState(() => makeStatusDefaults(false));
  const [errors, setErrors] = useState(() => makeStatusDefaults(null));
  const [showRawJson, setShowRawJson] = useState(() =>
    makeStatusDefaults(false),
  );
  const [testResults, setTestResults] = useState({});

  return {
    serviceHistory,
    setServiceHistory,
    claims,
    setClaims,
    appealableIssues,
    setAppealableIssues,
    appealsStatus,
    setAppealsStatus,
    rawServiceHistory,
    setRawServiceHistory,
    rawClaims,
    setRawClaims,
    rawAppealableIssues,
    setRawAppealableIssues,
    rawAppealsStatus,
    setRawAppealsStatus,
    facilities,
    setFacilities,
    forms,
    setForms,
    disabilities,
    setDisabilities,
    rawFacilities,
    setRawFacilities,
    rawForms,
    setRawForms,
    rawDisabilities,
    setRawDisabilities,
    loading,
    setLoading,
    errors,
    setErrors,
    showRawJson,
    setShowRawJson,
    testResults,
    setTestResults,
  };
}

function useVaSandboxData(isAuthenticated, accessToken) {
  const state = useVaSandboxDataState();
  const { setLoading, setErrors, setTestResults, setShowRawJson } = state;

  const isFacilitiesApiKeyConfigured = isApiKeyConfigured(
    VA_FACILITIES_API_KEY,
    "your_va_api_key_here",
  );
  const isFormsApiKeyConfigured = isApiKeyConfigured(
    VA_FORMS_API_KEY,
    "your_forms_api_key_here",
  );
  const isBenefitsApiKeyConfigured = isApiKeyConfigured(
    VA_BENEFITS_REF_API_KEY,
    "your_benefits_api_key_here",
  );

  const userDataFetchers = buildUserDataFetchers({
    accessToken,
    setRawServiceHistory: state.setRawServiceHistory,
    setServiceHistory: state.setServiceHistory,
    setRawClaims: state.setRawClaims,
    setClaims: state.setClaims,
    setRawAppealableIssues: state.setRawAppealableIssues,
    setAppealableIssues: state.setAppealableIssues,
    setRawAppealsStatus: state.setRawAppealsStatus,
    setAppealsStatus: state.setAppealsStatus,
    setLoading,
    setErrors,
    setTestResults,
  });

  const openDataFetchers = buildOpenDataFetchers({
    setRawFacilities: state.setRawFacilities,
    setFacilities: state.setFacilities,
    setRawForms: state.setRawForms,
    setForms: state.setForms,
    setRawDisabilities: state.setRawDisabilities,
    setDisabilities: state.setDisabilities,
    setLoading,
    setErrors,
    setTestResults,
  });

  // Fetch all user data when authenticated
  const fetchAllUserData = useCallback(async () => {
    if (!accessToken) return;
    userDataFetchers.fetchServiceHistory();
    userDataFetchers.fetchClaims();
    userDataFetchers.fetchAppealableIssues();
    userDataFetchers.fetchAppealsStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Auto-fetch user data when authenticated
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchAllUserData();
    }
  }, [isAuthenticated, accessToken, fetchAllUserData]);

  const toggleRawJson = (key) => {
    setShowRawJson((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return {
    ...state,
    isFacilitiesApiKeyConfigured,
    isFormsApiKeyConfigured,
    isBenefitsApiKeyConfigured,
    fetchAllUserData,
    ...userDataFetchers,
    ...openDataFetchers,
    toggleRawJson,
  };
}

/**
 * Owns the "show the VA-data consent prompt after data loads" flow: the
 * auto-show effect, the save-with-consent handler, and the skip handler.
 */
function useConsentFlow(isAuthenticated, sandboxData) {
  const {
    serviceHistory,
    claims,
    appealableIssues,
    appealsStatus,
    rawServiceHistory,
    rawClaims,
    rawAppealableIssues,
    rawAppealsStatus,
  } = sandboxData;

  const [showConsentPrompt, setShowConsentPrompt] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(null);

  // Show consent prompt after data is successfully loaded
  useEffect(() => {
    if (
      isAuthenticated &&
      (serviceHistory || claims || appealableIssues || appealsStatus)
    ) {
      // Check if user has already seen consent for this session
      const hasSeenConsent = sessionStorage.getItem("va_consent_shown");
      if (!hasSeenConsent) {
        setShowConsentPrompt(true);
        sessionStorage.setItem("va_consent_shown", "true");
      }
    }
  }, [
    isAuthenticated,
    serviceHistory,
    claims,
    appealableIssues,
    appealsStatus,
  ]);

  const handleConsent = async (consent) => {
    try {
      const vaData = {
        claims,
        serviceHistory,
        appeals: appealsStatus,
        appealableIssues,
        rawClaims,
        rawServiceHistory,
        rawAppeals: rawAppealsStatus,
        rawAppealableIssues,
      };

      const results = await saveVADataWithConsent(vaData, consent);

      setShowConsentPrompt(false);

      // Show success message
      if (results.packet.saved || results.vkb.saved) {
        let message = "Data saved successfully! ";
        if (results.packet.count > 0) {
          message += `${results.packet.count} item${results.packet.count > 1 ? "s" : ""} saved to My Packet. `;
        }
        if (results.vkb.saved) {
          message += "Service history saved to Knowledge Base.";
        }
        setSaveSuccessMessage(message);
        setTimeout(() => setSaveSuccessMessage(null), 5000);
      }

      if (results.errors.length > 0) {
        console.error("Save errors:", results.errors);
      }
    } catch (error) {
      console.error("Error saving VA data:", error);
      alert("Error saving data. Please try again.");
    }
  };

  const handleSkipConsent = () => {
    setShowConsentPrompt(false);
    setSaveSuccessMessage(
      "Data not saved - available only during this session.",
    );
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  return { showConsentPrompt, saveSuccessMessage, handleConsent, handleSkipConsent };
}

/**
 * Renders the modal body: Open Data section, Power User features, User
 * Data section, and the test-summary footer.
 */
function SandboxContent({ sandboxData, authData, powerUser }) {
  return (
    <div className="space-y-8">
      <OpenDataSection
        isFacilitiesApiKeyConfigured={sandboxData.isFacilitiesApiKeyConfigured}
        isFormsApiKeyConfigured={sandboxData.isFormsApiKeyConfigured}
        isBenefitsApiKeyConfigured={sandboxData.isBenefitsApiKeyConfigured}
        loading={sandboxData.loading}
        errors={sandboxData.errors}
        testResults={sandboxData.testResults}
        testFacilitiesApi={sandboxData.testFacilitiesApi}
        testFormsApi={sandboxData.testFormsApi}
        testDisabilitiesApi={sandboxData.testDisabilitiesApi}
        facilities={sandboxData.facilities}
        rawFacilities={sandboxData.rawFacilities}
        forms={sandboxData.forms}
        rawForms={sandboxData.rawForms}
        disabilities={sandboxData.disabilities}
        rawDisabilities={sandboxData.rawDisabilities}
        showRawJson={sandboxData.showRawJson}
        toggleRawJson={sandboxData.toggleRawJson}
      />

      <PowerUserFeatures
        setShowDbqFinder={powerUser.setShowDbqFinder}
        isAuthenticated={authData.isAuthenticated}
        claims={sandboxData.claims}
        setSelectedClaimForUpload={powerUser.setSelectedClaimForUpload}
        setShowEvidenceUpload={powerUser.setShowEvidenceUpload}
        login={authData.login}
      />

      <UserDataSection
        isAuthenticated={authData.isAuthenticated}
        authLoading={authData.authLoading}
        login={authData.login}
        fetchAllUserData={sandboxData.fetchAllUserData}
        loading={sandboxData.loading}
        testResults={sandboxData.testResults}
        errors={sandboxData.errors}
        serviceHistory={sandboxData.serviceHistory}
        fetchServiceHistory={sandboxData.fetchServiceHistory}
        claims={sandboxData.claims}
        fetchClaims={sandboxData.fetchClaims}
        appealableIssues={sandboxData.appealableIssues}
        fetchAppealableIssues={sandboxData.fetchAppealableIssues}
        appealsStatus={sandboxData.appealsStatus}
        fetchAppealsStatus={sandboxData.fetchAppealsStatus}
        showRawJson={sandboxData.showRawJson}
        toggleRawJson={sandboxData.toggleRawJson}
        rawServiceHistory={sandboxData.rawServiceHistory}
        rawClaims={sandboxData.rawClaims}
        rawAppealableIssues={sandboxData.rawAppealableIssues}
        rawAppealsStatus={sandboxData.rawAppealsStatus}
      />

      <TestSummaryFooter testResults={sandboxData.testResults} />
    </div>
  );
}

const VaSandboxTest = ({ onClose }) => {
  // Power User Feature States
  const [showDbqFinder, setShowDbqFinder] = useState(false);
  const [showEvidenceUpload, setShowEvidenceUpload] = useState(false);
  const [selectedClaimForUpload, setSelectedClaimForUpload] = useState(null);

  const {
    isAuthenticated,
    isLoading: authLoading,
    userInfo,
    login,
    logout,
    accessToken,
    error: authError,
  } = useVaAuth();

  const sandboxData = useVaSandboxData(isAuthenticated, accessToken);

  const { showConsentPrompt, saveSuccessMessage, handleConsent, handleSkipConsent } =
    useConsentFlow(isAuthenticated, sandboxData);

  // =========================================================================
  // RENDER
  // =========================================================================

  const header = (
    <SandboxHeader
      onClose={onClose}
      isAuthenticated={isAuthenticated}
      userInfo={userInfo}
      authLoading={authLoading}
      authError={authError}
      login={login}
      logout={logout}
    />
  );

  return (
    <>
      <ResponsiveModal
        isOpen={true}
        onClose={onClose}
        header={header}
        labelledBy="va-sandbox-title"
        size="2xl"
      >
        <SandboxContent
          sandboxData={sandboxData}
          authData={{ isAuthenticated, authLoading, login }}
          powerUser={{
            setShowDbqFinder,
            setSelectedClaimForUpload,
            setShowEvidenceUpload,
          }}
        />
      </ResponsiveModal>

      <SandboxModals
        showDbqFinder={showDbqFinder}
        setShowDbqFinder={setShowDbqFinder}
        showEvidenceUpload={showEvidenceUpload}
        selectedClaimForUpload={selectedClaimForUpload}
        accessToken={accessToken}
        fetchClaims={sandboxData.fetchClaims}
        setShowEvidenceUpload={setShowEvidenceUpload}
        setSelectedClaimForUpload={setSelectedClaimForUpload}
        showConsentPrompt={showConsentPrompt}
        handleConsent={handleConsent}
        handleSkipConsent={handleSkipConsent}
        claims={sandboxData.claims}
        serviceHistory={sandboxData.serviceHistory}
        appealsStatus={sandboxData.appealsStatus}
        appealableIssues={sandboxData.appealableIssues}
        saveSuccessMessage={saveSuccessMessage}
      />
    </>
  );
};

export default VaSandboxTest;
