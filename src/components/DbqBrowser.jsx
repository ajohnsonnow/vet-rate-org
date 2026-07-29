/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * DbqBrowser Component
 * "DBQ Library" - Browse, search, and manage offline DBQ forms
 * Features:
 * - Search and filter DBQs by category/condition
 * - Download individual or all DBQs for offline access
 * - Pre-fill subjective information for doctor visits
 * - Secure sharing with doctors
 */

import { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";
import {
  isDbqCached,
  downloadAndCacheDbq,
  downloadAllDbqs,
  removeFromCache,
  getCacheStats,
  clearDbqCache,
  openDbqInBrowser,
  exportCachedDbqsAsZip,
} from "../utils/dbqOfflineStorage";
import { getSubjectiveQuestions } from "../utils/pdfDbqFiller";
import DbqShareMenu from "./DbqShareMenu";
import BuyMeCoffee from "./BuyMeCoffee";

// Category icons for visual organization
const CATEGORY_ICONS = {
  "Mental Health": "🧠",
  Musculoskeletal: "🦴",
  Neurological: "⚡",
  Respiratory: "🫁",
  Cardiovascular: "❤️",
  Digestive: "🍽️",
  "Hearing/Vision": "👁️",
  Skin: "🩹",
  Endocrine: "⚗️",
  Genitourinary: "💧",
  Gynecological: "🩺",
  Hematologic: "🩸",
  "Infectious Disease": "🦠",
  "Dental/Oral": "🦷",
  General: "📋",
};

const STATUS_BANNER_CLASSES = {
  success:
    "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  error: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
};
const DEFAULT_STATUS_BANNER_CLASSES =
  "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200";

/**
 * Load the DBQ index file
 */
async function loadDbqFormsIndex() {
  // Fetch the index
  const response = await fetch("/forms/dbq-index.json");
  if (!response.ok) throw new Error("Could not load DBQ index");

  const index = await response.json();
  const forms = index.forms || [];

  // Extract unique categories
  const categories = [
    "All",
    ...new Set(forms.map((f) => f.category || "General")),
  ];

  return { forms, categories };
}

/**
 * Update cache status for all forms
 */
async function computeCachedStatus(forms) {
  const status = {};
  for (const form of forms) {
    status[form.id] = await isDbqCached(form.id);
  }
  return status;
}

/**
 * Filter forms based on search and category
 */
function filterDbqForms(forms, selectedCategory, searchQuery) {
  let filtered = [...forms];

  // Filter by category
  if (selectedCategory !== "All") {
    filtered = filtered.filter((f) => f.category === selectedCategory);
  }

  // Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (f) =>
        f.title.toLowerCase().includes(query) ||
        f.id.toLowerCase().includes(query) ||
        (f.category && f.category.toLowerCase().includes(query)),
    );
  }

  return filtered;
}

/**
 * Download a single DBQ for offline access
 */
async function downloadOneForm(form, deps) {
  const {
    setStatus,
    setCachedStatus,
    setCacheStats,
    setCoffeeContext,
    setShowBuyMeCoffee,
  } = deps;
  setStatus({ type: "info", message: `Downloading ${form.title}...` });

  const result = await downloadAndCacheDbq(form);

  if (result.success) {
    setCachedStatus((prev) => ({ ...prev, [form.id]: true }));
    const stats = await getCacheStats();
    setCacheStats(stats);
    setStatus({
      type: "success",
      message: `✅ ${form.title} saved for offline use!`,
    });

    // Show BuyMeCoffee after successful download
    setCoffeeContext({ action: "download", formName: form.title });
    setShowBuyMeCoffee(true);
  } else {
    setStatus({
      type: "error",
      message: `❌ Failed to download: ${result.error}`,
    });
  }
}

/**
 * Download ALL DBQs for offline access
 */
