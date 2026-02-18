/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 *
 * Packet Commander - Claim Cover Sheet Generator
 * Generates a professional Table of Contents for VA claim submission packets.
 * Helps VA raters quickly navigate organized claim evidence.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Generate a Claim Cover Sheet / Table of Contents
 * @param {Object} options - Cover sheet options
 * @param {string} options.veteranName - Full name of veteran
 * @param {string} options.ssn - Social Security Number (will be partially masked)
 * @param {Array} options.documents - Array of document objects
 * @param {string} options.claimType - Type of claim (e.g., "Initial", "Supplemental", "Appeal")
 * @param {string} options.date - Submission date (defaults to today)
 * @returns {Promise<Uint8Array>} PDF bytes
 */
export async function generateCoverSheet(options) {
  const {
    veteranName = 'Veteran Name',
    ssn = '',
    documents = [],
    claimType = 'Disability Claim',
    date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  } = options;

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size: 8.5" x 11"
  const { width, height } = page.getSize();

  // Embed fonts
  const titleFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const headerFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  let yPosition = height - 60;
  const leftMargin = 72; // 1 inch
  const rightMargin = width - 72;

  // Helper function to draw text
  const drawText = (text, font, size, options = {}) => {
    page.drawText(text, {
      x: options.x || leftMargin,
      y: yPosition,
      size: size,
      font: font,
      color: rgb(0, 0, 0),
      ...options
    });
  };

  // Helper function to draw centered text
  const drawCenteredText = (text, font, size) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    const xPosition = (width - textWidth) / 2;
    drawText(text, font, size, { x: xPosition });
  };

  // Helper function to draw line
  const drawLine = (y, thickness = 1) => {
    page.drawLine({
      start: { x: leftMargin, y },
      end: { x: rightMargin, y },
      thickness: thickness,
      color: rgb(0, 0, 0)
    });
  };

  // ==========================================
  // HEADER SECTION
  // ==========================================

  // Main Title
  drawCenteredText('CLAIM EVIDENCE PACKET', titleFont, 20);
  yPosition -= 30;

  drawCenteredText('TABLE OF CONTENTS', titleFont, 16);
  yPosition -= 10;

  // Decorative line
  drawLine(yPosition, 2);
  yPosition -= 30;

  // ==========================================
  // VETERAN INFORMATION SECTION
  // ==========================================

  drawText('CLAIMANT INFORMATION:', headerFont, 12);
  yPosition -= 20;

  // Veteran name
  drawText('Name:', bodyFont, 11);
  drawText(veteranName, headerFont, 11, { x: leftMargin + 100 });
  yPosition -= 16;

  // SSN (partially masked for security)
  const maskedSSN = ssn ? `XXX-XX-${ssn.slice(-4)}` : 'XXX-XX-XXXX';
  drawText('SSN:', bodyFont, 11);
  drawText(maskedSSN, bodyFont, 11, { x: leftMargin + 100 });
  yPosition -= 16;

  // Claim Type
  drawText('Claim Type:', bodyFont, 11);
  drawText(claimType, bodyFont, 11, { x: leftMargin + 100 });
  yPosition -= 16;

  // Submission Date
  drawText('Submitted:', bodyFont, 11);
  drawText(date, bodyFont, 11, { x: leftMargin + 100 });
  yPosition -= 30;

  // Separator line
  drawLine(yPosition, 1);
  yPosition -= 30;

  // ==========================================
  // DOCUMENT LIST SECTION
  // ==========================================

  drawText('ENCLOSED EVIDENCE:', headerFont, 12);
  yPosition -= 25;

  if (documents.length === 0) {
    drawText('No documents listed.', italicFont, 11);
    yPosition -= 20;
  } else {
    let exhibitLetter = 'A';
    
    for (const doc of documents) {
      // Check if we need a new page
      if (yPosition < 100) {
        const newPage = pdfDoc.addPage([612, 792]);
        yPosition = height - 60;
        // Continue on new page
      }

      // Exhibit label
      const exhibitLabel = `Exhibit ${exhibitLetter}:`;
      drawText(exhibitLabel, headerFont, 11);
      
      // Document name
      const docName = doc.name || 'Untitled Document';
      drawText(docName, bodyFont, 11, { x: leftMargin + 80 });
      yPosition -= 16;

      // Page range (if provided)
      if (doc.pages) {
        const pageInfo = doc.pages === 1 
          ? `(Page ${doc.startPage || '-'})` 
          : `(Pages ${doc.startPage || '-'} - ${doc.endPage || '-'})`;
        drawText(pageInfo, italicFont, 10, { x: leftMargin + 80 });
        yPosition -= 16;
      }

      // Description (if provided)
      if (doc.description) {
        const descriptionLines = wrapText(doc.description, 60);
        for (const line of descriptionLines) {
          if (yPosition < 100) {
            const newPage = pdfDoc.addPage([612, 792]);
            yPosition = height - 60;
          }
          drawText(line, italicFont, 9, { x: leftMargin + 80 });
          yPosition -= 14;
        }
      }

      yPosition -= 8; // Extra space between items

      // Move to next exhibit letter
      exhibitLetter = String.fromCharCode(exhibitLetter.charCodeAt(0) + 1);
    }
  }

  yPosition -= 20;

  // ==========================================
  // FOOTER SECTION
  // ==========================================

  // Check if we have space for footer, if not add new page
  if (yPosition < 150) {
    const newPage = pdfDoc.addPage([612, 792]);
    yPosition = height - 60;
  }

  // Separator line
  drawLine(yPosition, 1);
  yPosition -= 30;

  // Organization statement
  drawText('CERTIFICATION OF ORGANIZATION:', headerFont, 11);
  yPosition -= 20;

  const certificationText = [
    'I certify that the enclosed documents are true and complete copies of the evidence',
    'referenced in this Table of Contents. Each exhibit is clearly labeled and organized',
    'for efficient review by the Department of Veterans Affairs.'
  ];

  for (const line of certificationText) {
    drawText(line, bodyFont, 10);
    yPosition -= 14;
  }

  yPosition -= 30;

  // Signature line
  drawText('Claimant Signature:', bodyFont, 11);
  drawText('_________________________________', bodyFont, 11, { x: leftMargin + 130 });
  yPosition -= 10;
  drawText('Date:', bodyFont, 11, { x: leftMargin + 280 });
  drawText('_______________', bodyFont, 11, { x: leftMargin + 315 });
  yPosition -= 40;

  // Footer note
  const footerText = 'This cover sheet was generated by VetRate.org - A free tool for veterans by veterans.';
  const footerWidth = bodyFont.widthOfTextAtSize(footerText, 8);
  drawText(footerText, italicFont, 8, { 
    x: (width - footerWidth) / 2,
    color: rgb(0.4, 0.4, 0.4) 
  });

  return await pdfDoc.save();
}

