/**
 * VKBTimeline.jsx - Visual timeline of all documents in Veteran Knowledge Base
 *
 * Sprint 4: Document versioning and sequential storage visualization
 *
 * Features:
 * - Chronological timeline of all VKB documents
 * - Filter by document type/category
 * - Version indicators (v1, v2, etc.)
 * - Click to view document details
 * - Compare multiple versions side-by-side
 * - Visual markers for most recent documents
 */

import { useState, useEffect } from "react";
import ResponsiveModal from "./common/ResponsiveModal";
import {
  getAllDocumentsByCategory,
  compareDocumentVersions,
  removeDocumentFromVKB,
} from "../utils/veteranKnowledgeBase";

const formatDate = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFileSize = (bytes) => {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getAllDocumentsFlat = (documentsByCategory, sortOrder) => {
  if (!documentsByCategory) return [];

  let allDocs = [];
  Object.entries(documentsByCategory).forEach(([_category, data]) => {
    allDocs = [...allDocs, ...data.documents];
  });

  // Sort by upload date
  allDocs.sort((a, b) => {
    const dateA = new Date(a.uploadDate);
    const dateB = new Date(b.uploadDate);
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  return allDocs;
};

const getFilteredDocuments = (
  documentsByCategory,
  filterCategory,
  sortOrder,
) => {
  if (!documentsByCategory) return [];

  if (filterCategory === "all") {
    return getAllDocumentsFlat(documentsByCategory, sortOrder);
  }

  return documentsByCategory[filterCategory]?.documents || [];
};

function useVKBTimelineData(onDocumentClick) {
  const [documentsByCategory, setDocumentsByCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [sortOrder, setSortOrder] = useState("newest"); // 'newest' or 'oldest'

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    const docs = await getAllDocumentsByCategory();
    setDocumentsByCategory(docs);
    setLoading(false);
  };

  const handleDocumentClick = (doc) => {
    if (onDocumentClick) {
      onDocumentClick(doc);
    }
  };

  const handleSelectForComparison = (doc) => {
    if (selectedDocs.find((d) => d.id === doc.id)) {
      setSelectedDocs(selectedDocs.filter((d) => d.id !== doc.id));
    } else if (selectedDocs.length < 2) {
      setSelectedDocs([...selectedDocs, doc]);
    }
  };

  const handleCompare = async () => {
    if (selectedDocs.length !== 2) return;

    const result = await compareDocumentVersions(
      selectedDocs[0].id,
      selectedDocs[1].id,
    );
    setComparisonResult(result);
  };

  const handleRemoveDocument = async (docId) => {
    if (
      !confirm(
        "Are you sure you want to remove this document from your Knowledge Base?",
      )
    ) {
      return;
    }

    const result = await removeDocumentFromVKB(docId);
    if (result.success) {
      await loadDocuments();
      setSelectedDocs([]);
      setComparisonResult(null);
    }
  };

  return {
    documentsByCategory,
    loading,
    filterCategory,
    setFilterCategory,
    selectedDocs,
    setSelectedDocs,
    comparisonResult,
    setComparisonResult,
    sortOrder,
    setSortOrder,
    handleDocumentClick,
    handleSelectForComparison,
    handleCompare,
    handleRemoveDocument,
  };
}

const TimelineHeaderTitle = ({ totalDocs, onClose }) => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2
        id="vkb-timeline-title"
        className="text-2xl font-bold text-white flex items-center space-x-2"
      >
        <span>📚</span>
        <span>Knowledge Base Timeline</span>
      </h2>
      <p className="text-slate-400 mt-1">
        {totalDocs} document{totalDocs !== 1 ? "s" : ""} in your Veteran
        Knowledge Base
      </p>
    </div>
    <button
      onClick={onClose}
      className="text-slate-400 hover:text-white transition-colors"
      aria-label="Close timeline"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
);

const TimelineHeaderFilters = ({
  totalDocs,
  filterCategory,
  setFilterCategory,
  documentsByCategory,
  sortOrder,
  setSortOrder,
  selectedDocs,
  onCompare,
}) => (
  <div className="flex items-center space-x-4">
    <div className="flex items-center space-x-2">
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="text-sm text-slate-400">Filter:</label>
      <select
        value={filterCategory}
        onChange={(e) => setFilterCategory(e.target.value)}
        className="bg-slate-700 text-white rounded px-3 py-1 text-sm border border-slate-600 focus:border-blue-500 focus:outline-none"
      >
        <option value="all">All Documents ({totalDocs})</option>
        {documentsByCategory &&
          Object.entries(documentsByCategory).map(([key, data]) => (
            <option key={key} value={key}>
              {data.icon} {data.label} ({data.count})
            </option>
          ))}
      </select>
    </div>

    <div className="flex items-center space-x-2">
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="text-sm text-slate-400">Sort:</label>
      <select
        value={sortOrder}
        onChange={(e) => setSortOrder(e.target.value)}
        className="bg-slate-700 text-white rounded px-3 py-1 text-sm border border-slate-600 focus:border-blue-500 focus:outline-none"
      >
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
      </select>
    </div>

    {selectedDocs.length === 2 && (
      <button
        onClick={onCompare}
        className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded text-sm font-medium transition-colors"
      >
        Compare Selected (2)
      </button>
    )}
  </div>
);

const TimelineHeader = ({
  totalDocs,
  filterCategory,
  setFilterCategory,
  documentsByCategory,
  sortOrder,
  setSortOrder,
  selectedDocs,
  onCompare,
  onClose,
}) => (
  <div className="p-6 border-b border-slate-700">
    <TimelineHeaderTitle totalDocs={totalDocs} onClose={onClose} />

    {/* Filters */}
    <TimelineHeaderFilters
      totalDocs={totalDocs}
      filterCategory={filterCategory}
      setFilterCategory={setFilterCategory}
      documentsByCategory={documentsByCategory}
      sortOrder={sortOrder}
      setSortOrder={setSortOrder}
      selectedDocs={selectedDocs}
      onCompare={onCompare}
    />
  </div>
);

const TimelineDocumentInfo = ({ doc, categoryData }) => (
  <div className="flex-1">
    <div className="flex items-center space-x-3 mb-2">
      <span className="text-2xl">{categoryData?.icon || "📄"}</span>
      <div>
        <h3 className="text-white font-medium flex items-center space-x-2">
          <span>{doc.fileName}</span>
          {doc.version && (
            <span className="bg-slate-600 text-slate-300 px-2 py-0.5 rounded text-xs font-mono">
              v{doc.version}
            </span>
          )}
          {doc.mostRecent && (
            <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs font-medium">
              Most Recent
            </span>
          )}
        </h3>
        <p className="text-slate-400 text-sm">
          {doc.classification} • {formatDate(doc.uploadDate)}
        </p>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mt-3">
      <div className="text-slate-400">
        <span className="text-slate-500">Size:</span>{" "}
        {formatFileSize(doc.fileSize)}
      </div>
      <div className="text-slate-400">
        <span className="text-slate-500">Pages:</span> {doc.pageCount || 1}
      </div>
      <div className="text-slate-400">
        <span className="text-slate-500">Method:</span>{" "}
        {doc.method === "ocr" ? "🔍 OCR" : "📝 Text"}
      </div>
      <div className="text-slate-400">
        <span className="text-slate-500">Fields:</span>{" "}
        {Object.keys(doc.extractedData || {}).length}
      </div>
    </div>
  </div>
);

const TimelineDocumentActions = ({
  doc,
  isSelected,
  selectedDocs,
  onView,
  onToggleSelect,
  onRemove,
}) => (
  <div className="flex flex-col space-y-2 ml-4">
    <button
      onClick={() => onView(doc)}
      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
    >
      View
    </button>
    <button
      onClick={() => onToggleSelect(doc)}
      className={`${
        isSelected
          ? "bg-blue-600 text-white"
          : "bg-slate-600 hover:bg-slate-500 text-slate-300"
      } px-3 py-1 rounded text-sm transition-colors`}
      disabled={!isSelected && selectedDocs.length >= 2}
    >
      {isSelected ? "✓ Selected" : "Compare"}
    </button>
    <button
      onClick={() => onRemove(doc.id)}
      className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-1 rounded text-sm transition-colors"
    >
      Remove
    </button>
  </div>
);

const TimelineDocumentCard = ({
  doc,
  documentsByCategory,
  selectedDocs,
  onView,
  onToggleSelect,
  onRemove,
}) => {
  const isSelected = selectedDocs.find((d) => d.id === doc.id);
  const categoryData = Object.values(documentsByCategory).find((cat) =>
    cat.documents.find((d) => d.id === doc.id),
  );

  return (
    <div
      className={`bg-slate-700 rounded-lg p-4 border-2 transition-all ${
        isSelected
          ? "border-blue-500 shadow-lg shadow-blue-500/20"
          : "border-slate-600 hover:border-slate-500"
      }`}
    >
      <div className="flex items-start justify-between">
        {/* Document Info */}
        <TimelineDocumentInfo doc={doc} categoryData={categoryData} />

        {/* Actions */}
        <TimelineDocumentActions
          doc={doc}
          isSelected={isSelected}
          selectedDocs={selectedDocs}
          onView={onView}
          onToggleSelect={onToggleSelect}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
};

const ComparisonModalHeader = ({ onClose }) => (
  <div className="p-6 border-b border-slate-700">
    <div className="flex items-center justify-between">
      <h3 id="vkb-comparison-title" className="text-xl font-bold text-white">
        Document Comparison
      </h3>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-white transition-colors"
        aria-label="Close comparison"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>
);

const ComparisonModalSummary = ({ comparisonResult }) => (
  <div className="grid grid-cols-2 gap-4 mb-6">
    <div className="bg-slate-700 rounded p-3">
      <p className="text-slate-400 text-sm">Document 1</p>
      <p className="text-white font-medium">{comparisonResult.doc1.fileName}</p>
      <p className="text-slate-400 text-xs">
        v{comparisonResult.doc1.version} •{" "}
        {formatDate(comparisonResult.doc1.uploadDate)}
      </p>
    </div>
    <div className="bg-slate-700 rounded p-3">
      <p className="text-slate-400 text-sm">Document 2</p>
      <p className="text-white font-medium">{comparisonResult.doc2.fileName}</p>
      <p className="text-slate-400 text-xs">
        v{comparisonResult.doc2.version} •{" "}
        {formatDate(comparisonResult.doc2.uploadDate)}
      </p>
    </div>
  </div>
);

const ComparisonDifferenceRow = ({ diff }) => (
  <div className="bg-slate-700 rounded p-3">
    <p className="text-blue-400 font-medium mb-2">{diff.field}</p>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-slate-400 text-xs mb-1">Document 1</p>
        <p className="text-white text-sm font-mono bg-slate-800 p-2 rounded">
          {diff.doc1Value !== undefined
            ? JSON.stringify(diff.doc1Value, null, 2)
            : "(not present)"}
        </p>
      </div>
      <div>
        <p className="text-slate-400 text-xs mb-1">Document 2</p>
        <p className="text-white text-sm font-mono bg-slate-800 p-2 rounded">
          {diff.doc2Value !== undefined
            ? JSON.stringify(diff.doc2Value, null, 2)
            : "(not present)"}
        </p>
      </div>
    </div>
  </div>
);

const ComparisonModalDifferences = ({ comparisonResult }) =>
  comparisonResult.identical ? (
    <div className="bg-green-600/20 border border-green-600 rounded p-4 text-center">
      <p className="text-green-400 font-medium">✓ Documents are identical</p>
      <p className="text-green-300 text-sm mt-1">
        No differences found in extracted data.
      </p>
    </div>
  ) : (
    <div>
      <p className="text-white font-medium mb-4">
        {comparisonResult.differenceCount} difference
        {comparisonResult.differenceCount !== 1 ? "s" : ""} found:
      </p>
      <div className="space-y-3">
        {comparisonResult.differences.map((diff, idx) => (
          <ComparisonDifferenceRow key={idx} diff={diff} />
        ))}
      </div>
    </div>
  );

const ComparisonModal = ({ comparisonResult, onClose }) => (
  <ResponsiveModal
    isOpen
    onClose={onClose}
    size="xl"
    zIndex={70}
    className="!bg-slate-800"
    labelledBy="vkb-comparison-title"
    header={<ComparisonModalHeader onClose={onClose} />}
  >
    <ComparisonModalSummary comparisonResult={comparisonResult} />
    <ComparisonModalDifferences comparisonResult={comparisonResult} />
  </ResponsiveModal>
);

const TimelineLoadingOverlay = () => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-slate-800 rounded-lg p-8 max-w-md">
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="text-white text-lg">Loading Knowledge Base...</span>
      </div>
    </div>
  </div>
);

const TimelineDocumentList = ({
  filteredDocs,
  documentsByCategory,
  selectedDocs,
  onView,
  onToggleSelect,
  onRemove,
}) =>
  filteredDocs.length === 0 ? (
    <div className="text-center py-12">
      <p className="text-slate-400 text-lg">
        No documents in this category yet.
      </p>
      <p className="text-slate-500 text-sm mt-2">
        Drop documents through Muster Call to build your Knowledge Base.
      </p>
    </div>
  ) : (
    <div className="space-y-4">
      {filteredDocs.map((doc) => (
        <TimelineDocumentCard
          key={doc.id}
          doc={doc}
          documentsByCategory={documentsByCategory}
          selectedDocs={selectedDocs}
          onView={onView}
          onToggleSelect={onToggleSelect}
          onRemove={onRemove}
        />
      ))}
    </div>
  );

const VKBTimeline = ({ onDocumentClick, onClose }) => {
  const {
    documentsByCategory,
    loading,
    filterCategory,
    setFilterCategory,
    selectedDocs,
    setSelectedDocs,
    comparisonResult,
    setComparisonResult,
    sortOrder,
    setSortOrder,
    handleDocumentClick,
    handleSelectForComparison,
    handleCompare,
    handleRemoveDocument,
  } = useVKBTimelineData(onDocumentClick);

  if (loading) {
    return <TimelineLoadingOverlay />;
  }

  const filteredDocs = getFilteredDocuments(
    documentsByCategory,
    filterCategory,
    sortOrder,
  );
  const totalDocs = getAllDocumentsFlat(documentsByCategory, sortOrder).length;

  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={onClose}
        size="2xl"
        className="!bg-slate-800"
        labelledBy="vkb-timeline-title"
        header={
          <TimelineHeader
            totalDocs={totalDocs}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            documentsByCategory={documentsByCategory}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            selectedDocs={selectedDocs}
            onCompare={handleCompare}
            onClose={onClose}
          />
        }
      >
        {/* Timeline Content */}
        <TimelineDocumentList
          filteredDocs={filteredDocs}
          documentsByCategory={documentsByCategory}
          selectedDocs={selectedDocs}
          onView={handleDocumentClick}
          onToggleSelect={handleSelectForComparison}
          onRemove={handleRemoveDocument}
        />
      </ResponsiveModal>

      {/* Comparison Modal — lifted above the timeline shell */}
      {comparisonResult && (
        <ComparisonModal
          comparisonResult={comparisonResult}
          onClose={() => {
            setComparisonResult(null);
            setSelectedDocs([]);
          }}
        />
      )}
    </>
  );
};

export default VKBTimeline;
