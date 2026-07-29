/**
 * Vet-Rate.org - Publications Library Component
 * ==============================================
 *
 * Reference library of official military and VA publications
 * essential for understanding disability claims.
 *
 * "Know your regs, know your rights."
 */

import { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  Download,
  ExternalLink,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  FileText,
  Info,
  Shield,
  X,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";

// Branch colors
const BRANCH_COLORS = {
  Army: "bg-green-700 text-white",
  Navy: "bg-blue-800 text-white",
  "Air Force": "bg-sky-600 text-white",
  Marines: "bg-red-700 text-white",
  "Coast Guard": "bg-orange-500 text-white",
  "Space Force": "bg-gray-800 text-white",
  DoD: "bg-gray-600 text-white",
  VA: "bg-blue-900 text-white",
};

const BRANCH_ICONS = {
  Army: "🪖",
  Navy: "⚓",
  "Air Force": "✈️",
  Marines: "🦅",
  "Coast Guard": "🛟",
  "Space Force": "🚀",
  DoD: "🏛️",
  VA: "🇺🇸",
};

const CATEGORY_ICONS = {
  separations: "📋",
  disability: "🏥",
  medical: "⚕️",
  awards: "🎖️",
  occupational: "👷",
  "va-rating": "📊",
  assignments: "🗺️",
};

const CATEGORY_NAMES = {
  separations: "Separations & Discharges",
  disability: "Disability Evaluation",
  medical: "Medical Standards",
  awards: "Awards & Decorations",
  occupational: "Occupational Information",
  "va-rating": "VA Rating & Claims",
  assignments: "Assignments & Deployments",
};

/**
 * Publication Card Component
 */
const PublicationCard = ({ publication, onViewDetails }) => {
  const hasLocalFile =
    publication.filename && !publication.filename.includes("null");

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header */}
      <div
        className={`px-4 py-2 ${BRANCH_COLORS[publication.branch] || "bg-gray-600 text-white"}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {BRANCH_ICONS[publication.branch]} {publication.branch}
          </span>
          <span className="text-xs opacity-80">
            {CATEGORY_ICONS[publication.category]}{" "}
            {CATEGORY_NAMES[publication.category]}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-gray-900 dark:text-white mb-1">
          {publication.shortTitle}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {publication.title}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          {publication.description}
        </p>

        {/* Use For Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {publication.useFor?.slice(0, 3).map((use, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 rounded-full"
            >
              {use}
            </span>
          ))}
          {publication.useFor?.length > 3 && (
            <span className="px-2 py-0.5 text-xs text-gray-500">
              +{publication.useFor.length - 3} more
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {hasLocalFile ? (
            <a
              href={`/pubs/${publication.filename}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              View PDF
            </a>
          ) : (
            <a
              href={publication.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Online
            </a>
          )}
          <button
            onClick={() => onViewDetails(publication)}
            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Publication Details Modal - header banner
 */
const PublicationDetailsHeader = ({ publication, onClose }) => (
  <div className={`px-6 py-4 ${BRANCH_COLORS[publication.branch]}`}>
    <div className="flex items-center justify-between">
      <div>
        <span className="text-lg">{BRANCH_ICONS[publication.branch]}</span>
        <span className="ml-2 font-bold">{publication.branch}</span>
      </div>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  </div>
);

/**
 * Publication Details Modal - download/official source links
 */
const PublicationLinks = ({ publication }) => (
  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
    <div className="flex gap-3">
      {publication.filename && (
        <a
          href={`/pubs/${publication.filename}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          <Download className="w-5 h-5" />
          Download PDF
        </a>
      )}
      <a
        href={publication.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        <ExternalLink className="w-5 h-5" />
        Official Source
      </a>
    </div>
  </div>
);

/**
 * Publication Details Modal
 */
const PublicationDetailsModal = ({ publication, onClose }) => {
  if (!publication) return null;

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="lg"
      zIndex={70}
      labelledBy="publication-details-title"
      header={
        <PublicationDetailsHeader publication={publication} onClose={onClose} />
      }
    >
      <h2
        id="publication-details-title"
        className="text-xl font-bold text-gray-900 dark:text-white mb-2"
      >
        {publication.title}
      </h2>

      <p className="text-gray-600 dark:text-gray-300 mb-4">
        {publication.description}
      </p>

      <div className="space-y-4">
        {/* Category */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
            Category
          </h4>
          <p className="text-gray-900 dark:text-white">
            {CATEGORY_ICONS[publication.category]}{" "}
            {CATEGORY_NAMES[publication.category]}
          </p>
        </div>

        {/* Use For */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Useful For
          </h4>
          <div className="flex flex-wrap gap-2">
            {publication.useFor?.map((use, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm"
              >
                {use}
              </span>
            ))}
          </div>
        </div>

        <PublicationLinks publication={publication} />
      </div>
    </ResponsiveModal>
  );
};

/**
 * Loads the publications index from the static pubs directory
 */
const usePublicationsIndex = () => {
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPublications() {
      try {
        const response = await fetch("/pubs/publications-index.json");
        if (!response.ok) throw new Error("Failed to load publications index");
        const data = await response.json();
        setPublications(data.publications || []);
      } catch (err) {
        console.error("Error loading publications:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadPublications();
  }, []);

  return { publications, loading, error };
};

/**
 * Search query, branch/category filters, and their derived/filtered results
 */
const usePublicationFilters = (publications) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const branches = useMemo(() => {
    const unique = [...new Set(publications.map((p) => p.branch))];
    return unique.sort();
  }, [publications]);

  const categories = useMemo(() => {
    const unique = [...new Set(publications.map((p) => p.category))];
    return unique.sort();
  }, [publications]);

  const filteredPublications = useMemo(() => {
    return publications.filter((pub) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          pub.title.toLowerCase().includes(query) ||
          pub.shortTitle.toLowerCase().includes(query) ||
          pub.description.toLowerCase().includes(query) ||
          pub.useFor?.some((u) => u.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Branch filter
      if (selectedBranch !== "all" && pub.branch !== selectedBranch) {
        return false;
      }

      // Category filter
      if (selectedCategory !== "all" && pub.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [publications, searchQuery, selectedBranch, selectedCategory]);

  // Group by category for display
  const groupedPublications = useMemo(() => {
    const groups = {};
    filteredPublications.forEach((pub) => {
      if (!groups[pub.category]) {
        groups[pub.category] = [];
      }
      groups[pub.category].push(pub);
    });
    return groups;
  }, [filteredPublications]);

  return {
    searchQuery,
    setSearchQuery,
    selectedBranch,
    setSelectedBranch,
    selectedCategory,
    setSelectedCategory,
    showFilters,
    setShowFilters,
    branches,
    categories,
    filteredPublications,
    groupedPublications,
  };
};

/**
 * Library title banner
 */
const LibraryHeader = () => (
  <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-xl p-6 text-white">
    <div className="flex items-center gap-3 mb-2">
      <BookOpen className="w-8 h-8" />
      <h1 className="text-2xl font-bold">
        Publications Library{" "}
        <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
          BETA
        </span>
      </h1>
    </div>
    <p className="text-blue-100">
      Official military and VA regulations essential for understanding
      disability claims. Know your regs, know your rights.
    </p>
  </div>
);

/**
 * Branch and category filter selects, shown when filters are expanded
 */
const FilterOptions = ({
  selectedBranch,
  setSelectedBranch,
  selectedCategory,
  setSelectedCategory,
  branches,
  categories,
}) => (
  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Branch Filter */}
    <div>
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Branch
      </label>
      <select
        value={selectedBranch}
        onChange={(e) => setSelectedBranch(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      >
        <option value="all">All Branches</option>
        {branches.map((branch) => (
          <option key={branch} value={branch}>
            {BRANCH_ICONS[branch]} {branch}
          </option>
        ))}
      </select>
    </div>

    {/* Category Filter */}
    <div>
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Category
      </label>
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      >
        <option value="all">All Categories</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {CATEGORY_ICONS[cat]} {CATEGORY_NAMES[cat]}
          </option>
        ))}
      </select>
    </div>
  </div>
);

/**
 * Search box, filter toggle, and branch/category filter selects
 */
const SearchAndFilters = ({
  searchQuery,
  setSearchQuery,
  showFilters,
  setShowFilters,
  selectedBranch,
  setSelectedBranch,
  selectedCategory,
  setSelectedCategory,
  branches,
  categories,
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
    {/* Search */}
    <div className="relative mb-4">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type="text"
        placeholder="Search publications (e.g., 'hearing loss', 'MEB', 'awards')..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
    </div>

    {/* Filter Toggle */}
    <button
      onClick={() => setShowFilters(!showFilters)}
      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
    >
      <Filter className="w-4 h-4" />
      Filters
      {showFilters ? (
        <ChevronUp className="w-4 h-4" />
      ) : (
        <ChevronDown className="w-4 h-4" />
      )}
    </button>

    {showFilters && (
      <FilterOptions
        selectedBranch={selectedBranch}
        setSelectedBranch={setSelectedBranch}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        branches={branches}
        categories={categories}
      />
    )}
  </div>
);

/**
 * Publications grouped by category, or an empty state
 */
const PublicationsGrid = ({ groupedPublications, onViewDetails }) => {
  if (Object.keys(groupedPublications).length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No publications match your search</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(groupedPublications).map(([category, pubs]) => (
        <div key={category}>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">{CATEGORY_ICONS[category]}</span>
            {CATEGORY_NAMES[category]}
            <span className="text-sm font-normal text-gray-500">
              ({pubs.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pubs.map((pub) => (
              <PublicationCard
                key={pub.id}
                publication={pub}
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Static links to official VA/CFR resources
 */
const VAOnlineResources = () => (
  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
    <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
      <Shield className="w-5 h-5" />
      VA Online Resources
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <a
        href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-blue-700 dark:text-blue-400 hover:underline"
      >
        <ExternalLink className="w-4 h-4" />
        38 CFR Part 4 - Rating Schedule (eCFR)
      </a>
      <a
        href="https://www.ecfr.gov/current/title-38/chapter-I/part-3"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-blue-700 dark:text-blue-400 hover:underline"
      >
        <ExternalLink className="w-4 h-4" />
        38 CFR Part 3 - Service Connection Rules
      </a>
      <a
        href="https://www.knowva.ebenefits.va.gov/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-blue-700 dark:text-blue-400 hover:underline"
      >
        <ExternalLink className="w-4 h-4" />
        M21-1 Adjudication Manual
      </a>
      <a
        href="https://www.index.va.gov/search/va/bva.html"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-blue-700 dark:text-blue-400 hover:underline"
      >
        <ExternalLink className="w-4 h-4" />
        BVA Decisions Search
      </a>
      <a
        href="https://www.va.gov/resources/the-pact-act-and-your-va-benefits/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-blue-700 dark:text-blue-400 hover:underline"
      >
        <ExternalLink className="w-4 h-4" />
        PACT Act Information
      </a>
      <a
        href="https://www.uscourts.cavc.gov/decisions.php"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-blue-700 dark:text-blue-400 hover:underline"
      >
        <ExternalLink className="w-4 h-4" />
        Court of Appeals Decisions
      </a>
    </div>
  </div>
);

/**
 * Main Publications Library Component
 */
export default function PublicationsLibrary() {
  const { _t } = useLanguage();
  const { publications, loading, error } = usePublicationsIndex();
  const {
    searchQuery,
    setSearchQuery,
    selectedBranch,
    setSelectedBranch,
    selectedCategory,
    setSelectedCategory,
    showFilters,
    setShowFilters,
    branches,
    categories,
    filteredPublications,
    groupedPublications,
  } = usePublicationFilters(publications);

  // Details modal
  const [selectedPublication, setSelectedPublication] = useState(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300">
        <p className="font-bold">Error loading publications</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LibraryHeader />

      <SearchAndFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        selectedBranch={selectedBranch}
        setSelectedBranch={setSelectedBranch}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        branches={branches}
        categories={categories}
      />

      {/* Results Count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredPublications.length} of {publications.length}{" "}
        publications
      </div>

      <PublicationsGrid
        groupedPublications={groupedPublications}
        onViewDetails={setSelectedPublication}
      />

      <VAOnlineResources />

      {/* Details Modal */}
      {selectedPublication && (
        <PublicationDetailsModal
          publication={selectedPublication}
          onClose={() => setSelectedPublication(null)}
        />
      )}
    </div>
  );
}
