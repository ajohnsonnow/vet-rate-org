import { calculateVARating } from "../utils/vaCalculator";
import { getMyRatings } from "../utils/veteranProfile";
import { APP_TRANSLATIONS } from "../i18n/translations";

const englishText = (section, key) => APP_TRANSLATIONS[section]?.[key]?.en;

const openCalculator = () =>
  window.dispatchEvent(new CustomEvent("openTacticalCalculator"));

/**
 * Short form of the calculator's bilateral notice, for any screen that shows a
 * combined rating: names the entries that took no bilateral factor and opens
 * the Tactical Calculator, which lands on My Ratings when ratings are saved
 * and shows the reason for each entry. Reads the saved ratings unless
 * `conditions` is given. Screens without a translate function get English.
 */
export default function BilateralIssuesSummary({
  conditions,
  t = englishText,
}) {
  const names = calculateVARating(conditions ?? getMyRatings())
    .bilateralIssues.map((issue) => issue.name)
    .filter(Boolean);
  if (names.length === 0) return null;

  return (
    <div
      role="status"
      aria-label={t("tacticalCalc", "bilateralIssuesTitle")}
      className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg text-left text-sm text-amber-900 dark:text-amber-100"
    >
      <p className="font-semibold">
        {t("tacticalCalc", "bilateralIssuesTitle")}
      </p>
      <p className="mt-1 break-words">{names.join(", ")}</p>
      <button
        type="button"
        onClick={openCalculator}
        className="mt-1 min-h-[44px] font-semibold underline"
      >
        {t("tacticalCalc", "title")}
      </button>
    </div>
  );
}