/**
 * Wrap text to fit within a character limit
 * @param {string} text - Text to wrap
 * @param {number} maxChars - Maximum characters per line
 * @returns {string[]} Array of text lines
 */
function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length <= maxChars) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Auto-detect documents from saved forms
 * @param {Object} savedForms - Saved forms from veteranProfile
 * @returns {Array} Array of document objects
 */
export function autoDetectDocuments(savedForms) {
  const documents = [];
  let currentPage = 1;

  // Common form types
  const formTypes = [
    { key: 'personal-statement', name: 'Personal Statement (VA Form 21-4138)', pages: 2 },
    { key: 'buddy-statement', name: 'Lay/Witness Statement (VA Form 21-10210)', pages: 3 },
    { key: 'ptsd-stressor', name: 'PTSD Stressor Statement (VA Form 21-0781)', pages: 4 },
    { key: 'medical-release', name: 'Authorization for Medical Records (VA Form 21-4142)', pages: 2 },
    { key: 'intent-to-file', name: 'Intent to File (VA Form 21-0966)', pages: 1 },
    { key: 'vso-appointment', name: 'VSO Appointment (VA Form 21-22)', pages: 2 },
    { key: 'nexus-letter', name: 'Medical Nexus Letter', pages: 1 },
    { key: 'service-records', name: 'Service Treatment Records', pages: 5 },
    { key: 'medical-records', name: 'Private Medical Records', pages: 10 },
    { key: 'buddy-letters', name: 'Additional Buddy Statements', pages: 3 }
  ];

  for (const formType of formTypes) {
    if (savedForms && savedForms[formType.key]) {
      documents.push({
        name: formType.name,
        pages: formType.pages,
        startPage: currentPage,
        endPage: currentPage + formType.pages - 1,
        description: `Completed ${formType.name}`
      });
      currentPage += formType.pages;
    }
  }

  return documents;
}

/**
 * Download the cover sheet as a PDF
 * @param {Uint8Array} pdfBytes - PDF data
 * @param {string} fileName - File name (without extension)
 */
