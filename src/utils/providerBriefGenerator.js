import { jsPDF } from 'jspdf';
import templates from '../data/provider_brief_templates.json';

/**
 * Provider Brief Generator
 * 
 * Purpose: Generate professional medical opinion request documents that:
 * 1. Translate VA legalese into clinical questions
 * 2. Provide "Safe Harbor" language to reduce provider liability concerns
 * 3. Include example nexus language for providers to use (if appropriate)
 * 
 * Philosophy: "Doctors aren't lawyers. Ask medical questions, not legal ones."
 * 
 * @param {string} conditionType - Key from provider_brief_templates.json
 * @param {Object} userProfile - Patient demographic data
 * @param {Object} options - Additional customization options
 * @returns {jsPDF} PDF document ready for download
 */
export const generateProviderBrief = (conditionType, userProfile, options = {}) => {
  const doc = new jsPDF();
  const template = templates.templates[conditionType];

  if (!template) {
    throw new Error(`Template not found for condition type: ${conditionType}`);
  }

  const {
    includePatientHistory = false,
    additionalNotes = '',
    appointmentDate = null
  } = options;

  // Page margins
  const margin = 20;
  const pageWidth = doc.internal.pageSize.width;
  const maxWidth = pageWidth - (margin * 2);
  let yPos = 20;

  // ========================================
  // HEADER: Professional & Non-Threatening
  // ========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PATIENT ADVOCACY BRIEF', margin, yPos);
  
  yPos += 7;
  doc.setFontSize(14);
  doc.text('Medical Opinion Request', margin, yPos);
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Patient Info Bar
  const patientName = `${userProfile.lastName || '[Last Name]'}, ${userProfile.firstName || '[First Name]'}`;
  const patientDOB = userProfile.dob || '[Date of Birth]';
  
  doc.text(`Patient: ${patientName}`, margin, yPos);
  doc.text(`DOB: ${patientDOB}`, pageWidth - margin - 40, yPos);
  
  yPos += 5;
  if (appointmentDate) {
    doc.text(`Appointment Date: ${appointmentDate}`, margin, yPos);
    yPos += 5;
  }
  
  doc.text(`Target Provider: ${template.target_audience}`, margin, yPos);
  
  yPos += 10;

  // ========================================
  // SECTION 1: The "Safe Harbor" Statement
  // Critical for reducing provider anxiety
  // ========================================
  doc.setFillColor(240, 248, 255); // Light blue (Alice Blue)
  const safeHarborHeight = 28;
  doc.rect(margin - 5, yPos - 5, maxWidth + 10, safeHarborHeight, 'F');
  
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(9);
  doc.text('Important Note for Healthcare Provider:', margin, yPos);
  
  yPos += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  
  const safeHarborText = 
    'This document is designed to assist in communicating your clinical findings to the Department ' +
    'of Veterans Affairs. The patient is NOT requesting a specific diagnosis or asking you to advocate ' +
    'on their behalf. We are simply asking for your honest clinical opinion based on your examination ' +
    'and treatment history. Please rely solely on your medical judgment. The VA\'s evidentiary standard ' +
    'is "at least as likely as not" (>50% probability), which is LOWER than the "reasonable medical ' +
    'certainty" standard used in most legal contexts.';
  
  const safeHarborLines = doc.splitTextToSize(safeHarborText, maxWidth - 5);
  doc.text(safeHarborLines, margin, yPos);
  
  yPos += safeHarborHeight;

  // ========================================
  // SECTION 2: Condition & Educational Context
  // ========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Condition: ${template.title}`, margin, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  
  const educationLines = doc.splitTextToSize(
    `VA Rating Context: ${template.education_point}`,
    maxWidth
  );
  doc.text(educationLines, margin, yPos);
  
  yPos += (educationLines.length * 5) + 5;
  doc.setTextColor(0, 0, 0);

  // CFR Citation (legal reference for legitimacy)
  if (template.cfr_citation) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Legal Reference: ${template.cfr_citation}`, margin, yPos);
    yPos += 8;
    doc.setTextColor(0, 0, 0);
  }

  // ========================================
  // SECTION 3: Clinical Questions (The Core)
  // ========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Clinical Questions for Provider Review:', margin, yPos);
  
  yPos += 7;

  template.required_verbiage.forEach((item, index) => {
    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Question number and concept
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${index + 1}. ${item.concept}`, margin + 5, yPos);
    
    yPos += 6;
    
    // The actual question
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const questionLines = doc.splitTextToSize(item.doctor_ask, maxWidth - 10);
    doc.text(questionLines, margin + 10, yPos);
    
    yPos += (questionLines.length * 4) + 3;
    
    // Why it matters (rating relevance)
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    const relevanceLines = doc.splitTextToSize(
      `Why it matters: ${item.rating_relevance}`,
      maxWidth - 10
    );
    doc.text(relevanceLines, margin + 10, yPos);
    
    yPos += (relevanceLines.length * 4) + 8;
    doc.setTextColor(0, 0, 0);
  });

  // ========================================
  // SECTION 4: Nexus Language "Cheat Sheet"
  // (Only if nexus is required for this condition)
  // ========================================
  if (template.nexus_language_options && template.nexus_language_options.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Suggested Verbiage (If Clinically Supported):', margin, yPos);
    
    yPos += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text('You may use any of the following statements if they accurately reflect your clinical opinion:', margin, yPos);
    
    yPos += 8;
    doc.setTextColor(0, 0, 0);

    // Display nexus options in "copyable" format (monospace)
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    
    template.nexus_language_options.forEach((option) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      const optionLines = doc.splitTextToSize(`"${option}"`, maxWidth - 10);
      doc.text(optionLines, margin + 5, yPos);
      yPos += (optionLines.length * 4) + 5;
    });
  }

  // ========================================
  // SECTION 5: Response Section (Fill-in area)
  // ========================================
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Provider Response Section:', margin, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Please provide your clinical opinion based on the questions above. Your notes below will be submitted to the VA.', margin, yPos);
  
  yPos += 10;

  // Draw response box
  doc.setDrawColor(150, 150, 150);
  doc.rect(margin, yPos, maxWidth, 40);
  
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('(Provider: Please write your clinical opinion here or attach a separate note)', margin + 2, yPos + 5);

  yPos += 50;

  // Signature line
  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(0, 0, 0);
  doc.line(margin, yPos, margin + 80, yPos);
  doc.setFontSize(8);
  doc.text('Provider Signature', margin, yPos + 5);
  
  doc.line(margin + 100, yPos, margin + 150, yPos);
  doc.text('Date', margin + 100, yPos + 5);

  // ========================================
  // FOOTER: Disclaimer
  // ========================================
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'italic');
  const footerText = 'This document is for informational purposes only and does not constitute legal or medical advice. Generated by VetRate.org - A free veteran advocacy tool.';
  const footerLines = doc.splitTextToSize(footerText, maxWidth);
  doc.text(footerLines, margin, doc.internal.pageSize.height - 15);

  return doc;
};

