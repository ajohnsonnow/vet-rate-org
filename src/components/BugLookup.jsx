/**
 * Vet-Rate.org - Bug Lookup (Admin Interface)
 * "Safe-Squash" Architecture - Secure Bug Report Retrieval
 * 
 * Admin tool to search and view bug reports by ID.
 * - Searches local IndexedDB storage
 * - Displays sanitized reports (no PII)
 * - Logs all access in audit trail
 * 
 * Security: Because PII was redacted before storage, viewing
 * these logs does not expose user data.
 * 
 * Built by a fellow veteran. "Find any bug, fix any bug."
 */

import React, { useState, useEffect } from 'react';
import {
  Search, Bug, AlertTriangle, AlertCircle, Clock, CheckCircle,
  X, Database, FileText, Monitor, Smartphone, RefreshCw,
  Download, Trash2, Eye, History, Shield, Filter, ChevronDown,
  ChevronRight, Copy, Check
} from 'lucide-react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import {
  getBugReport,
  getAllBugReports,
  resolveBugReport,
  deleteBugReport,
  searchBugReports,
  getBugStatistics,
  getAuditLog,
  exportBugReports,
  isStorageAvailable,
  getFromLocalStorage
} from '../utils/bugReportStorage';

// Severity icons and colors
const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/20', label: 'Critical' },
  high: { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/20', label: 'High' },
  medium: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/20', label: 'Medium' },
  low: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/20', label: 'Low' }
};

