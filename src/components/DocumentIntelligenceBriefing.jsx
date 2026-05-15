/**
 * Vet-Rate.org - Document Intelligence Briefing Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * "SigInt Intelligence Briefing" - Per-document review and verification
 * User verifies extracted data before saving to VKB
 */

import React, { useState, useEffect, useMemo } from "react";
import { getDocumentTypeLabel } from "../utils/documentClassifier";
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
          <div className="space-y-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-900 dark:text-white font-mono">
              {value}
            </span>
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              [Edit]
            </button>
            {/* Delete button - red for danger */}
            {onDelete && (
              <button
                onClick={handleDelete}
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
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
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
  // Track values for each field
  const [fieldValues, setFieldValues] = useState({});

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

  // ALL DD214 fields - Complete box-by-box reference for manual entry
  // Organized by actual DD214 box numbers for easy veteran reference
  const dd214FieldsBySection = [
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

  // Flatten for counting
  const allFields = dd214FieldsBySection.flatMap((s) => s.fields);
  const availableFields = allFields.filter(
    (f) => !existingFields?.includes(f.key),
  );

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
        <div
          className={`mt-3 rounded-lg ${ocrFailed ? "bg-green-50 dark:bg-green-900/20" : "bg-blue-50 dark:bg-blue-900/20"}`}
        >
          {/* Header with Save All button */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Fill in the fields from your DD214. Press Enter or click ✓ to add
              each field.
            </p>
            {filledCount > 0 && (
              <button
                onClick={handleAddAllFilledFields}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
              >
                ✅ Add All {filledCount} Filled Fields
              </button>
            )}
          </div>

          {/* Scrollable field list */}
          <div className="max-h-[60vh] overflow-y-auto p-4">
            {dd214FieldsBySection.map((section) => {
              const sectionFields = section.fields.filter(
                (f) => !existingFields?.includes(f.key),
              );
              if (sectionFields.length === 0) return null;

              return (
                <div key={section.section} className="mb-6">
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
                          onChange={(e) =>
                            handleFieldChange(field.key, e.target.value)
                          }
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleAddField(field.key)
                          }
                          placeholder={field.example}
                          className="flex-1 px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                        />
                        <button
                          onClick={() => handleAddField(field.key)}
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
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Main Document Intelligence Briefing Modal
 */
export default function DocumentIntelligenceBriefing({
  document,
  extractionResult,
  conflicts: providedConflicts = [],
  onVerify,
  onSkip,
  onClose,
  onOpenDD214Analyzer,
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

  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const [verifiedFields, setVerifiedFields] = useState({});
  const [editedData, setEditedData] = useState({});
  const [saveToVKB, setSaveToVKB] = useState(true);
  const [updateProfile, setUpdateProfile] = useState(true);
  const [conflicts, setConflicts] = useState([]);
  const [filteredData, setFilteredData] = useState({});
  const [groupedFields, setGroupedFields] = useState({});

  // Get current document data (either single or from array)
  const currentData = isMultiDocument
    ? documents?.[currentDocIndex]
    : extractedData;

  // Debug logging to trace data flow
  useEffect(() => {
    console.log("🛡️ SigInt Briefing received extractedData:", extractedData);
    console.log("🛡️ SigInt Briefing classification:", classification);
    if (isMultiDocument) {
      console.log(`🛡️ Multiple documents detected: ${totalDocuments} DD214(s)`);
    }
  }, [extractedData, classification, isMultiDocument, totalDocuments]);

  // Detect conflicts on mount and when document changes
  useEffect(() => {
    const loadConflicts = async () => {
      if (currentData && classification?.type) {
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
          // Skip internal/metadata fields
          if (
            [
              "type",
              "raw",
              "error",
              "sourcePages",
              "multiDocument",
              "documentIndex",
              "totalDocuments",
            ].includes(field)
          )
            continue;

          // Include if has value and should be collected
          if (value !== null && value !== undefined && value !== "") {
            if (shouldCollectField(field, classification.type)) {
              filtered[field] = value;
            }
          }
        }

        console.log("🛡️ Filtered fields:", Object.keys(filtered));
        setFilteredData(filtered);

        // Group by category
        const grouped = groupFieldsByCategory(filtered, classification.type);
        console.log("🛡️ Grouped fields:", grouped);
        setGroupedFields(grouped);
      }
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

  const handleFieldCheck = (field, checked) => {
    setVerifiedFields((prev) => ({ ...prev, [field]: checked }));
  };

  const handleFieldEdit = (field, newValue) => {
    setEditedData((prev) => ({ ...prev, [field]: newValue }));
  };

  // Delete a field that was incorrectly extracted by OCR
  const handleFieldDelete = (field) => {
    console.log(`🗑️ Deleting incorrectly extracted field: ${field}`);
    // Remove from filteredData (what's displayed)
    setFilteredData((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
    // Remove from editedData
    setEditedData((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
    // Remove from verifiedFields
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
    console.log(`🗑️ Deleting item ${indexToDelete} from array field: ${field}`);

    setFilteredData((prev) => {
      const currentArray = prev[field];
      if (!Array.isArray(currentArray)) return prev;

      const updatedArray = currentArray.filter(
        (_, idx) => idx !== indexToDelete,
      );

      // If array is now empty, remove the field entirely
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

  const handleConflictResolve = (field, resolution) => {
    const conflict = conflicts.find((c) => c.field === field);
    if (conflict) {
      if (resolution === "existing") {
        setEditedData((prev) => ({ ...prev, [field]: conflict.existing }));
      } else if (resolution === "new") {
        setEditedData((prev) => ({ ...prev, [field]: conflict.newValue }));
      }
    }
  };

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

  const hasConflict = (field) => conflicts.some((c) => c.field === field);
  const getTooltip = (field) => getFieldTooltip(field, classification?.type);

  // Navigation for multiple documents
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-xl z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🛡️</span>
              <div>
                <h2 className="text-2xl font-bold">
                  SigInt Intelligence Briefing{" "}
                  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">
                    BETA
                  </span>
                </h2>
                <p className="text-sm text-indigo-100">
                  Verify extracted information before saving
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-indigo-200 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Multiple Document Navigator */}
          {isMultiDocument && (
            <div className="mt-4 flex items-center justify-between bg-white/10 rounded-lg p-3">
              <button
                onClick={goToPrevDocument}
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
                onClick={goToNextDocument}
                disabled={currentDocIndex === totalDocuments - 1}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Document Info */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
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
                {visionUsed
                  ? "👁️ Vision AI (Florence-2)"
                  : method === "ocr"
                    ? "🔍 OCR Extracted"
                    : method === "advanced_ocr"
                      ? "🔍 Advanced OCR"
                      : method === "vision_florence"
                        ? "👁️ Vision AI"
                        : "📖 Native Text"}
              </span>
              {/* Show confidence if available */}
              {confidence && (
                <span
                  className={`${
                    confidence >= 80
                      ? "text-green-600 dark:text-green-400"
                      : confidence >= 60
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {confidence}% confidence
                </span>
              )}
              {currentData?.sourcePages && (
                <span>📋 Source: Pages {currentData.sourcePages}</span>
              )}
            </div>
          </div>

          {/* Classification */}
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
              {["dd214", "dd215", "ngb22", "dd256", "dd257"].includes(
                classification?.type?.toLowerCase(),
              ) &&
                onOpenDD214Analyzer && (
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
        </div>

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-300 mb-3">
              ⚠️ {conflicts.length} Conflict{conflicts.length !== 1 ? "s" : ""}{" "}
              Detected
            </h3>
            <div className="space-y-3">
              {conflicts.map((conflict, index) => (
                <ConflictWarning
                  key={index}
                  conflict={conflict}
                  onResolve={handleConflictResolve}
                />
              ))}
            </div>
          </div>
        )}

        {/* Extracted Information */}
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Extracted Information (Verify before saving):
          </h3>

          {/* Show apologetic message when OCR fails */}
          {(!filteredData || Object.keys(filteredData).length === 0) && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-6 text-center mb-6">
              {/* Apologetic Header */}
              <div className="text-4xl mb-3">😔</div>
              <h4 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-3">
                We're Sorry - We Couldn't Read This DD214
              </h4>

              {/* Empathetic Explanation */}
              <div className="text-sm text-amber-700 dark:text-amber-400 space-y-2 mb-4 max-w-lg mx-auto">
                <p>
                  Many older DD214s (especially those from the typewriter era or
                  documents that have been copied multiple times) are simply too
                  faded or degraded for our OCR technology to read reliably.
                </p>
                <p className="font-medium">
                  This is <strong>not your fault</strong> - it's a limitation of
                  working with aged documents.
                </p>
              </div>

              {/* What to Do Section */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mt-4 border border-amber-200 dark:border-amber-800">
                <h5 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                  <span>📝</span> What You Can Do
                </h5>
                <ul className="text-sm text-gray-600 dark:text-gray-400 text-left space-y-2 max-w-md mx-auto">
                  <li className="flex gap-2">
                    <span className="text-green-600 dark:text-green-400">
                      ✓
                    </span>
                    <span>
                      <strong>Manual Entry:</strong> Use the "Enter DD214 Fields
                      Manually" panel below to enter your information by hand.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600 dark:text-green-400">
                      ✓
                    </span>
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
                    <span className="text-green-600 dark:text-green-400">
                      ✓
                    </span>
                    <span>
                      <strong>Better Scan:</strong> If possible, try scanning
                      your original at 300+ DPI in grayscale.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Raw Text Note */}
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-4 italic">
                💾 The raw text (whatever we could capture) has been saved to
                your Veteran Knowledge Base for reference.
              </p>
            </div>
          )}

          {/* Show extracted fields when OCR succeeded */}
          {filteredData && Object.keys(filteredData).length > 0 && (
            <div className="space-y-6 mb-6">
              {/* Group fields by category */}
              {Object.entries(groupedFields).map(([category, fields]) => (
                <div key={category}>
                  <h4 className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {category} Information
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(fields).map(([key, value]) => {
                      if (
                        !value ||
                        (Array.isArray(value) && value.length === 0)
                      )
                        return null;

                      // Handle arrays (like awards, deployments)
                      if (Array.isArray(value)) {
                        // Format array items for display
                        const formatItem = (item) => {
                          if (typeof item === "string") return item;
                          // Handle award objects from parseDD214Text
                          if (item?.award?.name) {
                            const name = item.award.name;
                            const qty =
                              item.quantity > 1
                                ? ` (${item.quantity}${item.quantity > 1 ? "x" : ""})`
                                : "";
                            const devices =
                              item.devices?.length > 0
                                ? ` w/ ${item.devices.map((d) => d.type.replace("_", " ")).join(", ")}`
                                : "";
                            return `${name}${qty}${devices}`;
                          }
                          // Handle other objects
                          if (typeof item === "object") {
                            return (
                              item.name ||
                              item.title ||
                              item.value ||
                              JSON.stringify(item)
                            );
                          }
                          return String(item);
                        };

                        // Check if this is an awards array with award objects
                        const isAwardsArray =
                          key.toLowerCase() === "awards" &&
                          value.some(
                            (item) => item?.award?.name || item?.awardId,
                          );

                        // Prepare visual awards for RibbonRackDisplay
                        const visualAwards = isAwardsArray
                          ? value
                              .filter((item) => item?.award || item?.awardId)
                              .map((item) => ({
                                awardId: item.awardId || item.award?.id,
                                award: item.award || {
                                  id: item.awardId,
                                  name: item.matchedText,
                                },
                                devices: item.devices || [],
                              }))
                          : [];

                        // Sort by precedence for proper military display
                        const sortedVisualAwards =
                          visualAwards.length > 0
                            ? sortRibbonsByPrecedence(
                                visualAwards,
                                filteredData?.branch || "Army",
                              )
                            : [];

                        // Parse badges from awards text
                        const awardsText = value
                          .map(
                            (item) =>
                              item?.matchedText ||
                              item?.award?.name ||
                              String(item),
                          )
                          .join("\n");
                        const { badges, tabs, combatIndicators } =
                          parseDD214Badges(
                            awardsText,
                            filteredData?.branch?.replace(/\/.*$/, "") ||
                              "Army",
                          );

                        return (
                          <div
                            key={key}
                            className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                          >
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                              {key.charAt(0).toUpperCase() +
                                key.slice(1).replace(/([A-Z])/g, " $1")}
                              {getTooltip(key) && (
                                <span
                                  className="ml-2 text-xs text-gray-500 dark:text-gray-400 cursor-help"
                                  aria-label={getTooltip(key)}
                                >
                                  💡
                                </span>
                              )}
                            </label>

                            {/* Combat Indicator Alert */}
                            {combatIndicators.length > 0 && (
                              <CombatIndicatorSummary
                                badges={badges.filter((b) => b.combatIndicator)}
                                ribbonAwards={value}
                              />
                            )}

                            {/* Badges Display (above ribbons) */}
                            {badges.length > 0 && (
                              <div className="mb-4">
                                <BadgeDisplay
                                  badges={badges}
                                  tabs={tabs}
                                  branch={
                                    filteredData?.branch?.replace(
                                      /\/.*$/,
                                      "",
                                    ) || "Army"
                                  }
                                  size="sm"
                                  showLabels={true}
                                />
                              </div>
                            )}

                            {/* Visual Ribbon Rack for awards */}
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

                            {/* Text list of awards with delete buttons */}
                            <ul className="space-y-1 text-sm">
                              {value.map((item, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-center justify-between group text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 -mx-2"
                                >
                                  <span>• {formatItem(item)}</span>
                                  <button
                                    onClick={() =>
                                      handleArrayItemDelete(key, idx)
                                    }
                                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity text-xs ml-2"
                                    aria-label="Remove this item (OCR error?)"
                                  >
                                    🗑️
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
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
                          onCheckChange={(checked) =>
                            handleFieldCheck(key, checked)
                          }
                          onChange={(newValue) =>
                            handleFieldEdit(key, newValue)
                          }
                          hasConflict={hasConflict(key)}
                          onDelete={() => handleFieldDelete(key)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ALWAYS show Add Missing Field panel - auto-expand when OCR failed */}
          <AddMissingFieldPanel
            classification={classification?.type}
            onAddField={(field, value) => {
              setFilteredData((prev) => ({ ...prev, [field]: value }));
              setEditedData((prev) => ({ ...prev, [field]: value }));
              setVerifiedFields((prev) => ({ ...prev, [field]: true }));
            }}
            existingFields={Object.keys(filteredData)}
            autoExpand={!filteredData || Object.keys(filteredData).length === 0}
          />
        </div>

        {/* Options */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
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

        {/* Actions */}
        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-b-xl flex items-center justify-between">
          <button
            onClick={onSkip}
            className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
          >
            ⏭️ Skip This Document
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors"
            >
              ← Back to Formation
            </button>

            <button
              onClick={handleVerifyAndSave}
              disabled={
                !allFieldsVerified && Object.keys(filteredData).length > 0
              }
              className={`px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                allFieldsVerified || Object.keys(filteredData).length === 0
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              }`}
            >
              ✅ Verify & Save
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="px-6 pb-6 text-xs text-gray-500 dark:text-gray-400 italic">
          💡 Review each field carefully. Check the boxes to verify accuracy,
          click [Edit] to correct mistakes, or click 🗑️ to delete incorrect OCR
          extractions. Only verified fields will be saved to your profile.
        </div>
      </div>
    </div>
  );
}
