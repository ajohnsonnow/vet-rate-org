/**
 * VA Data Center - World-Class VA.gov Integration Hub
 *
 * Comprehensive dashboard for veterans to:
 * - View all available VA APIs and what data each provides
 * - Connect to VA.gov securely via OAuth
 * - Selectively download personal data
 * - Preview data before saving locally
 * - Manage consent and privacy preferences
 * - Disconnect while preserving data
 *
 * Demonstrates ALL 7 VA APIs:
 * OAuth Protected: Service History, Claims, Appealable Issues, Appeals Status
 * API Key Access: Facilities, Forms, Benefits Reference Data
 */

import React, { useState, useEffect, useCallback } from "react";
import { useVaAuth } from "../hooks/useVaAuth";
import {
  isVaIntegrationConfigured,
  getVaConfigStatus,
  VA_FACILITIES_API_KEY,
  VA_FORMS_API_KEY,
  VA_BENEFITS_REF_API_KEY,
} from "../config/vaAuth";
import {
  saveVADataWithConsent,
  loadVARecords,
  clearVARecords,
} from "../utils/vaDataPersistence";
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
  formatFacilities,
  formatForms,
  formatBenefitsDisabilities,
  getApiRateLimitStatus,
} from "../api/va";
import {
  Shield,
  Database,
  FileText,
  MapPin,
  Gavel,
  Medal,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
  Trash2,
  LogIn,
  LogOut,
  RefreshCw,
  Eye,
  EyeOff,
  Info,
  AlertTriangle,
  Lock,
  Unlock,
  Building2,
  ListChecks,
  BookOpen,
  User,
  Calendar,
  AlertCircle,
  Check,
  HelpCircle,
} from "lucide-react";

