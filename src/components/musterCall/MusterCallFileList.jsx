/**
 * Vet-Rate.org - Muster Call File List
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Selected-files list + validation messages for legacy batch mode.
 * Extracted from MusterCall.jsx's drop zone section. Pure presentational
 * extraction — no behavior change.
 */

import { formatFileSize } from "../../utils/musterCallProcessor";

export default function MusterCallFileList({ files, validation, onReset }) {
  return (
    <div className="mt-6 bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Selected Files ({files.length})
        </h3>
        <button
          onClick={onReset}
          className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
        >
          Clear All
        </button>
      </div>

      {/* Validation Messages */}
      {validation && (
        <>
          {validation.warnings.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="text-xl mr-3">⚠️</div>
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-semibold mb-2">Warnings:</p>
                  {validation.warnings.map((warning, idx) => (
                    <p key={idx}>• {warning.message}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {validation.invalid.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 mb-4">
              <div className="flex">
                <div className="text-xl mr-3">❌</div>
                <div className="text-sm text-red-800 dark:text-red-200">
                  <p className="font-semibold mb-2">Invalid Files:</p>
                  {validation.invalid.map((invalid, idx) => (
                    <p key={idx}>
                      • {invalid.file.name}: {invalid.reason}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* File List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {files.map((file, index) => (
          <div
            key={index}
            className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-2xl">📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total Size */}
      {validation && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total: {formatFileSize(validation.totalSize)} •{" "}
            {validation.valid.length} valid files
          </p>
        </div>
      )}
    </div>
  );
}
