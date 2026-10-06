/**
 * The one-line note shown when a writing tool returns its app-built draft
 * because the AI's wording was not usable or the AI could not answer. Text
 * only: nothing here depends on colour. The label names the region for
 * assistive technology; the note itself is the content that is read.
 */
export default function StandardDraftNotice({
  note,
  className = "",
  label = "Draft notice",
}) {
  if (!note) return null;
  return (
    <p
      role="status"
      aria-label={label}
      className={`text-sm text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 border border-gray-400 dark:border-gray-500 rounded-lg p-3 ${className}`}
    >
      {note}
    </p>
  );
}
