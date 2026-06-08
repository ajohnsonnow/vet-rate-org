/**
 * Vet-Rate.org - FOIA Request Generator (The Keysmith)
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * "The Keysmith" - Your FOIA/C-File Request Generator
 * Generates pre-filled VA Form 20-10206 for requesting records
 *
 * What This Does:
 * - Auto-fills VA Form 20-10206 (Freedom of Information/Privacy Act Request)
 * - Pre-checks common record types veterans need
 * - Explains what each record type contains and why it's valuable
 * - Creates downloadable request ready for QuickSubmit
 */

import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";
import BuyMeCoffee from "./BuyMeCoffee";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import jsPDF from "jspdf";
import ReportBugLink from "./ReportBugLink";

/**
 * Record types available for FOIA request
 */
const RECORD_TYPES = [
  {
    id: "cfile",
    name: "Complete C-File (Claims File)",
    description:
      "Your entire VA claims history including all decisions, medical exams, and evidence",
    icon: "📁",
    category: "Essential",
    formBox: "11.A",
    tips: [
      "Contains EVERY document VA used to make decisions on your claims",
      'Includes any "Deferred" ratings they never followed up on',
      "Shows what evidence they DID and DID NOT consider",
      "Reveals any errors in their review process",
    ],
  },
  {
    id: "rating_decisions",
    name: "All Rating Decisions",
    description: "Every formal rating decision issued on your claims",
    icon: "📋",
    category: "Essential",
    formBox: "11.A",
    tips: [
      "Shows the exact reasoning for each rating percentage",
      "May reveal inconsistencies you can challenge",
      'Includes "code sheets" showing diagnostic codes used',
    ],
  },
  {
    id: "strs",
    name: "Service Treatment Records (STRs)",
    description: "All medical records from your time in service",
    icon: "🏥",
    category: "Essential",
    formBox: "11.B",
    tips: [
      "Foundation for proving conditions started in service",
      "Request from NPRC if VA doesn't have them",
      "May contain records you never knew existed",
    ],
  },
  {
    id: "service_personnel",
    name: "Official Military Personnel File (OMPF)",
    description:
      "Your complete service record including assignments, deployments, and awards",
    icon: "🎖️",
    category: "Essential",
    formBox: "11.B",
    tips: [
      "Proves deployment locations for toxic exposure claims",
      "Shows unit assignments for combat/hazard duty",
      "Documents MOS/job duties for occupational claims",
    ],
  },
  {
    id: "vamc_records",
    name: "VA Medical Center Records",
    description: "All treatment records from VA healthcare facilities",
    icon: "🏨",
    category: "Medical",
    formBox: "11.A",
    tips: [
      "May contain diagnoses not yet claimed",
      "Shows continuity of treatment (important for ratings)",
      "Includes progress notes with severity details",
    ],
  },
  {
    id: "cp_exams",
    name: "C&P Exam Reports",
    description: "All Compensation & Pension examination reports",
    icon: "🔬",
    category: "Essential",
    formBox: "11.A",
    tips: [
      "Shows exactly what examiner recorded about your conditions",
      "Compare to see if examiner followed M21-1 guidelines",
      "May contain positive findings VA ignored",
    ],
  },
  {
    id: "dbqs",
    name: "Disability Benefits Questionnaires (DBQs)",
    description: "Standardized medical assessments for specific conditions",
    icon: "📝",
    category: "Medical",
    formBox: "11.A",
    tips: [
      "Used to determine your rating percentage",
      "Shows range of motion, frequency of symptoms",
      "Can compare to current condition for increase",
    ],
  },
  {
    id: "nexus_letters",
    name: "All Nexus Letters & Medical Opinions",
    description: "Medical opinions linking conditions to service",
    icon: "🔗",
    category: "Medical",
    formBox: "11.A",
    tips: [
      "See what opinions VA received (and may have ignored)",
      "Compare competing medical opinions",
      "Identify if you need a stronger nexus",
    ],
  },
  {
    id: "award_letters",
    name: "Award/Notification Letters",
    description: "All letters sent regarding benefits decisions",
    icon: "✉️",
    category: "Administrative",
    formBox: "11.A",
    tips: [
      "Confirms effective dates of all ratings",
      "Shows any benefits you may have missed",
      "Documents what VA told you vs. what they decided",
    ],
  },
  {
    id: "duty_to_assist",
    name: "Duty to Assist Documentation",
    description: "Records of VA's efforts to obtain evidence on your behalf",
    icon: "📬",
    category: "Administrative",
    formBox: "11.A",
    tips: [
      "Shows if VA properly tried to get your records",
      "Can reveal duty-to-assist failures (grounds for appeal)",
      "Documents any negative responses from record sources",
    ],
  },
];

