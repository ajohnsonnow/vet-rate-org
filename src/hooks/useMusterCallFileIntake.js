/**
 * Vet-Rate.org - Muster Call File Intake Hook
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * File selection, validation, and drag-and-drop handling for Muster Call.
 * Extracted from MusterCall.jsx to keep the component under the
 * max-lines-per-function / complexity budget.
 */

import { useState, useRef, useCallback } from "react";
import { validateFilesBatch } from "../utils/musterCallProcessor";

/**
 * @param {object} params
 * @param {boolean} params.useSequentialMode
 * @param {ReturnType<typeof import('./useFormationQueue').default>} params.formationQueue
 * @param {object} params.toast
 * @param {(msg: string|null) => void} params.setError
 */
export const useMusterCallFileIntake = ({
  useSequentialMode,
  formationQueue,
  toast,
  setError,
}) => {
  const [files, setFiles] = useState([]);
  const [validation, setValidation] = useState(null);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const handleFileSelect = useCallback(
    (selectedFiles) => {
      // eslint-disable-next-line no-console
      console.log(
        "🎯 handleFileSelect called with",
        selectedFiles?.length,
        "files",
      );
      const fileArray = Array.from(selectedFiles);
      // eslint-disable-next-line no-console
      console.log("🎯 fileArray:", fileArray.length, "files");

      // Validate files
      const validationResult = validateFilesBatch(fileArray);
      // eslint-disable-next-line no-console
      console.log("🎯 validationResult:", validationResult);
      setValidation(validationResult);

      if (validationResult.valid.length > 0) {
        setFiles(fileArray);

        // Initialize formation if in sequential mode
        if (useSequentialMode) {
          // eslint-disable-next-line no-console
          console.log(
            "🎯 Calling initializeFormation with",
            validationResult.valid.length,
            "files",
          );
          const result = formationQueue.initializeFormation(
            validationResult.valid,
          );
          // eslint-disable-next-line no-console
          console.log(
            "🎯 initializeFormation returned:",
            result?.length,
            "entries",
          );
          toast.success(
            `${validationResult.valid.length} document${validationResult.valid.length !== 1 ? "s" : ""} added to Formation queue`,
          );
        } else {
          toast.info(
            `${validationResult.valid.length} file${validationResult.valid.length !== 1 ? "s" : ""} selected`,
          );
        }

        if (validationResult.invalid.length > 0) {
          toast.warning(
            `${validationResult.invalid.length} file${validationResult.invalid.length !== 1 ? "s" : ""} skipped (unsupported format)`,
          );
        }

        setError(null);
      } else {
        setError(
          "No valid files selected. Please select PDF, DOCX, or TXT files.",
        );
        toast.error(
          "No valid files selected. Only PDF, DOCX, and TXT files are supported.",
        );
      }
    },
    [useSequentialMode, formationQueue, toast, setError],
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add(
        "border-blue-500",
        "bg-blue-50",
        "dark:bg-blue-900/20",
      );
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove(
        "border-blue-500",
        "bg-blue-50",
        "dark:bg-blue-900/20",
      );
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (dropZoneRef.current) {
        dropZoneRef.current.classList.remove(
          "border-blue-500",
          "bg-blue-50",
          "dark:bg-blue-900/20",
        );
      }

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        handleFileSelect(droppedFiles);
      }
    },
    [handleFileSelect],
  );

  const resetFileIntake = useCallback(() => {
    setFiles([]);
    setValidation(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return {
    files,
    setFiles,
    validation,
    fileInputRef,
    dropZoneRef,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    resetFileIntake,
  };
};

export default useMusterCallFileIntake;
