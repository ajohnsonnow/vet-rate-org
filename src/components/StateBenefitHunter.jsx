import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ReportBugLink from "./ReportBugLink";
import BuyMeCoffee from "./BuyMeCoffee";
import ResponsiveModal from "./common/ResponsiveModal";
import { searchStateBenefits, isAIAvailable } from "../utils/aiStatementHelper";
import { generateAI } from "../utils/unifiedAIService";
import { AIStatusBadge } from "./AIModeSelector";
import VoiceInputButton from "./VoiceInput";

/**
 * StateBenefitHunter Component
 * "Money on the Table" - Finds state-specific veteran benefits
 *
 * ✅ NOW USING REAL SCRAPED DATA:
 * ==================================
 * This feature uses data scraped from official state .gov sources (178 benefits across 51 states).
 * Last Update: January 24, 2026
 *
 * VERIFICATION STATUS:
 * - ✓ Verified (3 states): Texas, California, Florida - Manually verified high-quality data
 * - ⚠ Pending Verification (48 states): Template-generated from state profiles, needs manual review
 *
 * DATA COLLECTION:
 * - Property tax exemption laws
 * - Vehicle registration benefits (DV plates)
 * - Education/tuition waiver programs
 * - Recreation (hunting/fishing) licenses
 * - Employment preferences
 * - Healthcare beyond federal VA
 * - Housing assistance programs
 *
 * UPDATE MECHANISM:
 * - Quarterly full re-scrapes (Jan, Apr, Jul, Oct)
 * - Monthly legislative monitoring for law changes
 * - User-reported corrections workflow
 * - Admin dashboard for manual updates
 *
 * See: src/data/stateBenefits.js for the complete database
 * See: scripts/state-benefits-scraper/FINAL_REPORT.md for scraping details
 */

