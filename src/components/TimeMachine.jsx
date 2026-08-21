/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Time Machine - Intent to File Countdown
 * Shows the ticking clock and financial consequences of ITF expiration
 * Critical for preventing backpay loss
 *
 * IMPORTANT: Payment starts first of month FOLLOWING effective date per 38 CFR § 3.400
 */

import { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  calculatePaymentEffectiveDate,
  calculateBackpayMonths,
  calculateVARating,
} from "../utils/vaCalculator";
import { getCurrentYearRates } from "../data/vaPayRatesHistorical";
import { getMyRatings } from "../utils/veteranProfile";
import ReportBugLink from "./ReportBugLink";
import ResponsiveModal from "./common/ResponsiveModal";
import { formatLocalDate } from "../utils/dateUtils";

const ITF_STORAGE_KEY = "vet_rate_itf_date";
const ESTIMATED_RATING_KEY = "vet_rate_estimated_rating";

// Current-year solo compensation rates from the single source of truth
// (vaPayRatesHistorical.js). 0% is excluded — it pays nothing and would
// add a useless option to the rating dropdown.
function _urgencyTier(countdown) {
  if (countdown?.isExpired) return "expired";
  if (countdown?.isCritical) return "critical";
  if (countdown?.isUrgent) return "urgent";
  return "normal";
}

function _urgencyClass(countdown, classesByTier) {
  return classesByTier[_urgencyTier(countdown)];
}

const VA_MONTHLY_RATES = Object.fromEntries(
  Object.entries(getCurrentYearRates().rates.solo).filter(
    ([rating]) => Number(rating) >= 10,
  ),
);

