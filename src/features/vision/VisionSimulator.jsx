import { lazy, Suspense, useState, useEffect } from "react";

const VisionSimulatorPanel = lazy(
  () => import("../../components/VisionSimulatorPanel"),
);

/**
 * Vision Simulator overlay — OCR + AI document analysis surface.
 *
 * Opens when any component dispatches a `openVisionSimulator` window event
 * (currently fired by LocalAIPanel when a vision-capable model fails to load,
 * so the user has a non-WebGPU fallback). Closes via the corner X button.
 *
 * Extracted from App.jsx (audit #35, B27). The companion "close AI Command
 * Center" side-effect on the same event stays in App.jsx because that state
 * lives there — each consumer of `openVisionSimulator` handles its own
 * concern.
 */
export default function VisionSimulator() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("openVisionSimulator", handler);
    return () => window.removeEventListener("openVisionSimulator", handler);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="relative">
          <button
            onClick={() => setOpen(false)}
            className="absolute -top-2 -right-2 z-10 p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-full shadow-lg"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <Suspense fallback={null}>
            <VisionSimulatorPanel
              onAnalysisComplete={(result) => {
                console.log("Vision analysis complete:", result);
              }}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
