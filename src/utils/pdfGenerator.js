/**
 * Comprehensive PDF generation with jsPDF
 * Includes all VA resources, glossary, and guidance documents
 */

import { jsPDF } from "jspdf";

const VA_RESOURCES = {
  emergency: [
    { label: "VETERANS CRISIS LINE", value: "Dial 988 then Press 1" },
    {
      label: "HOMELESS VET CALL CENTER",
      value: "1-877-4AID-VET (1-877-424-3838)",
    },
    { label: "VA HOMELESS PROGRAMS", value: "www.va.gov/homeless" },
  ],
  benefits: [
    {
      label: "File a Disability Claim",
      url: "https://www.va.gov/disability/how-to-file-claim/",
    },
    {
      label: "Check Claim or Appeal Status",
      url: "https://www.va.gov/claim-or-appeal-status/",
    },
    {
      label: "Find an Accredited VSO / Attorney",
      url: "https://www.va.gov/ogc/apps/accreditation/index.asp",
    },
    {
      label: "Download Benefit Summary Letters",
      url: "https://www.va.gov/records/download-va-letters/",
    },
    {
      label: "Medical Records (MyHealtheVet)",
      url: "https://www.va.gov/health-care/manage-health/",
    },
    {
      label: "VA Home Loans (COE & Assistance)",
      url: "https://www.va.gov/housing-assistance/",
    },
    {
      label: "GI Bill & Education Benefits",
      url: "https://www.va.gov/education/",
    },
    { label: "Center for Women Veterans", url: "https://www.va.gov/womenvet/" },
  ],
  ratingSchedule: {
    label: "38 CFR Part 4 (The Rating Schedule)",
    url: "https://www.ecfr.gov/current/title-38/chapter-I/part-4",
  },
};

const GLOSSARY_TERMS = [
  {
    term: "Diagnostic Code (DC)",
    definition:
      "A 4-digit number used by the VA to classify and rate specific disabilities (e.g., 8100 for Migraines).",
  },
  {
    term: "Effective Date",
    definition:
      "The date from which VA benefits are paid; typically the date the claim was received or the date entitlement arose.",
  },
  {
    term: "Nexus",
    definition:
      "The mandatory medical link between a current disability and an event, injury, or disease in service.",
  },
  {
    term: "Pyramiding",
    definition:
      "The prohibition (38 CFR 4.14) against rating the same symptom/manifestation twice under different diagnostic codes.",
  },
  {
    term: "Secondary Condition",
    definition:
      "A disability that is proximately due to or the result of a service-connected disease or injury.",
  },
  {
    term: "Service Connection",
    definition:
      "Acknowledgment by the VA that a disability was incurred or aggravated during military service.",
  },
  {
    term: "C&P Exam",
    definition:
      "Compensation and Pension examination administered by the VA or a contractor to evaluate the severity of your condition.",
  },
  {
    term: "Presumptive Condition",
    definition:
      "A condition the VA assumes was caused by service due to specific circumstances (e.g., Agent Orange, Burn Pits, Camp Lejeune).",
  },
  {
    term: "Combined Rating",
    definition:
      'The total disability rating calculated using the "Whole Person" concept (VA Math), not simple addition (e.g., 50% + 50% = 75%, rounded to 80%).',
  },
  {
    term: "TDIU (Total Disability Individual Unemployability)",
    definition:
      "Benefits paid at the 100% rate because service-connected disabilities prevent substantial gainful employment, even if the combined rating is less than 100%.",
  },
  {
    term: "SMC (Special Monthly Compensation)",
    definition:
      "Additional compensation beyond the 100% rate for severe disabilities (e.g., loss of use of a limb/organ, need for aid and attendance).",
  },
];

const CLAIMS_TOOLKIT = {
  fourPillars: [
    {
      name: "Frequency",
      description:
        'How often does it happen? (e.g., "My migraines occur 3 times a week.")',
    },
    {
      name: "Severity",
      description:
        'How bad is it? (e.g., "I must lie down in a dark room for 4 hours.")',
    },
    {
      name: "Duration",
      description:
        'How long has it lasted? (e.g., "This has been getting worse since 2018.")',
    },
    {
      name: "Impact",
      description:
        'How does it stop you from working/living? (e.g., "I miss 2 days of work per month.")',
    },
  ],
  goldenRules: [
    "Be Honest, but do not downplay your symptoms.",
    "Describe your WORST day, not your best day.",
    "Do not push through pain during Range of Motion tests. Stop as soon as you feel pain.",
    "If you use braces, canes, or meds, bring them.",
    "The examiner is not your doctor; be professional.",
  ],
  doctorGuidance: {
    title: "Information for Your Doctor - Nexus Letters & DBQ Requirements",
    introduction:
      "If obtaining a private Nexus Letter or Disability Benefits Questionnaire (DBQ), ensure your provider addresses these critical elements:",
    requirements: [
      {
        name: "Probability Standard",
        description:
          'The medical opinion must state the nexus is "at least as likely as not" (50% or greater probability) that your current condition is related to your military service, a service-connected injury, or service-connected treatment.',
      },
      {
        name: "Functional Impact",
        description:
          "The provider must document specific functional limitations (e.g., range of motion, ability to stand/walk, cognitive impairment, frequency/severity of flare-ups) that align with the VA rating criteria under 38 CFR Part 4.",
      },
      {
        name: "Review of Records",
        description:
          "The doctor should reference your service treatment records (STRs), VA medical records, and any relevant civilian medical history to establish continuity of symptoms from service to present.",
      },
      {
        name: "Rationale",
        description:
          'The opinion must include a clear medical rationale explaining WHY the condition is service-connected. Generic statements like "patient reports service connection" are insufficient - cite medical evidence, diagnostic findings, and clinical reasoning.',
      },
    ],
  },
};

/**
 * Generate comprehensive PDF report
 */
