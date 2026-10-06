/**
 * Vet-Rate.org - a question with two plain choices
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Asked before the app would replace something the veteran wrote. Focus
 * moves to the first choice, which is always the one that keeps their
 * words; Tab stays inside the dialog; Escape takes the first choice. When
 * the dialog closes, focus goes to the element named by `returnFocusTo`
 * (the draft the question was about) or, when none is named, back to the
 * control that opened the dialog. It never drops to the page body.
 */
import { useEffect, useId, useRef } from "react";

const BUTTON =
  "min-h-[44px] px-4 py-2 rounded-lg font-semibold border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-700";

export default function ChoiceDialog({
  title,
  children,
  keepLabel,
  onKeep,
  replaceLabel,
  onReplace,
  returnFocusTo,
}) {
  const id = useId();
  const keepRef = useRef(null);
  const replaceRef = useRef(null);

  useEffect(() => {
    const before = document.activeElement;
    keepRef.current?.focus();
    return () => {
      const usable = (element) =>
        element?.isConnected && element !== document.body && !element.disabled;
      const named = document.getElementById(returnFocusTo ?? "");
      (named ?? (usable(before) ? before : null))?.focus?.();
    };
  }, [returnFocusTo]);

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onKeep();
    } else if (event.key === "Tab") {
      event.preventDefault();
      const next =
        document.activeElement === keepRef.current ? replaceRef : keepRef;
      next.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        onKeyDown={onKeyDown}
        className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-5 shadow-2xl border border-gray-300 dark:border-gray-600"
      >
        <h2
          id={`${id}-title`}
          className="text-lg font-bold text-gray-900 dark:text-gray-100"
        >
          {title}
        </h2>
        <div
          id={`${id}-body`}
          className="mt-2 text-sm text-gray-800 dark:text-gray-200"
        >
          {children}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            ref={keepRef}
            type="button"
            onClick={onKeep}
            className={`${BUTTON} bg-blue-700 border-blue-700 text-white hover:bg-blue-800`}
          >
            {keepLabel}
          </button>
          <button
            ref={replaceRef}
            type="button"
            onClick={onReplace}
            className={`${BUTTON} bg-white dark:bg-gray-800 border-gray-500 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700`}
          >
            {replaceLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Asked when regenerating would replace a draft the veteran edited. */
export function EditedDraftDialog({ onKeep, onRebuild, returnFocusTo }) {
  return (
    <ChoiceDialog
      title="You edited this draft"
      keepLabel="Keep my edited draft"
      onKeep={onKeep}
      replaceLabel="Rebuild from my answers"
      onReplace={onRebuild}
      returnFocusTo={returnFocusTo}
    >
      You changed an answer after editing this draft. Your edited draft is still
      here. Rebuilding makes a new draft from your answers and removes your
      edits.
    </ChoiceDialog>
  );
}

/** Asked before a tool closes with an edit that has not been saved. */
export function UnsavedEditDialog({ onStay, onClose, returnFocusTo }) {
  return (
    <ChoiceDialog
      title="Close without saving?"
      keepLabel="Stay and keep my edits"
      onKeep={onStay}
      replaceLabel="Close and lose my edits"
      onReplace={onClose}
      returnFocusTo={returnFocusTo}
    >
      You edited this draft and have not saved it. Closing now loses your edits.
      To keep them, stay, then save or download the draft.
    </ChoiceDialog>
  );
}
