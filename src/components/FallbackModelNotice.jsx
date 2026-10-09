import { useModelFallback } from "../utils/modelFallback";

/**
 * Says so, in plain words, when a fallback model is loaded instead of the
 * device's first choice. Shows nothing otherwise.
 */
export default function FallbackModelNotice({ className = "" }) {
  const fallback = useModelFallback();
  if (!fallback) return null;
  return (
    <p
      role="status"
      className={`rounded-lg border-2 border-amber-700 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-50 ${className}`}
    >
      <strong>A different model is loaded.</strong> {fallback.text}
    </p>
  );
}