async function downloadAllForms(dbqForms, deps) {
  const {
    setStatus,
    setCachedStatus,
    setCacheStats,
    setCoffeeContext,
    setShowBuyMeCoffee,
    setDownloadProgress,
  } = deps;
  setDownloadProgress({ current: 0, total: dbqForms.length, percent: 0 });
  setStatus({ type: "info", message: "Starting bulk download..." });

  const result = await downloadAllDbqs((progress) => {
    setDownloadProgress(progress);
  });

  setDownloadProgress(null);

  if (result.success) {
    setCachedStatus(await computeCachedStatus(dbqForms));
    const stats = await getCacheStats();
    setCacheStats(stats);
    setStatus({
      type: "success",
      message: `✅ Downloaded ${result.downloaded} forms (${result.skipped} already cached)`,
    });

    // Show BuyMeCoffee after bulk download
    if (result.downloaded > 0) {
      setCoffeeContext({ action: "bulk-download", count: result.downloaded });
      setShowBuyMeCoffee(true);
    }
  } else {
    setStatus({
      type: "error",
      message: `❌ Some downloads failed: ${result.failed.length} errors`,
    });
  }
}

/**
 * Remove a form from offline cache
 */
async function removeCachedForm(form, deps) {
  const { setStatus, setCachedStatus, setCacheStats } = deps;
  const result = await removeFromCache(form.id);

  if (result) {
    setCachedStatus((prev) => ({ ...prev, [form.id]: false }));
    const stats = await getCacheStats();
    setCacheStats(stats);
    setStatus({
      type: "info",
      message: `Removed ${form.title} from offline storage`,
    });
  }
}

/**
 * Clear all cached DBQs
 */
async function clearAllCachedForms(dbqForms, deps) {
  const { setStatus, setCachedStatus, setCacheStats } = deps;
  if (!window.confirm("Remove all downloaded DBQs from offline storage?"))
    return;

  await clearDbqCache();
  setCachedStatus(await computeCachedStatus(dbqForms));
  const stats = await getCacheStats();
  setCacheStats(stats);
  setStatus({ type: "info", message: "All cached DBQs removed" });
}

/**
 * Export cached DBQs as ZIP for backup
 */