function _drawTitleHeaderSection(ctx) {
  const { doc, pos, colors, margin, contentWidth, pageWidth, searchTerm } = ctx;
  // Title Section - Enhanced header with gradient effect
  doc.setFillColor(...colors.vaBlue);
  doc.rect(0, 0, pageWidth, 45, "F");

  // Add gold accent bar
  doc.setFillColor(...colors.vaGold);
  doc.rect(0, 42, pageWidth, 3, "F");

  // Add logo (centered at top)
  try {
    const logoImg = new Image();
    logoImg.src = "/images/Vet-Rate-org-logo-official.png";
    // Logo: 15x15mm square, centered, at top of header
    doc.addImage(logoImg, "PNG", (pageWidth - 15) / 2, 8, 15, 15);
  } catch {
    // eslint-disable-next-line sonarjs/no-ignored-exceptions -- non-critical: continue with text-only header if logo fails to load
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont(undefined, "normal");
  doc.text("VA Disability Rating Information Report", pageWidth / 2, 32, {
    align: "center",
  });
  doc.setFontSize(9);
  doc.text(
    "38 CFR Part 4 - Schedule for Rating Disabilities",
    pageWidth / 2,
    38,
    {
      align: "center",
    },
  );

  doc.setTextColor(0, 0, 0);
  pos.y = 55;

  // Report metadata in a styled box
  doc.setFillColor(...colors.lightGray);
  doc.roundedRect(margin, pos.y, contentWidth, 15, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.setTextColor(...colors.mediumGray);
  doc.text(
    `Generated: ${new Date().toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    })}`,
    margin + 3,
    pos.y + 5,
  );
  doc.text(`Search Query: "${searchTerm}"`, margin + 3, pos.y + 10);
  doc.setTextColor(0, 0, 0);
  pos.y += 22;
}

function _drawConditionAndDisabilityInfo(ctx) {
  const {
    doc,
    pos,
    colors,
    margin,
    contentWidth,
    checkPageBreak,
    addHeading,
    addInfoBox,
    result,
  } = ctx;
  // Condition Information - Featured section
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...colors.vaBlue);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, pos.y, contentWidth, 28, 2, 2, "FD");

  pos.y += 8;
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.setTextColor(...colors.vaBlue);
  doc.text(result.conditionName, margin + 5, pos.y);
  doc.setTextColor(0, 0, 0);
  pos.y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.setTextColor(...colors.mediumGray);
  doc.text(
    `Diagnostic Code: ${result.diagnosticCode}  |  Rating Schedule: ${result.ratingSchedule}`,
    margin + 5,
    pos.y,
  );
  doc.setTextColor(0, 0, 0);
  pos.y += 5;

  if (result.ecfrUrl) {
    doc.setFontSize(8);
    doc.setTextColor(...colors.accentBlue);
    doc.text(`eCFR Reference: ${result.ecfrUrl}`, margin + 5, pos.y);
    doc.setTextColor(0, 0, 0);
  }

  pos.y += 15;

  // Disability Information Section
  checkPageBreak(40);
  addHeading("Disability Overview", 2);
  addInfoBox(
    `This condition is rated under ${result.ratingSchedule}. The VA rating depends on the severity and functional impact of the condition. Your rating is determined during the C&P examination and review of medical evidence.`,
    [219, 234, 254], // Light blue background
    colors.accentBlue,
  );
}

function _drawTitleAndConditionSections(ctx) {
  _drawTitleHeaderSection(ctx);
  _drawConditionAndDisabilityInfo(ctx);
}

function _drawRatingTypeAndInstructions(ctx) {
  const { doc, pos, margin, contentWidth, checkPageBreak, result } = ctx;
  // Type badge
  doc.setFontSize(8);
  doc.setFont(undefined, "bold");
  doc.setTextColor(75, 85, 99);
  doc.text(
    `RATING TYPE: ${result.ratingCriteria.type.replace(/-/g, " ").toUpperCase()}`,
    margin,
    pos.y,
  );
  pos.y += 6;
  doc.setFont(undefined, "normal");
  doc.setTextColor(0, 0, 0);

  // Rated-As Instructions
  if (result.ratingCriteria.ratedUnder) {
    checkPageBreak(25);
    const instructionsLines = doc.splitTextToSize(
      result.ratingCriteria.ratedUnder,
      contentWidth - 12,
    );
    const boxHeight = instructionsLines.length * 4 + 13;
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(margin, pos.y - 3, contentWidth, boxHeight, 1, 1, "F");
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.setTextColor(146, 64, 14);
    doc.text("RATING INSTRUCTIONS:", margin + 3, pos.y);
    doc.setFont(undefined, "normal");
    pos.y += 5;
    doc.text(instructionsLines, margin + 3, pos.y, {
      maxWidth: contentWidth - 12,
    });
    pos.y += instructionsLines.length * 4 + 5;
    doc.setTextColor(0, 0, 0);
    pos.y += 3;
  }
}

function _drawRatingFormulaAndSpecial(ctx) {
  const { doc, pos, margin, contentWidth, checkPageBreak, result } = ctx;
  // Formula
  if (result.ratingCriteria.formula) {
    checkPageBreak(20);
    const formulaLines = doc.splitTextToSize(
      result.ratingCriteria.formula,
      contentWidth - 12,
    );
    const boxHeight = formulaLines.length * 4 + 13;
    doc.setFillColor(219, 234, 254);
    doc.roundedRect(margin, pos.y - 3, contentWidth, boxHeight, 1, 1, "F");
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.setTextColor(30, 64, 175);
    doc.text("FORMULA:", margin + 3, pos.y);
    doc.setFont(undefined, "normal");
    pos.y += 5;
    doc.text(formulaLines, margin + 3, pos.y, {
      maxWidth: contentWidth - 12,
    });
    pos.y += formulaLines.length * 4 + 5;
    doc.setTextColor(0, 0, 0);
    pos.y += 3;
  }

  // Special Instructions
  if (result.ratingCriteria.specialInstructions) {
    checkPageBreak(20);
    const specialLines = doc.splitTextToSize(
      result.ratingCriteria.specialInstructions,
      contentWidth - 12,
    );
    const boxHeight = specialLines.length * 4 + 13;
    doc.setFillColor(243, 232, 255);
    doc.roundedRect(margin, pos.y - 3, contentWidth, boxHeight, 1, 1, "F");
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.setTextColor(109, 40, 217);
    doc.text("SPECIAL INSTRUCTIONS:", margin + 3, pos.y);
    doc.setFont(undefined, "normal");
    pos.y += 5;
    doc.text(specialLines, margin + 3, pos.y, {
      maxWidth: contentWidth - 12,
    });
    pos.y += specialLines.length * 4 + 5;
    doc.setTextColor(0, 0, 0);
    pos.y += 3;
  }
}