export default function BugLookup({ onClose }) {
  useBodyScrollLock(true);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [reports, setReports] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('list'); // list, detail, audit
  const [filters, setFilters] = useState({ resolved: null, severity: null });
  const [showFilters, setShowFilters] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  // Check storage availability and load data on mount
  useEffect(() => {
    const init = async () => {
      const available = isStorageAvailable();
      setStorageAvailable(available);
      
      if (available) {
        await loadReports();
        await loadStatistics();
      } else {
        // Fall back to localStorage
        const backupReports = getFromLocalStorage();
        setReports(backupReports);
        setLoading(false);
      }
    };
    
    init();
  }, []);

  // Load reports with current filters
  const loadReports = async () => {
    setLoading(true);
    setError('');
    
    try {
      const loadedReports = await getAllBugReports({
        resolved: filters.resolved,
        severity: filters.severity,
        limit: 100
      });
      setReports(loadedReports);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setError('Failed to load bug reports');
    }
    
    setLoading(false);
  };

  // Load statistics
  const loadStatistics = async () => {
    try {
      const stats = await getBugStatistics();
      setStatistics(stats);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  // Search by ID or text
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      await loadReports();
      return;
    }

    setLoading(true);
    setError('');

    try {
      // First try exact ID match
      const exactMatch = await getBugReport(searchQuery.toUpperCase(), 'admin');
      
      if (exactMatch) {
        setReports([exactMatch]);
        setSelectedReport(exactMatch);
        setView('detail');
      } else {
        // Fall back to text search
        const results = await searchBugReports(searchQuery);
        setReports(results);
        
        if (results.length === 0) {
          setError(`No reports found matching "${searchQuery}"`);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
      setError('Search failed. Please try again.');
    }

    setLoading(false);
  };

  // View a specific report
  const handleViewReport = async (report) => {
    setSelectedReport(report);
    setView('detail');
    
    // Load audit log for this report
    try {
      const log = await getAuditLog(report.report_id);
      setAuditLog(log);
    } catch (err) {
      console.error('Failed to load audit log:', err);
    }
  };

  // Resolve a report
  const handleResolve = async () => {
    if (!selectedReport) return;
    
    setResolving(true);
    
    try {
      const updated = await resolveBugReport(
        selectedReport.report_id,
        resolutionNotes,
        'admin'
      );
      setSelectedReport(updated);
      setShowResolveModal(false);
      setResolutionNotes('');
      await loadReports();
      await loadStatistics();
    } catch (err) {
      console.error('Failed to resolve:', err);
      setError('Failed to mark as resolved');
    }
    
    setResolving(false);
  };

  // Delete a report
  const handleDelete = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this bug report? This cannot be undone.')) {
      return;
    }
    
    try {
      await deleteBugReport(reportId, 'admin');
      setSelectedReport(null);
      setView('list');
      await loadReports();
      await loadStatistics();
    } catch (err) {
      console.error('Failed to delete:', err);
      setError('Failed to delete report');
    }
  };

  // Export all reports
  const handleExport = async () => {
    try {
      const exportData = await exportBugReports();
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vetrate-bug-reports-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export reports');
    }
  };

  // Copy report to clipboard
  const handleCopyReport = async () => {
    if (!selectedReport) return;
    
    const reportText = JSON.stringify(selectedReport, null, 2);
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render severity badge
  const SeverityBadge = ({ severity }) => {
    const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.medium;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 z-50 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="bg-slate-800/80 border-b border-slate-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bug className="w-6 h-6 text-amber-500" />
            <div>
              <h1 className="text-lg font-bold text-white">Bug Squasher - Admin Lookup</h1>
              <p className="text-xs text-slate-400">Search and manage bug reports</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Storage Status */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              storageAvailable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              <Database className="w-3 h-3" />
              {storageAvailable ? 'DB Online' : 'Fallback Mode'}
            </div>
            
            <button
              onClick={handleExport}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="Export All Reports"
            >
              <Download className="w-5 h-5" />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-red-400 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-4 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter Bug ID (e.g., BUG-MKNCUI1I) or search text..."
              className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium rounded-lg transition-colors"
          >
            Search
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
        
        {/* Filters */}
        {showFilters && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Status:</span>
              <select
                value={filters.resolved === null ? '' : filters.resolved.toString()}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters(f => ({ ...f, resolved: val === '' ? null : val === 'true' }));
                }}
                className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
              >
                <option value="">All</option>
                <option value="false">Unresolved</option>
                <option value="true">Resolved</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Severity:</span>
              <select
                value={filters.severity || ''}
                onChange={(e) => setFilters(f => ({ ...f, severity: e.target.value || null }))}
                className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
              >
                <option value="">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <button
              onClick={loadReports}
              className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300"
            >
              <RefreshCw className="w-4 h-4" />
              Apply Filters
            </button>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      {statistics && (
        <div className="bg-slate-800/30 border-b border-slate-700 px-4 py-2 flex gap-6 text-sm">
          <span className="text-slate-400">
            Total: <span className="text-white font-medium">{statistics.total}</span>
          </span>
          <span className="text-slate-400">
            Unresolved: <span className="text-red-400 font-medium">{statistics.unresolved}</span>
          </span>
          <span className="text-slate-400">
            Critical: <span className="text-red-500 font-medium">{statistics.bySeverity.critical}</span>
          </span>
          <span className="text-slate-400">
            Last 24h: <span className="text-amber-400 font-medium">{statistics.last24Hours}</span>
          </span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex">
        {/* Report List */}
        <div className={`${view === 'list' ? 'w-full' : 'w-1/3'} border-r border-slate-700 overflow-y-auto`}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
            </div>
          ) : error && reports.length === 0 ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-400">{error}</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center">
              <Bug className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No bug reports found</p>
              <p className="text-slate-500 text-sm mt-1">Reports will appear here when users submit them</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {reports.map((report) => (
                <button
                  key={report.report_id}
                  onClick={() => handleViewReport(report)}
                  className={`w-full p-4 text-left hover:bg-slate-700/30 transition-colors ${
                    selectedReport?.report_id === report.report_id ? 'bg-slate-700/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-amber-400 text-sm">{report.report_id}</span>
                        {report.resolved && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-white text-sm truncate">{report.user_description || report.error_message || 'No description'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <SeverityBadge severity={report.severity} />
                        <span className="text-slate-500 text-xs">{report.module}</span>
                      </div>
                    </div>
                    <div className="text-slate-500 text-xs whitespace-nowrap">
                      {new Date(report.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Report Detail */}
        {view === 'detail' && selectedReport && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Report Header */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold font-mono text-amber-400">{selectedReport.report_id}</h2>
                    <p className="text-slate-400 text-sm mt-1">
                      Created: {new Date(selectedReport.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={selectedReport.severity} />
                    {selectedReport.resolved ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
                        Open
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
                  <button
                    onClick={handleCopyReport}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy JSON'}
                  </button>
                  {!selectedReport.resolved && (
                    <button
                      onClick={() => setShowResolveModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm text-white transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Mark Resolved
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(selectedReport.report_id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Description */}
              <DetailSection title="User Description" icon={FileText}>
                <p className="text-slate-300 whitespace-pre-wrap">
                  {selectedReport.user_description || '(No description provided)'}
                </p>
              </DetailSection>

              {/* Error Info */}
              {selectedReport.error_message && (
                <DetailSection title="Error Message" icon={AlertTriangle}>
                  <pre className="text-red-400 text-sm overflow-x-auto bg-slate-900/50 p-3 rounded">
                    {selectedReport.error_message}
                  </pre>
                </DetailSection>
              )}

              {/* Stack Trace */}
              {selectedReport.stack_trace && (
                <DetailSection title="Stack Trace" icon={AlertCircle}>
                  <pre className="text-slate-400 text-xs overflow-x-auto bg-slate-900/50 p-3 rounded max-h-48">
                    {selectedReport.stack_trace}
                  </pre>
                </DetailSection>
              )}

              {/* Steps to Reproduce */}
              {selectedReport.steps_to_reproduce && (
                <DetailSection title="Steps to Reproduce" icon={RefreshCw}>
                  <p className="text-slate-300 whitespace-pre-wrap">
                    {selectedReport.steps_to_reproduce}
                  </p>
                </DetailSection>
              )}

              {/* Client Metadata */}
              <DetailSection title="Client Environment" icon={Monitor}>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">Browser:</span>
                    <span className="text-slate-300 ml-2 break-all">{selectedReport.client_metadata?.browser}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">OS:</span>
                    <span className="text-slate-300 ml-2">{selectedReport.client_metadata?.os}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Screen:</span>
                    <span className="text-slate-300 ml-2">{selectedReport.client_metadata?.screen_resolution}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Window:</span>
                    <span className="text-slate-300 ml-2">{selectedReport.client_metadata?.window_size}</span>
                  </div>
                </div>
              </DetailSection>

              {/* Resolution Notes */}
              {selectedReport.resolved && selectedReport.resolution_notes && (
                <DetailSection title="Resolution Notes" icon={CheckCircle}>
                  <p className="text-green-400 whitespace-pre-wrap">
                    {selectedReport.resolution_notes}
                  </p>
                  <p className="text-slate-500 text-xs mt-2">
                    Resolved: {new Date(selectedReport.resolved_at).toLocaleString()}
                  </p>
                </DetailSection>
              )}

              {/* Audit Log */}
              {auditLog.length > 0 && (
                <DetailSection title="Audit Log" icon={History}>
                  <div className="space-y-2">
                    {auditLog.map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">
                          <span className="font-medium text-white">{entry.action}</span>
                          {' by '}{entry.accessor}
                        </span>
                        <span className="text-slate-500">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}

              {/* Sanitization Notice */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-400 font-medium text-sm">Privacy Protected</p>
                  <p className="text-green-300/70 text-xs mt-1">
                    This report was sanitized before storage. All PII (SSN, email, tokens) 
                    has been redacted. Viewing this log does not expose user data.
                  </p>
                  <p className="text-green-400/50 text-xs mt-1">
                    Sanitized: {selectedReport._sanitization?.sanitizedAt}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-4">Mark as Resolved</h3>
            <label className="block text-sm text-slate-400 mb-2">Resolution Notes:</label>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="How was this bug fixed? (optional)"
              className="w-full h-32 bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {resolving ? 'Saving...' : 'Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for detail sections
const DetailSection = ({ title, icon: Icon, children }) => (
  <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700 bg-slate-800/50">
      <Icon className="w-4 h-4 text-slate-400" />
      <h3 className="font-medium text-white text-sm">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);
