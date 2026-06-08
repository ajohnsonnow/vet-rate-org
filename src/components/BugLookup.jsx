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

import { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";
import {
  Search,
  Bug,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle,
  X,
  Database,
  FileText,
  Monitor,
  RefreshCw,
  Download,
  Trash2,
  History,
  Shield,
  Filter,
  Copy,
  Check,
} from "lucide-react";
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
  getFromLocalStorage,
} from "../utils/bugReportStorage";

// Severity icons and colors - labels will be translated in component
const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-500/20",
    labelKey: "severityCritical",
  },
  high: {
    icon: AlertCircle,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-500/20",
    labelKey: "severityHigh",
  },
  medium: {
    icon: Clock,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-100 dark:bg-yellow-500/20",
    labelKey: "severityMedium",
  },
  low: {
    icon: CheckCircle,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-500/20",
    labelKey: "severityLow",
  },
};

export default function BugLookup({ onClose }) {
  const { t } = useLanguage();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [reports, setReports] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("list"); // list, detail, audit
  const [filters, setFilters] = useState({ resolved: null, severity: null });
  const [showFilters, setShowFilters] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load reports with current filters
  const loadReports = async () => {
    setLoading(true);
    setError("");

    try {
      const loadedReports = await getAllBugReports({
        resolved: filters.resolved,
        severity: filters.severity,
        limit: 100,
      });
      setReports(loadedReports);
    } catch (err) {
      console.error("Failed to load reports:", err);
      setError(t("bugLookup", "errorLoadReports"));
    }

    setLoading(false);
  };

  // Load statistics
  const loadStatistics = async () => {
    try {
      const stats = await getBugStatistics();
      setStatistics(stats);
    } catch (err) {
      console.error("Failed to load statistics:", err);
    }
  };

  // Search by ID or text
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      await loadReports();
      return;
    }

    setLoading(true);
    setError("");

    try {
      // First try exact ID match
      const exactMatch = await getBugReport(searchQuery.toUpperCase(), "admin");

      if (exactMatch) {
        setReports([exactMatch]);
        setSelectedReport(exactMatch);
        setView("detail");
      } else {
        // Fall back to text search
        const results = await searchBugReports(searchQuery);
        setReports(results);

        if (results.length === 0) {
          setError(`${t("bugLookup", "noReportsMatching")} "${searchQuery}"`);
        }
      }
    } catch (err) {
      console.error("Search failed:", err);
      setError(t("bugLookup", "errorSearchFailed"));
    }

    setLoading(false);
  };

  // View a specific report
  const handleViewReport = async (report) => {
    setSelectedReport(report);
    setView("detail");

    // Load audit log for this report
    try {
      const log = await getAuditLog(report.report_id);
      setAuditLog(log);
    } catch (err) {
      console.error("Failed to load audit log:", err);
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
        "admin",
      );
      setSelectedReport(updated);
      setShowResolveModal(false);
      setResolutionNotes("");
      await loadReports();
      await loadStatistics();
    } catch (err) {
      console.error("Failed to resolve:", err);
      setError(t("bugLookup", "errorResolve"));
    }

    setResolving(false);
  };

  // Delete a report
  const handleDelete = async (reportId) => {
    if (!window.confirm(t("bugLookup", "confirmDelete"))) {
      return;
    }

    try {
      await deleteBugReport(reportId, "admin");
      setSelectedReport(null);
      setView("list");
      await loadReports();
      await loadStatistics();
    } catch (err) {
      console.error("Failed to delete:", err);
      setError(t("bugLookup", "errorDelete"));
    }
  };

  // Export all reports
  const handleExport = async () => {
    try {
      const exportData = await exportBugReports();
      const blob = new Blob([exportData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vetrate-bug-reports-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      setError(t("bugLookup", "errorExport"));
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
      <span
        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
      >
        <Icon className="h-3 w-3" />
        {t("bugLookup", config.labelKey)}
      </span>
    );
  };

  const header = (
    <>
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
        <div className="flex items-center gap-3">
          <Bug className="h-6 w-6 text-amber-500" />
          <div>
            <h1
              id="bug-lookup-title"
              className="text-lg font-bold text-gray-900 dark:text-white"
            >
              {t("bugLookup", "title")}
            </h1>
            <p className="text-xs text-gray-600 dark:text-slate-400">
              {t("bugLookup", "subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Storage Status */}
          <div
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              storageAvailable
                ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
            }`}
          >
            <Database className="h-3 w-3" />
            {storageAvailable
              ? t("bugLookup", "dbOnline")
              : t("bugLookup", "fallbackMode")}
          </div>

          <button
            onClick={handleExport}
            className="p-2 text-gray-500 transition-colors hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
            aria-label={t("bugLookup", "exportAllReports")}
          >
            <Download className="h-5 w-5" />
          </button>

          <button
            onClick={onClose}
            className="p-2 text-gray-500 transition-colors hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
            aria-label={t("common", "close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={t("bugLookup", "searchPlaceholder")}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white dark:placeholder-slate-400"
            />
          </div>
          <button
            onClick={handleSearch}
            className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-slate-900 transition-colors hover:bg-amber-600"
          >
            {t("common", "search")}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`rounded-lg p-2 transition-colors ${
              showFilters
                ? "bg-amber-500 text-slate-900"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            }`}
          >
            <Filter className="h-5 w-5" />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-4 border-t border-gray-200 pt-3 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-slate-400">
                {t("bugLookup", "filterStatus")}:
              </span>
              <select
                value={
                  filters.resolved === null ? "" : filters.resolved.toString()
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters((f) => ({
                    ...f,
                    resolved: val === "" ? null : val === "true",
                  }));
                }}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                <option value="">{t("common", "all")}</option>
                <option value="false">
                  {t("bugLookup", "statusUnresolved")}
                </option>
                <option value="true">{t("bugLookup", "statusResolved")}</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-slate-400">
                {t("bugLookup", "filterSeverity")}:
              </span>
              <select
                value={filters.severity || ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    severity: e.target.value || null,
                  }))
                }
                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                <option value="">{t("common", "all")}</option>
                <option value="critical">
                  {t("bugLookup", "severityCritical")}
                </option>
                <option value="high">{t("bugLookup", "severityHigh")}</option>
                <option value="medium">
                  {t("bugLookup", "severityMedium")}
                </option>
                <option value="low">{t("bugLookup", "severityLow")}</option>
              </select>
            </div>
            <button
              onClick={loadReports}
              className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            >
              <RefreshCw className="h-4 w-4" />
              {t("bugLookup", "applyFilters")}
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={onClose}
        header={header}
        labelledBy="bug-lookup-title"
        size="full"
      >
        {/* Stats Bar */}
        {statistics && (
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/30">
            <span className="text-gray-600 dark:text-slate-400">
              {t("bugLookup", "statsTotal")}:{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {statistics.total}
              </span>
            </span>
            <span className="text-gray-600 dark:text-slate-400">
              {t("bugLookup", "statsUnresolved")}:{" "}
              <span className="font-medium text-red-600 dark:text-red-400">
                {statistics.unresolved}
              </span>
            </span>
            <span className="text-gray-600 dark:text-slate-400">
              {t("bugLookup", "statsCritical")}:{" "}
              <span className="font-medium text-red-600 dark:text-red-500">
                {statistics.bySeverity.critical}
              </span>
            </span>
            <span className="text-gray-600 dark:text-slate-400">
              {t("bugLookup", "statsLast24h")}:{" "}
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {statistics.last24Hours}
              </span>
            </span>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-col md:flex-row">
          {/* Report List */}
          <div
            className={
              view === "detail"
                ? "md:w-1/3 md:border-r md:border-gray-200 md:pr-2 dark:md:border-slate-700"
                : "w-full"
            }
          >
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              </div>
            ) : error && reports.length === 0 ? (
              <div className="p-8 text-center" role="alert" aria-live="polite">
                <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-500" />
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center">
                <Bug className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-slate-600" />
                <p className="text-gray-600 dark:text-slate-400">
                  {t("bugLookup", "noReportsFound")}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-500">
                  {t("bugLookup", "reportsWillAppear")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-slate-700">
                {reports.map((report) => (
                  <button
                    key={report.report_id}
                    onClick={() => handleViewReport(report)}
                    className={`w-full p-4 text-left transition-colors hover:bg-gray-100 dark:hover:bg-slate-700/30 ${
                      selectedReport?.report_id === report.report_id
                        ? "bg-gray-100 dark:bg-slate-700/50"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="font-mono text-sm text-amber-600 dark:text-amber-400">
                            {report.report_id}
                          </span>
                          {report.resolved && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        <p className="truncate text-sm text-gray-900 dark:text-white">
                          {report.user_description ||
                            report.error_message ||
                            t("bugLookup", "noDescription")}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <SeverityBadge severity={report.severity} />
                          <span className="text-xs text-gray-500 dark:text-slate-500">
                            {report.module}
                          </span>
                        </div>
                      </div>
                      <div className="whitespace-nowrap text-xs text-gray-500 dark:text-slate-500">
                        {new Date(report.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Report Detail */}
          {view === "detail" && selectedReport && (
            <div className="min-w-0 flex-1 border-t border-gray-200 pt-4 dark:border-slate-700 md:border-t-0 md:pl-4 md:pt-0">
              <div className="mx-auto max-w-3xl space-y-4">
                {/* Report Header */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-mono text-xl font-bold text-amber-600 dark:text-amber-400">
                        {selectedReport.report_id}
                      </h2>
                      <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                        {t("bugLookup", "created")}:{" "}
                        {new Date(selectedReport.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={selectedReport.severity} />
                      {selectedReport.resolved ? (
                        <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/20 dark:text-green-400">
                          <CheckCircle className="h-3 w-3" />
                          {t("bugLookup", "statusResolved")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/20 dark:text-red-400">
                          {t("bugLookup", "statusOpen")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 flex gap-2 border-t border-gray-200 pt-4 dark:border-slate-700">
                    <button
                      onClick={handleCopyReport}
                      className="flex items-center gap-1 rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-900 transition-colors hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied
                        ? t("bugLookup", "copied")
                        : t("bugLookup", "copyJson")}
                    </button>
                    {!selectedReport.resolved && (
                      <button
                        onClick={() => setShowResolveModal(true)}
                        className="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-green-500"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {t("bugLookup", "markResolved")}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(selectedReport.report_id)}
                      className="flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("common", "delete")}
                    </button>
                  </div>
                </div>

                {/* Description */}
                <DetailSection
                  title={t("bugLookup", "sectionUserDescription")}
                  icon={FileText}
                >
                  <p className="whitespace-pre-wrap text-gray-700 dark:text-slate-300">
                    {selectedReport.user_description ||
                      t("bugLookup", "noDescriptionProvided")}
                  </p>
                </DetailSection>

                {/* Error Info */}
                {selectedReport.error_message && (
                  <DetailSection
                    title={t("bugLookup", "sectionErrorMessage")}
                    icon={AlertTriangle}
                  >
                    <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-sm text-red-600 dark:bg-slate-900/50 dark:text-red-400">
                      {selectedReport.error_message}
                    </pre>
                  </DetailSection>
                )}

                {/* Stack Trace */}
                {selectedReport.stack_trace && (
                  <DetailSection
                    title={t("bugLookup", "sectionStackTrace")}
                    icon={AlertCircle}
                  >
                    <pre className="max-h-48 overflow-x-auto rounded bg-gray-100 p-3 text-xs text-gray-600 dark:bg-slate-900/50 dark:text-slate-400">
                      {selectedReport.stack_trace}
                    </pre>
                  </DetailSection>
                )}

                {/* Steps to Reproduce */}
                {selectedReport.steps_to_reproduce && (
                  <DetailSection
                    title={t("bugLookup", "sectionStepsToReproduce")}
                    icon={RefreshCw}
                  >
                    <p className="whitespace-pre-wrap text-gray-700 dark:text-slate-300">
                      {selectedReport.steps_to_reproduce}
                    </p>
                  </DetailSection>
                )}

                {/* Client Metadata */}
                <DetailSection
                  title={t("bugLookup", "sectionClientEnvironment")}
                  icon={Monitor}
                >
                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">
                        {t("bugLookup", "envBrowser")}:
                      </span>
                      <span className="ml-2 break-all text-gray-700 dark:text-slate-300">
                        {selectedReport.client_metadata?.browser}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">
                        {t("bugLookup", "envOS")}:
                      </span>
                      <span className="ml-2 text-gray-700 dark:text-slate-300">
                        {selectedReport.client_metadata?.os}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">
                        {t("bugLookup", "envScreen")}:
                      </span>
                      <span className="ml-2 text-gray-700 dark:text-slate-300">
                        {selectedReport.client_metadata?.screen_resolution}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-slate-500">
                        {t("bugLookup", "envWindow")}:
                      </span>
                      <span className="ml-2 text-gray-700 dark:text-slate-300">
                        {selectedReport.client_metadata?.window_size}
                      </span>
                    </div>
                  </div>
                </DetailSection>

                {/* Resolution Notes */}
                {selectedReport.resolved && selectedReport.resolution_notes && (
                  <DetailSection
                    title={t("bugLookup", "sectionResolutionNotes")}
                    icon={CheckCircle}
                  >
                    <p className="whitespace-pre-wrap text-green-700 dark:text-green-400">
                      {selectedReport.resolution_notes}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
                      {t("bugLookup", "statusResolved")}:{" "}
                      {new Date(selectedReport.resolved_at).toLocaleString()}
                    </p>
                  </DetailSection>
                )}

                {/* Audit Log */}
                {auditLog.length > 0 && (
                  <DetailSection
                    title={t("bugLookup", "sectionAuditLog")}
                    icon={History}
                  >
                    <div className="space-y-2">
                      {auditLog.map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-gray-600 dark:text-slate-400">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {entry.action}
                            </span>{" "}
                            {t("bugLookup", "auditBy")} {entry.accessor}
                          </span>
                          <span className="text-gray-500 dark:text-slate-500">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </DetailSection>
                )}

                {/* Sanitization Notice */}
                <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-500/30 dark:bg-green-900/20">
                  <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      {t("bugLookup", "privacyProtected")}
                    </p>
                    <p className="mt-1 text-xs text-green-600 dark:text-green-300/70">
                      {t("bugLookup", "privacyMessage")}
                    </p>
                    <p className="mt-1 text-xs text-green-500 dark:text-green-400/50">
                      {t("bugLookup", "sanitized")}:{" "}
                      {selectedReport._sanitization?.sanitizedAt}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ResponsiveModal>

      {/* Resolve Modal */}
      <ResponsiveModal
        isOpen={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        title={t("bugLookup", "markAsResolved")}
        size="sm"
        zIndex={70}
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowResolveModal(false)}
              className="px-4 py-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
            >
              {t("common", "cancel")}
            </button>
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-500 disabled:opacity-50"
            >
              {resolving
                ? t("bugLookup", "saving")
                : t("bugLookup", "markResolved")}
            </button>
          </div>
        }
      >
        <label className="mb-2 block text-sm text-gray-600 dark:text-slate-400">
          {t("bugLookup", "resolutionNotesLabel")}:
        </label>
        <textarea
          value={resolutionNotes}
          onChange={(e) => setResolutionNotes(e.target.value)}
          placeholder={t("bugLookup", "resolutionNotesPlaceholder")}
          className="h-32 w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white dark:placeholder-slate-400"
        />
      </ResponsiveModal>
    </>
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
