/**
 * VERSION DROPDOWN
 *
 * Displays version with dropdown changelog matching What's New modal
 */

import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Sparkles,
  Wrench,
  Shield,
  Zap,
  CheckCircle,
  Rocket,
} from "lucide-react";
import { generateWhatsNewChangelog } from "../utils/changelogGenerator";
import { useLanguage } from "../contexts/LanguageContext";

const getIcon = (type, isNew) => {
  if (isNew) return <Rocket className="w-4 h-4 text-emerald-500" />;
  switch (type) {
    case "feature":
      return (
        <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />
      );
    case "fix":
      return <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    case "security":
      return <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />;
    case "improvement":
      return <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
    default:
      return (
        <CheckCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      );
  }
};

const getTypeBadgeColor = (type, isNew) => {
  if (isNew) return "bg-gradient-to-r from-emerald-500 to-green-500 text-white";
  const colors = {
    feature:
      "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    fix: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    security: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    improvement:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  };
  return (
    colors[type] ||
    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
  );
};

const getTypeLabel = (type, isNew) => {
  if (isNew) return "🆕 NEW";
  const labels = {
    feature: "Feature",
    fix: "Bug Fix",
    security: "Security",
    improvement: "Improvement",
    change: "Change",
  };
  return labels[type] || "Update";
};

const ChangelogItem = ({ item }) => (
  <div className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 py-1">
    <div className="flex items-start gap-2 mb-1">
      {getIcon(item.type, item.isNew)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeBadgeColor(item.type, item.isNew)}`}
          >
            {getTypeLabel(item.type, item.isNew)}
          </span>
          {item.category && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {item.category}
            </span>
          )}
        </div>
        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-0.5">
          {item.title}
        </h4>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          {item.description}
        </p>
      </div>
    </div>
  </div>
);

const VersionDropdown = () => {
  const { _t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [changelogData, setChangelogData] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const data = generateWhatsNewChangelog();
    setChangelogData(data);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!changelogData) {
    return (
      <button
        className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded border border-white/40 transition-colors"
        aria-label="Loading version information..."
      >
        v1.0.0
      </button>
    );
  }

  const { version, changelog } = changelogData;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded border border-white/40 transition-colors flex items-center gap-1"
        aria-label="View version changelog"
      >
        v{version}
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 max-h-[500px] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 rounded-t-lg sticky top-0">
            <h3 className="font-bold text-lg">What&apos;s New</h3>
            <p className="text-emerald-100 text-xs">Version {version}</p>
          </div>

          {/* Changelog Items */}
          <div className="p-3 space-y-3">
            {changelog.map((item, index) => (
              <ChangelogItem key={index} item={item} />
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3 text-center bg-gray-50 dark:bg-gray-900 rounded-b-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              © 2024-2026 Anthony Johnson
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionDropdown;
