/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
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

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import {
  isDbqCached,
  downloadAndCacheDbq,
  downloadAllDbqs,
  removeFromCache,
  getCacheStats,
  clearDbqCache,
  openDbqInBrowser,
  exportCachedDbqsAsZip,
} from '../utils/dbqOfflineStorage';
import { getSubjectiveQuestions } from '../utils/pdfDbqFiller';
import DbqShareMenu from './DbqShareMenu';
import BuyMeCoffee from './BuyMeCoffee';

// Category icons for visual organization
const CATEGORY_ICONS = {
  'Mental Health': '🧠',
  'Musculoskeletal': '🦴',
  'Neurological': '⚡',
  'Respiratory': '🫁',
  'Cardiovascular': '❤️',
  'Digestive': '🍽️',
  'Hearing/Vision': '👁️',
  'Skin': '🩹',
  'Endocrine': '⚗️',
  'Genitourinary': '💧',
  'Gynecological': '🩺',
  'Hematologic': '🩸',
  'Infectious Disease': '🦠',
  'Dental/Oral': '🦷',
  'General': '📋',
};

/**
 * DbqBrowser Component
 * @param {object} props
 * @param {function} props.onClose - Callback when browser is closed
 */
export default function DbqBrowser({ onClose }) {
  const { t } = useLanguage();
  
  // Lock background scroll when modal is open
  useBodyScrollLock(true);
  
  // State
  const [dbqForms, setDbqForms] = useState([]);
  const [filteredForms, setFilteredForms] = useState([]);
  const [cachedStatus, setCachedStatus] = useState({});
  const [cacheStats, setCacheStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [selectedForm, setSelectedForm] = useState(null);
  const [showPreFillModal, setShowPreFillModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [preFilledData, setPreFilledData] = useState({});
  const [status, setStatus] = useState(null);
  
  // BuyMeCoffee state
  const [showBuyMeCoffee, setShowBuyMeCoffee] = useState(false);
  const [coffeeContext, setCoffeeContext] = useState({});

  // Load DBQ index on mount
  useEffect(() => {
    loadDbqIndex();
  }, []);

  // Filter forms when search/category changes
  useEffect(() => {
    filterForms();
  }, [searchQuery, selectedCategory, dbqForms]);

  /**
   * Load the DBQ index file
   */
  const loadDbqIndex = async () => {
    try {
      setIsLoading(true);
      
      // Fetch the index
      const response = await fetch('/forms/dbq-index.json');
      if (!response.ok) throw new Error('Could not load DBQ index');
      
      const index = await response.json();
      const forms = index.forms || [];
      
      setDbqForms(forms);
      
      // Extract unique categories
      const uniqueCategories = ['All', ...new Set(forms.map(f => f.category || 'General'))];
      setCategories(uniqueCategories);
      
      // Check cache status for each form
      await updateCacheStatus(forms);
      
      // Get cache stats
      const stats = await getCacheStats();
      setCacheStats(stats);
      
    } catch (error) {
      console.error('Error loading DBQ index:', error);
      setStatus({ type: 'error', message: 'Failed to load DBQ forms list' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update cache status for all forms
   */
  const updateCacheStatus = async (forms) => {
    const status = {};
    for (const form of forms) {
      status[form.id] = await isDbqCached(form.id);
    }
    setCachedStatus(status);
  };

  /**
   * Filter forms based on search and category
   */
  const filterForms = () => {
    let filtered = [...dbqForms];
    
    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(f => f.category === selectedCategory);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f => 
        f.title.toLowerCase().includes(query) ||
        f.id.toLowerCase().includes(query) ||
        (f.category && f.category.toLowerCase().includes(query))
      );
    }
    
    setFilteredForms(filtered);
  };

  /**
   * Download a single DBQ for offline access
   */
  const handleDownloadOne = async (form) => {
    setStatus({ type: 'info', message: `Downloading ${form.title}...` });
    
    const result = await downloadAndCacheDbq(form);
    
    if (result.success) {
      setCachedStatus(prev => ({ ...prev, [form.id]: true }));
      const stats = await getCacheStats();
      setCacheStats(stats);
      setStatus({ type: 'success', message: `✅ ${form.title} saved for offline use!` });
      
      // Show BuyMeCoffee after successful download
      setCoffeeContext({ action: 'download', formName: form.title });
      setShowBuyMeCoffee(true);
    } else {
      setStatus({ type: 'error', message: `❌ Failed to download: ${result.error}` });
    }
  };

  /**
   * Download ALL DBQs for offline access
   */
  const handleDownloadAll = async () => {
    setDownloadProgress({ current: 0, total: dbqForms.length, percent: 0 });
    setStatus({ type: 'info', message: 'Starting bulk download...' });
    
    const result = await downloadAllDbqs((progress) => {
      setDownloadProgress(progress);
    });
    
    setDownloadProgress(null);
    
    if (result.success) {
      await updateCacheStatus(dbqForms);
      const stats = await getCacheStats();
      setCacheStats(stats);
      setStatus({ 
        type: 'success', 
        message: `✅ Downloaded ${result.downloaded} forms (${result.skipped} already cached)` 
      });
      
      // Show BuyMeCoffee after bulk download
      if (result.downloaded > 0) {
        setCoffeeContext({ action: 'bulk-download', count: result.downloaded });
        setShowBuyMeCoffee(true);
      }
    } else {
      setStatus({ type: 'error', message: `❌ Some downloads failed: ${result.failed.length} errors` });
    }
  };

  /**
   * Remove a form from offline cache
   */
  const handleRemoveFromCache = async (form) => {
    const result = await removeFromCache(form.id);
    
    if (result) {
      setCachedStatus(prev => ({ ...prev, [form.id]: false }));
      const stats = await getCacheStats();
      setCacheStats(stats);
      setStatus({ type: 'info', message: `Removed ${form.title} from offline storage` });
    }
  };

  /**
   * Clear all cached DBQs
   */
  const handleClearCache = async () => {
    if (!window.confirm('Remove all downloaded DBQs from offline storage?')) return;
    
    await clearDbqCache();
    await updateCacheStatus(dbqForms);
    const stats = await getCacheStats();
    setCacheStats(stats);
    setStatus({ type: 'info', message: 'All cached DBQs removed' });
  };

  /**
   * Export cached DBQs as ZIP for backup
   */
  const handleExportZip = async () => {
    setStatus({ type: 'info', message: 'Creating backup ZIP...' });
    
    const zipBlob = await exportCachedDbqsAsZip();
    
    if (zipBlob) {
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vet-rate-dbq-backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setStatus({ type: 'success', message: '✅ DBQ backup downloaded!' });
    } else {
      setStatus({ type: 'error', message: '❌ Failed to create backup' });
    }
  };

  /**
   * Open a DBQ in the browser
   */
  const handleViewDbq = async (form) => {
    setStatus({ type: 'info', message: 'Opening DBQ...' });
    
    const result = await openDbqInBrowser(form.id, form.path);
    
    if (result.success) {
      setStatus({ 
        type: 'success', 
        message: result.fromCache ? 'Opened from offline storage' : 'Opened from server' 
      });
    } else {
      setStatus({ type: 'error', message: `❌ ${result.error}` });
    }
  };

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
    setCoffeeContext({ action: 'pre-fill', formName: selectedForm?.title });
    setShowBuyMeCoffee(true);
  };

  /**
   * Handle share menu close
   */
  const handleShareMenuClose = () => {
    setShowShareMenu(false);
    // Already showed BuyMeCoffee on pre-fill complete
  };

  // Render category badge
  const CategoryBadge = ({ category }) => {
    const icon = CATEGORY_ICONS[category] || '📋';
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
        {icon} {category}
      </span>
    );
  };

  // Render offline status indicator
  const OfflineIndicator = ({ isCached }) => (
    <span className={`inline-flex items-center gap-1 text-xs ${
      isCached 
        ? 'text-green-600 dark:text-green-400' 
        : 'text-gray-400 dark:text-gray-500'
    }`}>
      {isCached ? '✅ Offline' : '☁️ Online only'}
    </span>
  );

  // Render form card
  const FormCard = ({ form }) => {
    const isCached = cachedStatus[form.id];
    
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
          <CategoryBadge category={form.category || 'General'} />
        </div>
        
        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleViewDbq(form)}
            className="flex-1 text-xs px-3 py-1.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
          >
            👁️ View
          </button>
          
          {isCached ? (
            <button
              onClick={() => handleRemoveFromCache(form)}
              className="flex-1 text-xs px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              🗑️ Remove
            </button>
          ) : (
            <button
              onClick={() => handleDownloadOne(form)}
              className="flex-1 text-xs px-3 py-1.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors"
            >
              ⬇️ Save Offline
            </button>
          )}
          
          <button
            onClick={() => handlePreFill(form)}
            className="flex-1 text-xs px-3 py-1.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors"
          >
            ✏️ Pre-Fill
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 flex-shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              📋 DBQ Library <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">BETA</span>
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
              💾 {cacheStats.cachedCount}/{dbqForms.length} forms saved offline
            </span>
            <span className="bg-white/20 rounded-full px-3 py-1">
              📦 {cacheStats.totalSizeMB} MB used
            </span>
          </div>
        )}
      </div>

      {/* Status Message */}
      {status && (
        <div
          className={`px-6 py-3 ${
            status.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              : status.type === 'error'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
          }`}
        >
          <div className="flex justify-between items-center">
            <span>{status.message}</span>
            <button
              onClick={() => setStatus(null)}
              className="text-current opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Download Progress */}
      {downloadProgress && (
        <div className="px-6 py-3 bg-indigo-50 dark:bg-indigo-900/20">
          <div className="flex justify-between text-sm text-indigo-700 dark:text-indigo-300 mb-1">
            <span>Downloading: {downloadProgress.currentForm}</span>
            <span>{downloadProgress.current}/{downloadProgress.total}</span>
          </div>
          <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all"
              style={{ width: `${downloadProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
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
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {CATEGORY_ICONS[cat] || ''} {cat}
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

      {/* Forms Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <span className="text-4xl">🔍</span>
            <p className="mt-2">No DBQs found matching your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredForms.map(form => (
              <FormCard key={form.id} form={form} />
            ))}
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex-shrink-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          💡 Download forms for offline access. Pre-fill your information before doctor visits.
          All processing happens locally on your device.
        </p>
      </div>

      {/* Pre-Fill Modal */}
      {showPreFillModal && selectedForm && (
        <PreFillModal
          form={selectedForm}
          formData={preFilledData}
          onDataChange={setPreFilledData}
          onClose={() => setShowPreFillModal(false)}
          onComplete={handlePreFillComplete}
        />
      )}

      {/* Share Menu Modal */}
      {showShareMenu && selectedForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <DbqShareMenu
            formId={selectedForm.id}
            formTitle={selectedForm.title}
            formData={preFilledData}
            onClose={handleShareMenuClose}
          />
        </div>
      )}

      {/* BuyMeCoffee - shows after valuable actions (downloads, pre-fills) */}
      <BuyMeCoffee
        show={showBuyMeCoffee}
        trigger="dbq-library"
        context={coffeeContext}
        onDismiss={() => setShowBuyMeCoffee(false)}
        componentKey="DbqBrowser"
      />
    </div>
  );
}

/**
 * PreFillModal - Form for veterans to enter subjective information
 */
function PreFillModal({ form, formData, onDataChange, onClose, onComplete }) {
  const questions = getSubjectiveQuestions(form.id);

  const handleChange = (questionId, value) => {
    onDataChange(prev => ({ ...prev, [questionId]: value }));
  };

  const hasAnyData = Object.values(formData).some(v => v && v.trim());

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold">✏️ Pre-Fill DBQ</h3>
              <p className="text-purple-100 text-sm">{form.title}</p>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white text-xl">×</button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ Only fill out <strong>subjective information</strong> (your experience).
            Leave medical measurements and diagnoses for your doctor.
          </p>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {questions.map(q => (
              <div key={q.id}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {q.label}
                </label>
                {q.type === 'textarea' ? (
                  <textarea
                    value={formData[q.id] || ''}
                    onChange={(e) => handleChange(q.id, e.target.value)}
                    rows={3}
                    placeholder={q.hint || ''}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                ) : (
                  <input
                    type="text"
                    value={formData[q.id] || ''}
                    onChange={(e) => handleChange(q.id, e.target.value)}
                    placeholder={q.hint || ''}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                )}
                {q.hint && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 {q.hint}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end gap-3 flex-shrink-0">
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
      </div>
    </div>
  );
}
