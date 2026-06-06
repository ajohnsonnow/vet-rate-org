import React, { useState } from "react";
import {
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Scale,
  Shield,
  FileText,
  Calendar,
  AlertTriangle,
  Clock,
  Lightbulb,
  Search,
  Gavel,
  DollarSign,
} from "lucide-react";
import cfr3Regulations from "../data/cfr3Regulations.json";
import title38Regulations from "../data/title38Regulations.json";
import { useLanguage } from "../contexts/LanguageContext";
import { sanitizeUrl } from "../utils/sanitize";
import ResponsiveModal from "./common/ResponsiveModal";

// Pre-sanitize all eCFR URLs from static JSON at module load time - fully outside any
// user-input (searchTerm) taint flow. Build a Map for O(1) safe URL lookups at render.
const _safeCfr3Categories = (cfr3Regulations.categories || []).map((c) => ({
  ...c,
  safeEcfrUrl: sanitizeUrl(c.ecfrUrl || "", { requireGov: true }),
}));
const _safeBvaCategories = (
  title38Regulations.bvaAppeals?.categories || []
).map((c) => ({
  ...c,
  safeEcfrUrl: sanitizeUrl(c.ecfrUrl || "", { requireGov: true }),
}));
const _safePensionCategories = (
  title38Regulations.pension?.categories || []
).map((c) => ({
  ...c,
  safeEcfrUrl: sanitizeUrl(c.ecfrUrl || "", { requireGov: true }),
}));
// Safe URL accessor - accepts a category id and returns only the pre-sanitized URL,
// never the tainted spread object. Snyk taint stops at this function boundary.
const _getEcfrUrl = (() => {
  const _urlMap = new Map([
    ..._safeCfr3Categories.map((c) => [c.id, c.safeEcfrUrl]),
    ..._safeBvaCategories.map((c) => [c.id, c.safeEcfrUrl]),
    ..._safePensionCategories.map((c) => [c.id, c.safeEcfrUrl]),
  ]);
  return (id) => _urlMap.get(id) ?? "#";
})();

/**
 * RegulationsReference Component
 *
 * A comprehensive reference for 38 CFR Title 38 - the VA regulations governing
 * claims adjudication, appeals, and pension benefits. Helps veterans understand
 * their rights, the claims process, evidence standards, effective dates, and appeal options.
 */
