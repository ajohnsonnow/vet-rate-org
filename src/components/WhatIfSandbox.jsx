/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * The What-If Sandbox - Visual Scenario Planner
 * Drag-and-drop interface for testing combined rating calculations
 */

import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useBodyScrollLock } from "../utils/useBodyScrollLock";
import { getMyRatings, hasMyRatings } from "../utils/veteranProfile";

export default function WhatIfSandbox({ onClose }) {
  const { t } = useLanguage();

  // Lock background scroll when modal is open
  useBodyScrollLock(true);

  const [currentConditions, setCurrentConditions] = useState([]);
  const [availableConditions, setAvailableConditions] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [combinedRating, setCombinedRating] = useState(0);
  const [monthlyPay, setMonthlyPay] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Common VA disabilities with typical ratings
  const commonConditions = [
    { name: "PTSD", ratings: [10, 30, 50, 70, 100], category: "mental" },
    { name: "Sleep Apnea", ratings: [0, 30, 50, 100], category: "respiratory" },
    { name: "Tinnitus", ratings: [10], category: "auditory" },
    { name: "Migraine", ratings: [0, 30, 50], category: "neurological" },
    {
      name: "Knee (Left)",
      ratings: [0, 10, 20, 30, 40, 50, 60],
      category: "musculoskeletal",
    },
    {
      name: "Knee (Right)",
      ratings: [0, 10, 20, 30, 40, 50, 60],
      category: "musculoskeletal",
    },
    {
      name: "Back (Lumbar)",
      ratings: [10, 20, 40, 50, 60, 100],
      category: "musculoskeletal",
    },
    {
      name: "Shoulder (Left)",
      ratings: [0, 10, 20, 30, 40, 50],
      category: "musculoskeletal",
    },
    {
      name: "Shoulder (Right)",
      ratings: [0, 10, 20, 30, 40, 50],
      category: "musculoskeletal",
    },
    { name: "Depression", ratings: [10, 30, 50, 70, 100], category: "mental" },
    { name: "Anxiety", ratings: [10, 30, 50, 70, 100], category: "mental" },
    { name: "TBI", ratings: [0, 10, 40, 70, 100], category: "neurological" },
    {
      name: "Hypertension",
      ratings: [0, 10, 20, 40, 60],
      category: "cardiovascular",
    },
    { name: "IBS", ratings: [0, 10, 30], category: "digestive" },
    {
      name: "Diabetes Type II",
      ratings: [10, 20, 40, 60, 100],
      category: "endocrine",
    },
  ];

  // 2025 VA Compensation Rates (Veterans without dependents)
  const compensationRates = {
    0: 0,
    10: 171.23,
    20: 338.49,
    30: 524.31,
    40: 755.28,
    50: 1075.16,
    60: 1361.88,
    70: 1716.28,
    80: 1995.01,
    90: 2241.91,
    100: 3737.85,
  };

  useEffect(() => {
    // Generate all possible condition combinations
    const conditions = [];
    commonConditions.forEach((condition) => {
      condition.ratings.forEach((rating) => {
        conditions.push({
          id: `${condition.name}-${rating}-${Date.now()}-${Math.random()}`,
          name: condition.name,
          rating: rating,
          category: condition.category,
        });
      });
    });
    setAvailableConditions(conditions);

    // Load saved claims if any
    loadCurrentClaims();
  }, []);

  useEffect(() => {
    calculateCombinedRating();
  }, [currentConditions]);

  const loadCurrentClaims = () => {
    try {
      const saved = localStorage.getItem("savedClaims");
      if (saved) {
        const claims = JSON.parse(saved);
        const conditions = claims
          .filter((c) => c.rating && c.rating > 0)
          .map((c) => ({
            id: `${c.condition}-${c.rating}-${Date.now()}-${Math.random()}`,
            name: c.condition,
            rating: c.rating,
            category: "saved",
          }));
        setCurrentConditions(conditions);
      }
    } catch (e) {
      console.error("Failed to load saved claims:", e);
    }
  };

  const handleLoadMyRatings = () => {
    const savedRatings = getMyRatings();
    if (savedRatings && savedRatings.length > 0) {
      const formatted = savedRatings.map((r) => ({
        id: `${r.condition}-${r.rating}-${Date.now()}-${Math.random()}`,
        name: r.condition,
        rating: r.rating,
        category: "user",
      }));
      setCurrentConditions(formatted);
    } else {
      alert(
        "No saved ratings found. Use Secondary Scout to import your VA ratings first.",
      );
    }
  };

  const calculateCombinedRating = () => {
    if (currentConditions.length === 0) {
      setCombinedRating(0);
      setMonthlyPay(0);
      return;
    }

    // Sort ratings highest to first
    const ratings = [...currentConditions]
      .sort((a, b) => b.rating - a.rating)
      .map((c) => c.rating);

    // Check for bilateral conditions
    const hasBilateralKnees = hasMatchingBilateral("Knee");
    const hasBilateralShoulders = hasMatchingBilateral("Shoulder");

    let combined = ratings[0];

    // Apply bilateral factor if applicable
    if (hasBilateralKnees || hasBilateralShoulders) {
      const bilateralRatings = [];
      const otherRatings = [];

      currentConditions.forEach((c) => {
        if (
          (c.name.includes("Knee") && hasBilateralKnees) ||
          (c.name.includes("Shoulder") && hasBilateralShoulders)
        ) {
          bilateralRatings.push(c.rating);
        } else {
          otherRatings.push(c.rating);
        }
      });

      if (bilateralRatings.length === 2) {
        // Calculate bilateral combined rating
        bilateralRatings.sort((a, b) => b - a);
        let bilateralCombined = bilateralRatings[0];
        const efficiency = 100 - bilateralCombined;
        const addition = Math.round((bilateralRatings[1] * efficiency) / 100);
        bilateralCombined += addition;

        // Apply 10% bilateral factor
        bilateralCombined = Math.round(bilateralCombined * 1.1);

        // Now combine with other ratings
        otherRatings.sort((a, b) => b - a);
        combined = bilateralCombined;

        for (let i = 0; i < otherRatings.length; i++) {
          const efficiency = 100 - combined;
          const addition = Math.round((otherRatings[i] * efficiency) / 100);
          combined += addition;
        }
      }
    } else {
      // Standard VA combined rating formula
      for (let i = 1; i < ratings.length; i++) {
        const efficiency = 100 - combined;
        const addition = Math.round((ratings[i] * efficiency) / 100);
        combined += addition;
      }
    }

    // Round to nearest 10
    const finalRating = Math.round(combined / 10) * 10;
    setCombinedRating(finalRating);

    // Calculate monthly pay
    const pay = compensationRates[finalRating] || 0;
    setMonthlyPay(pay);

    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const hasMatchingBilateral = (bodyPart) => {
    const left = currentConditions.find(
      (c) => c.name.includes(bodyPart) && c.name.includes("Left"),
    );
    const right = currentConditions.find(
      (c) => c.name.includes(bodyPart) && c.name.includes("Right"),
    );
    return left && right && left.rating > 0 && right.rating > 0;
  };

  const handleDragStart = (e, condition) => {
    setDraggedItem(condition);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setHoveredIndex(index);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedItem) {
      const newConditions = [...currentConditions];
      const newCondition = {
        ...draggedItem,
        id: `${draggedItem.name}-${draggedItem.rating}-${Date.now()}-${Math.random()}`,
      };
      newConditions.splice(index, 0, newCondition);
      setCurrentConditions(newConditions);
      setDraggedItem(null);
      setHoveredIndex(null);
    }
  };

  const handleDropOnCanvas = (e) => {
    e.preventDefault();
    if (draggedItem) {
      const newCondition = {
        ...draggedItem,
        id: `${draggedItem.name}-${draggedItem.rating}-${Date.now()}-${Math.random()}`,
      };
      setCurrentConditions([...currentConditions, newCondition]);
      setDraggedItem(null);
    }
  };

  const removeCondition = (id) => {
    setCurrentConditions(currentConditions.filter((c) => c.id !== id));
  };

  const clearAll = () => {
    setCurrentConditions([]);
  };

  const getCategoryColor = (category) => {
    const colors = {
      mental: "bg-purple-500",
      respiratory: "bg-cyan-500",
      auditory: "bg-yellow-500",
      neurological: "bg-red-500",
      musculoskeletal: "bg-blue-500",
      cardiovascular: "bg-pink-500",
      digestive: "bg-green-500",
      endocrine: "bg-orange-500",
      saved: "bg-gray-500",
    };
    return colors[category] || "bg-gray-500";
  };

  const getRatingColor = (rating) => {
    if (rating >= 70) return "text-red-600 dark:text-red-400";
    if (rating >= 50) return "text-orange-600 dark:text-orange-400";
    if (rating >= 30) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold mb-2">
                🎯 The What-If Sandbox{" "}
                <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">
                  BETA
                </span>
              </h2>
              <p className="text-white/90">
                Visual drag-and-drop scenario planner with real-time VA math
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Result Display */}
          <div
            className={`mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-6 transition-all duration-300 ${
              isAnimating ? "scale-105" : "scale-100"
            }`}
          >
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-white/75 mb-1">Combined VA Rating</p>
                <p
                  className={`text-5xl font-bold transition-all duration-300 ${
                    isAnimating ? "scale-110" : "scale-100"
                  }`}
                >
                  {combinedRating}%
                </p>
              </div>
              <div>
                <p className="text-sm text-white/75 mb-1">
                  Monthly Compensation
                </p>
                <p
                  className={`text-5xl font-bold transition-all duration-300 ${
                    isAnimating ? "scale-110 text-green-300" : "scale-100"
                  }`}
                >
                  ${monthlyPay.toFixed(2)}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  2025 rates (no dependents)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-4 h-[calc(90vh-250px)]">
          {/* Sidebar - Available Conditions */}
          <div className="col-span-1 border-r border-gray-300 dark:border-gray-700 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3">
              📦 Condition Library
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              Drag conditions to the canvas →
            </p>

            {/* Group by category */}
            {[
              "mental",
              "musculoskeletal",
              "neurological",
              "respiratory",
              "cardiovascular",
              "digestive",
              "endocrine",
              "auditory",
            ].map((category) => {
              const categoryConditions = availableConditions.filter(
                (c) => c.category === category,
              );
              if (categoryConditions.length === 0) return null;

              return (
                <div key={category} className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                    {category}
                  </h4>
                  <div className="space-y-1">
                    {categoryConditions.map((condition) => (
                      <div
                        key={condition.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, condition)}
                        className={`${getCategoryColor(condition.category)} text-white p-2 rounded cursor-move text-xs hover:opacity-80 transition-opacity flex justify-between items-center`}
                      >
                        <span>{condition.name}</span>
                        <span className="font-bold">{condition.rating}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Canvas - Current Scenario */}
          <div className="col-span-3 p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                🎨 Current Scenario ({currentConditions.length} conditions)
              </h3>
              <div className="flex gap-2">
                {hasMyRatings() && (
                  <button
                    onClick={handleLoadMyRatings}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors"
                  >
                    📊 Load My Ratings
                  </button>
                )}
                {currentConditions.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {currentConditions.length === 0 ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropOnCanvas}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center"
              >
                <div className="text-6xl mb-4">👈</div>
                <h4 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Drag Conditions Here
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Build your scenario by dragging conditions from the library
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  Watch the combined rating and monthly pay update in real-time!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentConditions.map((condition, index) => (
                  <div key={condition.id}>
                    {hoveredIndex === index && (
                      <div
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        className="h-12 border-2 border-dashed border-blue-400 rounded-lg bg-blue-50 dark:bg-blue-900/20 mb-2"
                      />
                    )}
                    <div
                      className={`${getCategoryColor(condition.category)} text-white p-4 rounded-lg flex justify-between items-center`}
                    >
                      <div>
                        <span className="font-bold text-lg">
                          {condition.name}
                        </span>
                        <span className="ml-3 text-sm opacity-75 capitalize">
                          ({condition.category})
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-3xl font-bold">
                          {condition.rating}%
                        </span>
                        <button
                          onClick={() => removeCondition(condition.id)}
                          className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                          aria-label="Remove condition"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bilateral Bonus Indicator */}
            {(hasMatchingBilateral("Knee") ||
              hasMatchingBilateral("Shoulder")) && (
              <div className="mt-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 p-4 rounded">
                <h4 className="font-bold text-green-800 dark:text-green-300 mb-2 flex items-center gap-2">
                  <span>🎖️</span> Bilateral Factor Applied!
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {hasMatchingBilateral("Knee") &&
                    "Both knees rated: 10% bonus applied."}
                  {hasMatchingBilateral("Shoulder") &&
                    " Both shoulders rated: 10% bonus applied."}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  38 CFR § 4.26 - Bilateral factor increases combined rating by
                  10%
                </p>
              </div>
            )}

            {/* Info Box */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-4 rounded">
              <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
                💡 How This Works:
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Drag conditions from the library to build scenarios</li>
                <li>• Combined rating uses official VA math (38 CFR Part 4)</li>
                <li>
                  • Bilateral factor automatically applied when both sides rated
                </li>
                <li>• Monthly pay reflects 2025 compensation rates</li>
                <li>• Test "what-if" scenarios before filing claims</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
