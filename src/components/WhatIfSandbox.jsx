/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * The What-If Sandbox - Visual Scenario Planner
 * Drag-and-drop interface for testing combined rating calculations
 */

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";
import { getMyRatings, hasMyRatings } from "../utils/veteranProfile";
import { getCurrentYearRates } from "../data/vaPayRatesHistorical";

export default function WhatIfSandbox({ onClose }) {
  const { _t } = useLanguage();

  const [currentConditions, setCurrentConditions] = useState([]);
  const [availableConditions, setAvailableConditions] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [combinedRating, setCombinedRating] = useState(0);
  const [monthlyPay, setMonthlyPay] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  // Screen-reader announcement for each add/remove ("Tinnitus 10 percent
  // added. Combined rating now 50 percent."). The pending half is stashed in a
  // ref by the mutating handler, then completed once the new combined rating
  // is computed in the [currentConditions] effect.
  const [announcement, setAnnouncement] = useState("");
  const pendingAnnounceRef = useRef(null);

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

  // Current-year solo compensation rates from the single source of truth
  const { year: ratesYear, rates: currentRates } = getCurrentYearRates();
  const compensationRates = currentRates.solo;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const finalRating = calculateCombinedRating();
    if (pendingAnnounceRef.current) {
      setAnnouncement(
        `${pendingAnnounceRef.current} Combined rating now ${finalRating} percent.`,
      );
      pendingAnnounceRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      pendingAnnounceRef.current = `${formatted.length} saved conditions loaded.`;
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
      return 0;
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

    return finalRating;
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
      pendingAnnounceRef.current = `${draggedItem.name} ${draggedItem.rating} percent added.`;
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
      pendingAnnounceRef.current = `${draggedItem.name} ${draggedItem.rating} percent added.`;
      setCurrentConditions([...currentConditions, newCondition]);
      setDraggedItem(null);
    }
  };

  const addCondition = (condition) => {
    pendingAnnounceRef.current = `${condition.name} ${condition.rating} percent added.`;
    setCurrentConditions((prev) => [
      ...prev,
      {
        ...condition,
        id: `${condition.name}-${condition.rating}-${Date.now()}-${Math.random()}`,
      },
    ]);
  };

  const removeCondition = (id) => {
    const condition = currentConditions.find((c) => c.id === id);
    if (condition) {
      pendingAnnounceRef.current = `${condition.name} ${condition.rating} percent removed.`;
    }
    setCurrentConditions(currentConditions.filter((c) => c.id !== id));
  };

  const clearAll = () => {
    pendingAnnounceRef.current = "All conditions cleared.";
    setCurrentConditions([]);
  };

  // 600/700-grade shades: every category keeps >=4.5:1 contrast against the
  // white pill text (WCAG 1.4.3 — the 500 grades failed for yellow/cyan/green).
  const getCategoryColor = (category) => {
    const colors = {
      mental: "bg-purple-600",
      respiratory: "bg-cyan-700",
      auditory: "bg-yellow-700",
      neurological: "bg-red-600",
      musculoskeletal: "bg-blue-600",
      cardiovascular: "bg-pink-600",
      digestive: "bg-green-700",
      endocrine: "bg-orange-700",
      saved: "bg-gray-600",
    };
    return colors[category] || "bg-gray-600";
  };

  const _getRatingColor = (rating) => {
    if (rating >= 70) return "text-red-600 dark:text-red-400";
    if (rating >= 50) return "text-orange-600 dark:text-orange-400";
    if (rating >= 30) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const header = (
    <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 text-white sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="whatif-sandbox-title"
            className="mb-1 text-xl font-bold sm:mb-2 sm:text-3xl"
          >
            🎯 The What-If Sandbox{" "}
            <span className="rounded bg-amber-700 px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">
              BETA
            </span>
          </h2>
          <p className="text-sm text-white/90 sm:text-base">
            Visual drag-and-drop scenario planner with real-time VA math
          </p>
        </div>
        <button
          onClick={onClose}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-2xl font-bold text-white transition-colors hover:bg-white/20"
          aria-label="Close dialog"
        >
          ×
        </button>
      </div>

      {/* Result Display */}
      <div
        className={`mt-4 rounded-lg bg-white/10 p-4 backdrop-blur-sm transition-all duration-300 sm:p-6 ${
          isAnimating ? "scale-105" : "scale-100"
        }`}
      >
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          <div>
            <p className="mb-1 text-xs text-white/75 sm:text-sm">
              Combined VA Rating
            </p>
            <p
              data-testid="combined-rating"
              className={`text-3xl font-bold transition-all duration-300 sm:text-5xl ${
                isAnimating ? "scale-110" : "scale-100"
              }`}
            >
              {combinedRating}%
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-white/75 sm:text-sm">
              Monthly Compensation
            </p>
            <p
              className={`text-3xl font-bold transition-all duration-300 sm:text-5xl ${
                isAnimating ? "scale-110 text-green-300" : "scale-100"
              }`}
            >
              ${monthlyPay.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {ratesYear} rates (no dependents)
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      header={header}
      labelledBy="whatif-sandbox-title"
      size="2xl"
    >
      {/* SR announcement of every add/remove and the resulting combined rating */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-0">
        {/* Sidebar - Available Conditions */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Condition library"
          className="md:col-span-1 md:max-h-[55vh] md:overflow-y-auto md:border-r md:border-gray-300 md:pr-3 dark:md:border-gray-700"
        >
          <h3 className="mb-3 text-lg font-bold text-gray-800 dark:text-white">
            📦 Condition Library
          </h3>
          <p className="mb-4 text-xs text-gray-600 dark:text-gray-400">
            Tap or press Enter on a condition to add it (or drag it on desktop).
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
                <h4 className="mb-2 text-xs font-semibold uppercase text-gray-700 dark:text-gray-300">
                  {category}
                </h4>
                <div className="space-y-1">
                  {categoryConditions.map((condition) => (
                    <button
                      type="button"
                      key={condition.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, condition)}
                      onClick={() => addCondition(condition)}
                      className={`${getCategoryColor(condition.category)} flex w-full cursor-move items-center justify-between rounded p-2 text-xs text-white transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}
                      aria-label={`Add ${condition.name} at ${condition.rating}%`}
                    >
                      <span>{condition.name}</span>
                      <span className="font-bold">{condition.rating}%</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Canvas - Current Scenario */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Current scenario"
          className="border-t border-gray-200 pt-4 dark:border-gray-700 md:col-span-3 md:max-h-[55vh] md:overflow-y-auto md:border-t-0 md:pl-4 md:pt-0"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              🎨 Current Scenario ({currentConditions.length} conditions)
            </h3>
            <div className="flex gap-2">
              {hasMyRatings() && (
                <button
                  onClick={handleLoadMyRatings}
                  className="rounded bg-green-600 px-4 py-2 text-sm text-white transition-colors hover:bg-green-700"
                >
                  📊 Load My Ratings
                </button>
              )}
              {currentConditions.length > 0 && (
                <button
                  onClick={clearAll}
                  className="rounded bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700"
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
              className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-600"
            >
              <div className="mb-4 text-5xl">➕</div>
              <h4 className="mb-2 text-xl font-bold text-gray-700 dark:text-gray-300">
                Build Your Scenario
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                Tap a condition in the library to add it (or drag it here on
                desktop).
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
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
                      className="mb-2 h-12 rounded-lg border-2 border-dashed border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                    />
                  )}
                  <div
                    className={`${getCategoryColor(condition.category)} flex items-center justify-between rounded-lg p-4 text-white`}
                  >
                    <div className="min-w-0">
                      <span className="text-lg font-bold">
                        {condition.name}
                      </span>
                      <span className="ml-3 text-sm capitalize">
                        ({condition.category})
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-3xl font-bold">
                        {condition.rating}%
                      </span>
                      <button
                        onClick={() => removeCondition(condition.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        aria-label={`Remove ${condition.name} ${condition.rating}%`}
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
            <div className="mt-4 rounded border-l-4 border-green-400 bg-green-50 p-4 dark:bg-green-900/20">
              <h4 className="mb-2 flex items-center gap-2 font-bold text-green-800 dark:text-green-300">
                <span>🎖️</span> Bilateral Factor Applied!
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300">
                {hasMatchingBilateral("Knee") &&
                  "Both knees rated: 10% bonus applied."}
                {hasMatchingBilateral("Shoulder") &&
                  " Both shoulders rated: 10% bonus applied."}
              </p>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                38 CFR § 4.26 - Bilateral factor increases combined rating by
                10%
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 rounded border-l-4 border-blue-400 bg-blue-50 p-4 dark:bg-blue-900/20">
            <h4 className="mb-2 font-bold text-blue-800 dark:text-blue-300">
              💡 How This Works:
            </h4>
            <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <li>
                • Tap or drag conditions from the library to build scenarios
              </li>
              <li>• Combined rating uses official VA math (38 CFR Part 4)</li>
              <li>
                • Bilateral factor automatically applied when both sides rated
              </li>
              <li>• Monthly pay reflects {ratesYear} compensation rates</li>
              <li>• Test &quot;what-if&quot; scenarios before filing claims</li>
            </ul>
          </div>
        </div>
      </div>
    </ResponsiveModal>
  );
}
