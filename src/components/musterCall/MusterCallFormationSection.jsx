/**
 * Vet-Rate.org - Muster Call Formation Section
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Sequential-mode formation lineup, active-document review, and the
 * Intelligence Briefing verification modal. Extracted from MusterCall.jsx.
 * Pure presentational extraction — no behavior change.
 */

import FormationLineup from "../FormationLineup";
import PlatoonSergeantReview from "../PlatoonSergeantReview";
import DocumentIntelligenceBriefing from "../DocumentIntelligenceBriefing";

// Conflict detection is not yet implemented for Muster Call, so this is
// always empty — but it MUST be a stable reference. DocumentIntelligenceBriefing's
// per-document effect depends on this prop; a fresh `[]` literal on every
// render (this component re-renders on every AI progress tick) would refire
// that effect and silently reset the user's in-progress field verification.
const NO_CONFLICTS = [];

export default function MusterCallFormationSection({
  shouldShowFormation,
  showProcessingView,
  formationQueue,
  ai,
  flow,
  onStartFormation,
  onOpenDD214Analyzer,
}) {
  const { formation, stats, reorderDocuments, removeDocument, clearFormation } =
    formationQueue;
  const {
    activeEntry,
    currentProgress,
    extractionResult,
    showIntelBriefing,
    setShowIntelBriefing,
    handleVerifyAndSave,
    handleSkipDocument,
  } = flow;

  return (
    <>
      {/* Formation Lineup (SEQUENTIAL MODE) - Use locally computed shouldShowFormation */}
      {shouldShowFormation && (
        <div className="mt-6">
          <FormationLineup
            formation={formation}
            onReorder={reorderDocuments}
            onRemove={removeDocument}
            onStartFormation={onStartFormation}
            onClearFormation={clearFormation}
            aiReady={ai.aiReady}
            aiInitializing={ai.aiInitializing}
          />
        </div>
      )}

      {/* Platoon Sergeant Review (SEQUENTIAL MODE - Active Processing) */}
      {showProcessingView && (
        <div className="space-y-4">
          {/* Show compact formation status */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                📋 Processing {stats?.completed || 0} of {formation.length}{" "}
                documents
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400">
                {stats?.waiting || 0} waiting • {stats?.skipped || 0} skipped •{" "}
                {stats?.errors || 0} errors
              </span>
            </div>
          </div>

          <PlatoonSergeantReview
            document={activeEntry.file}
            progress={currentProgress}
            onComplete={() => {}}
            onError={(error) => formationQueue.errorCurrentAndNext(error)}
            onSkip={handleSkipDocument}
          />
        </div>
      )}

      {/* Intelligence Briefing Modal (SEQUENTIAL MODE - User Verification) */}
      {showIntelBriefing && extractionResult && activeEntry && (
        <DocumentIntelligenceBriefing
          document={activeEntry.file}
          extractionResult={extractionResult}
          conflicts={NO_CONFLICTS}
          onVerify={handleVerifyAndSave}
          onSkip={handleSkipDocument}
          onClose={() => setShowIntelBriefing(false)}
          onOpenDD214Analyzer={onOpenDD214Analyzer}
        />
      )}
    </>
  );
}
