/**
 * LegalCitation — inline citation badge for legal-RAG answers.
 *
 * Renders the citation string as a click-through link to the original
 * `.gov` source plus the `fetched_at` date so the user can verify
 * currency. The fetched_at date matters: regulations change, and the
 * weekly cron in `.github/workflows/legal-ingestion.yml` is what keeps
 * this date fresh.
 *
 * Trust note: `source_url` is the only field rendered as an href. The
 * URL allow-list in `src/utils/sanitize.js` covers gov domains; the
 * sanitizer in `scripts/legal-ingestion/sanitize-html.mjs` already
 * stripped non-gov URLs at ingestion. We rel="noopener noreferrer"
 * defensively anyway.
 */

import { sanitizeUrl } from "../utils/sanitize.js";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function LegalCitation({
  citation,
  title,
  source_url,
  fetched_at,
  score,
}) {
  const sanitized = sanitizeUrl(source_url, { requireGov: true });
  const safeUrl = sanitized && sanitized !== "#" ? sanitized : "";
  const dateLabel = formatDate(fetched_at);

  const inner = (
    <span className="font-mono text-xs">{citation || "(uncited)"}</span>
  );

  return (
    <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs leading-tight text-slate-700">
      {safeUrl ? (
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${citation || "Citation"} (opens in new tab)`}
          className="text-blue-700 underline decoration-dotted hover:decoration-solid"
          title={title || ""}
        >
          {inner}
        </a>
      ) : (
        inner
      )}
      {dateLabel ? (
        <span className="text-slate-500" title="Last fetched">
          · {dateLabel}
        </span>
      ) : null}
      {typeof score === "number" ? (
        <span className="text-slate-400" title="Cosine similarity to query">
          · {score.toFixed(2)}
        </span>
      ) : null}
    </span>
  );
}

/**
 * LegalCitationList — render the citations array returned by
 * `legalAnswerer.answer(...)`.
 */
export function LegalCitationList({ citations }) {
  if (!Array.isArray(citations) || citations.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2" aria-label="Cited sources">
      {citations.map((c) => (
        <LegalCitation key={c.citation + c.source_url} {...c} />
      ))}
    </div>
  );
}

export default LegalCitation;
