/**
 * Vet-Rate.org - Profile Import Confirmation Modal
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Shows extracted DD214/PDF data before auto-filling Veteran Profile
 * Prevents accidental overwriting of existing information
 */

import { useState, useEffect } from "react";
import ResponsiveModal from "./common/ResponsiveModal";
import { isSameCalendarDay } from "../utils/serviceEntryDate";
import {
  VALUE_SOURCE,
  countBySource,
  describeSourceCounts,
} from "../utils/dd214ValueSources";
import {
  MODEL_LIST_FIELDS,
  MODEL_TEXT_FIELDS,
} from "../utils/dd214ModelOutputGuards";

// Field labels for display
const fieldLabels = {
  // Personal Information (Blocks 1-7)
  firstName: "First Name",
  middleInitial: "Middle Initial",
  middleName: "Middle Name",
  lastName: "Last Name",
  fullName: "Full Name",
  dob: "Date of Birth",
  dateOfBirth: "Date of Birth",
  ssnLast4: "SSN (Last 4)",
  ssnFull: "SSN (Full)",
  serviceNumber: "Service Number",
  vaFileNumber: "VA File Number",
  placeOfBirth: "Place of Birth",
  homeOfRecord: "Home of Record",

  // Service Information (Blocks 2, 4a-4c, 17)
  branch: "Branch of Service",
  component: "Component",
  componentFull: "Component (Full Name)",
  rank: "Rank",
  payGrade: "Pay Grade",
  dateOfRank: "Date of Rank",

  // MOS & Assignments (Blocks 4b, 8, 9, 11)
  mos: "MOS/Rating",
  mosTitle: "MOS Title",
  primarySpecialty: "Primary Specialty",
  lastDutyAssignment: "Last Duty Assignment",
  commandTransferredTo: "Command Transferred To",

  // Service Dates (Blocks 12a-12e)
  serviceStartDate: "Service Start Date",
  entryDate: "Entry Date",
  serviceEndDate: "Separation Date",
  separationDate: "Separation Date",
  netActiveService: "Net Active Service",
  totalPriorActiveService: "Total Prior Active Service",
  totalPriorInactiveService: "Total Prior Inactive Service",
  yearsService: "Years of Service",
  monthsService: "Months of Service",
  daysService: "Days of Service",
  totalActiveDutyDays: "Total Active Duty Days",

  // Benefits & Obligations (Blocks 10, 26-29)
  sglCoverage: "SGLI Coverage",
  giBlStatus: "Post-9/11 GI Bill Status",
  reserveObligationDate: "Reserve Obligation End Date",
  daysLost: "Days Lost",
  foreignService: "Foreign Service",
  foreignServiceDetails: "Foreign Service Details",
  seaService: "Sea Service",

  // Separation Info (Blocks 19-25)
  separationAuthority: "Separation Authority",
  separationCode: "Separation Code (SPD/SPN)",
  reentryCode: "Reentry Code (RE)",
  separationProgramDesignator: "Separation Program Designator",
  separationType: "Type of Separation",
  characterOfService: "Character of Service",
  narrativeReason: "Narrative Reason for Separation",

  // Education & Training (Blocks 14, 15)
  militaryEducation: "Military Education",
  memberRequests: "Member Requests",

  // Contact (Block 30)
  homeAddress: "Home Address at Separation",
  email: "Email",
  phone: "Phone",
  alternatePhone: "Alternate Phone",
  street: "Street Address",
  city: "City",
  state: "State",
  zip: "ZIP Code",

  // Combat & Qualifications
  specialQualifications: "Special Qualifications",
  awards: "Awards and Decorations",
  combatService: "Combat Service Details",
  securityClearance: "Security Clearance",

  // Legacy
  reenlisted: "Re-enlisted",
};

const PERSONAL_FIELDS = new Set([
  "firstName",
  "middleInitial",
  "middleName",
  "lastName",
  "fullName",
  "dob",
  "dateOfBirth",
  "ssnLast4",
  "ssnFull",
  "serviceNumber",
  "vaFileNumber",
  "placeOfBirth",
  "homeOfRecord",
]);

