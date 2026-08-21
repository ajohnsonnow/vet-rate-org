/**
 * Vet-Rate.org - Feature Request Lookup (Admin Interface)
 * Secure Feature Request Retrieval and Management
 *
 * Admin tool to search, view and manage feature requests.
 * - Searches local IndexedDB storage
 * - Track request status (new, under-review, planned, completed, declined)
 * - Logs all access in audit trail
 *
 * Built by a fellow veteran. "Every idea counts."
 */

import { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";
import {
  Search,
  Lightbulb,
  AlertCircle,
  CheckCircle,
  X,
  Database,
  FileText,
  Monitor,
  RefreshCw,
  Download,
  Trash2,
  History,
  Filter,
  Copy,
  Check,
  Zap,
  MessageSquare,
  Star,
} from "lucide-react";
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
  getFeatureFromLocalStorage,
} from "../utils/featureRequestStorage";

// Priority icons and colors
const PRIORITY_CONFIG = {
  critical: {
    icon: Zap,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-500/20",
    label: "Critical",
  },
  high: {
    icon: Star,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-500/20",
    label: "High",
  },
  medium: {
    icon: Lightbulb,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-100 dark:bg-yellow-500/20",
    label: "Medium",
  },
  low: {
    icon: MessageSquare,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-500/20",
    label: "Low",
  },
};

// Status configuration
const STATUS_CONFIG = {
  new: {
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-500/20",
    label: "New",
  },
  "under-review": {
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-500/20",
    label: "Under Review",
  },
  planned: {
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-500/20",
    label: "Planned",
  },
  "in-progress": {
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-100 dark:bg-cyan-500/20",
    label: "In Progress",
  },
  completed: {
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-500/20",
    label: "Completed",
  },
  declined: {
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-200 dark:bg-slate-500/20",
    label: "Declined",
  },
};

// Render priority badge
const PriorityBadge = ({ priority }) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

// Render status badge
const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.new;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}
    >
      {config.label}
    </span>
  );
};