// All 50 US states plus DC
const US_STATES = [
  { value: "", label: "Select your state..." },
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

// Rating levels for selection
const RATING_LEVELS = [
  { value: 0, label: "0%" },
  { value: 10, label: "10%" },
  { value: 20, label: "20%" },
  { value: 30, label: "30%" },
  { value: 40, label: "40%" },
  { value: 50, label: "50%" },
  { value: 60, label: "60%" },
  { value: 70, label: "70%" },
  { value: 80, label: "80%" },
  { value: 90, label: "90%" },
  { value: 100, label: "100%" },
  { value: "100-PT", label: "100% P&T (Permanent & Total)" },
];

// Category icons and colors for benefit cards
const CATEGORY_CONFIG = {
  "Property Tax": {
    icon: "🏠",
    color: "from-green-500 to-emerald-600",
    bgLight: "bg-green-50 dark:bg-green-900/30",
    borderColor: "border-green-200 dark:border-green-700",
    textColor: "text-green-700 dark:text-green-300",
    badge: "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200",
    highlight: true, // Money saved!
  },
  Tax: {
    icon: "💵",
    color: "from-green-500 to-emerald-600",
    bgLight: "bg-green-50 dark:bg-green-900/30",
    borderColor: "border-green-200 dark:border-green-700",
    textColor: "text-green-700 dark:text-green-300",
    badge: "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200",
    highlight: true,
  },
  Vehicle: {
    icon: "🚗",
    color: "from-blue-500 to-indigo-600",
    bgLight: "bg-blue-50 dark:bg-blue-900/30",
    borderColor: "border-blue-200 dark:border-blue-700",
    textColor: "text-blue-700 dark:text-blue-300",
    badge: "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200",
  },
  Education: {
    icon: "🎓",
    color: "from-purple-500 to-violet-600",
    bgLight: "bg-purple-50 dark:bg-purple-900/30",
    borderColor: "border-purple-200 dark:border-purple-700",
    textColor: "text-purple-700 dark:text-purple-300",
    badge:
      "bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200",
  },
  Recreation: {
    icon: "🎣",
    color: "from-cyan-500 to-sky-600",
    bgLight: "bg-cyan-50 dark:bg-cyan-900/30",
    borderColor: "border-cyan-200 dark:border-cyan-700",
    textColor: "text-cyan-700 dark:text-cyan-300",
    badge: "bg-cyan-100 dark:bg-cyan-800 text-cyan-800 dark:text-cyan-200",
    lifestyle: true, // Lifestyle benefit!
  },
  Employment: {
    icon: "💼",
    color: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50 dark:bg-amber-900/30",
    borderColor: "border-amber-200 dark:border-amber-700",
    textColor: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-200",
  },
  Healthcare: {
    icon: "🏥",
    color: "from-red-500 to-rose-600",
    bgLight: "bg-red-50 dark:bg-red-900/30",
    borderColor: "border-red-200 dark:border-red-700",
    textColor: "text-red-700 dark:text-red-300",
    badge: "bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200",
  },
  Housing: {
    icon: "🏡",
    color: "from-teal-500 to-green-600",
    bgLight: "bg-teal-50 dark:bg-teal-900/30",
    borderColor: "border-teal-200 dark:border-teal-700",
    textColor: "text-teal-700 dark:text-teal-300",
    badge: "bg-teal-100 dark:bg-teal-800 text-teal-800 dark:text-teal-200",
    highlight: true,
  },
  default: {
    icon: "⭐",
    color: "from-gray-500 to-slate-600",
    bgLight: "bg-gray-50 dark:bg-gray-900/30",
    borderColor: "border-gray-200 dark:border-gray-700",
    textColor: "text-gray-700 dark:text-gray-300",
    badge: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
  },
};

const getStateName = (stateCode) => {
  const state = US_STATES.find((s) => s.value === stateCode);
  return state ? state.label : stateCode;
};

const getRatingDisplay = (selectedRating) => {
  if (selectedRating === "100-PT") {
    return "100% P&T";
  }
  return `${selectedRating}%`;
};

const getCategoryConfig = (category) => {
  // Check for partial matches
  for (const key of Object.keys(CATEGORY_CONFIG)) {
    if (category.toLowerCase().includes(key.toLowerCase())) {
      return CATEGORY_CONFIG[key];
    }
  }
  return CATEGORY_CONFIG.default;
};

const _groupBenefitsByCategory = (benefits) => {
  if (!benefits || !Array.isArray(benefits)) return {};

  const grouped = {};
  benefits.forEach((benefit) => {
    const cat = benefit.category || "Other";
    if (!grouped[cat]) {
      grouped[cat] = [];
    }
    grouped[cat].push(benefit);
  });
  return grouped;
};

const BenefitCard = ({ benefit, index }) => {
  const config = getCategoryConfig(benefit.category);

  return (
    <div
      key={index}
      className={`${config.bgLight} ${config.borderColor} border rounded-xl p-4 transition-all hover:shadow-lg hover:-translate-y-0.5`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center text-xl shadow-sm`}
        >
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {benefit.benefit_name}
            </h4>
            {config.highlight && (
              <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full animate-pulse">
                💰 MONEY SAVED
              </span>
            )}
            {config.lifestyle && (
              <span className="px-2 py-0.5 bg-cyan-500 text-white text-xs font-bold rounded-full">
                🎯 LIFESTYLE
              </span>
            )}
          </div>
          <p className={`text-sm ${config.textColor} mt-1 font-medium`}>
            {benefit.value}
          </p>
          {benefit.requirement && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              <span className="font-medium">Requirement:</span>{" "}
              {benefit.requirement}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const ModalHeader = ({ onClose, onReportBug }) => (
  <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white px-6 py-6 relative overflow-hidden">
    {/* Decorative elements */}
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>

    <div className="relative flex items-start justify-between">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
          <span className="text-3xl">💰</span>
        </div>
        <div>
          <h2
            id="state-benefit-hunter-title"
            className="text-2xl sm:text-3xl font-bold"
          >
            State Benefit Hunter{" "}
            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
              BETA
            </span>
          </h2>
          <p className="text-green-100 text-sm sm:text-base mt-1">
            Find the money you&apos;re leaving on the table
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onReportBug && (
          <ReportBugLink
            onClick={onReportBug}
            variant="light"
            moduleName="State Benefit Hunter"
          />
        )}
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          aria-label="Close"
        >
          <svg
            className="w-6 h-6"
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
);

const ModalFooter = ({ onClose, results }) => (
  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
    <BuyMeCoffee show={results !== null} trigger="state-benefits" />
    <button
      onClick={onClose}
      className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
    >
      Close
    </button>
  </div>
);

const InfoBanner = () => (
  <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 border border-amber-200 dark:border-amber-700 rounded-xl">
    <div className="flex items-start gap-3">
      <span className="text-2xl">💡</span>
      <div>
        <h3 className="font-semibold text-amber-800 dark:text-amber-200">
          Did you know?
        </h3>
        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
          Many veterans miss out on <strong>thousands of dollars</strong> in
          state benefits each year. These include property tax exemptions, free
          vehicle registration, hunting/fishing licenses, and education benefits
          that &quot;Claim Sharks&quot; never tell you about.
        </p>
      </div>
    </div>
  </div>
);

const PermanentTotalCheckbox = ({
  selectedRating,
  isPermanentTotal,
  setIsPermanentTotal,
}) => {
  const showCheckbox =
    selectedRating &&
    selectedRating !== "100-PT" &&
    parseInt(selectedRating) >= 70;

  if (!showCheckbox) return null;

  return (
    <div className="mb-4">
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={isPermanentTotal}
          onChange={(e) => setIsPermanentTotal(e.target.checked)}
          className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
        />
        <span>
          I have a <strong>Permanent & Total (P&T)</strong> designation
        </span>
      </label>
    </div>
  );
};

const SearchButton = ({ isLoading, disabled, onSearch }) => (
  <button
    onClick={onSearch}
    disabled={disabled}
    className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
  >
    {isLoading ? (
      <>
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span>Hunting for Benefits...</span>
      </>
    ) : (
      <>
        <span>🎯</span>
        <span>Find My State Benefits</span>
      </>
    )}
  </button>
);

const SelectionForm = ({
  selectedState,
  setSelectedState,
  selectedRating,
  setSelectedRating,
  isPermanentTotal,
  setIsPermanentTotal,
  isLoading,
  onSearch,
}) => (
  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 mb-6">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
      Enter Your Information
    </h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      {/* State Selector */}
      <div>
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Your State
        </label>
        <select
          aria-label="Your State"
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          {US_STATES.map((state) => (
            <option key={state.value} value={state.value}>
              {state.label}
            </option>
          ))}
        </select>
      </div>

      {/* Rating Selector */}
      <div>
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Combined VA Rating
        </label>
        <select
          aria-label="Combined VA Rating"
          value={selectedRating}
          onChange={(e) => {
            setSelectedRating(e.target.value);
            setIsPermanentTotal(e.target.value === "100-PT");
          }}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="">Select your rating...</option>
          {RATING_LEVELS.map((rating) => (
            <option key={rating.value} value={rating.value}>
              {rating.label}
            </option>
          ))}
        </select>
      </div>
    </div>

    <PermanentTotalCheckbox
      selectedRating={selectedRating}
      isPermanentTotal={isPermanentTotal}
      setIsPermanentTotal={setIsPermanentTotal}
    />

    <SearchButton
      isLoading={isLoading}
      disabled={isLoading || !selectedState || selectedRating === ""}
      onSearch={onSearch}
    />
  </div>
);

const AIAdvisorButton = ({ isAIThinking, disabled, onConsult }) => (
  <button
    onClick={onConsult}
    disabled={disabled}
    className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
  >
    {isAIThinking ? (
      <>
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span>AI Consulting...</span>
      </>
    ) : (
      <>
        <span>💬</span>
        <span>Get AI Advice</span>
      </>
    )}
  </button>
);

const AIAdviceCard = ({ aiAdvice }) => {
  if (!aiAdvice) return null;

  return (
    <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xl">💡</span>
        <h4 className="font-semibold text-gray-900 dark:text-white">
          Benefits Advisor:
        </h4>
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
        {aiAdvice}
      </div>
    </div>
  );
};

const AIAdvisorSection = ({
  aiQuestion,
  setAIQuestion,
  onConsult,
  isAIThinking,
  aiAdvice,
  showAISettings,
  setShowAISettings,
}) => (
  <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 mb-6 border border-purple-200 dark:border-purple-700">
    <div className="flex items-center gap-3 mb-4">
      <span className="text-2xl">🤖</span>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          AI Benefits Advisor
        </h3>
        <AIStatusBadge
          onClick={() => setShowAISettings(!showAISettings)}
          className="mt-1"
        />
      </div>
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
      Have questions about state benefits, eligibility, or how to apply? Get
      personalized AI guidance.
    </p>

    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={aiQuestion}
          onChange={(e) => setAIQuestion(e.target.value)}
          placeholder="Example: What property tax exemptions am I eligible for with my rating? How do I apply?"
          className="w-full px-4 py-3 pr-14 rounded-lg border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 resize-none"
          rows={3}
        />
        <div className="absolute right-3 top-3">
          <VoiceInputButton
            onTranscript={(text) =>
              setAIQuestion((prev) => (prev ? `${prev} ${text}` : text))
            }
            size="sm"
          />
        </div>
      </div>
      <AIAdvisorButton
        isAIThinking={isAIThinking}
        disabled={isAIThinking || !aiQuestion.trim()}
        onConsult={onConsult}
      />

      <AIAdviceCard aiAdvice={aiAdvice} />
    </div>
  </div>
);

const ErrorBanner = ({ error }) => {
  if (!error) return null;

  return (
    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-red-700 dark:text-red-300">{error}</span>
      </div>
    </div>
  );
};

const BenefitsGrid = ({ benefits }) => {
  if (!benefits || benefits.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <span className="text-xl">📋</span>
        Your Eligible Benefits
        <span className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 text-sm rounded-full">
          {benefits.length} found
        </span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {benefits.map((benefit, index) => (
          <BenefitCard key={index} benefit={benefit} index={index} />
        ))}
      </div>
    </div>
  );
};

const OfficialLinkCard = ({ link }) => {
  if (!link) return null;

  return (
    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔗</span>
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">
              Official State Website
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-300">
              Verify these benefits on the official state page
            </p>
          </div>
        </div>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span>Visit Official Site</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>
    </div>
  );
};

const VerifiedDataNotice = ({ lastUpdated }) => (
  <>
    <p className="text-xs text-green-700 dark:text-green-300 leading-relaxed">
      <strong>Manually Verified:</strong> This data has been scraped and
      verified from official state sources. Includes legal citations, dollar
      amounts, and eligibility requirements.
    </p>
    <p className="text-xs text-green-700 dark:text-green-300 leading-relaxed mt-2">
      <strong>Last Updated:</strong> {lastUpdated || "January 24, 2026"}
    </p>
  </>
);

const PendingVerificationNotice = () => (
  <>
    <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
      <strong>Template-Generated:</strong> This data was auto-generated from
      state profiles and needs manual verification. Benefits shown are typical
      for this state but may not reflect current laws.
    </p>
    <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed mt-2">
      <strong>Always verify</strong> with your state&apos;s official Department
      of Veterans Affairs before applying. We&apos;re working to manually verify
      all 48 remaining states.
    </p>
  </>
);

const DataSourceNotice = ({ verified, lastUpdated }) => (
  <div className="mt-6 p-5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300 dark:border-green-600 rounded-lg">
    <div className="flex items-start gap-3">
      <span className="text-2xl">{verified ? "✓" : "⚠️"}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
          {verified ? "✓ Verified Data" : "⚠ Pending Verification"}
        </p>
        {verified ? (
          <VerifiedDataNotice lastUpdated={lastUpdated} />
        ) : (
          <PendingVerificationNotice />
        )}
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mt-2">
          <strong>Report Issues:</strong> Found outdated info? Use the
          &quot;Report Issue&quot; link below.
        </p>
      </div>
    </div>
  </div>
);

const ResultsSection = ({ results }) => {
  if (!results) return null;

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 rounded-xl p-4 border border-green-200 dark:border-green-700">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-2xl">🎉</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Benefits for {results.state}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {results.summary}
            </p>
          </div>
        </div>
      </div>

      <BenefitsGrid benefits={results.benefits} />
      <OfficialLinkCard link={results.link} />
      <DataSourceNotice
        verified={results.verified}
        lastUpdated={results.lastUpdated}
      />
    </div>
  );
};

const LoadingState = ({ isLoading, selectedState }) => {
  if (!isLoading) return null;

  return (
    <div className="text-center py-12">
      <div className="relative mb-6 inline-block">
        <div className="text-6xl animate-pulse">💰</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 border-4 border-green-200 dark:border-green-800 border-t-green-500 rounded-full animate-spin"></div>
        </div>
      </div>
      <p className="text-lg font-medium text-green-700 dark:text-green-300">
        Hunting for your benefits...
      </p>
      <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
        Searching {getStateName(selectedState)} veteran programs
      </p>
      <div className="mt-4 space-y-2 text-xs text-gray-500 dark:text-gray-500 max-w-xs mx-auto">
        <p className="flex items-center justify-center gap-2">
          <span className="animate-pulse">🏠</span> Checking property tax
          exemptions...
        </p>
        <p className="flex items-center justify-center gap-2">
          <span className="animate-pulse">🚗</span> Finding vehicle benefits...
        </p>
        <p className="flex items-center justify-center gap-2">
          <span className="animate-pulse">🎓</span> Discovering education
          programs...
        </p>
      </div>
      <p className="text-xs text-green-600 dark:text-green-400 mt-4">
        This usually takes 10-30 seconds
      </p>
    </div>
  );
};

const EmptyState = ({ results, isLoading, error }) => {
  if (results || isLoading || error) return null;

  return (
    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
      <div className="text-6xl mb-4">🗺️</div>
      <p className="text-lg">
        Select your state and rating to discover your benefits
      </p>
      <p className="text-sm mt-2">
        We&apos;ll search for property tax exemptions, vehicle registration
        benefits, education grants, and more!
      </p>
    </div>
  );
};

const fetchStateBenefits = async (selectedState, selectedRating) => {
  // Use state code directly instead of state name
  const stateCode = selectedState;
  const ratingNum =
    selectedRating === "100-PT" ? 100 : parseInt(selectedRating);

  const response = await searchStateBenefits(stateCode, ratingNum);

  if (response.success) {
    return { data: response.data, error: null };
  }
  return {
    data: null,
    error:
      response.error || "Failed to retrieve state benefits. Please try again.",
  };
};

const searchForBenefits = async ({
  selectedState,
  selectedRating,
  setIsLoading,
  setError,
  setResults,
}) => {
  if (!selectedState || selectedRating === "") {
    setError("Please select both a state and your combined rating.");
    return;
  }

  // No AI check needed - we use local scraped data now!

  setIsLoading(true);
  setError(null);
  setResults(null);

  try {
    const { data, error: fetchError } = await fetchStateBenefits(
      selectedState,
      selectedRating,
    );
    if (fetchError) {
      setError(fetchError);
    } else {
      setResults(data);
    }
  } catch (err) {
    console.error("State benefits search error:", err);
    setError("An error occurred while searching. Please try again.");
  } finally {
    setIsLoading(false);
  }
};

const buildAIAdvicePrompt = (aiQuestion, selectedState, selectedRating) =>
  `You are a state veteran benefits expert helping veterans understand and maximize their state-level benefits.

Veteran's Question: "${aiQuestion}"
${selectedState ? `State Context: ${getStateName(selectedState)}` : ""}
${selectedRating ? `VA Rating: ${getRatingDisplay(selectedRating)}` : ""}

Provide helpful, specific advice about:
- State-specific veteran benefits (property tax, vehicle registration, education, recreation)
- Eligibility requirements for different rating levels
- How to apply for these benefits
- Common mistakes veterans make in missing out on state benefits
- Priority benefits that save the most money
- Documentation typically needed

Be practical, encouraging, and emphasize these are benefits that "claim sharks" never tell veterans about.`;

const fetchAIAdvice = async (aiQuestion, selectedState, selectedRating) => {
  // Create a timeout promise (60 second timeout)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error("AI request timed out after 60 seconds")),
      60000,
    );
  });

  const prompt = buildAIAdvicePrompt(aiQuestion, selectedState, selectedRating);

  // Race between AI call and timeout
  const response = await Promise.race([generateAI(prompt), timeoutPromise]);

  // generateAI returns { text, mode } object - extract the text content
  const aiText = response?.text || response;
  if (!aiText) {
    return "Failed to get AI advice. Please try again.";
  }
  return typeof aiText === "string" ? aiText : JSON.stringify(aiText);
};

const consultAI = async ({
  aiQuestion,
  selectedState,
  selectedRating,
  setIsAIThinking,
  setAIAdvice,
  setError,
}) => {
  if (!aiQuestion.trim()) return;

  if (!isAIAvailable()) {
    setError(
      "AI features require an API key. Please configure AI in Settings.",
    );
    return;
  }

  setIsAIThinking(true);
  setAIAdvice(null);
  setError(null); // Clear previous errors

  try {
    const advice = await fetchAIAdvice(
      aiQuestion,
      selectedState,
      selectedRating,
    );
    setAIAdvice(advice);
  } catch (err) {
    console.error("AI consultation error:", err);
    const errorMsg = err.message?.includes("timed out")
      ? "AI request timed out. Please try again or check your connection."
      : "An error occurred during AI consultation. Please try again.";
    setError(errorMsg);
    setAIAdvice(null);
  } finally {
    setIsAIThinking(false);
  }
};

const StateBenefitHunter = ({ onClose, onReportBug }) => {
  const { _t } = useLanguage();

  const [selectedState, setSelectedState] = useState("");
  const [selectedRating, setSelectedRating] = useState("");
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPermanentTotal, setIsPermanentTotal] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [_showAIConsultation, _setShowAIConsultation] = useState(false);
  const [aiQuestion, setAIQuestion] = useState("");
  const [aiAdvice, setAIAdvice] = useState(null);
  const [isAIThinking, setIsAIThinking] = useState(false);

  const handleSearch = () =>
    searchForBenefits({
      selectedState,
      selectedRating,
      setIsLoading,
      setError,
      setResults,
    });

  const handleAIConsultation = () =>
    consultAI({
      aiQuestion,
      selectedState,
      selectedRating,
      setIsAIThinking,
      setAIAdvice,
      setError,
    });

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="xl"
      labelledBy="state-benefit-hunter-title"
      header={<ModalHeader onClose={onClose} onReportBug={onReportBug} />}
      footer={<ModalFooter onClose={onClose} results={results} />}
    >
      {/* Content */}
      <div>
        <InfoBanner />

        <SelectionForm
          selectedState={selectedState}
          setSelectedState={setSelectedState}
          selectedRating={selectedRating}
          setSelectedRating={setSelectedRating}
          isPermanentTotal={isPermanentTotal}
          setIsPermanentTotal={setIsPermanentTotal}
          isLoading={isLoading}
          onSearch={handleSearch}
        />

        <AIAdvisorSection
          aiQuestion={aiQuestion}
          setAIQuestion={setAIQuestion}
          onConsult={handleAIConsultation}
          isAIThinking={isAIThinking}
          aiAdvice={aiAdvice}
          showAISettings={showAISettings}
          setShowAISettings={setShowAISettings}
        />

        <ErrorBanner error={error} />
        <ResultsSection results={results} />
        <LoadingState isLoading={isLoading} selectedState={selectedState} />
        <EmptyState results={results} isLoading={isLoading} error={error} />
      </div>
    </ResponsiveModal>
  );
};

export default StateBenefitHunter;