const SERVICE_FIELDS = new Set([
  "branch",
  "component",
  "componentFull",
  "rank",
  "payGrade",
  "dateOfRank",
  "mos",
  "mosTitle",
  "primarySpecialty",
  "lastDutyAssignment",
  "commandTransferredTo",
  "serviceStartDate",
  "entryDate",
  "serviceEndDate",
  "separationDate",
  "netActiveService",
  "totalPriorActiveService",
  "totalPriorInactiveService",
  "yearsService",
  "monthsService",
  "daysService",
  "totalActiveDutyDays",
  "sglCoverage",
  "giBlStatus",
  "reserveObligationDate",
  "daysLost",
  "foreignService",
  "foreignServiceDetails",
  "seaService",
  "separationAuthority",
  "separationCode",
  "reentryCode",
  "separationProgramDesignator",
  "separationType",
  "characterOfService",
  "narrativeReason",
  "militaryEducation",
  "memberRequests",
  "specialQualifications",
  "awards",
  "combatService",
  "securityClearance",
  "reenlisted",
]);

const CONTACT_FIELDS = new Set([
  "homeAddress",
  "email",
  "phone",
  "alternatePhone",
  "street",
  "city",
  "state",
  "zip",
]);

const CATEGORY_SECTIONS = [
  { key: "personal", icon: "👤", title: "Personal Information" },
  { key: "service", icon: "🎖️", title: "Service Information" },
  { key: "contact", icon: "📞", title: "Contact Information" },
  { key: "other", icon: "📝", title: "Other Information" },
];

/**
 * Get field label
 */
const getFieldLabel = (field) => {
  return fieldLabels[field] || field.replace(/([A-Z])/g, " $1").trim();
};

/**
 * Format field value for display
 */
const formatFieldValue = (field, value) => {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  // Handle service time objects
  if (typeof value === "object" && value.years !== undefined) {
    const years = value.years || 0;
    const months = value.months || 0;
    const days = value.days || 0;
    return `${years}y ${months}m ${days}d`;
  }

  // Handle arrays (like militaryEducation)
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "(none)";
  }

  return String(value);
};

/**
 * Categorize fields
 */
const categorizeFields = (editableData) => {
  const categories = {
    personal: [],
    service: [],
    contact: [],
    other: [],
  };

  Object.keys(editableData).forEach((field) => {
    if (PERSONAL_FIELDS.has(field)) {
      categories.personal.push(field);
    } else if (SERVICE_FIELDS.has(field)) {
      categories.service.push(field);
    } else if (CONTACT_FIELDS.has(field)) {
      categories.contact.push(field);
    } else {
      categories.other.push(field);
    }
  });

  return categories;
};

/**
 * Simplified value formatter used for row-level "has this changed" detection
 */
