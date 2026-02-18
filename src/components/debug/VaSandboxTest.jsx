/**
 * VA Sandbox Test Dashboard
 * 
 * Comprehensive validation dashboard for VA.gov API integration.
 * Tests ALL APIs for Production Access Demo:
 * 
 * OPEN DATA (API Key):
 * - Facilities API
 * - Forms API
 * - Benefits Reference Data API
 * 
 * USER DATA (OAuth):
 * - Service History API
 * - Claims API
 * - Appealable Issues API
 * - Appeals Status API
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useVaAuth } from '../../auth/useVaAuth';
import {
  getServiceHistory,
  getClaims,
  getAppealableIssues,
  getAppealsStatus,
  getFacilities,
  searchForms,
  getBenefitsReferenceData,
  formatServiceHistory,
  formatClaims,
  formatAppealableIssues,
  formatAppealsStatus,
  formatFacilities,
  formatForms,
  formatDisabilities,
} from '../../api/vaSandbox';

// ============================================================================
// ICONS
// ============================================================================

const Icons = {
  Shield: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Login: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
    </svg>
  ),
  Logout: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  Refresh: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Check: () => (
    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  X: () => (
    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Building: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Document: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Database: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  ),
  Medal: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  FileText: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Alert: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Gavel: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  ),
  Code: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  ExternalLink: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  ),
  Home: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
};

// ============================================================================
// LOADING SPINNER
// ============================================================================

const LoadingSpinner = ({ text = 'Loading...' }) => (
  <div className="flex items-center justify-center py-4">
    <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mr-2" />
    <span className="text-sm text-gray-500 dark:text-gray-400">{text}</span>
  </div>
);

// ============================================================================
// API TEST CARD
// ============================================================================

const ApiTestCard = ({ 
  title, 
  icon: Icon, 
  iconColor = 'text-blue-600',
  status, 
  loading, 
  error, 
  data, 
  onTest, 
  buttonText = 'Test',
  rawData,
  showRaw,
  onToggleRaw,
  children,
}) => {
  const getStatusIcon = () => {
    if (status === 'pass') return <Icons.Check />;
    if (status === 'fail') return <Icons.X />;
    if (status === 'skipped') return <span className="text-yellow-500 text-xs font-bold">SKIP</span>;
    return <Icons.Clock />;
  };

  const getCardBg = () => {
    if (status === 'pass') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (status === 'fail') return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    if (status === 'skipped') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  };

  return (
    <div className={`rounded-xl border p-4 transition-all ${getCardBg()}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={iconColor}><Icon /></span>
          <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
        </div>
        {getStatusIcon()}
      </div>
      
      {onTest && (
        <button
          onClick={onTest}
          disabled={loading}
          className="w-full mb-3 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Testing...
            </>
          ) : (
            buttonText
          )}
        </button>
      )}
      
      {error && (
        <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      
      {children}
      
      {rawData && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={onToggleRaw}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <Icons.Code />
            {showRaw ? 'Hide' : 'Show'} Raw JSON
          </button>
          {showRaw && (
            <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-auto max-h-48 font-mono">
              {JSON.stringify(rawData, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const VaSandboxTest = () => {
  const { t } = useLanguage();
  const {
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    userInfo,
    accessToken,
    login,
    logout,
  } = useVaAuth();

  // =========================================================================
  // OPEN DATA STATES
  // =========================================================================
  const [facilities, setFacilities] = useState({ data: null, raw: null, status: null, loading: false, error: null });
  const [forms, setForms] = useState({ data: null, raw: null, status: null, loading: false, error: null });
  const [disabilities, setDisabilities] = useState({ data: null, raw: null, status: null, loading: false, error: null });

  // =========================================================================
  // USER DATA STATES
  // =========================================================================
  const [serviceHistory, setServiceHistory] = useState({ data: null, raw: null, status: null, loading: false, error: null });
  const [claims, setClaims] = useState({ data: null, raw: null, status: null, loading: false, error: null });
  const [appealableIssues, setAppealableIssues] = useState({ data: null, raw: null, status: null, loading: false, error: null });
  const [appealsStatus, setAppealsStatus] = useState({ data: null, raw: null, status: null, loading: false, error: null });

  // =========================================================================
  // RAW JSON TOGGLES
  // =========================================================================
  const [showRaw, setShowRaw] = useState({
    facilities: false,
    forms: false,
    disabilities: false,
    serviceHistory: false,
    claims: false,
    appealableIssues: false,
    appealsStatus: false,
  });

  const toggleRaw = (key) => setShowRaw(prev => ({ ...prev, [key]: !prev[key] }));

  // =========================================================================
  // OPEN DATA API TESTS
  // =========================================================================

  const testFacilities = async () => {
    setFacilities(prev => ({ ...prev, loading: true, error: null }));
    try {
      const raw = await getFacilities('97217');
      const data = formatFacilities(raw);
      setFacilities({ data, raw, status: 'pass', loading: false, error: null });
    } catch (err) {
      setFacilities({ data: null, raw: null, status: 'fail', loading: false, error: err.message });
    }
  };

  const testForms = async () => {
    setForms(prev => ({ ...prev, loading: true, error: null }));
    try {
      const raw = await searchForms('21-526EZ');
      const data = formatForms(raw);
      setForms({ data, raw, status: 'pass', loading: false, error: null });
    } catch (err) {
      // Check if API key not registered for this service
      if (err.message.includes('cannot consume') || err.message.includes('403')) {
        setForms({ data: null, raw: null, status: 'skipped', loading: false, error: 'API key not registered for VA Forms API' });
      } else {
        setForms({ data: null, raw: null, status: 'fail', loading: false, error: err.message });
      }
    }
  };

  const testDisabilities = async () => {
    setDisabilities(prev => ({ ...prev, loading: true, error: null }));
    try {
      const raw = await getBenefitsReferenceData();
      const data = formatDisabilities(raw);
      setDisabilities({ data, raw, status: 'pass', loading: false, error: null });
    } catch (err) {
      // Check if API key not registered for this service
      if (err.message.includes('cannot consume') || err.message.includes('403')) {
        setDisabilities({ data: null, raw: null, status: 'skipped', loading: false, error: 'API key not registered for Benefits Reference Data API' });
      } else {
        setDisabilities({ data: null, raw: null, status: 'fail', loading: false, error: err.message });
      }
    }
  };

  // =========================================================================
  // USER DATA API TESTS
  // =========================================================================

  const fetchUserData = useCallback(async () => {
    if (!accessToken) return;

    // Service History
    setServiceHistory(prev => ({ ...prev, loading: true, error: null }));
    try {
      const raw = await getServiceHistory(accessToken);
      const data = formatServiceHistory(raw);
      setServiceHistory({ data, raw, status: 'pass', loading: false, error: null });
    } catch (err) {
      setServiceHistory({ data: null, raw: null, status: 'fail', loading: false, error: err.message });
    }

    // Claims
    setClaims(prev => ({ ...prev, loading: true, error: null }));
    try {
      const raw = await getClaims(accessToken);
      const data = formatClaims(raw);
      setClaims({ data, raw, status: 'pass', loading: false, error: null });
    } catch (err) {
      setClaims({ data: null, raw: null, status: 'fail', loading: false, error: err.message });
    }

    // Appealable Issues - DISABLED (scope not approved)
    // Uncomment when appealable_issues.read scope is approved
    setAppealableIssues({ 
      data: null, 
      raw: null, 
      status: 'skipped', 
      loading: false, 
      error: 'Scope not approved - appealable_issues.read' 
    });
    /*
    setAppealableIssues(prev => ({ ...prev, loading: true, error: null }));
    try {
      const raw = await getAppealableIssues(accessToken);
      const data = formatAppealableIssues(raw);
      setAppealableIssues({ data, raw, status: 'pass', loading: false, error: null });
    } catch (err) {
      setAppealableIssues({ data: null, raw: null, status: 'fail', loading: false, error: err.message });
    }
    */

    // Appeals Status - DISABLED (scope not approved)
    // Uncomment when appeals_status.read scope is approved
    setAppealsStatus({ 
      data: null, 
      raw: null, 
      status: 'skipped', 
      loading: false, 
      error: 'Scope not approved - appeals_status.read' 
    });
    /*
    setAppealsStatus(prev => ({ ...prev, loading: true, error: null }));
    try {
      const raw = await getAppealsStatus(accessToken);
      const data = formatAppealsStatus(raw);
      setAppealsStatus({ data, raw, status: 'pass', loading: false, error: null });
    } catch (err) {
      setAppealsStatus({ data: null, raw: null, status: 'fail', loading: false, error: err.message });
    }
    */
  }, [accessToken]);

  // Auto-fetch user data when authenticated
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchUserData();
    }
  }, [isAuthenticated, accessToken, fetchUserData]);

  // =========================================================================
  // HELPERS
  // =========================================================================

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getApiKeyStatus = () => {
    return import.meta.env.VITE_VA_API_KEY ? 'Configured' : 'Missing';
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="min-h-screen px-4 py-8 flex items-start justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-5xl w-full animate-modalEnter">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Icons.Shield />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">VA Sandbox Verification</h1>
                  <p className="text-blue-200 text-sm mt-1">Production Access Demo Dashboard</p>
                </div>
              </div>
              <a
                href="/"
                className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </a>
            </div>
          
            {/* Configuration Status */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                <span className="text-blue-200">Client ID:</span>
                <span className="font-mono">{import.meta.env.VITE_VA_AUTH_ID?.slice(0, 12)}...</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                <span className="text-blue-200">API Key:</span>
                <span className={getApiKeyStatus() === 'Configured' ? 'text-green-300' : 'text-red-300'}>
                  {getApiKeyStatus()}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                <span className="text-blue-200">Environment:</span>
                <span className="text-yellow-300">Sandbox</span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* ================================================================= */}
            {/* SECTION 1: OPEN DATA APIs */}
            {/* ================================================================= */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Icons.Database />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Open Data APIs</h2>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-bold rounded">
                  API KEY
                </span>
              </div>
          
              {/* Info about API registration */}
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Note:</strong> Each VA API requires separate registration. If an API shows "skipped", 
                  register your API key at{' '}
                  <a href="https://developer.va.gov/explore" target="_blank" rel="noopener noreferrer" 
                     className="text-blue-600 dark:text-blue-400 underline">
                    developer.va.gov/explore
                  </a>
                </p>
              </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Facilities */}
            <ApiTestCard
              title="Facilities API"
              icon={Icons.Building}
              iconColor="text-blue-600"
              status={facilities.status}
              loading={facilities.loading}
              error={facilities.error}
              onTest={testFacilities}
              buttonText="Test Facilities (97217)"
              rawData={facilities.raw}
              showRaw={showRaw.facilities}
              onToggleRaw={() => toggleRaw('facilities')}
            >
              {facilities.data && (
                <div className="text-sm space-y-1">
                  <p className="text-green-600 dark:text-green-400 font-medium">
                    ✓ Found {facilities.data.length} facilities
                  </p>
                  {facilities.data.slice(0, 2).map((f, i) => (
                    <p key={i} className="text-gray-600 dark:text-gray-400 truncate">
                      • {f.name}
                    </p>
                  ))}
                </div>
              )}
            </ApiTestCard>

            {/* Forms */}
            <ApiTestCard
              title="Forms API"
              icon={Icons.Document}
              iconColor="text-purple-600"
              status={forms.status}
              loading={forms.loading}
              error={forms.error}
              onTest={testForms}
              buttonText='Search "21-526EZ"'
              rawData={forms.raw}
              showRaw={showRaw.forms}
              onToggleRaw={() => toggleRaw('forms')}
            >
              {forms.data && forms.data.length > 0 && (
                <div className="text-sm space-y-1">
                  <p className="text-green-600 dark:text-green-400 font-medium">
                    ✓ Found {forms.data.length} form(s)
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">{forms.data[0]?.title?.slice(0, 50)}...</p>
                  {forms.data[0]?.url && (
                    <a
                      href={forms.data[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <Icons.ExternalLink /> View PDF
                    </a>
                  )}
                </div>
              )}
            </ApiTestCard>

            {/* Reference Data */}
            <ApiTestCard
              title="Benefits Reference"
              icon={Icons.Database}
              iconColor="text-teal-600"
              status={disabilities.status}
              loading={disabilities.loading}
              error={disabilities.error}
              onTest={testDisabilities}
              buttonText="Fetch Disabilities"
              rawData={disabilities.raw}
              showRaw={showRaw.disabilities}
              onToggleRaw={() => toggleRaw('disabilities')}
            >
              {disabilities.data && (
                <div className="text-sm space-y-1">
                  <p className="text-green-600 dark:text-green-400 font-medium">
                    ✓ Loaded {disabilities.data.length} disabilities
                  </p>
                  {disabilities.data.slice(0, 3).map((d, i) => (
                    <p key={i} className="text-gray-600 dark:text-gray-400 truncate">
                      • {d.name}
                    </p>
                  ))}
                </div>
              )}
            </ApiTestCard>
              </div>
            </section>

            {/* ================================================================= */}
            {/* SECTION 2: AUTHENTICATION */}
            {/* ================================================================= */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isAuthenticated ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      {isAuthenticated ? 'Connected to VA.gov Sandbox' : 'Not Connected'}
                    </h2>
                    {isAuthenticated && userInfo && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Logged in as: {userInfo.given_name} {userInfo.family_name}
                      </p>
                    )}
                  </div>
                </div>
            
            {authLoading ? (
              <LoadingSpinner text="Checking..." />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchUserData}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 text-sm"
                >
                  <Icons.Refresh /> Refresh Data
                </button>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg flex items-center gap-2 text-sm"
                >
                  <Icons.Logout /> Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center gap-2"
              >
                <Icons.Login /> Connect VA Sandbox Account
              </button>
            )}
          </div>
          
          {authError && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
              <p className="text-red-700 dark:text-red-300">{authError}</p>
            </div>
          )}
          
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Scopes:</strong> openid profile offline_access claim.read service_history.read appealable_issues.read appeals_status.read
            </p>
          </div>
            </section>

            {/* ================================================================= */}
            {/* SECTION 3: USER DATA APIs */}
            {/* ================================================================= */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Icons.Shield />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">User Data APIs</h2>
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 text-xs font-bold rounded">
                  OAUTH
                </span>
              </div>

              {!isAuthenticated ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <Icons.Shield />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                    Authentication Required
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                Connect your VA.gov Sandbox account to test protected APIs
              </p>
              <button
                onClick={login}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold"
              >
                Connect VA Account
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Service History */}
              <ApiTestCard
                title="Service History"
                icon={Icons.Medal}
                iconColor="text-blue-600"
                status={serviceHistory.status}
                loading={serviceHistory.loading}
                error={serviceHistory.error}
                rawData={serviceHistory.raw}
                showRaw={showRaw.serviceHistory}
                onToggleRaw={() => toggleRaw('serviceHistory')}
              >
                {serviceHistory.data && serviceHistory.data.length > 0 ? (
                  <div className="space-y-2">
                    {serviceHistory.data.map((s, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-gray-900 dark:text-white">{s.branch}</p>
                        <p className="text-gray-600 dark:text-gray-400">
                          {formatDate(s.startDate)} - {formatDate(s.endDate)}
                        </p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 text-xs rounded capitalize">
                          {s.dischargeStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : serviceHistory.status === 'pass' ? (
                  <p className="text-sm text-gray-500">No service history records</p>
                ) : null}
              </ApiTestCard>

              {/* Claims */}
              <ApiTestCard
                title="Claims"
                icon={Icons.FileText}
                iconColor="text-green-600"
                status={claims.status}
                loading={claims.loading}
                error={claims.error}
                rawData={claims.raw}
                showRaw={showRaw.claims}
                onToggleRaw={() => toggleRaw('claims')}
              >
                {claims.data && claims.data.length > 0 ? (
                  <div className="space-y-2">
                    {claims.data.slice(0, 3).map((c, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-gray-900 dark:text-white capitalize">{c.type} Claim</p>
                        <p className="text-gray-600 dark:text-gray-400">Filed: {formatDate(c.dateFiled)}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs rounded">
                          {c.status || 'Processing'}
                        </span>
                      </div>
                    ))}
                    {claims.data.length > 3 && (
                      <p className="text-xs text-gray-500">+{claims.data.length - 3} more claims</p>
                    )}
                  </div>
                ) : claims.status === 'pass' ? (
                  <p className="text-sm text-gray-500">No active claims</p>
                ) : null}
              </ApiTestCard>

              {/* Appealable Issues */}
              <ApiTestCard
                title="Appealable Issues"
                icon={Icons.Alert}
                iconColor="text-orange-600"
                status={appealableIssues.status}
                loading={appealableIssues.loading}
                error={appealableIssues.error}
                rawData={appealableIssues.raw}
                showRaw={showRaw.appealableIssues}
                onToggleRaw={() => toggleRaw('appealableIssues')}
              >
                {appealableIssues.data && appealableIssues.data.length > 0 ? (
                  <div className="space-y-2">
                    {appealableIssues.data.slice(0, 3).map((issue, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-gray-900 dark:text-white">{issue.description}</p>
                        <p className="text-gray-600 dark:text-gray-400">Decision: {formatDate(issue.decisionDate)}</p>
                        {issue.ratingPercent !== undefined && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 text-xs rounded">
                            Rated: {issue.ratingPercent}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : appealableIssues.status === 'pass' ? (
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Icons.Check /> No appealable issues
                  </p>
                ) : null}
              </ApiTestCard>

              {/* Appeals Status */}
              <ApiTestCard
                title="Appeals Status"
                icon={Icons.Gavel}
                iconColor="text-purple-600"
                status={appealsStatus.status}
                loading={appealsStatus.loading}
                error={appealsStatus.error}
                rawData={appealsStatus.raw}
                showRaw={showRaw.appealsStatus}
                onToggleRaw={() => toggleRaw('appealsStatus')}
              >
                {appealsStatus.data && appealsStatus.data.length > 0 ? (
                  <div className="space-y-2">
                    {appealsStatus.data.slice(0, 3).map((appeal, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-gray-900 dark:text-white capitalize">{appeal.type} Appeal</p>
                        <p className="text-gray-600 dark:text-gray-400">Program: {appeal.programArea}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${
                          appeal.active 
                            ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}>
                          {appeal.active ? 'Active' : 'Closed'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : appealsStatus.status === 'pass' ? (
                  <p className="text-sm text-gray-500">No active appeals</p>
                ) : null}
              </ApiTestCard>
              </div>
            )}
            </section>

            {/* ================================================================= */}
            {/* TEST SUMMARY */}
            {/* ================================================================= */}
            <section className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">API Test Summary</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { name: 'Facilities', status: facilities.status },
                  { name: 'Forms', status: forms.status },
                  { name: 'Reference Data', status: disabilities.status },
                  { name: 'Service History', status: serviceHistory.status },
                  { name: 'Claims', status: claims.status },
                  { name: 'Appealable Issues', status: appealableIssues.status },
                  { name: 'Appeals Status', status: appealsStatus.status },
                ].map(({ name, status }) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    {status === 'pass' ? <Icons.Check /> : status === 'fail' ? <Icons.X /> : status === 'skipped' ? <span className="text-yellow-500 text-xs font-bold">SKIP</span> : <Icons.Clock />}
                    <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                VA Sandbox Test Dashboard • All data is synthetic test data
              </p>
              <a
                href="/"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <Icons.Home />
                <span>Back to Home</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaSandboxTest;