function FeatureLookupTitleRow({ storageAvailable, onExport, onClose }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
      <div className="flex min-w-0 items-center gap-3">
        <Lightbulb className="h-6 w-6 flex-shrink-0 text-purple-500" />
        <div className="min-w-0">
          <h1
            id="feature-lookup-title"
            className="truncate text-lg font-bold text-gray-900 dark:text-white"
          >
            Feature Requests - Admin Lookup
          </h1>
          <p className="truncate text-xs text-gray-500 dark:text-slate-400">
            Search and manage feature requests
          </p>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {/* Storage Status */}
        <div
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
            storageAvailable
              ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
          }`}
        >
          <Database className="h-3 w-3" />
          {storageAvailable ? "DB Online" : "Fallback Mode"}
        </div>

        <button
          onClick={onExport}
          className="p-2 text-gray-500 transition-colors hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
          aria-label="Export All Requests"
        >
          <Download className="h-5 w-5" />
        </button>

        <button
          onClick={onClose}
          className="p-2 text-gray-500 transition-colors hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function FeatureLookupSearchBar({
  searchQuery,
  setSearchQuery,
  onSearch,
  showFilters,
  setShowFilters,
}) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="Enter Request ID (e.g., FEAT-MKNCUI1I) or search text..."
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white dark:placeholder-slate-400"
        />
      </div>
      <button
        onClick={onSearch}
        className="rounded-lg bg-purple-500 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-600"
      >
        Search
      </button>
      <button
        onClick={() => setShowFilters(!showFilters)}
        className={`rounded-lg p-2 transition-colors ${
          showFilters
            ? "bg-purple-500 text-white"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        }`}
      >
        <Filter className="h-5 w-5" />
      </button>
    </div>
  );
}

function FeatureLookupFilterControls({
  showFilters,
  filters,
  setFilters,
  onApplyFilters,
}) {
  if (!showFilters) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-4 border-t border-gray-200 pt-3 dark:border-slate-700">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-slate-400">
          Status:
        </span>
        <select
          value={filters.status || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value || null }))
          }
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
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
        <span className="text-sm text-gray-600 dark:text-slate-400">
          Priority:
        </span>
        <select
          value={filters.priority || ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              priority: e.target.value || null,
            }))
          }
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <button
        onClick={onApplyFilters}
        className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
      >
        <RefreshCw className="h-4 w-4" />
        Apply Filters
      </button>
    </div>
  );
}

function FeatureLookupHeader({
  storageAvailable,
  onExport,
  onClose,
  searchQuery,
  setSearchQuery,
  onSearch,
  showFilters,
  setShowFilters,
  filters,
  setFilters,
  onApplyFilters,
}) {
  return (
    <>
      {/* Title row */}
      <FeatureLookupTitleRow
        storageAvailable={storageAvailable}
        onExport={onExport}
        onClose={onClose}
      />

      {/* Search Bar */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
        <FeatureLookupSearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={onSearch}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
        />

        {/* Filters */}
        <FeatureLookupFilterControls
          showFilters={showFilters}
          filters={filters}
          setFilters={setFilters}
          onApplyFilters={onApplyFilters}
        />
      </div>
    </>
  );
}

const RequestListLoadingSpinner = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
  </div>
);

const RequestListError = ({ error }) => (
  <div className="p-8 text-center" role="alert" aria-live="polite">
    <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-500" />
    <p className="text-red-600 dark:text-red-400">{error}</p>
  </div>
);

const RequestListEmpty = () => (
  <div className="p-8 text-center">
    <Lightbulb className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-slate-600" />
    <p className="text-gray-600 dark:text-slate-400">
      No feature requests found
    </p>
    <p className="mt-1 text-sm text-gray-500 dark:text-slate-500">
      Requests will appear here when users submit them
    </p>
  </div>
);

const RequestListItems = ({ requests, selectedRequest, onViewRequest }) => (
  <div className="divide-y divide-gray-200 dark:divide-slate-700">
    {requests.map((request) => (
      <button
        key={request.request_id}
        onClick={() => onViewRequest(request)}
        className={`w-full p-4 text-left transition-colors hover:bg-gray-100 dark:hover:bg-slate-700/30 ${
          selectedRequest?.request_id === request.request_id
            ? "bg-gray-100 dark:bg-slate-700/50"
            : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-sm text-purple-600 dark:text-purple-400">
                {request.request_id}
              </span>
              <StatusBadge status={request.status} />
            </div>
            <p className="truncate text-sm text-gray-900 dark:text-white">
              {request.title || "No title"}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <PriorityBadge priority={request.priority} />
              <span className="text-xs text-gray-500 dark:text-slate-500">
                {request.category}
              </span>
            </div>
          </div>
          <div className="whitespace-nowrap text-xs text-gray-500 dark:text-slate-500">
            {new Date(request.created_at).toLocaleDateString()}
          </div>
        </div>
      </button>
    ))}
  </div>
);

function RequestListPanel({
  view,
  loading,
  error,
  requests,
  selectedRequest,
  onViewRequest,
}) {
  let listContent;
  if (loading) {
    listContent = <RequestListLoadingSpinner />;
  } else if (error && requests.length === 0) {
    listContent = <RequestListError error={error} />;
  } else if (requests.length === 0) {
    listContent = <RequestListEmpty />;
  } else {
    listContent = (
      <RequestListItems
        requests={requests}
        selectedRequest={selectedRequest}
        onViewRequest={onViewRequest}
      />
    );
  }

  return (
    <div
      className={
        view === "detail"
          ? "md:w-1/3 md:border-r md:border-gray-200 md:pr-2 dark:md:border-slate-700"
          : "w-full"
      }
    >
      {listContent}
    </div>
  );
}