const RegulationsReference = ({ onClose }) => {
  const { t } = useLanguage();

  const [expandedCategories, setExpandedCategories] = useState({
    "reasonable-doubt": true, // Open the most important one by default
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("regulations");

  const toggleCategory = (categoryId) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const expandAll = () => {
    const allExpanded = {};
    cfr3Regulations.categories.forEach((cat) => {
      allExpanded[cat.id] = true;
    });
    // Also expand BVA categories
    if (title38Regulations.bvaAppeals?.categories) {
      title38Regulations.bvaAppeals.categories.forEach((cat) => {
        allExpanded[cat.id] = true;
      });
    }
    // Also expand Pension categories
    if (title38Regulations.pension?.categories) {
      title38Regulations.pension.categories.forEach((cat) => {
        allExpanded[cat.id] = true;
      });
    }
    setExpandedCategories(allExpanded);
  };

  const collapseAll = () => {
    setExpandedCategories({});
  };

  // Search-match predicate - checks if a regulation matches the current searchTerm.
  // This is a pure predicate that does NOT spread or mix tainted state into data objects,
  // so Snyk taint propagation from searchTerm never reaches static category properties.
  const _regMatchesSearch = (reg) =>
    searchTerm === "" ||
    reg.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.section.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (reg.veteranTip &&
      reg.veteranTip.toLowerCase().includes(searchTerm.toLowerCase()));

  const getCategoryIcon = (iconName) => {
    const icons = {
      "\u{1F4D6}": <BookOpen className="h-5 w-5" />,
      "\u2696\uFE0F": <Scale className="h-5 w-5" />,
      "\u{1F6E1}\uFE0F": <Shield className="h-5 w-5" />,
      "\u{1F4CB}": <FileText className="h-5 w-5" />,
      "\u{1F4DD}": <FileText className="h-5 w-5" />,
      "\u{1F91D}": <Shield className="h-5 w-5" />,
      "\u{1F517}": <Scale className="h-5 w-5" />,
      "\u2622\uFE0F": <AlertTriangle className="h-5 w-5" />,
      "\u{1F4C5}": <Calendar className="h-5 w-5" />,
      "\u{1F504}": <Clock className="h-5 w-5" />,
      "\u{1F4B0}": <DollarSign className="h-5 w-5" />,
      "\u{1F3E5}": <Shield className="h-5 w-5" />,
      "\u{1F3DB}\uFE0F": <Gavel className="h-5 w-5" />,
      "\u{1F3A4}": <FileText className="h-5 w-5" />,
      "\u{1F4DC}": <FileText className="h-5 w-5" />,
      "\u{1F4B5}": <DollarSign className="h-5 w-5" />,
    };
    return icons[iconName] || <BookOpen className="h-5 w-5" />;
  };

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="2xl"
      zIndex={70}
      labelledBy="regulations-title"
      header={
        <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white p-4 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="flex items-center gap-3 justify-center">
            <Scale className="h-8 w-8" />
            <div>
              <h2 id="regulations-title" className="text-2xl font-bold">
                38 CFR Title 38 - Your Rights & The Rules{" "}
                <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
                  BETA
                </span>
              </h2>
              <p className="text-blue-200 text-sm">
                Claims, Appeals & Pension Regulations — Know Your Rights
              </p>
            </div>
          </div>

          <p className="text-blue-100 text-center mt-3 max-w-2xl mx-auto text-sm">
            {cfr3Regulations.description}
          </p>

          {/* Revision Info */}
          <p className="text-blue-300 text-center mt-1 text-xs">
            eCFR data current as of{" "}
            {cfr3Regulations.revisionInfo?.displayDate || "1/15/2026"} — Last
            amended {cfr3Regulations.revisionInfo?.lastAmended || "1/09/2026"}
          </p>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <button
              onClick={() => setActiveTab("regulations")}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "regulations"
                  ? "bg-white text-blue-700"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              ?? Claims (Part 3)
            </button>
            <button
              onClick={() => setActiveTab("appeals")}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "appeals"
                  ? "bg-white text-blue-700"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              ?? BVA Appeals
            </button>
            <button
              onClick={() => setActiveTab("pension")}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "pension"
                  ? "bg-white text-blue-700"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              ?? Pension
            </button>
            <button
              onClick={() => setActiveTab("forms")}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "forms"
                  ? "bg-white text-blue-700"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              ?? Forms
            </button>
            <button
              onClick={() => setActiveTab("deadlines")}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "deadlines"
                  ? "bg-white text-blue-700"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              ? Deadlines
            </button>
            <button
              onClick={() => setActiveTab("mistakes")}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "mistakes"
                  ? "bg-white text-blue-700"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              ?? Mistakes
            </button>
          </div>
        </div>
      }
    >
      {/* Content */}
      {activeTab === "regulations" && (
        <>
          {/* Search and expand/collapse */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search regulations, rights, and terms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Important Notice */}
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-800 dark:text-amber-200">
                  Why This Matters
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  38 CFR Part 3 contains the rules VA MUST follow when deciding
                  your claim. Knowing these regulations helps you file stronger
                  claims, catch errors in denials, and effectively appeal
                  unfavorable decisions. These are YOUR rights - use them!
                </p>
              </div>
            </div>
          </div>

          {/* Categories - iterate the original static array directly so
                  category.id is never from a tainted spread object (fixes Snyk DOMXSS). */}
          <div className="space-y-4">
            {_safeCfr3Categories.map((category) => {
              if (!category.regulations.some(_regMatchesSearch)) return null;
              const ecfrHref = _getEcfrUrl(category.id);
              return (
                <div
                  key={category.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon}</span>
                      <div className="text-left">
                        <span className="font-bold text-gray-800 dark:text-gray-100">
                          {category.title}
                        </span>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {category.description}
                        </p>
                      </div>
                    </div>
                    {expandedCategories[category.id] ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </button>

                  {expandedCategories[category.id] && (
                    <div className="p-4 space-y-4 bg-white dark:bg-gray-800">
                      {/* Link to eCFR */}
                      <a
                        href={ecfrHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View official text at eCFR.gov
                      </a>

                      {category.regulations.map((reg, index) =>
                        !_regMatchesSearch(reg) ? null : (
                          <div
                            key={index}
                            className="border-2 border-blue-100 dark:border-blue-900 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/20"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h4 className="font-bold text-blue-900 dark:text-blue-200">
                                {reg.section}: {reg.title}
                              </h4>
                            </div>

                            <p className="text-gray-700 dark:text-gray-300 mb-3">
                              {reg.summary}
                            </p>

                            {reg.importantQuote && (
                              <blockquote className="border-l-4 border-blue-400 pl-3 py-2 bg-blue-100/50 dark:bg-blue-800/30 rounded-r italic text-sm text-gray-700 dark:text-gray-300 mb-3">
                                "{reg.importantQuote}"
                              </blockquote>
                            )}

                            {reg.keyPoints && reg.keyPoints.length > 0 && (
                              <div className="mb-3">
                                <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                  Key Points:
                                </h5>
                                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                  {reg.keyPoints.map((point, i) => (
                                    <li
                                      key={i}
                                      className="flex items-start gap-2"
                                    >
                                      <span className="text-blue-500 mt-1">
                                        →
                                      </span>
                                      <span>{point}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {reg.veteranTip && (
                              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                  <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-semibold text-green-800 dark:text-green-200 text-sm">
                                      Veteran Tip:{" "}
                                    </span>
                                    <span className="text-sm text-green-700 dark:text-green-300">
                                      {reg.veteranTip}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === "appeals" && (
        <>
          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search appeals regulations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Appeals Overview */}
          <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Gavel className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-purple-800 dark:text-purple-200">
                  Board of Veterans' Appeals (BVA)
                </h3>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  {title38Regulations.bvaAppeals?.description ||
                    "The Board reviews appeals from VA decisions."}
                </p>
                <a
                  href="https://www.bva.va.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:underline mt-2"
                >
                  <ExternalLink className="h-4 w-4" /> Visit BVA Website
                </a>
              </div>
            </div>
          </div>

          {/* BVA Categories - iterate original static array (fixes Snyk DOMXSS). */}
          <div className="space-y-4">
            {_safeBvaCategories.map((category) => {
              if (!category.regulations.some(_regMatchesSearch)) return null;
              return (
                <div
                  key={category.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon}</span>
                      <div className="text-left">
                        <span className="font-bold text-gray-800 dark:text-gray-100">
                          {category.title}
                        </span>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {category.description}
                        </p>
                      </div>
                    </div>
                    {expandedCategories[category.id] ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </button>

                  {expandedCategories[category.id] && (
                    <div className="p-4 space-y-4 bg-white dark:bg-gray-800">
                      {category.ecfrUrl && (
                        <a
                          href={_getEcfrUrl(category.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View official text at eCFR.gov
                        </a>
                      )}

                      {category.regulations.map((reg, index) =>
                        !_regMatchesSearch(reg) ? null : (
                          <div
                            key={index}
                            className="border-2 border-purple-100 dark:border-purple-900 rounded-lg p-4 bg-purple-50/50 dark:bg-purple-900/20"
                          >
                            <h4 className="font-bold text-purple-900 dark:text-purple-200 mb-2">
                              {reg.section}: {reg.title}
                            </h4>

                            <p className="text-gray-700 dark:text-gray-300 mb-3">
                              {reg.summary}
                            </p>

                            {reg.keyPoints && reg.keyPoints.length > 0 && (
                              <div className="mb-3">
                                <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                  Key Points:
                                </h5>
                                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                  {reg.keyPoints.map((point, i) => (
                                    <li
                                      key={i}
                                      className="flex items-start gap-2"
                                    >
                                      <span className="text-purple-500 mt-1">
                                        →
                                      </span>
                                      <span>{point}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Docket Details for the docket selection regulation */}
                            {reg.docketDetails && (
                              <div className="mb-3 space-y-2">
                                <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  Docket Options:
                                </h5>
                                {reg.docketDetails.map((docket, i) => (
                                  <div
                                    key={i}
                                    className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3"
                                  >
                                    <h6 className="font-bold text-gray-800 dark:text-gray-100">
                                      {docket.name}
                                    </h6>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      {docket.description}
                                    </p>
                                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                      ? {docket.avgWait}
                                    </p>
                                    <p className="text-xs text-green-600 dark:text-green-400">
                                      ? Best for: {docket.bestFor}
                                    </p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                      ? {docket.limitation}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {reg.importantWarning && (
                              <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3 mb-3">
                                <p className="text-sm text-red-700 dark:text-red-300 font-semibold">
                                  ?? {reg.importantWarning}
                                </p>
                              </div>
                            )}

                            {reg.veteranTip && (
                              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                  <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-semibold text-green-800 dark:text-green-200 text-sm">
                                      Veteran Tip:{" "}
                                    </span>
                                    <span className="text-sm text-green-700 dark:text-green-300">
                                      {reg.veteranTip}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Appeal Timelines */}
          {title38Regulations.bvaAppeals?.appealTimelines && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                ? Appeal Deadlines
              </h3>
              <div className="space-y-3">
                {title38Regulations.bvaAppeals.appealTimelines.map(
                  (timeline, index) => (
                    <div
                      key={index}
                      className="p-3 border-2 border-red-100 dark:border-red-900 bg-red-50/50 dark:bg-red-900/20 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
                        <span className="font-bold text-red-800 dark:text-red-200">
                          {timeline.deadline}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {timeline.description}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        ?? {timeline.consequence}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {/* BVA Forms */}
          {title38Regulations.bvaAppeals?.keyForms && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                ?? Appeal Forms
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {title38Regulations.bvaAppeals.keyForms.map((form, index) => (
                  <a
                    key={index}
                    href={form.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block p-3 border-2 rounded-lg transition-colors group ${
                      form.critical
                        ? "border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500"
                    }`}
                  >
                    <h4 className="font-bold text-gray-800 dark:text-gray-100">
                      {form.form}
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {form.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {form.use}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "pension" && (
        <>
          {/* Pension Overview */}
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-800 dark:text-amber-200">
                  VA Pension vs. Disability Compensation
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {title38Regulations.pension?.note ||
                    "Pension is different from disability compensation."}
                </p>
              </div>
            </div>
          </div>

          {/* Comparison Chart */}
          {title38Regulations.pension?.comparisonChart && (
            <div className="mb-6 overflow-x-auto">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">
                {title38Regulations.pension.comparisonChart.title}
              </h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    {title38Regulations.pension.comparisonChart.columns.map(
                      (col, i) => (
                        <th
                          key={i}
                          className="p-2 text-left border border-gray-300 dark:border-gray-600 font-bold"
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {title38Regulations.pension.comparisonChart.rows.map(
                    (row, i) => (
                      <tr
                        key={i}
                        className={
                          i % 2 === 0
                            ? "bg-white dark:bg-gray-800"
                            : "bg-gray-50 dark:bg-gray-750"
                        }
                      >
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className={`p-2 border border-gray-300 dark:border-gray-600 ${j === 0 ? "font-semibold" : ""}`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pension Categories - iterate original static array (fixes Snyk DOMXSS). */}
          <div className="space-y-4">
            {_safePensionCategories.map((category) => {
              if (!category.regulations.some(_regMatchesSearch)) return null;
              const categoryId = category.id;
              return (
                <div
                  key={categoryId}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleCategory(categoryId)}
                    className="w-full flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon}</span>
                      <div className="text-left">
                        <span className="font-bold text-gray-800 dark:text-gray-100">
                          {category.title}
                        </span>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {category.description}
                        </p>
                      </div>
                    </div>
                    {expandedCategories[categoryId] ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </button>

                  {expandedCategories[categoryId] && (
                    <div className="p-4 space-y-4 bg-white dark:bg-gray-800">
                      {category.ecfrUrl && (
                        <a
                          href={_getEcfrUrl(categoryId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View official text at eCFR.gov
                        </a>
                      )}

                      {category.regulations.map((reg, index) =>
                        !_regMatchesSearch(reg) ? null : (
                          <div
                            key={index}
                            className="border-2 border-amber-100 dark:border-amber-900 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-900/20"
                          >
                            <h4 className="font-bold text-amber-900 dark:text-amber-200 mb-2">
                              {reg.section}: {reg.title}
                            </h4>

                            <p className="text-gray-700 dark:text-gray-300 mb-3">
                              {reg.summary}
                            </p>

                            {reg.keyPoints && reg.keyPoints.length > 0 && (
                              <div className="mb-3">
                                <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                  Key Points:
                                </h5>
                                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                  {reg.keyPoints.map((point, i) => (
                                    <li
                                      key={i}
                                      className="flex items-start gap-2"
                                    >
                                      <span className="text-amber-500 mt-1">
                                        →
                                      </span>
                                      <span>{point}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {reg.veteranTip && (
                              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                  <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-semibold text-green-800 dark:text-green-200 text-sm">
                                      Veteran Tip:{" "}
                                    </span>
                                    <span className="text-sm text-green-700 dark:text-green-300">
                                      {reg.veteranTip}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === "forms" && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            Essential VA Forms for Claims
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Using the correct forms is critical for proper claim processing.
            Here are the key forms referenced in 38 CFR Part 3.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {cfr3Regulations.keyForms.map((form, index) => (
              <a
                key={index}
                href={form.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {form.form}
                    </h4>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {form.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {form.use}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-2">
                      <ExternalLink className="h-3 w-3" /> Access Form
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {activeTab === "deadlines" && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            Critical Deadlines & Timelines
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Missing deadlines can cost you months or years of back-pay. These
            are the most important timelines in 38 CFR Part 3.
          </p>

          <div className="space-y-4">
            {cfr3Regulations.criticalTimelines.map((timeline, index) => (
              <div
                key={index}
                className="p-4 border-2 border-red-100 dark:border-red-900 bg-red-50/50 dark:bg-red-900/20 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <Clock className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-red-800 dark:text-red-200 text-lg">
                      {timeline.deadline}
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 mt-1">
                      <strong className="text-green-700 dark:text-green-400">
                        Why it matters:{" "}
                      </strong>
                      {timeline.importance}
                    </p>
                    <p className="text-red-700 dark:text-red-300 mt-2 text-sm">
                      <strong>?? Consequence: </strong>
                      {timeline.consequence}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "mistakes" && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            Common Mistakes to Avoid
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            These common mistakes cost veterans time, money, and benefits. Learn
            from others' experiences.
          </p>

          <div className="space-y-4">
            {cfr3Regulations.commonMistakes.map((mistake, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800 dark:text-gray-100">
                      ? {mistake.mistake}
                    </h4>
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      <strong>Impact: </strong>
                      {mistake.impact}
                    </p>
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                      <p className="text-green-700 dark:text-green-300 text-sm">
                        <strong>? Solution: </strong>
                        {mistake.solution}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Footer */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Source:</strong>{" "}
            <a
              href="https://www.ecfr.gov/current/title-38"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              38 CFR Title 38 - Pensions, Bonuses, and Veterans' Relief
              (eCFR.gov)
            </a>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            eCFR current as of{" "}
            {cfr3Regulations.revisionInfo?.displayDate || "1/15/2026"} — Last
            amended {cfr3Regulations.revisionInfo?.lastAmended || "1/09/2026"}
          </p>
        </div>
      </div>
    </ResponsiveModal>
  );
};

export default RegulationsReference;
