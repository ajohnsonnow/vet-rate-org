/**
 * Vet-Rate.org - The Needle Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * "Find the Evidence" - PDF Keyword Search Interface
 * 
 * Helps veterans find specific mentions in 2,000+ page Service Treatment Records
 */

import React, { useState, useCallback, useRef } from 'react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { 
  searchPdfForKeyword, 
  searchPdfForMultipleKeywords,
  highlightSearchTerm,
  COMMON_MEDICAL_KEYWORDS 
} from '../utils/pdfSearchEngine';

const RecordSearch = ({ onClose }) => {
  useBodyScrollLock(true);

  // File state
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);

  // Options
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  
  // Error handling
  const [error, setError] = useState(null);

  // File handling
  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      loadFile(droppedFile);
    } else {
      setError('Please drop in a PDF file.');
    }
  }, []);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      loadFile(selectedFile);
    }
  };

  const loadFile = async (pdfFile) => {
    setError(null);
    setFile(pdfFile);
    setResults([]);
    
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      setFileData(arrayBuffer);
    } catch (err) {
      setError(`Failed to load PDF: ${err.message}`);
    }
  };

  // Search execution
  const handleSearch = async () => {
    if (!fileData || !searchTerm.trim()) return;

    setIsSearching(true);
    setError(null);
    setResults([]);
    setSearchProgress(0);

    try {
      const searchResults = await searchPdfForKeyword(
        fileData,
        searchTerm,
        {
          caseSensitive,
          wholeWord,
          contextLength: 200,
          onProgress: (current, total) => {
            setSearchProgress(Math.round((current / total) * 100));
          }
        }
      );

      setResults(searchResults.results);
      setTotalMatches(searchResults.totalMatches);
      
      if (searchResults.results.length === 0) {
        setError(`No matches found for "${searchTerm}". Try a different keyword or check spelling.`);
      }
    } catch (err) {
      setError(`Search failed: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleQuickSearch = async (category) => {
    if (!fileData) {
      setError('Please drop in a PDF file first.');
      return;
    }

    const keywords = COMMON_MEDICAL_KEYWORDS[category];
    if (!keywords) return;

    setIsSearching(true);
    setError(null);
    setResults([]);
    setSearchProgress(0);

    try {
      const resultsMap = await searchPdfForMultipleKeywords(
        fileData,
        keywords,
        {
          caseSensitive: false,
          wholeWord: false,
          contextLength: 200,
          onProgress: (current, total) => {
            setSearchProgress(Math.round((current / total) * 100));
          }
        }
      );

      // Combine all results
      const allResults = [];
      let totalCount = 0;
      
      resultsMap.forEach((keywordResults, keyword) => {
        totalCount += keywordResults.length;
        keywordResults.forEach(result => {
          allResults.push({
            ...result,
            keyword: keyword
          });
        });
      });

      // Sort by page number
      allResults.sort((a, b) => a.page - b.page);

      setResults(allResults);
      setTotalMatches(totalCount);
      
      if (allResults.length === 0) {
        setError(`No matches found for ${category} keywords. Try dropping in the correct record file.`);
      }
    } catch (err) {
      setError(`Search failed: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Render
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-blue-500/30">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🔍</div>
            <div>
              <h1 className="text-xl font-bold text-white">
                The Needle in the Haystack
              </h1>
              <p className="text-blue-100 text-sm">
                Search 2,000+ page PDFs in seconds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-200 transition-colors text-2xl font-bold"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          
          {/* Explainer */}
          {!file && (
            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-400/30 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="text-4xl">⚡</div>
                <div>
                  <h2 className="text-xl font-bold text-yellow-300 mb-2">
                    Find Evidence Instantly
                  </h2>
                  <p className="text-gray-300 mb-3">
                    Your Service Treatment Record (STR) or C-File might be thousands of pages. You know you hurt your 
                    back in 2006, but which page documents it?
                  </p>
                  <p className="text-gray-300 font-semibold">
                    This tool searches the entire PDF in seconds and shows you <span className="text-white">exact page numbers + context</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* File Upload Zone */}
          {!file && (
            <div
              onDrop={handleFileDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
                isDragging 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
              }`}
            >
              <div className="text-6xl mb-4">📄</div>
              <p className="text-xl text-gray-300 mb-2">
                Drop your STR or C-File PDF here
              </p>
              <p className="text-sm text-gray-400 mb-4">
                or click to browse
              </p>
              <p className="text-xs text-gray-500">
                All processing happens locally in your browser. No upload to servers.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* File Loaded */}
          {file && (
            <div className="space-y-6">
              
              {/* File Info */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">✅</div>
                  <div>
                    <p className="text-white font-semibold">{file.name}</p>
                    <p className="text-sm text-gray-400">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setFileData(null);
                    setResults([]);
                  }}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors"
                >
                  Remove
                </button>
              </div>

              {/* Search Box */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  🔎 Search for keyword:
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="e.g., lumbar, knee, anxiety, tinnitus..."
                    className="flex-1 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSearching}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchTerm.trim()}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                  >
                    {isSearching ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {/* Search Options */}
                <div className="flex gap-4 mt-3">
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={caseSensitive}
                      onChange={(e) => setCaseSensitive(e.target.checked)}
                      className="rounded"
                    />
                    Case Sensitive
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wholeWord}
                      onChange={(e) => setWholeWord(e.target.checked)}
                      className="rounded"
                    />
                    Whole Word Only
                  </label>
                </div>
              </div>

              {/* Quick Search Buttons */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  ⚡ Quick Search by Category:
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Object.keys(COMMON_MEDICAL_KEYWORDS).map((category) => (
                    <button
                      key={category}
                      onClick={() => handleQuickSearch(category)}
                      disabled={isSearching}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white text-sm rounded transition-colors capitalize"
                    >
                      {category.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress Bar */}
              {isSearching && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="animate-spin text-2xl">🔄</div>
                    <p className="text-gray-300">Searching... {searchProgress}%</p>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${searchProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-lg p-4">
                  <p className="text-yellow-300 text-sm">
                    ⚠️ {error}
                  </p>
                </div>
              )}

              {/* Results */}
              {results.length > 0 && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-green-400 mb-4">
                    ✅ Found {totalMatches} {totalMatches === 1 ? 'match' : 'matches'} across {results.length} locations
                  </h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {results.map((result, index) => (
                      <div
                        key={index}
                        className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                            Page {result.page}
                          </span>
                          {result.keyword && (
                            <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                              {result.keyword}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-gray-300 text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: highlightSearchTerm(result.context, result.matchText || searchTerm)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Citation Helper */}
              {results.length > 0 && (
                <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-400/30 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-green-300 mb-3">
                    💡 How to Use These Results:
                  </h3>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-green-400">✓</span>
                      <span>
                        <strong>In your personal statement:</strong> "As documented on Page {results[0].page} of my Service Treatment Records..."
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400">✓</span>
                      <span>
                        <strong>For your VSO:</strong> Give them the page numbers to attach as evidence
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400">✓</span>
                      <span>
                        <strong>In your nexus letter:</strong> Ask your doctor to reference these specific pages
                      </span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordSearch;