/**
 * Download the generated PDF
 * 
 * @param {jsPDF} doc - The PDF document
 * @param {string} filename - Desired filename (without .pdf extension)
 */
export const downloadProviderBrief = (doc, filename = 'provider_brief') => {
  doc.save(`${filename}.pdf`);
};

/**
 * Generate and download in one step
 * 
 * @param {string} conditionType - Template key
 * @param {Object} userProfile - Patient data
 * @param {Object} options - Generation options
 */
export const generateAndDownload = (conditionType, userProfile, options = {}) => {
  const doc = generateProviderBrief(conditionType, userProfile, options);
  const safeFilename = `provider_brief_${conditionType.toLowerCase()}_${new Date().toISOString().split('T')[0]}`;
  downloadProviderBrief(doc, safeFilename);
};

// ========================================
// VSO HANDOFF REPORT ("The Eject Button")
// ========================================

/**
 * Generate VSO Professional Handoff Dossier
 * 
 * Purpose: Allow veterans to hand their case to a VSO (Veterans Service Officer)
 * without starting from scratch. This is the "eject button" when the veteran
 * realizes they need professional help.
 * 
 * The Problem: Some veterans will use the tool, see the complexity, and panic. 
 * Or, they will go to a VSO and the VSO will ignore their "app data" because 
 * they don't want to look at a phone screen.
 * 
 * The Fix: A 1-page PDF summary written in VSO language (codes, dates, regulations)
 * that allows the veteran to hand the case over to a professional without losing
 * all their research and data entry work.
 * 
 * @param {Object} userProfile - Veteran demographic and eligibility data
 * @param {Array} claimsList - Array of claim objects with scores and strategies
 * @param {Object} options - Additional options
 * @returns {jsPDF} PDF document ready for download
 */