/**
 * Generate the FOIA request text
 */
const generateRequestText = (formData, selectedRecords) => {
  const selectedRecordsList = selectedRecords
    .map((id) => RECORD_TYPES.find((r) => r.id === id))
    .filter(Boolean);

  let text = `FREEDOM OF INFORMATION ACT / PRIVACY ACT REQUEST\n`;
  text += `VA Form 20-10206 Companion Document\n`;
  text += `${"=".repeat(60)}\n\n`;

  text += `SECTION 1: REQUESTER INFORMATION\n`;
  text += `-`.repeat(40) + "\n";
  text += `Name: ${formData.firstName} ${formData.lastName}\n`;
  text += `SSN (last 4): XXX-XX-${formData.ssn}\n`;
  text += `Date of Birth: ${formData.dob}\n`;
  text += `VA File Number: ${formData.vaFileNumber || "Same as SSN"}\n`;
  text += `\n`;
  text += `Mailing Address:\n`;
  text += `${formData.address}\n`;
  text += `${formData.city}, ${formData.state} ${formData.zip}\n`;
  text += `\n`;
  text += `Phone: ${formData.phone}\n`;
  text += `Email: ${formData.email}\n`;
  text += `\n\n`;

  text += `SECTION 2: RECORDS REQUESTED\n`;
  text += `-`.repeat(40) + "\n";
  text += `Pursuant to the Freedom of Information Act (5 U.S.C. § 552) and the Privacy Act (5 U.S.C. § 552a), `;
  text += `I hereby request copies of the following records:\n\n`;

  selectedRecordsList.forEach((record, i) => {
    text += `${i + 1}. ${record.name}\n`;
    text += `   ${record.description}\n\n`;
  });

  text += `\nSECTION 3: TIME PERIOD\n`;
  text += `-`.repeat(40) + "\n";
  if (formData.dateRange === "all") {
    text += `ALL records from my entire period of service and VA claims history.\n`;
  } else {
    text += `Records from ${formData.startDate} to ${formData.endDate}.\n`;
  }
  text += `\n\n`;

  text += `SECTION 4: DELIVERY PREFERENCE\n`;
  text += `-`.repeat(40) + "\n";
  text += `Preferred Format: ${formData.deliveryFormat}\n`;
  if (formData.deliveryFormat === "Electronic") {
    text += `Please send electronic copies to: ${formData.email}\n`;
  } else {
    text += `Please mail physical copies to the address above.\n`;
  }
  text += `\n\n`;

  text += `SECTION 5: FEE WAIVER REQUEST\n`;
  text += `-`.repeat(40) + "\n";
  text += `I request a waiver of all fees associated with this request. As a veteran requesting `;
  text += `my own records for the purpose of understanding and managing my VA benefits, disclosure `;
  text += `of this information is in the public interest and is likely to contribute significantly `;
  text += `to public understanding of government operations.\n\n`;

  text += `Furthermore, under 38 CFR § 1.555, veterans are entitled to one free copy of their claims file.\n`;
  text += `\n\n`;

  text += `SECTION 6: CERTIFICATION\n`;
  text += `-`.repeat(40) + "\n";
  text += `I certify that I am the individual whose records are being requested, or that I am `;
  text += `the authorized representative of said individual. I understand that knowingly and `;
  text += `willfully seeking or obtaining access to records about another individual under `;
  text += `false pretenses is a criminal offense.\n\n`;

  text += `Signature: _____________________________\n`;
  text += `Date: ${new Date().toLocaleDateString()}\n`;
  text += `\n\n`;

  text += `${"=".repeat(60)}\n`;
  text += `WHERE TO SEND THIS REQUEST:\n\n`;
  text += `Option 1 - VA Regional Office (for C-File/Claims Records):\n`;
  text += `Submit via VA QuickSubmit at https://www.va.gov/documentation\n`;
  text += `Or mail to your Regional Office FOIA Officer\n\n`;

  text += `Option 2 - National Personnel Records Center (for Service Records):\n`;
  text += `National Personnel Records Center\n`;
  text += `1 Archives Drive\n`;
  text += `St. Louis, MO 63138\n`;
  text += `Or submit online at: https://www.archives.gov/veterans/military-service-records\n\n`;

  text += `Option 3 - VA FOIA Service (General):\n`;
  text += `Department of Veterans Affairs\n`;
  text += `FOIA Service (005R1C)\n`;
  text += `810 Vermont Avenue, NW\n`;
  text += `Washington, DC 20420\n`;

  return text;
};

