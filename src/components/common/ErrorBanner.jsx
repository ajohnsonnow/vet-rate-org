import { AlertCircle } from "lucide-react";

/**
 * ErrorBanner — accessible inline error/status display.
 *
 * Bakes in:
 *   - role="alert" + aria-live="polite" so screen readers announce the message
 *   - aria-atomic so the whole banner is re-announced on content change
 *   - optional `id` so adjacent inputs can reference it via aria-describedby
 *     (associating field-level errors with their input)
 *
 * Usage:
 *   <input aria-describedby="email-error" aria-invalid={!!emailError} />
 *   {emailError && <ErrorBanner id="email-error">{emailError}</ErrorBanner>}
 */
export function ErrorBanner({
  id,
  children,
  variant = "error",
  className = "",
  showIcon = true,
}) {
  const palette =
    variant === "warning"
      ? "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200"
      : "bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200";

  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={`border rounded-lg p-3 flex items-start gap-2 text-sm ${palette} ${className}`}
    >
      {showIcon && (
        <AlertCircle
          className="w-4 h-4 mt-0.5 flex-shrink-0"
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </div>
  );
}

export default ErrorBanner;
