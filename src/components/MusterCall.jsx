/**
 * Vet-Rate.org - Muster Call Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Mass document ingestion system for veteran claim files.
 * Handles 300+ MB of documents, auto-populates entire profile,
 * and generates comprehensive LLM-powered recommendations.
 *
 * "Answer the Muster Call" - Drop your entire VA file and let
 * the system analyze everything automatically.
 *
 * ARMY INSPECTION TERMINOLOGY (TC 3-21.5 Drill and Ceremonies):
 * - "Open Ranks, MARCH" - Begin inspection (front rank forward, creates inspection lanes)
 * - "Count, OFF" - Verify all personnel/documents present
 * - "Dress Right, DRESS" - Align formation (prepare documents)
 * - "Inspection, ARMS" - Show weapon is clear (extract document content)
 * - "Platoon, ATTENTION" - Formation ready for inspection
 * - "Sir/Ma'am, platoon prepared for inspection" - Report to inspector (AI analysis)
 * - "Close Ranks, MARCH" - Return to compact formation (finalize)
 * - "AT EASE" - Inspection complete, formation dismissed
 */

import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import ResponsiveModal from "./common/ResponsiveModal";
import useMusterCallOrchestration from "../hooks/useMusterCallOrchestration";
import MusterCallHeader from "./musterCall/MusterCallHeader";
import MusterCallFooter from "./musterCall/MusterCallFooter";
import MusterCallAIStatusBanner from "./musterCall/MusterCallAIStatusBanner";
import MusterCallDropZone from "./musterCall/MusterCallDropZone";
import MusterCallFormationSection from "./musterCall/MusterCallFormationSection";
import MusterCallStatusPanel from "./musterCall/MusterCallStatusPanel";
import SystemRequirementsNotice from "./SystemRequirementsNotice";

/**
 * Muster Call - Mass Document Processor
 */
export default function MusterCall({
  isOpen,
  onClose,
  onProcessComplete,
  onOpenDD214Analyzer,
}) {
  const { t: _t } = useLanguage();
  const toast = useToast();
  // NOTE: toggle between Formation (sequential) and legacy batch mode is
  // currently locked to sequential; see FormationLineup for the UI path.
  const [useSequentialMode, _setUseSequentialMode] = useState(true);

  const {
    formationQueue,
    ai,
    processingState,
    error,
    intake,
    flow,
    batch,
    shouldShowFormation,
    showProcessingView,
    handleStartProcessing,
    handleReset,
  } = useMusterCallOrchestration({
    toast,
    onProcessComplete,
    useSequentialMode,
  });

  const { hasDocuments, isComplete: formationComplete } = formationQueue;

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      labelledBy="muster-call-title"
      dismissable={!batch.processing}
      footer={
        <MusterCallFooter
          processingState={processingState}
          intake={intake}
          useSequentialMode={useSequentialMode}
          ai={ai}
          formationComplete={formationComplete}
          onStart={handleStartProcessing}
          onReset={handleReset}
        />
      }
      header={
        <MusterCallHeader onClose={onClose} processing={batch.processing} />
      }
    >
      <MusterCallAIStatusBanner ai={ai} />

      <div className="mb-4">
        <SystemRequirementsNotice
          toolName="Muster Call"
          supportsExtractionOnly={false}
        />
      </div>

      <MusterCallDropZone
        intake={intake}
        processingState={processingState}
        useSequentialMode={useSequentialMode}
        hasDocuments={hasDocuments}
        onReset={handleReset}
      />

      <MusterCallFormationSection
        shouldShowFormation={shouldShowFormation}
        showProcessingView={showProcessingView}
        formationQueue={formationQueue}
        ai={ai}
        flow={flow}
        onStartFormation={handleStartProcessing}
        onOpenDD214Analyzer={onOpenDD214Analyzer}
      />

      <MusterCallStatusPanel
        processingState={processingState}
        batch={batch}
        error={error}
      />
    </ResponsiveModal>
  );
}
