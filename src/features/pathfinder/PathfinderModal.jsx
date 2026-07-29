import { lazy, Suspense, useState, useEffect } from "react";
import ReportBugLink from "../../components/ReportBugLink";
import ResponsiveModal from "../../components/common/ResponsiveModal";

const Pathfinder = lazy(() => import("../../components/Pathfinder"));

/**
 * PathfinderModal's gradient header — split out of the component to keep
 * it under the max-lines-per-function budget (audit, wave 4).
 */
function PathfinderModalHeader({ onClose, onReportBug }) {
  return (
    <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🧭</span>
          <div>
            <h2
              id="pathfinder-modal-title"
              className="text-xl font-bold text-white flex items-center gap-2"
            >
              The Pathfinder
              <span className="px-1.5 py-0.5 bg-teal-500 text-white text-[10px] font-bold rounded">
                AI
              </span>
              <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
                BETA
              </span>
            </h2>
            <p className="text-sm text-teal-100">Strategic Claims Analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ReportBugLink
            onClick={onReportBug}
            variant="light"
            moduleName="Pathfinder"
          />
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pathfinder — AI strategic claims-analysis modal with bespoke chrome
 * (header gradient, close button, report-bug link) that App.jsx
 * previously hand-rolled.
 *
 * Owns:
 *   - showPathfinder open/close state
 *   - initialConditions seed (set by openPathfinder event detail; used
 *     by BlueButtonXRay → Pathfinder handoff)
 *   - handleNavigate handler (Pathfinder's onNavigate callback chains
 *     to Nexus Builder, C&P Simulator, or Secondary Scout Launcher)
 *
 * Events listened: openPathfinder (detail?: { conditions })
 * Events dispatched: openNexusBuilder (detail), openCAPSimulator,
 *   openSecondaryScoutLauncher, openBugSquasher, openAISettings
 *
 * Extracted from App.jsx (audit #35, B56). Replaces the openPathfinder
 * bridge listener added in B55 (which is removed from App.jsx).
 */
export default function PathfinderModal() {
  const [open, setOpen] = useState(false);
  const [initialConditions, setInitialConditions] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      setInitialConditions(e?.detail?.conditions ?? null);
      setOpen(true);
    };
    window.addEventListener("openPathfinder", handler);
    return () => window.removeEventListener("openPathfinder", handler);
  }, []);

  const close = () => {
    setInitialConditions(null);
    setOpen(false);
  };

  const handleNavigate = (tool, data) => {
    setOpen(false);
    if (tool === "nexus") {
      window.dispatchEvent(
        new CustomEvent("openNexusBuilder", {
          detail: {
            condition: data.condition,
            primaryCondition: data.primaryCondition,
            existingStatement: null,
          },
        }),
      );
    } else if (tool === "dbq") {
      window.dispatchEvent(new CustomEvent("openCAPSimulator"));
    } else if (tool === "secondary-scout") {
      window.dispatchEvent(new CustomEvent("openSecondaryScoutLauncher"));
    }
  };

  return (
    <ResponsiveModal
      isOpen={open}
      onClose={close}
      size="2xl"
      labelledBy="pathfinder-modal-title"
      header={
        <PathfinderModalHeader
          onClose={close}
          onReportBug={() => {
            setOpen(false);
            window.dispatchEvent(new CustomEvent("openBugSquasher"));
          }}
        />
      }
    >
      <Suspense fallback={null}>
        <Pathfinder
          onNavigate={handleNavigate}
          onOpenAISettings={() =>
            window.dispatchEvent(new CustomEvent("openAISettings"))
          }
          initialConditions={initialConditions}
        />
      </Suspense>
    </ResponsiveModal>
  );
}
