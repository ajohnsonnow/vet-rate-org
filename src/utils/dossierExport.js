/**
 * Vet-Rate.org - Dossier Export
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * "The Bus Factor" Export - Full Data Portability
 * Generates a standalone HTML file containing ALL user data
 * in a human-readable format that works offline forever.
 *
 * This ensures veterans own their data independent of the platform.
 */

import { exportData } from "./dataBackup";
import { triggerBlobDownload, safeOpenBlobUrl } from "./sanitize";

// Storage keys for different data types
const DATA_SOURCES = {
  claims: "vet_rate_saved_claims",
  statements: "vet_rate_statements",
  profile: "vet_rate_veteran_profile",
  forms: "vet_rate_saved_forms",
  ratings: "vet_rate_my_ratings",
};

/**
 * Safely parse JSON from localStorage
 * @param {string} key - localStorage key
 * @returns {any} Parsed data or null
 */
function safeGetData(key) {
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Format a date for display
 * @param {string|number} dateValue - Date string or timestamp
 * @returns {string} Formatted date
 */
function formatDate(dateValue) {
  if (!dateValue) return "N/A";
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateValue);
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Generate HTML for the veteran profile section
 * @param {Object} profile - Profile data
 * @returns {string} HTML string
 */
function generateProfileSection(profile) {
  if (!profile) {
    return `
      <section class="section">
        <h2>📋 Veteran Profile</h2>
        <p class="empty-notice">No profile information saved.</p>
      </section>
    `;
  }

  return `
    <section class="section">
      <h2>📋 Veteran Profile</h2>
      <div class="profile-grid">
        <div class="profile-item">
          <span class="label">Name:</span>
          <span class="value">${escapeHtml(profile.name || "Not provided")}</span>
        </div>
        <div class="profile-item">
          <span class="label">Branch:</span>
          <span class="value">${escapeHtml(profile.branch || "Not provided")}</span>
        </div>
        <div class="profile-item">
          <span class="label">Service Dates:</span>
          <span class="value">${escapeHtml(profile.startDate || "?")} - ${escapeHtml(profile.endDate || "?")}</span>
        </div>
        <div class="profile-item">
          <span class="label">Current Combined Rating:</span>
          <span class="value">${profile.currentRating || 0}%</span>
        </div>
        ${
          profile.mos
            ? `
        <div class="profile-item">
          <span class="label">MOS/Rating:</span>
          <span class="value">${escapeHtml(profile.mos)}</span>
        </div>
        `
            : ""
        }
        ${
          profile.deployments
            ? `
        <div class="profile-item">
          <span class="label">Deployments:</span>
          <span class="value">${escapeHtml(profile.deployments)}</span>
        </div>
        `
            : ""
        }
      </div>
      <p class="timestamp">Last updated: ${formatDate(profile.lastUpdated)}</p>
    </section>
  `;
}

/**
 * Generate HTML for saved claims section
 * @param {Array} claims - Claims data
 * @returns {string} HTML string
 */
function generateClaimsSection(claims) {
  if (!claims || !Array.isArray(claims) || claims.length === 0) {
    return `
      <section class="section">
        <h2>📑 Saved Claims</h2>
        <p class="empty-notice">No saved claims found.</p>
      </section>
    `;
  }

  const claimCards = claims
    .map(
      (claim, index) => `
    <div class="claim-card ${claim.claimType === "secondary" ? "secondary" : "primary"}">
      <div class="claim-header">
        <h3>${escapeHtml(claim.name || claim.condition || `Claim ${index + 1}`)}</h3>
        <span class="badge ${claim.claimType}">${escapeHtml(claim.claimType || "Primary")}</span>
      </div>
      ${
        claim.primaryCondition
          ? `
        <p class="secondary-link">Secondary to: <strong>${escapeHtml(claim.primaryCondition)}</strong></p>
      `
          : ""
      }
      ${
        claim.diagnosticCode
          ? `
        <p><strong>Diagnostic Code:</strong> ${escapeHtml(claim.diagnosticCode)}</p>
      `
          : ""
      }
      ${
        claim.status
          ? `
        <p><strong>Status:</strong> ${escapeHtml(claim.status)}</p>
      `
          : ""
      }
      ${
        claim.rating
          ? `
        <p><strong>Expected Rating:</strong> ${claim.rating}%</p>
      `
          : ""
      }
      ${
        claim.notes
          ? `
        <div class="notes">
          <strong>Notes:</strong>
          <p>${escapeHtml(claim.notes)}</p>
        </div>
      `
          : ""
      }
      <p class="timestamp">Added: ${formatDate(claim.dateAdded || claim.createdAt)}</p>
    </div>
  `,
    )
    .join("");

  return `
    <section class="section">
      <h2>📑 Saved Claims (${claims.length})</h2>
      <div class="claims-grid">
        ${claimCards}
      </div>
    </section>
  `;
}

/**
 * Generate HTML for statements section
 * @param {Array} statements - Statements data
 * @returns {string} HTML string
 */
function generateStatementsSection(statements) {
  if (!statements || !Array.isArray(statements) || statements.length === 0) {
    return `
      <section class="section">
        <h2>📝 Personal Statements</h2>
        <p class="empty-notice">No personal statements saved.</p>
      </section>
    `;
  }

  const statementCards = statements
    .map(
      (stmt, index) => `
    <div class="statement-card">
      <div class="statement-header">
        <h3>${escapeHtml(stmt.condition || stmt.title || `Statement ${index + 1}`)}</h3>
        ${stmt.aiEnhanced ? '<span class="badge ai">AI Enhanced</span>' : ""}
      </div>
      ${
        stmt.claimType
          ? `
        <p><strong>Claim Type:</strong> ${escapeHtml(stmt.claimType)}</p>
      `
          : ""
      }
      ${
        stmt.primaryCondition
          ? `
        <p><strong>Primary Condition:</strong> ${escapeHtml(stmt.primaryCondition)}</p>
      `
          : ""
      }
      <div class="statement-content">
        <h4>Statement Text:</h4>
        <div class="statement-text">
          ${escapeHtml(stmt.statement || stmt.content || "No content").replace(/\n/g, "<br>")}
        </div>
      </div>
      ${
        stmt.answers
          ? `
        <div class="statement-answers">
          <h4>Original Answers:</h4>
          <dl>
            ${Object.entries(stmt.answers)
              .filter(([, value]) => value)
              .map(
                ([key, value]) => `
                <dt>${escapeHtml(key.replace(/([A-Z])/g, " $1").trim())}:</dt>
                <dd>${escapeHtml(String(value))}</dd>
              `,
              )
              .join("")}
          </dl>
        </div>
      `
          : ""
      }
      <p class="timestamp">Created: ${formatDate(stmt.dateCreated || stmt.createdAt)}</p>
    </div>
  `,
    )
    .join('<hr class="statement-divider">');

  return `
    <section class="section">
      <h2>📝 Personal Statements (${statements.length})</h2>
      ${statementCards}
    </section>
  `;
}

/**
 * Generate HTML for ratings section
 * @param {Object|Array} ratings - Ratings data
 * @returns {string} HTML string
 */
function generateRatingsSection(ratings) {
  if (!ratings) {
    return `
      <section class="section">
        <h2>📊 My Ratings</h2>
        <p class="empty-notice">No ratings data saved.</p>
      </section>
    `;
  }

  // Handle both array and object formats
  const ratingsList = Array.isArray(ratings) ? ratings : Object.values(ratings);

  if (ratingsList.length === 0) {
    return `
      <section class="section">
        <h2>📊 My Ratings</h2>
        <p class="empty-notice">No ratings data saved.</p>
      </section>
    `;
  }

  const ratingRows = ratingsList
    .map(
      (rating) => `
    <tr>
      <td>${escapeHtml(rating.condition || rating.name || "Unknown")}</td>
      <td>${rating.rating || rating.percentage || "N/A"}%</td>
      <td>${escapeHtml(rating.diagnosticCode || rating.dc || "N/A")}</td>
      <td>${escapeHtml(rating.status || "Active")}</td>
    </tr>
  `,
    )
    .join("");

  return `
    <section class="section">
      <h2>📊 My Ratings (${ratingsList.length})</h2>
      <table class="ratings-table">
        <thead>
          <tr>
            <th>Condition</th>
            <th>Rating</th>
            <th>DC Code</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${ratingRows}
        </tbody>
      </table>
    </section>
  `;
}

/**
 * Generate HTML for forms section
 * @param {Object|Array} forms - Forms data
 * @returns {string} HTML string
 */
function generateFormsSection(forms) {
  if (!forms) {
    return `
      <section class="section">
        <h2>📄 Saved Forms</h2>
        <p class="empty-notice">No saved forms found.</p>
      </section>
    `;
  }

  // Handle both array and object formats
  const formsList = Array.isArray(forms)
    ? forms
    : Object.entries(forms).map(([key, value]) => ({
        id: key,
        ...value,
      }));

  if (formsList.length === 0) {
    return `
      <section class="section">
        <h2>📄 Saved Forms</h2>
        <p class="empty-notice">No saved forms found.</p>
      </section>
    `;
  }

  const formCards = formsList
    .map(
      (form) => `
    <div class="form-card">
      <h4>${escapeHtml(form.formName || form.name || form.id || "Unnamed Form")}</h4>
      ${form.description ? `<p>${escapeHtml(form.description)}</p>` : ""}
      ${
        form.data
          ? `
        <details>
          <summary>Form Data</summary>
          <pre>${escapeHtml(JSON.stringify(form.data, null, 2))}</pre>
        </details>
      `
          : ""
      }
      <p class="timestamp">Saved: ${formatDate(form.savedAt || form.createdAt)}</p>
    </div>
  `,
    )
    .join("");

  return `
    <section class="section">
      <h2>📄 Saved Forms (${formsList.length})</h2>
      <div class="forms-grid">
        ${formCards}
      </div>
    </section>
  `;
}

/**
 * Generate the complete dossier HTML document
 * @returns {string} Complete HTML document
 */
export function generateDossierHTML() {
  const exportDate = new Date().toISOString();
  const formattedDate = formatDate(exportDate);

  // Gather all data
  const profile = safeGetData(DATA_SOURCES.profile);
  const claims = safeGetData(DATA_SOURCES.claims);
  const statements = safeGetData(DATA_SOURCES.statements);
  const ratings = safeGetData(DATA_SOURCES.ratings);
  const forms = safeGetData(DATA_SOURCES.forms);

  // Get the full backup for raw data reference
  const fullBackup = exportData();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VA Claims Dossier - Exported from Vet-Rate.org</title>
  <style>
    /* Reset and Base Styles */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a202c;
      background: #f7fafc;
      padding: 20px;
      max-width: 1000px;
      margin: 0 auto;
    }
    
    /* Header */
    .dossier-header {
      background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%);
      color: white;
      padding: 40px;
      border-radius: 16px;
      margin-bottom: 30px;
      text-align: center;
    }
    
    .dossier-header h1 {
      font-size: 32px;
      margin-bottom: 8px;
    }
    
    .dossier-header .subtitle {
      font-size: 18px;
      opacity: 0.9;
      margin-bottom: 20px;
    }
    
    .dossier-header .meta {
      display: flex;
      justify-content: center;
      gap: 30px;
      flex-wrap: wrap;
      font-size: 14px;
      opacity: 0.8;
    }
    
    .dossier-header .flag {
      font-size: 48px;
      margin-bottom: 16px;
    }
    
    /* Disclaimer Banner */
    .disclaimer-banner {
      background: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 30px;
    }
    
    .disclaimer-banner h3 {
      color: #856404;
      margin-bottom: 8px;
    }
    
    .disclaimer-banner p {
      color: #856404;
      font-size: 14px;
    }
    
    /* Sections */
    .section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .section h2 {
      color: #1a365d;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    
    .empty-notice {
      color: #718096;
      font-style: italic;
      text-align: center;
      padding: 20px;
    }
    
    .timestamp {
      color: #718096;
      font-size: 12px;
      margin-top: 12px;
    }
    
    /* Profile Grid */
    .profile-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }
    
    .profile-item {
      background: #f7fafc;
      padding: 12px 16px;
      border-radius: 8px;
    }
    
    .profile-item .label {
      font-weight: 600;
      color: #4a5568;
      display: block;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    
    .profile-item .value {
      color: #1a202c;
      font-size: 16px;
    }
    
    /* Claims Grid */
    .claims-grid {
      display: grid;
      gap: 16px;
    }
    
    .claim-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      background: #fafafa;
    }
    
    .claim-card.secondary {
      border-left: 4px solid #f6ad55;
    }
    
    .claim-card.primary {
      border-left: 4px solid #48bb78;
    }
    
    .claim-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .claim-header h3 {
      font-size: 18px;
      color: #2d3748;
    }
    
    .badge {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .badge.primary { background: #c6f6d5; color: #276749; }
    .badge.secondary { background: #feebc8; color: #c05621; }
    .badge.ai { background: #e9d8fd; color: #6b46c1; }
    
    .secondary-link {
      color: #c05621;
      font-size: 14px;
      margin-bottom: 8px;
    }
    
    .notes {
      background: #f0fff4;
      padding: 12px;
      border-radius: 6px;
      margin-top: 12px;
    }
    
    /* Statements */
    .statement-card {
      margin-bottom: 24px;
    }
    
    .statement-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .statement-content h4,
    .statement-answers h4 {
      font-size: 14px;
      color: #4a5568;
      margin: 16px 0 8px;
      text-transform: uppercase;
    }
    
    .statement-text {
      background: #f7fafc;
      padding: 16px;
      border-radius: 8px;
      border-left: 3px solid #4299e1;
      white-space: pre-wrap;
      font-family: Georgia, serif;
      line-height: 1.8;
    }
    
    .statement-answers dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 16px;
    }
    
    .statement-answers dt {
      font-weight: 600;
      color: #4a5568;
    }
    
    .statement-answers dd {
      color: #2d3748;
    }
    
    .statement-divider {
      border: none;
      border-top: 1px dashed #e2e8f0;
      margin: 24px 0;
    }
    
    /* Ratings Table */
    .ratings-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .ratings-table th,
    .ratings-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .ratings-table th {
      background: #edf2f7;
      font-weight: 600;
      color: #4a5568;
      text-transform: uppercase;
      font-size: 12px;
    }
    
    .ratings-table tr:hover {
      background: #f7fafc;
    }
    
    /* Forms Grid */
    .forms-grid {
      display: grid;
      gap: 16px;
    }
    
    .form-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    
    .form-card h4 {
      margin-bottom: 8px;
    }
    
    .form-card details {
      margin-top: 12px;
    }
    
    .form-card summary {
      cursor: pointer;
      color: #4299e1;
      font-weight: 500;
    }
    
    .form-card pre {
      background: #1a202c;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12px;
      margin-top: 8px;
    }
    
    /* Footer */
    .dossier-footer {
      text-align: center;
      padding: 30px;
      color: #718096;
      font-size: 14px;
    }
    
    .dossier-footer a {
      color: #4299e1;
      text-decoration: none;
    }
    
    /* Raw Data Section */
    .raw-data-section {
      margin-top: 40px;
    }
    
    .raw-data-section details {
      background: #2d3748;
      border-radius: 8px;
      padding: 16px;
    }
    
    .raw-data-section summary {
      color: #a0aec0;
      cursor: pointer;
      font-weight: 500;
    }
    
    .raw-data-section pre {
      color: #68d391;
      font-size: 11px;
      overflow-x: auto;
      margin-top: 16px;
      max-height: 400px;
      overflow-y: auto;
    }
    
    /* Print Styles */
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .dossier-header {
        background: #1a365d !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .section {
        break-inside: avoid;
        box-shadow: none;
        border: 1px solid #e2e8f0;
      }
      
      .raw-data-section {
        display: none;
      }
      
      a {
        text-decoration: none;
      }
    }
    
    /* Responsive */
    @media (max-width: 600px) {
      .dossier-header {
        padding: 24px;
      }
      
      .dossier-header h1 {
        font-size: 24px;
      }
      
      .dossier-header .meta {
        flex-direction: column;
        gap: 8px;
      }
      
      .section {
        padding: 16px;
      }
      
      .profile-grid {
        grid-template-columns: 1fr;
      }
      
      .claim-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
    }
  </style>
</head>
<body>
  <header class="dossier-header">
    <div class="flag">🇺🇸</div>
    <h1>VA Claims Dossier</h1>
    <p class="subtitle">Complete Export of Your Vet-Rate.org Data</p>
    <div class="meta">
      <span>📅 Exported: ${formattedDate}</span>
      <span>🔒 For Your Records Only</span>
      <span>📄 Standalone Document</span>
    </div>
  </header>
  
  <div class="disclaimer-banner">
    <h3>⚠️ Important Notice</h3>
    <p>This document is for your personal records only. It contains information you entered into Vet-Rate.org 
    to help organize your VA claims. This is NOT an official VA document. Always verify information with 
    official VA sources and consult with an accredited VSO or attorney for legal advice.</p>
  </div>
  
  ${generateProfileSection(profile)}
  ${generateRatingsSection(ratings)}
  ${generateClaimsSection(claims)}
  ${generateStatementsSection(statements)}
  ${generateFormsSection(forms)}
  
  <div class="raw-data-section">
    <section class="section">
      <h2>🔧 Raw Data Backup</h2>
      <p style="margin-bottom: 16px; color: #718096;">
        This section contains your complete data in JSON format for technical backup purposes.
      </p>
      <details>
        <summary>Click to expand raw JSON data</summary>
        <pre>${escapeHtml(JSON.stringify(fullBackup, null, 2))}</pre>
      </details>
    </section>
  </div>
  
  <footer class="dossier-footer">
    <p>Generated by <a href="https://vet-rate.org" target="_blank">Vet-Rate.org</a></p>
    <p>Supporting Those Who Served 🎖️</p>
    <p style="margin-top: 16px; font-size: 12px;">
      This file is a complete, standalone backup of your data. 
      You can open it in any web browser, anywhere, anytime - even without internet access.
    </p>
  </footer>
</body>
</html>`;
}

/**
 * Download the dossier as an HTML file
 */
export function downloadDossier() {
  try {
    const html = generateDossierHTML();
    const date = new Date().toISOString().split("T")[0];
    const filename = `VA-Claims-Dossier-${date}.html`;

    // deepcode ignore javascript/DOMXSS: blob is HTML from local data; triggerBlobDownload reconstructs URL from UUID regex only — a.href is literal 'blob:' + origin + '/' + UUID
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    triggerBlobDownload(blob, filename);

    return { success: true, filename };
  } catch (error) {
    console.error("Error generating dossier:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Preview the dossier in a new tab
 */
export function previewDossier() {
  try {
    const html = generateDossierHTML();
    // deepcode ignore javascript/OR: URL.createObjectURL always returns blob: scheme; safeOpenBlobUrl reconstructs from UUID regex capture — window.open receives literal 'blob:' + origin + '/' + UUID
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    if (!safeOpenBlobUrl(url)) throw new Error("Invalid URL");
    return { success: true };
  } catch (error) {
    console.error("Error previewing dossier:", error);
    return { success: false, error: error.message };
  }
}

export default {
  generateDossierHTML,
  downloadDossier,
  previewDossier,
};