function RequestDetailHeader({
  selectedRequest,
  copied,
  onCopyRequest,
  onShowStatusModal,
  onDelete,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-mono text-xl font-bold text-purple-600 dark:text-purple-400">
            {selectedRequest.request_id}
          </h2>
          <p className="mt-2 text-lg text-gray-900 dark:text-white">
            {selectedRequest.title}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Created: {new Date(selectedRequest.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          <PriorityBadge priority={selectedRequest.priority} />
          <StatusBadge status={selectedRequest.status} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-slate-700">
        <button
          onClick={onCopyRequest}
          className="flex items-center gap-1 rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-900 transition-colors hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Copied!" : "Copy JSON"}
        </button>
        <button
          onClick={onShowStatusModal}
          className="flex items-center gap-1 rounded bg-purple-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-purple-500"
        >
          <RefreshCw className="h-4 w-4" />
          Update Status
        </button>
        <button
          onClick={() => onDelete(selectedRequest.request_id)}
          className="flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-red-500"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </div>
  );
}

function RequestDetailCoreSections({ selectedRequest }) {
  return (
    <>
      {/* Description */}
      <DetailSection title="Description" icon={FileText}>
        <p className="whitespace-pre-wrap text-gray-700 dark:text-slate-300">
          {selectedRequest.description || "(No description provided)"}
        </p>
      </DetailSection>

      {/* Problem Solved */}
      {selectedRequest.problemSolved && (
        <DetailSection title="Problem This Would Solve" icon={Lightbulb}>
          <p className="whitespace-pre-wrap text-gray-700 dark:text-slate-300">
            {selectedRequest.problemSolved}
          </p>
        </DetailSection>
      )}

      {/* Proposed Solution */}
      {selectedRequest.proposedSolution && (
        <DetailSection title="Proposed Solution" icon={Zap}>
          <p className="whitespace-pre-wrap text-gray-700 dark:text-slate-300">
            {selectedRequest.proposedSolution}
          </p>
        </DetailSection>
      )}

      {/* Additional Context */}
      {selectedRequest.additionalContext && (
        <DetailSection title="Additional Context" icon={MessageSquare}>
          <p className="whitespace-pre-wrap text-gray-700 dark:text-slate-300">
            {selectedRequest.additionalContext}
          </p>
        </DetailSection>
      )}

      {/* Client Environment */}
      <DetailSection title="Client Environment" icon={Monitor}>
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-gray-500 dark:text-slate-500">Browser:</span>
            <span className="ml-2 break-all text-gray-700 dark:text-slate-300">
              {selectedRequest.systemInfo?.browser}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-slate-500">Screen:</span>
            <span className="ml-2 text-gray-700 dark:text-slate-300">
              {selectedRequest.systemInfo?.screenResolution}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-slate-500">Module:</span>
            <span className="ml-2 text-gray-700 dark:text-slate-300">
              {selectedRequest.module}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-slate-500">Category:</span>
            <span className="ml-2 text-gray-700 dark:text-slate-300">
              {selectedRequest.category}
            </span>
          </div>
        </div>
      </DetailSection>
    </>
  );
}

function RequestDetailReviewAndAudit({ selectedRequest, auditLog }) {
  return (
    <>
      {/* Review Notes */}
      {selectedRequest.review_notes && (
        <DetailSection title="Review Notes" icon={CheckCircle}>
          <p className="whitespace-pre-wrap text-purple-700 dark:text-purple-400">
            {selectedRequest.review_notes}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
            Reviewed: {new Date(selectedRequest.reviewed_at).toLocaleString()}
          </p>
        </DetailSection>
      )}

      {/* Audit Log */}
      {auditLog.length > 0 && (
        <DetailSection title="Audit Log" icon={History}>
          <div className="space-y-2">
            {auditLog.map((entry, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-600 dark:text-slate-400">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {entry.action}
                  </span>
                  {" by "}
                  {entry.accessor}
                  {entry.details && (
                    <span className="text-gray-500 dark:text-slate-500">
                      {" "}
                      - {entry.details}
                    </span>
                  )}
                </span>
                <span className="text-gray-500 dark:text-slate-500">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </DetailSection>
      )}
    </>
  );
}

function RequestDetailPanel({
  view,
  selectedRequest,
  copied,
  auditLog,
  onCopyRequest,
  onShowStatusModal,
  onDelete,
}) {
  if (view !== "detail" || !selectedRequest) {
    return null;
  }

  return (
    <div className="min-w-0 flex-1 border-t border-gray-200 pt-4 dark:border-slate-700 md:border-t-0 md:pl-4 md:pt-0">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Request Header */}
        <RequestDetailHeader
          selectedRequest={selectedRequest}
          copied={copied}
          onCopyRequest={onCopyRequest}
          onShowStatusModal={onShowStatusModal}
          onDelete={onDelete}
        />

        <RequestDetailCoreSections selectedRequest={selectedRequest} />

        <RequestDetailReviewAndAudit
          selectedRequest={selectedRequest}
          auditLog={auditLog}
        />
      </div>
    </div>
  );
}

function StatusUpdateModal({
  isOpen,
  onClose,
  newStatus,
  setNewStatus,
  reviewNotes,
  setReviewNotes,
  updating,
  onUpdateStatus,
}) {
  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Status"
      size="sm"
      zIndex={70}
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={onUpdateStatus}
            disabled={updating || !newStatus}
            className="rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
          >
            {updating ? "Saving..." : "Update Status"}
          </button>
        </div>
      }
    >
      <label
        htmlFor="feature-new-status"
        className="mb-2 block text-sm text-gray-600 dark:text-slate-400"
      >
        New Status:
      </label>
      <select
        id="feature-new-status"
        value={newStatus}
        onChange={(e) => setNewStatus(e.target.value)}
        className="mb-4 w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white"
      >
        <option value="">Select status...</option>
        <option value="new">New</option>
        <option value="under-review">Under Review</option>
        <option value="planned">Planned</option>
        <option value="in-progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="declined">Declined</option>
      </select>
      <label
        htmlFor="feature-review-notes"
        className="mb-2 block text-sm text-gray-600 dark:text-slate-400"
      >
        Review Notes:
      </label>
      <textarea
        id="feature-review-notes"
        value={reviewNotes}
        onChange={(e) => setReviewNotes(e.target.value)}
        placeholder="Add notes about this status change (optional)"
        className="h-32 w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white dark:placeholder-slate-400"
      />
    </ResponsiveModal>
  );
}

// Load requests with current filters
async function loadFeatureRequestsList({
  filters,
  setLoading,
  setError,
  setRequests,
}) {
  setLoading(true);
  setError("");

  try {
    const loadedRequests = await getAllFeatureRequests({
      status: filters.status,
      priority: filters.priority,
      limit: 100,
    });
    setRequests(loadedRequests);
  } catch (err) {
    console.error("Failed to load requests:", err);
    setError("Failed to load feature requests");
  }

  setLoading(false);
}

// Load statistics
async function loadFeatureStats({ setStatistics }) {
  try {
    const stats = await getFeatureStatistics();
    setStatistics(stats);
  } catch (err) {
    console.error("Failed to load statistics:", err);
  }
}

function useFeatureLookupState() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requests, setRequests] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("list"); // list, detail
  const [filters, setFilters] = useState({ status: null, priority: null });
  const [showFilters, setShowFilters] = useState(false);
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  return {
    searchQuery,
    setSearchQuery,
    selectedRequest,
    setSelectedRequest,
    requests,
    setRequests,
    statistics,
    setStatistics,
    auditLog,
    setAuditLog,
    loading,
    setLoading,
    error,
    setError,
    view,
    setView,
    filters,
    setFilters,
    showFilters,
    setShowFilters,
    copied,
    setCopied,
    updating,
    setUpdating,
    newStatus,
    setNewStatus,
    reviewNotes,
    setReviewNotes,
    showStatusModal,
    setShowStatusModal,
    storageAvailable,
    setStorageAvailable,
  };
}

