import { lazy, Suspense, useState, useEffect } from "react";

const WhatIfSandbox = lazy(() => import("../../components/WhatIfSandbox"));
const DenialDecoder = lazy(() => import("../../components/DenialDecoder"));

/**
 * Decision-stage tools — WhatIfSandbox (scenario planner) + DenialDecoder
 * (denial-letter OCR/AI simplifier). Both opened via window events
 * (`openWhatIfSandbox`, `openDenialDecoder`) from toolbar, command search,
 * and tool router.
 *
 * DenialDecoder's "open AI Settings" callback dispatches openAISettings;
 * App.jsx bridges that event into local state until AISettings extracts.
 *
 * Extracted from App.jsx (audit #35, B40).
 */
export default function DecisionToolsCluster() {
  const [showSandbox, setShowSandbox] = useState(false);
  const [showDenial, setShowDenial] = useState(false);

  useEffect(() => {
    const openSandbox = () => setShowSandbox(true);
    const openDenial = () => setShowDenial(true);
    window.addEventListener("openWhatIfSandbox", openSandbox);
    window.addEventListener("openDenialDecoder", openDenial);
    return () => {
      window.removeEventListener("openWhatIfSandbox", openSandbox);
      window.removeEventListener("openDenialDecoder", openDenial);
    };
  }, []);

  return (
    <Suspense fallback={null}>
      {showSandbox && <WhatIfSandbox onClose={() => setShowSandbox(false)} />}
      {showDenial && (
        <DenialDecoder
          onClose={() => setShowDenial(false)}
          onOpenAISettings={() =>
            window.dispatchEvent(new CustomEvent("openAISettings"))
          }
        />
      )}
    </Suspense>
  );
}
