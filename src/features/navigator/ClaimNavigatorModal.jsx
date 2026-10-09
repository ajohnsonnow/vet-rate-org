import { lazy, Suspense, useState, useEffect } from "react";

const ClaimNavigator = lazy(() => import("../../components/ClaimNavigator"));

/**
 * Claim Navigator — Mission Control for VA Claims. Standalone modal opened
 * from the toolbar, command palette, command search, and legacy route.
 *
 * Opens on `openClaimNavigator` window event.
 *
 * Extracted from App.jsx (audit #35, B54).
 */
export default function ClaimNavigatorModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("openClaimNavigator", handler);
    return () => window.removeEventListener("openClaimNavigator", handler);
  }, []);

  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <ClaimNavigator onClose={() => setOpen(false)} />
    </Suspense>
  );
}
