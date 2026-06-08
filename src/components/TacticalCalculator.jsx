import { useState, useEffect, useRef } from "react";
import ReportBugLink from "./ReportBugLink";
import BuyMeCoffee from "./BuyMeCoffee";
import ShareButton from "./ShareButton";
import ResponsiveModal from "./common/ResponsiveModal";
import VAGovRatingPaster from "./VAGovRatingPaster";
import { useLanguage } from "../contexts/LanguageContext";
import {
  calculateVARating,
  calculateCompensation,
  calculateWhatIf,
  calculateNeededRating,
  detectPyramiding,
  BODY_PARTS,
  VA_PAY_RATES_2026,
} from "../utils/vaCalculator";
import {
  getMyRatings,
  saveMyRatings,
  addRating,
  removeRating,
  hasMyRatings,
} from "../utils/veteranProfile";

/**
 * TacticalCalculator - "The Rate You Deserve"
 *
 * The irony: Vet-Rate.org didn't have a rating calculator!
 *
 * This isn't just another "dumb" calculator. This is a TACTICAL PLANNER:
 * - Shows the GAP to next tier
 * - Correctly handles Bilateral Factor (10% boost)
 * - Calculates real paycheck with dependents
 * - Shows "What If" scenarios
 */

const TacticalCalculator = ({
  onClose,
  onReportBug,
  initialConditions = [],
  capSimulatorResults = [],
  onClearCapResults,
}) => {
  const { t } = useLanguage();

  // Ref for screenshot capture
  const calculatorContentRef = useRef(null);

  // Conditions list (for calculator tab)
  const [conditions, setConditions] = useState(initialConditions);

  // C&P Simulator imported results
  const [capResults, setCapResults] = useState(capSimulatorResults);

  // My Ratings - saved actual VA ratings
  const [myRatings, setMyRatings] = useState(() => getMyRatings());
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // New condition form
  const [newCondition, setNewCondition] = useState({
    name: "",
    bodyPart: "",
    rating: 10,
    side: "none", // 'left', 'right', 'bilateral', 'none'
  });

  // Dependents for pay calculation
  const [dependents, setDependents] = useState({
    married: false,
    spouseAidAttendance: false,
    childrenUnder18: 0,
    childrenSchool: 0,
    dependentParents: 0,
  });

  // What-If scenario
  const [whatIfRating, setWhatIfRating] = useState(30);
  const [whatIfBilateral, setWhatIfBilateral] = useState(false);

  // View mode
  const [activeTab, setActiveTab] = useState(
    capSimulatorResults.length > 0
      ? "capresults"
      : hasMyRatings()
        ? "myratings"
        : "calculator",
  );
  const [showSteps, setShowSteps] = useState(false);
  const [showVAGovPaster, setShowVAGovPaster] = useState(false);

  // Edit condition modal
  const [editingCondition, setEditingCondition] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    bodyPart: "",
    rating: 10,
    side: "none",
  });

  // Handle incoming C&P Simulator results
  useEffect(() => {
    if (capSimulatorResults.length > 0) {
      setCapResults(capSimulatorResults);
      setActiveTab("capresults");
    }
  }, [capSimulatorResults]);

  // Load my ratings from storage when saved ratings change
  const loadMyRatings = () => {
    setMyRatings(getMyRatings());
  };

  // Save current calculator conditions as "My Ratings"
  const handleSaveAsMyRatings = () => {
    if (conditions.length === 0) {
      alert(t("tacticalCalc", "addSomeConditionsFirst"));
      return;
    }
    saveMyRatings(conditions);
    setMyRatings(conditions);
    setShowSaveConfirm(true);
    setTimeout(() => setShowSaveConfirm(false), 3000);
  };

  // Load My Ratings into the calculator
  const handleLoadMyRatings = () => {
    if (myRatings.length > 0) {
      setConditions(myRatings);
      setActiveTab("calculator");
    }
  };

  // Add a rating directly to My Ratings
  const handleAddToMyRatings = (rating) => {
    const newId = addRating(rating);
    if (newId) {
      loadMyRatings();
    }
  };

  // Remove a rating from My Ratings
  const handleRemoveFromMyRatings = (ratingId) => {
    removeRating(ratingId);
    loadMyRatings();
  };

  // Handle pasted ratings from VA.gov
  const handlePastedRatings = (parsedRatings) => {
    // Convert parsed VA.gov format to our rating format
    const formattedRatings = parsedRatings.map((r, index) => ({
      id: Date.now().toString() + index,
      name: r.condition,
      bodyPart: "other", // Default to 'other' since we don't know the body part
      rating: r.rating || 0,
      side: "none",
      source: "VA.gov",
      effectiveDate: r.effectiveDate,
    }));

    // Save directly to My Ratings
    const updated = [...myRatings, ...formattedRatings];
    saveMyRatings(updated);
    setMyRatings(updated);
    setShowVAGovPaster(false);
  };

  // Calculate results from My Ratings
  const myRatingsResults = calculateVARating(myRatings);
  // eslint-disable-next-line no-unused-vars
  const myRatingsCompensation = calculateCompensation(
    myRatingsResults.combinedRating,
    dependents,
  );
  const myRatingsPyramiding = detectPyramiding(myRatings);

  // Calculate results
  const results = calculateVARating(conditions);
  const compensation = calculateCompensation(
    results.combinedRating,
    dependents,
  );
  const pyramiding = detectPyramiding(conditions);
  const whatIfResults = calculateWhatIf(
    conditions,
    whatIfRating,
    whatIfBilateral,
  );
  const ratingNeededFor90 = calculateNeededRating(results.rawScore, 90);
  const ratingNeededFor100 = calculateNeededRating(results.rawScore, 100);

  // Get all body parts as flat array
  const allBodyParts = [...BODY_PARTS.extremities, ...BODY_PARTS.other];

  // Check if selected body part can be bilateral
  const selectedBodyPartInfo = allBodyParts.find(
    (bp) => bp.value === newCondition.bodyPart,
  );
  const canBeBilateral = selectedBodyPartInfo?.canBeBilateral || false;

  // Handle adding a condition
  const handleAddCondition = () => {
    if (!newCondition.bodyPart) {
      alert(t("tacticalCalc", "pleaseSelectBodyPart"));
      return;
    }

    const bodyPartLabel =
      allBodyParts.find((bp) => bp.value === newCondition.bodyPart)?.label ||
      newCondition.bodyPart;
    const sideSuffix =
      newCondition.side !== "none"
        ? ` (${newCondition.side.charAt(0).toUpperCase() + newCondition.side.slice(1)})`
        : "";

    const condition = {
      id: Date.now().toString(),
      name: newCondition.name || `${bodyPartLabel}${sideSuffix}`,
      bodyPart: newCondition.bodyPart,
      rating: newCondition.rating,
      side: canBeBilateral ? newCondition.side : "none",
    };

    setConditions((prev) => [...prev, condition]);

    // Reset form
    setNewCondition({
      name: "",
      bodyPart: "",
      rating: 10,
      side: "none",
    });
  };

  // Handle removing a condition
  const handleRemoveCondition = (id) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  // Handle editing a condition
  const handleEditCondition = (condition) => {
    setEditingCondition(condition);
    setEditForm({
      name: condition.name,
      bodyPart: condition.bodyPart,
      rating: condition.rating,
      side: condition.side || "none",
    });
  };

  // Handle saving edited condition
  const handleSaveEdit = () => {
    if (!editForm.bodyPart) {
      alert(t("tacticalCalc", "pleaseSelectBodyPart"));
      return;
    }

    const bodyPartInfo = allBodyParts.find(
      (bp) => bp.value === editForm.bodyPart,
    );
    const canBeBilateral = bodyPartInfo?.canBeBilateral || false;

    setConditions((prev) =>
      prev.map((c) =>
        c.id === editingCondition.id
          ? {
              ...c,
              name: editForm.name || c.name,
              bodyPart: editForm.bodyPart,
              rating: editForm.rating,
              side: canBeBilateral ? editForm.side : "none",
            }
          : c,
      ),
    );

    setEditingCondition(null);
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingCondition(null);
    setEditForm({
      name: "",
      bodyPart: "",
      rating: 10,
      side: "none",
    });
  };

  // Rating percentage options
  const ratingOptions = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  // Progress ring component
  const ProgressRing = ({ percentage, size = 200, strokeWidth = 12 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    const getColor = () => {
      if (percentage >= 100) return "#22c55e"; // green
      if (percentage >= 70) return "#3b82f6"; // blue
      if (percentage >= 50) return "#f59e0b"; // amber
      return "#ef4444"; // red
    };

    return (
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
    );
  };

  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={onClose}
        size="2xl"
        labelledBy="calculator-title"
        header={
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 sm:px-6 py-4 sm:py-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>

            <div className="relative flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl sm:text-3xl">🧮</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    id="calculator-title"
                    className="text-lg sm:text-2xl md:text-3xl font-bold truncate"
                  >
                    {t("tacticalCalc", "title")}{" "}
                    <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
                      {t("common", "beta")}
                    </span>
                  </h2>
                  <p className="text-blue-100 text-xs sm:text-sm md:text-base mt-1 truncate">
                    {t("tacticalCalc", "subtitle")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <ShareButton
                  targetRef={calculatorContentRef}
                  filename="vet-rate-calculator"
                  variant="icon"
                />
                {onReportBug && (
                  <ReportBugLink
                    onClick={onReportBug}
                    variant="light"
                    moduleName="Tactical Calculator"
                  />
                )}
                <button
                  onClick={onClose}
                  className="p-2 sm:p-3 text-white hover:bg-white/20 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Close"
                >
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6"
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
          </div>
        }
      >
        <div ref={calculatorContentRef}>
          {/* Tab Navigation - Sticky */}
          <div className="px-2 sm:px-3 md:px-6 pt-2 sm:pt-3 md:pt-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 sticky top-0 z-10">
            <nav className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
              {[
                {
                  id: "myratings",
                  label: t("tacticalCalc", "myRatingsTab"),
                  shortLabel: "⭐ " + t("tacticalCalc", "myRatings"),
                  icon: "⭐",
                },
                ...(capResults.length > 0
                  ? [
                      {
                        id: "capresults",
                        label: t("tacticalCalc", "capResultsTab"),
                        shortLabel: "🏥 C&P",
                        icon: "🏥",
                        badge: capResults.length,
                      },
                    ]
                  : []),
                {
                  id: "calculator",
                  label: t("tacticalCalc", "calculatorTab"),
                  shortLabel: "🧮 " + t("tacticalCalc", "calculator"),
                  icon: "🧮",
                },
                {
                  id: "paycheck",
                  label: t("tacticalCalc", "paycheckTab"),
                  shortLabel: "💵 " + t("tacticalCalc", "paycheck"),
                  icon: "💵",
                },
                {
                  id: "whatif",
                  label: t("tacticalCalc", "whatIfTab"),
                  shortLabel: "🎯 " + t("tacticalCalc", "whatIf"),
                  icon: "🎯",
                },
                {
                  id: "rates",
                  label: t("tacticalCalc", "ratesTab"),
                  shortLabel: "📊 " + t("tacticalCalc", "rates2026"),
                  icon: "📊",
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-w-[70px] sm:min-w-[80px] px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap flex items-center justify-center gap-1 sm:gap-2 min-h-[44px] ${
                    activeTab === tab.id
                      ? tab.id === "capresults"
                        ? "bg-teal-600 text-white"
                        : "bg-blue-600 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="inline sm:hidden">{tab.shortLabel}</span>
                  {tab.badge && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] sm:text-xs rounded-full font-bold ${
                        activeTab === tab.id
                          ? "bg-white/30"
                          : "bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="p-3 sm:p-4 md:p-6">
            {/* My Ratings Tab - Save and manage your actual VA ratings */}
            {activeTab === "myratings" && (
              <div className="space-y-6">
                {/* Header Info */}
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">⭐</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-amber-800 dark:text-amber-200">
                        {t("tacticalCalc", "myVARatings")}
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        {t("tacticalCalc", "myVARatingsDesc")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Save Confirmation */}
                {showSaveConfirm && (
                  <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-3 flex items-center gap-2">
                    <span className="text-green-600 dark:text-green-400">
                      ✓
                    </span>
                    <span className="text-green-700 dark:text-green-300 text-sm">
                      {t("tacticalCalc", "ratingsSavedSuccess")}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* My Saved Ratings List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                        {t("tacticalCalc", "savedRatings")}
                      </h4>
                      {myRatings.length > 0 && (
                        <button
                          onClick={handleLoadMyRatings}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {t("tacticalCalc", "loadIntoCalculator")}
                        </button>
                      )}
                    </div>

                    {myRatings.length === 0 ? (
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 text-center border border-dashed border-gray-300 dark:border-gray-600">
                        <span className="text-4xl mb-3 block">📋</span>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          {t("tacticalCalc", "noRatingsSavedYet")}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                          {t("tacticalCalc", "pasteRatingsDesc")}
                        </p>
                        <div className="space-y-2">
                          <button
                            onClick={() => setShowVAGovPaster(true)}
                            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-semibold flex items-center justify-center gap-2"
                          >
                            <span className="text-lg">📋</span>{" "}
                            {t("tacticalCalc", "pasteFromVAGov")}
                          </button>
                          <button
                            onClick={() => setActiveTab("calculator")}
                            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                          >
                            {t("tacticalCalc", "orAddInCalculator")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {myRatings.map((rating, index) => (
                          <div
                            key={rating.id || index}
                            className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white ${
                                  rating.rating >= 70
                                    ? "bg-red-500"
                                    : rating.rating >= 50
                                      ? "bg-orange-500"
                                      : rating.rating >= 30
                                        ? "bg-yellow-500"
                                        : "bg-gray-400"
                                }`}
                              >
                                {rating.rating}%
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                  {rating.name ||
                                    allBodyParts.find(
                                      (bp) => bp.value === rating.bodyPart,
                                    )?.label ||
                                    rating.bodyPart}
                                </p>
                                {rating.side !== "none" && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                    {rating.side}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                handleRemoveFromMyRatings(rating.id)
                              }
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              aria-label="Remove"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      {/* Paste from VA.gov Button - Only show if no ratings exist */}
                      {myRatings.length === 0 && (
                        <button
                          onClick={() => setShowVAGovPaster(true)}
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md"
                        >
                          <span>📋</span> {t("tacticalCalc", "pasteFromVAGov")}
                        </button>
                      )}

                      {/* Save from Calculator Button */}
                      {conditions.length > 0 && (
                        <button
                          onClick={handleSaveAsMyRatings}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          <span>⭐</span>{" "}
                          {t("tacticalCalc", "saveCalcConditions")}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* My Ratings Summary */}
                  <div className="space-y-4">
                    {myRatings.length > 0 ? (
                      <>
                        {/* Combined Rating Display */}
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl p-6 text-center">
                          <p className="text-blue-100 text-sm mb-2">
                            {t("tacticalCalc", "myCombinedRating")}
                          </p>
                          <div className="text-5xl font-bold mb-2">
                            {myRatingsResults.combinedRating}%
                          </div>
                          {myRatingsResults.bilateralFactor > 0 && (
                            <p className="text-blue-200 text-sm">
                              {t("tacticalCalc", "includesBilateral")}{" "}
                              {myRatingsResults.bilateralFactor.toFixed(1)}%
                            </p>
                          )}
                        </div>

                        {/* Monthly Pay Estimate */}
                        <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white rounded-xl p-6 text-center">
                          <p className="text-green-100 text-sm mb-2">
                            {t("tacticalCalc", "estimatedMonthlyPaySolo")}
                          </p>
                          <div className="text-4xl font-bold">
                            $
                            {VA_PAY_RATES_2026.solo[
                              myRatingsResults.combinedRating
                            ]?.toLocaleString() || "0"}
                          </div>
                          <p className="text-green-200 text-sm mt-2">
                            $
                            {(
                              (VA_PAY_RATES_2026.solo[
                                myRatingsResults.combinedRating
                              ] || 0) * 12
                            ).toLocaleString()}
                            /{t("tacticalCalc", "yearlyPay").toLowerCase()}
                          </p>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                              {myRatings.length}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {t("tacticalCalc", "conditions")}
                            </div>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                              {myRatingsResults.rawScore}%
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {t("tacticalCalc", "rawScore")}
                            </div>
                          </div>
                        </div>

                        {/* Gap Analysis */}
                        {myRatingsResults.combinedRating < 100 && (
                          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                            <h5 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
                              {t("tacticalCalc", "gapToNext")}
                            </h5>
                            <p className="text-sm text-purple-700 dark:text-purple-300">
                              <strong>{myRatingsResults.gapToNextTier}%</strong>{" "}
                              {t("tacticalCalc", "awayFromNextTier")}
                              {myRatingsResults.combinedRating < 100 &&
                                myRatingsResults.combinedRating >= 90 && (
                                  <span className="block mt-1">
                                    {t("tacticalCalc", "closeToHundred")}
                                  </span>
                                )}
                            </p>
                          </div>
                        )}

                        {/* Pyramiding Warnings for My Ratings */}
                        {myRatingsPyramiding.hasPotentialPyramiding && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500 dark:border-yellow-600 rounded-lg p-4">
                            <h5 className="font-bold text-yellow-800 dark:text-yellow-300 mb-2 flex items-center gap-2">
                              <span>⚠️</span>{" "}
                              {t("tacticalCalc", "pyramidingAlert")}
                            </h5>
                            <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-2">
                              {myRatingsPyramiding.summary}
                            </p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {myRatingsPyramiding.warnings.map(
                                (warning, idx) => (
                                  <div
                                    key={idx}
                                    className="text-xs p-2 bg-white dark:bg-gray-800 rounded border-l-2 border-yellow-500"
                                  >
                                    <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
                                      {warning.message}
                                    </p>
                                    <p className="text-gray-600 dark:text-gray-400">
                                      {warning.regulation}: {warning.guidance}
                                    </p>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 text-center">
                        <span className="text-6xl mb-4 block opacity-30">
                          📊
                        </span>
                        <p className="text-gray-500 dark:text-gray-400">
                          {t("tacticalCalc", "saveRatingsToSee")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Integration Note */}
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                  <div className="flex gap-3">
                    <span className="text-xl">💡</span>
                    <div>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>{t("tacticalCalc", "proTip")}:</strong>{" "}
                        {t("tacticalCalc", "proTipDesc")}
                      </p>
                      <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-disc list-inside">
                        <li>{t("tacticalCalc", "proTipItem1")}</li>
                        <li>{t("tacticalCalc", "proTipItem2")}</li>
                        <li>{t("tacticalCalc", "proTipItem3")}</li>
                        <li>{t("tacticalCalc", "proTipItem4")}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* C&P Simulator Results Tab */}
            {activeTab === "capresults" && capResults.length > 0 && (
              <div className="space-y-6">
                {/* Header Info */}
                <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/30 dark:to-emerald-900/30 rounded-xl p-4 border border-teal-200 dark:border-teal-700">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">🏥</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-teal-900 dark:text-teal-100">
                        {t("tacticalCalc", "capSimulatorResults")}
                      </h3>
                      <p className="text-sm text-teal-700 dark:text-teal-300 mt-1">
                        {t("tacticalCalc", "capSimulatorDesc")}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setCapResults([]);
                        if (onClearCapResults) onClearCapResults();
                        setActiveTab("calculator");
                      }}
                      className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      {t("tacticalCalc", "clearAll")}
                    </button>
                  </div>
                </div>

                {/* Results List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {capResults.map((result, index) => (
                    <div
                      key={result.id || index}
                      className="bg-white dark:bg-gray-700 rounded-xl p-4 border-2 border-teal-200 dark:border-teal-700 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-14 h-14 rounded-lg flex items-center justify-center font-bold text-white text-xl ${
                              result.rating >= 70
                                ? "bg-red-500"
                                : result.rating >= 50
                                  ? "bg-orange-500"
                                  : result.rating >= 30
                                    ? "bg-yellow-500"
                                    : "bg-gray-400"
                            }`}
                          >
                            {result.rating}%
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {result.conditionName}
                            </p>
                            {result.diagnosticCode && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                DC {result.diagnosticCode}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-xs rounded-full">
                          C&P Sim
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            // Add to current calculator conditions
                            const condition = {
                              id: Date.now().toString() + index,
                              name: result.conditionName,
                              bodyPart: "other",
                              rating: result.rating,
                              side: "none",
                              source: "C&P Simulator",
                              diagnosticCode: result.diagnosticCode,
                            };
                            setConditions((prev) => [...prev, condition]);
                            // Remove from C&P results
                            setCapResults((prev) =>
                              prev.filter((_, i) => i !== index),
                            );
                          }}
                          className="flex-1 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <span>🧮</span> {t("tacticalCalc", "addToCalculator")}
                        </button>
                        <button
                          onClick={() => {
                            // Add directly to My Ratings
                            const rating = {
                              name: result.conditionName,
                              bodyPart: "other",
                              rating: result.rating,
                              side: "none",
                              source: "C&P Simulator",
                              diagnosticCode: result.diagnosticCode,
                            };
                            handleAddToMyRatings(rating);
                            // Remove from C&P results
                            setCapResults((prev) =>
                              prev.filter((_, i) => i !== index),
                            );
                          }}
                          className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                        >
                          <span>⭐</span> {t("tacticalCalc", "saveToMyRatings")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculate Combined if we add all */}
                {capResults.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                      {t("tacticalCalc", "quickPreview")}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {t("tacticalCalc", "ifYouAddAll")}
                    </p>

                    {(() => {
                      const previewConditions = [
                        ...conditions,
                        ...capResults.map((r, i) => ({
                          id: `preview-${i}`,
                          name: r.conditionName,
                          bodyPart: "other",
                          rating: r.rating,
                          side: "none",
                        })),
                      ];
                      const previewResults =
                        calculateVARating(previewConditions);

                      return (
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-2xl font-bold text-blue-600">
                              {conditions.length}
                            </div>
                            <div className="text-xs text-gray-500">
                              {t("tacticalCalc", "current")}
                            </div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-2xl font-bold text-teal-600">
                              +{capResults.length}
                            </div>
                            <div className="text-xs text-gray-500">
                              {t("tacticalCalc", "fromCAP")}
                            </div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-2xl font-bold text-green-600">
                              {previewResults.combinedRating}%
                            </div>
                            <div className="text-xs text-gray-500">
                              {t("tacticalCalc", "combined")}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <button
                      onClick={() => {
                        // Add all C&P results to conditions
                        const newConditions = capResults.map((r, i) => ({
                          id: Date.now().toString() + i,
                          name: r.conditionName,
                          bodyPart: "other",
                          rating: r.rating,
                          side: "none",
                          source: "C&P Simulator",
                          diagnosticCode: r.diagnosticCode,
                        }));
                        setConditions((prev) => [...prev, ...newConditions]);
                        setCapResults([]);
                        if (onClearCapResults) onClearCapResults();
                        setActiveTab("calculator");
                      }}
                      className="w-full mt-3 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md font-medium transition-colors"
                    >
                      {t("tacticalCalc", "addAllToCalculator")}
                    </button>
                  </div>
                )}

                {/* Educational Note */}
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                  <div className="flex gap-3">
                    <span className="text-xl">💡</span>
                    <div>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>
                          {t("common", "remember") || "Remember"}:
                        </strong>{" "}
                        {t("tacticalCalc", "capRemember")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Calculator Tab */}
            {activeTab === "calculator" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                {/* Input Section */}
                <div className="space-y-6 flex flex-col h-full">
                  {/* Quick Load from My Ratings */}
                  {myRatings.length > 0 && conditions.length === 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-700 flex items-center justify-between flex-shrink-0">
                      <span className="text-sm text-amber-700 dark:text-amber-300">
                        ⭐ {t("tacticalCalc", "youHaveSavedRatings")} (
                        {myRatings.length})
                      </span>
                      <button
                        onClick={handleLoadMyRatings}
                        className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200"
                      >
                        {t("tacticalCalc", "loadNow")}
                      </button>
                    </div>
                  )}

                  {/* Add Condition Form */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                      <span>➕</span> {t("tacticalCalc", "addRatedCondition")}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Body Part */}
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t("tacticalCalc", "bodyPartConditionType")}
                        </label>
                        <select
                          aria-label={t(
                            "tacticalCalc",
                            "bodyPartConditionType",
                          )}
                          value={newCondition.bodyPart}
                          onChange={(e) => {
                            const bp = e.target.value;
                            const info = allBodyParts.find(
                              (p) => p.value === bp,
                            );
                            setNewCondition((prev) => ({
                              ...prev,
                              bodyPart: bp,
                              side: info?.canBeBilateral ? prev.side : "none",
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="">
                            {t("tacticalCalc", "select")}
                          </option>
                          <optgroup
                            label={t("tacticalCalc", "extremitiesBilateral")}
                          >
                            {BODY_PARTS.extremities.map((bp) => (
                              <option key={bp.value} value={bp.value}>
                                {bp.label}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup
                            label={t("tacticalCalc", "otherBodySystems")}
                          >
                            {BODY_PARTS.other.map((bp) => (
                              <option key={bp.value} value={bp.value}>
                                {bp.label}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      {/* Side (if bilateral capable) */}
                      {canBeBilateral && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t("tacticalCalc", "side")}
                          </label>
                          <select
                            aria-label={t("tacticalCalc", "side")}
                            value={newCondition.side}
                            onChange={(e) =>
                              setNewCondition((prev) => ({
                                ...prev,
                                side: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          >
                            <option value="none">
                              {t("tacticalCalc", "notBilateral")}
                            </option>
                            <option value="left">
                              {t("tacticalCalc", "left")}
                            </option>
                            <option value="right">
                              {t("tacticalCalc", "right")}
                            </option>
                            <option value="bilateral">
                              {t("tacticalCalc", "bothBilateral")}
                            </option>
                          </select>
                        </div>
                      )}

                      {/* Rating */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t("tacticalCalc", "ratingPercent")}
                        </label>
                        <select
                          aria-label={t("tacticalCalc", "ratingPercent")}
                          value={newCondition.rating}
                          onChange={(e) =>
                            setNewCondition((prev) => ({
                              ...prev,
                              rating: parseInt(e.target.value),
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          {ratingOptions.map((r) => (
                            <option key={r} value={r}>
                              {r}%
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Custom Name (optional) */}
                      <div className={canBeBilateral ? "sm:col-span-2" : ""}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t("tacticalCalc", "customLabelOptional")}
                        </label>
                        <input
                          type="text"
                          value={newCondition.name}
                          onChange={(e) =>
                            setNewCondition((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder={t(
                            "tacticalCalc",
                            "customLabelPlaceholder",
                          )}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleAddCondition}
                      disabled={!newCondition.bodyPart}
                      className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t("tacticalCalc", "addToCalculatorBtn")}
                    </button>
                  </div>

                  {/* Conditions List - Expands to fill remaining space */}
                  <div className="flex flex-col flex-1 min-h-0">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center justify-between flex-shrink-0">
                      <span>
                        📋 {t("tacticalCalc", "yourRatedConditions")} (
                        {conditions.length})
                      </span>
                      {conditions.length > 0 && (
                        <button
                          onClick={() => setConditions([])}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          {t("tacticalCalc", "clearAll")}
                        </button>
                      )}
                    </h3>

                    {conditions.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl">
                        <div className="text-4xl mb-2">📝</div>
                        <p>{t("tacticalCalc", "noConditionsYet")}</p>
                        <p className="text-sm mt-1">
                          {t("tacticalCalc", "noConditionsAddYours")}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                        {/*  Removed max-h-64, added flex-1 */}
                        {conditions.map((condition) => (
                          <div
                            key={condition.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              condition.side !== "none"
                                ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700"
                                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-12 h-12 flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold rounded-lg">
                                {condition.rating}%
                              </span>
                              <div>
                                <p className="font-medium text-gray-800 dark:text-gray-200">
                                  {condition.name}
                                </p>
                                {condition.side !== "none" && (
                                  <span className="text-xs px-2 py-0.5 bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded-full">
                                    🔄 Bilateral ({condition.side})
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditCondition(condition)}
                                className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                                aria-label="Edit"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() =>
                                  handleRemoveCondition(condition.id)
                                }
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                aria-label="Remove"
                              >
                                <svg
                                  className="w-5 h-5"
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
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Results Section */}
                <div className="space-y-6">
                  {/* Validation Badge */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-lg p-3 border border-green-200 dark:border-green-700">
                    <div className="flex items-center justify-center gap-2 text-sm text-green-700 dark:text-green-300">
                      <span className="text-lg">✓</span>
                      <span className="font-medium">
                        {t("tacticalCalc", "verifiedPer")}
                      </span>
                      <span className="text-xs px-2 py-1 bg-green-200 dark:bg-green-800 rounded-full">
                        {t("tacticalCalc", "matchesVAGov")}
                      </span>
                    </div>
                  </div>

                  {/* Main Rating Display */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
                    <div className="flex items-center justify-center gap-6">
                      {/* Progress Ring */}
                      <div className="relative">
                        <ProgressRing
                          percentage={results.combinedRating}
                          size={160}
                          strokeWidth={14}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-4xl font-bold text-gray-800 dark:text-gray-100">
                            {results.combinedRating}%
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {t("tacticalCalc", "combined")}
                          </span>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-2">
                        <div className="text-center">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t("tacticalCalc", "rawScore")}
                          </p>
                          <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300">
                            {results.rawScore}%
                          </p>
                        </div>
                        {results.bilateralFactor > 0 && (
                          <div className="text-center px-3 py-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                            <p className="text-xs text-purple-600 dark:text-purple-400">
                              {t("tacticalCalc", "bilateralFactor")}
                            </p>
                            <p className="font-semibold text-purple-700 dark:text-purple-300">
                              +{results.bilateralFactor}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pyramiding Warnings - NEW */}
                  {pyramiding.hasPotentialPyramiding && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500 dark:border-yellow-600 rounded-xl p-4">
                      <h4 className="font-bold text-yellow-800 dark:text-yellow-300 mb-3 flex items-center gap-2">
                        <span>⚠️</span> {t("tacticalCalc", "pyramidingAlert")}
                      </h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
                        {pyramiding.summary}
                      </p>
                      <div className="space-y-2">
                        {pyramiding.warnings.map((warning, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border-l-4 ${
                              warning.severity === "high"
                                ? "bg-red-50 dark:bg-red-900/30 border-red-500"
                                : "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                                {warning.message}
                              </p>
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  warning.severity === "high"
                                    ? "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200"
                                    : "bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200"
                                }`}
                              >
                                {warning.severity.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                              <strong>{warning.regulation}:</strong>{" "}
                              {warning.guidance}
                            </p>
                            {warning.conditions && (
                              <div className="mt-2 text-xs text-gray-700 dark:text-gray-300">
                                <strong>
                                  {t("tacticalCalc", "affectedConditions")}:
                                </strong>{" "}
                                {warning.conditions.join(", ")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-3 italic">
                        {t("tacticalCalc", "automatedCheck")}
                      </p>
                    </div>
                  )}

                  {/* Gap Analysis */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                      <span>🎯</span> {t("tacticalCalc", "gapAnalysis")}
                    </h4>

                    {results.combinedRating >= 100 ? (
                      <div className="text-center py-4">
                        <span className="text-4xl">🎉</span>
                        <p className="text-green-600 dark:text-green-400 font-bold text-lg mt-2">
                          {t("tacticalCalc", "youveReached100")}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Gap to next tier */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            {t("tacticalCalc", "gapTo")} {results.nextTier}%:
                          </span>
                          <span className="font-semibold text-orange-600 dark:text-orange-400">
                            {results.gapToNext10}% {t("tacticalCalc", "away")}
                          </span>
                        </div>

                        {/* Progress bar to next tier */}
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                            style={{
                              width: `${((10 - results.gapToNext10) / 10) * 100}%`,
                            }}
                          />
                        </div>

                        {/* What you need */}
                        {results.combinedRating < 90 && (
                          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              <strong>{t("tacticalCalc", "toReach90")}</strong>{" "}
                              {t("tacticalCalc", "needApprox")}{" "}
                              <strong>{ratingNeededFor90}%</strong>{" "}
                              {t("tacticalCalc", "moreInNewRatings")}.
                            </p>
                          </div>
                        )}

                        {results.combinedRating < 100 && (
                          <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
                            <p className="text-sm text-green-700 dark:text-green-300">
                              <strong>{t("tacticalCalc", "toReach100")}</strong>{" "}
                              {t("tacticalCalc", "needApprox")}{" "}
                              <strong>{ratingNeededFor100}%</strong>{" "}
                              {t("tacticalCalc", "moreInNewRatings")}.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick Pay Preview */}
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          {t("tacticalCalc", "monthlyPaySolo")}
                        </p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                          $
                          {VA_PAY_RATES_2026.solo[
                            results.combinedRating
                          ]?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab("paycheck")}
                        className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                      >
                        {t("tacticalCalc", "addDependents")}
                      </button>
                    </div>
                  </div>

                  {/* Show Calculation Steps */}
                  <button
                    onClick={() => setShowSteps(!showSteps)}
                    className="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center justify-center gap-2"
                  >
                    <span>{showSteps ? "▼" : "▶"}</span>
                    {showSteps
                      ? t("tacticalCalc", "hideCalculationSteps")
                      : t("tacticalCalc", "showCalculationSteps")}
                  </button>

                  {showSteps && results.calculationSteps.length > 0 && (
                    <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 space-y-3">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                        <span>📋</span>
                        <span>{t("tacticalCalc", "officialVAMethod")}</span>
                      </div>
                      {results.calculationSteps.map((step, idx) => (
                        <div
                          key={idx}
                          className="bg-white dark:bg-gray-800 rounded-lg p-3 border-l-4 border-blue-500"
                        >
                          <div className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                            <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
                              {step.step}
                            </span>
                            {step.description}
                          </div>
                          {step.bilateral && step.bilateral.length > 0 && (
                            <div className="ml-8 text-sm space-y-1">
                              <div className="text-purple-600 dark:text-purple-400 font-medium">
                                🔄 Bilateral: {step.bilateral.join(", ")}
                              </div>
                            </div>
                          )}
                          {step.nonBilateral &&
                            step.nonBilateral.length > 0 && (
                              <div className="ml-8 text-sm text-gray-600 dark:text-gray-400">
                                Non-bilateral: {step.nonBilateral.join(", ")}
                              </div>
                            )}
                          {step.ratings && (
                            <div className="ml-8 text-sm font-mono text-gray-700 dark:text-gray-300">
                              Ratings (sorted): [{step.ratings.join("%, ")}%]
                            </div>
                          )}
                          {step.bilateralGroupRating && (
                            <div className="ml-8 mt-2 p-2 bg-purple-50 dark:bg-purple-900/30 rounded text-sm">
                              <div className="text-purple-700 dark:text-purple-300">
                                <div>Combined: {step.combinedBilateral}%</div>
                                <div>
                                  Bilateral Factor (+10%):{" "}
                                  {step.bilateralFactor}%
                                </div>
                                <div className="font-bold mt-1">
                                  Group Rating: {step.bilateralGroupRating}%
                                </div>
                              </div>
                            </div>
                          )}
                          {step.rawScore !== undefined && (
                            <div className="ml-8 mt-2 p-2 bg-green-50 dark:bg-green-900/30 rounded text-sm">
                              <div className="text-green-700 dark:text-green-300 space-y-1">
                                <div className="font-mono">
                                  Raw Score: {step.rawScore}%
                                </div>
                                <div className="font-bold">
                                  Final (rounded to 10): {step.roundedTo}%
                                </div>
                                {step.method && (
                                  <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                    ✓ {step.method}
                                  </div>
                                )}
                                {step.validation && (
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
                                    {step.validation.outputValid ? "✅" : "⚠️"}
                                    {step.validation.roundingRule}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                          <div className="font-semibold">
                            ✓ {t("tacticalCalc", "calculationVerified")}
                          </div>
                          <div>{t("tacticalCalc", "matchesCalculators")}</div>
                          <div>{t("tacticalCalc", "usingOfficialMethod")}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Paycheck Tab */}
            {activeTab === "paycheck" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Dependents Input */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <span>👨‍👩‍👧‍👦</span> {t("tacticalCalc", "yourDependents")}
                  </h3>

                  <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      <strong>{t("common", "note") || "Note"}:</strong>{" "}
                      {t("tacticalCalc", "dependentNote")}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Spouse */}
                    {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                    <label className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750">
                      <input
                        type="checkbox"
                        checked={dependents.married}
                        onChange={(e) =>
                          setDependents((prev) => ({
                            ...prev,
                            married: e.target.checked,
                            spouseAidAttendance: e.target.checked
                              ? prev.spouseAidAttendance
                              : false,
                          }))
                        }
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          💑 {t("tacticalCalc", "married")}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          +$
                          {VA_PAY_RATES_2026.spouse[results.combinedRating] ||
                            0}
                          /mo {t("tacticalCalc", "atYourRating")}
                        </p>
                      </div>
                    </label>

                    {/* Spouse A&A */}
                    {dependents.married && (
                      <label
                        className="flex items-center gap-3 p-4 ml-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750" /* eslint-disable-line jsx-a11y/label-has-associated-control */
                      >
                        <input
                          type="checkbox"
                          checked={dependents.spouseAidAttendance}
                          onChange={(e) =>
                            setDependents((prev) => ({
                              ...prev,
                              spouseAidAttendance: e.target.checked,
                            }))
                          }
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            🏥 {t("tacticalCalc", "spouseAidAttendance")}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t("common", "additional") || "Additional"} +$
                            {VA_PAY_RATES_2026.spouseAidAttendance[
                              results.combinedRating
                            ] || 0}
                            /mo
                          </p>
                        </div>
                      </label>
                    )}

                    {/* Children Under 18 */}
                    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            👶 {t("tacticalCalc", "childrenUnder18")}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            +$
                            {VA_PAY_RATES_2026.childUnder18[
                              results.combinedRating
                            ] || 0}
                            /mo each
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setDependents((prev) => ({
                                ...prev,
                                childrenUnder18: Math.max(
                                  0,
                                  prev.childrenUnder18 - 1,
                                ),
                              }))
                            }
                            className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold">
                            {dependents.childrenUnder18}
                          </span>
                          <button
                            onClick={() =>
                              setDependents((prev) => ({
                                ...prev,
                                childrenUnder18: prev.childrenUnder18 + 1,
                              }))
                            }
                            className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Children in School */}
                    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            🎓 {t("tacticalCalc", "childrenInSchool")}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            +$
                            {VA_PAY_RATES_2026.childSchool[
                              results.combinedRating
                            ] || 0}
                            /mo each
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setDependents((prev) => ({
                                ...prev,
                                childrenSchool: Math.max(
                                  0,
                                  prev.childrenSchool - 1,
                                ),
                              }))
                            }
                            className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold">
                            {dependents.childrenSchool}
                          </span>
                          <button
                            onClick={() =>
                              setDependents((prev) => ({
                                ...prev,
                                childrenSchool: prev.childrenSchool + 1,
                              }))
                            }
                            className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Dependent Parents */}
                    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            👴 {t("tacticalCalc", "dependentParents")}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            1: +$
                            {VA_PAY_RATES_2026.parentOne[
                              results.combinedRating
                            ] || 0}
                            /mo | 2: +$
                            {VA_PAY_RATES_2026.parentTwo[
                              results.combinedRating
                            ] || 0}
                            /mo
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setDependents((prev) => ({
                                ...prev,
                                dependentParents: Math.max(
                                  0,
                                  prev.dependentParents - 1,
                                ),
                              }))
                            }
                            className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold">
                            {dependents.dependentParents}
                          </span>
                          <button
                            onClick={() =>
                              setDependents((prev) => ({
                                ...prev,
                                dependentParents: Math.min(
                                  2,
                                  prev.dependentParents + 1,
                                ),
                              }))
                            }
                            className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pay Results */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <span>💰</span> {t("tacticalCalc", "yourEstimatedPay")}
                  </h3>

                  {/* Big Pay Display */}
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white text-center">
                    <p className="text-green-100 text-sm">
                      {t("tacticalCalc", "monthlyCompensation")}
                    </p>
                    <p className="text-5xl font-bold my-2">
                      $
                      {compensation.monthlyTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-green-100">
                      $
                      {compensation.annualTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                      /{t("tacticalCalc", "yearlyPay").toLowerCase()}
                    </p>
                  </div>

                  {/* Breakdown */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">
                      💵 {t("tacticalCalc", "breakdown")}
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          {t("tacticalCalc", "baseRate")} (
                          {results.combinedRating}%)
                        </span>
                        <span className="font-medium">
                          ${compensation.breakdown.baseRate.toLocaleString()}
                        </span>
                      </div>
                      {compensation.breakdown.spouseAddition > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>+ {t("tacticalCalc", "spouse")}</span>
                          <span>
                            +$
                            {compensation.breakdown.spouseAddition.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {compensation.breakdown.spouseAidAttendanceAddition >
                        0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>+ {t("tacticalCalc", "spouseAA")}</span>
                          <span>
                            +$
                            {compensation.breakdown.spouseAidAttendanceAddition.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {compensation.breakdown.childrenUnder18Addition > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>+ {t("tacticalCalc", "childrenUnder18")}</span>
                          <span>
                            +$
                            {compensation.breakdown.childrenUnder18Addition.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {compensation.breakdown.childrenSchoolAddition > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>+ {t("tacticalCalc", "childrenInSchool")}</span>
                          <span>
                            +$
                            {compensation.breakdown.childrenSchoolAddition.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {compensation.breakdown.parentsAddition > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>+ {t("tacticalCalc", "dependentParents")}</span>
                          <span>
                            +$
                            {compensation.breakdown.parentsAddition.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="border-t dark:border-gray-700 pt-2 flex justify-between font-bold">
                        <span>{t("tacticalCalc", "total")}</span>
                        <span>
                          $
                          {compensation.monthlyTotal.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SMC Note */}
                  {results.combinedRating === 100 && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>💡 {t("tacticalCalc", "smcNote")}</strong>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* What-If Tab */}
            {activeTab === "whatif" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Scenario Input */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <span>🎯</span> {t("tacticalCalc", "whatIfQuestion")}
                  </h3>

                  <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {t("tacticalCalc", "whatIfDesc")}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t("tacticalCalc", "newRatingPercentage")}
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {ratingOptions
                          .filter((r) => r > 0)
                          .map((r) => (
                            <button
                              key={r}
                              onClick={() => setWhatIfRating(r)}
                              className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                                whatIfRating === r
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                              }`}
                            >
                              {r}%
                            </button>
                          ))}
                      </div>
                    </div>

                    {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                    <label className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={whatIfBilateral}
                        onChange={(e) => setWhatIfBilateral(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="font-medium text-purple-800 dark:text-purple-200">
                          🔄 {t("tacticalCalc", "wouldBeBilateral")}
                        </span>
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                          {t("tacticalCalc", "addsBilateralBoost")}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* What-If Results */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <span>📊</span> {t("tacticalCalc", "projectedImpact")}
                  </h3>

                  {/* Before/After Comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        {t("tacticalCalc", "current")}
                      </p>
                      <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">
                        {whatIfResults.currentRating}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {t("tacticalCalc", "rawScore")}:{" "}
                        {whatIfResults.currentRaw}%
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 rounded-xl p-4 text-center border-2 border-green-300 dark:border-green-700">
                      <p className="text-sm text-green-600 dark:text-green-400 mb-1">
                        {t("common", "with") || "With"} +{whatIfRating}%
                      </p>
                      <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                        {whatIfResults.newRating}%
                      </p>
                      <p className="text-xs text-green-600">
                        {t("tacticalCalc", "rawScore")}: {whatIfResults.newRaw}%
                      </p>
                    </div>
                  </div>

                  {/* Change Summary */}
                  <div
                    className={`p-4 rounded-xl ${
                      whatIfResults.ratingIncrease > 0
                        ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700"
                        : "bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">
                        {t("tacticalCalc", "ratingChange")}:
                      </span>
                      <span
                        className={`font-bold text-xl ${
                          whatIfResults.ratingIncrease > 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {whatIfResults.ratingIncrease > 0 ? "+" : ""}
                        {whatIfResults.ratingIncrease}%
                      </span>
                    </div>
                  </div>

                  {/* Pay Comparison */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">
                      💰 {t("tacticalCalc", "payComparisonSolo")}
                    </h4>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {t("tacticalCalc", "current")} (
                          {whatIfResults.currentRating}%)
                        </span>
                        <span>
                          $
                          {VA_PAY_RATES_2026.solo[
                            whatIfResults.currentRating
                          ]?.toLocaleString() || 0}
                          /mo
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                        <span>
                          {t("tacticalCalc", "projected")} (
                          {whatIfResults.newRating}%)
                        </span>
                        <span>
                          $
                          {VA_PAY_RATES_2026.solo[
                            whatIfResults.newRating
                          ]?.toLocaleString() || 0}
                          /mo
                        </span>
                      </div>
                      <div className="border-t dark:border-gray-700 pt-2 flex justify-between font-bold">
                        <span>{t("tacticalCalc", "monthlyIncrease")}</span>
                        <span className="text-green-600 dark:text-green-400">
                          +$
                          {(
                            (VA_PAY_RATES_2026.solo[whatIfResults.newRating] ||
                              0) -
                            (VA_PAY_RATES_2026.solo[
                              whatIfResults.currentRating
                            ] || 0)
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                        <span>{t("tacticalCalc", "annualIncrease")}</span>
                        <span>
                          +$
                          {(
                            ((VA_PAY_RATES_2026.solo[whatIfResults.newRating] ||
                              0) -
                              (VA_PAY_RATES_2026.solo[
                                whatIfResults.currentRating
                              ] || 0)) *
                            12
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pathfinder Hook */}
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">
                      <strong>💡 {t("tacticalCalc", "proTip")}:</strong>{" "}
                      {t("tacticalCalc", "pathfinderTip")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Rates Tab - 2026 VA Compensation Rates */}
            {activeTab === "rates" && (
              <div className="space-y-6">
                {/* Header Info */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl p-4 border border-green-200 dark:border-green-700">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">📊</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-green-800 dark:text-green-200">
                        {t("tacticalCalc", "vaDisabilityRates2026")}
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        {t("tacticalCalc", "effectiveDate")} •{" "}
                        {t("tacticalCalc", "source")}:{" "}
                        <a
                          href="https://www.va.gov/disability/compensation-rates/veteran-rates/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:no-underline"
                        >
                          VA.gov
                        </a>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Basic Rates - 10% to 20% */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center text-sm">
                      💰
                    </span>
                    {t("tacticalCalc", "veteransWith10to20")}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {t("tacticalCalc", "noDependentBenefits")}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        $180.42
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        10% Rating
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        $356.66
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        20% Rating
                      </div>
                    </div>
                  </div>
                </div>

                {/* Veteran Alone Rates - 30% to 100% */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center text-sm">
                      👤
                    </span>
                    {t("tacticalCalc", "veteranAlone")}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400">
                            {t("tacticalCalc", "rating")}
                          </th>
                          <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">
                            {t("tacticalCalc", "monthly")}
                          </th>
                          <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">
                            {t("tacticalCalc", "annual")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[30, 40, 50, 60, 70, 80, 90, 100].map((rating) => (
                          <tr
                            key={rating}
                            className={`border-b dark:border-gray-700 ${rating === 100 ? "bg-green-50 dark:bg-green-900/20" : ""}`}
                          >
                            <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">
                              {rating}%
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-white">
                              $
                              {VA_PAY_RATES_2026.solo[rating]?.toLocaleString(
                                "en-US",
                                { minimumFractionDigits: 2 },
                              )}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                              $
                              {(
                                VA_PAY_RATES_2026.solo[rating] * 12
                              )?.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* With Spouse Rates */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 bg-pink-100 dark:bg-pink-900 rounded-lg flex items-center justify-center text-sm">
                      💑
                    </span>
                    {t("tacticalCalc", "withSpouse")}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400">
                            {t("tacticalCalc", "rating")}
                          </th>
                          <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">
                            {t("tacticalCalc", "monthly")}
                          </th>
                          <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">
                            {t("tacticalCalc", "spouseAdd")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[30, 40, 50, 60, 70, 80, 90, 100].map((rating) => (
                          <tr
                            key={rating}
                            className="border-b dark:border-gray-700"
                          >
                            <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">
                              {rating}%
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-white">
                              $
                              {(
                                VA_PAY_RATES_2026.solo[rating] +
                                VA_PAY_RATES_2026.spouse[rating]
                              )?.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                              +$
                              {VA_PAY_RATES_2026.spouse[rating]?.toLocaleString(
                                "en-US",
                                { minimumFractionDigits: 2 },
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Added Amounts Table */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 bg-amber-100 dark:bg-amber-900 rounded-lg flex items-center justify-center text-sm">
                      ➕
                    </span>
                    {t("tacticalCalc", "additionalAmounts")}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {t("tacticalCalc", "additionalAmountsNote")}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400">
                            {t("tacticalCalc", "dependentType")}
                          </th>
                          <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">
                            30%
                          </th>
                          <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">
                            50%
                          </th>
                          <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">
                            70%
                          </th>
                          <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">
                            100%
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b dark:border-gray-700">
                          <td className="py-2 px-3 text-gray-900 dark:text-white">
                            {t("tacticalCalc", "spouse")}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.spouse[30]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.spouse[50]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.spouse[70]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.spouse[100]}
                          </td>
                        </tr>
                        <tr className="border-b dark:border-gray-700">
                          <td className="py-2 px-3 text-gray-900 dark:text-white">
                            {t("tacticalCalc", "spouseAA")}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.spouseAidAttendance[30]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.spouseAidAttendance[50]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.spouseAidAttendance[70]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.spouseAidAttendance[100]}
                          </td>
                        </tr>
                        <tr className="border-b dark:border-gray-700">
                          <td className="py-2 px-3 text-gray-900 dark:text-white">
                            {t("tacticalCalc", "firstChild")}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.firstChild[30]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.firstChild[50]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.firstChild[70]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.firstChild[100]}
                          </td>
                        </tr>
                        <tr className="border-b dark:border-gray-700">
                          <td className="py-2 px-3 text-gray-900 dark:text-white">
                            {t("tacticalCalc", "addlChildUnder18")}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.childUnder18[30]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.childUnder18[50]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.childUnder18[70]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.childUnder18[100]}
                          </td>
                        </tr>
                        <tr className="border-b dark:border-gray-700">
                          <td className="py-2 px-3 text-gray-900 dark:text-white">
                            {t("tacticalCalc", "childSchool")}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.childSchool[30]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.childSchool[50]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.childSchool[70]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.childSchool[100]}
                          </td>
                        </tr>
                        <tr className="border-b dark:border-gray-700">
                          <td className="py-2 px-3 text-gray-900 dark:text-white">
                            {t("tacticalCalc", "oneParent")}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.parentOne[30]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.parentOne[50]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.parentOne[70]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.parentOne[100]}
                          </td>
                        </tr>
                        <tr className="border-b dark:border-gray-700">
                          <td className="py-2 px-3 text-gray-900 dark:text-white">
                            {t("tacticalCalc", "twoParents")}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.parentTwo[30]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.parentTwo[50]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.parentTwo[70]}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            +${VA_PAY_RATES_2026.parentTwo[100]}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Quick Reference Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl p-4">
                    <div className="text-3xl font-bold">$3,938.58</div>
                    <div className="text-green-100 text-sm">
                      {t("tacticalCalc", "veteranAlone100")}
                    </div>
                    <div className="text-green-100 text-xs mt-1">
                      $47,262.96/{t("tacticalCalc", "year")}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl p-4">
                    <div className="text-3xl font-bold">$4,158.17</div>
                    <div className="text-blue-100 text-sm">
                      {t("tacticalCalc", "withSpouse100")}
                    </div>
                    <div className="text-blue-100 text-xs mt-1">
                      $49,898.04/{t("tacticalCalc", "year")}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-xl p-4">
                    <div className="text-3xl font-bold">$4,318.99</div>
                    <div className="text-purple-100 text-sm">
                      {t("tacticalCalc", "withSpouseChild100")}
                    </div>
                    <div className="text-purple-100 text-xs mt-1">
                      $51,827.88/{t("tacticalCalc", "year")}
                    </div>
                  </div>
                </div>

                {/* COLA Note */}
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                  <div className="flex gap-3">
                    <span className="text-xl">ℹ️</span>
                    <div>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>{t("tacticalCalc", "colaTitle")}:</strong>{" "}
                        {t("tacticalCalc", "colaDescription")}
                      </p>
                      <a
                        href="https://www.ssa.gov/cola/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
                      >
                        {t("tacticalCalc", "learnMoreCola")} →
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <p>📋 {t("tacticalCalc", "footerCFR")}</p>
                <p>{t("tacticalCalc", "footerDisclaimer")}</p>
              </div>
              <div className="flex items-center gap-3">
                <BuyMeCoffee
                  show={conditions.length > 0}
                  trigger="tactical-calculator"
                  componentKey="tactical-calculator"
                />
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {t("tacticalCalc", "close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ResponsiveModal>

      {/* VA.gov Rating Paster Modal */}
      {showVAGovPaster && (
        <VAGovRatingPaster
          onRatingsParsed={handlePastedRatings}
          onClose={() => setShowVAGovPaster(false)}
          showExample={true}
        />
      )}

      {/* Edit Condition Modal */}
      {editingCondition && (
        <ResponsiveModal
          isOpen
          onClose={handleCancelEdit}
          size="md"
          zIndex={70}
          labelledBy="edit-condition-title"
          header={
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4">
              <h3 id="edit-condition-title" className="text-xl font-bold">
                {t("tacticalCalc", "editCondition")}
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                Update rating and bilateral status
              </p>
            </div>
          }
          footer={
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t("tacticalCalc", "cancel")}
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t("tacticalCalc", "saveChanges")}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Condition Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("tacticalCalc", "conditionName")}
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder={t("tacticalCalc", "conditionPlaceholder")}
              />
            </div>

            {/* Body Part */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("tacticalCalc", "bodyPartSystem")}
              </label>
              <select
                aria-label={t("tacticalCalc", "bodyPartSystem")}
                value={editForm.bodyPart}
                onChange={(e) =>
                  setEditForm({ ...editForm, bodyPart: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{t("tacticalCalc", "selectBodyPart")}</option>
                <optgroup label={t("tacticalCalc", "extremitiesGroup")}>
                  {BODY_PARTS.extremities.map((bp) => (
                    <option key={bp.value} value={bp.value}>
                      {bp.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t("tacticalCalc", "otherSystems")}>
                  {BODY_PARTS.other.map((bp) => (
                    <option key={bp.value} value={bp.value}>
                      {bp.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Rating Percentage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("tacticalCalc", "ratingPercentage")}
              </label>
              <select
                aria-label={t("tacticalCalc", "ratingPercentage")}
                value={editForm.rating}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    rating: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {ratingOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}%
                  </option>
                ))}
              </select>
            </div>

            {/* Side (only show if body part can be bilateral) */}
            {editForm.bodyPart &&
              allBodyParts.find((bp) => bp.value === editForm.bodyPart)
                ?.canBeBilateral && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("tacticalCalc", "sideBilateral")}
                  </label>
                  <select
                    aria-label={t("tacticalCalc", "sideBilateral")}
                    value={editForm.side}
                    onChange={(e) =>
                      setEditForm({ ...editForm, side: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="none">
                      {t("tacticalCalc", "notBilateral")}
                    </option>
                    <option value="left">{t("tacticalCalc", "left")}</option>
                    <option value="right">{t("tacticalCalc", "right")}</option>
                    <option value="bilateral">
                      {t("tacticalCalc", "bothSides")}
                    </option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 {t("tacticalCalc", "bilateralHint")}
                  </p>
                </div>
              )}

            {/* Bilateral Factor Explanation */}
            {editForm.side !== "none" && (
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                <div className="flex gap-2">
                  <span className="text-lg">🔄</span>
                  <div className="text-sm text-purple-700 dark:text-purple-300">
                    <p className="font-semibold">
                      {t("tacticalCalc", "bilateralWillApply")}
                    </p>
                    <p className="text-xs mt-1">
                      {t("tacticalCalc", "bilateralExplanation")}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ResponsiveModal>
      )}
    </>
  );
};

// Export a function that other components can use to add conditions
export const addToCalculator = (condition, rating, side = "none") => {
  // This will be handled via context or state management
  // For now, we'll dispatch a custom event
  const event = new CustomEvent("addToCalculator", {
    detail: { condition, rating, side },
  });
  window.dispatchEvent(event);
};

export default TacticalCalculator;
