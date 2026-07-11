/**
 * Vet-Rate.org - Muster Call Drop Zone
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Military-style document drop zone + selected file list. Extracted from
 * MusterCall.jsx. Pure presentational extraction — no behavior change.
 */

import { PROCESSING_STATES } from "../../utils/musterCallProcessor";
import MusterCallFileList from "./MusterCallFileList";

function MusterCallDropZoneTarget({
  dropZoneRef,
  fileInputRef,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileSelect,
}) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative border-4 border-dashed border-amber-500 dark:border-amber-400 rounded-xl p-8 text-center transition-all duration-300 hover:border-amber-400 hover:bg-amber-50/30 dark:hover:bg-amber-900/20 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 shadow-inner"
    >
      {/* Corner markers - military targeting style */}
      <div className="absolute top-2 left-2 w-6 h-6 border-l-4 border-t-4 border-amber-500 dark:border-amber-400"></div>
      <div className="absolute top-2 right-2 w-6 h-6 border-r-4 border-t-4 border-amber-500 dark:border-amber-400"></div>
      <div className="absolute bottom-2 left-2 w-6 h-6 border-l-4 border-b-4 border-amber-500 dark:border-amber-400"></div>
      <div className="absolute bottom-2 right-2 w-6 h-6 border-r-4 border-b-4 border-amber-500 dark:border-amber-400"></div>

      {/* DROP ZONE Header */}
      <div className="mb-4">
        <div className="inline-block bg-amber-500 dark:bg-amber-600 text-black dark:text-white px-6 py-2 rounded font-bold text-lg tracking-widest shadow-md">
          ⬇️ DROP ZONE ⬇️
        </div>
      </div>

      <div className="text-5xl mb-3 animate-bounce">📦</div>
      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
        Deploy Your Documents Here
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
        DD214s • C-Files • Decision Letters • Medical Records
      </p>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.txt,.rtf"
        onChange={(e) => {
          // eslint-disable-next-line no-console
          console.log(
            "🎯 File input onChange fired, files:",
            e.target.files?.length,
          );
          handleFileSelect(e.target.files);
        }}
        // eslint-disable-next-line no-console
        onClick={(_e) => console.log("🎯 File input clicked")}
        className="hidden"
        id="muster-call-files"
      />
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <label
        htmlFor="muster-call-files"
        // eslint-disable-next-line no-console
        onClick={() => console.log("🎯 Label clicked")}
        className="inline-block bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-lg font-bold cursor-pointer transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
      >
        🎯 Select Files
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 font-mono">
        SUPPORTED: PDF • DOCX • TXT | MAX: 500MB
      </p>

      {/* Document type badges */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
          C-Files (320MB+)
        </span>
        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
          Decision Letters
        </span>
        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">
          DD214s
        </span>
        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full">
          Medical Records
        </span>
      </div>

      {/* Privacy assurance - 100% client-side */}
      <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-semibold text-sm">100% ON YOUR DEVICE</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
          Your documents are <strong>never uploaded</strong> anywhere. All
          processing happens right here in your browser. Your records stay on
          YOUR device - we never see them.
        </p>
      </div>
    </div>
  );
}

export default function MusterCallDropZone({
  intake,
  processingState,
  useSequentialMode,
  hasDocuments,
  onReset,
}) {
  if (
    processingState !== PROCESSING_STATES.IDLE ||
    (useSequentialMode && hasDocuments)
  ) {
    return null;
  }

  const {
    files,
    validation,
    fileInputRef,
    dropZoneRef,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = intake;

  return (
    <>
      <MusterCallDropZoneTarget
        dropZoneRef={dropZoneRef}
        fileInputRef={fileInputRef}
        handleDragOver={handleDragOver}
        handleDragLeave={handleDragLeave}
        handleDrop={handleDrop}
        handleFileSelect={handleFileSelect}
      />

      {/* File List */}
      {files.length > 0 && !useSequentialMode && (
        <MusterCallFileList
          files={files}
          validation={validation}
          onReset={onReset}
        />
      )}
    </>
  );
}
