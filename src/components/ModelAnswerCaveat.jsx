import { APP_TRANSLATIONS } from "../i18n/translations";
import { useOptionalLanguage } from "../contexts/LanguageContext";

/**
 * The fixed line under an answer an on-device model wrote. Plain words, no
 * control, and not colour alone.
 */
export default function ModelAnswerCaveat({ className = "" }) {
  const language = useOptionalLanguage();
  const line = language
    ? language.t("modelAnswerCaveat", "line")
    : APP_TRANSLATIONS.modelAnswerCaveat.line.en;
  return (
    <p
      role="note"
      className={`mt-2 border-t border-current/20 pt-2 text-xs font-medium ${className}`}
    >
      {line}
    </p>
  );
}