function useFeatureLookupInit({
  setStorageAvailable,
  setRequests,
  setLoading,
  loadRequests,
  loadStatistics,
}) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Search by ID or text
async function performFeatureSearch({
  searchQuery,
  setLoading,
  setError,
  setRequests,
  setSelectedRequest,
  setView,
  loadRequests,
}) {
  if (!searchQuery.trim()) {
    await loadRequests();
    return;
  }

  setLoading(true);
  setError("");

  try {
    // First try exact ID match
    const exactMatch = await getFeatureRequest(
      searchQuery.toUpperCase(),
      "admin",
    );

    if (exactMatch) {
      setRequests([exactMatch]);
      setSelectedRequest(exactMatch);
      setView("detail");
    } else {
      // Fall back to text search
      const results = await searchFeatureRequests(searchQuery);
      setRequests(results);

      if (results.length === 0) {
        setError(`No requests found matching "${searchQuery}"`);
      }
    }
  } catch (err) {
    console.error("Search failed:", err);
    setError("Search failed. Please try again.");
  }

  setLoading(false);
}

// View a specific request
async function viewFeatureRequest({
  request,
  setSelectedRequest,
  setView,
  setAuditLog,
}) {
  setSelectedRequest(request);
  setView("detail");

  // Load audit log for this request
  try {
    const log = await getFeatureAuditLog(request.request_id);
    setAuditLog(log);
  } catch (err) {
    console.error("Failed to load audit log:", err);
  }
}

