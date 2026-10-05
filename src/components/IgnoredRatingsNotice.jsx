import { APP_TRANSLATIONS } from "../i18n/translations";

const englishText = (section, key) => APP_TRANSLATIONS[section]?.[key]?.en;

/**
 * One plain line for each entry the calculator left out because its rating
 * could not be read (`ignoredEntries` from calculateVARating), so the veteran
 * knows the combined rating does not include it.
 */
export default function IgnoredRatingsNotice({ ignored, t = englishText }) {
  const unread = (ignored ?? []).filter(
    (entry) => entry.reason === "rating-unreadable",
  );
  if (unread.length === 0) return null;
  return (
    <div
      role="status"
      className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg text-left text-sm text-amber-900 dark:text-amber-100"
    >
      {unread.map((entry, index) => (
        <p key={entry.id ?? `${entry.name}-${index}`} className="break-words">
          {entry.name && <strong>{entry.name}: </strong>}
          {t("tacticalCalc", "ratingUnreadable")}
        </p>
      ))}
    </div>
  );
}