function TimeMachineWidget({ countdown, onExpand }) {
  return (
    <div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
      onClick={onExpand}
      className={`cursor-pointer transition-all ${_urgencyClass(countdown, {
        expired: "bg-red-600 text-white",
        critical: "bg-red-500 text-white animate-pulse",
        urgent: "bg-yellow-500 text-white",
        normal: "bg-blue-600 text-white",
      })} rounded-lg p-4 shadow-lg hover:shadow-xl`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold opacity-90">Intent to File</p>
          {countdown.isExpired ? (
            <p className="text-2xl font-bold">EXPIRED!</p>
          ) : (
            <>
              <p className="text-3xl font-bold">
                {countdown.daysRemaining} Days
              </p>
              <p className="text-xs opacity-90">
                $
                {countdown.potentialBackpay.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}{" "}
                potential backpay
              </p>
            </>
          )}
        </div>
        <div className="text-5xl">⏰</div>
      </div>
    </div>
  );
}

function TimeMachineHeader({ countdown, onReportBug, onClose }) {
  return (
    <div
      className={`text-white p-6 ${_urgencyClass(countdown, {
        expired: "bg-gradient-to-r from-red-700 to-red-900",
        critical: "bg-gradient-to-r from-red-600 to-orange-600",
        urgent: "bg-gradient-to-r from-yellow-600 to-orange-600",
        normal: "bg-gradient-to-r from-blue-600 to-blue-800",
      })}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h2 id="timemachine-title" className="text-3xl font-bold mb-2">
            ⏰ The Time Machine{" "}
            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
              BETA
            </span>
          </h2>
          <p className="text-blue-100">
            Intent to File Countdown & Financial Impact
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onReportBug && (
            <ReportBugLink
              onClick={onReportBug}
              variant="light"
              moduleName="The Time Machine"
            />
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TimeMachineInputSection({
  itfDate,
  setItfDate,
  estimatedRating,
  setEstimatedRating,
  countdown,
  isEditing,
  handleSaveITF,
  setIsEditing,
}) {
  if (!(!countdown || isEditing)) return null;
  return (
    <div className="border-2 border-blue-300 dark:border-blue-700 rounded-lg p-6 bg-blue-50 dark:bg-blue-900/20">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
        📅 Enter Your Intent to File Date
      </h3>

      <div className="space-y-4">
        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            When did you file your Intent to File? *
          </label>
          <input
            type="date"
            value={itfDate}
            onChange={(e) => setItfDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 dark:bg-gray-700 dark:text-white text-lg"
          />
        </div>

        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Estimated Combined Rating (from Tactical Calculator):
          </label>
          <select
            value={estimatedRating}
            onChange={(e) =>
              setEstimatedRating(Number.parseInt(e.target.value))
            }
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 dark:bg-gray-700 dark:text-white text-lg"
          >
            {Object.keys(VA_MONTHLY_RATES).map((rating) => (
              <option key={rating} value={rating}>
                {rating}% - ${VA_MONTHLY_RATES[rating]}/month
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            This is used to calculate potential backpay amount.
          </p>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={handleSaveITF}
            disabled={!itfDate}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Start Countdown
          </button>
          {countdown && (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-6 py-3 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TimeMachineExpiredBanner({ countdown }) {
  return (
    <>
      <div className="text-8xl mb-4">⛔</div>
      <h3 className="text-4xl font-bold text-red-700 dark:text-red-400 mb-2">
        ITF EXPIRED
      </h3>
      <p className="text-xl text-red-600 dark:text-red-300 mb-4">
        Your Intent to File expired {Math.abs(countdown.daysRemaining)} days ago
      </p>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-md mx-auto">
        <p className="text-gray-800 dark:text-white font-semibold mb-2">
          ⚠️ URGENT ACTION REQUIRED:
        </p>
        <ul className="text-left text-gray-700 dark:text-gray-300 space-y-1">
          <li>1. File a NEW Intent to File IMMEDIATELY</li>
          <li>2. You may have lost backpay eligibility</li>
          <li>3. Contact a VSO for guidance</li>
        </ul>
      </div>
    </>
  );
}

function TimeMachineActiveCountdownBanner({ countdown }) {
  return (
    <>
      <div className="text-8xl mb-4">⏰</div>
      <h3 className="text-6xl font-bold text-gray-800 dark:text-white mb-2">
        {countdown.daysRemaining}
      </h3>
      <p className="text-2xl text-gray-600 dark:text-gray-300 mb-4">
        Days Until ITF Expiration
      </p>
      <p className="text-lg text-gray-600 dark:text-gray-300">
        Expires:{" "}
        {countdown.expirationDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>
    </>
  );
}

function TimeMachineCountdownBox({ countdown }) {
  return (
    <div
      className={`rounded-lg p-8 text-center ${_urgencyClass(countdown, {
        expired: "bg-red-100 dark:bg-red-900/30 border-4 border-red-600",
        critical:
          "bg-red-50 dark:bg-red-900/20 border-4 border-red-500 animate-pulse",
        urgent: "bg-yellow-50 dark:bg-yellow-900/20 border-4 border-yellow-500",
        normal: "bg-blue-50 dark:bg-blue-900/20 border-4 border-blue-500",
      })}`}
    >
      {countdown.isExpired ? (
        <TimeMachineExpiredBanner countdown={countdown} />
      ) : (
        <TimeMachineActiveCountdownBanner countdown={countdown} />
      )}
    </div>
  );
}

function TimeMachineFinancialImpact({ countdown, estimatedRating }) {
  if (countdown.isExpired) return null;
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Potential Backpay */}
      <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg p-6">
        <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
          💰 Potential Backpay
        </h4>
        <p className="text-4xl font-bold text-green-700 dark:text-green-400 mb-2">
          $
          {countdown.potentialBackpay.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Based on {countdown.monthsSinceITF} months since ITF
          <br />
          at {estimatedRating}% rating (${countdown.monthlyRate}/mo)
        </p>
        <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <strong>Payment Start Date:</strong>{" "}
            {countdown.paymentStartDate?.toLocaleDateString() ||
              "Calculating..."}
            <br />
            <em>
              (First of month following effective date per 38 CFR § 3.400)
            </em>
          </p>
        </div>
      </div>

      {/* At Risk */}
      {countdown.atRiskBackpay > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg p-6">
          <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
            ⚠️ Backpay At Risk
          </h4>
          <p className="text-4xl font-bold text-red-700 dark:text-red-400 mb-2">
            $
            {countdown.atRiskBackpay.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            You could lose this if ITF expires
            <br />
            before your claim is filed
          </p>
        </div>
      )}
    </div>
  );
}

function TimeMachineUrgencyWarnings({ countdown }) {
  return (
    <>
      {countdown.isCritical && !countdown.isExpired && (
        <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-600 p-4 rounded animate-pulse">
          <h4 className="font-bold text-red-800 dark:text-red-300 mb-2">
            🚨 CRITICAL: Less than 30 Days Remaining!
          </h4>
          <p className="text-red-700 dark:text-red-300">
            You need to file your claim IMMEDIATELY. Every day counts. If
            you&apos;re not ready, consider filing a &quot;protective
            claim&quot; with what you have now.
          </p>
        </div>
      )}

      {countdown.isUrgent && !countdown.isCritical && !countdown.isExpired && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-600 p-4 rounded">
          <h4 className="font-bold text-yellow-800 dark:text-yellow-300 mb-2">
            ⚠️ URGENT: Less than 60 Days Remaining
          </h4>
          <p className="text-yellow-700 dark:text-yellow-300">
            Time is running out. Prioritize completing your claim packet. Use
            all the tools in Vet-Rate to expedite your preparation.
          </p>
        </div>
      )}
    </>
  );
}

function TimeMachineTimeline({ countdown, itfDate }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
      <h4 className="font-semibold text-gray-800 dark:text-white mb-4">
        📊 Timeline Overview
      </h4>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-300">ITF Filed:</span>
          <span className="font-semibold text-gray-800 dark:text-white">
            {formatLocalDate(itfDate).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-300">
            Days Elapsed:
          </span>
          <span className="font-semibold text-gray-800 dark:text-white">
            {countdown.daysSinceITF} days
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-300">
            Days Remaining:
          </span>
          <span
            className={`font-semibold ${_urgencyClass(countdown, {
              expired: "text-red-600",
              critical: "text-red-600",
              urgent: "text-yellow-600",
              normal: "text-green-600",
            })}`}
          >
            {countdown.daysRemaining} days
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-300">
            Expiration Date:
          </span>
          <span className="font-semibold text-gray-800 dark:text-white">
            {countdown.expirationDate.toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${_urgencyClass(
              countdown,
              {
                expired: "bg-red-600",
                critical: "bg-red-600",
                urgent: "bg-yellow-500",
                normal: "bg-blue-600",
              },
            )}`}
            style={{
              width: `${Math.max(0, (countdown.daysRemaining / 365) * 100)}%`,
            }}
          />
        </div>
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
          {Math.round((countdown.daysRemaining / 365) * 100)}% of ITF period
          remaining
        </p>
      </div>
    </div>
  );
}

function TimeMachineActions({ setIsEditing, handleClearITF }) {
  return (
    <div className="flex gap-4">
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
      >
        Edit ITF Date
      </button>
      <button
        type="button"
        onClick={handleClearITF}
        className="px-6 py-3 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-semibold transition-colors"
      >
        Clear
      </button>
    </div>
  );
}

function TimeMachineCountdownDisplay({
  countdown,
  isEditing,
  itfDate,
  estimatedRating,
  setIsEditing,
  handleClearITF,
}) {
  if (!countdown || isEditing) return null;
  return (
    <>
      <TimeMachineCountdownBox countdown={countdown} />

      {/* Financial Impact */}
      <TimeMachineFinancialImpact
        countdown={countdown}
        estimatedRating={estimatedRating}
      />

      {/* Urgency Warning */}
      <TimeMachineUrgencyWarnings countdown={countdown} />

      {/* Timeline */}
      <TimeMachineTimeline countdown={countdown} itfDate={itfDate} />

      {/* Actions */}
      <TimeMachineActions
        setIsEditing={setIsEditing}
        handleClearITF={handleClearITF}
      />
    </>
  );
}

function TimeMachineInfoBox({ countdown, isEditing }) {
  if (countdown || isEditing) return null;
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-4 rounded">
      <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
        💡 What is an Intent to File?
      </h4>
      <p className="text-blue-700 dark:text-blue-300 text-sm mb-2">
        An Intent to File (ITF) establishes your effective date for VA benefits.
        You have 365 days from the ITF date to submit your complete claim.
      </p>
      <p className="text-blue-700 dark:text-blue-300 text-sm font-semibold">
        Your backpay is calculated from your ITF date, not when you submit your
        claim!
      </p>
    </div>
  );
}

