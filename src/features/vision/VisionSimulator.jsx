import { lazy, Suspense, useState, useEffect } from "react";
import ResponsiveModal from "../../components/common/ResponsiveModal";

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
    <ResponsiveModal
      isOpen
      onClose={() => setOpen(false)}
      size="lg"
      title="Document Vision Simulator"
    >
      <Suspense fallback={null}>
        <VisionSimulatorPanel
          onAnalysisComplete={(result) => {
            // eslint-disable-next-line no-console
            console.log("Vision analysis complete:", result);
          }}
        />
      </Suspense>
    </ResponsiveModal>
  );
}