// ============================================================================
// API CATALOG - Defines all 7 VA APIs with use cases
// ============================================================================
const VA_API_CATALOG = {
  // OAuth Protected APIs (require veteran authentication)
  oauth: [
    {
      id: "serviceHistory",
      name: "Service History",
      icon: Medal,
      description:
        "Your military service record including branches, dates, deployments, and discharge status.",
      useCase:
        "Pre-fill claim forms with accurate service dates. Verify eligibility for benefits.",
      dataPoints: [
        "Branch of Service",
        "Service Dates",
        "Discharge Status",
        "Deployments",
        "Character of Service",
      ],
      scope: "service_history.read",
    },
    {
      id: "claims",
      name: "Benefits Claims",
      icon: FileText,
      description:
        "Your current and past VA disability claims with status updates.",
      useCase:
        "Track claim progress. Identify which conditions are rated. Plan supplemental claims.",
      dataPoints: [
        "Claim Status",
        "Submission Date",
        "Rated Conditions",
        "Phase Dates",
        "Supporting Documents",
      ],
      scope: "claim.read",
    },
    {
      id: "appealsStatus",
      name: "Appeals Status",
      icon: Gavel,
      description:
        "Status of any appeals you have filed (Board Appeals, Higher Level Reviews).",
      useCase:
        "Monitor appeal progress. Prepare for hearings. Track decision timelines.",
      dataPoints: [
        "Appeal Type",
        "Status",
        "Docket Number",
        "Events Timeline",
        "Hearing Info",
      ],
      scope: "appeals.read",
    },
    {
      id: "appealableIssues",
      name: "Appealable Issues",
      icon: AlertCircle,
      description: "Decisions from the past year that you can still appeal.",
      useCase:
        "Identify issues eligible for Supplemental Claim or Higher Level Review.",
      dataPoints: [
        "Decision Date",
        "Issue Description",
        "Rating Decision ID",
        "Appeal Deadline",
      ],
      scope: "appeals.read",
    },
  ],
  // API Key APIs (open data, no authentication required)
  apiKey: [
    {
      id: "facilities",
      name: "VA Facilities",
      icon: Building2,
      description:
        "Find VA Medical Centers, Clinics, and regional offices near you.",
      useCase:
        "Locate C&P exam sites. Find nearest VA healthcare. Get facility contact info.",
      dataPoints: [
        "Facility Name",
        "Address",
        "Phone",
        "Services",
        "Hours",
        "Wait Times",
      ],
      requiresInput: true,
      inputLabel: "Enter ZIP code or city",
      inputPlaceholder: "90210",
    },
    {
      id: "forms",
      name: "VA Forms",
      icon: ListChecks,
      description:
        "Search the entire VA forms library - DBQs, claim forms, appeals forms.",
      useCase:
        "Find the right form for your claim. Download DBQs for medical evidence.",
      dataPoints: [
        "Form Number",
        "Title",
        "Description",
        "Last Updated",
        "PDF Link",
      ],
      requiresInput: true,
      inputLabel: 'Search forms (e.g., "21-526EZ" or "PTSD")',
      inputPlaceholder: "21-526EZ",
    },
    {
      id: "disabilities",
      name: "Benefits Reference Data",
      icon: BookOpen,
      description:
        "Official list of ratable disabilities from the VA schedule.",
      useCase:
        "Find diagnostic codes. Understand rating criteria. Research conditions.",
      dataPoints: [
        "Condition Name",
        "Diagnostic Code",
        "Rating Criteria",
        "Body System",
      ],
      requiresInput: false,
    },
  ],
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const VADataCenter = ({ onClose, embeddedMode = false }) => {
  // Auth state
  const {
    isAuthenticated,
    isLoading: authLoading,
    userInfo,
    login,
    logout,
    accessToken,
    error: authError,
  } = useVaAuth();

  // Configuration status
  const configStatus = getVaConfigStatus();
  const isConfigured = isVaIntegrationConfigured();

  // Saved data state
  const [savedRecords, setSavedRecords] = useState(null);

  // API Data States
  const [apiData, setApiData] = useState({
    serviceHistory: null,
    claims: null,
    appealsStatus: null,
    appealableIssues: null,
    facilities: null,
    forms: null,
    disabilities: null,
  });

  // Loading states per API
  const [loading, setLoading] = useState({
    serviceHistory: false,
    claims: false,
    appealsStatus: false,
    appealableIssues: false,
    facilities: false,
    forms: false,
    disabilities: false,
  });

  // Error states per API
  const [errors, setErrors] = useState({});

  // Selection states for download
  const [selectedApis, setSelectedApis] = useState({
    serviceHistory: true,
    claims: true,
    appealsStatus: true,
    appealableIssues: true,
  });

  // Preview expanded states
  const [expandedPreviews, setExpandedPreviews] = useState({});

  // Input values for search APIs
  const [searchInputs, setSearchInputs] = useState({
    facilities: "",
    forms: "",
  });

  // UI States
  const [activeTab, setActiveTab] = useState("personal"); // 'personal' | 'reference' | 'saved'
  const [showRawJson, setShowRawJson] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);
  const [rateLimitStatus, setRateLimitStatus] = useState(null);

  // Load saved records on mount
  useEffect(() => {
    loadSavedRecords();
    updateRateLimitStatus();
  }, []);

  const loadSavedRecords = () => {
    const records = loadVARecords();
    setSavedRecords(records);
  };

  const updateRateLimitStatus = () => {
    setRateLimitStatus(getApiRateLimitStatus());
  };

  // =========================================================================
  // FETCH FUNCTIONS
  // =========================================================================
  const fetchApi = useCallback(
    async (apiId) => {
      setLoading((prev) => ({ ...prev, [apiId]: true }));
      setErrors((prev) => ({ ...prev, [apiId]: null }));

      try {
        let data, formatted;

        switch (apiId) {
          case "serviceHistory":
            data = await getServiceHistory(accessToken);
            formatted = formatServiceHistory(data);
            break;
          case "claims":
            data = await getClaims(accessToken);
            formatted = formatClaims(data);
            break;
          case "appealsStatus":
            data = await getAppealsStatus(accessToken);
            formatted = formatAppealsStatus(data);
            break;
          case "appealableIssues":
            data = await getAppealableIssues(accessToken);
            formatted = formatAppealableIssues(data);
            break;
          case "facilities":
            if (!searchInputs.facilities) {
              throw new Error("Please enter a ZIP code or city to search");
            }
            data = await getFacilities(VA_FACILITIES_API_KEY, {
              zip: searchInputs.facilities,
              radius: 50,
              per_page: 10,
            });
            formatted = formatFacilities(data);
            break;
          case "forms":
            if (!searchInputs.forms) {
              throw new Error("Please enter a search term");
            }
            data = await searchForms(VA_FORMS_API_KEY, searchInputs.forms);
            formatted = formatForms(data);
            break;
          case "disabilities":
            data = await getBenefitsReferenceDisabilities(
              VA_BENEFITS_REF_API_KEY,
            );
            formatted = formatBenefitsDisabilities(data);
            break;
          default:
            throw new Error("Unknown API");
        }

        setApiData((prev) => ({ ...prev, [apiId]: { raw: data, formatted } }));
        updateRateLimitStatus();
      } catch (error) {
        console.error(`[VA Data Center] Error fetching ${apiId}:`, error);
        setErrors((prev) => ({ ...prev, [apiId]: error.message }));
      } finally {
        setLoading((prev) => ({ ...prev, [apiId]: false }));
      }
    },
    [accessToken, searchInputs],
  );

  // Fetch all selected personal data
  const fetchAllSelected = useCallback(async () => {
    const oauthApis = VA_API_CATALOG.oauth.map((a) => a.id);
    for (const apiId of oauthApis) {
      if (selectedApis[apiId]) {
        await fetchApi(apiId);
      }
    }
  }, [selectedApis, fetchApi]);

  // Auto-fetch on authentication
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchAllSelected();
    }
  }, [isAuthenticated, accessToken]);

  // =========================================================================
  // SAVE & MANAGE DATA
  // =========================================================================
  const handleSaveSelected = async () => {
    setSaveStatus({ loading: true, message: "Saving your data locally..." });

    try {
      const dataToSave = {
        serviceHistory:
          selectedApis.serviceHistory && apiData.serviceHistory?.formatted?.[0]
            ? apiData.serviceHistory.formatted[0]
            : null,
        claims:
          selectedApis.claims && apiData.claims?.formatted
            ? apiData.claims.formatted
            : [],
        appeals:
          selectedApis.appealsStatus && apiData.appealsStatus?.formatted
            ? apiData.appealsStatus.formatted
            : [],
        appealableIssues:
          selectedApis.appealableIssues && apiData.appealableIssues?.formatted
            ? apiData.appealableIssues.formatted
            : [],
        rawServiceHistory: selectedApis.serviceHistory
          ? apiData.serviceHistory?.raw
          : null,
        rawClaims: selectedApis.claims ? apiData.claims?.raw : null,
        rawAppeals: selectedApis.appealsStatus
          ? apiData.appealsStatus?.raw
          : null,
        rawAppealableIssues: selectedApis.appealableIssues
          ? apiData.appealableIssues?.raw
          : null,
      };

      await saveVADataWithConsent(dataToSave, {
        saveToPacket: true,
        saveToVKB: true,
      });
      loadSavedRecords();

      const counts = {
        claims: dataToSave.claims.length,
        appeals: dataToSave.appeals.length,
        appealableIssues: dataToSave.appealableIssues.length,
        serviceHistory: dataToSave.serviceHistory ? 1 : 0,
      };

      setSaveStatus({
        loading: false,
        success: true,
        message: `Saved: ${counts.serviceHistory} service record, ${counts.claims} claims, ${counts.appeals} appeals, ${counts.appealableIssues} appealable issues`,
      });

      setTimeout(() => setSaveStatus(null), 5000);
    } catch (error) {
      setSaveStatus({
        loading: false,
        success: false,
        message: "Error saving data: " + error.message,
      });
    }
  };

  const handleClearSavedData = () => {
    if (
      window.confirm(
        "Clear all saved VA records? This cannot be undone. Your data on VA.gov is not affected.",
      )
    ) {
      clearVARecords();
      loadSavedRecords();
      setSaveStatus({
        loading: false,
        success: true,
        message: "Saved VA records cleared.",
      });
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleDisconnect = () => {
    if (
      window.confirm(
        "Disconnect from VA.gov? Your saved data will be preserved.",
      )
    ) {
      logout();
    }
  };

  // =========================================================================
  // UI HELPERS
  // =========================================================================
  const toggleSelection = (apiId) => {
    setSelectedApis((prev) => ({ ...prev, [apiId]: !prev[apiId] }));
  };

  const togglePreview = (apiId) => {
    setExpandedPreviews((prev) => ({ ...prev, [apiId]: !prev[apiId] }));
  };

  const toggleRawJson = (apiId) => {
    setShowRawJson((prev) => ({ ...prev, [apiId]: !prev[apiId] }));
  };

  const getDataCount = (apiId) => {
    const data = apiData[apiId]?.formatted;
    if (!data) return 0;
    return Array.isArray(data) ? data.length : 1;
  };

  // =========================================================================
  // RENDER HELPERS
  // =========================================================================

  // Configuration Warning Banner
  const renderConfigWarning = () => {
    if (isConfigured) return null;

    return (
      <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-200">
              VA Integration Not Configured
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              API keys need to be set in environment variables. Contact your
              administrator.
            </p>
            <div className="mt-2 text-xs space-y-1 text-amber-600 dark:text-amber-400">
              <div className="flex items-center gap-2">
                {configStatus.oauthConfigured ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                <span>OAuth (VA.gov Sign-In)</span>
              </div>
              <div className="flex items-center gap-2">
                {configStatus.facilitiesConfigured ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                <span>Facilities API</span>
              </div>
              <div className="flex items-center gap-2">
                {configStatus.formsConfigured ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                <span>Forms API</span>
              </div>
              <div className="flex items-center gap-2">
                {configStatus.benefitsConfigured ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                <span>Benefits Reference API</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Connection Status Header
  const renderConnectionStatus = () => (
    <div
      className={`rounded-xl p-4 mb-6 ${
        isAuthenticated
          ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
          : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-full ${
              isAuthenticated
                ? "bg-green-100 dark:bg-green-800"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          >
            {isAuthenticated ? (
              <Unlock className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <Lock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            )}
          </div>
          <div>
            <h3
              className={`font-semibold ${
                isAuthenticated
                  ? "text-green-800 dark:text-green-200"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {isAuthenticated ? "Connected to VA.gov" : "Not Connected"}
            </h3>
            {isAuthenticated && userInfo && (
              <p className="text-sm text-green-600 dark:text-green-400">
                {userInfo.firstName} {userInfo.lastName}
              </p>
            )}
            {!isAuthenticated && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sign in to access your personal VA records
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {isAuthenticated ? (
            <>
              <button
                onClick={fetchAllSelected}
                disabled={Object.values(loading).some(Boolean)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${Object.values(loading).some(Boolean) ? "animate-spin" : ""}`}
                />
                Refresh Data
              </button>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={login}
              disabled={authLoading || !configStatus.oauthConfigured}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              Sign in with VA.gov
            </button>
          )}
        </div>
      </div>

      {authError && (
        <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {authError}
        </div>
      )}

      {/* Rate Limit Status */}
      {rateLimitStatus && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Info className="w-3 h-3" />
          API calls remaining: {rateLimitStatus.remaining}/
          {rateLimitStatus.total}
          {rateLimitStatus.resetsIn > 0 &&
            ` (resets in ${rateLimitStatus.resetsIn}s)`}
        </div>
      )}
    </div>
  );

  // Tab Navigation
  const renderTabs = () => (
    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
      <button
        onClick={() => setActiveTab("personal")}
        className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
          activeTab === "personal"
            ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
            : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
        }`}
      >
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" />
          Your VA Records
          {isAuthenticated && (
            <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full">
              4 APIs
            </span>
          )}
        </div>
      </button>
      <button
        onClick={() => setActiveTab("reference")}
        className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
          activeTab === "reference"
            ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400"
            : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
        }`}
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4" />
          Reference Data
          <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs px-2 py-0.5 rounded-full">
            3 APIs
          </span>
        </div>
      </button>
      <button
        onClick={() => setActiveTab("saved")}
        className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
          activeTab === "saved"
            ? "border-green-600 text-green-600 dark:border-green-400 dark:text-green-400"
            : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
        }`}
      >
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Saved Data
          {savedRecords &&
            (savedRecords.claims?.length > 0 ||
              savedRecords.serviceHistory) && (
              <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">
                ✓
              </span>
            )}
        </div>
      </button>
    </div>
  );

  // OAuth API Card
  const renderOAuthApiCard = (api) => {
    const Icon = api.icon;
    const data = apiData[api.id];
    const isLoading = loading[api.id];
    const error = errors[api.id];
    const isExpanded = expandedPreviews[api.id];
    const isSelected = selectedApis[api.id];
    const showJson = showRawJson[api.id];
    const count = getDataCount(api.id);

    return (
      <div
        key={api.id}
        className={`border rounded-xl overflow-hidden transition-all ${
          isSelected
            ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        }`}
      >
        {/* Card Header */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Selection Checkbox */}
            <button
              onClick={() => toggleSelection(api.id)}
              disabled={!isAuthenticated}
              className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                isSelected
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
              } ${!isAuthenticated ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {isSelected && <Check className="w-3 h-3" />}
            </button>

            <div
              className={`p-2 rounded-lg ${
                data
                  ? "bg-green-100 dark:bg-green-900/50"
                  : "bg-gray-100 dark:bg-gray-700"
              }`}
            >
              <Icon
                className={`w-5 h-5 ${
                  data
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {api.name}
                </h3>
                {isLoading && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                )}
                {data && (
                  <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">
                    {count} record{count !== 1 ? "s" : ""} loaded
                  </span>
                )}
                {error && (
                  <span className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs px-2 py-0.5 rounded-full">
                    Error
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {api.description}
              </p>
            </div>

            {/* Expand/Collapse */}
            {data && (
              <button
                onClick={() => togglePreview(api.id)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            )}
          </div>

          {/* Use Case & Data Points */}
          <div className="mt-3 ml-8 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              Use Case: {api.useCase}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {api.dataPoints.map((point, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded"
                >
                  {point}
                </span>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Fetch Button (when not authenticated or no data) */}
          {isAuthenticated && !data && !isLoading && (
            <button
              onClick={() => fetchApi(api.id)}
              className="mt-3 ml-8 flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 rounded-lg text-sm transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Fetch Data
            </button>
          )}
        </div>

        {/* Preview Section */}
        {data && isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Data Preview
              </span>
              <button
                onClick={() => toggleRawJson(api.id)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {showJson ? (
                  <EyeOff className="w-3 h-3" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
                {showJson ? "Hide JSON" : "Show JSON"}
              </button>
            </div>

            {showJson ? (
              <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-auto max-h-64">
                {JSON.stringify(data.raw, null, 2)}
              </pre>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto">
                {renderFormattedPreview(api.id, data.formatted)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // API Key API Card (Reference Data)
  const renderApiKeyCard = (api) => {
    const Icon = api.icon;
    const data = apiData[api.id];
    const isLoading = loading[api.id];
    const error = errors[api.id];
    const isExpanded = expandedPreviews[api.id];
    const showJson = showRawJson[api.id];
    const count = getDataCount(api.id);

    const apiKeyConfigured =
      api.id === "facilities"
        ? configStatus.facilitiesConfigured
        : api.id === "forms"
          ? configStatus.formsConfigured
          : configStatus.benefitsConfigured;

    return (
      <div
        key={api.id}
        className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800"
      >
        {/* Card Header */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg ${
                data
                  ? "bg-purple-100 dark:bg-purple-900/50"
                  : "bg-gray-100 dark:bg-gray-700"
              }`}
            >
              <Icon
                className={`w-5 h-5 ${
                  data
                    ? "text-purple-600 dark:text-purple-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {api.name}
                </h3>
                <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs px-2 py-0.5 rounded-full">
                  Open Data
                </span>
                {isLoading && (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                )}
                {data && (
                  <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">
                    {count} result{count !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {api.description}
              </p>
            </div>

            {data && (
              <button
                onClick={() => togglePreview(api.id)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            )}
          </div>

          {/* Use Case */}
          <div className="mt-3 ml-11 text-xs text-purple-600 dark:text-purple-400 font-medium">
            Use Case: {api.useCase}
          </div>

          {/* Search Input & Fetch */}
          <div className="mt-3 ml-11 flex gap-2 flex-wrap">
            {api.requiresInput && (
              <input
                type="text"
                value={searchInputs[api.id] || ""}
                onChange={(e) =>
                  setSearchInputs((prev) => ({
                    ...prev,
                    [api.id]: e.target.value,
                  }))
                }
                placeholder={api.inputPlaceholder}
                className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                onKeyDown={(e) => e.key === "Enter" && fetchApi(api.id)}
              />
            )}
            <button
              onClick={() => fetchApi(api.id)}
              disabled={isLoading || !apiKeyConfigured}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {api.requiresInput ? "Search" : "Load Data"}
            </button>
          </div>

          {!apiKeyConfigured && (
            <div className="mt-2 ml-11 text-xs text-amber-600 dark:text-amber-400">
              ⚠️ API key not configured
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Preview Section */}
        {data && isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Results
              </span>
              <button
                onClick={() => toggleRawJson(api.id)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {showJson ? (
                  <EyeOff className="w-3 h-3" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
                {showJson ? "Hide JSON" : "Show JSON"}
              </button>
            </div>

            {showJson ? (
              <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-auto max-h-64">
                {JSON.stringify(data.raw, null, 2)}
              </pre>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto">
                {renderFormattedPreview(api.id, data.formatted)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Formatted Preview Renderers
  const renderFormattedPreview = (apiId, data) => {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return <p className="text-sm text-gray-500">No data available</p>;
    }

    switch (apiId) {
      case "serviceHistory":
        return data.map((service, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="font-medium text-gray-900 dark:text-white">
              {service.branchOfService}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {service.startDate} - {service.endDate}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400">
              {service.dischargeStatus}
            </div>
          </div>
        ));

      case "claims":
        return data.slice(0, 5).map((claim, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex justify-between items-start">
              <div className="font-medium text-gray-900 dark:text-white">
                {claim.claimType}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  claim.status === "COMPLETE"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                }`}
              >
                {claim.status}
              </span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Filed: {claim.claimDate}
            </div>
          </div>
        ));

      case "appealsStatus":
        return data.slice(0, 5).map((appeal, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="font-medium text-gray-900 dark:text-white">
              {appeal.type}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Status: {appeal.status}
            </div>
            {appeal.docketNumber && (
              <div className="text-xs text-gray-500">
                Docket: {appeal.docketNumber}
              </div>
            )}
          </div>
        ));

      case "appealableIssues":
        return data.slice(0, 5).map((issue, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="font-medium text-gray-900 dark:text-white">
              {issue.description}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Decision: {issue.decisionDate}
            </div>
          </div>
        ));

      case "facilities":
        return data.slice(0, 5).map((facility, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="font-medium text-gray-900 dark:text-white">
              {facility.name}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {facility.address}
            </div>
            {facility.phone && (
              <div className="text-sm text-blue-600 dark:text-blue-400">
                {facility.phone}
              </div>
            )}
          </div>
        ));

      case "forms":
        return data.slice(0, 5).map((form, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="font-semibold text-gray-900 dark:text-white">
              {form.formName}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {form.title}
            </div>
            {form.url && (
              <a
                href={form.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                Download PDF ↗
              </a>
            )}
          </div>
        ));

      case "disabilities":
        return data.slice(0, 10).map((disability, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 text-sm"
          >
            <span className="font-medium">{disability.name}</span>
            {disability.diagnosticCode && (
              <span className="text-gray-500 ml-2">
                ({disability.diagnosticCode})
              </span>
            )}
          </div>
        ));

      default:
        return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
    }
  };

  // Saved Data Tab
  const renderSavedTab = () => (
    <div className="space-y-4">
      {!savedRecords ||
      (!savedRecords.claims?.length &&
        !savedRecords.serviceHistory &&
        !savedRecords.appeals?.length) ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <Download className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
            No Saved VA Data
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
            Connect to VA.gov and import your records. Data is saved locally on
            your device, available to AI tools, and persists after you
            disconnect.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {savedRecords.serviceHistory ? "1" : "0"}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                Service Record
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {savedRecords.claims?.length || 0}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">
                Claims
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {savedRecords.appeals?.length || 0}
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-300">
                Appeals
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {savedRecords.appealableIssues?.length || 0}
              </div>
              <div className="text-sm text-amber-700 dark:text-amber-300">
                Appealable Issues
              </div>
            </div>
          </div>

          {/* Last Updated */}
          {savedRecords.lastSyncTime && (
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Last updated:{" "}
              {new Date(savedRecords.lastSyncTime).toLocaleString()}
            </div>
          )}

          {/* Privacy Notice */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-800 dark:text-green-200">
                  Data Privacy
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Your VA data is stored locally on this device only. It is
                  never uploaded to any server. AI tools in this app can use
                  this data to provide personalized assistance.
                </p>
              </div>
            </div>
          </div>

          {/* Clear Button */}
          <button
            onClick={handleClearSavedData}
            className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/30 text-red-700 dark:text-red-300 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear Saved Data
          </button>
        </>
      )}
    </div>
  );

  // =========================================================================
  // MAIN RENDER
  // =========================================================================
  return (
    <div
      className={
        embeddedMode
          ? ""
          : "fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      }
    >
      <div
        className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full ${
          embeddedMode
            ? ""
            : "max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        }`}
      >
        {/* Header */}
        {!embeddedMode && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  VA Data Center
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Access your VA.gov records securely
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <XCircle className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className={embeddedMode ? "" : "flex-1 overflow-y-auto p-6"}>
          {renderConfigWarning()}
          {renderConnectionStatus()}
          {renderTabs()}

          {/* Tab Content */}
          {activeTab === "personal" && (
            <div className="space-y-4">
              {!isAuthenticated ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <Lock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                    Sign in to Access Your Records
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
                    Connect to VA.gov to securely access your service history,
                    claims, and appeals information.
                  </p>
                </div>
              ) : (
                <>
                  {/* Selection Actions */}
                  <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Select the data you want to save locally:
                    </div>
                    <button
                      onClick={handleSaveSelected}
                      disabled={
                        saveStatus?.loading ||
                        !Object.values(selectedApis).some(Boolean)
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {saveStatus?.loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Save Selected to My Packet
                    </button>
                  </div>

                  {/* Save Status */}
                  {saveStatus && !saveStatus.loading && (
                    <div
                      className={`p-3 rounded-lg flex items-center gap-2 ${
                        saveStatus.success
                          ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                          : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                      }`}
                    >
                      {saveStatus.success ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      {saveStatus.message}
                    </div>
                  )}

                  {/* OAuth API Cards */}
                  <div className="space-y-4">
                    {VA_API_CATALOG.oauth.map((api) => renderOAuthApiCard(api))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "reference" && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Reference data from VA.gov - no sign-in required:
              </div>
              {VA_API_CATALOG.apiKey.map((api) => renderApiKeyCard(api))}
            </div>
          )}

          {activeTab === "saved" && renderSavedTab()}
        </div>
      </div>
    </div>
  );
};

export default VADataCenter;
