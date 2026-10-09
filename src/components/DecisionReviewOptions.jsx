import { REVIEW_OPTIONS } from "../utils/reviewOptions";

const Quotation = ({ quote }) => (
  <figure className="m-0">
    <blockquote className="border-l-4 border-purple-300 dark:border-purple-600 pl-3 text-sm text-purple-900 dark:text-purple-100">
      {quote.text}
    </blockquote>
    <figcaption className="pl-4 mt-1 text-xs text-purple-700 dark:text-purple-300">
      {quote.citation}
    </figcaption>
  </figure>
);

/**
 * The app's corrections for one field of the decoded result, shown directly
 * under that field so a wrong instruction and its correction are read
 * together. `corrections` are { field, rule, note }.
 */
export function FieldCorrections({ corrections = [], field }) {
  const own = (corrections ?? []).filter((c) => c.field === field);
  if (own.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {own.map((correction) => (
        <p
          key={correction.rule}
          role="note"
          aria-label="Correction from Vet-Rate"
          className="p-3 rounded-lg bg-white dark:bg-gray-800 border-2 border-yellow-500 text-sm text-gray-900 dark:text-gray-100"
        >
          {correction.note}
        </p>
      ))}
    </div>
  );
}

const onePerRule = (corrections) =>
  corrections.filter(
    (c, i) => corrections.findIndex((other) => other.rule === c.rule) === i,
  );

/**
 * The review options a veteran has after a decision, shown from the bundled
 * regulation text. Nothing here is written by the model: `corrections` are
 * the app's notes ({ field, rule, note }) on wrong filing instructions found
 * in the model's own sections of the result, listed here once per rule.
 */
export default function DecisionReviewOptions({
  options = REVIEW_OPTIONS,
  corrections: allCorrections = [],
}) {
  const corrections = onePerRule(allCorrections ?? []);
  return (
    <section
      aria-labelledby="decision-review-options-heading"
      className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700 min-w-0"
    >
      <h4
        id="decision-review-options-heading"
        className="font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-2 mb-2"
      >
        <span aria-hidden="true">⚖️</span> Your review options
      </h4>
      <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
        These options are quoted from VA regulations. The AI did not write this
        section.
      </p>

      {corrections.length > 0 && (
        <ul
          aria-label="Corrections to the plan above"
          className="space-y-2 mb-3 list-none p-0"
        >
          {corrections.map((correction) => (
            <li
              key={correction.rule}
              className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 text-sm text-yellow-900 dark:text-yellow-100"
            >
              {correction.note}
            </li>
          ))}
        </ul>
      )}

      <Quotation quote={options.lead} />

      <ul className="space-y-3 mt-3 list-none p-0">
        {options.lanes.map((lane) => (
          <li
            key={lane.id}
            className="p-3 bg-white dark:bg-gray-800 rounded-lg space-y-2 min-w-0"
          >
            <p className="font-semibold text-sm text-purple-900 dark:text-purple-100 break-words">
              VA Form {lane.form.number}: {lane.form.title}
            </p>
            {lane.quotes.map((quote) => (
              <Quotation key={quote.citation} quote={quote} />
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