export const generateVSOHandoff = (userProfile, claimsList, options = {}) => {
  const doc = new jsPDF();
  
  const {
    includeAllClaims = false, // If false, only show high viability (>60% score)
    includeWarGameResults = false
  } = options;

  const margin = 20;
  const pageWidth = doc.internal.pageSize.width;
  const maxWidth = pageWidth - (margin * 2);
  let yPos = 20;

  // ========================================
  // HEADER: Professional Handoff
  // ========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CASE SUMMARY: PRE-DEVELOPED CLAIMS DOSSIER', margin, yPos);
  
  yPos += 7;
  doc.setFontSize(10);
  doc.text('Prepared for: Accredited VSO / Claims Agent', margin, yPos);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin - 40, yPos);
  
  yPos += 10;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  const headerNote = 'This dossier contains pre-analyzed claim strategies developed by the veteran using VetRate.org. All data is sourced from the veteran\'s discharge documents and self-reported medical history.';
  const headerLines = doc.splitTextToSize(headerNote, maxWidth);
  doc.text(headerLines, margin, yPos);
  
  yPos += (headerLines.length * 4) + 10;

  // ========================================
  // SECTION 1: Eligibility Snapshot (Saves VSO time)
  // ========================================
  doc.setFillColor(230, 230, 230);
  doc.rect(margin - 5, yPos - 5, maxWidth + 10, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ELIGIBILITY DATA (Verified via DD-214)', margin, yPos);
  
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  const eligibility = [
    `• Service Era: ${userProfile.serviceEra || 'Unknown'}`,
    `• Discharge Character: ${userProfile.dischargeStatus || 'Honorable'} (SPN Code: ${userProfile.spnCode || 'N/A'})`,
    `• PACT Act Eligibility: ${userProfile.pactStatus ? 'ELIGIBLE (Confirmed)' : 'Not Found / Pending Verification'}`,
    `• Combat Verification: ${userProfile.hasCombatMedal ? 'YES (Combat Awards Present in DD-214)' : 'Pending Verification'}`,
    `• Service Dates: ${userProfile.serviceStartDate || 'N/A'} to ${userProfile.serviceEndDate || 'N/A'}`
  ];
  
  eligibility.forEach(line => {
    doc.text(line, margin + 5, yPos);
    yPos += 5;
  });
  
  yPos += 10;

  // ========================================
  // SECTION 2: Developed Claims (The Value Prop)
  // ========================================
  doc.setFillColor(230, 230, 230);
  doc.rect(margin - 5, yPos - 5, maxWidth + 10, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DEVELOPED CLAIM STRATEGIES', margin, yPos);
  
  yPos += 10;

  // Filter claims based on options
  const filteredClaims = includeAllClaims 
    ? claimsList 
    : claimsList.filter(claim => claim.score > 60);

  if (filteredClaims.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No high-viability claims developed yet.', margin + 5, yPos);
    yPos += 10;
  } else {
    filteredClaims.forEach((claim, index) => {
      // Page break check
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Claim header with viability score
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const scoreColor = claim.score >= 80 ? 'green' : claim.score >= 60 ? 'blue' : 'orange';
      doc.setTextColor(scoreColor === 'green' ? 0 : 0, scoreColor === 'blue' ? 0 : 0, 0);
      doc.text(`[${claim.score}% Viability] ${claim.name}`, margin + 5, yPos);
      doc.setTextColor(0, 0, 0);
      
      yPos += 6;
      
      // Theory/Strategy
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Theory: ${claim.strategyNote || 'Direct service connection'}`, margin + 10, yPos);
      
      yPos += 5;
      
      // Evidence readiness
      const requirementsMet = claim.requirements ? claim.requirements.filter(r => r.met).length : 0;
      const requirementsTotal = claim.requirements ? claim.requirements.length : 0;
      doc.text(`Evidence Ready: ${requirementsMet}/${requirementsTotal} items`, margin + 10, yPos);
      
      yPos += 5;

      // Category and tags
      if (claim.category) {
        doc.text(`Category: ${claim.category}`, margin + 10, yPos);
        yPos += 5;
      }

      if (claim.tags && claim.tags.length > 0) {
        doc.text(`Tags: ${claim.tags.join(', ')}`, margin + 10, yPos);
        yPos += 5;
      }

      // Presumptive indicator
      if (claim.isPresumptive) {
        doc.setFont('helvetica', 'bolditalic');
        doc.text('⚡ PRESUMPTIVE CONDITION (Lower evidence burden)', margin + 10, yPos);
        doc.setFont('helvetica', 'normal');
        yPos += 5;
      }

      yPos += 8;
    });
  }

  // ========================================
  // SECTION 3: Next Steps for VSO
  // ========================================
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 10;
  doc.setFillColor(230, 230, 230);
  doc.rect(margin - 5, yPos - 5, maxWidth + 10, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('RECOMMENDED NEXT STEPS', margin, yPos);
  
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const nextSteps = [
    '1. Verify eligibility data against DD-214 (copy should be attached)',
    '2. Review high-viability claims (>60% score) for immediate filing',
    '3. Order Service Treatment Records (STRs) if not already obtained',
    '4. Request VA medical records via Blue Button or FOIA',
    '5. Schedule C&P exams for developed conditions',
    '6. Consider secondary claims after primaries are service-connected'
  ];

  nextSteps.forEach(step => {
    doc.text(step, margin + 5, yPos);
    yPos += 5;
  });

  // ========================================
  // FOOTER: Contact & Disclaimer
  // ========================================
  yPos = doc.internal.pageSize.height - 25;
  
  doc.setFillColor(245, 245, 245);
  doc.rect(0, yPos - 5, pageWidth, 30, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Veteran Contact Information:', margin, yPos);
  
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Name: ${userProfile.firstName || '[First Name]'} ${userProfile.lastName || '[Last Name]'}`, margin, yPos);
  doc.text(`Phone: ${userProfile.phone || '[Phone Number]'}`, pageWidth / 2, yPos);
  
  yPos += 5;
  doc.text(`Email: ${userProfile.email || '[Email Address]'}`, margin, yPos);
  doc.text(`SSN: ${userProfile.ssn ? '***-**-' + userProfile.ssn.slice(-4) : '[Last 4 digits]'}`, pageWidth / 2, yPos);

  yPos += 8;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Generated by VetRate.org - Free veteran advocacy software. Not legal advice. VSO verification required.', margin, yPos);

  return doc;
};

/**
 * Download VSO Handoff Report
 * 
 * @param {jsPDF} doc - The PDF document
 * @param {string} veteranLastName - Veteran's last name for filename
 */
export const downloadVSOHandoff = (doc, veteranLastName = 'veteran') => {
  const safeFilename = `VSO_Handoff_${veteranLastName}_${new Date().toISOString().split('T')[0]}`;
  doc.save(`${safeFilename}.pdf`);
};

/**
 * Generate and download VSO Handoff in one step
 * 
 * @param {Object} userProfile - Veteran data
 * @param {Array} claimsList - Claims array
 * @param {Object} options - Generation options
 */
export const generateAndDownloadVSOHandoff = (userProfile, claimsList, options = {}) => {
  const doc = generateVSOHandoff(userProfile, claimsList, options);
  downloadVSOHandoff(doc, userProfile.lastName || 'veteran');
};
