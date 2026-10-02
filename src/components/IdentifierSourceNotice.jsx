import { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { hasKnownVeteranName } from "../utils/unifiedAIService";

const MIN_FOCUS_RECHECK_MS = 3000;

// ADR-008 section 2.9: the app cannot recognise a name it has never seen, so
// when it holds no name a typed name goes to an off-device AI as typed. One line
// near the AI input says so; it never blocks anything. The check runs again
// when a text area gains focus (at most once every few seconds, because the
// check clones the Knowledge Base), so a name saved while the input is open is
// reflected the moment the veteran goes to type.
export default function IdentifierSourceNotice({ className }) {
  const { t } = useLanguage();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    const check = () =>
      hasKnownVeteranName()
        .then((known) => active && setMissing(!known))
        .catch(() => active && setMissing(true));
    let lastFocusCheck = 0;
    const onFocus = (event) => {
      if (event.target?.tagName !== "TEXTAREA") return;
      const now = Date.now();
      if (now - lastFocusCheck < MIN_FOCUS_RECHECK_MS) return;
      lastFocusCheck = now;
      check();
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