export default function FOIAGenerator({ onClose, onReportBug }) {
  // eslint-disable-next-line no-unused-vars
  const { t } = useLanguage();

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    ssn: "",
    dob: "",
    vaFileNumber: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
    dateRange: "all",
    startDate: "",
    endDate: "",
    deliveryFormat: "Electronic",
  });

  // Record selection
  const [selectedRecords, setSelectedRecords] = useState([
    "cfile",
    "rating_decisions",
    "cp_exams",
  ]);

  // Wizard state
  const [step, setStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);

  // Update form field
  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Toggle record selection
  const toggleRecord = (id) => {
    setSelectedRecords((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  // Select all essential records
  const selectEssential = () => {
    const essentialIds = RECORD_TYPES.filter(
      (r) => r.category === "Essential",
    ).map((r) => r.id);
    setSelectedRecords((prev) => [...new Set([...prev, ...essentialIds])]);
  };

  // Select all records
  const selectAll = () => {
    setSelectedRecords(RECORD_TYPES.map((r) => r.id));
  };

  // Clear all records
  const clearAll = () => {
    setSelectedRecords([]);
  };

  /**
   * Download as PDF
   */
  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("FOIA/Privacy Act Request", pageWidth / 2, 20, {
      align: "center",
    });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const text = generateRequestText(formData, selectedRecords);
    const lines = doc.splitTextToSize(text, maxWidth);
    let yPosition = 35;

    lines.forEach((line) => {
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, margin, yPosition);
      yPosition += 5;
    });

    doc.save("FOIA_Request_VA_Form_20-10206.pdf");
  };

  /**
   * Download as DOCX
   */
  const downloadDOCX = async () => {
    const text = generateRequestText(formData, selectedRecords);

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "FOIA/Privacy Act Request",
                  bold: true,
                  size: 28,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "VA Form 20-10206 Companion Document",
                  size: 22,
                  italics: true,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }),
            ...text.split("\n").map(
              (line) =>
                new Paragraph({
                  children: [new TextRun({ text: line, size: 22 })],
                  spacing: { after: 100 },
                }),
            ),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "FOIA_Request_VA_Form_20-10206.docx";
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Copy to clipboard
   */
  const copyToClipboard = async () => {
    try {
      const text = generateRequestText(formData, selectedRecords);
      await navigator.clipboard.writeText(text);
      alert("Request copied to clipboard!");
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  /**
   * Render Step 1: Personal Information
   */
  const renderPersonalInfo = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 rounded-r-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔐</span>
          <div>
            <h3 className="font-bold text-amber-800 dark:text-amber-200">
              Your Data Stays Local
            </h3>
            <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
              None of your personal information leaves your device. Everything
              is processed locally and goes directly into your downloadable
              document.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          👤 Your Information
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              First Name *
            </label>
            <input
              type="text"
              aria-label="First Name"
              value={formData.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              required
            />
          </div>
          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              aria-label="Last Name"
              value={formData.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Last 4 of SSN *
            </label>
            <input
              type="text"
              aria-label="Last 4 of SSN"
              value={formData.ssn}
              onChange={(e) =>
                updateField(
                  "ssn",
                  e.target.value.replace(/\D/g, "").slice(0, 4),
                )
              }
              placeholder="XXXX"
              maxLength={4}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              required
            />
          </div>
          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date of Birth *
            </label>
            <input
              type="date"
              aria-label="Date of Birth"
              value={formData.dob}
              onChange={(e) => updateField("dob", e.target.value)}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              required
            />
          </div>
        </div>

        <div className="mt-4">
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            VA File Number (if different from SSN)
          </label>
          <input
            type="text"
            aria-label="VA File Number"
            value={formData.vaFileNumber}
            onChange={(e) => updateField("vaFileNumber", e.target.value)}
            placeholder="Leave blank if same as SSN"
            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          📬 Contact Information
        </h3>

        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Street Address *
          </label>
          <input
            type="text"
            aria-label="Street Address"
            value={formData.address}
            onChange={(e) => updateField("address", e.target.value)}
            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
            required
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 mt-4">
          <div className="col-span-2 sm:col-span-3">
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              City *
            </label>
            <input
              type="text"
              aria-label="City"
              value={formData.city}
              onChange={(e) => updateField("city", e.target.value)}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              required
            />
          </div>
          <div className="col-span-1">
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              State *
            </label>
            <input
              type="text"
              aria-label="State"
              value={formData.state}
              onChange={(e) =>
                updateField("state", e.target.value.toUpperCase().slice(0, 2))
              }
              placeholder="XX"
              maxLength={2}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              required
            />
          </div>
          <div className="col-span-1 sm:col-span-2">
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ZIP Code *
            </label>
            <input
              type="text"
              aria-label="ZIP Code"
              value={formData.zip}
              onChange={(e) =>
                updateField(
                  "zip",
                  e.target.value.replace(/\D/g, "").slice(0, 5),
                )
              }
              maxLength={5}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              aria-label="Phone Number"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="(XXX) XXX-XXXX"
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              required
            />
          </div>
          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              aria-label="Email Address"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              required
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => setStep(2)}
        disabled={
          !formData.firstName ||
          !formData.lastName ||
          !formData.ssn ||
          !formData.email
        }
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
      >
        Continue to Record Selection →
      </button>
    </div>
  );

  /**
   * Render Step 2: Record Selection
   */
  const renderRecordSelection = () => (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="font-bold text-blue-800 dark:text-blue-200">
              Pro Tip
            </h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
              Request your <strong>complete C-File</strong> - it contains
              everything and reveals what VA actually considered when making
              their decisions. You&apos;re entitled to{" "}
              <strong>one free copy</strong> under 38 CFR § 1.555.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Select Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={selectEssential}
          className="px-4 py-2 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg font-medium hover:bg-green-200 dark:hover:bg-green-900 transition-colors"
        >
          ✓ Select Essential
        </button>
        <button
          onClick={selectAll}
          className="px-4 py-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg font-medium hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors"
        >
          ✓ Select All
        </button>
        <button
          onClick={clearAll}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          ✗ Clear All
        </button>
      </div>

      {/* Record Types by Category */}
      {["Essential", "Medical", "Administrative"].map((category) => (
        <div
          key={category}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
        >
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              {category === "Essential" && "⭐"} {category} Records
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {RECORD_TYPES.filter((r) => r.category === category).map(
              (record) => (
                <div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
                  key={record.id}
                  className={`p-4 transition-colors cursor-pointer ${
                    selectedRecords.includes(record.id)
                      ? "bg-green-50 dark:bg-green-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                  onClick={() => toggleRecord(record.id)}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                        selectedRecords.includes(record.id)
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {selectedRecords.includes(record.id) && "✓"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span>{record.icon}</span>
                        <p className="font-semibold text-gray-800 dark:text-gray-100">
                          {record.name}
                        </p>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {record.description}
                      </p>
                      {selectedRecords.includes(record.id) && (
                        <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                          <p className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">
                            Why this matters:
                          </p>
                          <ul className="text-xs text-green-700 dark:text-green-300 space-y-0.5">
                            {record.tips.slice(0, 2).map((tip, i) => (
                              <li key={i}>• {tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      ))}

      {/* Date Range Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          📅 Time Period
        </h3>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="dateRange"
              value="all"
              checked={formData.dateRange === "all"}
              onChange={() => updateField("dateRange", "all")}
              className="w-5 h-5 text-amber-500"
            />
            <span className="text-gray-800 dark:text-gray-100">
              All records (recommended)
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="dateRange"
              value="custom"
              checked={formData.dateRange === "custom"}
              onChange={() => updateField("dateRange", "custom")}
              className="w-5 h-5 text-amber-500"
            />
            <span className="text-gray-800 dark:text-gray-100">
              Specific date range
            </span>
          </label>

          {formData.dateRange === "custom" && (
            <div className="ml-8 flex gap-4">
              <div>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                  From
                </label>
                <input
                  type="month"
                  aria-label="Date range start (month and year)"
                  value={formData.startDate}
                  onChange={(e) => updateField("startDate", e.target.value)}
                  className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                  To
                </label>
                <input
                  type="month"
                  aria-label="Date range end (month and year)"
                  value={formData.endDate}
                  onChange={(e) => updateField("endDate", e.target.value)}
                  className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Preference */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          📬 How would you like to receive your records?
        </h3>

        <div className="space-y-3">
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="deliveryFormat"
              value="Electronic"
              checked={formData.deliveryFormat === "Electronic"}
              onChange={() => updateField("deliveryFormat", "Electronic")}
              className="w-5 h-5 text-amber-500"
            />
            <div>
              <span className="text-gray-800 dark:text-gray-100 font-medium">
                Electronic (Recommended)
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Faster and easier to search through
              </p>
            </div>
          </label>

          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="deliveryFormat"
              value="Physical"
              checked={formData.deliveryFormat === "Physical"}
              onChange={() => updateField("deliveryFormat", "Physical")}
              className="w-5 h-5 text-amber-500"
            />
            <div>
              <span className="text-gray-800 dark:text-gray-100 font-medium">
                Physical Copies
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Mailed to your address
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Selected Summary */}
      {selectedRecords.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 p-4 rounded-r-lg">
          <p className="font-semibold text-green-800 dark:text-green-200">
            {selectedRecords.length} record type
            {selectedRecords.length > 1 ? "s" : ""} selected
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-4">
        <button
          onClick={() => setStep(1)}
          className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={() => setStep(3)}
          disabled={selectedRecords.length === 0}
          className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
        >
          Generate Request →
        </button>
      </div>
    </div>
  );

  /**
   * Render Step 3: Review & Download
   */
  const renderReviewDownload = () => (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Success Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 rounded-full p-3">
            <span className="text-4xl">🔑</span>
          </div>
          <div>
            <h3 className="text-2xl font-bold">Your FOIA Request is Ready!</h3>
            <p className="text-amber-100">
              Download and submit to unlock your VA records
            </p>
          </div>
        </div>
      </div>

      {/* Request Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          📋 Request Summary
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400">Requester</p>
            <p className="font-medium text-gray-800 dark:text-gray-100">
              {formData.firstName} {formData.lastName}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">
              Records Requested
            </p>
            <p className="font-medium text-gray-800 dark:text-gray-100">
              {selectedRecords.length} types
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Time Period</p>
            <p className="font-medium text-gray-800 dark:text-gray-100">
              {formData.dateRange === "all"
                ? "All records"
                : `${formData.startDate} to ${formData.endDate}`}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Delivery</p>
            <p className="font-medium text-gray-800 dark:text-gray-100">
              {formData.deliveryFormat}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
            Records being requested:
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedRecords.map((id) => {
              const record = RECORD_TYPES.find((r) => r.id === id);
              return (
                <span
                  key={id}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                >
                  {record?.icon} {record?.name}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Download Options */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          📥 Download Your Request
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={downloadPDF}
            className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all"
          >
            <span className="text-3xl block mb-2">📑</span>
            <p className="font-semibold text-gray-800 dark:text-gray-100">
              Download PDF
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              For printing or submitting
            </p>
          </button>

          <button
            onClick={downloadDOCX}
            className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all"
          >
            <span className="text-3xl block mb-2">📝</span>
            <p className="font-semibold text-gray-800 dark:text-gray-100">
              Download DOCX
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              For editing if needed
            </p>
          </button>

          <button
            onClick={copyToClipboard}
            className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all"
          >
            <span className="text-3xl block mb-2">📋</span>
            <p className="font-semibold text-gray-800 dark:text-gray-100">
              Copy Text
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              To clipboard
            </p>
          </button>
        </div>
      </div>

      {/* Preview Toggle */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
      >
        {showPreview ? "🔼 Hide Preview" : "🔽 Show Full Preview"}
      </button>

      {showPreview && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
            <h4 className="font-bold text-gray-800 dark:text-gray-100">
              Request Preview
            </h4>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            <pre className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono">
              {generateRequestText(formData, selectedRecords)}
            </pre>
          </div>
        </div>
      )}

      {/* Submission Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-3">
          📤 How to Submit
        </h4>
        <div className="text-blue-700 dark:text-blue-300 text-sm space-y-3">
          <div>
            <p className="font-semibold">Option 1: VA QuickSubmit (Fastest)</p>
            <p>
              Upload at{" "}
              <a
                href="https://www.va.gov/documentation"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                va.gov/documentation
              </a>
            </p>
          </div>
          <div>
            <p className="font-semibold">
              Option 2: Submit with VA Form 20-10206
            </p>
            <p>
              Download official form from{" "}
              <a
                href="https://www.va.gov/find-forms/about-form-20-10206/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                VA.gov
              </a>{" "}
              and attach this document
            </p>
          </div>
          <div>
            <p className="font-semibold">
              Option 3: eVetRecs (for Service Records)
            </p>
            <p>
              Submit at{" "}
              <a
                href="https://www.archives.gov/veterans/military-service-records"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                archives.gov/veterans
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Timeline Info */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
        <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-2">
          ⏱️ Expected Timeline
        </h4>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
          <li>
            • <strong>VA Regional Office:</strong> 20-30 business days (can take
            longer)
          </li>
          <li>
            • <strong>NPRC (Service Records):</strong> 2-6 months (backlog
            varies)
          </li>
          <li>
            • <strong>Expedited requests:</strong> If you have a pending claim
            or appeal, mention it!
          </li>
        </ul>
      </div>

      {/* Start Over */}
      <button
        onClick={() => {
          setStep(1);
          setFormData({
            firstName: "",
            lastName: "",
            ssn: "",
            dob: "",
            vaFileNumber: "",
            address: "",
            city: "",
            state: "",
            zip: "",
            phone: "",
            email: "",
            dateRange: "all",
            startDate: "",
            endDate: "",
            deliveryFormat: "Electronic",
          });
          setSelectedRecords(["cfile", "rating_decisions", "cp_exams"]);
        }}
        className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        🔄 Start New Request
      </button>
    </div>
  );

  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={onClose}
        size="2xl"
        labelledBy="foia-generator-title"
        header={
          <div className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 p-4 shadow-lg rounded-t-xl z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🔑</span>
                <div>
                  <h2
                    id="foia-generator-title"
                    className="text-xl font-bold text-white"
                  >
                    The Keysmith{" "}
                    <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
                      BETA
                    </span>
                  </h2>
                  <p className="text-sm text-amber-100">
                    FOIA / C-File Request Generator
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onReportBug && (
                  <ReportBugLink
                    onClick={onReportBug}
                    variant="light"
                    moduleName="FOIA Keysmith"
                  />
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg
                    className="w-6 h-6"
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
            </div>
          </div>
        }
      >
        <div>
          {/* Progress Steps */}
          <div className="px-6 pt-6">
            <div className="flex items-center justify-center gap-4 mb-6">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      step >= s
                        ? "bg-amber-500 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {step > s ? "✓" : s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`w-16 h-1 ${step > s ? "bg-amber-500" : "bg-gray-200 dark:bg-gray-700"}`}
                    ></div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-8 text-sm text-gray-500 dark:text-gray-400 mb-6">
              <span className={step === 1 ? "font-bold text-amber-500" : ""}>
                Your Info
              </span>
              <span className={step === 2 ? "font-bold text-amber-500" : ""}>
                Select Records
              </span>
              <span className={step === 3 ? "font-bold text-amber-500" : ""}>
                Download
              </span>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-6 pt-0">
            {step === 1 && renderPersonalInfo()}
            {step === 2 && renderRecordSelection()}
            {step === 3 && renderReviewDownload()}

            {/* Support CTA on download page */}
            {step === 3 && (
              <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 rounded-2xl p-6 border border-amber-700/50 mt-6">
                <div className="flex items-center gap-4">
                  <img
                    src="/images/Anth.jpg"
                    alt="Anthony - Vet-Rate Developer"
                    className="w-14 h-14 rounded-full object-cover border-2 border-amber-500 shadow-lg flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-amber-200 font-semibold mb-1">
                      🔐 Knowledge is power - now you&apos;re unlocking yours
                    </p>
                    <p className="text-amber-300/70 text-sm">
                      Your C-File contains everything VA used to decide your
                      claim - and everything they may have
                      &quot;overlooked.&quot; This tool helps every veteran see
                      their own file. Transparency tools like this take time to
                      build. Help keep them free.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ResponsiveModal>

      {/* BuyMeCoffee - shows on download page */}
      {step === 3 && (
        <div className="relative z-[70]">
          <BuyMeCoffee show={true} trigger="foia" />
        </div>
      )}
    </>
  );
}