// Update request status
async function updateFeatureStatus({
  selectedRequest,
  newStatus,
  reviewNotes,
  setUpdating,
  setSelectedRequest,
  setShowStatusModal,
  setNewStatus,
  setReviewNotes,
  setError,
  loadRequests,
  loadStatistics,
}) {
  if (!selectedRequest || !newStatus) return;

  setUpdating(true);

  try {
    const updated = await updateFeatureRequestStatus(
      selectedRequest.request_id,
      newStatus,
      reviewNotes,
      "admin",
    );
    setSelectedRequest(updated);
    setShowStatusModal(false);
    setNewStatus("");
    setReviewNotes("");
    await loadRequests();
    await loadStatistics();
  } catch (err) {
    console.error("Failed to update:", err);
    setError("Failed to update status");
  }

  setUpdating(false);
}

// Delete a request
async function deleteFeatureRequestHandler({
  requestId,
  setSelectedRequest,
  setView,
  setError,
  loadRequests,
  loadStatistics,
}) {
  if (
    !window.confirm(
      "Are you sure you want to delete this feature request? This cannot be undone.",
    )
  ) {
    return;
  }

  try {
    await deleteFeatureRequest(requestId, "admin");
    setSelectedRequest(null);
    setView("list");
    await loadRequests();
    await loadStatistics();
  } catch (err) {
    console.error("Failed to delete:", err);
    setError("Failed to delete request");
  }
}

// Export all requests
async function exportFeatureRequestsHandler({ setError }) {
  try {
    const exportData = await exportFeatureRequests();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vetrate-feature-requests-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Export failed:", err);
    setError("Failed to export requests");
  }
}

// Copy request to clipboard
async function copyFeatureRequestToClipboard({ selectedRequest, setCopied }) {
  if (!selectedRequest) return;

  const requestText = JSON.stringify(selectedRequest, null, 2);
  await navigator.clipboard.writeText(requestText);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}