function _drawPercentageTable(ctx) {
  const { doc, pos, colors, margin, contentWidth, checkPageBreak, result } =
    ctx;
  // Percentage Ratings Table
  if (
    result.ratingCriteria.ratings &&
    Object.keys(result.ratingCriteria.ratings).length > 0
  ) {
    checkPageBreak(40);

    // Table header
    doc.setFillColor(...colors.vaBlue);
    doc.rect(margin, pos.y, contentWidth, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Rating %", margin + 3, pos.y + 5);
    doc.text("Criteria", margin + 35, pos.y + 5);
    pos.y += 10;
    doc.setFont(undefined, "normal");
    doc.setTextColor(0, 0, 0);

    // Sort ratings in descending order
    const sortedRatings = Object.entries(result.ratingCriteria.ratings).sort(
      ([a], [b]) => parseInt(b) - parseInt(a),
    );

    sortedRatings.forEach(([percentage, criteria], index) => {
      checkPageBreak(20);

      // Calculate row height first
      const criteriaLines = doc.splitTextToSize(criteria, contentWidth - 38);
      const rowHeight = Math.max(criteriaLines.length * 4 + 4, 12);

      // Alternating row background
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, pos.y - 3, contentWidth, rowHeight + 3, "F");
      }

      // Percentage badge
      doc.setFillColor(253, 224, 71);
      doc.roundedRect(margin + 2, pos.y - 2, 25, 7, 1, 1, "F");
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      doc.setTextColor(17, 63, 123);
      doc.text(`${percentage}%`, margin + 5, pos.y + 3);

      // Criteria text
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.text(criteriaLines, margin + 35, pos.y + 3);

      pos.y += rowHeight;
      doc.setTextColor(0, 0, 0);
    });

    pos.y += 5;
  }
}

function _drawRatingNotes(ctx) {
  const { doc, pos, margin, contentWidth, checkPageBreak, result } = ctx;
  // Notes
  if (result.ratingCriteria.notes) {
    checkPageBreak(30);

    // Handle notes as either string or array
    const notesArray = Array.isArray(result.ratingCriteria.notes)
      ? result.ratingCriteria.notes
      : [result.ratingCriteria.notes];

    // Calculate total height for all notes
    let totalNotesHeight = 9;
    const allNoteLines = [];
    notesArray.forEach((note) => {
      const noteLines = doc.splitTextToSize(`• ${note}`, contentWidth - 6);
      allNoteLines.push(noteLines);
      totalNotesHeight += noteLines.length * 4 + 3;
    });

    doc.setFillColor(236, 253, 245);
    doc.roundedRect(
      margin,
      pos.y - 3,
      contentWidth,
      totalNotesHeight,
      1,
      1,
      "F",
    );
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.setTextColor(5, 122, 85);
    doc.text("IMPORTANT NOTES:", margin + 3, pos.y);
    doc.setFont(undefined, "normal");
    pos.y += 6;

    allNoteLines.forEach((noteLines) => {
      checkPageBreak(15);
      doc.setTextColor(75, 85, 99);
      doc.text(noteLines, margin + 3, pos.y);
      pos.y += noteLines.length * 4 + 3;
    });

    doc.setTextColor(0, 0, 0);
    pos.y += 5;
  }
}

function _drawRatingCriteriaSection(ctx) {
  const { checkPageBreak, addHeading, result } = ctx;
  if (
    result.ratingCriteria &&
    (result.ratingCriteria.ratings || result.ratingCriteria.ratedUnder)
  ) {
    checkPageBreak(60);
    addHeading("Rating Schedules & Criteria", 2);
    _drawRatingTypeAndInstructions(ctx);
    _drawRatingFormulaAndSpecial(ctx);
    _drawPercentageTable(ctx);
    _drawRatingNotes(ctx);
  }
}

function _drawDocumentationRequirementsSection(ctx) {
  const {
    doc,
    pos,
    colors,
    margin,
    contentWidth,
    checkPageBreak,
    addHeading,
    addText,
    result,
  } = ctx;
  checkPageBreak(50);
  addHeading("Medical Documentation Requirements", 2);
  addText(
    "Ensure your medical provider includes the following information in your records to support proper disability rating:",
    10,
  );
  pos.y += 3;

  const bulletPoints = result.documentationRequirements
    .split("\n")
    .filter((line) => line.trim());

  bulletPoints.forEach((point, index) => {
    checkPageBreak(12);

    // Alternating background for better readability
    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin - 2, pos.y - 4, contentWidth + 4, 8, "F");
    }

    doc.setFontSize(10);
    doc.setTextColor(...colors.vaBlue);
    doc.text("*", margin + 2, pos.y);
    doc.setTextColor(...colors.darkGray);
    const wrappedText = doc.splitTextToSize(point, contentWidth - 10);
    doc.text(wrappedText, margin + 8, pos.y);
    doc.setTextColor(0, 0, 0);
    pos.y += Math.max(wrappedText.length * 5, 8);
  });

  pos.y += 5;
}

