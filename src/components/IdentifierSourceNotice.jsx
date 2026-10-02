import { useEffect, useState } from "react";
import { hasLoadedIdentifierSource } from "../utils/unifiedAIService";

// ADR-008 section 2.9: the app cannot recognise a name it has never seen, so
// when no identifier source has loaded a typed name goes to an off-device AI as
// typed. One line near the AI input says so; it never blocks anything.
export default function IdentifierSourceNotice({ className }) {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    hasLoadedIdentifierSource()
      .then((loaded) => active && setMissing(!loaded))
      .catch(() => active && setMissing(true));
    return () => {
      active = false;
    };
  }, []);

  if (!missing) return null;
  return (
    <p role="note" className={className}>
      Your profile has not loaded, so the app cannot remove your name from what
      you type.
    </p>
  );
}
