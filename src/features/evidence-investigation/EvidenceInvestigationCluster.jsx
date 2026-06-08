import { lazy, Suspense, useState, useEffect } from "react";

const FormsHelper = lazy(() => import("../../components/FormsHelper"));
const CFileAnalyzer = lazy(() => import("../../components/CFileAnalyzer"));
const WitnessBench = lazy(() => import("../../components/WitnessBench"));
const DD214Analyzer = lazy(() => import("../../components/DD214Analyzer"));

/**
 * Evidence-investigation surfaces — four tools veterans use to gather
 * and analyze evidence for their claim:
 *   - FormsHelper (VA form auto-fill + guided buddy statements)
 *   - CFileAnalyzer (multi-hundred-page C-file scanner)
 *   - WitnessBench (Diamond Tier buddy-letter wizard)
 *   - DD214Analyzer (separation-document parser)
 *
 * DD214Analyzer's onOpenMusterCall is preserved as a dispatch of the
 * openMusterCall event (handled by features/muster-call/MusterCallFlow).
 *
 * Bridges via App.jsx: openBugSquasher, openAISettings.
 *
 * Extracted from App.jsx (audit #35, B51).
 */
export default function EvidenceInvestigationCluster() {
  const [showFormsHelper, setShowFormsHelper] = useState(false);
  const [showCFileAnalyzer, setShowCFileAnalyzer] = useState(false);
  const [showWitnessBench, setShowWitnessBench] = useState(false);
  const [showDD214Analyzer, setShowDD214Analyzer] = useState(false);

  useEffect(() => {
    const openForms = () => setShowFormsHelper(true);
    const openCFile = () => setShowCFileAnalyzer(true);
    const openWitness = () => setShowWitnessBench(true);
    const openDD214 = () => setShowDD214Analyzer(true);
    window.addEventListener("openFormsHelper", openForms);
    window.addEventListener("openCFileAnalyzer", openCFile);
    window.addEventListener("openWitnessBench", openWitness);
    window.addEventListener("openDD214Analyzer", openDD214);
    return () => {
      window.removeEventListener("openFormsHelper", openForms);
      window.removeEventListener("openCFileAnalyzer", openCFile);
      window.removeEventListener("openWitnessBench", openWitness);
      window.removeEventListener("openDD214Analyzer", openDD214);
    };
  }, []);

  const reportBug = (closeFn) => () => {
    closeFn(false);
    window.dispatchEvent(new CustomEvent("openBugSquasher"));
  };
  const openAISettings = () =>
    window.dispatchEvent(new CustomEvent("openAISettings"));

  return (
    <Suspense fallback={null}>
      {showFormsHelper && (
        <FormsHelper
          onClose={() => setShowFormsHelper(false)}
          onReportBug={reportBug(setShowFormsHelper)}
          onOpenAISettings={openAISettings}
        />
      )}
      {showCFileAnalyzer && (
        <CFileAnalyzer
          onClose={() => setShowCFileAnalyzer(false)}
          onOpenAISettings={openAISettings}
        />
      )}
      {showWitnessBench && (
        <WitnessBench
          onClose={() => setShowWitnessBench(false)}
          onReportBug={reportBug(setShowWitnessBench)}
          onOpenAISettings={openAISettings}
        />
      )}
      {showDD214Analyzer && (
        <DD214Analyzer
          onClose={() => setShowDD214Analyzer(false)}
          onReportBug={reportBug(setShowDD214Analyzer)}
          onOpenAISettings={openAISettings}
          onOpenMusterCall={() => {
            setShowDD214Analyzer(false);
            window.dispatchEvent(new CustomEvent("openMusterCall"));
          }}
        />
      )}
    </Suspense>
  );
}