function _loadSavedITF(ctx) {
  const savedITF = localStorage.getItem(ITF_STORAGE_KEY);
  const savedRating = localStorage.getItem(ESTIMATED_RATING_KEY);

  if (savedITF) {
    ctx.setItfDate(savedITF);
  }
  if (savedRating) {
    ctx.setEstimatedRating(Number.parseInt(savedRating));
    return;
  }

  // No ITF-specific rating saved yet — use the veteran's actual saved
  // combined rating from My Ratings instead of the hardcoded 70% default.
  const myRatings = getMyRatings();
  if (myRatings && myRatings.length > 0) {
    const { combinedRating } = calculateVARating(myRatings);
    if (combinedRating > 0) {
      ctx.setEstimatedRating(combinedRating);
    }
  }
}

function _saveITF(itfDate, estimatedRating, ctx) {
  if (!itfDate) return;
  localStorage.setItem(ITF_STORAGE_KEY, itfDate);
  localStorage.setItem(ESTIMATED_RATING_KEY, estimatedRating.toString());
  ctx.setIsEditing(false);
}

function _clearITF(ctx) {
  localStorage.removeItem(ITF_STORAGE_KEY);
  localStorage.removeItem(ESTIMATED_RATING_KEY);
  ctx.setItfDate("");
  ctx.setCountdown(null);
  ctx.setIsEditing(false);
}

