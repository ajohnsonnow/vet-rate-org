/**
 * SupplyLocker.org - Document Picker Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Universal document picker for tools that analyze VKB documents.
 * Allows veterans to choose which documents to analyze without re-uploading.
 * 
 * Used by: DD214Analyzer, BlueButtonXRay, CFileAnalyzer, etc.
 */

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  File, 
  CheckCircle2, 
  Circle, 
  Calendar,
  HardDrive,
  Filter,
  X
} from 'lucide-react';
import { 
  getAllDocuments, 
  getDocumentsByType 
} from '../utils/veteranKnowledgeBase';

/**
 * DocumentPicker Component
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Show/hide picker
 * @param {function} props.onClose - Close callback
 * @param {function} props.onSelect - Selection callback (receives array of document IDs)
 * @param {string} props.filterType - Filter by document type ('dd214', 'bluebutton', 'cfile', 'private', 'other', null = all)
 * @param {boolean} props.multiSelect - Allow multiple selection (default: true)
 * @param {string} props.title - Custom title for picker
 * @param {string} props.emptyMessage - Message when no documents found
 */
const DocumentPicker = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  filterType = null,
  multiSelect = true,
  title = 'Select Documents from VKB',
  emptyMessage = 'No documents found in Veteran Knowledge Base. Use Muster Call to upload documents first.'
}) => {
  const [documents, setDocuments] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [typeFilter, setTypeFilter] = useState(filterType);
  const [searchQuery, setSearchQuery] = useState('');

  // Load documents on mount
  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen, typeFilter]);

  const loadDocuments = () => {
    const docs = typeFilter ? getDocumentsByType(typeFilter) : getAllDocuments();
    setDocuments(docs);
    setSelectedIds(new Set());
  };

  // Filter documents by search query
  const filteredDocuments = documents.filter(doc => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      doc.fileName.toLowerCase().includes(query) ||
      doc.type.toLowerCase().includes(query) ||
      (doc.summary && doc.summary.toLowerCase().includes(query))
    );
  });

  const handleToggleSelect = (docId) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      if (multiSelect) {
        newSelected.add(docId);
      } else {
        newSelected.clear();
        newSelected.add(docId);
      }
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocuments.map(doc => doc.id)));
    }
  };

  const handleConfirm = () => {
    const selectedDocuments = documents.filter(doc => selectedIds.has(doc.id));
    onSelect(selectedDocuments);
    onClose();
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoDate) => {
    return new Date(isoDate).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'dd214': return '🪖';
      case 'bluebutton': return '💊';
      case 'cfile': return '📋';
      case 'private': return '🏥';
      default: return '📄';
    }
  };

  const getTypeBadge = (type) => {
    const colors = {
      dd214: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      bluebutton: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      cfile: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      private: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    
    const labels = {
      dd214: 'DD-214',
      bluebutton: 'Blue Button',
      cfile: 'C-File',
      private: 'Private Records',
      other: 'Other'
    };
    
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[type] || colors.other}`}>
        {labels[type] || type.toUpperCase()}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-7 h-7 text-blue-600" />
                {title}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Select documents from your Veteran Knowledge Base to analyze
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by filename or type..."
                className="w-full px-4 py-2 pl-10 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Filter className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
            </div>

            {!filterType && (
              <select
                value={typeFilter || 'all'}
                onChange={(e) => setTypeFilter(e.target.value === 'all' ? null : e.target.value)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="dd214">DD-214</option>
                <option value="bluebutton">Blue Button</option>
                <option value="cfile">C-File</option>
                <option value="private">Private Records</option>
                <option value="other">Other</option>
              </select>
            )}
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">{emptyMessage}</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
              >
                Go to Muster Call
              </button>
            </div>
          ) : (
            <>
              {/* Select All */}
              {multiSelect && filteredDocuments.length > 1 && (
                <button
                  onClick={handleSelectAll}
                  className="mb-4 text-sm text-blue-600 hover:text-blue-500 font-medium"
                >
                  {selectedIds.size === filteredDocuments.length ? 'Deselect All' : 'Select All'} ({filteredDocuments.length})
                </button>
              )}

              {/* Document Cards */}
              <div className="space-y-3">
                {filteredDocuments.map((doc) => {
                  const isSelected = selectedIds.has(doc.id);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => handleToggleSelect(doc.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Selection Icon */}
                        <div className="flex-shrink-0 mt-1">
                          {isSelected ? (
                            <CheckCircle2 className="w-6 h-6 text-blue-600" />
                          ) : (
                            <Circle className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                          )}
                        </div>

                        {/* Type Icon */}
                        <div className="flex-shrink-0 text-3xl">
                          {getTypeIcon(doc.type)}
                        </div>

                        {/* Document Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                              {doc.fileName}
                            </h3>
                            {getTypeBadge(doc.type)}
                          </div>

                          {doc.summary && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
                              {doc.summary}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(doc.uploadDate)}
                            </span>
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3" />
                              {formatFileSize(doc.fileSize)}
                            </span>
                            {doc.pageCount && (
                              <span>{doc.pageCount} pages</span>
                            )}
                          </div>

                          {doc.processingStatus === 'error' && (
                            <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                              ⚠️ Processing error
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {filteredDocuments.length > 0 && (
          <div className="p-6 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {selectedIds.size} {selectedIds.size === 1 ? 'document' : 'documents'} selected
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Analyze Selected
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentPicker;
