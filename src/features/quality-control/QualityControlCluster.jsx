import { lazy, Suspense, useState, useEffect } from "react";
import ReportBugLink from "../../components/ReportBugLink";

const DecisionDecoder = lazy(() => import("../../components/DecisionDecoder"));
const RiskAssessment = lazy(() => import("../../components/RiskAssessment"));
const EvidenceGapVisualizer = lazy(
  () => import("../../components/EvidenceGapVisualizer"),
);
const NexusQualityAnalyzer = lazy(
  () => import("../../components/NexusQualityAnalyzer"),
);
const SharkRadar = lazy(() => import("../../components/SharkRadar"));

/**
 * Quality-control surfaces — five tools veterans run *after* a claim
 * is drafted to stress-test it before submission:
 *   - DecisionDecoder (BVA decision analyzer)
 *   - RiskAssessment ("Poke the Bear" risk calculator)
 *   - EvidenceGapVisualizer (missing-evidence map)
 *   - NexusQualityAnalyzer (nexus-letter scoring against 18,609 BVAs)
 *   - SharkRadar (contract/email scam scanner — preserved custom wrapper)
 *
 * SharkRadar keeps its bespoke 60-line modal wrapper (rose/red gradient
 * header, ReportBugLink in header) because the wrapper is part of the
 * tool's visual identity, not boilerplate that can be normalized.
 *
 * Bridges via App.jsx: openBugSquasher, openAISettings.
 *
 * Extracted from App.jsx (audit #35, B49).
 */
export default function QualityControlCluster() {
  const [showDecisionDecoder, setShowDecisionDecoder] = useState(false);
  const [showRiskAssessment, setShowRiskAssessment] = useState(false);
  const [showEvidenceGap, setShowEvidenceGap] = useState(false);
  const [showNexusQA, setShowNexusQA] = useState(false);
  const [showSharkRadar, setShowSharkRadar] = useState(false);

  useEffect(() => {
    const openDecision = () => setShowDecisionDecoder(true);
    const openRisk = () => setShowRiskAssessment(true);
    const openGap = () => setShowEvidenceGap(true);
    const openNexus = () => setShowNexusQA(true);
    const openShark = () => setShowSharkRadar(true);
    window.addEventListener("openDecisionDecoder", openDecision);
    window.addEventListener("openRiskAssessment", openRisk);
    window.addEventListener("openEvidenceGapVisualizer", openGap);
    window.addEventListener("openNexusQualityAnalyzer", openNexus);
    window.addEventListener("openSharkRadar", openShark);
    return () => {
      window.removeEventListener("openDecisionDecoder", openDecision);
      window.removeEventListener("openRiskAssessment", openRisk);
      window.removeEventListener("openEvidenceGapVisualizer", openGap);
      window.removeEventListener("openNexusQualityAnalyzer", openNexus);
      window.removeEventListener("openSharkRadar", openShark);
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
      {showDecisionDecoder && (
        <DecisionDecoder
          onClose={() => setShowDecisionDecoder(false)}
          onReportBug={reportBug(setShowDecisionDecoder)}
          onOpenAISettings={openAISettings}
        />
      )}
      {showRiskAssessment && (
        <RiskAssessment
          onClose={() => setShowRiskAssessment(false)}
          onReportBug={reportBug(setShowRiskAssessment)}
          onOpenAISettings={openAISettings}
        />
      )}
      {showEvidenceGap && (
        <EvidenceGapVisualizer
          onClose={() => setShowEvidenceGap(false)}
          onReportBug={reportBug(setShowEvidenceGap)}
        />
      )}
      {showNexusQA && (
        <NexusQualityAnalyzer onClose={() => setShowNexusQA(false)} />
      )}
      {showSharkRadar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
          onClick={() => setShowSharkRadar(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 bg-gradient-to-r from-rose-600 via-red-600 to-rose-600 p-4 shadow-lg rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🦈</span>
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      Shark Radar
                      <span className="inline-block px-2 py-0.5 bg-white/20 backdrop-blur text-white text-xs font-bold rounded-full">
                        AI
                      </span>
                      <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">
                        BETA
                      </span>
                    </h2>
                    <p className="text-sm text-rose-100">
                      Contract & Email Scanner • AI-Powered Analysis
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ReportBugLink
                    onClick={reportBug(setShowSharkRadar)}
                    variant="light"
                    moduleName="Shark Radar"
                  />
                  <button
                    onClick={() => setShowSharkRadar(false)}
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
            <div className="overflow-y-auto flex-1 p-4">
              <SharkRadar />
            </div>
          </div>
        </div>
      )}
    </Suspense>
  );
}
