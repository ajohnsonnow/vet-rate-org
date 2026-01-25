/**
 * SupplyLocker.org - Feature Request Lookup (Admin Interface)
 * Secure Feature Request Retrieval and Management
 * 
 * Admin tool to search, view and manage feature requests.
 * - Searches local IndexedDB storage
 * - Track request status (new, under-review, planned, completed, declined)
 * - Logs all access in audit trail
 * 
 * Built by a fellow veteran. "Every idea counts."
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Search, Lightbulb, AlertCircle, Clock, CheckCircle,
  X, Database, FileText, Monitor, RefreshCw,
  Download, Trash2, History, Shield, Filter,
  Copy, Check, Zap, MessageSquare, Star
} from 'lucide-react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import {
  getFeatureRequest,
  getAllFeatureRequests,
  updateFeatureRequestStatus,
  deleteFeatureRequest,
  searchFeatureRequests,
  getFeatureStatistics,
  getFeatureAuditLog,
  exportFeatureRequests,
  isStorageAvailable,
  getFeatureFromLocalStorage
} from '../utils/featureRequestStorage';

// Priority icons and colors
const PRIORITY_CONFIG = {
  critical: { icon: Zap, color: 'text-red-500', bg: 'bg-red-500/20', label: 'Critical' },
  high: { icon: Star, color: 'text-orange-500', bg: 'bg-orange-500/20', label: 'High' },
  medium: { icon: Lightbulb, color: 'text-yellow-500', bg: 'bg-yellow-500/20', label: 'Medium' },
  low: { icon: MessageSquare, color: 'text-green-500', bg: 'bg-green-500/20', label: 'Low' }
};

// Status configuration
const STATUS_CONFIG = {
  new: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'New' },
  'under-review': { color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Under Review' },
  planned: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Planned' },
  'in-progress': { color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'In Progress' },
  completed: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Completed' },
  declined: { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Declined' }
};

export default function FeatureLookup({ onClose }) {
  const { t } = useLanguage();
  useBodyScrollLock(true);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requests, setRequests] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('list'); // list, detail
  const [filters, setFilters] = useState({ status: null, priority: null });
  const [showFilters, setShowFilters] = useState(false);
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  // Check storage availability and load data on mount
  useEffect(() => {
    const init = async () => {
      const available = isStorageAvailable();
      setStorageAvailable(available);
      
      if (available) {
        await loadRequests();
        await loadStatistics();
      } else {
        // Fall back to localStorage
        const backupRequests = getFeatureFromLocalStorage();
        setRequests(backupRequests);
        setLoading(false);
      }
    };
    
    init();
  }, []);

  // Load requests with current filters
  const loadRequests = async () => {
    setLoading(true);
    setError('');
    
    try {
      const loadedRequests = await getAllFeatureRequests({
        status: filters.status,
        priority: filters.priority,
        limit: 100
      });
      setRequests(loadedRequests);
    } catch (err) {
      console.error('Failed to load requests:', err);
      setError('Failed to load feature requests');
    }
    
    setLoading(false);
  };

  // Load statistics
  const loadStatistics = async () => {
    try {
      const stats = await getFeatureStatistics();
      setStatistics(stats);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  // Search by ID or text
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      await loadRequests();
      return;
    }

    setLoading(true);
    setError('');

    try {
      // First try exact ID match
      const exactMatch = await getFeatureRequest(searchQuery.toUpperCase(), 'admin');
      
      if (exactMatch) {
        setRequests([exactMatch]);
        setSelectedRequest(exactMatch);
        setView('detail');
      } else {
        // Fall back to text search
        const results = await searchFeatureRequests(searchQuery);
        setRequests(results);
        
        if (results.length === 0) {
          setError(`No requests found matching "${searchQuery}"`);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
      setError('Search failed. Please try again.');
    }

    setLoading(false);
  };

  // View a specific request
  const handleViewRequest = async (request) => {
    setSelectedRequest(request);
    setView('detail');
    
    // Load audit log for this request
    try {
      const log = await getFeatureAuditLog(request.request_id);
      setAuditLog(log);
    } catch (err) {
      console.error('Failed to load audit log:', err);
    }
  };

  // Update request status
  const handleUpdateStatus = async () => {
    if (!selectedRequest || !newStatus) return;
    
    setUpdating(true);
    
    try {
      const updated = await updateFeatureRequestStatus(
        selectedRequest.request_id,
        newStatus,
        reviewNotes,
        'admin'
      );
      setSelectedRequest(updated);
      setShowStatusModal(false);
      setNewStatus('');
      setReviewNotes('');
      await loadRequests();
      await loadStatistics();
    } catch (err) {
      console.error('Failed to update:', err);
      setError('Failed to update status');
    }
    
    setUpdating(false);
  };

  // Delete a request
  const handleDelete = async (requestId) => {
    if (!window.confirm('Are you sure you want to delete this feature request? This cannot be undone.')) {
      return;
    }
    
    try {
      await deleteFeatureRequest(requestId, 'admin');
      setSelectedRequest(null);
      setView('list');
      await loadRequests();
      await loadStatistics();
    } catch (err) {
      console.error('Failed to delete:', err);
      setError('Failed to delete request');
    }
  };

  // Export all requests
  const handleExport = async () => {
    try {
      const exportData = await exportFeatureRequests();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vetrate-feature-requests-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export requests');
    }
  };

  // Copy request to clipboard
  const handleCopyRequest = async () => {
    if (!selectedRequest) return;
    
    const requestText = JSON.stringify(selectedRequest, null, 2);
    await navigator.clipboard.writeText(requestText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render priority badge
  const PriorityBadge = ({ priority }) => {
    const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  // Render status badge
  const StatusBadge = ({ status }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.new;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
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
            <Lightbulb className="w-6 h-6 text-purple-500" />
            <div>
              <h1 className="text-lg font-bold text-white">Feature Requests - Admin Lookup</h1>
              <p className="text-xs text-slate-400">Search and manage feature requests</p>
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
              title="Export All Requests"
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
              placeholder="Enter Request ID (e.g., FEAT-MKNCUI1I) or search text..."
              className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
          >
            Search
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
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
                value={filters.status || ''}
                onChange={(e) => setFilters(f => ({ ...f, status: e.target.value || null }))}
                className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
              >
                <option value="">All</option>
                <option value="new">New</option>
                <option value="under-review">Under Review</option>
                <option value="planned">Planned</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="declined">Declined</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Priority:</span>
              <select
                value={filters.priority || ''}
                onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value || null }))}
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
              onClick={loadRequests}
              className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300"
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
            New: <span className="text-blue-400 font-medium">{statistics.byStatus.new}</span>
          </span>
          <span className="text-slate-400">
            Planned: <span className="text-amber-400 font-medium">{statistics.byStatus.planned}</span>
          </span>
          <span className="text-slate-400">
            Critical: <span className="text-red-400 font-medium">{statistics.byPriority.critical}</span>
          </span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex">
        {/* Request List */}
        <div className={`${view === 'list' ? 'w-full' : 'w-1/3'} border-r border-slate-700 overflow-y-auto`}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
            </div>
          ) : error && requests.length === 0 ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-400">{error}</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center">
              <Lightbulb className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No feature requests found</p>
              <p className="text-slate-500 text-sm mt-1">Requests will appear here when users submit them</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {requests.map((request) => (
                <button
                  key={request.request_id}
                  onClick={() => handleViewRequest(request)}
                  className={`w-full p-4 text-left hover:bg-slate-700/30 transition-colors ${
                    selectedRequest?.request_id === request.request_id ? 'bg-slate-700/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-purple-400 text-sm">{request.request_id}</span>
                        <StatusBadge status={request.status} />
                      </div>
                      <p className="text-white text-sm truncate">{request.title || 'No title'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <PriorityBadge priority={request.priority} />
                        <span className="text-slate-500 text-xs">{request.category}</span>
                      </div>
                    </div>
                    <div className="text-slate-500 text-xs whitespace-nowrap">
                      {new Date(request.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Request Detail */}
        {view === 'detail' && selectedRequest && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Request Header */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold font-mono text-purple-400">{selectedRequest.request_id}</h2>
                    <p className="text-white text-lg mt-2">{selectedRequest.title}</p>
                    <p className="text-slate-400 text-sm mt-1">
                      Created: {new Date(selectedRequest.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <PriorityBadge priority={selectedRequest.priority} />
                    <StatusBadge status={selectedRequest.status} />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
                  <button
                    onClick={handleCopyRequest}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy JSON'}
                  </button>
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm text-white transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Update Status
                  </button>
                  <button
                    onClick={() => handleDelete(selectedRequest.request_id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Description */}
              <DetailSection title="Description" icon={FileText}>
                <p className="text-slate-300 whitespace-pre-wrap">
                  {selectedRequest.description || '(No description provided)'}
                </p>
              </DetailSection>

              {/* Problem Solved */}
              {selectedRequest.problemSolved && (
                <DetailSection title="Problem This Would Solve" icon={Lightbulb}>
                  <p className="text-slate-300 whitespace-pre-wrap">
                    {selectedRequest.problemSolved}
                  </p>
                </DetailSection>
              )}

              {/* Proposed Solution */}
              {selectedRequest.proposedSolution && (
                <DetailSection title="Proposed Solution" icon={Zap}>
                  <p className="text-slate-300 whitespace-pre-wrap">
                    {selectedRequest.proposedSolution}
                  </p>
                </DetailSection>
              )}

              {/* Additional Context */}
              {selectedRequest.additionalContext && (
                <DetailSection title="Additional Context" icon={MessageSquare}>
                  <p className="text-slate-300 whitespace-pre-wrap">
                    {selectedRequest.additionalContext}
                  </p>
                </DetailSection>
              )}

              {/* Client Environment */}
              <DetailSection title="Client Environment" icon={Monitor}>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">Browser:</span>
                    <span className="text-slate-300 ml-2 break-all">{selectedRequest.systemInfo?.browser}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Screen:</span>
                    <span className="text-slate-300 ml-2">{selectedRequest.systemInfo?.screenResolution}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Module:</span>
                    <span className="text-slate-300 ml-2">{selectedRequest.module}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Category:</span>
                    <span className="text-slate-300 ml-2">{selectedRequest.category}</span>
                  </div>
                </div>
              </DetailSection>

              {/* Review Notes */}
              {selectedRequest.review_notes && (
                <DetailSection title="Review Notes" icon={CheckCircle}>
                  <p className="text-purple-400 whitespace-pre-wrap">
                    {selectedRequest.review_notes}
                  </p>
                  <p className="text-slate-500 text-xs mt-2">
                    Reviewed: {new Date(selectedRequest.reviewed_at).toLocaleString()}
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
                          {entry.details && <span className="text-slate-500"> - {entry.details}</span>}
                        </span>
                        <span className="text-slate-500">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-4">Update Status</h3>
            <label className="block text-sm text-slate-400 mb-2">New Status:</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full mb-4 bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select status...</option>
              <option value="new">New</option>
              <option value="under-review">Under Review</option>
              <option value="planned">Planned</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="declined">Declined</option>
            </select>
            <label className="block text-sm text-slate-400 mb-2">Review Notes:</label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add notes about this status change (optional)"
              className="w-full h-32 bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={updating || !newStatus}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {updating ? 'Saving...' : 'Update Status'}
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
