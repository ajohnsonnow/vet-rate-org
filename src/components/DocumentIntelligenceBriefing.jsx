/**
 * Vet-Rate.org - Document Intelligence Briefing Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * "SigInt Intelligence Briefing" - Per-document review and verification
 * User verifies extracted data before saving to VKB
 */

import { useState, useEffect } from "react";
import { getDocumentTypeLabel } from "../utils/documentClassifier";
import ResponsiveModal from "./common/ResponsiveModal";
import { formatFileSize } from "../utils/ocr";
import { detectConflicts } from "../utils/conflictDetector";
import {
  getFieldTooltip,
  shouldCollectField,
  groupFieldsByCategory,
} from "../utils/collectionRules";
import { RibbonRackDisplay } from "./VisualRibbon";
import { sortRibbonsByPrecedence } from "../utils/ribbonRackData";
import { BadgeDisplay, CombatIndicatorSummary } from "./BadgeDisplay";
import { parseDD214Badges } from "../data/badgeData";

// Internal/metadata fields skipped when filtering extracted data for display
const EXCLUDED_METADATA_FIELDS = [
  "type",
  "raw",
  "error",
  "sourcePages",
  "multiDocument",
  "documentIndex",
  "totalDocuments",
];

function FieldEditControls({ editValue, onChange, onSave, onCancel }) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={editValue}
        onChange={onChange}
        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        /* eslint-disable-next-line jsx-a11y/no-autofocus */
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FieldValueDisplay({
  value,
  onEdit,
  onDelete,
  showDeleteConfirm,
  onDeleteClick,
  onCancelDelete,
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-900 dark:text-white font-mono">
        {value}
      </span>
      <button
        onClick={onEdit}
        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        [Edit]
      </button>
      {onDelete && (
        <button
          onClick={onDeleteClick}
          className={`text-xs ${
            showDeleteConfirm
              ? "text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded"
              : "text-red-600 hover:text-red-700 dark:text-red-400"
          }`}
          aria-label={
            showDeleteConfirm
              ? "Click again to confirm delete"
              : "Delete this field (OCR error?)"
          }
        >
          {showDeleteConfirm ? "Confirm Delete?" : "🗑️"}
        </button>
      )}
      {showDeleteConfirm && (
        <button
          onClick={onCancelDelete}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

/**
 * Field verification checkbox with inline editing
 */
const VerifiableField = ({
  label,
  value,
  tooltip,
  onChange,
  checked,
  onCheckChange,
  hasConflict,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete?.();
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  if (!value) return null;

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg ${
        hasConflict
          ? "bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400"
          : "bg-gray-50 dark:bg-gray-800"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckChange(e.target.checked)}
        className="mt-1 w-4 h-4"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {label}
          </label>
          {tooltip && (
            <span
              className="text-xs text-gray-500 dark:text-gray-400 cursor-help"
              aria-label={tooltip}
            >
              💡
            </span>
          )}
        </div>

        {isEditing ? (
          <FieldEditControls
            editValue={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <FieldValueDisplay
            value={value}
            onEdit={() => setIsEditing(true)}
            onDelete={onDelete}
            showDeleteConfirm={showDeleteConfirm}
            onDeleteClick={handleDelete}
            onCancelDelete={() => setShowDeleteConfirm(false)}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Conflict warning display
 */
const ConflictWarning = ({ conflict, onResolve }) => {
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
      <div className="flex items-start gap-2">
        <span className="text-xl">⚠️</span>
        <div className="flex-1">
          <h5 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
            Conflict: {conflict.fieldLabel}
          </h5>
          <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-2">
            {conflict.message}
          </p>
          <div className="text-sm text-yellow-700 dark:text-yellow-400 space-y-2 mb-3">
            <div>
              <strong>Existing:</strong>{" "}
              <code className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded">
                {String(conflict.existing)}
              </code>
            </div>
            <div>
              <strong>This document:</strong>{" "}
              <code className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded">
                {String(conflict.newValue)}
              </code>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onResolve(conflict.field, "existing")}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
            >
              Keep Existing
            </button>
            <button
              onClick={() => onResolve(conflict.field, "new")}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              Use New Value
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ALL DD214 fields - Complete box-by-box reference for manual entry
// Organized by actual DD214 box numbers for easy veteran reference
const DD214_FIELDS_BY_SECTION = [
  {
    section: "IDENTITY (Box 1, 5)",
    fields: [
      {
        key: "veteranName",
        label: "Box 1: Full Name (Last, First Middle)",
        example: "SMITH, JOHN WILLIAM",
      },
      { key: "lastName", label: "Box 1: Last Name Only", example: "SMITH" },
      { key: "firstName", label: "Box 1: First Name Only", example: "JOHN" },
      {
        key: "middleName",
        label: "Box 1: Middle Name Only",
        example: "WILLIAM",
      },
      { key: "suffix", label: "Box 1: Suffix", example: "JR, SR, III" },
      {
        key: "dateOfBirth",
        label: "Box 5: Date of Birth",
        example: "MM/DD/YYYY",
      },
    ],
  },
  {
    section: "SERVICE INFO (Box 2, 4)",
    fields: [
      {
        key: "branch",
        label: "Box 2: Branch of Service",
        example: "Army, Navy, Air Force",
      },
      {
        key: "component",
        label: "Box 2: Component",
        example: "Active Duty, Reserve, Guard",
      },
      {
        key: "department",
        label: "Box 2: Department",
        example: "Department of the Army",
      },
      { key: "rank", label: "Box 4a: Rank/Grade", example: "SPC, SGT, CPT" },
      {
        key: "payGrade",
        label: "Box 4b: Pay Grade",
        example: "E-4, E-6, O-3",
      },
    ],
  },
  {
    section: "ASSIGNMENTS (Box 6-10)",
    fields: [
      {
        key: "reserveObligationDate",
        label: "Box 6: Reserve Obligation Date",
        example: "MM/DD/YYYY",
      },
      {
        key: "placeOfEntry",
        label: "Box 7a: Place of Entry",
        example: "Fort Benning, GA",
      },
      {
        key: "homeOfRecord",
        label: "Box 7b: Home of Record",
        example: "Los Angeles, CA",
      },
      {
        key: "lastDutyAssignment",
        label: "Box 8a: Last Duty Assignment",
        example: "1st Infantry Division",
      },
      {
        key: "stationSeparated",
        label: "Box 8b: Station Separated",
        example: "Fort Hood, TX",
      },
      {
        key: "commandTransferred",
        label: "Box 9: Command Transferred To",
        example: "USAR Control Group",
      },
      {
        key: "sgliCoverage",
        label: "Box 10: SGLI Coverage",
        example: "$400,000",
      },
    ],
  },
  {
    section: "MOS/SPECIALTY (Box 11)",
    fields: [
      {
        key: "mos",
        label: "Box 11: Primary MOS/AFSC",
        example: "92Y, 11B, 0311",
      },
      {
        key: "mosTitle",
        label: "Box 11: MOS Title",
        example: "Unit Supply Specialist",
      },
      {
        key: "additionalMos",
        label: "Box 11: Additional MOS",
        example: "92A, 42A",
      },
      {
        key: "yearsInMos",
        label: "Box 11: Years in MOS",
        example: "3 years, 6 months",
      },
    ],
  },
  {
    section: "SERVICE DATES (Box 12)",
    fields: [
      {
        key: "serviceStartDate",
        label: "Box 12a: Date Entered AD",
        example: "MM/DD/YYYY",
      },
      {
        key: "serviceEndDate",
        label: "Box 12b: Separation Date",
        example: "MM/DD/YYYY",
      },
      {
        key: "totalActiveService",
        label: "Box 12c: Net Active Service",
        example: "4 yrs, 3 mos, 15 days",
      },
      {
        key: "totalPriorActiveService",
        label: "Box 12d: Prior Active Service",
        example: "2 yrs, 0 mos",
      },
      {
        key: "totalPriorInactiveService",
        label: "Box 12e: Prior Inactive Service",
        example: "1 yr, 6 mos",
      },
      {
        key: "foreignService",
        label: "Box 12f: Foreign Service",
        example: "1 yr, 2 mos",
      },
      { key: "seaService", label: "Box 12f: Sea Service", example: "8 mos" },
    ],
  },
  {
    section: "AWARDS & DECORATIONS (Box 13)",
    fields: [
      {
        key: "awards",
        label: "Box 13: Medals/Decorations",
        example: "Army Commendation Medal",
      },
      {
        key: "campaignRibbons",
        label: "Box 13: Campaign Ribbons",
        example: "Iraq Campaign Medal",
      },
      {
        key: "badges",
        label: "Box 13: Badges/Tabs",
        example: "CIB, Parachutist",
      },
      {
        key: "citations",
        label: "Box 13: Citations",
        example: "AAM Citation",
      },
    ],
  },
  {
    section: "EDUCATION & BENEFITS (Box 14-17)",
    fields: [
      {
        key: "militaryEducation",
        label: "Box 14: Military Education",
        example: "BCT (9 wks), AIT (12 wks)",
      },
      {
        key: "veapContribution",
        label: "Box 15a: VEAP Contribution",
        example: "Yes/No",
      },
      { key: "veapAmount", label: "Box 15b: VEAP Amount", example: "$2,700" },
      {
        key: "accruedLeavePaid",
        label: "Box 16: Accrued Leave Paid",
        example: "30 days",
      },
      {
        key: "dentalExamProvided",
        label: "Box 17: Dental Exam",
        example: "Yes/No",
      },
    ],
  },
  {
    section: "REMARKS (Box 18)",
    fields: [
      {
        key: "remarks",
        label: "Box 18: General Remarks",
        example: "Member served in OIF",
      },
      {
        key: "combatZone",
        label: "Box 18: Combat Zone",
        example: "Iraq 03/2005-02/2006",
      },
      {
        key: "deployments",
        label: "Box 18: Deployments",
        example: "OIF 2005-2006",
      },
      {
        key: "injuriesDocumented",
        label: "Box 18: Injuries Documented",
        example: "TBI 05/2006",
      },
    ],
  },
  {
    section: "SEPARATION INFO (Box 23-29)",
    fields: [
      {
        key: "mailingAddress",
        label: "Box 19: Mailing Address",
        example: "123 Main St, City, ST",
      },
      {
        key: "copy4Destination",
        label: "Box 20: Copy 4 Sent To",
        example: "State VA Office",
      },
      {
        key: "separationType",
        label: "Box 23: Type of Separation",
        example: "Retirement, ETS",
      },
      {
        key: "dischargeType",
        label: "Box 24: Character of Service",
        example: "Honorable",
      },
      {
        key: "separationAuthority",
        label: "Box 25: Separation Authority",
        example: "AR 635-200",
      },
      { key: "spdCode", label: "Box 26: SPD Code", example: "JBK, MBK" },
      { key: "reentryCode", label: "Box 27: RE Code", example: "RE-1, RE-2" },
      {
        key: "narrativeReason",
        label: "Box 28: Narrative Reason",
        example: "Completion of Active Service",
      },
      { key: "timeLost", label: "Box 29: Time Lost", example: "None" },
    ],
  },
];

function MissingFieldsSection({
  section,
  existingFields,
  fieldValues,
  onFieldChange,
  onAddField,
}) {
  const sectionFields = section.fields.filter(
    (f) => !existingFields?.includes(f.key),
  );
  if (sectionFields.length === 0) return null;

  return (
    <div className="mb-6">
      <h5 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 sticky top-0 bg-inherit py-1">
        {section.section}
      </h5>
      <div className="space-y-2">
        {sectionFields.map((field) => (
          <div
            key={field.key}
            className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-2"
          >
            <label
              className="w-1/3 text-xs font-medium text-gray-600 dark:text-gray-400 truncate"
              aria-label={field.label}
            >
              {field.label}
            </label>
            <input
              type="text"
              value={fieldValues[field.key] || ""}
              onChange={(e) => onFieldChange(field.key, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAddField(field.key)}
              placeholder={field.example}
              className="flex-1 px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
            />
            <button
              onClick={() => onAddField(field.key)}
              disabled={!fieldValues[field.key]?.trim()}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded text-sm"
              aria-label="Add this field"
            >
              ✓
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissingFieldsExpandedPanel({
  ocrFailed,
  filledCount,
  onAddAllFilledFields,
  existingFields,
  fieldValues,
  onFieldChange,
  onAddField,
}) {
  return (
    <div
      className={`mt-3 rounded-lg ${ocrFailed ? "bg-green-50 dark:bg-green-900/20" : "bg-blue-50 dark:bg-blue-900/20"}`}
    >
      {/* Header with Save All button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Fill in the fields from your DD214. Press Enter or click ✓ to add each
          field.
        </p>
        {filledCount > 0 && (
          <button
            onClick={onAddAllFilledFields}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
          >
            ✅ Add All {filledCount} Filled Fields
          </button>
        )}
      </div>

      {/* Scrollable field list */}
      <div className="max-h-[60vh] overflow-y-auto p-4">
        {DD214_FIELDS_BY_SECTION.map((section) => (
          <MissingFieldsSection
            key={section.section}
            section={section}
            existingFields={existingFields}
            fieldValues={fieldValues}
            onFieldChange={onFieldChange}
            onAddField={onAddField}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Owns the local field-value state and add/save handlers for the manual
 * DD214 field-entry panel.
 */
function useFieldEntryState(existingFields, onAddField) {
  const [fieldValues, setFieldValues] = useState({});

  const handleFieldChange = (key, value) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddField = (key) => {
    const value = fieldValues[key]?.trim();
    if (value) {
      onAddField(key, value);
      setFieldValues((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const handleAddAllFilledFields = () => {
    Object.entries(fieldValues).forEach(([key, value]) => {
      if (value?.trim() && !existingFields?.includes(key)) {
        onAddField(key, value.trim());
      }
    });
    setFieldValues({});
  };

  return {
    fieldValues,
    handleFieldChange,
    handleAddField,
    handleAddAllFilledFields,
  };
}

/**
 * Panel to add missing fields manually when OCR fails
 * Shows ALL DD214 fields as a scrollable list of input fields
 * ONLY FOR DD214/DD215/NGB22 documents - not for claim letters!
 */
const AddMissingFieldPanel = ({
  classification,
  onAddField,
  existingFields,
  autoExpand = false,
}) => {
  // Auto-expand when OCR fails (no existing fields extracted)
  const [isExpanded, setIsExpanded] = useState(autoExpand);
  const {
    fieldValues,
    handleFieldChange,
    handleAddField,
    handleAddAllFilledFields,
  } = useFieldEntryState(existingFields, onAddField);

  // Check if this is a service record document (DD214, DD215, NGB22, DD256, DD257)
  const isServiceRecord = [
    "dd214",
    "dd215",
    "ngb22",
    "dd256",
    "dd257",
  ].includes(classification?.toLowerCase());

  // Don't show DD214 fields for non-service-record documents (like claim letters)
  if (!isServiceRecord) {
    return null;
  }

  const allFields = DD214_FIELDS_BY_SECTION.flatMap((s) => s.fields);
  const availableFields = allFields.filter(
    (f) => !existingFields?.includes(f.key),
  );

  if (availableFields.length === 0) return null;

  const ocrFailed = autoExpand;
  const filledCount = Object.values(fieldValues).filter((v) =>
    v?.trim(),
  ).length;

  return (
    <div
      className={`mt-6 pt-4 ${ocrFailed ? "" : "border-t border-gray-200 dark:border-gray-700"}`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 font-semibold hover:text-blue-700 ${
          ocrFailed
            ? "text-lg text-green-600 dark:text-green-400"
            : "text-sm text-blue-600 dark:text-blue-400"
        }`}
      >
        <span>{isExpanded ? "▼" : "►"}</span>
        <span>
          {ocrFailed
            ? "📝 Enter DD214 Fields Manually"
            : "➕ Add Missing Fields"}
        </span>
        <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
          {availableFields.length} fields
        </span>
      </button>

      {isExpanded && (
        <MissingFieldsExpandedPanel
          ocrFailed={ocrFailed}
          filledCount={filledCount}
          onAddAllFilledFields={handleAddAllFilledFields}
          existingFields={existingFields}
          fieldValues={fieldValues}
          onFieldChange={handleFieldChange}
          onAddField={handleAddField}
        />
      )}
    </div>
  );
};

function useDocumentNavigation(totalDocuments) {
  const [currentDocIndex, setCurrentDocIndex] = useState(0);

  const goToNextDocument = () => {
    if (currentDocIndex < totalDocuments - 1) {
      setCurrentDocIndex((prev) => prev + 1);
    }
  };

  const goToPrevDocument = () => {
    if (currentDocIndex > 0) {
      setCurrentDocIndex((prev) => prev - 1);
    }
  };

  return { currentDocIndex, goToNextDocument, goToPrevDocument };
}

/**
 * Owns the per-document verification state: detects conflicts, filters the
 * raw extracted fields down to collectible ones, and groups them by category.
 */
function useDocumentBriefingData({
  currentData,
  classification,
  filename,
  providedConflicts,
  currentDocIndex,
  totalDocuments,
  isMultiDocument,
  extractedData,
}) {
  const [editedData, setEditedData] = useState({});
  const [verifiedFields, setVerifiedFields] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [filteredData, setFilteredData] = useState({});
  const [groupedFields, setGroupedFields] = useState({});

  // Debug logging to trace data flow
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("🛡️ SigInt Briefing received extractedData:", extractedData);
    // eslint-disable-next-line no-console
    console.log("🛡️ SigInt Briefing classification:", classification);
    if (isMultiDocument) {
      // eslint-disable-next-line no-console
      console.log(`🛡️ Multiple documents detected: ${totalDocuments} DD214(s)`);
    }
  }, [extractedData, classification, isMultiDocument, totalDocuments]);

  // Detect conflicts on mount and when document changes
  useEffect(() => {
    const loadConflicts = async () => {
      if (!currentData || !classification?.type) return;

      // eslint-disable-next-line no-console
      console.log(
        "🛡️ Processing document",
        isMultiDocument ? `${currentDocIndex + 1}/${totalDocuments}` : "1/1",
        "with",
        Object.keys(currentData).length,
        "fields",
      );

      // Reset state for new document
      setEditedData(currentData || {});
      setVerifiedFields({});

      const detected = await detectConflicts(
        currentData,
        classification.type,
        filename,
      );
      setConflicts(detected.length > 0 ? detected : providedConflicts);

      // Filter fields by collection rules - include ALL non-null fields for DD214
      const filtered = {};
      for (const [field, value] of Object.entries(currentData)) {
        if (EXCLUDED_METADATA_FIELDS.includes(field)) continue;
        if (value === null || value === undefined || value === "") continue;
        if (shouldCollectField(field, classification.type)) {
          filtered[field] = value;
        }
      }

      // eslint-disable-next-line no-console
      console.log("🛡️ Filtered fields:", Object.keys(filtered));
      setFilteredData(filtered);

      // Group by category
      const grouped = groupFieldsByCategory(filtered, classification.type);
      // eslint-disable-next-line no-console
      console.log("🛡️ Grouped fields:", grouped);
      setGroupedFields(grouped);
    };

    loadConflicts();
  }, [
    currentData,
    currentDocIndex,
    classification,
    filename,
    providedConflicts,
    isMultiDocument,
    totalDocuments,
  ]);

  return {
    editedData,
    setEditedData,
    verifiedFields,
    setVerifiedFields,
    conflicts,
    filteredData,
    setFilteredData,
    groupedFields,
    setGroupedFields,
  };
}

function useDocumentFieldActions({
  filteredData,
  setFilteredData,
  setEditedData,
  setVerifiedFields,
  setGroupedFields,
  classification,
}) {
  const handleFieldCheck = (field, checked) => {
    setVerifiedFields((prev) => ({ ...prev, [field]: checked }));
  };

  const handleFieldEdit = (field, newValue) => {
    setEditedData((prev) => ({ ...prev, [field]: newValue }));
  };

  // Delete a field that was incorrectly extracted by OCR
  const handleFieldDelete = (field) => {
    // eslint-disable-next-line no-console
    console.log(`🗑️ Deleting incorrectly extracted field: ${field}`);
    setFilteredData((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
    setEditedData((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
    setVerifiedFields((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
    // Re-group the remaining fields
    const remainingData = { ...filteredData };
    delete remainingData[field];
    const grouped = groupFieldsByCategory(remainingData, classification?.type);
    setGroupedFields(grouped);
  };

  // Delete a single item from an array field (e.g., one award from awards list)
  const handleArrayItemDelete = (field, indexToDelete) => {
    // eslint-disable-next-line no-console
    console.log(`🗑️ Deleting item ${indexToDelete} from array field: ${field}`);

    setFilteredData((prev) => {
      const currentArray = prev[field];
      if (!Array.isArray(currentArray)) return prev;

      const updatedArray = currentArray.filter(
        (_, idx) => idx !== indexToDelete,
      );

      if (updatedArray.length === 0) {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      }

      return { ...prev, [field]: updatedArray };
    });

    setEditedData((prev) => {
      const currentArray = prev[field];
      if (!Array.isArray(currentArray)) return prev;

      const updatedArray = currentArray.filter(
        (_, idx) => idx !== indexToDelete,
      );

      if (updatedArray.length === 0) {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      }

      return { ...prev, [field]: updatedArray };
    });

    // Re-group after deletion
    setTimeout(() => {
      const grouped = groupFieldsByCategory(filteredData, classification?.type);
      setGroupedFields(grouped);
    }, 0);
  };

  return {
    handleFieldCheck,
    handleFieldEdit,
    handleFieldDelete,
    handleArrayItemDelete,
  };
}

function useConflictResolution({ conflicts, setEditedData }) {
  const handleConflictResolve = (field, resolution) => {
    const conflict = conflicts.find((c) => c.field === field);
    if (!conflict) return;
    if (resolution === "existing") {
      setEditedData((prev) => ({ ...prev, [field]: conflict.existing }));
    } else if (resolution === "new") {
      setEditedData((prev) => ({ ...prev, [field]: conflict.newValue }));
    }
  };

  const hasConflict = (field) => conflicts.some((c) => c.field === field);

  return { handleConflictResolve, hasConflict };
}

function DocumentBriefingHeader({
  isMultiDocument,
  currentDocIndex,
  totalDocuments,
  currentData,
  onClose,
  onPrev,
  onNext,
}) {
  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-3xl sm:text-4xl">🛡️</span>
          <div className="min-w-0">
            <h2
              id="doc-intel-briefing-title"
              className="text-lg font-bold sm:text-2xl"
            >
              SigInt Intelligence Briefing{" "}
              <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
                BETA
              </span>
            </h2>
            <p className="text-xs text-indigo-100 sm:text-sm">
              Verify extracted information before saving
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-2xl text-white transition-colors hover:bg-white/20"
        >
          ×
        </button>
      </div>

      {/* Multiple Document Navigator */}
      {isMultiDocument && (
        <div className="mt-4 flex items-center justify-between gap-2 bg-white/10 rounded-lg p-3">
          <button
            onClick={onPrev}
            disabled={currentDocIndex === 0}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            ← Previous
          </button>
          <div className="text-center">
            <span className="text-lg font-bold">
              DD214 #{currentDocIndex + 1}
            </span>
            <span className="text-sm opacity-80"> of {totalDocuments}</span>
            {currentData?.sourcePages && (
              <span className="text-xs block opacity-60">
                Pages {currentData.sourcePages}
              </span>
            )}
          </div>
          <button
            onClick={onNext}
            disabled={currentDocIndex === totalDocuments - 1}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function DocumentBriefingFooter({
  onSkip,
  onClose,
  onVerifyAndSave,
  allFieldsVerified,
  hasFields,
}) {
  const canSave = allFieldsVerified || !hasFields;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <button
        onClick={onSkip}
        className="w-full px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors sm:w-auto"
      >
        ⏭️ Skip This Document
      </button>

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors sm:w-auto"
        >
          ← Back to Formation
        </button>

        <button
          onClick={onVerifyAndSave}
          disabled={!canSave}
          className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 sm:w-auto ${
            canSave
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          }`}
        >
          ✅ Verify & Save
        </button>
      </div>
    </div>
  );
}

function DocumentClassificationRow({ classification, onOpenDD214Analyzer }) {
  const isServiceRecordType = [
    "dd214",
    "dd215",
    "ngb22",
    "dd256",
    "dd257",
  ].includes(classification?.type?.toLowerCase());

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            Classification:
          </span>
          <span
            className={`px-3 py-1 rounded-lg text-sm font-medium ${
              classification?.confidence >= 80
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
            }`}
          >
            {getDocumentTypeLabel(classification?.type)} -{" "}
            {classification?.confidence}% confidence
          </span>
        </div>

        {/* Open in DD214 Analyzer button for service records */}
        {isServiceRecordType && onOpenDD214Analyzer && (
          <button
            onClick={onOpenDD214Analyzer}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md hover:shadow-lg"
            aria-label="Open this DD214 in the specialized DD214 Analyzer for advanced AI extraction and detailed analysis"
          >
            🔍 Analyze with AI
          </button>
        )}
      </div>
    </div>
  );
}

function DocumentInfoSection({
  filename,
  size,
  pageCount,
  method,
  visionUsed,
  confidence,
  currentData,
  isMultiDocument,
  currentDocIndex,
  classification,
  onOpenDD214Analyzer,
}) {
  let methodLabel;
  if (visionUsed) {
    methodLabel = "👁️ Vision AI (Florence-2)";
  } else if (method === "ocr") {
    methodLabel = "🔍 OCR Extracted";
  } else if (method === "advanced_ocr") {
    methodLabel = "🔍 Advanced OCR";
  } else if (method === "vision_florence") {
    methodLabel = "👁️ Vision AI";
  } else {
    methodLabel = "📖 Native Text";
  }

  let confidenceStyle;
  if (confidence >= 80) {
    confidenceStyle = "text-green-600 dark:text-green-400";
  } else if (confidence >= 60) {
    confidenceStyle = "text-yellow-600 dark:text-yellow-400";
  } else {
    confidenceStyle = "text-red-600 dark:text-red-400";
  }

  return (
    <div className="border-b border-gray-200 pb-6 dark:border-gray-700">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          📄 {filename}{" "}
          {isMultiDocument && (
            <span className="text-blue-600 dark:text-blue-400">
              (DD214 #{currentDocIndex + 1})
            </span>
          )}
        </h3>
        <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
          <span>💾 {formatFileSize(size)}</span>
          <span>
            📑 {pageCount} page{pageCount !== 1 ? "s" : ""}
          </span>
          {/* Show extraction method with Vision AI indicator */}
          <span
            className={
              visionUsed
                ? "text-purple-600 dark:text-purple-400 font-medium"
                : ""
            }
          >
            {methodLabel}
          </span>
          {/* Show confidence if available */}
          {confidence && (
            <span className={confidenceStyle}>{confidence}% confidence</span>
          )}
          {currentData?.sourcePages && (
            <span>📋 Source: Pages {currentData.sourcePages}</span>
          )}
        </div>
      </div>

      <DocumentClassificationRow
        classification={classification}
        onOpenDD214Analyzer={onOpenDD214Analyzer}
      />
    </div>
  );
}

function ConflictsSection({ conflicts, onResolve }) {
  return (
    <div className="border-b border-gray-200 py-6 dark:border-gray-700">
      <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-300 mb-3">
        ⚠️ {conflicts.length} Conflict{conflicts.length !== 1 ? "s" : ""}{" "}
        Detected
      </h3>
      <div className="space-y-3">
        {conflicts.map((conflict, index) => (
          <ConflictWarning
            key={index}
            conflict={conflict}
            onResolve={onResolve}
          />
        ))}
      </div>
    </div>
  );
}

function OCRFailedMessage() {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-6 text-center mb-6">
      <div className="text-4xl mb-3">😔</div>
      <h4 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-3">
        We&apos;re Sorry - We Couldn&apos;t Read This DD214
      </h4>

      <div className="text-sm text-amber-700 dark:text-amber-400 space-y-2 mb-4 max-w-lg mx-auto">
        <p>
          Many older DD214s (especially those from the typewriter era or
          documents that have been copied multiple times) are simply too faded
          or degraded for our OCR technology to read reliably.
        </p>
        <p className="font-medium">
          This is <strong>not your fault</strong> - it&apos;s a limitation of
          working with aged documents.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mt-4 border border-amber-200 dark:border-amber-800">
        <h5 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
          <span>📝</span> What You Can Do
        </h5>
        <ul className="text-sm text-gray-600 dark:text-gray-400 text-left space-y-2 max-w-md mx-auto">
          <li className="flex gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>
              <strong>Manual Entry:</strong> Use the &quot;Enter DD214 Fields
              Manually&quot; panel below to enter your information by hand.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>
              <strong>Request Replacement:</strong> Contact the{" "}
              <a
                href="https://www.archives.gov/veterans/military-service-records"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                National Archives
              </a>{" "}
              for a certified copy of your DD214.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>
              <strong>Better Scan:</strong> If possible, try scanning your
              original at 300+ DPI in grayscale.
            </span>
          </li>
        </ul>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-500 mt-4 italic">
        💾 The raw text (whatever we could capture) has been saved to your
        Veteran Knowledge Base for reference.
      </p>
    </div>
  );
}

// Format array items for display
function formatArrayItem(item) {
  if (typeof item === "string") return item;
  // Handle award objects from parseDD214Text
  if (item?.award?.name) {
    const name = item.award.name;
    let qty = "";
    if (item.quantity > 1) {
      qty = ` (${item.quantity}x)`;
    }
    const devices =
      item.devices?.length > 0
        ? ` w/ ${item.devices.map((d) => d.type.replace("_", " ")).join(", ")}`
        : "";
    return `${name}${qty}${devices}`;
  }
  // Handle other objects
  if (typeof item === "object") {
    return item.name || item.title || item.value || JSON.stringify(item);
  }
  return String(item);
}

// Derive visual ribbon/badge display data for an awards array field
function getAwardsDisplayData(fieldKey, value, filteredData) {
  // Check if this is an awards array with award objects
  const isAwardsArray =
    fieldKey.toLowerCase() === "awards" &&
    value.some((item) => item?.award?.name || item?.awardId);

  // Prepare visual awards for RibbonRackDisplay
  const visualAwards = isAwardsArray
    ? value
        .filter((item) => item?.award || item?.awardId)
        .map((item) => ({
          awardId: item.awardId || item.award?.id,
          award: item.award || { id: item.awardId, name: item.matchedText },
          devices: item.devices || [],
        }))
    : [];

  // Sort by precedence for proper military display
  const sortedVisualAwards =
    visualAwards.length > 0
      ? sortRibbonsByPrecedence(visualAwards, filteredData?.branch || "Army")
      : [];

  // Parse badges from awards text
  const awardsText = value
    .map((item) => item?.matchedText || item?.award?.name || String(item))
    .join("\n");
  // Strip everything from the first "/" onward (equivalent to the former
  // /\/.*$/ regex) without introducing a super-linear backtracking pattern.
  const rawBranch = filteredData?.branch;
  const slashIndex = rawBranch ? rawBranch.indexOf("/") : -1;
  const branchForBadges =
    (slashIndex >= 0 ? rawBranch.slice(0, slashIndex) : rawBranch) || "Army";
  const { badges, tabs, combatIndicators } = parseDD214Badges(
    awardsText,
    branchForBadges,
  );

  return {
    sortedVisualAwards,
    badges,
    tabs,
    combatIndicators,
    branchForBadges,
  };
}

function ArrayValueVisuals({ sortedVisualAwards, badges, tabs, combatIndicators, branchForBadges, value }) {
  return (
    <>
      {combatIndicators.length > 0 && (
        <CombatIndicatorSummary
          badges={badges.filter((b) => b.combatIndicator)}
          ribbonAwards={value}
        />
      )}

      {badges.length > 0 && (
        <div className="mb-4">
          <BadgeDisplay
            badges={badges}
            tabs={tabs}
            branch={branchForBadges}
            size="sm"
            showLabels={true}
          />
        </div>
      )}

      {sortedVisualAwards.length > 0 && (
        <div className="mb-4 flex justify-center">
          <RibbonRackDisplay
            awards={sortedVisualAwards}
            ribbonsPerRow={3}
            size="md"
            showNames={false}
          />
        </div>
      )}
    </>
  );
}

function ArrayValueList({ fieldKey, value, onArrayItemDelete }) {
  return (
    <ul className="space-y-1 text-sm">
      {value.map((item, idx) => (
        <li
          key={idx}
          className="flex items-center justify-between group text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 -mx-2"
        >
          <span>• {formatArrayItem(item)}</span>
          <button
            onClick={() => onArrayItemDelete(fieldKey, idx)}
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity text-xs ml-2"
            aria-label="Remove this item (OCR error?)"
          >
            🗑️
          </button>
        </li>
      ))}
    </ul>
  );
}

function ArrayValueField({
  fieldKey,
  value,
  filteredData,
  getTooltip,
  onArrayItemDelete,
  checked,
  onCheckChange,
}) {
  const awardsDisplay = getAwardsDisplayData(fieldKey, value, filteredData);

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckChange(e.target.checked)}
        className="mt-1 w-4 h-4"
      />
      <div className="flex-1 min-w-0">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
          {fieldKey.charAt(0).toUpperCase() +
            fieldKey.slice(1).replace(/([A-Z])/g, " $1")}
          {getTooltip(fieldKey) && (
            <span
              className="ml-2 text-xs text-gray-500 dark:text-gray-400 cursor-help"
              aria-label={getTooltip(fieldKey)}
            >
              💡
            </span>
          )}
        </label>

        <ArrayValueVisuals {...awardsDisplay} value={value} />
        <ArrayValueList
          fieldKey={fieldKey}
          value={value}
          onArrayItemDelete={onArrayItemDelete}
        />
      </div>
    </div>
  );
}

function formatObjectEntry(key, value) {
  const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
  if (typeof value === "boolean") return `${label}: ${value ? "Yes" : "No"}`;
  if (Array.isArray(value)) {
    return value.length > 0 ? `${label}: ${value.join(", ")}` : null;
  }
  if (value === null || value === undefined || value === "") return null;
  return `${label}: ${value}`;
}

// Renders a plain-object field (e.g. DD214 combatService: {hasVerifiedCombat,
// indicators, deployments}) as a readable summary instead of the useless
// "[object Object]" String(value) produces for anything non-primitive.
function ObjectValueField({ fieldKey, value, getTooltip, checked, onCheckChange }) {
  const entries = Object.entries(value)
    .map(([k, v]) => formatObjectEntry(k, v))
    .filter(Boolean);

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckChange(e.target.checked)}
        className="mt-1 w-4 h-4"
      />
      <div className="flex-1 min-w-0">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
          {fieldKey.charAt(0).toUpperCase() +
            fieldKey.slice(1).replace(/([A-Z])/g, " $1")}
          {getTooltip(fieldKey) && (
            <span
              className="ml-2 text-xs text-gray-500 dark:text-gray-400 cursor-help"
              aria-label={getTooltip(fieldKey)}
            >
              💡
            </span>
          )}
        </label>
        {entries.length > 0 ? (
          <ul className="space-y-1 text-sm text-gray-900 dark:text-white">
            {entries.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No details extracted
          </p>
        )}
      </div>
    </div>
  );
}

function FieldGroup({
  category,
  fields,
  filteredData,
  getTooltip,
  verifiedFields,
  onFieldCheck,
  onFieldEdit,
  hasConflict,
  onFieldDelete,
  onArrayItemDelete,
}) {
  return (
    <div>
      <h4 className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
        {category} Information
      </h4>
      <div className="space-y-3">
        {Object.entries(fields).map(([key, value]) => {
          // Must match the upstream filteredData filter (null/undefined/"")
          // exactly. A narrower `!value` here would also drop legitimate
          // falsy values (0, false) — rendering nothing for a field that
          // still counts toward allFieldsVerified, permanently disabling
          // Verify & Save with no checkbox to unblock it.
          if (value === null || value === undefined || value === "")
            return null;
          if (Array.isArray(value) && value.length === 0) return null;

          if (Array.isArray(value)) {
            return (
              <ArrayValueField
                key={key}
                fieldKey={key}
                value={value}
                filteredData={filteredData}
                getTooltip={getTooltip}
                onArrayItemDelete={onArrayItemDelete}
                checked={verifiedFields[key] || false}
                onCheckChange={(checked) => onFieldCheck(key, checked)}
              />
            );
          }

          if (typeof value === "object") {
            return (
              <ObjectValueField
                key={key}
                fieldKey={key}
                value={value}
                getTooltip={getTooltip}
                checked={verifiedFields[key] || false}
                onCheckChange={(checked) => onFieldCheck(key, checked)}
              />
            );
          }

          return (
            <VerifiableField
              key={key}
              label={
                key.charAt(0).toUpperCase() +
                key.slice(1).replace(/([A-Z])/g, " $1")
              }
              value={String(value)}
              tooltip={getTooltip(key)}
              checked={verifiedFields[key] || false}
              onCheckChange={(checked) => onFieldCheck(key, checked)}
              onChange={(newValue) => onFieldEdit(key, newValue)}
              hasConflict={hasConflict(key)}
              onDelete={() => onFieldDelete(key)}
            />
          );
        })}
      </div>
    </div>
  );
}

function DocumentFieldGroups({
  groupedFields,
  filteredData,
  getTooltip,
  verifiedFields,
  onFieldCheck,
  onFieldEdit,
  hasConflict,
  onFieldDelete,
  onArrayItemDelete,
}) {
  return (
    <div className="space-y-6 mb-6">
      {Object.entries(groupedFields).map(([category, fields]) => (
        <FieldGroup
          key={category}
          category={category}
          fields={fields}
          filteredData={filteredData}
          getTooltip={getTooltip}
          verifiedFields={verifiedFields}
          onFieldCheck={onFieldCheck}
          onFieldEdit={onFieldEdit}
          hasConflict={hasConflict}
          onFieldDelete={onFieldDelete}
          onArrayItemDelete={onArrayItemDelete}
        />
      ))}
    </div>
  );
}

function DocumentBriefingOptions({
  saveToVKB,
  setSaveToVKB,
  updateProfile,
  setUpdateProfile,
}) {
  return (
    <div className="border-t border-gray-200 py-6 dark:border-gray-700">
      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={saveToVKB}
            onChange={(e) => setSaveToVKB(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            💾 Save this document to Veteran Knowledge Base
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={updateProfile}
            onChange={(e) => setUpdateProfile(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            👤 Update profile with verified information
          </span>
        </label>
      </div>
    </div>
  );
}

/**
 * Extracted Information section: shows the OCR-failed message, the grouped
 * verified fields, and the always-visible Add Missing Field panel.
 */
function ExtractedInformationSection({
  hasFields,
  groupedFields,
  filteredData,
  getTooltip,
  verifiedFields,
  onFieldCheck,
  onFieldEdit,
  hasConflict,
  onFieldDelete,
  onArrayItemDelete,
  classification,
  onAddField,
}) {
  return (
    <div className="py-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Extracted Information (Verify before saving):
      </h3>

      {/* Show apologetic message when OCR fails */}
      {!hasFields && <OCRFailedMessage />}

      {/* Show extracted fields when OCR succeeded */}
      {hasFields && (
        <DocumentFieldGroups
          groupedFields={groupedFields}
          filteredData={filteredData}
          getTooltip={getTooltip}
          verifiedFields={verifiedFields}
          onFieldCheck={onFieldCheck}
          onFieldEdit={onFieldEdit}
          hasConflict={hasConflict}
          onFieldDelete={onFieldDelete}
          onArrayItemDelete={onArrayItemDelete}
        />
      )}

      {/* ALWAYS show Add Missing Field panel - auto-expand when OCR failed */}
      <AddMissingFieldPanel
        classification={classification?.type}
        onAddField={onAddField}
        existingFields={Object.keys(filteredData)}
        autoExpand={!hasFields}
      />
    </div>
  );
}

/**
 * Loads the base extraction/navigation/document state that the briefing
 * controller builds on.
 */
function useDocumentBriefingSourceState({
  extractionResult,
  providedConflicts,
}) {
  const {
    filename,
    size,
    classification,
    extractedData,
    pageCount,
    method,
    visionUsed, // Florence-2 Vision AI fallback flag
    confidence, // OCR/Vision confidence
  } = extractionResult || {};

  // Handle multiple DD214s in one file
  const isMultiDocument = extractedData?.type === "multiple_service_records";
  const documents = isMultiDocument ? extractedData.documents : null;
  const totalDocuments = isMultiDocument ? extractedData.totalDocuments : 1;

  const { currentDocIndex, goToNextDocument, goToPrevDocument } =
    useDocumentNavigation(totalDocuments);

  // Get current document data (either single or from array)
  const currentData = isMultiDocument
    ? documents?.[currentDocIndex]
    : extractedData;

  const [saveToVKB, setSaveToVKB] = useState(true);
  const [updateProfile, setUpdateProfile] = useState(true);

  const documentData = useDocumentBriefingData({
    currentData,
    classification,
    filename,
    providedConflicts,
    currentDocIndex,
    totalDocuments,
    isMultiDocument,
    extractedData,
  });

  return {
    filename,
    size,
    classification,
    pageCount,
    method,
    visionUsed,
    confidence,
    isMultiDocument,
    totalDocuments,
    currentDocIndex,
    goToNextDocument,
    goToPrevDocument,
    currentData,
    saveToVKB,
    setSaveToVKB,
    updateProfile,
    setUpdateProfile,
    ...documentData,
  };
}

/**
 * Owns all state, data-loading, and derived values for the Document
 * Intelligence Briefing modal.
 */
function useDocumentBriefingController({
  extractionResult,
  providedConflicts,
  onVerify,
}) {
  const sourceState = useDocumentBriefingSourceState({
    extractionResult,
    providedConflicts,
  });
  const {
    filename,
    classification,
    saveToVKB,
    updateProfile,
    editedData,
    setEditedData,
    verifiedFields,
    setVerifiedFields,
    conflicts,
    filteredData,
    setFilteredData,
    setGroupedFields,
  } = sourceState;

  const {
    handleFieldCheck,
    handleFieldEdit,
    handleFieldDelete,
    handleArrayItemDelete,
  } = useDocumentFieldActions({
    filteredData,
    setFilteredData,
    setEditedData,
    setVerifiedFields,
    setGroupedFields,
    classification,
  });

  const { handleConflictResolve, hasConflict } = useConflictResolution({
    conflicts,
    setEditedData,
  });

  const getTooltip = (field) => getFieldTooltip(field, classification?.type);

  const handleVerifyAndSave = () => {
    const verifiedData = Object.keys(verifiedFields)
      .filter((key) => verifiedFields[key])
      .reduce((acc, key) => ({ ...acc, [key]: editedData[key] }), {});

    onVerify({
      verifiedData,
      saveToVKB,
      updateProfile,
      filename,
      classification: classification?.type,
      resolvedConflicts: conflicts.map((c) => ({
        ...c,
        resolvedValue: editedData[c.field],
        resolvedBy: "user",
        resolvedAt: Date.now(),
      })),
    });
  };

  const allFieldsVerified =
    Object.keys(filteredData).length > 0 &&
    Object.keys(filteredData).every((key) => verifiedFields[key]);

  const hasFields = Object.keys(filteredData).length > 0;

  return {
    ...sourceState,
    handleFieldCheck,
    handleFieldEdit,
    handleFieldDelete,
    handleArrayItemDelete,
    handleConflictResolve,
    hasConflict,
    getTooltip,
    handleVerifyAndSave,
    allFieldsVerified,
    hasFields,
  };
}

// Builds the onAddField handler that writes a manually-entered value into
// filteredData/editedData and marks it verified.
function addVerifiedField(setFilteredData, setEditedData, setVerifiedFields) {
  return (field, value) => {
    setFilteredData((prev) => ({ ...prev, [field]: value }));
    setEditedData((prev) => ({ ...prev, [field]: value }));
    setVerifiedFields((prev) => ({ ...prev, [field]: true }));
  };
}

/**
 * Renders the save-to-VKB / update-profile checkboxes plus the trailing
 * help text shown at the bottom of the briefing modal.
 */
function DocumentBriefingOptionsAndHelp({
  saveToVKB,
  setSaveToVKB,
  updateProfile,
  setUpdateProfile,
}) {
  return (
    <>
      {/* Options */}
      <DocumentBriefingOptions
        saveToVKB={saveToVKB}
        setSaveToVKB={setSaveToVKB}
        updateProfile={updateProfile}
        setUpdateProfile={setUpdateProfile}
      />

      {/* Help Text */}
      <p className="pt-6 text-xs text-gray-500 dark:text-gray-400 italic">
        💡 Review each field carefully. Check the boxes to verify accuracy,
        click [Edit] to correct mistakes, or click 🗑️ to delete incorrect OCR
        extractions. Only verified fields will be saved to your profile.
      </p>
    </>
  );
}

/**
 * Renders the document info summary and any detected-conflicts banner
 * at the top of the briefing modal body.
 */
function DocumentBriefingInfoAndConflicts({
  filename,
  size,
  pageCount,
  method,
  visionUsed,
  confidence,
  currentData,
  isMultiDocument,
  currentDocIndex,
  classification,
  onOpenDD214Analyzer,
  conflicts,
  handleConflictResolve,
}) {
  return (
    <>
      {/* Document Info */}
      <DocumentInfoSection
        filename={filename}
        size={size}
        pageCount={pageCount}
        method={method}
        visionUsed={visionUsed}
        confidence={confidence}
        currentData={currentData}
        isMultiDocument={isMultiDocument}
        currentDocIndex={currentDocIndex}
        classification={classification}
        onOpenDD214Analyzer={onOpenDD214Analyzer}
      />

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <ConflictsSection
          conflicts={conflicts}
          onResolve={handleConflictResolve}
        />
      )}
    </>
  );
}

/**
 * Renders the body content of the briefing modal: document info, any
 * detected conflicts, extracted fields, save options, and help text.
 */
function DocumentBriefingBody({
  filename,
  size,
  pageCount,
  method,
  visionUsed,
  confidence,
  currentData,
  isMultiDocument,
  currentDocIndex,
  classification,
  onOpenDD214Analyzer,
  conflicts,
  handleConflictResolve,
  hasFields,
  groupedFields,
  filteredData,
  getTooltip,
  verifiedFields,
  handleFieldCheck,
  handleFieldEdit,
  hasConflict,
  handleFieldDelete,
  handleArrayItemDelete,
  setFilteredData,
  setEditedData,
  setVerifiedFields,
  saveToVKB,
  setSaveToVKB,
  updateProfile,
  setUpdateProfile,
}) {
  return (
    <>
      <DocumentBriefingInfoAndConflicts
        filename={filename}
        size={size}
        pageCount={pageCount}
        method={method}
        visionUsed={visionUsed}
        confidence={confidence}
        currentData={currentData}
        isMultiDocument={isMultiDocument}
        currentDocIndex={currentDocIndex}
        classification={classification}
        onOpenDD214Analyzer={onOpenDD214Analyzer}
        conflicts={conflicts}
        handleConflictResolve={handleConflictResolve}
      />

      {/* Extracted Information */}
      <ExtractedInformationSection
        hasFields={hasFields}
        groupedFields={groupedFields}
        filteredData={filteredData}
        getTooltip={getTooltip}
        verifiedFields={verifiedFields}
        onFieldCheck={handleFieldCheck}
        onFieldEdit={handleFieldEdit}
        hasConflict={hasConflict}
        onFieldDelete={handleFieldDelete}
        onArrayItemDelete={handleArrayItemDelete}
        classification={classification}
        onAddField={addVerifiedField(
          setFilteredData,
          setEditedData,
          setVerifiedFields,
        )}
      />

      <DocumentBriefingOptionsAndHelp
        saveToVKB={saveToVKB}
        setSaveToVKB={setSaveToVKB}
        updateProfile={updateProfile}
        setUpdateProfile={setUpdateProfile}
      />
    </>
  );
}

/**
 * Assembles the ResponsiveModal chrome (header/footer) around the briefing
 * body content.
 */
function DocumentBriefingModal({
  onClose,
  onSkip,
  onOpenDD214Analyzer,
  filename,
  isMultiDocument,
  currentDocIndex,
  totalDocuments,
  currentData,
  goToPrevDocument,
  goToNextDocument,
  handleVerifyAndSave,
  allFieldsVerified,
  hasFields,
  ...bodyProps
}) {
  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      header={
        <DocumentBriefingHeader
          filename={filename}
          isMultiDocument={isMultiDocument}
          currentDocIndex={currentDocIndex}
          totalDocuments={totalDocuments}
          currentData={currentData}
          onClose={onClose}
          onPrev={goToPrevDocument}
          onNext={goToNextDocument}
        />
      }
      footer={
        <DocumentBriefingFooter
          onSkip={onSkip}
          onClose={onClose}
          onVerifyAndSave={handleVerifyAndSave}
          allFieldsVerified={allFieldsVerified}
          hasFields={hasFields}
        />
      }
      labelledBy="doc-intel-briefing-title"
      size="xl"
    >
      <DocumentBriefingBody
        {...bodyProps}
        filename={filename}
        currentData={currentData}
        isMultiDocument={isMultiDocument}
        currentDocIndex={currentDocIndex}
        hasFields={hasFields}
        onOpenDD214Analyzer={onOpenDD214Analyzer}
      />
    </ResponsiveModal>
  );
}

/**
 * Main Document Intelligence Briefing Modal
 */
export default function DocumentIntelligenceBriefing({
  _document,
  extractionResult,
  conflicts: providedConflicts = [],
  onVerify,
  onSkip,
  onClose,
  onOpenDD214Analyzer,
}) {
  const state = useDocumentBriefingController({
    extractionResult,
    providedConflicts,
    onVerify,
  });

  return (
    <DocumentBriefingModal
      {...state}
      onSkip={onSkip}
      onClose={onClose}
      onOpenDD214Analyzer={onOpenDD214Analyzer}
    />
  );
}