function _drawRelatedSecondaryConditionsSection(ctx) {
  const {
    doc,
    pos,
    colors,
    margin,
    contentWidth,
    checkPageBreak,
    addHeading,
    addInfoBox,
    result,
  } = ctx;
  if (
    result.relatedSecondaryConditions &&
    result.relatedSecondaryConditions.length > 0
  ) {
    checkPageBreak(50);
    addHeading("Related Secondary Conditions", 2);
    addInfoBox(
      "These conditions may develop as a result of your primary service-connected disability and may qualify for separate disability ratings. Discuss these with your healthcare provider.",
      [254, 249, 195], // Light yellow background
      [251, 191, 36],
    );

    result.relatedSecondaryConditions.forEach((condition, index) => {
      checkPageBreak(10);
      doc.setFontSize(10);
      doc.setTextColor(...colors.darkGray);

      // Support both string and object format for backwards compatibility
      const conditionName =
        typeof condition === "string" ? condition : condition.name;
      const diagnosticCode =
        typeof condition === "object" ? condition.diagnosticCode : null;

      const displayText = diagnosticCode
        ? `${index + 1}. ${conditionName} (DC ${diagnosticCode})`
        : `${index + 1}. ${conditionName}`;

      doc.text(displayText, margin + 5, pos.y);
      doc.setTextColor(0, 0, 0);
      pos.y += 6;
    });

    // Add medical nexus disclaimer
    checkPageBreak(25);
    pos.y += 3;
    doc.setFillColor(255, 243, 205);
    doc.roundedRect(margin, pos.y - 3, contentWidth, 20, 1, 1, "F");
    doc.setFontSize(8);
    doc.setFont(undefined, "bold");
    doc.setTextColor(120, 53, 15);
    doc.text("IMPORTANT: Medical Nexus Required", margin + 3, pos.y);
    doc.setFont(undefined, "normal");
    pos.y += 4;
    const disclaimerText =
      'Veterans must provide medical evidence establishing a nexus (medical link) between their service-connected condition and any secondary condition. This requires a medical opinion stating it is "at least as likely as not" (50% or greater probability) that the secondary condition is related to the service-connected disability.';
    const disclaimerLines = doc.splitTextToSize(
      disclaimerText,
      contentWidth - 6,
    );
    doc.text(disclaimerLines, margin + 3, pos.y);
    pos.y += disclaimerLines.length * 3.5 + 5;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    pos.y += 5;
  }
}

function _drawDocumentationAndSecondarySection(ctx) {
  _drawDocumentationRequirementsSection(ctx);
  _drawRelatedSecondaryConditionsSection(ctx);
}

function _drawEmergencySupportSection(ctx) {
  const { doc, pos, colors, margin, contentWidth, checkPageBreak, addHeading } =
    ctx;
  // Veteran Support & Resources
  doc.addPage();
  pos.y = margin + 10;
  addHeading("Veteran Support & Resources", 1);

  // Emergency Support - Highlighted section
  checkPageBreak(50);
  doc.setFillColor(...colors.warningRed);
  doc.roundedRect(margin - 3, pos.y - 5, contentWidth + 6, 8, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("EMERGENCY & CRISIS SUPPORT", margin, pos.y);
  doc.setTextColor(0, 0, 0);
  pos.y += 12;

  VA_RESOURCES.emergency.forEach((resource) => {
    checkPageBreak(15);
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(margin, pos.y - 4, contentWidth, 12, 1, 1, "F");
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...colors.warningRed);
    doc.text(resource.label, margin + 3, pos.y);
    pos.y += 5;
    doc.setFont(undefined, "normal");
    doc.setFontSize(11);
    doc.setTextColor(...colors.darkGray);
    doc.text(resource.value, margin + 3, pos.y);
    doc.setTextColor(0, 0, 0);
    pos.y += 9;
  });

  pos.y += 5;
}

function _drawVaToolsSection(ctx) {
  const { doc, pos, colors, margin, contentWidth, checkPageBreak, addHeading } =
    ctx;
  // Essential VA Tools
  checkPageBreak(50);
  addHeading("Essential VA Tools & Benefits", 2);

  VA_RESOURCES.benefits.forEach((benefit, index) => {
    checkPageBreak(14);

    // Grouped styling for better organization
    if (index % 3 === 0) {
      doc.setFillColor(...colors.lightGray);
      const itemsRemaining = Math.min(3, VA_RESOURCES.benefits.length - index);
      doc.roundedRect(
        margin - 2,
        pos.y - 4,
        contentWidth + 4,
        itemsRemaining * 14 - 2,
        1.5,
        1.5,
        "F",
      );
    }

    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...colors.darkGray);
    doc.text(`> ${benefit.label}`, margin + 2, pos.y);
    pos.y += 5;
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.accentBlue);
    const urlLines = doc.splitTextToSize(benefit.url, contentWidth - 10);
    doc.text(urlLines, margin + 5, pos.y);
    doc.setTextColor(0, 0, 0);
    pos.y += 9;
  });

  pos.y += 5;

  // Rating Schedule link
  checkPageBreak(20);
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(...colors.accentBlue);
  doc.roundedRect(margin, pos.y - 4, contentWidth, 15, 1.5, 1.5, "FD");
  doc.setFontSize(10);
  doc.setFont(undefined, "bold");
  doc.setTextColor(...colors.darkGray);
  doc.text(VA_RESOURCES.ratingSchedule.label, margin + 3, pos.y);
  pos.y += 6;
  doc.setFont(undefined, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...colors.accentBlue);
  doc.text(VA_RESOURCES.ratingSchedule.url, margin + 3, pos.y);
  doc.setTextColor(0, 0, 0);
  pos.y += 12;
}

function _drawSupportResourcesSection(ctx) {
  _drawEmergencySupportSection(ctx);
  _drawVaToolsSection(ctx);
}

function _drawGlossaryMain(ctx) {
  const {
    doc,
    pos,
    colors,
    margin,
    contentWidth,
    checkPageBreak,
    addHeading,
    addInfoBox,
  } = ctx;
  // Glossary of VA Terms
  doc.addPage();
  pos.y = margin + 10;
  addHeading("Glossary of VA Terms", 1);
  addInfoBox(
    "Understanding VA terminology is crucial for navigating the claims process. These definitions will help you communicate effectively with VA representatives and understand your benefits.",
    [240, 253, 244], // Light green background
    colors.successGreen,
  );

  const termsPerPage = Math.ceil(GLOSSARY_TERMS.length / 2);

  GLOSSARY_TERMS.slice(0, termsPerPage).forEach((item, index) => {
    checkPageBreak(22);

    // Styled term boxes
    doc.setFillColor(
      index % 2 === 0 ? 249 : 243,
      index % 2 === 0 ? 250 : 244,
      index % 2 === 0 ? 251 : 246,
    );
    const defLines = doc.splitTextToSize(item.definition, contentWidth - 10);
    const boxHeight = defLines.length * 4 + 10;
    doc.roundedRect(margin, pos.y - 4, contentWidth, boxHeight, 1, 1, "F");

    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...colors.vaBlue);
    doc.text(`> ${item.term}`, margin + 3, pos.y);
    pos.y += 6;
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...colors.darkGray);
    doc.text(defLines, margin + 5, pos.y);
    doc.setTextColor(0, 0, 0);
    pos.y += defLines.length * 4 + 6;
  });
}

