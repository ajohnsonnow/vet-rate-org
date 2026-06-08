import { useState, useEffect } from "react";
import CrisisModal from "../../components/CrisisModal";

/**
 * Safety-critical crisis interception surface. Mounts globally and listens for
 * `vetrate:crisis` events dispatched by any component. When fired, opens the
 * blocking <CrisisModal> over all other UI.
 *
 * Extracted from App.jsx (audit #35, B25) to keep the safety-critical surface
 * self-contained — its state, event listener, and render are colocated so a
 * reviewer can audit the whole crisis path in one file.
 */
export default function CrisisListener() {
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState("high");

  useEffect(() => {
    const handler = (event) => {
      const { severity: s, source } = event.detail || {};
      console.warn("🚨 Crisis detected:", { severity: s, source });
      setSeverity(s || "high");
      setOpen(true);
    };

    window.addEventListener("vetrate:crisis", handler);
    return () => window.removeEventListener("vetrate:crisis", handler);
  }, []);

  return open ? <CrisisModal severity={severity} source="app" /> : null;
}