function createFeatureLookupHandlers({
  filters,
  searchQuery,
  selectedRequest,
  newStatus,
  reviewNotes,
  setLoading,
  setError,
  setRequests,
  setStatistics,
  setSelectedRequest,
  setView,
  setAuditLog,
  setUpdating,
  setShowStatusModal,
  setNewStatus,
  setReviewNotes,
  setCopied,
}) {
  const loadRequests = () =>
    loadFeatureRequestsList({ filters, setLoading, setError, setRequests });
  const loadStatistics = () => loadFeatureStats({ setStatistics });

  const handleSearch = () =>
    performFeatureSearch({
      searchQuery,
      setLoading,
      setError,
      setRequests,
      setSelectedRequest,
      setView,
      loadRequests,
    });

  const handleViewRequest = (request) =>
    viewFeatureRequest({ request, setSelectedRequest, setView, setAuditLog });

  const handleUpdateStatus = () =>
    updateFeatureStatus({
      selectedRequest,
      newStatus,
      reviewNotes,
      setUpdating,
      setSelectedRequest,
      setShowStatusModal,
      setNewStatus,
      setReviewNotes,
      setError,
      loadRequests,
      loadStatistics,
    });

  const handleDelete = (requestId) =>
    deleteFeatureRequestHandler({
      requestId,
      setSelectedRequest,
      setView,
      setError,
      loadRequests,
      loadStatistics,
    });

  const handleExport = () => exportFeatureRequestsHandler({ setError });

  const handleCopyRequest = () =>
    copyFeatureRequestToClipboard({ selectedRequest, setCopied });

  return {
    loadRequests,
    loadStatistics,
    handleSearch,
    handleViewRequest,
    handleUpdateStatus,
    handleDelete,
    handleExport,
    handleCopyRequest,
  };
}

function FeatureLookupMainModal({
  onClose,
  storageAvailable,
  handleExport,
  searchQuery,
  setSearchQuery,
  handleSearch,
  showFilters,
  setShowFilters,
  filters,
  setFilters,
  loadRequests,
  statistics,
  view,
  loading,
  error,
  requests,
  selectedRequest,
  handleViewRequest,
  copied,
  auditLog,
  handleCopyRequest,
  setShowStatusModal,
  handleDelete,
}) {
  const header = (
    <FeatureLookupHeader
      storageAvailable={storageAvailable}
      onExport={handleExport}
      onClose={onClose}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      onSearch={handleSearch}
      showFilters={showFilters}
      setShowFilters={setShowFilters}
      filters={filters}
      setFilters={setFilters}
      onApplyFilters={loadRequests}
    />
  );

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      header={header}
      labelledBy="feature-lookup-title"
      size="full"
    >
      {/* Stats Bar */}
      <FeatureLookupStatsBar statistics={statistics} />

      {/* Main Content */}
      <div className="flex flex-col md:flex-row">
        <RequestListPanel
          view={view}
          loading={loading}
          error={error}
          requests={requests}
          selectedRequest={selectedRequest}
          onViewRequest={handleViewRequest}
        />

        <RequestDetailPanel
          view={view}
          selectedRequest={selectedRequest}
          copied={copied}
          auditLog={auditLog}
          onCopyRequest={handleCopyRequest}
          onShowStatusModal={() => setShowStatusModal(true)}
          onDelete={handleDelete}
        />
      </div>
    </ResponsiveModal>
  );
}

function FeatureLookupModals({
  onClose,
  storageAvailable,
  handleExport,
  searchQuery,
  setSearchQuery,
  handleSearch,
  showFilters,
  setShowFilters,
  filters,
  setFilters,
  loadRequests,
  statistics,
  view,
  loading,
  error,
  requests,
  selectedRequest,
  handleViewRequest,
  copied,
  auditLog,
  handleCopyRequest,
  setShowStatusModal,
  handleDelete,
  showStatusModal,
  newStatus,
  setNewStatus,
  reviewNotes,
  setReviewNotes,
  updating,
  handleUpdateStatus,
}) {
  return (
    <>
      <FeatureLookupMainModal
        onClose={onClose}
        storageAvailable={storageAvailable}
        handleExport={handleExport}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearch={handleSearch}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        filters={filters}
        setFilters={setFilters}
        loadRequests={loadRequests}
        statistics={statistics}
        view={view}
        loading={loading}
        error={error}
        requests={requests}
        selectedRequest={selectedRequest}
        handleViewRequest={handleViewRequest}
        copied={copied}
        auditLog={auditLog}
        handleCopyRequest={handleCopyRequest}
        setShowStatusModal={setShowStatusModal}
        handleDelete={handleDelete}
      />

      {/* Status Update Modal */}
      <StatusUpdateModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        newStatus={newStatus}
        setNewStatus={setNewStatus}
        reviewNotes={reviewNotes}
        setReviewNotes={setReviewNotes}
        updating={updating}
        onUpdateStatus={handleUpdateStatus}
      />
    </>
  );
}

