import { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { hasKnownVeteranName } from "../utils/unifiedAIService";

// ADR-008 section 2.9: the app cannot recognise a name it has never seen, so
// when it holds no name a typed name goes to an off-device AI as typed. One line
// near the AI input says so; it never blocks anything. The check runs again
// whenever a field gains focus, so a name saved while the input is open (or
// removed) is reflected the moment the veteran goes to type.
export default function IdentifierSourceNotice({ className }) {
  const { t } = useLanguage();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    const check = () =>
      hasKnownVeteranName()
        .then((known) => active && setMissing(!known))
        .catch(() => active && setMissing(true));
    const onFocus = (event) => {
      if (/^(?:INPUT|TEXTAREA)$/.test(event.target?.tagName ?? "")) check();
    };
    check();
    document.addEventListener("focusin", onFocus);
    return () => {
      active = false;
      document.removeEventListener("focusin", onFocus);
    };
  }, []);

  if (!missing) return null;
  return (
    <p role="note" className={className}>
      {t("aiAssistant", "nameNotSavedNotice")}
    </p>
  );
}
