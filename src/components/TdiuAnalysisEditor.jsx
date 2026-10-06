/**
 * Vet-Rate.org - editable TDIU analysis
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The TDIU Builder's result, edited in place. The app-built analysis leaves
 * a [bracketed] blank wherever the veteran has to say how a symptom limits
 * their work; each such text is a labelled field here so the blank can be
 * replaced where it stands. The save control says, in words, when blanks
 * remain.
 */
import { useId } from "react";
import {
  TDIU_WORK_TYPES,
  buildTdiuAnalysisTemplate,
  tdiuUnfilledBlanks,
  tdiuWorkTypesChosen,
} from "../utils/writerTemplates";

const FIELD_CLASS =
  "w-full min-h-[96px] p-3 text-base border-2 border-gray-400 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600";
const LABEL_CLASS =
  "block font-bold text-gray-900 dark:text-gray-100 mb-2 break-words";
const BUTTON_CLASS =
  "min-h-[44px] px-4 py-2 rounded-lg font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600";
const CARD_CLASS = "bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6";

const WORK_TYPE_BLANK = buildTdiuAnalysisTemplate([]).job_types_precluded;

function TextField({ label, value, onChange, hint }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      {hint && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{hint}</p>
      )}
      <textarea
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className={FIELD_CLASS}
      />
    </div>
  );
}

function WorkTypes({ selected, onChange }) {
  const toggle = (type) => {
    const next = TDIU_WORK_TYPES.filter((t) =>
      t === type ? !selected.includes(t) : selected.includes(t),
    );
    onChange(next.length > 0 ? next : WORK_TYPE_BLANK);
  };
  return (
    <fieldset className={CARD_CLASS}>
      <legend className={LABEL_CLASS}>Types of work you cannot do</legend>
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
        {TDIU_WORK_TYPES.map((type) => (
          <label
            key={type}
            className="min-h-[44px] flex items-center gap-3 px-3 border-2 border-gray-400 dark:border-gray-500 rounded-lg text-gray-900 dark:text-gray-100 cursor-pointer focus-within:ring-2 focus-within:ring-blue-600"
          >
            <input
              type="checkbox"
              checked={selected.includes(type)}
              onChange={() => toggle(type)}
              className="h-5 w-5"
            />
            <span>{type} work</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const SAVE_MESSAGES = {
  saved: "Saved to My Packet.",
  failed: "Could not save to My Packet. Please try again.",
};

function SaveControl({ unfilled, workTypesChosen, onSave, saveState }) {
  return (
    <div className={CARD_CLASS}>
      {(unfilled > 0 || !workTypesChosen) && (
        <p
          role="status"
          aria-label="Still to do"
          className="text-sm text-gray-900 dark:text-gray-100 mb-3"
        >
          {unfilled === 1 && "1 blank is still to be filled in. "}
          {unfilled > 1 && `${unfilled} blanks are still to be filled in. `}
          {unfilled > 0 &&
            "Replace each [bracketed] item above with your own words. "}
          {!workTypesChosen &&
            "Choose at least one kind of work you cannot do. "}
          You can save now: the text is saved as you see it, and anything not
          yet filled in is left out of your saved insights.
        </p>
      )}
      <button
        type="button"
        onClick={onSave}
        className={`${BUTTON_CLASS} w-full sm:w-auto bg-blue-700 hover:bg-blue-800`}
      >
        Save to My Packet
      </button>
      {SAVE_MESSAGES[saveState] && (
        <p
          role="status"
          aria-label="Save result"
          className="text-sm text-gray-900 dark:text-gray-100 mt-3"
        >
          {SAVE_MESSAGES[saveState]}
        </p>
      )}
    </div>
  );
}

export default function TdiuAnalysisEditor({
  analysis,
  onChange,
  onCopy,
  onSave,
  saveState,
}) {
  if (!analysis) return null;
  const set = (field) => (value) => onChange({ ...analysis, [field]: value });
  const setImpact = (index) => (value) =>
    onChange({
      ...analysis,
      limitations: analysis.limitations.map((item, i) =>
        i === index ? { ...item, vocational_impact: value } : item,
      ),
    });

  return (
    <div className="space-y-6">
      <div className={CARD_CLASS}>
        <TextField
          label="Statement for Box 18 (VA Form 21-8940)"
          hint="Edit this text, then copy it into your TDIU application."
          value={analysis.summary_argument}
          onChange={set("summary_argument")}
        />
        <button
          type="button"
          onClick={onCopy}
          className={`${BUTTON_CLASS} mt-3 w-full sm:w-auto bg-green-700 hover:bg-green-800`}
        >
          Copy the Box 18 statement
        </button>
      </div>

      <WorkTypes
        selected={analysis.job_types_precluded ?? []}
        onChange={set("job_types_precluded")}
      />

      <div className={`${CARD_CLASS} space-y-5`}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          How each symptom limits your work
        </h3>
        {(analysis.limitations ?? []).map((item, index) => (
          <TextField
            key={`${item.condition}-${item.symptom}`}
            label={`How this limits your work: ${item.condition}, ${item.symptom}`}
            value={item.vocational_impact}
            onChange={setImpact(index)}
          />
        ))}
      </div>

      <div className={CARD_CLASS}>
        <TextField
          label="How your conditions combine to limit your work"
          value={analysis.combined_effect}
          onChange={set("combined_effect")}
        />
      </div>

      <SaveControl
        unfilled={tdiuUnfilledBlanks(analysis).length}
        workTypesChosen={tdiuWorkTypesChosen(analysis)}
        onSave={onSave}
        saveState={saveState}
      />
    </div>
  );
}