function _drawGlossaryAdditional(ctx) {
  const { doc, pos, colors, margin, contentWidth, checkPageBreak } = ctx;
  // Additional glossary items on new page if needed
  checkPageBreak(60);
  pos.y += 5;

  const termsPerPage = Math.ceil(GLOSSARY_TERMS.length / 2);
  GLOSSARY_TERMS.slice(termsPerPage).forEach((item, index) => {
    checkPageBreak(22);

    doc.setFillColor(
      index % 2 === 0 ? 249 : 243,
      index % 2 === 0 ? 250 : 244,
      index % 2 === 0 ? 251 : 246,
    );
    const defLines = doc.splitTextToSize(item.definition, contentWidth - 10);
    const boxHeight = defLines.length * 4 + 10;
    doc.roundedRect(margin, pos.y - 4, contentWidth, boxHeight, 1, 1, "F");

    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...colors.vaBlue);
    doc.text(`> ${item.term}`, margin + 3, pos.y);
    pos.y += 6;
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...colors.darkGray);
    doc.text(defLines, margin + 5, pos.y);
    doc.setTextColor(0, 0, 0);
    pos.y += defLines.length * 4 + 6;
  });
}

function _drawClaimsToolkit(ctx) {
  const {
    doc,
    pos,
    colors,
    margin,
    contentWidth,
    checkPageBreak,
    addHeading,
    addText,
    addInfoBox,
  } = ctx;
  // Claims Success Toolkit
  doc.addPage();
  pos.y = margin + 10;
  addHeading("Claims Success Toolkit", 1);
  addInfoBox(
    "This guide will help you structure your personal statements and communicate effectively with medical providers about your service-connected conditions.",
    [240, 253, 244],
    colors.successGreen,
  );

  checkPageBreak(50);
  addHeading("Personal Statement - The 4 Pillars", 2);
  addText(
    "When writing your statement (VA Form 21-4138), address these four critical elements. Don't just list diagnoses - explain how your condition impacts your daily life:",
    10,
  );
  pos.y += 5;

  CLAIMS_TOOLKIT.fourPillars.forEach((pillar, index) => {
    checkPageBreak(20);

    // Color-coded boxes for each pillar
    const pillarColors = [
      [219, 234, 254], // Blue
      [254, 249, 195], // Yellow
      [243, 232, 255], // Purple
      [254, 226, 226], // Red
    ];

    doc.setFillColor(...pillarColors[index]);
    doc.setDrawColor(...colors.vaBlue);
    doc.setLineWidth(0.3);

    const descLines = doc.splitTextToSize(
      pillar.description,
      contentWidth - 12,
    );
    const boxHeight = descLines.length * 4.5 + 10;
    doc.roundedRect(margin, pos.y - 4, contentWidth, boxHeight, 1.5, 1.5, "FD");

    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...colors.vaBlue);
    doc.text(`${index + 1}. ${pillar.name}`, margin + 4, pos.y);
    pos.y += 6;
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...colors.darkGray);
    doc.text(descLines, margin + 6, pos.y);
    doc.setTextColor(0, 0, 0);
    pos.y += descLines.length * 4.5 + 5;
  });

  pos.y += 5;
}

function _drawExamGoldenRules(ctx) {
  const {
    doc,
    pos,
    colors,
    margin,
    contentWidth,
    checkPageBreak,
    addHeading,
    addInfoBox,
  } = ctx;
  // C&P Exam Golden Rules
  checkPageBreak(50);
  addHeading("C&P Exam Golden Rules", 2);
  addInfoBox(
    "These rules can significantly impact your disability rating. Review them carefully before your examination.",
    [254, 249, 195],
    [251, 191, 36],
  );

  CLAIMS_TOOLKIT.goldenRules.forEach((rule, index) => {
    checkPageBreak(12);

    doc.setFillColor(
      index % 2 === 0 ? 255 : 249,
      index % 2 === 0 ? 255 : 250,
      index % 2 === 0 ? 255 : 251,
    );
    doc.roundedRect(margin, pos.y - 4, contentWidth, 9, 1, 1, "F");

    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...colors.vaBlue);
    doc.text(`${index + 1}.`, margin + 2, pos.y);
    doc.setFont(undefined, "normal");
    doc.setTextColor(...colors.darkGray);
    const ruleText = doc.splitTextToSize(rule, contentWidth - 12);
    doc.text(ruleText, margin + 8, pos.y);
    doc.setTextColor(0, 0, 0);
    pos.y += Math.max(ruleText.length * 5, 9);
  });

  pos.y += 8;
}

function _drawGlossaryAndToolkitSection(ctx) {
  _drawGlossaryMain(ctx);
  _drawGlossaryAdditional(ctx);
  _drawClaimsToolkit(ctx);
  _drawExamGoldenRules(ctx);
}

