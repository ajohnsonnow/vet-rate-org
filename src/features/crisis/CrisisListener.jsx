import { useState, useEffect } from "react";
import CrisisModal from "../../components/CrisisModal";
import { CRISIS_RESOURCES } from "../../utils/crisisInterceptor";

/**
 * Safety-critical crisis interception surface. Mounts globally and listens for:
 *  - `vetrate:crisis` — opens the BLOCKING <CrisisModal> (live user input that
 *    indicates the user themselves may be in crisis); and
 *  - `vetrate:crisis-resources` (AIS-05) — shows a PASSIVE, dismissible
 *    crisis-resources banner when crisis language is found in an UPLOADED document
 *    (e.g. ideation history in a C-file). Non-blocking: document analysis continues.
 *
 * Extracted from App.jsx (audit #35, B25) to keep the safety-critical surface
 * self-contained — its state, listeners, and render are colocated so a reviewer
 * can audit the whole crisis path in one file.
 */
export default function CrisisListener() {
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState("high");
  const [bannerOpen, setBannerOpen] = useState(false);

  useEffect(() => {
    const handler = (event) => {
      const { severity: s, source } = event.detail || {};
      console.warn("🚨 Crisis detected:", { severity: s, source });
      setSeverity(s || "high");
      setOpen(true);
    };
    const passiveHandler = () => setBannerOpen(true);

    window.addEventListener("vetrate:crisis", handler);
    window.addEventListener("vetrate:crisis-resources", passiveHandler);
    return () => {
      window.removeEventListener("vetrate:crisis", handler);
      window.removeEventListener("vetrate:crisis-resources", passiveHandler);
    };
  }, []);

  return (
    <>
      {open && <CrisisModal severity={severity} source="app" />}
      {bannerOpen && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-0 inset-x-0 z-40 bg-va-blue text-white px-4 py-3 shadow-lg safe-bottom"
        >
          <div className="max-w-3xl mx-auto flex items-start gap-3 text-sm">
            <span className="flex-1">
              <strong>You are not alone.</strong> If you or someone in these
              records is in crisis, the Veterans Crisis Line is here 24/7 —{" "}
              <a
                href={CRISIS_RESOURCES.phone.tel}
                className="underline font-semibold"
              >
                {CRISIS_RESOURCES.phone.display}
              </a>
              , {CRISIS_RESOURCES.text.display}, or{" "}
              <a
                href={CRISIS_RESOURCES.chat.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                chat online
              </a>
              .
            </span>
            <button
              type="button"
              onClick={() => setBannerOpen(false)}
              aria-label="Dismiss crisis resources"
              className="shrink-0 px-2 rounded hover:bg-white/20 min-h-touch min-w-touch"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
