import { lazy, Suspense, useState, useEffect } from "react";

const MusterCall = lazy(() => import("../../components/MusterCall"));
const IntelligenceBriefing = lazy(
  () => import("../../components/IntelligenceBriefing"),
);

/**
 * Muster Call → Intelligence Briefing pipeline. Bulk-imports documents,
 * extracts data, then shows a review/confirm modal that commits the data
 * into My Packet.
 *
 * Owns all three pieces of state for the flow (open flags for both modals
 * plus the extracted briefing data). External callers open the flow by
 * dispatching the `openMusterCall` window event.
 *
 * Extracted from App.jsx (audit #35, B31). `onOpenDD214Analyzer` is passed
 * as a prop because DD214Analyzer state still lives in App.jsx; when DD214
 * itself is extracted, this prop can be replaced with a dispatch.
 */
export default function MusterCallFlow({ onOpenDD214Analyzer }) {
  const [showMusterCall, setShowMusterCall] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [briefingData, setBriefingData] = useState(null);

  useEffect(() => {
    const handler = () => setShowMusterCall(true);
    window.addEventListener("openMusterCall", handler);
    return () => window.removeEventListener("openMusterCall", handler);
  }, []);

  return (
    <Suspense fallback={null}>
      {showMusterCall && (
        <MusterCall
          isOpen={showMusterCall}
          onClose={() => setShowMusterCall(false)}
          onOpenDD214Analyzer={() => {
            setShowMusterCall(false);
            onOpenDD214Analyzer?.();
          }}
          onProcessComplete={(extractedData) => {
            setBriefingData(extractedData);
            setShowBriefing(true);
            setShowMusterCall(false);
          }}
        />
      )}
      {showBriefing && (
        <IntelligenceBriefing
          isOpen={showBriefing}
          onClose={() => {
            setShowBriefing(false);
            setBriefingData(null);
          }}
          extractedData={briefingData}
          onConfirm={(confirmedData) => {
            localStorage.setItem(
              "vetrate_my_packet_data",
              JSON.stringify(confirmedData),
            );
            setShowBriefing(false);
            setBriefingData(null);
            console.log("Data committed to My Packet:", confirmedData);
          }}
          onEdit={(section, field, value) => {
            console.log(`User edited ${field} in ${section}:`, value);
          }}
        />
      )}
    </Suspense>
  );
}
