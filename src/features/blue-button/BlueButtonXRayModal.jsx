import { lazy, Suspense, useState, useEffect } from "react";

const BlueButtonXRay = lazy(() => import("../../components/BlueButtonXRay"));

/**
 * Blue Button X-Ray — Diamond Tier health-record data-mining tool.
 * Opens on `openBlueButtonXRay` window event.
 *
 * Events dispatched:
 *   - openPathfinder (detail = { conditions }) when user clicks Add to
 *     Calculator — PathfinderModal seeds with these conditions
 *   - searchDisability (detail = { term }) when user clicks Check Rating
 *     Criteria — App.jsx bridge applies the search term
 *   - openAISettings, openBugSquasher (existing events)
 *
 * Extracted from App.jsx (audit #35, B57).
 */
export default function BlueButtonXRayModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("openBlueButtonXRay", handler);
    return () => window.removeEventListener("openBlueButtonXRay", handler);
  }, []);

  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <BlueButtonXRay
        onClose={() => setOpen(false)}
        onAddToCalculator={(conditions) => {
          setOpen(false);
          window.dispatchEvent(
            new CustomEvent("openPathfinder", {
              detail: { conditions },
            }),
          );
        }}
        onCheckRatingCriteria={(conditionName) => {
          setOpen(false);
          window.dispatchEvent(
            new CustomEvent("searchDisability", {
              detail: { term: conditionName },
            }),
          );
        }}
        onOpenAISettings={() =>
          window.dispatchEvent(new CustomEvent("openAISettings"))
        }
        onReportBug={() => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent("openBugSquasher"));
        }}
      />
    </Suspense>
  );
}