const formatSimpleFieldValue = (value) => {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

// Owner decision (F): nothing identifier-related is ever pre-selected for
// import. The veteran ticks the box deliberately. Text a model writes counts:
// a name the app has never seen cannot be recognised in it.
const NEVER_PRESELECTED_FIELDS = new Set([
  ...MODEL_TEXT_FIELDS,
  ...MODEL_LIST_FIELDS,
  "fullName",
  "firstName",
  "middleName",
  "lastName",
  "ssnLast4",
  "ssnFull",
  "dateOfBirth",
  "dob",
  "serviceNumber",
  "homeOfRecord",
  "homeAddress",
  "placeOfBirth",
  "email",
  "phone",
  "alternatePhone",
  "nextOfKin",
  "nearestRelative",
  "signature",
]);

// Owner decision (G), 2026-10-03 (ADR-009): a row is pre-ticked only when its
// value came from the app's own parser. A value the AI read, one typed by the
// veteran, or one with no known source is offered unticked.
const useEditableProfileData = (
  extractedData,
  currentProfile,
  fieldSources,
) => {
  const [editableData, setEditableData] = useState({});
  const [selectedFields, setSelectedFields] = useState({});

  // Initialize with extracted data
  useEffect(() => {
    if (extractedData) {
      setEditableData({ ...extractedData });

      // Auto-select parser-read fields that are new or different
      const autoSelected = {};
      Object.keys(extractedData).forEach((key) => {
        if (NEVER_PRESELECTED_FIELDS.has(key)) return;
        if (fieldSources?.[key] !== VALUE_SOURCE.PARSER) return;
        // Select if current profile doesn't have this field, or if values differ
        if (
          !currentProfile[key] ||
          currentProfile[key] !== extractedData[key]
        ) {
          autoSelected[key] = true;
        }
      });
      setSelectedFields(autoSelected);
    }
  }, [extractedData, currentProfile, fieldSources]);

  return { editableData, setEditableData, selectedFields, setSelectedFields };
};

const FIELD_BOX_CLASS =
  "w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white disabled:opacity-50";

// A service time or other structured value is shown read-only; a yes/no is a
// select; everything else is a text box that can be corrected once ticked.
const ImportedValueField = ({
  label,
  importedValue,
  isSelected,
  isBooleanField,
  onChange,
}) => {
  if (typeof importedValue === "object" && importedValue !== null) {
    return (
      <div
        aria-label={`${label} (read from the document)`}
        className="px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 break-words"
      >
        {formatFieldValue(label, importedValue)}
      </div>
    );
  }
  if (isBooleanField) {
    return (
      <select
        value={importedValue ? "true" : "false"}
        onChange={(e) => onChange(e.target.value === "true")}
        disabled={!isSelected}
        className={FIELD_BOX_CLASS}
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  return (
    <input
      type="text"
      value={importedValue || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={!isSelected}
      className={FIELD_BOX_CLASS}
    />
  );
};

/**
 * Value Comparison - current value display + editable imported value
 */
const FieldValueComparison = ({
  label,
  currentValue,
  importedValue,
  isSelected,
  isBooleanField,
  onChange,
}) => (
  <div className="grid grid-cols-2 gap-3 text-sm">
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        Current Value:
      </div>
      <div className="px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 break-words">
        {currentValue}
      </div>
    </div>
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        Imported Value:
      </div>
      <ImportedValueField
        label={label}
        importedValue={importedValue}
        isSelected={isSelected}
        isBooleanField={isBooleanField}
        onChange={onChange}
      />
    </div>
  </div>
);

function countRowSources(editableData, fieldSources) {
  const rows = Object.keys(editableData).filter(
    (field) => fieldSources?.[field],
  );
  return countBySource(
    Object.fromEntries(rows.map((field) => [field, fieldSources[field]])),
  );
}

const SOURCE_NOTES = {
  [VALUE_SOURCE.PARSER]: {
    text: "Read from your document by the app's own parser.",
    className: "text-green-700 dark:text-green-300",
  },
  [VALUE_SOURCE.PARSER_CHECK]: {
    text: "Read by the app's own parser, but not from its own printed box, or the rest of the page does not agree with it. Check this against your document before you tick it.",
    className: "text-amber-700 dark:text-amber-300",
  },
  [VALUE_SOURCE.MODEL]: {
    text: "Read by the AI. Check it against your document before you tick it.",
    className: "text-amber-700 dark:text-amber-300",
  },
  [VALUE_SOURCE.VETERAN]: {
    text: "Typed by you.",
    className: "text-gray-600 dark:text-gray-300",
  },
};

const SourceNote = ({ source }) => {
  const note = SOURCE_NOTES[source];
  if (!note) return null;
  return (
    <p
      className={`text-xs mb-2 ${note.className}`}
      data-source={source}
      data-testid="import-row-source"
    >
      {note.text}
    </p>
  );
};

/**
 * Field Row Component - Shows current vs imported value with checkbox
 */
const FieldRow = ({
  label,
  source,
  currentValue,
  importedValue,
  isSelected,
  onToggle,
  onChange,
}) => {
  const hasChange =
    currentValue !== formatSimpleFieldValue(importedValue) &&
    currentValue !== "(empty)";
  const isBooleanField = typeof importedValue === "boolean";

  return (
    <div
      className={`p-3 rounded-lg border ${
        isSelected
          ? "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      } transition-all`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className="pt-1">
          <input
            type="checkbox"
            checked={isSelected === true}
            onChange={onToggle}
            aria-label={label}
            className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        {/* Field Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <label className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {label}
              {hasChange && (
                <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded">
                  Changed
                </span>
              )}
            </label>
          </div>

          <SourceNote source={source} />
          <FieldValueComparison
            label={label}
            currentValue={currentValue}
            importedValue={importedValue}
            isSelected={isSelected}
            isBooleanField={isBooleanField}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Renders one field category section (Personal / Service / Contact / Other)
 */
const FieldCategorySection = ({
  icon,
  title,
  fields,
  currentProfile,
  editableData,
  selectedFields,
  fieldSources,
  onToggle,
  onChange,
}) => {
  if (fields.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        {icon} {title}
      </h3>
      <div className="space-y-3">
        {fields.map((field) => (
          <FieldRow
            key={field}
            label={getFieldLabel(field)}
            source={fieldSources?.[field]}
            currentValue={formatFieldValue(field, currentProfile[field])}
            importedValue={editableData[field]}
            isSelected={selectedFields[field]}
            onToggle={() => onToggle(field)}
            onChange={(value) => onChange(field, value)}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Selection Controls - selected/total count + select all/none actions
 */
const SelectionControls = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onSelectNone,
}) => (
  <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
    <div className="text-sm text-gray-600 dark:text-gray-400">
      <strong className="text-gray-900 dark:text-white">{selectedCount}</strong>{" "}
      of <strong className="text-gray-900 dark:text-white">{totalCount}</strong>{" "}
      fields selected for import
    </div>
    <div className="flex gap-2">
      <button
        onClick={onSelectAll}
        className="px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/70 rounded transition-colors"
      >
        ✓ Select All
      </button>
      <button
        onClick={onSelectNone}
        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500 rounded transition-colors"
      >
        ✗ Select None
      </button>
    </div>
  </div>
);

/**
 * Modal header: title/close, warning banner, selection controls
 */
const ImportHeader = ({
  onCancel,
  selectedCount,
  totalCount,
  sourceCounts,
  onSelectAll,
  onSelectNone,
}) => (
  <>
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div>
        <h2
          id="profile-import-title"
          className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"
        >
          📋 Review Imported Profile Data
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Review and edit information before saving to your Veteran Profile
        </p>
      </div>
      <button
        onClick={onCancel}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        aria-label="Close"
      >
        <svg
          className="w-6 h-6 text-gray-500"
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

    {/* Warning Banner */}
    <div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
      <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
        <span className="text-lg">⚠️</span>
        <span>
          <strong>Important:</strong> Review the extracted information below.
          Only values the app&apos;s own parser read from your document are
          pre-selected, and only when they differ from what is already in your
          profile. Anything the AI read is left unticked: check it against your
          document, then tick it if it is right.
        </span>
      </p>
      <p
        className="text-sm text-yellow-800 dark:text-yellow-200 mt-2"
        data-testid="import-source-counts"
      >
        {describeSourceCounts(sourceCounts)}.
      </p>
    </div>

    <SelectionControls
      selectedCount={selectedCount}
      totalCount={totalCount}
      onSelectAll={onSelectAll}
      onSelectNone={onSelectNone}
    />
  </>
);

/**
 * Modal footer: cancel + confirm import actions
 */
const ImportFooter = ({ onCancel, selectedCount, onConfirm }) => (
  <div className="flex items-center justify-between gap-4">
    <button
      onClick={onCancel}
      className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors"
    >
      ✗ Cancel Import
    </button>
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {selectedCount === 0 ? (
          <span className="text-red-600 dark:text-red-400 font-semibold">
            ⚠️ No fields selected
          </span>
        ) : (
          <span>
            Ready to import {selectedCount} field
            {selectedCount !== 1 ? "s" : ""}
          </span>
        )}
      </span>
      <button
        onClick={onConfirm}
        disabled={selectedCount === 0}
        className={`px-6 py-2.5 font-semibold rounded-lg transition-colors ${
          selectedCount === 0
            ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed"
            : "bg-indigo-600 hover:bg-indigo-700 text-white"
        }`}
      >
        ✓ Import Selected Fields
      </button>
    </div>
  </div>
);

// A plain truthiness check dropped an explicit `false` (e.g.
// DD214Analyzer.jsx's serviceStartDateDerived: false, clearing a stale
// calculated flag on import) as if the field had never been extracted at
// all - only null/undefined/"" mean that.
function _hasImportableValue(value) {
  return value !== null && value !== undefined && value !== "";
}

// ADR-007 W10/W9: serviceStartDateEdited is distinct from merely selecting
// the field - a genuine typed edit is the only thing that may correct the
// canonical period's start date; an unedited, selected extraction never
// should.
function _buildProfileImportConfirmPayload(
  selectedFields,
  editableData,
  extractedData,
) {
  const fieldsToImport = {};
  Object.keys(selectedFields).forEach((key) => {
    const value = editableData[key];
    if (selectedFields[key] && _hasImportableValue(value)) {
      fieldsToImport[key] = value;
    }
  });
  const serviceStartDateEdited =
    !!selectedFields.serviceStartDate &&
    !isSameCalendarDay(
      editableData.serviceStartDate,
      extractedData?.serviceStartDate,
    );
  return { fieldsToImport, meta: { serviceStartDateEdited } };
}

const CategorySections = ({ categories, ...sectionProps }) =>
  CATEGORY_SECTIONS.map(({ key, icon, title }) => (
    <FieldCategorySection
      key={key}
      icon={icon}
      title={title}
      fields={categories[key]}
      {...sectionProps}
    />
  ));

/**
 * Profile Import Confirmation Modal
 * Shows extracted data with side-by-side comparison and selective import
 */
const ProfileImportConfirmModal = ({
  extractedData,
  fieldSources,
  currentProfile,
  onConfirm,
  onCancel,
}) => {
  const { editableData, setEditableData, selectedFields, setSelectedFields } =
    useEditableProfileData(extractedData, currentProfile, fieldSources);

  const handleFieldChange = (field, value) => {
    setEditableData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFieldToggle = (field) => {
    setSelectedFields((prev) => ({
      ...prev,
      [field]: prev[field] === true ? false : true,
    }));
  };

  const handleSelectAll = () => {
    const allSelected = {};
    Object.keys(editableData).forEach((key) => {
      allSelected[key] = true;
    });
    setSelectedFields(allSelected);
  };

  const handleSelectNone = () => {
    setSelectedFields({});
  };

  const handleConfirm = () => {
    const { fieldsToImport, meta } = _buildProfileImportConfirmPayload(
      selectedFields,
      editableData,
      extractedData,
    );
    if (Object.keys(fieldsToImport).length === 0) return;
    onConfirm(fieldsToImport, meta);
  };

  const categories = categorizeFields(editableData);
  const selectedCount = Object.values(selectedFields).filter(Boolean).length;
  const totalCount = Object.keys(editableData).length;
  const sourceCounts = countRowSources(editableData, fieldSources);

  return (
    <ResponsiveModal
      isOpen
      onClose={onCancel}
      size="2xl"
      zIndex={9999}
      labelledBy="profile-import-title"
      footer={
        <ImportFooter
          onCancel={onCancel}
          selectedCount={selectedCount}
          onConfirm={handleConfirm}
        />
      }
      header={
        <ImportHeader
          onCancel={onCancel}
          selectedCount={selectedCount}
          totalCount={totalCount}
          sourceCounts={sourceCounts}
          onSelectAll={handleSelectAll}
          onSelectNone={handleSelectNone}
        />
      }
    >
      <CategorySections
        categories={categories}
        currentProfile={currentProfile}
        editableData={editableData}
        selectedFields={selectedFields}
        fieldSources={fieldSources}
        onToggle={handleFieldToggle}
        onChange={handleFieldChange}
      />
    </ResponsiveModal>
  );
};

export default ProfileImportConfirmModal;
