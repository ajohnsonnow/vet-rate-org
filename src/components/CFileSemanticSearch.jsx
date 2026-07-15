/**
 * Vet-Rate.org - C-File Semantic Search (S24)
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Meaning-based search over the veteran's OWN just-analyzed document. Unlike
 * the literal keyword search (pdfSearchEngine.js / RecordSearch.jsx), this
 * finds pages by concept — a veteran searching "ringing in my ears" surfaces
 * the page that says "tinnitus" even with no shared words. Runs 100% on-device
 * against the IndexedDB vector index built during analysis; nothing leaves the
 * device.
 */

import { useState, useCallback, useRef } from "react";
import { semanticSearchDocument } from "../utils/userDocSemanticIndex";

const SemanticSearchBar = ({
  query,
  setQuery,
  onKeyDown,
  runSearch,
  isSearching,
}) => (
  <div className="flex gap-2">
    <label htmlFor="cfile-semantic-query" className="sr-only">
      Search your document
    </label>
    <input
      id="cfile-semantic-query"
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder="e.g. trouble sleeping, back pain, ringing in ears"
      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
    />
    <button
      type="button"
      onClick={runSearch}
      disabled={isSearching || !query.trim()}
      className={`px-5 py-2 rounded-lg font-semibold transition-colors ${
        isSearching || !query.trim()
          ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
          : "bg-violet-600 hover:bg-violet-700 text-white"
      }`}
    >
      {isSearching ? "Searching…" : "🔎 Search"}
    </button>
  </div>
);

const SemanticSearchIntro = ({ excludedPageCount }) => (
  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
    Search your full document by meaning, not exact words — for example “ringing
    in my ears” will find pages that say “tinnitus.”
    {excludedPageCount > 0 && (
      <>
        {" "}
        This covers <strong>all</strong> pages, including the{" "}
        {excludedPageCount} the AI pass skipped.
      </>
    )}
  </p>
);

const SemanticSearchStatus = ({ isSearching, error }) => (
  <>
    {isSearching && (
      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
        Searching on your device… the first search may take a moment while the
        search model loads.
      </p>
    )}

    {error && (
      <div
        role="alert"
        className="mt-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300"
      >
        {error}
      </div>
    )}
  </>
);

const SemanticSearchResults = ({ results, lastQuery }) => {
  if (results.length === 0) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400">
        No pages matched “{lastQuery}.” Try different or broader wording.
      </p>
    );
  }

  return (
    <>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {results.length} page{results.length === 1 ? "" : "s"} most related to “
        {lastQuery}”:
      </p>
      <ul className="space-y-2">
        {results.map((r) => (
          <li
            key={r.page}
            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-violet-700 dark:text-violet-300">
                Page {r.page}
              </span>
              <span className="text-xs text-gray-400">
                {Math.round(Math.max(0, Math.min(1, r.score)) * 100)}% match
              </span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {r.snippet}
              {r.snippet && r.snippet.length >= 240 ? "…" : ""}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
};

export default function CFileSemanticSearch({
  sessionKey,
  excludedPageCount = 0,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = not searched yet
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const lastQueryRef = useRef("");

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q || !sessionKey) return;
    setIsSearching(true);
    setError(null);
    lastQueryRef.current = q;
    try {
      const hits = await semanticSearchDocument({
        sessionKey,
        queryText: q,
        topK: 15,
      });
      setResults(hits);
    } catch (err) {
      // First search loads the ~30 MB embedder; a failure here (offline first
      // run, unsupported device) must not crash the results dashboard.
      console.warn("Semantic search failed:", err);
      setError(
        "Search is unavailable on this device or the search model could not load. Try the keyword search instead.",
      );
      setResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [query, sessionKey]);

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  };

  if (!sessionKey) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Semantic search is not available for this analysis (the search index
        could not be built on this device).
      </div>
    );
  }

  return (
    <div>
      <SemanticSearchIntro excludedPageCount={excludedPageCount} />

      <SemanticSearchBar
        query={query}
        setQuery={setQuery}
        onKeyDown={onKeyDown}
        runSearch={runSearch}
        isSearching={isSearching}
      />

      <SemanticSearchStatus isSearching={isSearching} error={error} />

      {results && !isSearching && (
        <div className="mt-4">
          <SemanticSearchResults
            results={results}
            lastQuery={lastQueryRef.current}
          />
        </div>
      )}
    </div>
  );
}
