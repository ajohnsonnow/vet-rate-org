import { BODY_PARTS } from "../utils/vaCalculator";

// Where a condition is: the body part and, for parts that have two sides, the
// side. Shared by the calculator's add form, its What-If tab and the What-If
// Sandbox, so all three ask the same question the same way.

export function BodyPartSelectField({
  t,
  newCondition,
  setNewCondition,
  allBodyParts,
}) {
  return (
    <div className="sm:col-span-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {t("tacticalCalc", "bodyPartConditionType")}
      </label>
      <select
        aria-label={t("tacticalCalc", "bodyPartConditionType")}
        value={newCondition.bodyPart}
        onChange={(e) => {
          const bp = e.target.value;
          const info = allBodyParts.find((p) => p.value === bp);
          setNewCondition((prev) => ({
            ...prev,
            bodyPart: bp,
            side: info?.canBeBilateral ? prev.side : "none",
          }));
        }}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      >
        <option value="">{t("tacticalCalc", "select")}</option>
        <optgroup label={t("tacticalCalc", "extremitiesBilateral")}>
          {BODY_PARTS.extremities.map((bp) => (
            <option key={bp.value} value={bp.value}>
              {bp.label}
            </option>
          ))}
        </optgroup>
        <optgroup label={t("tacticalCalc", "otherBodySystems")}>
          {BODY_PARTS.other.map((bp) => (
            <option key={bp.value} value={bp.value}>
              {bp.label}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}

export function SideSelectField({ t, newCondition, setNewCondition }) {
  return (
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
        <option value="none">{t("tacticalCalc", "notBilateral")}</option>
        <option value="left">{t("tacticalCalc", "left")}</option>
        <option value="right">{t("tacticalCalc", "right")}</option>
        <option value="bilateral">{t("tacticalCalc", "bothBilateral")}</option>
      </select>
    </div>
  );
}
