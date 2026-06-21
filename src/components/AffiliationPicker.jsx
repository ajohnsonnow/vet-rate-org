import { useTheme } from "../contexts/ThemeContext";

const GROUP_ORDER = ["Default", "Branch", "Inclusive", "Remembrance"];

function groupPalettes(palettes) {
  const map = {};
  GROUP_ORDER.forEach((g) => {
    map[g] = [];
  });
  palettes.forEach((p) => {
    if (map[p.group]) map[p.group].push(p);
  });
  return GROUP_ORDER.map((g) => ({ group: g, items: map[g] })).filter(
    (g) => g.items.length > 0,
  );
}

/**
 * AffiliationPicker — radio-group palette selector.
 *
 * Consumes PALETTES and setPalette from useTheme(). Grouped by
 * Default → Branch → Inclusive → Remembrance with a visible heading per group.
 * Commit-on-click only (no hover live-preview) to avoid leaked html classes.
 *
 * A11y: fieldset/legend per group, native radio inputs (sr-only), custom
 * styled label as the click target, aria-hidden decorative indicator.
 *
 * @param {{ onClose?: () => void }} props
 */
export default function AffiliationPicker({ onClose }) {
  const { palette: activePalette, setPalette, PALETTES, reducedMotion } =
    useTheme();

  const groups = groupPalettes(PALETTES);

  const handleSelect = (id) => {
    setPalette(id);
    onClose?.();
  };

  const transitionClass = reducedMotion
    ? ""
    : "transition-colors duration-150";

  return (
    <div
      data-testid="affiliation-picker"
      className="space-y-6"
    >
      {groups.map(({ group, items }) => (
        <fieldset key={group} className="border-0 p-0 m-0">
          <legend className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 px-1">
            {group}
          </legend>
          <div
            role="radiogroup"
            aria-label={`${group} affiliation palettes`}
            className="space-y-1"
          >
            {items.map((item) => {
              const isSelected = activePalette === item.id;
              return (
                <label
                  key={item.id}
                  data-testid={`affiliation-option-${item.id}`}
                  className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-va-blue dark:focus-within:ring-va-gold dark:focus-within:ring-offset-gray-800 ${transitionClass} ${
                    isSelected
                      ? "bg-va-blue/10 dark:bg-va-gold/20 border-2 border-va-blue dark:border-va-gold"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent"
                  }`}
                >
                  {/* Native radio — hidden but keyboard and screen-reader accessible */}
                  <input
                    type="radio"
                    name="affiliation-palette"
                    value={item.id}
                    checked={isSelected}
                    onChange={() => handleSelect(item.id)}
                    className="sr-only"
                  />

                  {/* Custom radio indicator (decorative — the native input carries semantics) */}
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      isSelected
                        ? "border-va-blue dark:border-va-gold bg-va-blue dark:bg-va-gold"
                        : "border-gray-400 dark:border-gray-500"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <circle cx="10" cy="10" r="5" />
                      </svg>
                    )}
                  </span>

                  {/* Icon */}
                  <span
                    className="flex-shrink-0 text-xl leading-none mt-0.5"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`block text-sm font-semibold ${
                        isSelected
                          ? "text-va-blue dark:text-va-gold"
                          : "text-gray-800 dark:text-gray-100"
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                      {item.description}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