async function exportCacheZip(deps) {
  const { setStatus } = deps;
  setStatus({ type: "info", message: "Creating backup ZIP..." });

  const zipBlob = await exportCachedDbqsAsZip();

  if (zipBlob) {
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vet-rate-dbq-backup-${new Date().toISOString().split("T")[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus({ type: "success", message: "✅ DBQ backup downloaded!" });
  } else {
    setStatus({ type: "error", message: "❌ Failed to create backup" });
  }
}

/**
 * Open a DBQ in the browser
 */
async function viewDbqForm(form, deps) {
  const { setStatus } = deps;
  setStatus({ type: "info", message: "Opening DBQ..." });

  const result = await openDbqInBrowser(form.id, form.path);

  if (result.success) {
    setStatus({
      type: "success",
      message: result.fromCache
        ? "Opened from offline storage"
        : "Opened from server",
    });
  } else {
    setStatus({ type: "error", message: `❌ ${result.error}` });
  }
}

/**
 * Manages the DBQ index, cache status, and search/category filtering
 */
function useDbqIndexAndFilter() {
  // State
  const [dbqForms, setDbqForms] = useState([]);
  const [filteredForms, setFilteredForms] = useState([]);
  const [cachedStatus, setCachedStatus] = useState({});
  const [cacheStats, setCacheStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [categories, setCategories] = useState(["All"]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState(null);

  // Load DBQ index on mount
  useEffect(() => {
    loadDbqIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter forms when search/category changes
  useEffect(() => {
    filterForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCategory, dbqForms]);

  /**
   * Load the DBQ index file
   */
  const loadDbqIndex = async () => {
    try {
      setIsLoading(true);

      const { forms, categories: loadedCategories } = await loadDbqFormsIndex();
      setDbqForms(forms);
      setCategories(loadedCategories);

      // Check cache status for each form
      setCachedStatus(await computeCachedStatus(forms));

      // Get cache stats
      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error("Error loading DBQ index:", error);
      setStatus({ type: "error", message: "Failed to load DBQ forms list" });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Filter forms based on search and category
   */
  const filterForms = () => {
    setFilteredForms(filterDbqForms(dbqForms, selectedCategory, searchQuery));
  };

  return {
    dbqForms,
    filteredForms,
    cachedStatus,
    setCachedStatus,
    cacheStats,
    setCacheStats,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    categories,
    isLoading,
    status,
    setStatus,
  };
}

/**
 * Manages download/cache action handlers and bulk-download progress
 */
function useDbqCacheActions(dbqForms, coffeeDeps) {
  const [downloadProgress, setDownloadProgress] = useState(null);
  const deps = { ...coffeeDeps, setDownloadProgress };

  const handleDownloadOne = (form) => downloadOneForm(form, deps);
  const handleDownloadAll = () => downloadAllForms(dbqForms, deps);
  const handleRemoveFromCache = (form) => removeCachedForm(form, deps);
  const handleClearCache = () => clearAllCachedForms(dbqForms, deps);
  const handleExportZip = () => exportCacheZip(deps);
  const handleViewDbq = (form) => viewDbqForm(form, deps);

  return {
    downloadProgress,
    handleDownloadOne,
    handleDownloadAll,
    handleRemoveFromCache,
    handleClearCache,
    handleExportZip,
    handleViewDbq,
  };
}

/**
 * Manages the pre-fill -> share flow (selected form, modals, pre-filled data)
 */
function useDbqPreFillFlow(setCoffeeContext, setShowBuyMeCoffee) {
  const [selectedForm, setSelectedForm] = useState(null);
  const [showPreFillModal, setShowPreFillModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [preFilledData, setPreFilledData] = useState({});

  /**
   * Open pre-fill modal for a form
   */
  const handlePreFill = (form) => {
    setSelectedForm(form);
    setPreFilledData({});
    setShowPreFillModal(true);
  };

  /**
   * Handle pre-fill form submission -> show share menu
   */
  const handlePreFillComplete = () => {
    setShowPreFillModal(false);
    setShowShareMenu(true);

    // Show BuyMeCoffee after pre-fill (valuable action)
    setCoffeeContext({ action: "pre-fill", formName: selectedForm?.title });
    setShowBuyMeCoffee(true);
  };

  /**
   * Handle share menu close
   */
  const handleShareMenuClose = () => {
    setShowShareMenu(false);
    // Already showed BuyMeCoffee on pre-fill complete
  };

  return {
    selectedForm,
    showPreFillModal,
    setShowPreFillModal,
    showShareMenu,
    preFilledData,
    setPreFilledData,
    handlePreFill,
    handlePreFillComplete,
    handleShareMenuClose,
  };
}

function DbqBrowserHeader({ onClose, cacheStats, totalForms }) {
  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
      <div className="flex justify-between items-start">
        <div>
          <h2
            id="dbq-library-title"
            className="text-2xl font-bold flex items-center gap-2"
          >
            📋 DBQ Library{" "}
            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
              BETA
            </span>
          </h2>
          <p className="text-indigo-100 mt-1">
            Browse, download, and pre-fill Disability Benefits Questionnaires
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white text-2xl font-bold"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Cache Stats */}
      {cacheStats && (
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span className="bg-white/20 rounded-full px-3 py-1">
            💾 {cacheStats.cachedCount}/{totalForms} forms saved offline
          </span>
          <span className="bg-white/20 rounded-full px-3 py-1">
            📦 {cacheStats.totalSizeMB} MB used
          </span>
        </div>
      )}
    </div>
  );
}

function StatusBanner({ status, onDismiss }) {
  if (!status) return null;

  const classes =
    STATUS_BANNER_CLASSES[status.type] || DEFAULT_STATUS_BANNER_CLASSES;

  return (
    <div className={`px-6 py-3 ${classes}`}>
      <div className="flex justify-between items-center">
        <span>{status.message}</span>
        <button
          onClick={onDismiss}
          className="text-current opacity-60 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function DownloadProgressBar({ progress }) {
  if (!progress) return null;

  return (
    <div className="px-6 py-3 bg-indigo-50 dark:bg-indigo-900/20">
      <div className="flex justify-between text-sm text-indigo-700 dark:text-indigo-300 mb-1">
        <span>Downloading: {progress.currentForm}</span>
        <span>
          {progress.current}/{progress.total}
        </span>
      </div>
      <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}

function SearchFilterBar({ index, cacheActions }) {
  const {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    categories,
    dbqForms,
    cacheStats,
  } = index;
  const {
    downloadProgress,
    handleDownloadAll,
    handleExportZip,
    handleClearCache,
  } = cacheActions;

  return (
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by condition or form name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_ICONS[cat] || ""} {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Actions */}
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={handleDownloadAll}
          disabled={downloadProgress !== null}
          className="text-xs px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white transition-colors"
        >
          ⬇️ Download All ({dbqForms.length})
        </button>
        <button
          onClick={handleExportZip}
          disabled={!cacheStats || cacheStats.cachedCount === 0}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white transition-colors"
        >
          📦 Export Backup
        </button>
        <button
          onClick={handleClearCache}
          disabled={!cacheStats || cacheStats.cachedCount === 0}
          className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white transition-colors"
        >
          🗑️ Clear Offline Cache
        </button>
      </div>
    </div>
  );
}

// Render category badge
function CategoryBadge({ category }) {
  const icon = CATEGORY_ICONS[category] || "📋";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
      {icon} {category}
    </span>
  );
}

// Render offline status indicator
function OfflineIndicator({ isCached }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        isCached
          ? "text-green-600 dark:text-green-400"
          : "text-gray-400 dark:text-gray-500"
      }`}
    >
      {isCached ? "✅ Offline" : "☁️ Online only"}
    </span>
  );
}

// Render form card
function FormCard({ form, isCached, onView, onRemove, onDownload, onPreFill }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-800 dark:text-white text-sm leading-tight">
            {form.title}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            ID: {form.id}
          </p>
        </div>
        <OfflineIndicator isCached={isCached} />
      </div>

      {/* Category */}
      <div className="mb-3">
        <CategoryBadge category={form.category || "General"} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onView(form)}
          className="flex-1 text-xs px-3 py-1.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
        >
          👁️ View
        </button>

        {isCached ? (
          <button
            onClick={() => onRemove(form)}
            className="flex-1 text-xs px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            🗑️ Remove
          </button>
        ) : (
          <button
            onClick={() => onDownload(form)}
            className="flex-1 text-xs px-3 py-1.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors"
          >
            ⬇️ Save Offline
          </button>
        )}

        <button
          onClick={() => onPreFill(form)}
          className="flex-1 text-xs px-3 py-1.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors"
        >
          ✏️ Pre-Fill
        </button>
      </div>
    </div>
  );
}

function FormsGrid({ index, cacheActions, onPreFill }) {
  const { isLoading, filteredForms, cachedStatus } = index;
  const { handleViewDbq, handleRemoveFromCache, handleDownloadOne } =
    cacheActions;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (filteredForms.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <span className="text-4xl">🔍</span>
          <p className="mt-2">No DBQs found matching your search</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredForms.map((form) => (
          <FormCard
            key={form.id}
            form={form}
            isCached={cachedStatus[form.id]}
            onView={handleViewDbq}
            onRemove={handleRemoveFromCache}
            onDownload={handleDownloadOne}
            onPreFill={onPreFill}
          />
        ))}
      </div>
    </div>
  );
}

function InfoFooter() {
  return (
    <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        💡 Download forms for offline access. Pre-fill your information before
        doctor visits. All processing happens locally on your device.
      </p>
    </div>
  );
}

function DbqLibraryModal({
  onClose,
  index,
  cacheActions,
  preFillFlow,
  showBuyMeCoffee,
  coffeeContext,
  onDismissCoffee,
}) {
  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={onClose}
        size="xl"
        zIndex={70}
        labelledBy="dbq-library-title"
        header={
          <DbqBrowserHeader
            onClose={onClose}
            cacheStats={index.cacheStats}
            totalForms={index.dbqForms.length}
          />
        }
      >
        <div className="-mx-4 -my-4">
          {/* Status Message */}
          <StatusBanner
            status={index.status}
            onDismiss={() => index.setStatus(null)}
          />

          {/* Download Progress */}
          <DownloadProgressBar progress={cacheActions.downloadProgress} />

          {/* Search & Filter Bar */}
          <SearchFilterBar index={index} cacheActions={cacheActions} />

          {/* Forms Grid */}
          <FormsGrid
            index={index}
            cacheActions={cacheActions}
            onPreFill={preFillFlow.handlePreFill}
          />

          {/* Info Footer */}
          <InfoFooter />
        </div>
      </ResponsiveModal>

      {/* Pre-Fill Modal */}
      {preFillFlow.showPreFillModal && preFillFlow.selectedForm && (
        <PreFillModal
          form={preFillFlow.selectedForm}
          formData={preFillFlow.preFilledData}
          onDataChange={preFillFlow.setPreFilledData}
          onClose={() => preFillFlow.setShowPreFillModal(false)}
          onComplete={preFillFlow.handlePreFillComplete}
        />
      )}

      {/* Share Menu Modal */}
      {preFillFlow.showShareMenu && preFillFlow.selectedForm && (
        <DbqShareMenu
          formId={preFillFlow.selectedForm.id}
          formTitle={preFillFlow.selectedForm.title}
          formData={preFillFlow.preFilledData}
          onClose={preFillFlow.handleShareMenuClose}
        />
      )}

      {/* BuyMeCoffee - shows after valuable actions (downloads, pre-fills) */}
      <BuyMeCoffee
        show={showBuyMeCoffee}
        trigger="dbq-library"
        context={coffeeContext}
        onDismiss={onDismissCoffee}
        componentKey="DbqBrowser"
      />
    </>
  );
}

/**
 * DbqBrowser Component
 * @param {object} props
 * @param {function} props.onClose - Callback when browser is closed
 */
export default function DbqBrowser({ onClose }) {
  const { _t } = useLanguage();

  // BuyMeCoffee state
  const [showBuyMeCoffee, setShowBuyMeCoffee] = useState(false);
  const [coffeeContext, setCoffeeContext] = useState({});

  const index = useDbqIndexAndFilter();
  const cacheActions = useDbqCacheActions(index.dbqForms, {
    setStatus: index.setStatus,
    setCachedStatus: index.setCachedStatus,
    setCacheStats: index.setCacheStats,
    setCoffeeContext,
    setShowBuyMeCoffee,
  });
  const preFillFlow = useDbqPreFillFlow(setCoffeeContext, setShowBuyMeCoffee);

  return (
    <DbqLibraryModal
      onClose={onClose}
      index={index}
      cacheActions={cacheActions}
      preFillFlow={preFillFlow}
      showBuyMeCoffee={showBuyMeCoffee}
      coffeeContext={coffeeContext}
      onDismissCoffee={() => setShowBuyMeCoffee(false)}
    />
  );
}

function PreFillQuestionField({ question, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {question.label}
      </label>
      {question.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(question.id, e.target.value)}
          rows={3}
          placeholder={question.hint || ""}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(question.id, e.target.value)}
          placeholder={question.hint || ""}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500"
        />
      )}
      {question.hint && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          💡 {question.hint}
        </p>
      )}
    </div>
  );
}

/**
 * PreFillModal - Form for veterans to enter subjective information
 */
function PreFillModal({ form, formData, onDataChange, onClose, onComplete }) {
  const questions = getSubjectiveQuestions(form.id);

  const handleChange = (questionId, value) => {
    onDataChange((prev) => ({ ...prev, [questionId]: value }));
  };

  const hasAnyData = Object.values(formData).some((v) => v && v.trim());

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="lg"
      zIndex={80}
      labelledBy="dbq-prefill-title"
      header={
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 id="dbq-prefill-title" className="text-lg font-bold">
                ✏️ Pre-Fill DBQ
              </h3>
              <p className="text-purple-100 text-sm">{form.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-xl"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      }
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onComplete}
            disabled={!hasAnyData}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-semibold transition-colors"
          >
            Continue to Share →
          </button>
        </div>
      }
    >
      <div className="-mx-4 -my-4">
        {/* Info Banner */}
        <div className="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ Only fill out <strong>subjective information</strong> (your
            experience). Leave medical measurements and diagnoses for your
            doctor.
          </p>
        </div>

        {/* Form */}
        <div className="p-4">
          <div className="space-y-4">
            {questions.map((q) => (
              <PreFillQuestionField
                key={q.id}
                question={q}
                value={formData[q.id] || ""}
                onChange={handleChange}
              />
            ))}
          </div>
        </div>
      </div>
    </ResponsiveModal>
  );
}
