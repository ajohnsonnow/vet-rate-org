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

import React, { useState, useEffect, useCallback } from 'react';
import { useVaAuth } from '../hooks/useVaAuth';
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
} from '../api/va';
import { VA_FACILITIES_API_KEY, VA_FORMS_API_KEY, VA_BENEFITS_REF_API_KEY, getVaConfigStatus, isVaIntegrationConfigured } from '../config/vaAuth';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import DbqFinder from './DbqFinder';
import ClaimEvidenceUpload from './ClaimEvidenceUpload';
import VaDataConsentPrompt from './VaDataConsentPrompt';
import { saveVADataWithConsent } from '../utils/vaDataPersistence';
import { useLanguage } from '../contexts/LanguageContext';

// Icons
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
} from 'lucide-react';

const VaSandboxTest = ({ onClose }) => {
  const { t } = useLanguage();
  useBodyScrollLock(true);
  
  // Power User Feature States
  const [showDbqFinder, setShowDbqFinder] = useState(false);
  const [showEvidenceUpload, setShowEvidenceUpload] = useState(false);
  const [selectedClaimForUpload, setSelectedClaimForUpload] = useState(null);
  
  // Consent & Save States
  const [showConsentPrompt, setShowConsentPrompt] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(null);
  
  const { 
    isAuthenticated, 
    isLoading: authLoading, 
    userInfo, 
    login, 
    logout, 
    accessToken,
    error: authError,
  } = useVaAuth();

  // =========================================================================
  // USER DATA STATES (OAuth Required)
  // =========================================================================
  const [serviceHistory, setServiceHistory] = useState(null);
  const [claims, setClaims] = useState(null);
  const [appealableIssues, setAppealableIssues] = useState(null);
  const [appealsStatus, setAppealsStatus] = useState(null);

  // Raw JSON states for User Data
  const [rawServiceHistory, setRawServiceHistory] = useState(null);
  const [rawClaims, setRawClaims] = useState(null);
  const [rawAppealableIssues, setRawAppealableIssues] = useState(null);
  const [rawAppealsStatus, setRawAppealsStatus] = useState(null);

  // =========================================================================
  // OPEN DATA STATES (API Key Required)
  // =========================================================================
  const [facilities, setFacilities] = useState(null);
  const [forms, setForms] = useState(null);
  const [disabilities, setDisabilities] = useState(null);

  // Raw JSON states for Open Data
  const [rawFacilities, setRawFacilities] = useState(null);
  const [rawForms, setRawForms] = useState(null);
  const [rawDisabilities, setRawDisabilities] = useState(null);

  // =========================================================================
  // UI STATES
  // =========================================================================
  const [loading, setLoading] = useState({
    serviceHistory: false,
    claims: false,
    appealableIssues: false,
    appealsStatus: false,
    facilities: false,
    forms: false,
    disabilities: false,
  });
  const [errors, setErrors] = useState({
    serviceHistory: null,
    claims: null,
    appealableIssues: null,
    appealsStatus: null,
    facilities: null,
    forms: null,
    disabilities: null,
  });
  const [showRawJson, setShowRawJson] = useState({
    serviceHistory: false,
    claims: false,
    appealableIssues: false,
    appealsStatus: false,
    facilities: false,
    forms: false,
    disabilities: false,
  });
  const [testResults, setTestResults] = useState({});

  // API Key availability (check each individually)
  const isFacilitiesApiKeyConfigured = Boolean(VA_FACILITIES_API_KEY && VA_FACILITIES_API_KEY !== 'your_va_api_key_here');
  const isFormsApiKeyConfigured = Boolean(VA_FORMS_API_KEY && VA_FORMS_API_KEY !== 'your_forms_api_key_here');
  const isBenefitsApiKeyConfigured = Boolean(VA_BENEFITS_REF_API_KEY && VA_BENEFITS_REF_API_KEY !== 'your_benefits_api_key_here');
  const isApiKeyConfigured = isFacilitiesApiKeyConfigured; // Backward compatibility

  // =========================================================================
  // DATA FETCHING FUNCTIONS
  // =========================================================================

  // Fetch all user data when authenticated
  const fetchAllUserData = useCallback(async () => {
    if (!accessToken) return;
    fetchServiceHistory();
    fetchClaims();
    fetchAppealableIssues();
    fetchAppealsStatus();
  }, [accessToken]);

  // Auto-fetch user data when authenticated
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchAllUserData();
    }
  }, [isAuthenticated, accessToken, fetchAllUserData]);
  
  // Show consent prompt after data is successfully loaded
  useEffect(() => {
    if (isAuthenticated && (serviceHistory || claims || appealableIssues || appealsStatus)) {
      // Check if user has already seen consent for this session
      const hasSeenConsent = sessionStorage.getItem('va_consent_shown');
      if (!hasSeenConsent) {
        setShowConsentPrompt(true);
        sessionStorage.setItem('va_consent_shown', 'true');
      }
    }
  }, [isAuthenticated, serviceHistory, claims, appealableIssues, appealsStatus]);

  // === USER DATA FETCHERS ===

  const fetchServiceHistory = async () => {
    setLoading(prev => ({ ...prev, serviceHistory: true }));
    setErrors(prev => ({ ...prev, serviceHistory: null }));
    try {
      const data = await getServiceHistory(accessToken);
      setRawServiceHistory(data);
      setServiceHistory(formatServiceHistory(data));
      setTestResults(prev => ({ ...prev, serviceHistory: 'pass' }));
    } catch (err) {
      console.error('[Sandbox Test] Service history error:', err);
      setErrors(prev => ({ ...prev, serviceHistory: err.message }));
      setTestResults(prev => ({ ...prev, serviceHistory: 'fail' }));
    } finally {
      setLoading(prev => ({ ...prev, serviceHistory: false }));
    }
  };

  const fetchClaims = async () => {
    setLoading(prev => ({ ...prev, claims: true }));
    setErrors(prev => ({ ...prev, claims: null }));
    try {
      const data = await getClaims(accessToken);
      setRawClaims(data);
      setClaims(formatClaims(data));
      setTestResults(prev => ({ ...prev, claims: 'pass' }));
    } catch (err) {
      console.error('[Sandbox Test] Claims error:', err);
      setErrors(prev => ({ ...prev, claims: err.message }));
      setTestResults(prev => ({ ...prev, claims: 'fail' }));
    } finally {
      setLoading(prev => ({ ...prev, claims: false }));
    }
  };

  const fetchAppealableIssues = async () => {
    setLoading(prev => ({ ...prev, appealableIssues: true }));
    setErrors(prev => ({ ...prev, appealableIssues: null }));
    try {
      const data = await getAppealableIssues(accessToken);
      setRawAppealableIssues(data);
      setAppealableIssues(formatAppealableIssues(data));
      setTestResults(prev => ({ ...prev, appealableIssues: 'pass' }));
    } catch (err) {
      console.error('[Sandbox Test] Appealable issues error:', err);
      setErrors(prev => ({ ...prev, appealableIssues: err.message }));
      setTestResults(prev => ({ ...prev, appealableIssues: 'fail' }));
    } finally {
      setLoading(prev => ({ ...prev, appealableIssues: false }));
    }
  };

  const fetchAppealsStatus = async () => {
    setLoading(prev => ({ ...prev, appealsStatus: true }));
    setErrors(prev => ({ ...prev, appealsStatus: null }));
    try {
      const data = await getAppealsStatus(accessToken);
      setRawAppealsStatus(data);
      setAppealsStatus(formatAppealsStatus(data));
      setTestResults(prev => ({ ...prev, appealsStatus: 'pass' }));
    } catch (err) {
      console.error('[Sandbox Test] Appeals status error:', err);
      setErrors(prev => ({ ...prev, appealsStatus: err.message }));
      setTestResults(prev => ({ ...prev, appealsStatus: 'fail' }));
    } finally {
      setLoading(prev => ({ ...prev, appealsStatus: false }));
    }
  };

  // === OPEN DATA FETCHERS ===

  const testFacilitiesApi = async () => {
    setLoading(prev => ({ ...prev, facilities: true }));
    setErrors(prev => ({ ...prev, facilities: null }));
    try {
      const data = await getFacilities(VA_FACILITIES_API_KEY, { zip: '97217', perPage: 5 });
      setRawFacilities(data);
      setFacilities(formatFacilities(data));
      setTestResults(prev => ({ ...prev, facilities: 'pass' }));
    } catch (err) {
      console.error('[Sandbox Test] Facilities error:', err);
      setErrors(prev => ({ ...prev, facilities: err.message }));
      setTestResults(prev => ({ ...prev, facilities: 'fail' }));
    } finally {
      setLoading(prev => ({ ...prev, facilities: false }));
    }
  };

  const testFormsApi = async () => {
    setLoading(prev => ({ ...prev, forms: true }));
    setErrors(prev => ({ ...prev, forms: null }));
    try {
      const data = await searchForms(VA_FACILITIES_API_KEY, '21-526EZ');
      setRawForms(data);
      setForms(formatForms(data));
      setTestResults(prev => ({ ...prev, forms: 'pass' }));
    } catch (err) {
      console.error('[Sandbox Test] Forms error:', err);
      setErrors(prev => ({ ...prev, forms: err.message }));
      setTestResults(prev => ({ ...prev, forms: 'fail' }));
    } finally {
      setLoading(prev => ({ ...prev, forms: false }));
    }
  };

  const testDisabilitiesApi = async () => {
    setLoading(prev => ({ ...prev, disabilities: true }));
    setErrors(prev => ({ ...prev, disabilities: null }));
    try {
      const data = await getBenefitsReferenceDisabilities(VA_FACILITIES_API_KEY);
      setRawDisabilities(data);
      setDisabilities(formatBenefitsDisabilities(data));
      setTestResults(prev => ({ ...prev, disabilities: 'pass' }));
    } catch (err) {
      console.error('[Sandbox Test] Disabilities error:', err);
      setErrors(prev => ({ ...prev, disabilities: err.message }));
      setTestResults(prev => ({ ...prev, disabilities: 'fail' }));
    } finally {
      setLoading(prev => ({ ...prev, disabilities: false }));
    }
  };

  // =========================================================================
  // HELPERS
  // =========================================================================

  const toggleRawJson = (key) => {
    setShowRawJson(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch { return dateString; }
  };

  const getTestStatusIcon = (key) => {
    const status = testResults[key];
    if (status === 'pass') return <Check className="w-5 h-5 text-green-500" />;
    if (status === 'fail') return <X className="w-5 h-5 text-red-500" />;
    return <Clock className="w-5 h-5 text-gray-400" />;
  };

  const getTestStatusBg = (key) => {
    const status = testResults[key];
    if (status === 'pass') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700';
    if (status === 'fail') return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700';
    return 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600';
  };

  // Loading spinner component
  const LoadingSpinner = ({ text = 'Loading...' }) => (
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
            <button onClick={onRetry} className="mt-1 text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1">
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
      <button onClick={onToggle} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
        <Code className="w-3 h-3" />
        {isOpen ? 'Hide' : 'Show'} Raw JSON
        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {isOpen && data && (
        <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-auto max-h-64 font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );

  // =========================================================================
  // CONSENT HANDLER
  // =========================================================================
  
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
        rawAppealableIssues
      };
      
      const results = await saveVADataWithConsent(vaData, consent);
      
      setShowConsentPrompt(false);
      
      // Show success message
      if (results.packet.saved || results.vkb.saved) {
        let message = 'Data saved successfully! ';
        if (results.packet.count > 0) {
          message += `${results.packet.count} item${results.packet.count > 1 ? 's' : ''} saved to My Packet. `;
        }
        if (results.vkb.saved) {
          message += 'Service history saved to Knowledge Base.';
        }
        setSaveSuccessMessage(message);
        setTimeout(() => setSaveSuccessMessage(null), 5000);
      }
      
      if (results.errors.length > 0) {
        console.error('Save errors:', results.errors);
      }
    } catch (error) {
      console.error('Error saving VA data:', error);
      alert('Error saving data. Please try again.');
    }
  };
  
  const handleSkipConsent = () => {
    setShowConsentPrompt(false);
    setSaveSuccessMessage('Data not saved - available only during this session.');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label="VA API Sandbox Test"
    >
      <div className="min-h-screen px-4 py-8 flex items-start justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-6xl w-full animate-modalEnter relative">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-green-800 via-green-700 to-teal-700 text-white p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center">
                  <ListChecks className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">VA Sandbox Validation Dashboard <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">BETA</span></h2>
                  <p className="text-green-200 text-sm mt-1">
                    Production Access Demo • All APIs Tested
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-2" aria-label="Close">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Configuration Status Warning */}
            {!isVaIntegrationConfigured() && (
              <div className="mt-4 bg-yellow-500/20 border border-yellow-400/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-100">VA OAuth Not Configured</p>
                    <p className="text-sm text-yellow-200 mt-1">
                      Missing environment variables. Set these in your Render Dashboard or .env.local:
                    </p>
                    <ul className="text-xs text-yellow-300 mt-2 space-y-1 font-mono">
                      {!getVaConfigStatus().hasOAuth && (
                        <>
                          <li>• VITE_VA_AUTH_ID (from sandbox form at developer.va.gov/explore)</li>
                          <li>• VITE_VA_REDIRECT_URL (must match what you submitted on the VA sandbox form)</li>
                          <li>• VITE_VA_OAUTH_API_PATH (e.g., veteran-verification/v1)</li>
                        </>
                      )}
                      {!getVaConfigStatus().hasApiKey && (
                        <li>• VITE_VA_API_KEY (for Facilities API)</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Auth Status */}
            <div className="mt-4 flex items-center justify-between bg-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isAuthenticated ? 'bg-green-400' : isVaIntegrationConfigured() ? 'bg-yellow-400' : 'bg-red-400'} animate-pulse`} />
                <span className="font-medium">
                  {authLoading ? 'Checking...' : isAuthenticated ? 'Connected to VA.gov' : isVaIntegrationConfigured() ? 'Not Connected' : 'Configuration Required'}
                </span>
                {isAuthenticated && userInfo && (
                  <span className="text-green-200 text-sm ml-2">• {userInfo.given_name || 'Veteran'}</span>
                )}
              </div>
              {isAuthenticated ? (
                <button onClick={logout} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg">
                  <LogOut className="w-4 h-4" /> Disconnect
                </button>
              ) : (
                <button 
                  onClick={login} 
                  disabled={authLoading || !isVaIntegrationConfigured()} 
                  className="flex items-center gap-2 bg-white text-green-800 hover:bg-green-50 px-4 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!isVaIntegrationConfigured() ? 'Configure environment variables first' : 'Connect to VA.gov'}
                >
                  <LogIn className="w-4 h-4" /> Connect VA Account
                </button>
              )}
            </div>

            {authError && (
              <div className="mt-3 bg-red-500/20 border border-red-300/30 rounded-lg p-3 text-sm text-red-100">
                <AlertTriangle className="w-4 h-4 inline mr-2" />{authError}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 space-y-8">
            
            {/* ============================================================ */}
            {/* SECTION A: OPEN DATA APIs (No Login Required) */}
            {/* ============================================================ */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Section A: Open Data APIs</h3>
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-bold rounded">API KEY</span>
              </div>
              
              {(!isFacilitiesApiKeyConfigured || !isFormsApiKeyConfigured || !isBenefitsApiKeyConfigured) && (
                <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">API Key(s) Required</p>
                      <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
                        {!isFacilitiesApiKeyConfigured && <li>• <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">VITE_VA_API_KEY</code> (VA Facilities)</li>}
                        {!isFormsApiKeyConfigured && <li>• <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">VITE_VA_FORMS_API_KEY</code> (VA Forms)</li>}
                        {!isBenefitsApiKeyConfigured && <li>• <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">VITE_VA_BENEFITS_REF_API_KEY</code> (Benefits Reference)</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Facilities API Test */}
                <div className={`border rounded-xl p-4 ${getTestStatusBg('facilities')}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-gray-900 dark:text-white">Facilities API</h4>
                    </div>
                    {getTestStatusIcon('facilities')}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Search ZIP: 97217</p>
                  
                  <button onClick={testFacilitiesApi} disabled={loading.facilities || !isFacilitiesApiKeyConfigured}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading.facilities ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                    Test Facilities
                  </button>
                  
                  {errors.facilities && <p className="mt-2 text-xs text-red-600">{errors.facilities}</p>}
                  {facilities && (
                    <div className="mt-3 text-sm">
                      <p className="text-green-600 dark:text-green-400 font-medium">✓ Found {facilities.length} facilities</p>
                      {facilities.slice(0, 2).map((f, i) => (
                        <p key={i} className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">• {f.name}</p>
                      ))}
                    </div>
                  )}
                  <RawJsonToggle isOpen={showRawJson.facilities} onToggle={() => toggleRawJson('facilities')} data={rawFacilities} />
                </div>

                {/* Forms API Test */}
                <div className={`border rounded-xl p-4 ${getTestStatusBg('forms')}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileType className="w-5 h-5 text-purple-600" />
                      <h4 className="font-semibold text-gray-900 dark:text-white">Forms API</h4>
                    </div>
                    {getTestStatusIcon('forms')}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Search: "21-526EZ"</p>
                  
                  <button onClick={testFormsApi} disabled={loading.forms || !isFormsApiKeyConfigured}
                    className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading.forms ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
                    Test Forms
                  </button>
                  
                  {errors.forms && <p className="mt-2 text-xs text-red-600">{errors.forms}</p>}
                  {forms && forms.length > 0 && (
                    <div className="mt-3 text-sm">
                      <p className="text-green-600 dark:text-green-400 font-medium">✓ Found {forms.length} form(s)</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{forms[0]?.title?.slice(0, 60)}...</p>
                      {forms[0]?.pdfUrl && (
                        <a href={forms[0].pdfUrl} target="_blank" rel="noopener noreferrer" 
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                          <ExternalLink className="w-3 h-3" /> View PDF
                        </a>
                      )}
                    </div>
                  )}
                  <RawJsonToggle isOpen={showRawJson.forms} onToggle={() => toggleRawJson('forms')} data={rawForms} />
                </div>

                {/* Benefits Reference Data Test */}
                <div className={`border rounded-xl p-4 ${getTestStatusBg('disabilities')}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-teal-600" />
                      <h4 className="font-semibold text-gray-900 dark:text-white">Reference Data</h4>
                    </div>
                    {getTestStatusIcon('disabilities')}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Disabilities List</p>
                  
                  <button onClick={testDisabilitiesApi} disabled={loading.disabilities || !isBenefitsApiKeyConfigured}
                    className="w-full px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading.disabilities ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
                    Test Reference Data
                  </button>
                  
                  {errors.disabilities && <p className="mt-2 text-xs text-red-600">{errors.disabilities}</p>}
                  {disabilities && (
                    <div className="mt-3 text-sm">
                      <p className="text-green-600 dark:text-green-400 font-medium">✓ Found {disabilities.length} disabilities</p>
                      {disabilities.slice(0, 3).map((d, i) => (
                        <p key={i} className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">• {d.name}</p>
                      ))}
                    </div>
                  )}
                  <RawJsonToggle isOpen={showRawJson.disabilities} onToggle={() => toggleRawJson('disabilities')} data={rawDisabilities} />
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* POWER USER FEATURES */}
            {/* ============================================================ */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-700">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-amber-600" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Power User Features</h3>
                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 text-xs font-bold rounded">NEW</span>
              </div>
              
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                Advanced tools for managing your VA claim directly through official APIs
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* DBQ Finder Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-amber-200 dark:border-amber-700 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">DBQ Finder</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Find the right medical form</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Search for Disability Benefits Questionnaires by condition. Get the exact form your private doctor needs to fill out.
                  </p>
                  <button 
                    onClick={() => setShowDbqFinder(true)}
                    className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <FileSearch className="w-4 h-4" />
                    Find DBQ Forms
                  </button>
                </div>

                {/* Evidence Upload Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-amber-200 dark:border-amber-700 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">Evidence Upload</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Submit directly to VA</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Upload completed DBQs, Nexus Letters, or buddy statements directly to your active claim via VA API.
                  </p>
                  <button 
                    onClick={() => {
                      if (isAuthenticated && claims && claims.length > 0) {
                        setSelectedClaimForUpload(claims[0]);
                        setShowEvidenceUpload(true);
                      } else if (!isAuthenticated) {
                        login();
                      }
                    }}
                    disabled={isAuthenticated && (!claims || claims.length === 0)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="w-4 h-4" />
                    {!isAuthenticated ? 'Login to Upload' : 
                     (!claims || claims.length === 0) ? 'No Active Claims' : 
                     'Upload Evidence'}
                  </button>
                  {isAuthenticated && claims && claims.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                      Will upload to: {claims[0].type || 'Compensation'} Claim
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION B: USER DATA APIs (OAuth Required) */}
            {/* ============================================================ */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-green-600" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Section B: User Data APIs</h3>
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 text-xs font-bold rounded">OAUTH</span>
              </div>

              {!isAuthenticated ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                  <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Login Required</h4>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">Connect your VA.gov account to test user data APIs</p>
                  <button onClick={login} disabled={authLoading}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2 mx-auto">
                    <LogIn className="w-5 h-5" /> Connect VA Account
                  </button>
                </div>
              ) : (
                <>
                  {/* Refresh All Button */}
                  <div className="flex justify-end mb-4">
                    <button onClick={fetchAllUserData}
                      disabled={loading.serviceHistory || loading.claims || loading.appealableIssues || loading.appealsStatus}
                      className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1 disabled:opacity-50">
                      <RefreshCw className={`w-4 h-4 ${(loading.serviceHistory || loading.claims || loading.appealableIssues || loading.appealsStatus) ? 'animate-spin' : ''}`} />
                      Refresh All User Data
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Service History Card */}
                    <div className={`border rounded-xl p-4 ${getTestStatusBg('serviceHistory')}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Medal className="w-5 h-5 text-blue-600" />
                          <h4 className="font-semibold text-gray-900 dark:text-white">Service History</h4>
                        </div>
                        {getTestStatusIcon('serviceHistory')}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Scope: service_history.read</p>
                      
                      {loading.serviceHistory ? <LoadingSpinner text="Fetching service history..." /> :
                       errors.serviceHistory ? <ErrorMessage message={errors.serviceHistory} onRetry={fetchServiceHistory} /> :
                       serviceHistory && serviceHistory.length > 0 ? (
                        <div className="space-y-2">
                          {serviceHistory.map((s, i) => (
                            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm">
                              <p className="font-medium text-gray-900 dark:text-white">{s.branch}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">{formatDate(s.startDate)} - {formatDate(s.endDate)}</p>
                              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded">{s.dischargeStatus}</span>
                            </div>
                          ))}
                        </div>
                       ) : (
                        <p className="text-sm text-gray-500">No service history found</p>
                       )}
                      <RawJsonToggle isOpen={showRawJson.serviceHistory} onToggle={() => toggleRawJson('serviceHistory')} data={rawServiceHistory} />
                    </div>

                    {/* Claims Card */}
                    <div className={`border rounded-xl p-4 ${getTestStatusBg('claims')}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-green-600" />
                          <h4 className="font-semibold text-gray-900 dark:text-white">Claims</h4>
                        </div>
                        {getTestStatusIcon('claims')}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Scope: claim.read</p>
                      
                      {loading.claims ? <LoadingSpinner text="Fetching claims..." /> :
                       errors.claims ? <ErrorMessage message={errors.claims} onRetry={fetchClaims} /> :
                       claims && claims.length > 0 ? (
                        <div className="space-y-2">
                          {claims.slice(0, 3).map((c, i) => (
                            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm">
                              <p className="font-medium text-gray-900 dark:text-white">{c.type} Claim</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Filed: {formatDate(c.dateFiled)}</p>
                              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded">
                                Phase {c.phase?.number}: {c.phase?.name}
                              </span>
                            </div>
                          ))}
                          {claims.length > 3 && <p className="text-xs text-gray-500">+{claims.length - 3} more claims</p>}
                        </div>
                       ) : (
                        <p className="text-sm text-gray-500">No claims found</p>
                       )}
                      <RawJsonToggle isOpen={showRawJson.claims} onToggle={() => toggleRawJson('claims')} data={rawClaims} />
                    </div>

                    {/* Appealable Issues Card */}
                    <div className={`border rounded-xl p-4 ${getTestStatusBg('appealableIssues')}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-orange-600" />
                          <h4 className="font-semibold text-gray-900 dark:text-white">Appealable Issues</h4>
                        </div>
                        {getTestStatusIcon('appealableIssues')}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Scope: appealable_issues.read</p>
                      
                      {loading.appealableIssues ? <LoadingSpinner text="Fetching issues..." /> :
                       errors.appealableIssues ? <ErrorMessage message={errors.appealableIssues} onRetry={fetchAppealableIssues} /> :
                       appealableIssues && appealableIssues.length > 0 ? (
                        <div className="space-y-2">
                          {appealableIssues.slice(0, 3).map((issue, i) => (
                            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm">
                              <p className="font-medium text-gray-900 dark:text-white">{issue.subject}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Decision: {formatDate(issue.decisionDate)}</p>
                              {issue.percentNumber !== undefined && (
                                <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-200 rounded">
                                  Rated: {issue.percentNumber}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                       ) : (
                        <p className="text-sm text-gray-500 flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> No appealable issues</p>
                       )}
                      <RawJsonToggle isOpen={showRawJson.appealableIssues} onToggle={() => toggleRawJson('appealableIssues')} data={rawAppealableIssues} />
                    </div>

                    {/* Appeals Status Card */}
                    <div className={`border rounded-xl p-4 ${getTestStatusBg('appealsStatus')}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Gavel className="w-5 h-5 text-purple-600" />
                          <h4 className="font-semibold text-gray-900 dark:text-white">Appeals Status</h4>
                        </div>
                        {getTestStatusIcon('appealsStatus')}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Scope: appeals_status.read</p>
                      
                      {loading.appealsStatus ? <LoadingSpinner text="Fetching appeals..." /> :
                       errors.appealsStatus ? <ErrorMessage message={errors.appealsStatus} onRetry={fetchAppealsStatus} /> :
                       appealsStatus && appealsStatus.length > 0 ? (
                        <div className="space-y-2">
                          {appealsStatus.slice(0, 3).map((appeal, i) => (
                            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm">
                              <p className="font-medium text-gray-900 dark:text-white capitalize">{appeal.type} Appeal</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Program: {appeal.programArea}</p>
                              <span className={`text-xs px-2 py-0.5 rounded ${appeal.active ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                {appeal.active ? 'Active' : 'Closed'}
                              </span>
                            </div>
                          ))}
                        </div>
                       ) : (
                        <p className="text-sm text-gray-500">No active appeals</p>
                       )}
                      <RawJsonToggle isOpen={showRawJson.appealsStatus} onToggle={() => toggleRawJson('appealsStatus')} data={rawAppealsStatus} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ============================================================ */}
            {/* TEST SUMMARY */}
            {/* ============================================================ */}
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <ListChecks className="w-5 h-5" /> API Test Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {['facilities', 'forms', 'disabilities', 'serviceHistory', 'claims', 'appealableIssues', 'appealsStatus'].map(key => (
                  <div key={key} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg">
                    {getTestStatusIcon(key)}
                    <span className="capitalize text-gray-700 dark:text-gray-300">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <strong>Scopes Requested:</strong> openid profile offline_access claim.read service_history.read appealable_issues.read appeals_status.read
                </p>
              </div>
            </div>

            {/* Info Footer */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold">Sandbox Environment</p>
                  <p className="mt-1">All data shown is synthetic test data from VA.gov Sandbox. Production access requires VA approval.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Power User Feature Modals */}
      {showDbqFinder && (
        <DbqFinder onClose={() => setShowDbqFinder(false)} />
      )}
      
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
    </div>
  );
};

export default VaSandboxTest;