function _drawDoctorInfoSection(ctx) {
  const {
    doc,
    pos,
    colors,
    margin,
    contentWidth,
    checkPageBreak,
    addHeading,
    addInfoBox,
  } = ctx;
  // Information for Your Doctor - Nexus Letters & DBQ Requirements
  checkPageBreak(60);
  addHeading("Information for Your Doctor", 2);
  addInfoBox(
    CLAIMS_TOOLKIT.doctorGuidance.introduction,
    [254, 226, 226], // Light red background
    colors.warningRed,
  );

  CLAIMS_TOOLKIT.doctorGuidance.requirements.forEach((req, index) => {
    checkPageBreak(25);

    // Color-coded boxes for each requirement
    const reqColors = [
      [219, 234, 254], // Blue
      [254, 249, 195], // Yellow
      [243, 232, 255], // Purple
      [240, 253, 244], // Green
    ];

    doc.setFillColor(...reqColors[index]);
    doc.setDrawColor(...colors.vaBlue);
    doc.setLineWidth(0.3);

    const descLines = doc.splitTextToSize(req.description, contentWidth - 12);
    const boxHeight = descLines.length * 4.5 + 10;
    doc.roundedRect(margin, pos.y - 4, contentWidth, boxHeight, 1.5, 1.5, "FD");

    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...colors.vaBlue);
    doc.text(`${index + 1}. ${req.name}`, margin + 4, pos.y);
    pos.y += 6;
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...colors.darkGray);
    doc.text(descLines, margin + 6, pos.y);
    doc.setTextColor(0, 0, 0);
    pos.y += descLines.length * 4.5 + 5;
  });

  pos.y += 8;
}

function _drawCfrPart4Heading(ctx) {
  const { doc, pos, colors, margin, addHeading, addInfoBox } = ctx;
  // 38 CFR Part 4 Subpart A - Rating Principles
  doc.addPage();
  pos.y = margin + 10;
  addHeading("VA Rating Principles - 38 CFR Part 4 Subpart A", 1);
  addInfoBox(
    "The VA follows these official rating principles from 38 CFR Part 4 Subpart A. Understanding these policies can help you present a stronger claim.",
    [240, 253, 244],
    colors.successGreen,
  );
}

function _drawCfrPart4Principles(ctx) {
  const { doc, pos, colors, margin, contentWidth, checkPageBreak } = ctx;
  const ratingPrinciples = [
    {
      name: "§4.1 - Essentials of Evaluative Rating",
      description:
        "Ratings represent the average impairment in earning capacity from disabilities in civil occupations. Medical examinations must emphasize the limitation of activity imposed by the disabling condition.",
    },
    {
      name: "§4.2 - Interpretation of Examination Reports",
      description:
        "Each disability must be considered from the point of view of the veteran working or seeking work. If a diagnosis is not supported by findings or lacks detail, the rating board must return it as inadequate.",
    },
    {
      name: "§4.3 - Resolution of Reasonable Doubt",
      description:
        'When reasonable doubt arises regarding the degree of disability, that doubt will be resolved in favor of the claimant. This is the "benefit of the doubt" principle.',
    },
    {
      name: "§4.7 - Higher of Two Evaluations",
      description:
        "Where there is a question as to which of two evaluations shall be applied, the higher evaluation will be assigned if the disability picture more nearly approximates the criteria required for that rating.",
    },
    {
      name: "§4.10 - Functional Impairment",
      description:
        "Evaluations are based on lack of usefulness of body parts or systems, especially in self-support. Medical examiners must furnish full descriptions of the effects of disability upon ordinary activity. A person may be too disabled to work even if fairly comfortable at home.",
    },
    {
      name: "§4.14 - Avoidance of Pyramiding",
      description:
        "The evaluation of the same disability under various diagnoses is to be avoided. The same manifestation cannot be rated under different diagnoses.",
    },
    {
      name: "§4.16 - Total Disability Based on Unemployability (TDIU)",
      description:
        "Total disability ratings may be assigned when the veteran is unable to secure or follow substantially gainful occupation due to service-connected disabilities. Generally requires one disability at 60%+ or multiple disabilities with one at 40%+ combining to 70%+.",
    },
  ];

  ratingPrinciples.forEach((principle, index) => {
    checkPageBreak(22);

    doc.setFillColor(
      index % 2 === 0 ? 249 : 243,
      index % 2 === 0 ? 250 : 244,
      index % 2 === 0 ? 251 : 246,
    );
    const descLines = doc.splitTextToSize(
      principle.description,
      contentWidth - 10,
    );
    const boxHeight = descLines.length * 4.5 + 10;
    doc.roundedRect(margin, pos.y - 4, contentWidth, boxHeight, 1, 1, "F");

    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...colors.vaBlue);
    doc.text(`> ${principle.name}`, margin + 3, pos.y);
    pos.y += 6;
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...colors.darkGray);
    doc.text(descLines, margin + 5, pos.y);
    doc.setTextColor(0, 0, 0);
    pos.y += descLines.length * 4.5 + 4;
  });
}

function _drawCfrPart3Heading(ctx) {
  const { doc, pos, margin, addHeading, addInfoBox } = ctx;
  // 38 CFR Part 3 - Claims Process Rights
  doc.addPage();
  pos.y = margin + 10;
  addHeading("Your Rights Under 38 CFR Part 3", 1);
  addInfoBox(
    "38 CFR Part 3 governs HOW the VA processes your claim. These regulations establish your procedural rights, evidence standards, and appeal options. Know these rules - they protect you!",
    [254, 243, 199],
    [217, 119, 6],
  );
}

