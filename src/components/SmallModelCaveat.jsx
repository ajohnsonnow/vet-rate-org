import { useState, useEffect } from "react";
import { APP_TRANSLATIONS } from "../i18n/translations";
import { useOptionalLanguage } from "../contexts/LanguageContext";
import { smallModelAnswering } from "../utils/smallModelAnswering";
import { getAIStatus } from "../utils/unifiedAIService";

const POLL_MS = 1000;

/**
 * Always-visible caveat on AI answers when a laptop or tablet class model
 * (2B or smaller, per the device profile table) is loaded and answering. It
 * has no control, so there is nothing to dismiss and no touch target to size.
 * It names itself and says why in words, so it does not rely on colour.
 */
export default function SmallModelCaveat({ className = "" }) {
  const [active, setActive] = useState(() =>
    smallModelAnswering(getAIStatus()),
  );
  useEffect(() => {
    const check = () => setActive(smallModelAnswering(getAIStatus()));
    check();
    const timer = setInterval(check, POLL_MS);
    return () => clearInterval(timer);
  }, []);
  const language = useOptionalLanguage();
  if (!active) return null;

  const text = (key) =>
    language
      ? language.t("smallModelCaveat", key)
      : APP_TRANSLATIONS.smallModelCaveat[key].en;
  const title = text("title");

  return (
    <div
      role="note"
      aria-label={title}
      className={`flex items-start gap-3 rounded-lg border-2 border-blue-700 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-50 ${className}`}
    >
      <span aria-hidden="true" className="font-bold">
        Note
      </span>
      <p className="min-w-0">
        <strong>{title}.</strong> {text("body")}
      </p>
    </div>
  );
}
