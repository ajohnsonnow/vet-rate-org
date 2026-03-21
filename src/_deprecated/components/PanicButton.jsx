/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * PANIC BUTTON - "Boss Key" / Instant Privacy
 * Press ESC three times rapidly (or Ctrl+Space) to instantly hide the app
 * Replaces screen with innocuous content
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";

// Configuration
const RAPID_ESC_THRESHOLD = 800; // ms between ESC presses to count as "rapid"
const ESC_COUNT_REQUIRED = 3; // Number of ESC presses needed
const STORAGE_KEY = "vet-rate-panic-enabled";

const PanicButton = ({
  isEnabled = true,
  coverType = "google", // 'google', 'excel', 'blank', 'news'
  alternateKeys = ["Escape", "Escape", "Escape"], // Default: ESC x3
}) => {
  const { t } = useLanguage();

  const [isHidden, setIsHidden] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const escPressTimesRef = useRef([]);
  const hintTimeoutRef = useRef(null);

  // Handle key press
  const handleKeyPress = useCallback(
    (event) => {
      if (!isEnabled) return;

      const now = Date.now();

      // Check for ESC x3 (default panic key)
      if (event.key === "Escape") {
        escPressTimesRef.current.push(now);

        // Keep only recent presses
        escPressTimesRef.current = escPressTimesRef.current.filter(
          (time) => now - time < RAPID_ESC_THRESHOLD,
        );

        // Check if we have enough rapid presses
        if (escPressTimesRef.current.length >= ESC_COUNT_REQUIRED) {
          event.preventDefault();
          toggleHidden();
          escPressTimesRef.current = [];
        }
      }

      // Alternative: Ctrl+Space
      if (event.ctrlKey && event.code === "Space") {
        event.preventDefault();
        toggleHidden();
      }

      // Alternative: Alt+H (for "Hide")
      if (event.altKey && event.key === "h") {
        event.preventDefault();
        toggleHidden();
      }
    },
    [isEnabled],
  );

  // Toggle hidden state
  const toggleHidden = () => {
    setIsHidden((prev) => !prev);
    console.log(isHidden ? "👁️ App revealed" : "🚨 PANIC MODE: App hidden");
  };

  // Show hint on hover over corner
  const handleCornerHover = () => {
    if (isHidden) {
      setShowHint(true);

      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
      }

      hintTimeoutRef.current = setTimeout(() => {
        setShowHint(false);
      }, 3000);
    }
  };

  // Set up keyboard listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
      }
    };
  }, [handleKeyPress]);

  // Apply body class when hidden
  useEffect(() => {
    if (isHidden) {
      document.body.classList.add("panic-mode-active");
    } else {
      document.body.classList.remove("panic-mode-active");
    }
  }, [isHidden]);

  if (!isEnabled) return null;

  // Render cover screens
  if (isHidden) {
    return (
      <>
        {/* Google Search Cover */}
        {coverType === "google" && (
          <div className="fixed inset-0 bg-white z-[10001] overflow-hidden">
            <div className="flex flex-col items-center justify-center min-h-screen">
              {/* Google Logo */}
              <div className="mb-8">
                <svg width="272" height="92" viewBox="0 0 272 92" fill="none">
                  <text
                    x="10"
                    y="70"
                    fontFamily="Arial"
                    fontSize="80"
                    fontWeight="bold"
                  >
                    <tspan fill="#4285F4">G</tspan>
                    <tspan fill="#EA4335">o</tspan>
                    <tspan fill="#FBBC04">o</tspan>
                    <tspan fill="#4285F4">g</tspan>
                    <tspan fill="#34A853">l</tspan>
                    <tspan fill="#EA4335">e</tspan>
                  </text>
                </svg>
              </div>

              {/* Search Box */}
              <div className="w-full max-w-xl px-4">
                <div className="flex items-center border border-gray-300 rounded-full px-4 py-3 shadow-md hover:shadow-lg transition-shadow">
                  <svg
                    className="w-5 h-5 text-gray-400 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    className="flex-1 outline-none text-gray-700"
                    placeholder="Search Google or type a URL"
                    readOnly
                  />
                  <svg
                    className="w-5 h-5 text-gray-400 ml-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 mt-8">
                <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded border border-gray-300">
                  Google Search
                </button>
                <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded border border-gray-300">
                  I'm Feeling Lucky
                </button>
              </div>
            </div>

            {/* Restore hint (hover bottom-right corner) */}
            <div
              className="fixed bottom-0 right-0 w-20 h-20 cursor-pointer"
              onMouseEnter={handleCornerHover}
              title="Press ESC x3 to restore"
            />

            {showHint && (
              <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg animate-fade-in">
                Press <kbd className="px-1 bg-gray-700 rounded">ESC</kbd> x3 to
                restore
              </div>
            )}
          </div>
        )}

        {/* Excel Spreadsheet Cover */}
        {coverType === "excel" && (
          <div className="fixed inset-0 bg-white z-[10001] overflow-hidden">
            {/* Excel Ribbon */}
            <div className="bg-gradient-to-b from-green-600 to-green-700 text-white px-4 py-2 text-sm">
              <div className="flex items-center gap-4">
                <span className="font-bold">File</span>
                <span>Home</span>
                <span>Insert</span>
                <span>Page Layout</span>
                <span>Formulas</span>
                <span>Data</span>
                <span>Review</span>
                <span>View</span>
              </div>
            </div>

            {/* Toolbar */}
            <div className="bg-gray-100 border-b border-gray-300 px-4 py-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 hover:bg-gray-200 rounded">
                  📄 New
                </button>
                <button className="px-2 py-1 hover:bg-gray-200 rounded">
                  💾 Save
                </button>
                <button className="px-2 py-1 hover:bg-gray-200 rounded">
                  ↩️ Undo
                </button>
                <button className="px-2 py-1 hover:bg-gray-200 rounded">
                  ↪️ Redo
                </button>
              </div>
            </div>

            {/* Spreadsheet Grid */}
            <div className="overflow-hidden">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-300 w-12 py-1"></th>
                    <th className="border border-gray-300 w-24 py-1">A</th>
                    <th className="border border-gray-300 w-24 py-1">B</th>
                    <th className="border border-gray-300 w-24 py-1">C</th>
                    <th className="border border-gray-300 w-24 py-1">D</th>
                    <th className="border border-gray-300 w-24 py-1">E</th>
                    <th className="border border-gray-300 w-24 py-1">F</th>
                  </tr>
                </thead>
                <tbody>
                  {[...Array(20)].map((_, i) => (
                    <tr key={i}>
                      <td className="border border-gray-300 bg-gray-200 text-center py-1">
                        {i + 1}
                      </td>
                      <td className="border border-gray-300 py-1 px-2"></td>
                      <td className="border border-gray-300 py-1 px-2"></td>
                      <td className="border border-gray-300 py-1 px-2"></td>
                      <td className="border border-gray-300 py-1 px-2"></td>
                      <td className="border border-gray-300 py-1 px-2"></td>
                      <td className="border border-gray-300 py-1 px-2"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Restore hint */}
            <div
              className="fixed bottom-0 right-0 w-20 h-20 cursor-pointer"
              onMouseEnter={handleCornerHover}
            />
            {showHint && (
              <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg animate-fade-in">
                Press <kbd className="px-1 bg-gray-700 rounded">ESC</kbd> x3 to
                restore
              </div>
            )}
          </div>
        )}

        {/* Blank / Loading Cover */}
        {coverType === "blank" && (
          <div className="fixed inset-0 bg-gray-900 z-[10001] flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white text-lg">Loading...</p>
            </div>

            {/* Restore hint */}
            <div
              className="fixed bottom-0 right-0 w-20 h-20 cursor-pointer"
              onMouseEnter={handleCornerHover}
            />
            {showHint && (
              <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg animate-fade-in">
                Press <kbd className="px-1 bg-gray-700 rounded">ESC</kbd> x3 to
                restore
              </div>
            )}
          </div>
        )}

        {/* News Website Cover */}
        {coverType === "news" && (
          <div className="fixed inset-0 bg-white z-[10001] flex items-center justify-center p-4">
            {/* Header */}
            <div className="border-b border-gray-300 px-4 py-3">
              <div className="flex items-center justify-between max-w-6xl mx-auto">
                <div className="text-2xl font-serif font-bold">
                  The Daily News
                </div>
                <div className="text-sm text-gray-600">
                  Saturday, January 18, 2026
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 py-8">
              <div className="grid grid-cols-3 gap-8">
                <div className="col-span-2">
                  <h1 className="text-4xl font-bold mb-4">
                    Breaking News: Markets React to Latest Reports
                  </h1>
                  <div className="h-64 bg-gray-300 mb-4"></div>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
                    do eiusmod tempor incididunt ut labore et dolore magna
                    aliqua. Ut enim ad minim veniam, quis nostrud exercitation
                    ullamco laboris.
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    Duis aute irure dolor in reprehenderit in voluptate velit
                    esse cillum dolore eu fugiat nulla pariatur. Excepteur sint
                    occaecat cupidatat non proident.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold mb-4">Latest Stories</h3>
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="border-b border-gray-200 pb-4">
                        <div className="h-20 bg-gray-300 mb-2"></div>
                        <h4 className="font-semibold text-sm">
                          Article Headline {i}
                        </h4>
                        <p className="text-xs text-gray-600">2 hours ago</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Restore hint */}
            <div
              className="fixed bottom-0 right-0 w-20 h-20 cursor-pointer"
              onMouseEnter={handleCornerHover}
            />
            {showHint && (
              <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg animate-fade-in">
                Press <kbd className="px-1 bg-gray-700 rounded">ESC</kbd> x3 to
                restore
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return null;
};

// CSS to add to global styles
export const panicButtonStyles = `
  .panic-mode-active #root {
    display: none !important;
  }

  kbd {
    font-family: monospace;
    font-size: 0.9em;
  }
`;

export default PanicButton;