function _drawCfrPart3Rights(ctx) {
  const { doc, pos, colors, margin, contentWidth, checkPageBreak } = ctx;
  const claimsRights = [
    {
      name: "§3.102 - Benefit of the Doubt",
      description:
        'When the evidence is in "approximate balance" (50/50), the benefit of the doubt goes to YOU. The tie goes to the veteran. VA cannot deny a claim simply because it lacks certainty.',
    },
    {
      name: "§3.159 - Duty to Assist",
      description:
        "VA MUST help you gather evidence, including obtaining medical and service records. If VA denies based on missing evidence they could have obtained, that is an error you can appeal.",
    },
    {
      name: "§3.155(b) - Intent to File",
      description:
        "Filing an Intent to File (ITF) protects your effective date for up to 1 year while you gather evidence. This can mean thousands of dollars in back-pay if your claim is approved.",
    },
    {
      name: "§3.344 - Rating Stabilization",
      description:
        'Ratings in effect for 5+ years are "stabilized" and cannot be reduced without sustained improvement shown by the full body of evidence. 20+ years = permanent.',
    },
    {
      name: "§3.400 - Effective Date Rules",
      description:
        "Generally, the effective date is the date VA received your claim OR the date entitlement arose, whichever is LATER. This is why filing an Intent to File early matters!",
    },
    {
      name: "§3.2500 - Review Options (AMA)",
      description:
        "After a decision, you have 3 review lanes: Supplemental Claim (new evidence), Higher-Level Review (same evidence, new reviewer), or Board Appeal. You have 1 year to choose.",
    },
    {
      name: "§3.103 - Procedural Due Process",
      description:
        "You have the right to a hearing, to representation, to see all evidence used against you, and to submit evidence in response. VA must give you notice before reducing benefits.",
    },
    {
      name: "§3.310 - Secondary Service Connection",
      description:
        "A disability that is caused OR aggravated by a service-connected condition can also be service-connected. Example: Knee injury causes hip problems = both are service-connected.",
    },
  ];

  claimsRights.forEach((right, index) => {
    checkPageBreak(22);

    doc.setFillColor(
      index % 2 === 0 ? 254 : 255,
      index % 2 === 0 ? 249 : 251,
      index % 2 === 0 ? 217 : 235,
    );
    const descLines = doc.splitTextToSize(right.description, contentWidth - 10);
    const boxHeight = descLines.length * 4.5 + 10;
    doc.roundedRect(margin, pos.y - 4, contentWidth, boxHeight, 1, 1, "F");

    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...colors.vaBlue);
    doc.text(`> ${right.name}`, margin + 3, pos.y);
    pos.y += 6;
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...colors.darkGray);
    doc.text(descLines, margin + 5, pos.y);
    doc.setTextColor(0, 0, 0);
    pos.y += descLines.length * 4.5 + 4;
  });
}

function _drawDeadlinesBox(ctx) {
  const { doc, pos, colors, margin, contentWidth, checkPageBreak, addHeading } =
    ctx;
  // Critical Deadlines Box
  checkPageBreak(55);
  pos.y += 5;
  addHeading("Critical Deadlines to Remember", 2);

  doc.setFillColor(254, 226, 226);
  doc.setDrawColor(239, 68, 68);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, pos.y - 2, contentWidth, 42, 2, 2, "FD");
  pos.y += 4;

  const deadlines = [
    "• Intent to File: Good for 1 year - file your complete claim before it expires",
    "• Appeal Deadline: 1 year from decision date - or the decision becomes final",
    "• Supplemental Claim: File within 1 year to preserve original effective date",
    "• Notice of Disagreement: 1 year to file if contesting a rating decision",
    "• CUE Claims: No time limit - can fix clear errors in past decisions anytime",
  ];

  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.setTextColor(...colors.warningRed);
  deadlines.forEach((deadline) => {
    doc.text(deadline, margin + 4, pos.y);
    pos.y += 6;
  });
  doc.setTextColor(0, 0, 0);
  pos.y += 8;
}

function _drawLegalDisclosures(ctx) {
  const { doc, pos, colors, margin, contentWidth } = ctx;
  // Legal Disclosures
  doc.addPage();
  pos.y = margin + 10;

  doc.setFillColor(250, 245, 255);
  doc.setDrawColor(147, 51, 234);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin - 2, pos.y - 5, contentWidth + 4, 50, 2, 2, "FD");

  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.setTextColor(147, 51, 234);
  doc.text("IMPORTANT LEGAL DISCLOSURES", margin + 2, pos.y);
  pos.y += 8;

  doc.setFont(undefined, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...colors.darkGray);
  doc.text("DATA PRIVACY & SECURITY:", margin + 3, pos.y);
  pos.y += 5;
  doc.setFont(undefined, "normal");
  doc.setFontSize(8);
  const privacy = doc.splitTextToSize(
    "This document contains information for educational purposes. This system operates locally and does not store Personally Identifiable Information (PII) on external servers.",
    contentWidth - 10,
  );
  doc.text(privacy, margin + 3, pos.y);
  pos.y += privacy.length * 4 + 5;

  doc.setFont(undefined, "bold");
  doc.setFontSize(9);
  doc.text("LEGAL & MEDICAL NOTICE:", margin + 3, pos.y);
  pos.y += 5;
  doc.setFont(undefined, "normal");
  doc.setFontSize(8);
  const legal = doc.splitTextToSize(
    "This document is for educational purposes only. It is intended to help Veterans understand the relationship between their symptoms and the VA's rating criteria. This is not a legal filing, medical diagnosis, or substitute for professional medical or legal advice.",
    contentWidth - 10,
  );
  doc.text(legal, margin + 3, pos.y);

  doc.setTextColor(0, 0, 0);
  pos.y += legal.length * 4 + 15;
}

function _drawSupportBox(ctx) {
  const { doc, pos, colors, margin, contentWidth, pageWidth } = ctx;
  // Support Vet-Rate.org at bottom of last page

  // Prominent background box
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(...colors.vaGold);
  doc.setLineWidth(1);
  doc.roundedRect(margin - 5, pos.y - 8, contentWidth + 10, 40, 3, 3, "FD");

  // Centered heading
  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  doc.setTextColor(...colors.vaBlue);
  doc.text("Support Vet-Rate.org", pageWidth / 2, pos.y, {
    align: "center",
  });
  pos.y += 10;

  // Centered description
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...colors.darkGray);
  const supportText = doc.splitTextToSize(
    "This tool is free and built by veterans for veterans. We don't sell your data or show ads. If this PDF helped you with your claim, please consider supporting us. Every contribution helps keep this resource free for all veterans.",
    contentWidth - 15,
  );
  // Center each line
  supportText.forEach((line) => {
    doc.text(line, pageWidth / 2, pos.y, { align: "center" });
    pos.y += 5;
  });

  pos.y += 3;

  // Multiple funding options
  doc.setFont(undefined, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colors.accentBlue);
  doc.text(
    "☕ buymeacoffee.com/vetrate  |  💳 paypal.me/ajohnsonnow  |  💵 $ajnow (Cash App)  |  📱 @ajnow (Venmo)",
    pageWidth / 2,
    pos.y,
    { align: "center" },
  );
  doc.setTextColor(0, 0, 0);
}