export function downloadCoverSheet(pdfBytes, fileName = 'Claim_Cover_Sheet') {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate HTML version of cover sheet (for preview)
 * @param {Object} options - Same options as generateCoverSheet
 * @returns {string} HTML string
 */
export function generateCoverSheetHTML(options) {
  const {
    veteranName = 'Veteran Name',
    ssn = '',
    documents = [],
    claimType = 'Disability Claim',
    date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  } = options;

  const maskedSSN = ssn ? `XXX-XX-${ssn.slice(-4)}` : 'XXX-XX-XXXX';
  
  let documentsList = '';
  if (documents.length === 0) {
    documentsList = '<p style="font-style: italic; color: #666;">No documents listed.</p>';
  } else {
    let exhibitLetter = 'A';
    documentsList = '<div style="margin-top: 20px;">';
    for (const doc of documents) {
      const pageInfo = doc.pages === 1 
        ? `(Page ${doc.startPage || '-'})` 
        : `(Pages ${doc.startPage || '-'} - ${doc.endPage || '-'})`;
      
      documentsList += `
        <div style="margin-bottom: 16px;">
          <strong>Exhibit ${exhibitLetter}:</strong> ${doc.name} ${pageInfo}
          ${doc.description ? `<br><span style="font-style: italic; font-size: 0.9em; color: #555; margin-left: 60px;">${doc.description}</span>` : ''}
        </div>
      `;
      exhibitLetter = String.fromCharCode(exhibitLetter.charCodeAt(0) + 1);
    }
    documentsList += '</div>';
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Claim Evidence Packet - Table of Contents</title>
      <style>
        @page {
          size: letter;
          margin: 1in;
        }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #000;
          max-width: 7.5in;
          margin: 0 auto;
          padding: 0.5in;
        }
        h1 {
          text-align: center;
          font-size: 20pt;
          font-weight: bold;
          margin-bottom: 10px;
        }
        h2 {
          text-align: center;
          font-size: 16pt;
          font-weight: bold;
          margin-bottom: 20px;
        }
        .section-title {
          font-weight: bold;
          font-size: 12pt;
          margin-top: 30px;
          margin-bottom: 15px;
        }
        .info-row {
          margin-bottom: 8px;
        }
        .info-label {
          display: inline-block;
          width: 120px;
          font-weight: normal;
        }
        .info-value {
          font-weight: bold;
        }
        hr {
          border: none;
          border-top: 2px solid #000;
          margin: 20px 0;
        }
        hr.thin {
          border-top: 1px solid #000;
        }
        .certification {
          margin-top: 30px;
          line-height: 1.6;
        }
        .signature-line {
          margin-top: 40px;
          margin-bottom: 10px;
        }
        .footer {
          text-align: center;
          font-style: italic;
          font-size: 9pt;
          color: #666;
          margin-top: 50px;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <h1>CLAIM EVIDENCE PACKET</h1>
      <h2>TABLE OF CONTENTS</h2>
      <hr>

      <div class="section-title">CLAIMANT INFORMATION:</div>
      <div class="info-row">
        <span class="info-label">Name:</span>
        <span class="info-value">${veteranName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">SSN:</span>
        <span class="info-value">${maskedSSN}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Claim Type:</span>
        <span class="info-value">${claimType}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Submitted:</span>
        <span class="info-value">${date}</span>
      </div>

      <hr class="thin">

      <div class="section-title">ENCLOSED EVIDENCE:</div>
      ${documentsList}

      <hr class="thin">

      <div class="certification">
        <div class="section-title">CERTIFICATION OF ORGANIZATION:</div>
        <p>
          I certify that the enclosed documents are true and complete copies of the evidence
          referenced in this Table of Contents. Each exhibit is clearly labeled and organized
          for efficient review by the Department of Veterans Affairs.
        </p>
      </div>

      <div class="signature-line">
        <span class="info-label">Claimant Signature:</span> _________________________________
        <span style="margin-left: 40px;">Date:</span> _______________
      </div>

      <div class="footer">
        This cover sheet was generated by VetRate.org - A free tool for veterans by veterans.
      </div>

      <div class="no-print" style="margin-top: 40px; text-align: center;">
        <button onclick="window.print()" style="padding: 12px 24px; font-size: 14pt; cursor: pointer; background: #0050d8; color: white; border: none; border-radius: 6px;">
          🖨️ Print Cover Sheet
        </button>
      </div>
    </body>
    </html>
  `;
}

export default {
  generateCoverSheet,
  generateCoverSheetHTML,
  autoDetectDocuments,
  downloadCoverSheet
};