const FeatureLookupStatsBar = ({ statistics }) => {
  if (!statistics) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/30">
      <span className="text-gray-600 dark:text-slate-400">
        Total:{" "}
        <span className="font-medium text-gray-900 dark:text-white">
          {statistics.total}
        </span>
      </span>
      <span className="text-gray-600 dark:text-slate-400">
        New:{" "}
        <span className="font-medium text-blue-600 dark:text-blue-400">
          {statistics.byStatus.new}
        </span>
      </span>
      <span className="text-gray-600 dark:text-slate-400">
        Planned:{" "}
        <span className="font-medium text-amber-600 dark:text-amber-400">
          {statistics.byStatus.planned}
        </span>
      </span>
      <span className="text-gray-600 dark:text-slate-400">
        Critical:{" "}
        <span className="font-medium text-red-600 dark:text-red-400">
          {statistics.byPriority.critical}
        </span>
      </span>
    </div>
  );
};

// createFeatureLookupHandlers and useFeatureLookupInit each destructure only
// the specific keys they need, so passing the full formState/handlers
// objects through (instead of re-listing every field at each call site) is
// behaviorally identical to the previous explicit destructure-and-relist.
function useFeatureLookupPage() {
  useLanguage();

  const formState = useFeatureLookupState();
  const handlers = createFeatureLookupHandlers(formState);

  useFeatureLookupInit({ ...formState, ...handlers });

  return { ...formState, ...handlers };
}

export default function FeatureLookup({ onClose }) {
  const {
    searchQuery,
    setSearchQuery,
    selectedRequest,
    requests,
    statistics,
    auditLog,
    loading,
    error,
    view,
    filters,
    setFilters,
    showFilters,
    setShowFilters,
    copied,
    updating,
    newStatus,
    setNewStatus,
    reviewNotes,
    setReviewNotes,
    showStatusModal,
    setShowStatusModal,
    storageAvailable,
    loadRequests,
    handleSearch,
    handleViewRequest,
    handleUpdateStatus,
    handleDelete,
    handleExport,
    handleCopyRequest,
  } = useFeatureLookupPage();

  return (
    <FeatureLookupModals
      onClose={onClose}
      storageAvailable={storageAvailable}
      handleExport={handleExport}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      handleSearch={handleSearch}
      showFilters={showFilters}
      setShowFilters={setShowFilters}
      filters={filters}
      setFilters={setFilters}
      loadRequests={loadRequests}
      statistics={statistics}
      view={view}
      loading={loading}
      error={error}
      requests={requests}
      selectedRequest={selectedRequest}
      handleViewRequest={handleViewRequest}
      copied={copied}
      auditLog={auditLog}
      handleCopyRequest={handleCopyRequest}
      setShowStatusModal={setShowStatusModal}
      handleDelete={handleDelete}
      showStatusModal={showStatusModal}
      newStatus={newStatus}
      setNewStatus={setNewStatus}
      reviewNotes={reviewNotes}
      setReviewNotes={setReviewNotes}
      updating={updating}
      handleUpdateStatus={handleUpdateStatus}
    />
  );
}

// Helper component for detail sections
const DetailSection = ({ title, icon: Icon, children }) => (
  <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800/50">
    <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-100 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50">
      <Icon className="h-4 w-4 text-gray-500 dark:text-slate-400" />
      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
        {title}
      </h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);