function _drawLegalReferenceSection(ctx) {
  _drawCfrPart4Heading(ctx);
  _drawCfrPart4Principles(ctx);

  _drawCfrPart3Heading(ctx);
  _drawCfrPart3Rights(ctx);
  _drawDeadlinesBox(ctx);
  _drawLegalDisclosures(ctx);
  _drawSupportBox(ctx);
}

function _createPageBreakChecker(doc, pos, margin, pageHeight) {
  return (spaceNeeded = 30) => {
    if (pos.y + spaceNeeded > pageHeight - margin - 15) {
      doc.addPage();
      pos.y = margin + 10;
    }
  };
}

function _createPdfHelpers(
  doc,
  pos,
  colors,
  margin,
  contentWidth,
  checkPageBreak,
) {
  // Helper function to add heading with visual enhancement
  const addHeading = (text, level = 1) => {
    checkPageBreak(20);

    if (level === 1) {
      // Major section heading with background bar
      doc.setFillColor(...colors.vaBlue);
      doc.roundedRect(margin - 5, pos.y - 6, contentWidth + 10, 12, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont(undefined, "bold");
      doc.text(text, margin, pos.y);
      doc.setTextColor(0, 0, 0);
      pos.y += 15;
    } else if (level === 2) {
      // Subsection heading with accent line
      doc.setDrawColor(...colors.vaBlue);
      doc.setLineWidth(0.8);
      doc.line(margin, pos.y - 2, margin + 20, pos.y - 2);
      doc.setFontSize(13);
      doc.setFont(undefined, "bold");
      doc.setTextColor(...colors.darkGray);
      doc.text(text, margin, pos.y + 3);
      doc.setTextColor(0, 0, 0);
      pos.y += 10;
    } else {
      // Minor heading
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      doc.setTextColor(...colors.mediumGray);
      doc.text(text, margin, pos.y);
      doc.setTextColor(0, 0, 0);
      pos.y += 7;
    }
  };

  // Helper function to add body text with better spacing
  const addText = (text, size = 10, indent = 0) => {
    doc.setFontSize(size);
    doc.setFont(undefined, "normal");
    doc.setTextColor(...colors.darkGray);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    doc.text(lines, margin + indent, pos.y);
    pos.y += lines.length * (size * 0.5) + 3;
    doc.setTextColor(0, 0, 0);
  };

  // Helper function for info box
  const addInfoBox = (
    text,
    bgColor = colors.lightGray,
    borderColor = colors.mediumGray,
  ) => {
    checkPageBreak(25);
    const lines = doc.splitTextToSize(text, contentWidth - 10);
    const boxHeight = lines.length * 5 + 8;

    doc.setFillColor(...bgColor);
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, pos.y - 3, contentWidth, boxHeight, 1.5, 1.5, "FD");

    doc.setFontSize(9);
    doc.setTextColor(...colors.darkGray);
    doc.text(lines, margin + 5, pos.y + 2);
    doc.setTextColor(0, 0, 0);
    pos.y += boxHeight + 5;
  };

  return { addHeading, addText, addInfoBox };
}

function _drawFooter(doc, colors, pageWidth, pageHeight) {
  // Footer with enhanced styling
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Footer background bar
    doc.setFillColor(...colors.lightGray);
    doc.rect(0, pageHeight - 18, pageWidth, 18, "F");

    // Footer accent line
    doc.setDrawColor(...colors.vaGold);
    doc.setLineWidth(0.8);
    doc.line(0, pageHeight - 18, pageWidth, pageHeight - 18);

    // Page number
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...colors.mediumGray);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, {
      align: "center",
    });

    // Footer text
    doc.setFont(undefined, "normal");
    doc.setFontSize(7);
    doc.text(
      "Generated by Vet-Rate.org - VA Disability Rating Information System | www.vet-rate.org",
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" },
    );
    doc.setTextColor(0, 0, 0);
  }
}

export const generatePDF = (result, searchTerm) => {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Set document metadata
    doc.setProperties({
      title: `Vet-Rate.org - ${result.conditionName} (DC ${result.diagnosticCode})`,
      subject: "VA Disability Rating Information",
      author: "Vet-Rate.org",
      keywords: "VA, disability, rating, veterans, 38 CFR Part 4",
      creator: "Vet-Rate.org",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    const pos = { y: margin };

    // Color palette - Forest Green Theme
    const colors = {
      vaBlue: [45, 80, 22],
      vaGold: [136, 176, 75],
      darkGray: [55, 65, 81],
      mediumGray: [107, 114, 128],
      lightGray: [243, 244, 246],
      accentBlue: [88, 129, 87],
      warningRed: [239, 68, 68],
      successGreen: [52, 168, 83],
    };

    const checkPageBreak = _createPageBreakChecker(
      doc,
      pos,
      margin,
      pageHeight,
    );
    const { addHeading, addText, addInfoBox } = _createPdfHelpers(
      doc,
      pos,
      colors,
      margin,
      contentWidth,
      checkPageBreak,
    );

    const ctx = {
      doc,
      pos,
      colors,
      margin,
      contentWidth,
      pageWidth,
      pageHeight,
      checkPageBreak,
      addHeading,
      addText,
      addInfoBox,
      result,
      searchTerm,
    };

    _drawTitleAndConditionSections(ctx);
    _drawRatingCriteriaSection(ctx);
    _drawDocumentationAndSecondarySection(ctx);
    _drawSupportResourcesSection(ctx);
    _drawGlossaryAndToolkitSection(ctx);
    _drawDoctorInfoSection(ctx);
    _drawLegalReferenceSection(ctx);

    _drawFooter(doc, colors, pageWidth, pageHeight);

    // Save the PDF
    const filename = `VA-Disability-${result.diagnosticCode}-${new Date().getTime()}.pdf`;
    doc.save(filename);

    return { success: true, filename };
  } catch (error) {
    console.error("PDF generation error:", error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};
