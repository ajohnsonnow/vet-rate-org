/**
 * Vet-Rate.org - C-File Timeline Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Visual timeline display of events extracted from C-File analysis
 */

import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";

// Category colors and icons
const CATEGORY_STYLES = {
  injury: {
    bg: "bg-red-100 dark:bg-red-900/40",
    border: "border-red-400",
    text: "text-red-800 dark:text-red-200",
    icon: "🤕",
  },
  medical_visit: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    border: "border-blue-400",
    text: "text-blue-800 dark:text-blue-200",
    icon: "🏥",
  },
  combat_award: {
    bg: "bg-purple-100 dark:bg-purple-900/40",
    border: "border-purple-400",
    text: "text-purple-800 dark:text-purple-200",
    icon: "🎖️",
  },
  diagnosis: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    border: "border-amber-400",
    text: "text-amber-800 dark:text-amber-200",
    icon: "📋",
  },
  exposure: {
    bg: "bg-orange-100 dark:bg-orange-900/40",
    border: "border-orange-400",
    text: "text-orange-800 dark:text-orange-200",
    icon: "☢️",
  },
  surgery: {
    bg: "bg-pink-100 dark:bg-pink-900/40",
    border: "border-pink-400",
    text: "text-pink-800 dark:text-pink-200",
    icon: "🔪",
  },
  mental_health: {
    bg: "bg-indigo-100 dark:bg-indigo-900/40",
    border: "border-indigo-400",
    text: "text-indigo-800 dark:text-indigo-200",
    icon: "🧠",
  },
  medication: {
    bg: "bg-green-100 dark:bg-green-900/40",
    border: "border-green-400",
    text: "text-green-800 dark:text-green-200",
    icon: "💊",
  },
  default: {
    bg: "bg-gray-100 dark:bg-gray-800",
    border: "border-gray-400",
    text: "text-gray-800 dark:text-gray-200",
    icon: "📄",
  },
};

const SIGNIFICANCE_STYLES = {
  high: "ring-2 ring-red-500 ring-offset-2 dark:ring-offset-gray-900",
  medium: "ring-1 ring-amber-400 ring-offset-1 dark:ring-offset-gray-900",
  low: "",
};

const TimelineEventCard = ({ event, isExpanded, onToggle, getStyle }) => {
  const style = getStyle(event.category);

  return (
    <div className="relative flex gap-4">
      {/* Timeline dot */}
      <div
        className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full ${style.bg} ${style.border} border-2 flex items-center justify-center text-xl ${SIGNIFICANCE_STYLES[event.significance] || ""}`}
      >
        {style.icon}
      </div>

      {/* Event card */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={`flex-1 ${style.bg} border ${style.border} rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${isExpanded ? "shadow-md" : ""}`}
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-semibold ${style.text}`}>
                {event.date || "Date Unknown"}
              </span>
              {event.body_part && event.body_part !== "Systemic" && (
                <span className="text-xs bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded">
                  🎯 {event.body_part}
                </span>
              )}
              {event.significance === "high" && (
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-medium">
                  HIGH
                </span>
              )}
            </div>

            <p className={`mt-1 font-medium ${style.text}`}>
              {event.description}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded font-mono">
              p.{event.page_number}
            </span>
            <span className="text-gray-400 dark:text-gray-500 text-sm">
              {isExpanded ? "▲" : "▼"}
            </span>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && event.quote && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Direct Quote from Record:
            </p>
            <blockquote className="text-sm italic text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-black/20 p-3 rounded border-l-4 border-gray-400">
              &quot;{event.quote}&quot;
            </blockquote>
          </div>
        )}
      </div>
    </div>
  );
};

const TimelineFilters = ({
  filter,
  setFilter,
  showHighSignificanceOnly,
  setShowHighSignificanceOnly,
  events,
  categories,
  getStyle,
}) => (
  <div className="mb-6 flex flex-wrap items-center gap-4">
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Filter:
      </label>
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
      >
        <option value="all">All Events ({events.length})</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {getStyle(cat).icon} {cat.replace("_", " ")} (
            {events.filter((e) => e.category === cat).length})
          </option>
        ))}
      </select>
    </div>

    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={showHighSignificanceOnly}
        onChange={(e) => setShowHighSignificanceOnly(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700 dark:text-gray-300">
        High significance only (
        {events.filter((e) => e.significance === "high").length})
      </span>
    </label>
  </div>
);

const TimelineLegend = () => (
  <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
      Event Categories:
    </p>
    <div className="flex flex-wrap gap-2">
      {Object.entries(CATEGORY_STYLES)
        .filter(([key]) => key !== "default")
        .map(([key, style]) => (
          <span
            key={key}
            className={`text-xs ${style.bg} ${style.text} px-3 py-1 rounded-full border ${style.border}`}
          >
            {style.icon} {key.replace("_", " ")}
          </span>
        ))}
    </div>
  </div>
);

export default function CFileTimeline({ events = [] }) {
  const { _t } = useLanguage();
  const [filter, setFilter] = useState("all");
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [showHighSignificanceOnly, setShowHighSignificanceOnly] =
    useState(false);

  // Get unique categories for filter
  const categories = [...new Set(events.map((e) => e.category))];

  // Filter events
  const filteredEvents = events.filter((event) => {
    if (filter !== "all" && event.category !== filter) return false;
    if (showHighSignificanceOnly && event.significance !== "high") return false;
    return true;
  });

  const getStyle = (category) =>
    CATEGORY_STYLES[category] || CATEGORY_STYLES.default;

  return (
    <div className="p-6">
      <TimelineFilters
        filter={filter}
        setFilter={setFilter}
        showHighSignificanceOnly={showHighSignificanceOnly}
        setShowHighSignificanceOnly={setShowHighSignificanceOnly}
        events={events}
        categories={categories}
        getStyle={getStyle}
      />

      {/* Results count */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Showing {filteredEvents.length} of {events.length} events
      </p>

      {/* Timeline */}
      {filteredEvents.length > 0 ? (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

          <div className="space-y-4">
            {filteredEvents.map((event, idx) => (
              <TimelineEventCard
                key={idx}
                event={event}
                isExpanded={expandedEvent === idx}
                onToggle={() =>
                  setExpandedEvent(expandedEvent === idx ? null : idx)
                }
                getStyle={getStyle}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-4xl mb-2">📭</p>
          <p>No events match your current filters.</p>
        </div>
      )}

      <TimelineLegend />
    </div>
  );
}