function _computeCountdown(itfDate, estimatedRating) {
  const itf = new Date(itfDate);
  const now = new Date();
  const expirationDate = new Date(itf);
  expirationDate.setDate(expirationDate.getDate() + 365);

  const diffTime = expirationDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const daysSinceITF = Math.floor((now - itf) / (1000 * 60 * 60 * 24));

  // FIXED: Use correct payment effective date calculation per 38 CFR § 3.400
  // Payment starts FIRST OF FOLLOWING MONTH after effective date (ITF date)
  const paymentStartDate = calculatePaymentEffectiveDate(itf);
  const actualBackpayMonths = calculateBackpayMonths(itf, now).totalMonths;

  const monthlyRate = VA_MONTHLY_RATES[estimatedRating] || 0;
  const potentialBackpay = monthlyRate * actualBackpayMonths;

  // Calculate months remaining until 1 year from ITF
  const maxBackpayDate = new Date(itf);
  maxBackpayDate.setFullYear(maxBackpayDate.getFullYear() + 1);
  const maxBackpayMonths = calculateBackpayMonths(
    itf,
    maxBackpayDate,
  ).totalMonths;
  const atRiskBackpay =
    monthlyRate * Math.max(0, maxBackpayMonths - actualBackpayMonths);

  return {
    daysRemaining: diffDays,
    expirationDate,
    daysSinceITF,
    monthsSinceITF: actualBackpayMonths, // Now accurate with payment effective date
    paymentStartDate, // Show when payments actually begin
    potentialBackpay,
    atRiskBackpay,
    monthlyRate,
    isExpired: diffDays < 0,
    isUrgent: diffDays <= 60 && diffDays > 0,
    isCritical: diffDays <= 30 && diffDays > 0,
  };
}

export default function TimeMachine({
  isWidget = false,
  onClose = null,
  onReportBug,
}) {
  const { _t } = useLanguage();

  const [itfDate, setItfDate] = useState("");
  const [estimatedRating, setEstimatedRating] = useState(70);
  const [countdown, setCountdown] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Load saved data
  useEffect(() => {
    _loadSavedITF({ setItfDate, setEstimatedRating });
  }, []);

  // Calculate countdown
  useEffect(() => {
    if (!itfDate) {
      setCountdown(null);
      return;
    }

    const tick = () =>
      setCountdown(_computeCountdown(itfDate, estimatedRating));

    tick();
    // Auto-persist whenever the date/rating changes so the countdown
    // survives modal close/reopen even if the veteran never clicks the button.
    localStorage.setItem(ITF_STORAGE_KEY, itfDate);
    localStorage.setItem(ESTIMATED_RATING_KEY, estimatedRating.toString());
    const interval = setInterval(tick, 1000 * 60 * 60); // Update every hour

    return () => clearInterval(interval);
  }, [itfDate, estimatedRating]);

  // Save ITF date and switch to countdown view (also called via the button in edit mode)
  const handleSaveITF = () =>
    _saveITF(itfDate, estimatedRating, { setIsEditing });

  // Clear ITF
  const handleClearITF = () =>
    _clearITF({ setItfDate, setCountdown, setIsEditing });

  // Widget view (compact)
  if (isWidget && countdown && !isEditing) {
    return (
      <TimeMachineWidget
        countdown={countdown}
        onExpand={() => setIsEditing(true)}
      />
    );
  }

  // Full modal view. The urgency-colored gradient header lives in the
  // ResponsiveModal `header` slot (its own close + ReportBugLink, so no default
  // close-X). Contextual Start/Edit/Clear actions stay grouped with their
  // inputs in the body rather than a sticky footer.
  const headerBar = (
    <TimeMachineHeader
      countdown={countdown}
      onReportBug={onReportBug}
      onClose={onClose}
    />
  );

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="xl"
      labelledBy="timemachine-title"
      header={headerBar}
    >
      <div className="space-y-6">
        {/* Input Section */}
        <TimeMachineInputSection
          itfDate={itfDate}
          setItfDate={setItfDate}
          estimatedRating={estimatedRating}
          setEstimatedRating={setEstimatedRating}
          countdown={countdown}
          isEditing={isEditing}
          handleSaveITF={handleSaveITF}
          setIsEditing={setIsEditing}
        />

        {/* Countdown Display */}
        <TimeMachineCountdownDisplay
          countdown={countdown}
          isEditing={isEditing}
          itfDate={itfDate}
          estimatedRating={estimatedRating}
          setIsEditing={setIsEditing}
          handleClearITF={handleClearITF}
        />

        {/* Info Box */}
        <TimeMachineInfoBox countdown={countdown} isEditing={isEditing} />
      </div>
    </ResponsiveModal>
  );
}
