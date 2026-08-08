/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 */

import { useState, useEffect, useRef } from "react";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import jsPDF from "jspdf";
import ShareButton from "./ShareButton";
import VAGovRatingPaster from "./VAGovRatingPaster";
import CFileClaimsCards from "./CFileClaimsCards";
import CFileTimeline from "./CFileTimeline";
import { useLanguage } from "../contexts/LanguageContext";
import {
  getSavedClaims,
  removeClaim,
  clearAllClaims,
  updateClaimStatus,
  getStatement,
  getClaimStats,
  getAllStatements,
  importClaims,
  importStatements,
} from "../utils/claimsStorage";
import {
  downloadPacketBackup,
  exportCompletePacket,
  importCompletePacket,
} from "../utils/packetBackup";
import {
  getSavedForms,
  deleteSavedForm,
  getVeteranProfile,
  saveVeteranProfile,
  getMyRatings,
  removeRating,
  updateRating,
  clearMyRatings,
  addRating,
  getServiceHistory,
  addDeployment,
  removeDeployment,
  addAward,
  removeAward,
  saveDD214Data,
  clearDD214Data,
  getServicePeriods,
  upsertServicePeriod,
  addServicePeriod,
  updateServicePeriod,
  removeServicePeriod,
  clearServicePeriods,
  summarizeServicePeriods,
  getTimelineEvents,
  clearTimelineEvents,
  getPainMaps,
  deletePainMap,
} from "../utils/veteranProfile";
import {
  loadVARecords,
  clearVARecords,
  saveVADataWithConsent,
} from "../utils/vaDataPersistence";
import {
  loadVKB,
  getAllDocumentsByCategory,
  groupDocumentationByCategory,
  raceVkb,
} from "../utils/veteranKnowledgeBase";
import { buildPacketSummary } from "../utils/packetSummary";
import ResponsiveModal from "./common/ResponsiveModal";
import { triggerBlobDownload } from "../utils/sanitize";
import { useVaAuth } from "../hooks/useVaAuth";
import {
  getServiceHistory as fetchVAServiceHistory,
  getClaims as fetchVAClaims,
  getAppealableIssues as fetchVAAppealableIssues,
  getAppealsStatus as fetchVAAppealsStatus,
  getDisabilityRating as fetchVADisabilityRating,
  formatServiceHistory,
  formatClaims,
  formatAppealableIssues,
  formatAppealsStatus,
  formatDisabilityRating,
} from "../api/va";
import BuyMeCoffee from "./BuyMeCoffee";
import ReportBugLink from "./ReportBugLink";
import DraftWatermark from "./DraftWatermark";
import CertificationCheckbox from "./CertificationCheckbox";
import NexusDisclaimerFooter from "./NexusDisclaimerFooter";
import ClaimProgress from "./ClaimProgress";
import { generateAI, getAIStatus } from "../utils/unifiedAIService";
import { RibbonRackDisplay } from "./VisualRibbon";
import { enrichAwardForDisplay } from "../utils/ribbonRackData";
import VADataCenter from "./VADataCenter";
import ClaimEvidenceUpload from "./ClaimEvidenceUpload";
import {
  combineMultipleRatings,
  roundToNearest10,
} from "../utils/vaCalculator";
import { formatLocalDate } from "../utils/dateUtils";
import { formatFileSize } from "../utils/documentAnalyzer";
import { parseServiceRecord } from "../utils/musterCallProcessor";
import { getDocumentTypeLabel } from "../utils/documentClassifier";

function getRatingBadgeClass(rating) {
  if (rating >= 70)
    return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
  if (rating >= 50)
    return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300";
  if (rating >= 30)
    return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
  return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
}

// Data-provenance badges, reusing the app's existing pill visual language
// (text-xs px-1.5 py-0.5 rounded-full — same classes as the tab-nav count
// badges above and ClaimEvidenceUpload's "recommended" chip) so VA-API data
// and veteran-entered data are never visually ambiguous, especially in a
// reviewer demo.
function VaSourceBadge() {
  return (
    <span className="inline-flex items-center text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300">
      VA.gov
    </span>
  );
}

function ManualSourceBadge() {
  return (
    <span className="inline-flex items-center text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
      Added by you
    </span>
  );
}

function getTimelineDotClass(type) {
  if (type === "treatment") return "bg-blue-500";
  if (type === "diagnosis") return "bg-green-500";
  if (type === "military") return "bg-amber-500";
  if (type === "symptom") return "bg-red-500";
  if (type === "hospitalization") return "bg-purple-500";
  return "bg-gray-400";
}

function getTimelineBadgeClass(type) {
  if (type === "treatment")
    return "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300";
  if (type === "diagnosis")
    return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300";
  if (type === "military")
    return "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300";
  if (type === "symptom")
    return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300";
  if (type === "hospitalization")
    return "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300";
  return "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
}

function getPainSeverityDotClass(severity) {
  if (severity === "severe") return "bg-red-500";
  if (severity === "moderate") return "bg-orange-500";
  return "bg-yellow-500";
}

function safeImportToStorage(key, value, label) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error importing ${label}:`, e);
  }
}

async function _fetchAllVaData(vaAccessToken, setVaImportStatus) {
  const fetchedData = {
    claims: [],
    serviceHistory: null,
    disabilityRating: null,
    appeals: [],
    appealableIssues: [],
    rawClaims: null,
    rawServiceHistory: null,
    rawDisabilityRating: null,
    rawAppeals: null,
    rawAppealableIssues: null,
  };

  const errors = [];

  // Fetch Service History
  try {
    setVaImportStatus((prev) => ({
      ...prev,
      message: "Fetching service history...",
    }));
    const rawServiceHistory = await fetchVAServiceHistory(vaAccessToken);
    fetchedData.rawServiceHistory = rawServiceHistory;
    const formatted = formatServiceHistory(rawServiceHistory);
    // Take first service episode or flatten
    fetchedData.serviceHistory = formatted.length > 0 ? formatted[0] : null;
  } catch (err) {
    console.error("[VA Import] Service history error:", err);
    errors.push("Service History: " + err.message);
  }

  // Fetch Disability Rating
  try {
    setVaImportStatus((prev) => ({
      ...prev,
      message: "Fetching disability rating...",
    }));
    const rawDisabilityRating = await fetchVADisabilityRating(vaAccessToken);
    fetchedData.rawDisabilityRating = rawDisabilityRating;
    fetchedData.disabilityRating = formatDisabilityRating(rawDisabilityRating);
  } catch (err) {
    console.error("[VA Import] Disability rating error:", err);
    errors.push("Disability Rating: " + err.message);
  }

  // Fetch Claims
  try {
    setVaImportStatus((prev) => ({ ...prev, message: "Fetching claims..." }));
    const rawClaims = await fetchVAClaims(vaAccessToken);
    fetchedData.rawClaims = rawClaims;
    fetchedData.claims = formatClaims(rawClaims);
  } catch (err) {
    console.error("[VA Import] Claims error:", err);
    errors.push("Claims: " + err.message);
  }

  // Fetch Appeals Status
  try {
    setVaImportStatus((prev) => ({
      ...prev,
      message: "Fetching appeals...",
    }));
    const rawAppeals = await fetchVAAppealsStatus(vaAccessToken);
    fetchedData.rawAppeals = rawAppeals;
    fetchedData.appeals = formatAppealsStatus(rawAppeals);
  } catch (err) {
    console.error("[VA Import] Appeals error:", err);
    errors.push("Appeals: " + err.message);
  }

  // Fetch Appealable Issues
  try {
    setVaImportStatus((prev) => ({
      ...prev,
      message: "Fetching appealable issues...",
    }));
    const rawAppealableIssues = await fetchVAAppealableIssues(vaAccessToken);
    fetchedData.rawAppealableIssues = rawAppealableIssues;
    fetchedData.appealableIssues = formatAppealableIssues(rawAppealableIssues);
  } catch (err) {
    console.error("[VA Import] Appealable issues error:", err);
    errors.push("Appealable Issues: " + err.message);
  }

  return { fetchedData, errors };
}

function _buildVaImportStatusMessage(fetchedData, errors) {
  const counts = {
    claims: fetchedData.claims?.length || 0,
    appeals: fetchedData.appeals?.length || 0,
    appealableIssues: fetchedData.appealableIssues?.length || 0,
    serviceHistory: fetchedData.serviceHistory ? 1 : 0,
    disabilityRating: fetchedData.disabilityRating ? 1 : 0,
  };

  const totalImported =
    counts.claims +
    counts.appeals +
    counts.appealableIssues +
    counts.serviceHistory +
    counts.disabilityRating;

  if (totalImported > 0) {
    return {
      loading: false,
      success: true,
      message: `Successfully imported ${totalImported} records! Your data is now saved locally and available to AI tools.`,
      counts,
    };
  }
  if (errors.length > 0) {
    return {
      loading: false,
      success: false,
      message: `Import completed with errors: ${errors.join("; ")}`,
      counts,
    };
  }
  return {
    loading: false,
    success: true,
    message: "Import complete. No records found in your VA.gov account.",
    counts,
  };
}

async function _importVaData(vaAccessToken, ctx) {
  const {
    setVaImportStatus,
    loadVARecordsData,
    loadClaims,
    loadVkbEnrichment,
  } = ctx;

  if (!vaAccessToken) {
    setVaImportStatus({
      loading: false,
      success: false,
      message: "Not authenticated. Please connect to VA.gov first.",
    });
    return;
  }

  setVaImportStatus({
    loading: true,
    success: null,
    message: "Fetching your VA records...",
    counts: {},
  });

  const { fetchedData, errors } = await _fetchAllVaData(
    vaAccessToken,
    setVaImportStatus,
  );

  // Save to local storage with consent (save to both MyPacket and VKB)
  setVaImportStatus((prev) => ({
    ...prev,
    message: "Saving to your device...",
  }));

  const consent = { saveToPacket: true, saveToVKB: true };
  await saveVADataWithConsent(fetchedData, consent);

  // Reload the VA records display
  loadVARecordsData();
  loadClaims(); // Reload claims tab too since we may have added claims
  loadVkbEnrichment(); // Refresh Ratings/Service sections too

  setVaImportStatus(_buildVaImportStatusMessage(fetchedData, errors));
}

function _importAllPacketData(data, mergeMode, ctx) {
  const {
    loadSavedForms,
    loadVeteranProfile,
    loadServiceHistory,
    loadMyRatings,
    loadTimelineEvents,
    loadPainMaps,
  } = ctx;

  // Import veteran profile if present
  if (data.veteranProfile && Object.keys(data.veteranProfile).length > 0) {
    safeImportToStorage(
      "vet_rate_veteran_profile",
      data.veteranProfile,
      "profile",
    );
  }

  // Import saved forms if present
  if (
    data.savedForms &&
    Array.isArray(data.savedForms) &&
    data.savedForms.length > 0
  ) {
    try {
      if (mergeMode === "merge") {
        const existingForms = getSavedForms();
        const existingIds = new Set(existingForms.map((f) => f.id));
        const newForms = data.savedForms.filter((f) => !existingIds.has(f.id));
        localStorage.setItem(
          "vet_rate_saved_forms",
          JSON.stringify([...existingForms, ...newForms]),
        );
      } else {
        localStorage.setItem(
          "vet_rate_saved_forms",
          JSON.stringify(data.savedForms),
        );
      }
      loadSavedForms();
    } catch (e) {
      console.error("Error importing forms:", e);
    }
  }

  // Import service history
  if (data.serviceHistory) {
    safeImportToStorage(
      "vet_rate_service_history",
      data.serviceHistory,
      "service history",
    );
  }

  // Import ratings
  if (data.myRatings && Array.isArray(data.myRatings)) {
    safeImportToStorage("vet_rate_my_ratings", data.myRatings, "ratings");
  }

  // Import timeline events
  if (data.timelineEvents && Array.isArray(data.timelineEvents)) {
    safeImportToStorage(
      "vet_rate_timeline_events",
      data.timelineEvents,
      "timeline events",
    );
  }

  // Import pain maps
  if (data.painMaps && Array.isArray(data.painMaps)) {
    safeImportToStorage("vet_rate_pain_maps", data.painMaps, "pain maps");
  }

  // Reload ALL state after import
  loadVeteranProfile();
  loadServiceHistory();
  loadMyRatings();
  loadTimelineEvents();
  loadPainMaps();
}

function _buildImportSuccessMessage(data, mergeMode) {
  const parts = [`${data.claims.length} claims`];
  if (data.savedForms?.length) parts.push(`${data.savedForms.length} forms`);
  if (data.veteranProfile && Object.keys(data.veteranProfile).length > 0)
    parts.push("profile");
  if (data.serviceHistory?.deployments?.length)
    parts.push(`${data.serviceHistory.deployments.length} deployments`);
  if (data.serviceHistory?.awards?.length)
    parts.push(`${data.serviceHistory.awards.length} awards`);
  if (data.myRatings?.length) parts.push(`${data.myRatings.length} ratings`);
  if (data.timelineEvents?.length)
    parts.push(`${data.timelineEvents.length} timeline events`);

  return `Successfully ${mergeMode === "merge" ? "merged" : "restored"} ${parts.join(", ")}`;
}

function _confirmDataImport(mergeMode, data, ctx) {
  const { loadClaims, setImportStatus, setShowImportConfirm } = ctx;

  const claimSuccess = importClaims(data.claims, mergeMode);
  const statementSuccess = importStatements(data.statements, mergeMode);

  _importAllPacketData(data, mergeMode, ctx);

  if (claimSuccess && statementSuccess) {
    setImportStatus({
      type: "success",
      message: _buildImportSuccessMessage(data, mergeMode),
    });
    loadClaims();
  } else {
    setImportStatus({
      type: "error",
      message: "Import failed. Please try again.",
    });
  }

  setShowImportConfirm(null);
  setTimeout(() => setImportStatus(null), 4000);
}

function MyPacketHeader({ onClose, onReportBug, packetContentRef, t }) {
  return (
    <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-4 sm:px-6 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2
            id="my-packet-title"
            className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2"
          >
            📁 {t("myPacketSection.title")}{" "}
            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
              BETA
            </span>
          </h2>
          <p className="text-indigo-100 text-sm sm:text-base">
            {t("myPacketSection.manageDescription")}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ShareButton
            targetRef={packetContentRef}
            filename="my-claim-packet"
            variant="icon"
          />
          {onReportBug && (
            <ReportBugLink
              onClick={onReportBug}
              variant="light"
              moduleName="My Claim Packet"
            />
          )}
          <button
            onClick={onClose}
            className="p-1 text-white hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6 sm:w-8 sm:h-8"
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
  );
}

function MyPacketStatsDashboard({ stats, t }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
      <div className="text-center">
        <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          {stats.total}
        </div>
        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          📊 {t("myPacketSection.total")}
        </div>
      </div>
      <div className="text-center">
        <div className="text-2xl sm:text-3xl font-bold text-yellow-600 dark:text-yellow-400">
          {stats.drafting}
        </div>
        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          ✏️ {t("myPacketSection.statusDrafting")}
        </div>
      </div>
      <div className="text-center">
        <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
          {stats.statementGenerated}
        </div>
        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          ✅ {t("myPacketSection.ready")}
        </div>
      </div>
      <div className="text-center">
        <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
          {stats.filed}
        </div>
        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          🏆 {t("myPacketSection.statusFiled")}
        </div>
      </div>
    </div>
  );
}

const TLDR_STAT_FIELDS = [
  { key: "documents", label: "documents" },
  { key: "pages", label: "pages" },
  { key: "conditions", label: "conditions" },
  { key: "corroborated", label: "in 2+ records" },
  { key: "potentialClaims", label: "potential claims" },
  { key: "timelineEvents", label: "timeline events" },
];

function PacketTldrStats({ stats }) {
  const shown = TLDR_STAT_FIELDS.filter(({ key }) => stats[key] > 0);
  if (shown.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      {shown.map(({ key, label }) => (
        <div key={key} className="min-w-0 text-center">
          <div className="text-xl sm:text-2xl font-bold text-indigo-700 dark:text-indigo-300">
            {stats[key].toLocaleString()}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 break-words">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

function PacketTldrGaps({ gaps }) {
  if (gaps.length === 0) return null;
  return (
    <div className="mt-4 pt-3 border-t border-indigo-200 dark:border-indigo-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
        Worth a look
      </p>
      <ul className="space-y-1">
        {gaps.map((gap) => (
          <li
            key={gap}
            className="text-sm text-gray-700 dark:text-gray-300 flex gap-2"
          >
            <span aria-hidden="true">⚠️</span>
            <span className="min-w-0">{gap}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * At-a-glance panel above the tabs. Every figure is counted from records
 * already stored in the VKB — nothing here is model-generated, so it can be
 * handed to a VSO without a "verify this first" caveat.
 */
function PacketTldrPanel({ summary, loading }) {
  if (loading && !summary) {
    return <VkbEnrichmentLoadingState label="Summarizing your packet…" />;
  }
  if (!summary || summary.tldr.isEmpty) return null;

  const { headline, stats, bullets, gaps } = summary.tldr;
  return (
    <section
      aria-labelledby="packet-tldr-heading"
      className="p-4 sm:p-6 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-200 dark:border-indigo-800"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <h3
          id="packet-tldr-heading"
          className="text-base font-bold text-gray-900 dark:text-gray-100"
        >
          📌 TL;DR
        </h3>
        <p className="text-sm text-indigo-800 dark:text-indigo-300 min-w-0">
          {headline}
        </p>
      </div>

      <PacketTldrStats stats={stats} />

      <ul className="space-y-1.5">
        {bullets.map((bullet) => (
          <li
            key={bullet.text}
            className="text-sm text-gray-700 dark:text-gray-300 flex gap-2"
          >
            <span aria-hidden="true">{bullet.icon}</span>
            <span className="min-w-0">{bullet.text}</span>
          </li>
        ))}
      </ul>

      <PacketTldrGaps gaps={gaps} />

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Counted directly from your saved documents and knowledge base — not
        AI-generated.
      </p>
    </section>
  );
}

function MyPacketBackupGuideBanner({
  showBackupGuide,
  claims,
  handleBackupPacket,
  onOpenGoogleDriveSync,
  dismissBackupGuide,
  t,
}) {
  if (!showBackupGuide || claims.length === 0) return null;
  return (
    <div className="mx-4 sm:mx-6 mt-4 p-4 bg-gradient-to-r from-amber-50 via-amber-100 to-yellow-50 dark:from-amber-900/30 dark:via-amber-800/30 dark:to-yellow-900/30 border-2 border-amber-400 dark:border-amber-600 rounded-xl shadow-lg">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 text-4xl">🛡️</div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-1">
            {t("myPacketSection.backupGuideTitle")}
          </h3>
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
            <strong>Important:</strong>{" "}
            {t("myPacketSection.backupGuideMessage")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleBackupPacket}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors text-sm shadow-md"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {t("myPacketSection.backupGuideDownload")}
            </button>
            {onOpenGoogleDriveSync && (
              <button
                onClick={() => {
                  dismissBackupGuide(false);
                  onOpenGoogleDriveSync();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-cyan-600 transition-all text-sm shadow-md"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M7.71 3.5L1.15 15l4.58 7.5h13.54l4.58-7.5L17.29 3.5H7.71zm-.71 1h10l5.15 10H2.85l5.15-10zm.71 11h8.58l2.29 4.5H5.42l2.29-4.5z" />
                </svg>
                {t("myPacketSection.backupGuideGoogleDrive")}
              </button>
            )}
            <button
              onClick={() => dismissBackupGuide(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
            >
              {t("myPacketSection.backupGuideRemindLater")}
            </button>
            <button
              onClick={() => dismissBackupGuide(false)}
              className="inline-flex items-center gap-2 px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs"
            >
              {t("myPacketSection.backupGuideDontShow")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackupRestoreButtons({
  handleBackupPacket,
  claims,
  handleRestoreClick,
  t,
}) {
  return (
    <>
      <button
        onClick={handleBackupPacket}
        disabled={claims.length === 0}
        className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        {t("myPacketSection.localBackup")}
      </button>
      <button
        onClick={handleRestoreClick}
        className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-xs sm:text-sm"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        {t("myPacketSection.restore")}
      </button>
    </>
  );
}

function MyPacketBackupRestoreControls({
  handleBackupPacket,
  claims,
  handleRestoreClick,
  onOpenGoogleDriveSync,
  onAnalyzeStrategy,
  fileInputRef,
  handleFileSelect,
  t,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-3 bg-gray-100 dark:bg-gray-850 border-b dark:border-gray-700">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <BackupRestoreButtons
          handleBackupPacket={handleBackupPacket}
          claims={claims}
          handleRestoreClick={handleRestoreClick}
          t={t}
        />
        {onOpenGoogleDriveSync && (
          <button
            onClick={onOpenGoogleDriveSync}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-cyan-600 transition-all text-xs sm:text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.71 3.5L1.15 15l4.58 7.5h13.54l4.58-7.5L17.29 3.5H7.71zm-.71 1h10l5.15 10H2.85l5.15-10zm.71 11h8.58l2.29 4.5H5.42l2.29-4.5z" />
            </svg>
            {t("myPacketSection.googleDrive")}
          </button>
        )}
        {onAnalyzeStrategy && (
          <button
            onClick={onAnalyzeStrategy}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-indigo-700 transition-all text-xs sm:text-sm"
          >
            <span>🧭</span>
            {t("myPacketSection.analyzeStrategy")}
          </button>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".json"
          className="hidden"
          aria-label="Select backup file"
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center sm:text-right">
        💡 {t("myPacketSection.cloudBackupTip")}
      </p>
    </div>
  );
}

function MyPacketImportStatusMessage({ importStatus }) {
  if (!importStatus) return null;
  return (
    <div
      className={`mx-6 mt-4 px-4 py-3 rounded-lg flex items-center gap-2 ${
        importStatus.type === "success"
          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-100"
          : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-100"
      }`}
    >
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        {importStatus.type === "success" ? (
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        ) : (
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        )}
      </svg>
      <span className="text-sm font-medium">{importStatus.message}</span>
    </div>
  );
}

function MyPacketTabNavPrimary({
  activeTab,
  setActiveTab,
  claims,
  myRatings,
  serviceHistory,
  timelineEvents,
  vkbTimeline = [],
  t,
}) {
  return (
    <>
      {/* Primary Data */}
      <button
        onClick={() => setActiveTab("claims")}
        className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
          activeTab === "claims"
            ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-t-lg"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
        }`}
      >
        📋{" "}
        <span className="hidden sm:inline">{t("myPacketSection.claims")}</span>
        <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs px-1.5 py-0.5 rounded-full">
          {claims.length}
        </span>
      </button>

      <button
        onClick={() => setActiveTab("ratings")}
        className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
          activeTab === "ratings"
            ? "border-green-600 text-green-600 dark:border-green-400 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-t-lg"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
        }`}
      >
        📊{" "}
        <span className="hidden sm:inline">{t("myPacketSection.ratings")}</span>
        <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs px-1.5 py-0.5 rounded-full">
          {myRatings.length}
        </span>
      </button>

      <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1 my-2"></div>

      {/* Service & History */}
      <button
        onClick={() => setActiveTab("service")}
        className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
          activeTab === "service"
            ? "border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-t-lg"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
        }`}
      >
        🎖️{" "}
        <span className="hidden sm:inline">{t("myPacketSection.service")}</span>
        <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs px-1.5 py-0.5 rounded-full">
          {serviceHistory.deployments.length + serviceHistory.awards.length}
        </span>
      </button>

      <button
        onClick={() => setActiveTab("timeline")}
        className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
          activeTab === "timeline"
            ? "border-slate-600 text-slate-600 dark:border-slate-400 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/20 rounded-t-lg"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
        }`}
      >
        🧵{" "}
        <span className="hidden sm:inline">
          {t("myPacketSection.timeline")}
        </span>
        <span className="bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 text-xs px-1.5 py-0.5 rounded-full">
          {timelineEvents.length + vkbTimeline.length}
        </span>
      </button>
    </>
  );
}

function VaRecordsTabButton({ activeTab, setActiveTab, vaRecords }) {
  return (
    <button
      onClick={() => setActiveTab("varecords")}
      className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
        activeTab === "varecords"
          ? "border-green-600 text-green-600 dark:border-green-400 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-t-lg"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
      }`}
    >
      🏛️ <span className="hidden sm:inline">VA Records</span>
      {vaRecords && (
        <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs px-1.5 py-0.5 rounded-full">
          {[
            vaRecords.claims?.length || 0,
            vaRecords.appeals?.length || 0,
          ].reduce((a, b) => a + b, 0)}
        </span>
      )}
    </button>
  );
}

function DocumentsTabButton({ activeTab, setActiveTab, documents }) {
  const documentCount = documents
    ? Object.values(documents).reduce((sum, cat) => sum + (cat?.count || 0), 0)
    : 0;
  return (
    <button
      onClick={() => setActiveTab("documents")}
      className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
        activeTab === "documents"
          ? "border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 rounded-t-lg"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
      }`}
    >
      📁 <span className="hidden sm:inline">Documents</span>
      {documentCount > 0 && (
        <span className="bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-xs px-1.5 py-0.5 rounded-full">
          {documentCount}
        </span>
      )}
    </button>
  );
}

function MyPacketTabNavSecondary({
  activeTab,
  setActiveTab,
  painMaps,
  veteranProfile,
  savedForms,
  vaRecords,
  documents,
  t,
}) {
  return (
    <>
      <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1 my-2"></div>

      {/* Evidence & Docs */}
      <button
        onClick={() => setActiveTab("painmaps")}
        className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
          activeTab === "painmaps"
            ? "border-red-600 text-red-600 dark:border-red-400 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-t-lg"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
        }`}
      >
        🎨{" "}
        <span className="hidden sm:inline">
          {t("myPacketSection.painMaps")}
        </span>
        <span className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs px-1.5 py-0.5 rounded-full">
          {painMaps.length}
        </span>
      </button>

      <button
        onClick={() => setActiveTab("profile")}
        className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
          activeTab === "profile"
            ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-t-lg"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
        }`}
      >
        ✍️{" "}
        <span className="hidden sm:inline">{t("myPacketSection.profile")}</span>
        {veteranProfile.firstName && (
          <span className="ml-1 inline-flex items-center justify-center w-4 h-4 bg-green-500 text-white rounded-full text-xs">
            ✓
          </span>
        )}
      </button>

      <button
        onClick={() => setActiveTab("forms")}
        className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
          activeTab === "forms"
            ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-t-lg"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
        }`}
      >
        📄{" "}
        <span className="hidden sm:inline">{t("myPacketSection.forms")}</span>
        <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs px-1.5 py-0.5 rounded-full">
          {savedForms.length}
        </span>
      </button>

      <VaRecordsTabButton
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        vaRecords={vaRecords}
      />

      <DocumentsTabButton
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        documents={documents}
      />
    </>
  );
}

function MyPacketTabNav({
  activeTab,
  setActiveTab,
  claims,
  myRatings,
  serviceHistory,
  timelineEvents,
  vkbTimeline,
  painMaps,
  veteranProfile,
  savedForms,
  vaRecords,
  documents,
  t,
}) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 bg-white dark:bg-gray-800 sticky top-0 z-10 flex-shrink-0">
      <nav
        className="flex gap-1 overflow-x-auto pb-px scrollbar-hide"
        aria-label="Tabs"
      >
        <MyPacketTabNavPrimary
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          claims={claims}
          myRatings={myRatings}
          serviceHistory={serviceHistory}
          timelineEvents={timelineEvents}
          vkbTimeline={vkbTimeline}
          t={t}
        />
        <MyPacketTabNavSecondary
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          painMaps={painMaps}
          veteranProfile={veteranProfile}
          savedForms={savedForms}
          vaRecords={vaRecords}
          documents={documents}
          t={t}
        />
      </nav>
    </div>
  );
}

function RatingsEmptyState({ setShowVAGovPaster, t }) {
  return (
    <div className="text-center py-12">
      <svg
        className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        📊 {t("myPacketSection.noSavedRatings")}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        {t("myPacketSection.importRatingsDescription")}
      </p>
      <button
        onClick={() => setShowVAGovPaster(true)}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {t("myPacketSection.importFromVaGov")}
      </button>
    </div>
  );
}

function MyRatingEditForm({
  editingRating,
  setEditingRating,
  handleUpdateRating,
  t,
}) {
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={editingRating.name}
        onChange={(e) =>
          setEditingRating({ ...editingRating, name: e.target.value })
        }
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder={t("myPacketSection.conditionName")}
      />
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          max="100"
          step="10"
          value={editingRating.rating}
          onChange={(e) =>
            setEditingRating({
              ...editingRating,
              rating: parseInt(e.target.value) || 0,
            })
          }
          className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <button
          onClick={() =>
            handleUpdateRating(editingRating.id, {
              name: editingRating.name,
              rating: editingRating.rating,
            })
          }
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          {t("myPacketSection.save")}
        </button>
        <button
          onClick={() => setEditingRating(null)}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
        >
          {t("myPacketSection.cancel")}
        </button>
      </div>
    </div>
  );
}

function MyRatingDisplay({ rating, setEditingRating, handleRemoveRating, t }) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {rating.name || rating.condition}
          </h3>
          <span
            className={`px-3 py-1 rounded-full text-sm font-bold ${getRatingBadgeClass(rating.rating)}`}
          >
            {rating.rating}%
          </span>
        </div>
        {rating.effectiveDate && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t("myPacketSection.effective")}:{" "}
            {formatLocalDate(rating.effectiveDate).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setEditingRating({ ...rating })}
          className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
        >
          {t("myPacketSection.edit")}
        </button>
        <button
          onClick={() => handleRemoveRating(rating.id)}
          className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
        >
          {t("myPacketSection.remove")}
        </button>
      </div>
    </div>
  );
}

function MyRatingEntry({
  rating,
  editingRating,
  setEditingRating,
  handleUpdateRating,
  handleRemoveRating,
  t,
}) {
  const isEditing = editingRating?.id === rating.id;
  return (
    <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-500 transition-all">
      {isEditing ? (
        <MyRatingEditForm
          editingRating={editingRating}
          setEditingRating={setEditingRating}
          handleUpdateRating={handleUpdateRating}
          t={t}
        />
      ) : (
        <MyRatingDisplay
          rating={rating}
          setEditingRating={setEditingRating}
          handleRemoveRating={handleRemoveRating}
          t={t}
        />
      )}
    </div>
  );
}

// Read-only, VA-sourced ratings merged into vkb.vaClaimsHistory.ratings by
// saveDisabilityRatingToVKB. Same precedent as VkbTimelineSection: display
// only, never counted in myRatings or the clear-all action.
function VkbDisabilityRatingSection({ ratings }) {
  return (
    <section className="mt-6 border-t dark:border-gray-700 pt-4">
      <h3 className="font-bold text-teal-800 dark:text-teal-200 mb-1 flex items-center gap-2 flex-wrap">
        🎖️ VA-Verified Disability Rating ({ratings.length})
        <VaSourceBadge />
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        Read-only rating data synced from your VA.gov account.
      </p>
      <ul className="space-y-1">
        {ratings.map((rating, i) => (
          <li
            key={`${rating.condition}-${i}`}
            className="text-sm text-gray-700 dark:text-gray-300 flex flex-wrap items-center gap-2"
          >
            <span className="font-medium">{rating.condition}</span>
            {rating.percentage != null && <span>{rating.percentage}%</span>}
            {rating.combinedRating != null && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                (Combined: {rating.combinedRating}%)
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function VkbEnrichmentLoadingState({ label }) {
  return (
    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
      <div className="animate-spin w-8 h-8 mx-auto mb-3 border-2 border-gray-400 border-t-transparent rounded-full"></div>
      <p>Checking your VA.gov account for saved {label}…</p>
    </div>
  );
}

// FIX-1: combined rating via vaCalculator.js (the tested implementation),
// not a third combined-rating implementation. Shows both raw and rounded
// (e.g. "72% raw → 70%"). Bilateral grouping is out of scope for this
// display — combines the flat list of saved ratings as-is.
function CombinedRatingSummary({ myRatings, t }) {
  const ratingValues = myRatings
    .map((r) => r.rating)
    .filter((r) => typeof r === "number" && r > 0);
  if (ratingValues.length < 2) return null;

  const raw = combineMultipleRatings(ratingValues);
  const rounded = roundToNearest10(raw);

  return (
    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
        {t("myPacketSection.combinedRating") || "Combined Rating"}
      </p>
      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
        {raw}% raw → {rounded}%
      </p>
    </div>
  );
}

function RatingsTab({
  myRatings,
  editingRating,
  setEditingRating,
  handleUpdateRating,
  handleRemoveRating,
  handleClearAllRatings,
  setShowVAGovPaster,
  vkbDisabilityRatings = [],
  vkbEnrichmentLoading,
  t,
}) {
  const hasRatings = myRatings.length > 0;
  const hasVkbRatings = vkbDisabilityRatings.length > 0;
  if (!hasRatings && !hasVkbRatings) {
    if (vkbEnrichmentLoading) {
      return <VkbEnrichmentLoadingState label="ratings" />;
    }
    return <RatingsEmptyState setShowVAGovPaster={setShowVAGovPaster} t={t} />;
  }
  return (
    <>
      {hasRatings && (
        <>
          <CombinedRatingSummary myRatings={myRatings} t={t} />
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {myRatings.length} {t("myPacketSection.ratingsSaved")}
            </p>
            <button
              onClick={handleClearAllRatings}
              className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              {t("myPacketSection.clearAll")}
            </button>
          </div>
          <div className="space-y-3">
            {myRatings.map((rating) => (
              <MyRatingEntry
                key={rating.id}
                rating={rating}
                editingRating={editingRating}
                setEditingRating={setEditingRating}
                handleUpdateRating={handleUpdateRating}
                handleRemoveRating={handleRemoveRating}
                t={t}
              />
            ))}
          </div>
        </>
      )}

      {hasVkbRatings && (
        <VkbDisabilityRatingSection ratings={vkbDisabilityRatings} />
      )}
    </>
  );
}

function ProfileIntroAndPrivacy({ t }) {
  return (
    <div className="mb-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-3xl">✍️</span>
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {t("myPacketSection.veteranProfile")}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t("myPacketSection.profileDescription")}
          </p>
        </div>
      </div>

      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-2">
          <svg
            className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="text-sm">
            <p className="font-semibold text-indigo-900 dark:text-indigo-100 mb-1">
              {t("myPacketSection.privacyFirst")}
            </p>
            <p className="text-indigo-800 dark:text-indigo-200">
              {t("myPacketSection.privacyDetails")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonalInfoFieldsA({ veteranProfile, setVeteranProfile, t }) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("myPacketSection.firstName")}
        </label>
        <input
          type="text"
          value={veteranProfile.firstName || ""}
          onChange={(e) =>
            setVeteranProfile({ ...veteranProfile, firstName: e.target.value })
          }
          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          placeholder="John"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("myPacketSection.lastName")}
        </label>
        <input
          type="text"
          value={veteranProfile.lastName || ""}
          onChange={(e) =>
            setVeteranProfile({ ...veteranProfile, lastName: e.target.value })
          }
          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          placeholder="Doe"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("myPacketSection.middleInitial")}
        </label>
        <input
          type="text"
          maxLength={1}
          value={veteranProfile.middleInitial || ""}
          onChange={(e) =>
            setVeteranProfile({
              ...veteranProfile,
              middleInitial: e.target.value.toUpperCase(),
            })
          }
          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          placeholder="M"
        />
      </div>
    </>
  );
}

function PersonalInfoFieldsB({ veteranProfile, setVeteranProfile, t }) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("myPacketSection.dateOfBirth")}
        </label>
        <input
          type="date"
          value={veteranProfile.dob || ""}
          onChange={(e) =>
            setVeteranProfile({ ...veteranProfile, dob: e.target.value })
          }
          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("myPacketSection.ssnLast4")}
        </label>
        <input
          type="text"
          maxLength={4}
          value={veteranProfile.ssnLast4 || ""}
          onChange={(e) =>
            setVeteranProfile({
              ...veteranProfile,
              ssnLast4: e.target.value.replace(/\D/g, ""),
            })
          }
          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          placeholder="1234"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("myPacketSection.vaFileNumber")}
        </label>
        <input
          type="text"
          value={veteranProfile.vaFileNumber || ""}
          onChange={(e) =>
            setVeteranProfile({
              ...veteranProfile,
              vaFileNumber: e.target.value,
            })
          }
          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          placeholder="C-12345678"
        />
      </div>
    </>
  );
}

function PersonalInfoSection({ veteranProfile, setVeteranProfile, t }) {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        👤 {t("myPacketSection.personalInformation")}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PersonalInfoFieldsA
          veteranProfile={veteranProfile}
          setVeteranProfile={setVeteranProfile}
          t={t}
        />
        <PersonalInfoFieldsB
          veteranProfile={veteranProfile}
          setVeteranProfile={setVeteranProfile}
          t={t}
        />
      </div>
    </div>
  );
}

function ContactPhoneFields({ veteranProfile, setVeteranProfile, t }) {
  return (
    <>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("myPacketSection.email")}
        </label>
        <input
          type="email"
          value={veteranProfile.email || ""}
          onChange={(e) =>
            setVeteranProfile({ ...veteranProfile, email: e.target.value })
          }
          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          placeholder="veteran@email.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("myPacketSection.phone")}
        </label>
        <input
          type="tel"
          value={veteranProfile.phone || ""}
          onChange={(e) =>
            setVeteranProfile({ ...veteranProfile, phone: e.target.value })
          }
          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          placeholder="(555) 123-4567"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("myPacketSection.alternatePhone")}
        </label>
        <input
          type="tel"
          value={veteranProfile.alternatePhone || ""}
          onChange={(e) =>
            setVeteranProfile({
              ...veteranProfile,
              alternatePhone: e.target.value,
            })
          }
          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          placeholder="(555) 987-6543"
        />
      </div>
    </>
  );
}

function ContactAddressFields({ veteranProfile, setVeteranProfile, t }) {
  return (
    <>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("myPacketSection.streetAddress")}
        </label>
        <input
          type="text"
          value={veteranProfile.street || ""}
          onChange={(e) =>
            setVeteranProfile({ ...veteranProfile, street: e.target.value })
          }
          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          placeholder="123 Main Street"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("myPacketSection.city")}
        </label>
        <input
          type="text"
          value={veteranProfile.city || ""}
          onChange={(e) =>
            setVeteranProfile({ ...veteranProfile, city: e.target.value })
          }
          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          placeholder="Springfield"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("myPacketSection.state")}
        </label>
        <input
          type="text"
          maxLength={2}
          value={veteranProfile.state || ""}
          onChange={(e) =>
            setVeteranProfile({
              ...veteranProfile,
              state: e.target.value.toUpperCase(),
            })
          }
          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          placeholder="IL"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("myPacketSection.zipCode")}
        </label>
        <input
          type="text"
          maxLength={10}
          value={veteranProfile.zip || ""}
          onChange={(e) =>
            setVeteranProfile({ ...veteranProfile, zip: e.target.value })
          }
          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          placeholder="62701"
        />
      </div>
    </>
  );
}

function ContactInfoSection({ veteranProfile, setVeteranProfile, t }) {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        📞 {t("myPacketSection.contactInformation")}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ContactPhoneFields
          veteranProfile={veteranProfile}
          setVeteranProfile={setVeteranProfile}
          t={t}
        />
        <ContactAddressFields
          veteranProfile={veteranProfile}
          setVeteranProfile={setVeteranProfile}
          t={t}
        />
      </div>
    </div>
  );
}

// Q4: the Profile tab's manual editor writes through to the SAME canonical
// serviceHistory.servicePeriods[] array the Service tab reads — every
// period in veteranProfile.servicePeriods always has a real canonical id
// (see ServicePeriodsSection's add handler), so every edit here is an
// immediate updateServicePeriod call, not a batched "Save Profile" write.
function _updateServicePeriodField(
  veteranProfile,
  setVeteranProfile,
  idx,
  field,
  value,
) {
  const newPeriods = [...veteranProfile.servicePeriods];
  const updated = { ...newPeriods[idx], [field]: value };
  newPeriods[idx] = updated;
  setVeteranProfile({ ...veteranProfile, servicePeriods: newPeriods });
  if (updated.id) {
    updateServicePeriod(updated.id, { [field]: value });
  }
}

function ServicePeriodHeader({ idx, veteranProfile, setVeteranProfile, t }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h5 className="font-semibold text-gray-900 dark:text-gray-100">
        {t("myPacketSection.period")} #{idx + 1}
      </h5>
      <button
        onClick={() => {
          const period = veteranProfile.servicePeriods[idx];
          if (period?.id) removeServicePeriod(period.id);
          const newPeriods = veteranProfile.servicePeriods.filter(
            (_, i) => i !== idx,
          );
          setVeteranProfile({ ...veteranProfile, servicePeriods: newPeriods });
        }}
        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-semibold"
      >
        🗑️ {t("myPacketSection.remove")}
      </button>
    </div>
  );
}

function ServicePeriodFieldsA({ period, update, t }) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.branch")}
        </label>
        <select
          value={period.branch || ""}
          onChange={(e) => update("branch", e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
        >
          <option value="">{t("myPacketSection.select")}</option>
          <option value="Army">Army</option>
          <option value="Navy">Navy</option>
          <option value="Air Force">Air Force</option>
          <option value="Marines">Marines</option>
          <option value="Coast Guard">Coast Guard</option>
          <option value="Space Force">Space Force</option>
          <option value="Army National Guard">Army National Guard</option>
          <option value="Air National Guard">Air National Guard</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.component")}
        </label>
        <select
          value={period.component || "Active"}
          onChange={(e) => update("component", e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
        >
          <option value="Active">{t("myPacketSection.activeDuty")}</option>
          <option value="Guard">{t("myPacketSection.nationalGuard")}</option>
          <option value="Reserve">{t("myPacketSection.reserve")}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.startDate")}
        </label>
        <input
          type="date"
          value={period.serviceStartDate || ""}
          onChange={(e) => update("serviceStartDate", e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.endDate")}
        </label>
        <input
          type="date"
          value={period.serviceEndDate || ""}
          onChange={(e) => update("serviceEndDate", e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
        />
      </div>
    </>
  );
}

function ServicePeriodFieldsB({ period, update, t }) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.dischargeType")}
        </label>
        <select
          value={period.characterOfService || ""}
          onChange={(e) => update("characterOfService", e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
        >
          <option value="">{t("myPacketSection.select")}</option>
          <option value="Honorable">{t("myPacketSection.honorable")}</option>
          <option value="General Under Honorable">
            {t("myPacketSection.generalUnderHonorable")}
          </option>
          <option value="Other Than Honorable">
            {t("myPacketSection.otherThanHonorable")}
          </option>
          <option value="Medical">{t("myPacketSection.medical")}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.formType")}
        </label>
        <select
          value={period.formType || "DD214"}
          onChange={(e) => update("formType", e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
        >
          <option value="DD214">DD214 (Active Duty)</option>
          <option value="NGB22">NGB 22 (National Guard)</option>
          <option value="DD256">DD256 (Reserve)</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.mosRank")}
        </label>
        <input
          type="text"
          value={period.mos || ""}
          onChange={(e) => update("mos", e.target.value)}
          placeholder={t("myPacketSection.mosRankPlaceholder")}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
        />
      </div>

      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.notesOptional")}
        </label>
        <input
          type="text"
          value={period.notes || ""}
          onChange={(e) => update("notes", e.target.value)}
          placeholder={t("myPacketSection.notesPlaceholder")}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
        />
      </div>
    </>
  );
}

function ServicePeriodEntry({
  period,
  idx,
  veteranProfile,
  setVeteranProfile,
  t,
}) {
  const update = (field, value) =>
    _updateServicePeriodField(
      veteranProfile,
      setVeteranProfile,
      idx,
      field,
      value,
    );

  return (
    <div className="border-2 border-indigo-200 dark:border-indigo-800 rounded-lg p-4 bg-indigo-50 dark:bg-indigo-900/20">
      <ServicePeriodHeader
        idx={idx}
        veteranProfile={veteranProfile}
        setVeteranProfile={setVeteranProfile}
        t={t}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ServicePeriodFieldsA period={period} update={update} t={t} />
        <ServicePeriodFieldsB period={period} update={update} t={t} />
      </div>
    </div>
  );
}

function ServicePeriodsSection({ veteranProfile, setVeteranProfile, t }) {
  const hasPeriods =
    veteranProfile.servicePeriods && veteranProfile.servicePeriods.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          🎖️ {t("myPacketSection.servicePeriods")}
        </h4>
        <button
          onClick={() => {
            // Q4: create the period in the canonical store immediately —
            // every entry in veteranProfile.servicePeriods must have a
            // real id so subsequent field edits write through correctly.
            addServicePeriod({
              branch: "",
              component: "Active",
              serviceStartDate: "",
              serviceEndDate: "",
              characterOfService: "",
              mos: "",
              formType: "DD214",
              notes: "",
            });
            setVeteranProfile({
              ...veteranProfile,
              servicePeriods: getServicePeriods(),
            });
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          <span>+</span> {t("myPacketSection.addServicePeriod")}
        </button>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {t("myPacketSection.servicePeriodsDescription")}
      </p>

      {hasPeriods ? (
        <div className="space-y-4">
          {veteranProfile.servicePeriods.map((period, idx) => (
            <ServicePeriodEntry
              key={period.id || idx}
              period={period}
              idx={idx}
              veteranProfile={veteranProfile}
              setVeteranProfile={setVeteranProfile}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="text-sm">{t("myPacketSection.noServicePeriods")}</p>
          <p className="text-xs mt-1">
            {t("myPacketSection.clickToAddServicePeriod")}
          </p>
        </div>
      )}
    </div>
  );
}

function ProfileTab({ veteranProfile, setVeteranProfile, t }) {
  return (
    <>
      <ProfileIntroAndPrivacy t={t} />

      <div className="space-y-6">
        <PersonalInfoSection
          veteranProfile={veteranProfile}
          setVeteranProfile={setVeteranProfile}
          t={t}
        />
        <ContactInfoSection
          veteranProfile={veteranProfile}
          setVeteranProfile={setVeteranProfile}
          t={t}
        />
        <ServicePeriodsSection
          veteranProfile={veteranProfile}
          setVeteranProfile={setVeteranProfile}
          t={t}
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              // FIX-10 (SECURITY): route through saveVeteranProfile()'s
              // whitelist + sanitizeString + markAsModified() instead of a
              // raw localStorage.setItem that bypassed all of it. Branch
              // the alert on the actual return value — it returns false on
              // quota exhaustion, which the old code always claimed as
              // success.
              //
              // FIX-9: an explicit Save Profile click is the user
              // confirming these field values — mark every currently
              // non-empty field "user"-sourced so a later document import
              // never silently overwrites it (autoPopulateProfile treats
              // profileFieldSources[field] === "user" as never-overwrite).
              const EXCLUDED_FROM_SOURCE_TRACKING = new Set([
                "profileFieldSources",
                "servicePeriods",
                "lastUpdated",
                "profileVersion",
              ]);
              const fieldSources = {
                ...(veteranProfile.profileFieldSources || {}),
              };
              Object.keys(veteranProfile).forEach((field) => {
                if (
                  !EXCLUDED_FROM_SOURCE_TRACKING.has(field) &&
                  veteranProfile[field] !== undefined &&
                  veteranProfile[field] !== ""
                ) {
                  fieldSources[field] = "user";
                }
              });

              const success = saveVeteranProfile({
                ...veteranProfile,
                profileFieldSources: fieldSources,
              });

              if (success) {
                // Re-read from storage so the UI reflects what was
                // actually persisted post-sanitization, not the raw
                // pre-sanitized local state.
                setVeteranProfile(getVeteranProfile());
                alert(`✅ ${t("myPacketSection.profileSaved")}`);
              } else {
                alert(
                  "⚠️ Profile could not be saved — your device storage may be full. Export a backup and free up space, then try again.",
                );
              }
            }}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
          >
            💾 {t("myPacketSection.saveProfile")}
          </button>
        </div>
      </div>
    </>
  );
}

function SavedFormEntry({ form, setViewingForm, handleRemoveForm, t }) {
  return (
    <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-5 hover:border-purple-300 dark:hover:border-purple-500 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">
              {form.title || form.formName || "Untitled Form"}
            </h3>
            <span className="px-2 sm:px-3 py-1 text-xs font-semibold rounded-full border bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-100 border-purple-300 dark:border-purple-700 whitespace-nowrap">
              {form.formNumber || form.formType || "Form"}
            </span>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {form.formName}
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("myPacketSection.saved")}:{" "}
            {new Date(form.dateSaved).toLocaleDateString()}
            {form.dateUpdated &&
              ` • ${t("myPacketSection.updated")}: ${new Date(form.dateUpdated).toLocaleDateString()}`}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setViewingForm(form)}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            {t("myPacketSection.view")}
          </button>
          <button
            onClick={() => handleRemoveForm(form.id)}
            className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            {t("myPacketSection.remove")}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormsTab({ savedForms, setViewingForm, handleRemoveForm, t }) {
  if (savedForms.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          📄 {t("myPacketSection.noSavedForms")}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t("myPacketSection.formsDescription")}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {savedForms.map((form) => (
        <SavedFormEntry
          key={form.id}
          form={form}
          setViewingForm={setViewingForm}
          handleRemoveForm={handleRemoveForm}
          t={t}
        />
      ))}
    </div>
  );
}

function DD214DropZone({
  dd214FileInputRef,
  handleDD214DragOver,
  handleDD214DragLeave,
  handleDD214Drop,
  handleDD214FileSelect,
  isDraggingDD214,
  t,
}) {
  return (
    <div className="space-y-4">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        onClick={() => dd214FileInputRef.current?.click()}
        onDragOver={handleDD214DragOver}
        onDragLeave={handleDD214DragLeave}
        onDrop={handleDD214Drop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          isDraggingDD214
            ? "border-blue-500 bg-blue-100 dark:bg-blue-900/40 scale-[1.02]"
            : "border-blue-300 dark:border-blue-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30"
        }`}
      >
        <input
          ref={dd214FileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleDD214FileSelect}
          className="hidden"
        />
        <svg
          className="w-12 h-12 text-blue-400 mx-auto mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="text-blue-700 dark:text-blue-300 font-medium mb-1">
          {isDraggingDD214
            ? `📥 ${t("myPacketSection.dropDD214Here")}`
            : `📄 ${t("myPacketSection.dragDropDD214")}`}
        </p>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          {t("myPacketSection.orClickToBrowse")}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
          🔒 {t("myPacketSection.dd214PrivacyNote")}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-blue-200 dark:border-blue-700"></div>
        <span className="text-sm text-blue-600 dark:text-blue-400">
          {t("myPacketSection.or")}
        </span>
        <div className="flex-1 border-t border-blue-200 dark:border-blue-700"></div>
      </div>

      <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
        {t("myPacketSection.dd214UseButtonsAbove")}
      </p>
    </div>
  );
}

function DD214ExtractButtonLabel({ isProcessingDD214, aiAvailable, t }) {
  if (isProcessingDD214) {
    return (
      <>
        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
        {t("myPacketSection.processing")}
      </>
    );
  }
  if (aiAvailable) {
    return <>🤖 {t("myPacketSection.extractWithAI")}</>;
  }
  return <>📝 Extract (no AI)</>;
}

function DD214PasteProcessor({
  dd214Text,
  setDD214Text,
  handleProcessDD214,
  isProcessingDD214,
  aiStatus,
  onOpenAISettings,
  setShowDD214Processor,
  setDD214Text2,
  t,
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-blue-700 dark:text-blue-300">
        {t("myPacketSection.dd214PasteInstructions")}
        <br />
        <span className="text-xs text-blue-600 dark:text-blue-400">
          ⚠️ {t("myPacketSection.dd214SensitiveWarning")}
        </span>
      </p>
      <textarea
        value={dd214Text}
        onChange={(e) => setDD214Text(e.target.value)}
        placeholder={t("myPacketSection.dd214TextareaPlaceholder")}
        rows={6}
        className="w-full px-4 py-3 border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
      />
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleProcessDD214}
          disabled={isProcessingDD214}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <DD214ExtractButtonLabel
            isProcessingDD214={isProcessingDD214}
            aiAvailable={aiStatus.available}
            t={t}
          />
        </button>
        <button
          disabled
          className="px-4 py-2 bg-gray-400 text-white rounded-lg font-medium cursor-not-allowed flex items-center gap-2 opacity-60"
          aria-label="DD214 Analyzer - Coming Soon"
        >
          📄 {t("myPacketSection.fullAnalyzerComingSoon")}
        </button>
        <button
          onClick={onOpenAISettings}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          aria-label="Open Faraday Cage - AI Settings"
        >
          ⚙️ {t("myPacketSection.aiSettings")}
        </button>
        <button
          onClick={() => {
            setShowDD214Processor(false);
            setDD214Text2("");
          }}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {t("myPacketSection.cancel")}
        </button>
      </div>
      {!aiStatus.available && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠️ {t("myPacketSection.configureAIWarning")}
        </p>
      )}
    </div>
  );
}

// C3: summary view computed from the canonical servicePeriods[] array
// (Q2 — Total time in service headline + Service span context, shown
// separately since they answer different questions for a veteran with a
// break in service).
function DD214PeriodsSummary({ summary, dd214Data, t }) {
  return (
    <div className="space-y-3">
      {dd214Data?.fullName && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {dd214Data.fullName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Source:{" "}
            {dd214Data.fullNameSourceForm
              ? getDocumentTypeLabel(dd214Data.fullNameSourceForm)
              : "your service record"}
          </p>
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("myPacketSection.timeInService")}
        </p>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {summary.totalTimeInService
            ? `Total time in service: ${summary.totalTimeInService}`
            : "N/A"}
        </p>
        {summary.serviceSpan && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Service span: {summary.serviceSpan.start || "?"} –{" "}
            {summary.serviceSpan.end || "?"}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("myPacketSection.branch")}
          </p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {summary.branches.length > 0 ? summary.branches.join(", ") : "N/A"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Highest Pay Grade
          </p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {summary.highestPayGrade || "N/A"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Most Recent Rank
          </p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {summary.mostRecentRank || "N/A"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("myPacketSection.characterOfService")}
          </p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {summary.characterOfService || "N/A"}
          </p>
          {summary.characterOfServiceDisagrees && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              ⚠️ Periods disagree — see details below
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// C3: detail view — one card per period, most recent first.
function DD214PeriodDetailCard({ period, t }) {
  return (
    <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-semibold text-gray-900 dark:text-gray-100">
          {period.serviceStartDate || "?"} –{" "}
          {period.serviceEndDate || (period.incomplete ? "?" : "Present")}
        </h5>
        {period.incomplete && (
          <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
            Incomplete
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-700 dark:text-gray-300">
        <p>
          <span className="text-gray-500 dark:text-gray-400">
            {t("myPacketSection.branch")}:{" "}
          </span>
          {period.branch || "N/A"}
          {period.component ? ` (${period.component})` : ""}
        </p>
        <p>
          <span className="text-gray-500 dark:text-gray-400">Rank: </span>
          {period.rank || "N/A"}
          {period.payGrade ? ` (${period.payGrade})` : ""}
        </p>
        <p>
          <span className="text-gray-500 dark:text-gray-400">
            {t("myPacketSection.mos")}:{" "}
          </span>
          {period.mos || "N/A"}
          {period.mosTitle ? ` — ${period.mosTitle}` : ""}
        </p>
        <p>
          <span className="text-gray-500 dark:text-gray-400">
            {t("myPacketSection.characterOfService")}:{" "}
          </span>
          {period.characterOfService || "N/A"}
        </p>
        <p>
          <span className="text-gray-500 dark:text-gray-400">
            Separation Reason:{" "}
          </span>
          {period.narrativeReason || "N/A"}
        </p>
        <p>
          <span className="text-gray-500 dark:text-gray-400">
            Place of entry:{" "}
          </span>
          {period.placeOfEntry || "Not listed on this document"}
          {period.placeOfEntry && period.placeOfEntryLowConfidence && (
            <span
              className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full"
              title="This looks close to a well-known city name — double-check it against your original document in case of an OCR misread."
            >
              Low confidence
            </span>
          )}
        </p>
        <p>
          <span className="text-gray-500 dark:text-gray-400">Source: </span>
          {period.sourceDocument || "N/A"}
          {period.formType ? ` (${period.formType})` : ""}
        </p>
      </div>
    </div>
  );
}

function DD214PeriodsDetail({ periods, t }) {
  const sorted = [...periods].sort((a, b) => {
    const aKey = a.serviceEndDate || a.serviceStartDate || "";
    const bKey = b.serviceEndDate || b.serviceStartDate || "";
    return bKey.localeCompare(aKey);
  });
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
        Service Periods ({periods.length})
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Dates and place of entry are only shown when your documents actually
        list them — location data is limited by document quality, so some
        periods below may show dates only, or neither.
      </p>
      {sorted.map((period) => (
        <DD214PeriodDetailCard key={period.id} period={period} t={t} />
      ))}
    </div>
  );
}

function DD214DataActions({ setShowDD214Processor, handleClearDD214, t }) {
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      <button
        onClick={() => setShowDD214Processor(true)}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        🔄 {t("myPacketSection.reprocessDD214")}
      </button>
      <button
        disabled
        className="text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed"
        aria-label="Coming Soon"
      >
        📄 {t("myPacketSection.fullAnalyzerComingSoon")}
      </button>
      <button
        onClick={handleClearDD214}
        className="text-sm text-red-600 dark:text-red-400 hover:underline"
      >
        🗑️ {t("myPacketSection.clearDD214Data")}
      </button>
    </div>
  );
}

function DD214ExtractedDataDisplay({
  serviceHistory,
  setShowDD214Processor,
  handleClearDD214,
  t,
}) {
  const periods = serviceHistory.servicePeriods || [];
  const summary = summarizeServicePeriods(periods);
  return (
    <div className="space-y-4">
      <DD214PeriodsSummary
        summary={summary}
        dd214Data={serviceHistory.dd214Data}
        t={t}
      />
      {periods.length > 0 && <DD214PeriodsDetail periods={periods} t={t} />}
      <DD214DataActions
        setShowDD214Processor={setShowDD214Processor}
        handleClearDD214={handleClearDD214}
        t={t}
      />
    </div>
  );
}

function DD214SectionHeader({
  aiStatus,
  showDD214Processor,
  setShowDD214Processor,
  serviceHistory,
  t,
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
        📜 {t("myPacketSection.dd214Information")}
        {aiStatus.available && (
          <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
            {t("myPacketSection.aiReady")}
          </span>
        )}
      </h3>
      {!showDD214Processor && !serviceHistory.servicePeriods?.length && (
        <div className="flex gap-2">
          <button
            onClick={() => setShowDD214Processor(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            📝 {t("myPacketSection.pasteText")}
          </button>
          <button
            disabled
            className="px-4 py-2 bg-gray-400 text-white rounded-lg text-sm font-medium cursor-not-allowed flex items-center gap-2 opacity-60"
            aria-label="DD214 Analyzer - Coming Soon"
          >
            📄 {t("myPacketSection.fullAnalyzerComingSoon")}
          </button>
        </div>
      )}
    </div>
  );
}

function DD214Section({
  aiStatus,
  showDD214Processor,
  setShowDD214Processor,
  serviceHistory,
  dd214FileInputRef,
  handleDD214DragOver,
  handleDD214DragLeave,
  handleDD214Drop,
  handleDD214FileSelect,
  isDraggingDD214,
  dd214Text,
  setDD214Text,
  handleProcessDD214,
  isProcessingDD214,
  onOpenAISettings,
  handleClearDD214,
  t,
}) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
      <DD214SectionHeader
        aiStatus={aiStatus}
        showDD214Processor={showDD214Processor}
        setShowDD214Processor={setShowDD214Processor}
        serviceHistory={serviceHistory}
        t={t}
      />

      {!serviceHistory.servicePeriods?.length && !showDD214Processor && (
        <DD214DropZone
          dd214FileInputRef={dd214FileInputRef}
          handleDD214DragOver={handleDD214DragOver}
          handleDD214DragLeave={handleDD214DragLeave}
          handleDD214Drop={handleDD214Drop}
          handleDD214FileSelect={handleDD214FileSelect}
          isDraggingDD214={isDraggingDD214}
          t={t}
        />
      )}

      {showDD214Processor && (
        <DD214PasteProcessor
          dd214Text={dd214Text}
          setDD214Text={setDD214Text}
          handleProcessDD214={handleProcessDD214}
          isProcessingDD214={isProcessingDD214}
          aiStatus={aiStatus}
          onOpenAISettings={onOpenAISettings}
          setShowDD214Processor={setShowDD214Processor}
          setDD214Text2={setDD214Text}
          t={t}
        />
      )}

      {serviceHistory.servicePeriods?.length > 0 && !showDD214Processor && (
        <DD214ExtractedDataDisplay
          serviceHistory={serviceHistory}
          setShowDD214Processor={setShowDD214Processor}
          handleClearDD214={handleClearDD214}
          t={t}
        />
      )}
    </div>
  );
}

function DeploymentTheaterField({ newDeployment, setNewDeployment, t }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {t("myPacketSection.theaterOperation")} *
      </label>
      <select
        value={newDeployment.theater}
        onChange={(e) =>
          setNewDeployment((prev) => ({ ...prev, theater: e.target.value }))
        }
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      >
        <option value="">{t("myPacketSection.selectEllipsis")}</option>
        <option value="OIF">OIF - Operation Iraqi Freedom</option>
        <option value="OEF">OEF - Operation Enduring Freedom</option>
        <option value="OND">OND - Operation New Dawn</option>
        <option value="OIR">OIR - Operation Inherent Resolve</option>
        <option value="OFS">OFS - Operation Freedom&apos;s Sentinel</option>
        <option value="Gulf War">Gulf War</option>
        <option value="Vietnam">Vietnam</option>
        <option value="Korea">Korea</option>
        <option value="Somalia">Somalia</option>
        <option value="Bosnia">Bosnia</option>
        <option value="Kosovo">Kosovo</option>
        <option value="Europe">Europe (Other)</option>
        <option value="Pacific">Pacific</option>
        <option value="Other">Other</option>
      </select>
    </div>
  );
}

function DeploymentFormFields({ newDeployment, setNewDeployment, t }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <DeploymentTheaterField
        newDeployment={newDeployment}
        setNewDeployment={setNewDeployment}
        t={t}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.location")} *
        </label>
        <input
          type="text"
          value={newDeployment.location}
          onChange={(e) =>
            setNewDeployment((prev) => ({ ...prev, location: e.target.value }))
          }
          placeholder={t("myPacketSection.locationPlaceholder")}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.startDate")}
        </label>
        <input
          type="date"
          value={newDeployment.startDate}
          onChange={(e) =>
            setNewDeployment((prev) => ({ ...prev, startDate: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.endDate")}
        </label>
        <input
          type="date"
          value={newDeployment.endDate}
          onChange={(e) =>
            setNewDeployment((prev) => ({ ...prev, endDate: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.unit")}
        </label>
        <input
          type="text"
          value={newDeployment.unit}
          onChange={(e) =>
            setNewDeployment((prev) => ({ ...prev, unit: e.target.value }))
          }
          placeholder={t("myPacketSection.unitPlaceholder")}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
    </div>
  );
}

function DeploymentFormActions({
  newDeployment,
  setNewDeployment,
  handleAddDeployment,
  setShowDeploymentForm,
  t,
}) {
  return (
    <>
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={newDeployment.combat}
            onChange={(e) =>
              setNewDeployment((prev) => ({
                ...prev,
                combat: e.target.checked,
              }))
            }
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t("myPacketSection.combatZone")}
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={newDeployment.hazardous}
            onChange={(e) =>
              setNewDeployment((prev) => ({
                ...prev,
                hazardous: e.target.checked,
              }))
            }
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t("myPacketSection.hazardousDuty")}
          </span>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAddDeployment}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
        >
          {t("myPacketSection.saveDeployment")}
        </button>
        <button
          onClick={() => {
            setShowDeploymentForm(false);
            setNewDeployment({
              theater: "",
              location: "",
              startDate: "",
              endDate: "",
              unit: "",
              notes: "",
              hazardous: false,
              combat: false,
            });
          }}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {t("myPacketSection.cancel")}
        </button>
      </div>
    </>
  );
}

function DeploymentAddForm({
  newDeployment,
  setNewDeployment,
  handleAddDeployment,
  setShowDeploymentForm,
  t,
}) {
  return (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-4 space-y-4">
      <DeploymentFormFields
        newDeployment={newDeployment}
        setNewDeployment={setNewDeployment}
        t={t}
      />
      <DeploymentFormActions
        newDeployment={newDeployment}
        setNewDeployment={setNewDeployment}
        handleAddDeployment={handleAddDeployment}
        setShowDeploymentForm={setShowDeploymentForm}
        t={t}
      />
    </div>
  );
}

function DeploymentEntry({ dep, handleRemoveDeployment, t }) {
  return (
    <div className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {dep.theater}
          </span>
          {dep.combat && (
            <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
              {t("myPacketSection.combat")}
            </span>
          )}
          {dep.hazardous && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
              {t("myPacketSection.hazardous")}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {dep.location}
        </p>
        {(dep.startDate || dep.endDate) && (
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {dep.startDate || "?"} -{" "}
            {dep.endDate || t("myPacketSection.present")}
          </p>
        )}
        {dep.unit && (
          <p className="text-xs text-gray-500 dark:text-gray-500">{dep.unit}</p>
        )}
      </div>
      <button
        onClick={() => handleRemoveDeployment(dep.id)}
        className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
      >
        🗑️
      </button>
    </div>
  );
}

function DeploymentsSection({
  serviceHistory,
  showDeploymentForm,
  setShowDeploymentForm,
  newDeployment,
  setNewDeployment,
  handleAddDeployment,
  handleRemoveDeployment,
  t,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          🌍 {t("myPacketSection.deployments")}
        </h3>
        {!showDeploymentForm && (
          <button
            onClick={() => setShowDeploymentForm(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            ➕ {t("myPacketSection.addDeployment")}
          </button>
        )}
      </div>

      {showDeploymentForm && (
        <DeploymentAddForm
          newDeployment={newDeployment}
          setNewDeployment={setNewDeployment}
          handleAddDeployment={handleAddDeployment}
          setShowDeploymentForm={setShowDeploymentForm}
          t={t}
        />
      )}

      {serviceHistory.deployments.length === 0 && !showDeploymentForm ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {t("myPacketSection.noDeploymentsYet")}
        </p>
      ) : (
        <div className="space-y-3">
          {serviceHistory.deployments.map((dep) => (
            <DeploymentEntry
              key={dep.id}
              dep={dep}
              handleRemoveDeployment={handleRemoveDeployment}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AwardFormFields({ newAward, setNewAward, t }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.awardName")} *
        </label>
        <input
          type="text"
          value={newAward.name}
          onChange={(e) =>
            setNewAward((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder={t("myPacketSection.awardNamePlaceholder")}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.abbreviation")}
        </label>
        <input
          type="text"
          value={newAward.abbreviation}
          onChange={(e) =>
            setNewAward((prev) => ({ ...prev, abbreviation: e.target.value }))
          }
          placeholder={t("myPacketSection.abbreviationPlaceholder")}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.dateReceived")}
        </label>
        <input
          type="date"
          value={newAward.dateReceived}
          onChange={(e) =>
            setNewAward((prev) => ({ ...prev, dateReceived: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
      <div className="flex items-end pb-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={newAward.isCombat}
            onChange={(e) =>
              setNewAward((prev) => ({ ...prev, isCombat: e.target.checked }))
            }
            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t("myPacketSection.combatRelatedAward")}
          </span>
        </label>
      </div>
    </div>
  );
}

function AwardFormActions({
  setNewAward,
  handleAddAward,
  setShowAwardForm,
  t,
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={handleAddAward}
        className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
      >
        {t("myPacketSection.saveAward")}
      </button>
      <button
        onClick={() => {
          setShowAwardForm(false);
          setNewAward({
            name: "",
            abbreviation: "",
            dateReceived: "",
            notes: "",
            isCombat: false,
          });
        }}
        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        {t("myPacketSection.cancel")}
      </button>
    </div>
  );
}

function AwardAddForm({
  newAward,
  setNewAward,
  handleAddAward,
  setShowAwardForm,
  t,
}) {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 mb-4 space-y-4">
      <AwardFormFields newAward={newAward} setNewAward={setNewAward} t={t} />
      <AwardFormActions
        setNewAward={setNewAward}
        handleAddAward={handleAddAward}
        setShowAwardForm={setShowAwardForm}
        t={t}
      />
    </div>
  );
}

function AwardChip({ award, handleRemoveAward, t }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
      <span className="text-amber-700 dark:text-amber-300 font-medium">
        🎖️ {award.abbreviation || award.name}
      </span>
      {award.isCombat && (
        <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
          {t("myPacketSection.combat")}
        </span>
      )}
      <button
        onClick={() => handleRemoveAward(award.id)}
        className="text-red-400 hover:text-red-600 text-sm"
        aria-label={`Remove ${award.name}`}
      >
        ×
      </button>
    </div>
  );
}

function AwardsSection({
  serviceHistory,
  showAwardForm,
  setShowAwardForm,
  newAward,
  setNewAward,
  handleAddAward,
  handleRemoveAward,
  t,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          🎖️ {t("myPacketSection.awardsDecorations")}
        </h3>
        {!showAwardForm && (
          <button
            onClick={() => setShowAwardForm(true)}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            ➕ {t("myPacketSection.addAward")}
          </button>
        )}
      </div>

      {showAwardForm && (
        <AwardAddForm
          newAward={newAward}
          setNewAward={setNewAward}
          handleAddAward={handleAddAward}
          setShowAwardForm={setShowAwardForm}
          t={t}
        />
      )}

      {serviceHistory.awards.length === 0 && !showAwardForm ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {t("myPacketSection.noAwardsYet")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {serviceHistory.awards.map((award) => (
            <AwardChip
              key={award.id}
              award={award}
              handleRemoveAward={handleRemoveAward}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RibbonRackSection({
  serviceHistory,
  showRibbonRack,
  setShowRibbonRack,
}) {
  if (serviceHistory.awards.length === 0) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          🎗️ Ribbon Rack
        </h3>
        <button
          onClick={() => setShowRibbonRack(!showRibbonRack)}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          {showRibbonRack ? "Hide" : "View Ribbon Rack"}
        </button>
      </div>
      {showRibbonRack && (
        <div className="flex justify-center p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
          <RibbonRackDisplay
            awards={serviceHistory.awards.map((award) => ({
              awardId: award.id,
              award: enrichAwardForDisplay(award),
              devices: award.devices || [],
            }))}
            ribbonsPerRow={3}
            size="md"
            showNames={true}
          />
        </div>
      )}
    </div>
  );
}

// Read-only, straight from the last VA-returned service history response
// (vaRecords.serviceHistory, cached untouched by saveVARecordsRaw — see
// vaDataPersistence.js). Deliberately NOT sourced from vkb.serviceHistory:
// that object is fill-if-empty merged with DD214 data by saveServiceHistoryToVKB,
// so a veteran with DD214 data loaded first would see DD214 field values
// displayed under this VA-Verified badge. This section must only ever show
// what VA actually returned, even when it differs from the merged profile.
function VkbServiceHistorySection({ serviceHistory }) {
  return (
    <section className="border-t dark:border-gray-700 pt-4">
      <h3 className="font-bold text-teal-800 dark:text-teal-200 mb-1 flex items-center gap-2 flex-wrap">
        🎖️ VA-Verified Service Record
        <VaSourceBadge />
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        Read-only data exactly as returned by your VA.gov service history
        record.
      </p>
      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
        {serviceHistory.branch && (
          <p>
            <span className="font-medium">Branch:</span> {serviceHistory.branch}
          </p>
        )}
        {(serviceHistory.startDate || serviceHistory.endDate) && (
          <p>
            <span className="font-medium">Service Dates:</span>{" "}
            {serviceHistory.startDate || "—"} to {serviceHistory.endDate || "—"}
          </p>
        )}
        {serviceHistory.dischargeStatus && (
          <p>
            <span className="font-medium">Character of Service:</span>{" "}
            {serviceHistory.dischargeStatus}
          </p>
        )}
        {serviceHistory.payGrade && (
          <p>
            <span className="font-medium">Rank at Discharge:</span>{" "}
            {serviceHistory.payGrade}
          </p>
        )}
        {serviceHistory.deployments?.length > 0 && (
          <p>
            <span className="font-medium">Deployments:</span>{" "}
            {serviceHistory.deployments.length}
          </p>
        )}
      </div>
    </section>
  );
}

function ServiceTab(props) {
  const { t, vaRecords } = props;
  const vaServiceHistory = vaRecords?.serviceHistory;
  return (
    <div className="space-y-6">
      <DD214Section {...props} />
      <DeploymentsSection {...props} />
      <AwardsSection {...props} />
      <RibbonRackSection {...props} />

      {vaServiceHistory && (
        <VkbServiceHistorySection serviceHistory={vaServiceHistory} />
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          💡 <strong>{t("myPacketSection.whyTrackThis")}</strong>{" "}
          {t("myPacketSection.serviceHistoryBannerText")}
        </p>
      </div>
    </div>
  );
}

function ClaimsEmptyState({ onClose, t }) {
  return (
    <div className="text-center py-12">
      <svg
        className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        📂 {t("myPacketSection.noSavedClaims")}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        {t("myPacketSection.claimsDescription")}
      </p>
      <button
        onClick={onClose}
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
      >
        {t("myPacketSection.exploreSecondaryScout")}
      </button>
    </div>
  );
}

function ClaimDownloadMenu({ claim, handleDownloadStatement, t }) {
  return (
    <div className="absolute top-full mt-1 right-0 sm:left-0 sm:right-auto bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[160px]">
      <button
        onClick={() => handleDownloadStatement(claim, "txt")}
        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {t("myPacketSection.textTxt")}
      </button>
      <button
        onClick={() => handleDownloadStatement(claim, "docx")}
        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        {t("myPacketSection.wordDocx")}
      </button>
      <button
        onClick={() => handleDownloadStatement(claim, "pdf")}
        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-b-lg flex items-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        {t("myPacketSection.pdfFormat")}
      </button>
    </div>
  );
}

function ClaimActionButtons({
  claim,
  onResume,
  handleViewStatement,
  showDownloadMenu,
  setShowDownloadMenu,
  certifiedClaimIds,
  handleDownloadStatement,
  handleRemove,
  t,
}) {
  const isCertified = certifiedClaimIds.has(claim.id);
  return (
    <>
      {claim.status === "Drafting" ? (
        <button
          onClick={() => onResume(claim)}
          className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors text-xs sm:text-sm"
        >
          {t("myPacketSection.buildStatement")}
        </button>
      ) : (
        <button
          onClick={() => handleViewStatement(claim.id)}
          className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-xs sm:text-sm"
        >
          {t("myPacketSection.viewStatement")}
        </button>
      )}

      {claim.status !== "Drafting" && (
        <div className="relative w-full sm:w-auto">
          <button
            onClick={() =>
              setShowDownloadMenu(
                showDownloadMenu === claim.id ? null : claim.id,
              )
            }
            disabled={!isCertified}
            aria-label={
              !isCertified ? t("myPacketSection.certifyBeforeDownload") : ""
            }
            className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("myPacketSection.download")}
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showDownloadMenu === claim.id && isCertified && (
            <ClaimDownloadMenu
              claim={claim}
              handleDownloadStatement={handleDownloadStatement}
              t={t}
            />
          )}
        </div>
      )}

      <button
        onClick={() => handleRemove(claim.id)}
        className="w-full sm:w-auto px-3 sm:px-4 py-2 border-2 border-red-600 text-red-600 dark:text-red-400 dark:border-red-500 rounded-lg font-semibold hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-xs sm:text-sm"
      >
        {t("myPacketSection.remove")}
      </button>
    </>
  );
}

function ClaimEntry({
  claim,
  getStatusColor,
  handleStatusChange,
  vaAccessToken,
  onUploadEvidence,
  t,
  ...actionProps
}) {
  const canUploadEvidence = !!(claim.vaClaimId && vaAccessToken);
  return (
    <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-5 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">
              {claim.conditionName}
            </h3>
            <span
              className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded-full border whitespace-nowrap ${getStatusColor(claim.status)}`}
            >
              {claim.status}
            </span>
            {claim.vaClaimId || claim.vaAppealId ? (
              <VaSourceBadge />
            ) : (
              <ManualSourceBadge />
            )}
          </div>

          {claim.parentCondition && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t("myPacketSection.secondaryTo")}:{" "}
              <span className="font-semibold">{claim.parentCondition}</span>
            </p>
          )}

          {/* The Readiness Gauge - Claim Completeness Tracker */}
          <div className="my-3">
            <ClaimProgress
              conditionCode={claim.diagnosticCode}
              conditionName={claim.conditionName}
            />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("myPacketSection.saved")}:{" "}
            {new Date(claim.dateSaved).toLocaleDateString()}
            {claim.dateUpdated &&
              ` • ${t("myPacketSection.updated")}: ${new Date(claim.dateUpdated).toLocaleDateString()}`}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
          <select
            value={claim.status}
            onChange={(e) => handleStatusChange(claim.id, e.target.value)}
            className="w-full sm:w-auto px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 col-span-2 sm:col-span-1"
          >
            <option value="Drafting">{t("myPacketSection.drafting")}</option>
            <option value="Statement Generated">
              {t("myPacketSection.statementGenerated")}
            </option>
            <option value="Filed">{t("myPacketSection.filed")}</option>
          </select>

          {canUploadEvidence && (
            <button
              onClick={() => onUploadEvidence(claim)}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors text-xs sm:text-sm col-span-2 sm:col-span-1"
            >
              Upload Evidence to VA
            </button>
          )}

          <ClaimActionButtons claim={claim} t={t} {...actionProps} />
        </div>
      </div>
    </div>
  );
}

// Read-only, source-tagged C-File suggestions. Deliberately SEPARATE from the
// filed-claim list and NOT counted in the stats dashboard (getClaimStats reads
// the localStorage claim store; these come from VKB medicalConditions.current).
function CFileSuggestionsSection({ conditions }) {
  return (
    <section className="mt-2 mb-6 border border-teal-200 dark:border-teal-800 rounded-lg p-4 bg-teal-50/60 dark:bg-teal-900/10">
      <h3 className="font-bold text-teal-800 dark:text-teal-200 mb-1">
        🔎 Identified in your C-File (not yet filed)
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        AI suggestions from your analyzed records. These are NOT filed claims
        and are not counted in the totals above — review and file the ones that
        apply.
      </p>
      <ul className="space-y-2">
        {conditions.map((c, i) => (
          <li
            key={`${c.name}-${i}`}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {c.name}
            </span>
            {c.diagnosticCode && (
              <span className="text-xs font-mono bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                DC {c.diagnosticCode}
              </span>
            )}
            {c.likelihood && (
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                {c.likelihood}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClaimsTab({
  claims,
  cfileConditions = [],
  onClose,
  onResume,
  handleViewStatement,
  handleStatusChange,
  showDownloadMenu,
  setShowDownloadMenu,
  certifiedClaimIds,
  handleDownloadStatement,
  handleRemove,
  handleClearAll,
  getStatusColor,
  vaAccessToken,
  t,
}) {
  const [evidenceUploadClaim, setEvidenceUploadClaim] = useState(null);
  const hasClaims = claims.length > 0;
  const hasSuggestions = cfileConditions.length > 0;
  if (!hasClaims && !hasSuggestions) {
    return <ClaimsEmptyState onClose={onClose} t={t} />;
  }
  return (
    <>
      {hasClaims && (
        <div className="space-y-4 mb-6">
          {claims.map((claim) => (
            <ClaimEntry
              key={claim.id}
              claim={claim}
              getStatusColor={getStatusColor}
              handleStatusChange={handleStatusChange}
              onResume={onResume}
              handleViewStatement={handleViewStatement}
              showDownloadMenu={showDownloadMenu}
              setShowDownloadMenu={setShowDownloadMenu}
              certifiedClaimIds={certifiedClaimIds}
              handleDownloadStatement={handleDownloadStatement}
              handleRemove={handleRemove}
              vaAccessToken={vaAccessToken}
              onUploadEvidence={setEvidenceUploadClaim}
              t={t}
            />
          ))}
        </div>
      )}

      {hasSuggestions && (
        <CFileSuggestionsSection conditions={cfileConditions} />
      )}

      {hasClaims && (
        <div className="flex justify-center pt-4 border-t dark:border-gray-700">
          <button
            onClick={handleClearAll}
            className="px-6 py-3 border-2 border-red-500 text-red-500 dark:text-red-400 dark:border-red-500 rounded-lg font-semibold hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            {t("myPacketSection.clearAllClaims")}
          </button>
        </div>
      )}

      {evidenceUploadClaim && (
        <ClaimEvidenceUpload
          claimId={evidenceUploadClaim.vaClaimId}
          accessToken={vaAccessToken}
          claimDetails={{ type: evidenceUploadClaim.conditionName }}
          onClose={() => setEvidenceUploadClaim(null)}
        />
      )}
    </>
  );
}

function TimelineEmptyState({ onClose, t }) {
  return (
    <div className="text-center py-12">
      <svg
        className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        🧵 {t("myPacketSection.noTimelineEvents")}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
        {t("myPacketSection.timelineDescription")}
      </p>
      <button
        onClick={onClose}
        className="px-6 py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors inline-flex items-center gap-2"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        {t("myPacketSection.goToContinuityThread")}
      </button>
    </div>
  );
}

function TimelineEventEntry({ event, timelineEvents, setTimelineEvents, t }) {
  return (
    <div className="relative flex items-start gap-4 pl-10">
      <div
        className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${getTimelineDotClass(event.type)}`}
      ></div>

      <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${getTimelineBadgeClass(event.type)}`}
              >
                {event.type?.charAt(0).toUpperCase() + event.type?.slice(1) ||
                  "Event"}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {formatLocalDate(event.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              {event.title}
            </h4>
            {event.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {event.description}
              </p>
            )}
            {event.condition && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                {t("myPacketSection.relatedTo")}: {event.condition}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              const updated = timelineEvents.filter((e) => e.id !== event.id);
              setTimelineEvents(updated);
              import("../utils/veteranProfile").then((m) =>
                m.saveTimelineEvents(updated),
              );
            }}
            className="text-red-400 hover:text-red-600 transition-colors p-1"
            aria-label="Remove event"
          >
            <svg
              className="w-4 h-4"
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
  );
}

// Read-only VKB evidence-timeline events, merged into the DISPLAY only (never
// the store) so handleClearTimelineEvents keeps clearing user events alone.
function VkbTimelineSection({ events }) {
  // FIX-5: entries with no real extracted/filename date carry
  // dateIsProcessingDate: true and date: null instead of a fabricated
  // "today" date — sort those last and label them honestly rather than
  // rendering a fake date.
  const sorted = [...events].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });
  return (
    <section className="mt-6 border-t dark:border-gray-700 pt-4">
      <h3 className="font-bold text-teal-800 dark:text-teal-200 mb-1">
        📎 From your analyzed documents ({events.length})
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        Read-only events extracted from your C-File. Clearing your timeline
        above does not remove these.
      </p>
      <ul className="space-y-2">
        {sorted.map((e, i) => (
          <li
            key={`${e.date || "unknown"}-${i}`}
            className="text-sm text-gray-700 dark:text-gray-300 flex flex-wrap gap-2"
          >
            <span className="font-mono text-gray-500 dark:text-gray-400">
              {e.dateIsProcessingDate
                ? `date unknown — imported ${e.importedDate || ""}`
                : e.date || "—"}
            </span>
            <span>{e.description}</span>
            {e.source && (
              <span className="text-xs text-teal-700 dark:text-teal-300">
                [{e.source}]
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TimelineTab({
  timelineEvents,
  setTimelineEvents,
  handleClearTimelineEvents,
  vkbTimeline = [],
  onClose,
  t,
}) {
  const hasUserEvents = timelineEvents.length > 0;
  const hasVkbEvents = vkbTimeline.length > 0;
  if (!hasUserEvents && !hasVkbEvents) {
    return <TimelineEmptyState onClose={onClose} t={t} />;
  }
  const sortedEvents = [...timelineEvents].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
  return (
    <>
      {hasUserEvents && (
        <>
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {timelineEvents.length}{" "}
              {timelineEvents.length !== 1
                ? t("myPacketSection.eventsTracked")
                : t("myPacketSection.eventTracked")}
            </p>
            <button
              onClick={handleClearTimelineEvents}
              className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              {t("myPacketSection.clearAll")}
            </button>
          </div>

          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-slate-400 via-slate-300 to-slate-200 dark:from-slate-500 dark:via-slate-600 dark:to-slate-700"></div>

            <div className="space-y-4">
              {sortedEvents.map((event) => (
                <TimelineEventEntry
                  key={event.id}
                  event={event}
                  timelineEvents={timelineEvents}
                  setTimelineEvents={setTimelineEvents}
                  t={t}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {hasVkbEvents && <VkbTimelineSection events={vkbTimeline} />}

      <div className="mt-6 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          💡 <strong>{t("myPacketSection.whyTrackThis")}</strong>{" "}
          {t("myPacketSection.timelineBannerText")}
        </p>
      </div>
    </>
  );
}

function PainMapsEmptyState({ onClose, t }) {
  return (
    <div className="text-center py-12">
      <svg
        className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        🎨 {t("myPacketSection.noPainMapsSaved")}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
        {t("myPacketSection.painMapsDescription")}
      </p>
      <button
        onClick={onClose}
        className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors inline-flex items-center gap-2"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
        {t("myPacketSection.goToPainPainter")}
      </button>
    </div>
  );
}

function PainMapCard({ map, setViewingPainMap, handleDeletePainMap, t }) {
  return (
    <div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
      className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-red-300 dark:hover:border-red-500 transition-all cursor-pointer group"
      onClick={() => setViewingPainMap(map)}
    >
      <div className="aspect-[3/4] bg-gradient-to-b from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/40 relative flex items-center justify-center">
        {map.thumbnail ? (
          <img
            src={map.thumbnail}
            alt={map.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-center p-4">
            <span className="text-4xl">🎨</span>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {map.painPoints?.length || 0} {t("myPacketSection.painPoints")}
            </p>
          </div>
        )}

        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white font-semibold">
            {t("myPacketSection.viewDetails")}
          </span>
        </div>
      </div>

      <div className="p-3">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
          {map.name || t("myPacketSection.untitledPainMap")}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(map.savedAt || map.createdAt).toLocaleDateString()}
        </p>
        {map.conditions && map.conditions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {map.conditions.slice(0, 2).map((cond, idx) => (
              <span
                key={idx}
                className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded"
              >
                {cond}
              </span>
            ))}
            {map.conditions.length > 2 && (
              <span className="text-xs text-gray-500">
                +{map.conditions.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDeletePainMap(map.id);
          }}
          className="w-full px-3 py-1.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
        >
          {t("myPacketSection.delete")}
        </button>
      </div>
    </div>
  );
}

function PainMapsTab({
  painMaps,
  setPainMaps,
  setViewingPainMap,
  handleDeletePainMap,
  onClose,
  t,
}) {
  if (painMaps.length === 0) {
    return <PainMapsEmptyState onClose={onClose} t={t} />;
  }
  return (
    <>
      <div className="mb-4 flex justify-between items-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {painMaps.length}{" "}
          {painMaps.length !== 1
            ? t("myPacketSection.painMapsSaved")
            : t("myPacketSection.painMapSaved")}
        </p>
        <button
          onClick={() => {
            if (window.confirm(t("myPacketSection.confirmClearPainMaps"))) {
              setPainMaps([]);
              import("../utils/veteranProfile").then((m) => m.clearPainMaps());
            }
          }}
          className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
        >
          {t("myPacketSection.clearAll")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {painMaps.map((map) => (
          <PainMapCard
            key={map.id}
            map={map}
            setViewingPainMap={setViewingPainMap}
            handleDeletePainMap={handleDeletePainMap}
            t={t}
          />
        ))}
      </div>

      <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-sm text-red-700 dark:text-red-300">
          💡 <strong>{t("myPacketSection.whyTrackThis")}</strong>{" "}
          {t("myPacketSection.painMapsBannerText")}
        </p>
      </div>
    </>
  );
}

function PainMapDetailHeader({ viewingPainMap, setViewingPainMap, t }) {
  return (
    <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 flex items-center justify-between">
      <div>
        <h3 id="painmap-detail-title" className="text-xl font-bold">
          {viewingPainMap.name || t("myPacketSection.painMapDetails")}
        </h3>
        <p className="text-red-100 text-sm">
          {t("myPacketSection.saved")}:{" "}
          {new Date(
            viewingPainMap.savedAt || viewingPainMap.createdAt,
          ).toLocaleString()}
        </p>
      </div>
      <button
        onClick={() => setViewingPainMap(null)}
        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
        aria-label={t("common.close") || "Close"}
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
  );
}

function PainPointsPane({ viewingPainMap, t }) {
  return (
    <div>
      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
        {t("myPacketSection.painPoints")} (
        {viewingPainMap.painPoints?.length || 0})
      </h4>
      {viewingPainMap.painPoints && viewingPainMap.painPoints.length > 0 ? (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {viewingPainMap.painPoints.map((point, idx) => (
            <div
              key={idx}
              className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${getPainSeverityDotClass(point.severity)}`}
                ></span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {point.region || point.bodyPart}
                </span>
              </div>
              {point.type && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {t("myPacketSection.type")}: {point.type}
                </p>
              )}
              {point.notes && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">
                  &quot;{point.notes}&quot;
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 dark:text-gray-400">
          {t("myPacketSection.noPainPointsRecorded")}
        </p>
      )}

      {/* Generated Nexus Language */}
      {viewingPainMap.nexusLanguage && (
        <div className="mt-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t("myPacketSection.nexusLanguage")}
          </h4>
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
              {viewingPainMap.nexusLanguage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PainMapDetailModal({
  viewingPainMap,
  setViewingPainMap,
  handleDeletePainMap,
  t,
}) {
  return (
    <ResponsiveModal
      isOpen
      onClose={() => setViewingPainMap(null)}
      size="xl"
      zIndex={70}
      labelledBy="painmap-detail-title"
      header={
        <PainMapDetailHeader
          viewingPainMap={viewingPainMap}
          setViewingPainMap={setViewingPainMap}
          t={t}
        />
      }
    >
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pain Map Image */}
        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 flex items-center justify-center">
          {viewingPainMap.thumbnail ? (
            <img
              src={viewingPainMap.thumbnail}
              alt="Pain Map"
              className="max-w-full max-h-[400px] object-contain"
            />
          ) : (
            <div className="text-center py-12">
              <span className="text-6xl">🎨</span>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                {t("myPacketSection.noPreviewAvailable")}
              </p>
            </div>
          )}
        </div>

        {/* Pain Points List */}
        <PainPointsPane viewingPainMap={viewingPainMap} t={t} />
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={() => {
            handleDeletePainMap(viewingPainMap.id);
            setViewingPainMap(null);
          }}
          className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
        >
          {t("myPacketSection.deleteMap")}
        </button>
        <button
          onClick={() => setViewingPainMap(null)}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {t("myPacketSection.close")}
        </button>
      </div>
    </ResponsiveModal>
  );
}

function FormViewerModal({ viewingForm, setViewingForm, t }) {
  return (
    <ResponsiveModal
      isOpen
      onClose={() => setViewingForm(null)}
      size="xl"
      zIndex={70}
      labelledBy="form-viewer-title"
      header={
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h3 id="form-viewer-title" className="text-xl font-bold">
              {viewingForm.title || viewingForm.formName}
            </h3>
            <p className="text-blue-100 text-sm">{viewingForm.formNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewingForm(null)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label={t("common.close") || "Close"}
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
      }
    >
      {viewingForm.generatedContent && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 max-h-[60vh] overflow-auto">
          <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
            {viewingForm.generatedContent}
          </pre>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-4">
        <button
          onClick={() => {
            const blob = new Blob([viewingForm.generatedContent], {
              type: "text/plain",
            });
            const url = URL.createObjectURL(blob);
            if (!url.startsWith("blob:")) return; // Validate blob URL
            // deepcode ignore javascript/DOMXSS: URL is a validated blob: object URL created locally
            const a = document.createElement("a");
            a.href = url;
            a.download = `${viewingForm.formNumber || "form"}-${viewingForm.title || "draft"}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
        >
          {t("myPacketSection.downloadTxt")}
        </button>
        <button
          onClick={() => setViewingForm(null)}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {t("myPacketSection.close")}
        </button>
      </div>
    </ResponsiveModal>
  );
}

function StatementViewerHeader({
  setViewingStatement,
  setViewingClaimId,
  handleEditStatement,
  t,
}) {
  return (
    <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-6 py-4 flex items-center justify-between">
      <h3 id="statement-viewer-title" className="text-xl font-bold">
        {t("myPacketSection.generatedStatement")}
      </h3>
      <div className="flex items-center gap-3">
        <button
          onClick={handleEditStatement}
          className="px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-sm"
        >
          {t("myPacketSection.editStatement")}
        </button>
        <button
          onClick={() => {
            setViewingStatement(null);
            setViewingClaimId(null);
          }}
          className="text-white hover:text-gray-200"
          aria-label={t("common.close") || "Close"}
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
  );
}

function StatementViewerModal({
  viewingStatement,
  viewingClaimId,
  setViewingStatement,
  setViewingClaimId,
  handleEditStatement,
  certifiedClaimIds,
  setCertifiedClaimIds,
  t,
}) {
  return (
    <ResponsiveModal
      isOpen
      onClose={() => {
        setViewingStatement(null);
        setViewingClaimId(null);
        // D-10: reset this claim's certification when the viewer closes
        // — certifying a statement is a deliberate "I attest this is
        // true" action meant to happen right before download, not a
        // persistent setting that should silently carry over.
        setCertifiedClaimIds((prev) => {
          const next = new Set(prev);
          next.delete(viewingClaimId);
          return next;
        });
      }}
      size="xl"
      zIndex={70}
      labelledBy="statement-viewer-title"
      header={
        <StatementViewerHeader
          setViewingStatement={setViewingStatement}
          setViewingClaimId={setViewingClaimId}
          handleEditStatement={handleEditStatement}
          t={t}
        />
      }
    >
      <div className="space-y-6">
        {/* Draft Watermark */}
        <DraftWatermark variant="banner" />

        <div className="bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {t("myPacketSection.statementInSupport")}
          </h4>
          <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans">
            {viewingStatement.statement}
          </pre>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {t("myPacketSection.doctorsCheatSheet")}
          </h4>
          <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans">
            {viewingStatement.doctorNote}
          </pre>

          {/* Medical Disclaimer Footer */}
          <NexusDisclaimerFooter className="mt-4" />
        </div>

        {/* Certification Checkbox before download */}
        <div className="border-t pt-4">
          <CertificationCheckbox
            checked={certifiedClaimIds.has(viewingClaimId)}
            onChange={(checked) =>
              setCertifiedClaimIds((prev) => {
                const next = new Set(prev);
                if (checked) {
                  next.add(viewingClaimId);
                } else {
                  next.delete(viewingClaimId);
                }
                return next;
              })
            }
          />
        </div>
      </div>
    </ResponsiveModal>
  );
}

function ImportConfirmActionButtons({
  handleConfirmImport,
  setShowImportConfirm,
  t,
}) {
  return (
    <div className="space-y-3">
      <button
        onClick={() => handleConfirmImport("replace")}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {t("myPacketSection.replaceAllFreshStart")}
      </button>
      <button
        onClick={() => handleConfirmImport("merge")}
        className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        {t("myPacketSection.mergeAddNewOnly")}
      </button>
      <button
        onClick={() => setShowImportConfirm(null)}
        className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        {t("myPacketSection.cancel")}
      </button>
    </div>
  );
}

function ImportConfirmationModal({
  showImportConfirm,
  setShowImportConfirm,
  handleConfirmImport,
  t,
}) {
  return (
    <ResponsiveModal
      isOpen
      onClose={() => setShowImportConfirm(null)}
      size="sm"
      zIndex={70}
      labelledBy="import-confirm-title"
      header={
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
          <h3 id="import-confirm-title" className="text-xl font-bold">
            📥 {t("myPacketSection.confirmImport")}
          </h3>
        </div>
      }
    >
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {t("myPacketSection.backupDetails")}:
        </p>
        <ul className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
          <li>
            • <strong>{showImportConfirm.meta.claimCount}</strong>{" "}
            {t("myPacketSection.claimsFound")}
          </li>
          <li>
            • <strong>{showImportConfirm.meta.statementCount}</strong>{" "}
            {t("myPacketSection.statementsFound")}
          </li>
          {showImportConfirm.meta.exportDate && (
            <li>
              • {t("myPacketSection.backupDate")}:{" "}
              {new Date(showImportConfirm.meta.exportDate).toLocaleDateString()}
            </li>
          )}
        </ul>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {t("myPacketSection.importQuestion")}
      </p>

      <ImportConfirmActionButtons
        handleConfirmImport={handleConfirmImport}
        setShowImportConfirm={setShowImportConfirm}
        t={t}
      />

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
        ⚠️ {t("myPacketSection.replaceAllWarning")}
      </p>
    </ResponsiveModal>
  );
}

function PacketBuyMeCoffeeTriggers({
  claims,
  backupCreated,
  setBackupCreated,
}) {
  return (
    <>
      <BuyMeCoffee
        show={claims.length > 0 && !backupCreated}
        trigger="packet"
        context={{ count: claims.length }}
      />

      <BuyMeCoffee
        show={backupCreated}
        trigger="export"
        context={{ count: claims.length }}
        onDismiss={() => setBackupCreated(false)}
      />
    </>
  );
}

function VaGovRatingPasterModal({ handlePastedRatings, setShowVAGovPaster }) {
  return (
    <VAGovRatingPaster
      onRatingsParsed={handlePastedRatings}
      onClose={() => setShowVAGovPaster(false)}
    />
  );
}

function getStatusColor(status) {
  switch (status) {
    case "Drafting":
      return "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-100 border-yellow-300 dark:border-yellow-700";
    case "Statement Generated":
      return "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-100 border-blue-300 dark:border-blue-700";
    case "Filed":
      return "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-100 border-green-300 dark:border-green-700";
    default:
      return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600";
  }
}

function downloadAsTxt(statement, fileName) {
  const content =
    statement.statement +
    "\n\n---\n\nDOCTOR'S CHEAT SHEET\n\n" +
    statement.doctorNote;
  // deepcode ignore javascript/DOMXSS: triggerBlobDownload reconstructs URL from UUID regex only — a.href is literal 'blob:' + origin + '/' + UUID
  const blob = new Blob([content], { type: "text/plain" });
  triggerBlobDownload(blob, `${fileName}.txt`);
}

async function downloadAsDocx(statement, fileName, claim) {
  try {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "STATEMENT IN SUPPORT OF CLAIM",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: `Condition: ${claim.conditionName}`,
              spacing: { after: 200 },
            }),
            ...statement.statement.split("\n").map(
              (line) =>
                new Paragraph({
                  children: [new TextRun(line)],
                  spacing: { after: 100 },
                }),
            ),
            new Paragraph({
              text: "",
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: "DOCTOR'S CHEAT SHEET",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            ...statement.doctorNote.split("\n").map(
              (line) =>
                new Paragraph({
                  children: [new TextRun(line)],
                  spacing: { after: 100 },
                }),
            ),
          ],
        },
      ],
    });

    // deepcode ignore javascript/DOMXSS: triggerBlobDownload reconstructs URL from UUID regex only — a.href is literal 'blob:' + origin + '/' + UUID
    const blob = await Packer.toBlob(doc);
    triggerBlobDownload(blob, `${fileName}.docx`);
  } catch (error) {
    console.error("Error generating DOCX:", error);
    alert("Error generating Word document. Please try another format.");
  }
}

function downloadAsPdf(statement, fileName, claim) {
  try {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;
    let yPosition = 20;

    // Title
    pdf.setFontSize(16);
    pdf.setFont(undefined, "bold");
    pdf.text("STATEMENT IN SUPPORT OF CLAIM", pageWidth / 2, yPosition, {
      align: "center",
    });
    yPosition += 15;

    // Condition
    pdf.setFontSize(11);
    pdf.text(`Condition: ${claim.conditionName}`, margin, yPosition);
    yPosition += 10;

    // Statement content
    pdf.setFont(undefined, "normal");
    pdf.setFontSize(10);
    const statementLines = pdf.splitTextToSize(statement.statement, maxWidth);
    statementLines.forEach((line) => {
      if (yPosition > pdf.internal.pageSize.getHeight() - 20) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    });

    // Doctor's note section
    yPosition += 10;
    if (yPosition > pdf.internal.pageSize.getHeight() - 40) {
      pdf.addPage();
      yPosition = 20;
    }

    pdf.setFontSize(14);
    pdf.setFont(undefined, "bold");
    pdf.text("DOCTOR'S CHEAT SHEET", pageWidth / 2, yPosition, {
      align: "center",
    });
    yPosition += 10;

    pdf.setFont(undefined, "normal");
    pdf.setFontSize(10);
    const doctorLines = pdf.splitTextToSize(statement.doctorNote, maxWidth);
    doctorLines.forEach((line) => {
      if (yPosition > pdf.internal.pageSize.getHeight() - 20) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    });

    pdf.save(`${fileName}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Error generating PDF. Please try another format.");
  }
}

function _loadVeteranProfile(ctx) {
  const { setVeteranProfile } = ctx;
  const profile = getVeteranProfile();
  // Q4: the Profile tab's manual editor reads/writes the SAME canonical
  // array as the Service tab (serviceHistory.servicePeriods[]), not the
  // legacy profile.servicePeriods field.
  profile.servicePeriods = getServicePeriods();
  setVeteranProfile(profile || {});
}

async function _checkAIStatus(ctx) {
  const { setAIStatus } = ctx;
  const status = await getAIStatus();
  setAIStatus(status);
}

function _loadServiceHistory(ctx) {
  const { setServiceHistory } = ctx;
  const history = getServiceHistory();
  setServiceHistory(history);
}

function _loadTimelineEvents(ctx) {
  const { setTimelineEvents } = ctx;
  const events = getTimelineEvents();
  setTimelineEvents(events);
}

function _loadPainMaps(ctx) {
  const { setPainMaps } = ctx;
  const maps = getPainMaps();
  setPainMaps(maps);
}

function _loadSavedForms(ctx) {
  const { setSavedForms } = ctx;
  const forms = getSavedForms();
  setSavedForms(forms);
}

function _loadMyRatings(ctx) {
  const { setMyRatings } = ctx;
  const ratings = getMyRatings();
  setMyRatings(ratings);
}

function _loadVARecordsData(ctx) {
  const { setVaRecords } = ctx;
  const records = loadVARecords();
  setVaRecords(records);
}

function _loadClaimsData(ctx) {
  const { setClaims, setStats } = ctx;
  const savedClaims = getSavedClaims();
  setClaims(savedClaims);
  setStats(getClaimStats());
}

async function _loadVkbDocuments(ctx) {
  const { setDocuments } = ctx;
  try {
    setDocuments(await raceVkb(getAllDocumentsByCategory()));
  } catch {
    setDocuments(null);
  }
}

async function _loadVkbEnrichment(ctx) {
  const {
    setCfileConditions,
    setVkbTimeline,
    setVkbDisabilityRatings,
    setVkbEnrichmentLoading,
    setPacketSummary,
  } = ctx;
  setVkbEnrichmentLoading(true);
  try {
    // A blocked IndexedDB upgrade can time out the first race; one retry
    // covers that transient case instead of leaving the tab looking empty
    // for the rest of the session.
    let vkb = await raceVkb(loadVKB());
    if (!vkb) vkb = await raceVkb(loadVKB());
    if (!vkb) return;
    const current = Array.isArray(vkb.medicalConditions?.current)
      ? vkb.medicalConditions.current
      : [];
    setCfileConditions(current.filter((c) => c?.source === "C-File Analysis"));
    setVkbTimeline(
      Array.isArray(vkb.evidenceTimeline) ? vkb.evidenceTimeline : [],
    );
    const ratings = Array.isArray(vkb.vaClaimsHistory?.ratings)
      ? vkb.vaClaimsHistory.ratings
      : [];
    setVkbDisabilityRatings(ratings.filter((r) => r?.source === "VA.gov API"));
    // Derived from the VKB already in hand — groupDocumentationByCategory is
    // pure, so this costs no extra IndexedDB read.
    setPacketSummary(
      buildPacketSummary(vkb, groupDocumentationByCategory(vkb)),
    );
  } catch {
    // Best-effort read-only enrichment — leave defaults on failure.
  } finally {
    setVkbEnrichmentLoading(false);
  }
}

function _deletePainMapAndReload(mapId, ctx) {
  const { loadPainMaps } = ctx;
  if (window.confirm("Delete this pain map?")) {
    deletePainMap(mapId);
    loadPainMaps();
  }
}

function _clearTimelineEventsAndReload(ctx) {
  const { loadTimelineEvents } = ctx;
  if (window.confirm("Clear all timeline events? This cannot be undone.")) {
    clearTimelineEvents();
    loadTimelineEvents();
  }
}

function _removeFormAndReload(formId, ctx) {
  const { loadSavedForms } = ctx;
  if (
    window.confirm(
      "Are you sure you want to remove this form from your packet?",
    )
  ) {
    deleteSavedForm(formId);
    loadSavedForms();
  }
}

function _removeRatingAndReload(ratingId, ctx) {
  const { loadMyRatings } = ctx;
  if (window.confirm("Are you sure you want to remove this rating?")) {
    removeRating(ratingId);
    loadMyRatings();
  }
}

function _updateRatingAndReload(ratingId, updates, ctx) {
  const { loadMyRatings, setEditingRating } = ctx;
  updateRating(ratingId, updates);
  loadMyRatings();
  setEditingRating(null);
}

function _clearAllRatingsAndReload(ctx) {
  const { loadMyRatings } = ctx;
  if (
    window.confirm(
      "Are you sure you want to clear all saved ratings? This cannot be undone.",
    )
  ) {
    clearMyRatings();
    loadMyRatings();
  }
}

function _savePastedRatings(parsedRatings, ctx) {
  const { loadMyRatings, setShowVAGovPaster } = ctx;
  // Save each rating to veteranProfile
  parsedRatings.forEach((rating) => {
    addRating(rating);
  });
  loadMyRatings();
  setShowVAGovPaster(false);
}

function _clearVARecordsAndReload(ctx) {
  const { loadVARecordsData } = ctx;
  if (window.confirm("Clear all imported VA records? This cannot be undone.")) {
    clearVARecords();
    loadVARecordsData();
  }
}

function _disconnectVaSession(ctx) {
  const { vaLogout, setVaImportStatus } = ctx;
  vaLogout();
  setVaImportStatus({
    loading: false,
    success: null,
    message: "",
    counts: {},
  });
}

function _removeDeploymentAndReload(depId, ctx) {
  const { loadServiceHistory } = ctx;
  if (window.confirm("Remove this deployment from your service history?")) {
    removeDeployment(depId);
    loadServiceHistory();
  }
}

function _removeAwardAndReload(awardId, ctx) {
  const { loadServiceHistory } = ctx;
  if (window.confirm("Remove this award from your service history?")) {
    removeAward(awardId);
    loadServiceHistory();
  }
}

function _clearDD214AndReload(ctx) {
  const { loadServiceHistory } = ctx;
  if (window.confirm("Clear all DD214 extracted data?")) {
    clearDD214Data();
    clearServicePeriods();
    loadServiceHistory();
  }
}

function _removeClaimAndReload(claimId, ctx) {
  const { loadClaims } = ctx;
  if (
    window.confirm(
      "Are you sure you want to remove this claim from your packet?",
    )
  ) {
    removeClaim(claimId);
    loadClaims();
  }
}

function _clearAllClaimsAndReload(ctx) {
  const { loadClaims } = ctx;
  if (
    window.confirm(
      "Are you sure you want to clear all saved claims? This cannot be undone.",
    )
  ) {
    clearAllClaims();
    loadClaims();
  }
}

function _dismissBackupGuide(remindLater = true, ctx) {
  const { setShowBackupGuide } = ctx;
  setShowBackupGuide(false);
  if (!remindLater) {
    localStorage.setItem("vetrate_backup_guide_dismissed", "true");
  }
}

function _triggerRestoreClick(ctx) {
  const { fileInputRef } = ctx;
  if (fileInputRef.current) {
    fileInputRef.current.click();
  }
}

function _changeClaimStatus(claimId, newStatus, ctx) {
  const { loadClaims } = ctx;
  // Prevent changing to 'Statement Generated' if no statement exists
  if (newStatus === "Statement Generated") {
    const statement = getStatement(claimId);
    if (!statement) {
      alert(
        'Cannot mark as "Statement Generated" - no statement found. Please complete the Build Statement process first.',
      );
      return;
    }
  }

  updateClaimStatus(claimId, newStatus);
  loadClaims();
}

function _viewStatementForClaim(claimId, ctx) {
  const { setViewingStatement, setViewingClaimId } = ctx;
  const statement = getStatement(claimId);
  if (statement) {
    setViewingStatement(statement);
    setViewingClaimId(claimId);
  } else {
    alert("No statement found for this claim. Please build a statement first.");
  }
}

function _dd214DragOver(e, ctx) {
  const { setIsDraggingDD214 } = ctx;
  e.preventDefault();
  e.stopPropagation();
  setIsDraggingDD214(true);
}

function _dd214DragLeave(e, ctx) {
  const { setIsDraggingDD214 } = ctx;
  e.preventDefault();
  e.stopPropagation();
  setIsDraggingDD214(false);
}

function _dd214DropFile(e, ctx) {
  const { setIsDraggingDD214, onOpenDD214Analyzer } = ctx;
  e.preventDefault();
  e.stopPropagation();
  setIsDraggingDD214(false);

  const files = Array.from(e.dataTransfer?.files || []);
  const pdfFile = files.find(
    (f) =>
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
  );

  if (pdfFile) {
    // FIX-2: carry the dropped file through — onOpenDD214Analyzer() used
    // to be called with no arguments, discarding it, so the analyzer
    // opened empty and the veteran had to re-select the file.
    if (onOpenDD214Analyzer) {
      onOpenDD214Analyzer(pdfFile);
    }
  } else {
    alert("Please drop a PDF file (DD214 document).");
  }
}

function _dd214FileSelected(e, ctx) {
  const { onOpenDD214Analyzer, dd214FileInputRef } = ctx;
  const file = e.target.files?.[0];
  if (file) {
    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      // FIX-2: carry the selected file through (see _dd214DropFile).
      if (onOpenDD214Analyzer) {
        onOpenDD214Analyzer(file);
      }
    } else {
      alert("Please select a PDF file.");
    }
  }
  // Reset input
  if (dd214FileInputRef.current) {
    dd214FileInputRef.current.value = "";
  }
}

function _addDeploymentAndReset(newDeployment, ctx) {
  const { loadServiceHistory, setNewDeployment, setShowDeploymentForm } = ctx;
  if (!newDeployment.theater || !newDeployment.location) {
    alert("Please enter at least theater and location");
    return;
  }
  addDeployment(newDeployment);
  loadServiceHistory();
  setNewDeployment({
    theater: "",
    location: "",
    startDate: "",
    endDate: "",
    unit: "",
    notes: "",
    hazardous: false,
    combat: false,
  });
  setShowDeploymentForm(false);
}

function _addAwardAndReset(newAward, ctx) {
  const { loadServiceHistory, setNewAward, setShowAwardForm } = ctx;
  if (!newAward.name) {
    alert("Please enter the award name");
    return;
  }
  addAward(newAward);
  loadServiceHistory();
  setNewAward({
    name: "",
    abbreviation: "",
    dateReceived: "",
    notes: "",
    isCombat: false,
  });
  setShowAwardForm(false);
}

function _parseDD214AiResponse(contentStr) {
  let cleanContent = contentStr.trim();
  if (cleanContent.startsWith("```json")) cleanContent = cleanContent.slice(7);
  if (cleanContent.startsWith("```")) cleanContent = cleanContent.slice(3);
  if (cleanContent.endsWith("```")) cleanContent = cleanContent.slice(0, -3);
  try {
    return JSON.parse(cleanContent.trim());
  } catch (parseError) {
    console.error("Parse error:", parseError);
    throw new Error("Could not parse DD214 data");
  }
}

function _toIsoDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return dateStr;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// Q5: when AI is unavailable, fall back to parseServiceRecord (the same
// regex extractor Muster Call already uses) instead of hard-disabling the
// paste button. Less reliable than AI extraction, so it's tagged with a
// low confidence and the veteran is told to double-check the result.
async function _processDD214TextWithoutAI(dd214Text, ctx) {
  const {
    setIsProcessingDD214,
    loadServiceHistory,
    setDD214Text,
    setShowDD214Processor,
  } = ctx;
  setIsProcessingDD214(true);
  try {
    const parsed = await parseServiceRecord(dd214Text);
    saveDD214Data({
      fullName: parsed.veteranName,
      lastName: parsed.lastName,
      firstName: parsed.firstName,
      middleName: parsed.middleName,
      dateOfBirth: parsed.dateOfBirth,
      extractedText: dd214Text.substring(0, 5000),
      confidence: 0.4,
    });
    upsertServicePeriod(
      {
        serviceStartDate: _toIsoDate(parsed.serviceStartDate),
        serviceEndDate: _toIsoDate(parsed.serviceEndDate),
        branch: parsed.branch || "",
        rank: parsed.rank || "",
        payGrade: parsed.payGrade || "",
        mos: parsed.mos || "",
        mosTitle: parsed.mosTitle || "",
        characterOfService: parsed.dischargeType || "",
        separationType: parsed.separationType || "",
        separationAuthority: parsed.separationAuthority || "",
        separationCode: parsed.spdCode || "",
        reentryCode: parsed.reentryCode || "",
        narrativeReason: parsed.narrativeReason || "",
        foreignService: !!parsed.foreignService,
        formType: parsed.formType || "DD214",
      },
      { sourceDocument: "Pasted DD214 Text", confidence: 0.4 },
    );
    (parsed.awards || []).forEach((item) => {
      const name = item.award?.name || item.matchedText;
      if (!name) return;
      addAward({ name, devices: item.devices || [] });
    });
    loadServiceHistory();
    setDD214Text("");
    setShowDD214Processor(false);
    alert(
      "DD214 information extracted using text pattern matching (no AI configured). Review the Service tab and correct anything that looks wrong.",
    );
  } catch (error) {
    console.error("Error processing DD214 without AI:", error);
    alert("Error processing DD214. Please try again.");
  } finally {
    setIsProcessingDD214(false);
  }
}

async function _processDD214Text(dd214Text, aiStatus, ctx) {
  const {
    setIsProcessingDD214,
    loadServiceHistory,
    setDD214Text,
    setShowDD214Processor,
  } = ctx;
  if (!dd214Text.trim()) {
    alert("Please paste your DD214 text first");
    return;
  }

  if (!aiStatus.available) {
    await _processDD214TextWithoutAI(dd214Text, ctx);
    return;
  }

  setIsProcessingDD214(true);

  try {
    const response = await generateAI(
      `Extract key information from this DD214 text. Return ONLY a valid JSON object with these fields:
{
  "branch": "Army/Navy/Air Force/Marines/Coast Guard/Space Force",
  "mos": "Primary MOS code",
  "mosTitle": "MOS job title",
  "entryDate": "YYYY-MM-DD or null",
  "separationDate": "YYYY-MM-DD or null",
  "yearsService": number or null,
  "monthsService": number or null,
  "separationType": "Honorable/General/Other Than Honorable/etc",
  "characterOfService": "Honorable/General/etc",
  "reenlisted": true/false,
  "foreignService": true/false
}

DD214 TEXT:
${dd214Text}

Return ONLY the JSON object, no explanation.`,
      {
        temperature: 0.3,
        maxTokens: 512,
        expectJSON: true,
      },
    );

    // generateAI returns { text, mode } object - extract the text content
    const content = response?.text || response;
    if (content) {
      const contentStr =
        typeof content === "string" ? content : JSON.stringify(content);
      const data = _parseDD214AiResponse(contentStr);

      saveDD214Data({
        ...data,
        extractedText: dd214Text.substring(0, 5000), // Store first 5000 chars
      });
      loadServiceHistory();
      setDD214Text("");
      setShowDD214Processor(false);
      alert("DD214 information extracted and saved successfully!");
    } else {
      alert(
        "Could not extract DD214 information. Please try again or enter manually.",
      );
    }
  } catch (error) {
    console.error("Error processing DD214:", error);
    alert("Error processing DD214. Please try again.");
  } finally {
    setIsProcessingDD214(false);
  }
}

function _createPacketBackup(claims, ctx) {
  const {
    setImportStatus,
    setBackupCreated,
    setHasExternalBackup,
    setShowBackupGuide,
  } = ctx;
  const statements = getAllStatements();
  const veteranProfile = getVeteranProfile();
  const forms = getSavedForms();
  const exportData = exportCompletePacket(
    claims,
    statements,
    veteranProfile,
    forms,
  );
  downloadPacketBackup(
    exportData,
    `vet-rate-complete-backup-${new Date().toISOString().split("T")[0]}.json`,
  );
  setImportStatus({
    type: "success",
    message: `Complete backup created with ${claims.length} claims, ${forms.length} forms, and your profile`,
  });
  setBackupCreated(true);
  setHasExternalBackup(true);
  setShowBackupGuide(false);
  localStorage.setItem(
    "vetrate_external_backup_created",
    Date.now().toString(),
  );
  setTimeout(() => setImportStatus(null), 4000);
}

function _handleBackupFileSelect(event, ctx) {
  const { setImportStatus, setShowImportConfirm } = ctx;
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate file type
  if (!file.name.endsWith(".json")) {
    setImportStatus({
      type: "error",
      message: "Invalid file type. Please select a .json backup file.",
    });
    return;
  }

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    setImportStatus({
      type: "error",
      message: "File too large. Maximum size is 5MB.",
    });
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    // Use complete import to handle profile and forms too
    const result = importCompletePacket(e.target.result);

    if (!result.success) {
      setImportStatus({ type: "error", message: result.error });
      return;
    }

    // Show confirmation dialog with preview
    setShowImportConfirm({
      data: result.data,
      meta: result.meta,
    });
  };

  reader.onerror = () => {
    setImportStatus({ type: "error", message: "Failed to read file." });
  };

  reader.readAsText(file);

  // Reset input so same file can be selected again
  event.target.value = "";
}

function _downloadStatementForClaim(claim, format = "txt", ctx) {
  const { setShowDownloadMenu } = ctx;
  const statement = getStatement(claim.id);

  if (!statement) {
    alert("No statement found for this claim. Please build a statement first.");
    return;
  }

  const fileName = `VA-Statement-${claim.conditionName.replace(/\s+/g, "-")}`;

  switch (format) {
    case "txt":
      downloadAsTxt(statement, fileName);
      break;
    case "docx":
      downloadAsDocx(statement, fileName, claim);
      break;
    case "pdf":
      downloadAsPdf(statement, fileName, claim);
      break;
    default:
      downloadAsTxt(statement, fileName);
  }

  setShowDownloadMenu(null);
}

function _editViewedStatement(viewingClaimId, claims, ctx) {
  const { onResume, setViewingStatement, setViewingClaimId } = ctx;
  if (viewingClaimId) {
    const claim = claims.find((c) => c.id === viewingClaimId);
    if (claim && onResume) {
      setViewingStatement(null);
      setViewingClaimId(null);
      onResume(claim);
    }
  }
}

function DocumentsEmptyState({ onClose, t }) {
  return (
    <div className="text-center py-12">
      <span className="text-5xl">📁</span>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2">
        No analyzed documents yet
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
        When you analyze a C-File or other record, its findings are saved here
        for reference.
      </p>
      <button
        onClick={onClose}
        className="px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-colors"
      >
        {t("common.close") || "Close"}
      </button>
    </div>
  );
}

function DocumentFindingScalars({ scalars }) {
  if (scalars.length === 0) return null;
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 px-4 py-3 text-sm">
      {scalars.map(({ label, value }) => (
        <div key={label} className="flex flex-wrap gap-x-2 min-w-0">
          <dt className="text-gray-500 dark:text-gray-400">{label}:</dt>
          <dd className="font-medium text-gray-900 dark:text-gray-100 min-w-0 break-words">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DocumentChipRow({ label, values }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}:</span>
      {values.map((value) => (
        <span
          key={value}
          className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 break-words"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function DocumentFindingLists({ findings }) {
  const rows = [
    ...findings.lists,
    ...(findings.conditions.length > 0
      ? [{ label: "Conditions named", values: findings.conditions }]
      : []),
  ];
  if (rows.length === 0) return null;
  return (
    <div className="px-4 pb-3 space-y-2">
      {rows.map((row) => (
        <DocumentChipRow key={row.label} {...row} />
      ))}
    </div>
  );
}

function DocumentCardHeader({ findings }) {
  const meta = [
    findings.analyzedOn && `Analyzed ${findings.analyzedOn}`,
    findings.pageCount &&
      `${findings.pageCount.toLocaleString()} page${findings.pageCount === 1 ? "" : "s"}`,
    findings.fileSize && formatFileSize(findings.fileSize),
    findings.segmentCount > 0 &&
      `${findings.segmentCount.toLocaleString()} documents inside`,
    findings.ocrUsed && "OCR",
  ].filter(Boolean);

  return (
    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <h4 className="font-semibold text-gray-900 dark:text-gray-100 break-words">
        {findings.icon} {findings.fileName}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {[...meta, "read-only"].join(" · ")}
      </p>
    </div>
  );
}

// One card per stored document, for every category — not just C-Files. The
// previous version rendered the cFiles bucket only, so DD-214s, Blue Button
// exports and private records showed up as a bare count with none of the
// fields the ingestion pipeline had already extracted from them.
function DocumentFindingsCard({ findings }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <DocumentCardHeader findings={findings} />

      {findings.summary && (
        <p className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
          {findings.summary}
        </p>
      )}

      {findings.parseError && (
        <p className="px-4 py-2 text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40">
          Raw text stored, but structured fields could not be read from this
          document ({findings.parseError}).
        </p>
      )}

      <DocumentFindingScalars scalars={findings.scalars} />
      <DocumentFindingLists findings={findings} />

      {findings.claimObjects.length > 0 && (
        <CFileClaimsCards claims={findings.claimObjects} />
      )}
      {findings.timeline.length > 0 && (
        <CFileTimeline events={findings.timeline} />
      )}
    </div>
  );
}

function ConditionSynthesisSection({ conditions }) {
  const mentioned = conditions.filter((c) => c.documentCount > 0);
  if (mentioned.length === 0) return null;
  return (
    <section>
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
        🔗 Conditions across your records ({mentioned.length})
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Which of your documents mention each condition. A condition in more than
        one record is corroborated by more than one source.
      </p>
      <ul className="space-y-2">
        {mentioned.map((condition) => (
          <li
            key={condition.key}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2"
          >
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-gray-900 dark:text-gray-100 min-w-0 break-words">
                {condition.name}
              </span>
              {Number.isFinite(condition.ratedPercentage) && (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                  {condition.ratedPercentage}%
                </span>
              )}
              {condition.serviceConnected && (
                <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                  service connected
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {condition.documentCount === 1
                  ? "1 document"
                  : `${condition.documentCount} documents`}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 break-words">
              {condition.documents.join(", ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Read-only view of the VKB document archive. `documents` is the
// getAllDocumentsByCategory() shape (null until loaded / on slow VKB);
// `packetSummary` carries the derived per-document findings.
function DocumentsTab({ documents, packetSummary, onClose, t }) {
  const totalDocs = documents
    ? Object.values(documents).reduce((sum, cat) => sum + (cat?.count || 0), 0)
    : 0;

  if (totalDocs === 0) {
    return <DocumentsEmptyState onClose={onClose} t={t} />;
  }

  const findings = packetSummary?.documents || [];

  return (
    <div className="space-y-6">
      <ConditionSynthesisSection conditions={packetSummary?.conditions || []} />

      {findings.length > 0 && (
        <section>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
            📚 Findings by document ({findings.length})
          </h3>
          <div className="space-y-4">
            {findings.map((doc) => (
              <DocumentFindingsCard
                key={doc.id || doc.fileName}
                findings={doc}
              />
            ))}
          </div>
        </section>
      )}

      <section className="text-sm text-gray-600 dark:text-gray-400 border-t dark:border-gray-700 pt-4">
        <p className="font-medium mb-1">All documents on file: {totalDocs}</p>
        <ul className="space-y-0.5">
          {Object.values(documents)
            .filter((cat) => (cat?.count || 0) > 0)
            .map((cat) => (
              <li key={cat.label}>
                {cat.icon} {cat.label}: {cat.count}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

function MyPacketTabContent(props) {
  const { activeTab, viewingPainMap, viewingForm } = props;
  return (
    <div className="p-6">
      {/* MY RATINGS TAB */}
      {activeTab === "ratings" && <RatingsTab {...props} />}

      {/* VETERAN PROFILE TAB */}
      {activeTab === "profile" && <ProfileTab {...props} />}

      {/* FORMS TAB */}
      {activeTab === "forms" && <FormsTab {...props} />}

      {/* VA RECORDS TAB - Full VA Data Center */}
      {activeTab === "varecords" && <VADataCenter embeddedMode={true} />}

      {/* DOCUMENTS TAB - read-only VKB document archive (Wave 2a) */}
      {activeTab === "documents" && <DocumentsTab {...props} />}

      {/* SERVICE HISTORY TAB */}
      {activeTab === "service" && <ServiceTab {...props} />}

      {/* CLAIMS TAB */}
      {activeTab === "claims" && <ClaimsTab {...props} />}

      {/* TIMELINE EVENTS TAB */}
      {activeTab === "timeline" && <TimelineTab {...props} />}

      {/* PAIN MAPS TAB */}
      {activeTab === "painmaps" && <PainMapsTab {...props} />}

      {/* Pain Map Detail Modal */}
      {viewingPainMap && <PainMapDetailModal {...props} />}

      {/* Form Viewer Modal */}
      {viewingForm && <FormViewerModal {...props} />}
    </div>
  );
}

function useMyPacketCoreState() {
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    drafting: 0,
    statementGenerated: 0,
    filed: 0,
  });
  const [viewingStatement, setViewingStatement] = useState(null);
  const [viewingClaimId, setViewingClaimId] = useState(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [showImportConfirm, setShowImportConfirm] = useState(null);
  const [backupCreated, setBackupCreated] = useState(false);
  // D-10: keyed by claim id, not a single shared boolean — certifying one
  // claim's statement previously silently "certified" every other claim's
  // download button too.
  const [certifiedClaimIds, setCertifiedClaimIds] = useState(() => new Set());
  const [showBackupGuide, setShowBackupGuide] = useState(false); // Ground Guide - first-time backup guidance
  const [_hasExternalBackup, setHasExternalBackup] = useState(false); // Track if user has downloaded backup
  // VKB-derived, READ-ONLY document-flow state (Wave 2a). Additive: these never
  // feed getClaimStats or the counters. `documents` is null until the async VKB
  // read resolves (or stays null if VKB is slow/unavailable — tabs render empty).
  const [documents, setDocuments] = useState(null);
  const [cfileConditions, setCfileConditions] = useState([]);
  const [vkbTimeline, setVkbTimeline] = useState([]);
  const [vkbDisabilityRatings, setVkbDisabilityRatings] = useState([]);
  const [vkbEnrichmentLoading, setVkbEnrichmentLoading] = useState(true);
  const [packetSummary, setPacketSummary] = useState(null);
  const fileInputRef = useRef(null);
  const packetContentRef = useRef(null);

  return {
    claims,
    setClaims,
    stats,
    setStats,
    documents,
    setDocuments,
    cfileConditions,
    setCfileConditions,
    vkbTimeline,
    setVkbTimeline,
    vkbDisabilityRatings,
    setVkbDisabilityRatings,
    vkbEnrichmentLoading,
    setVkbEnrichmentLoading,
    packetSummary,
    setPacketSummary,
    viewingStatement,
    setViewingStatement,
    viewingClaimId,
    setViewingClaimId,
    showDownloadMenu,
    setShowDownloadMenu,
    importStatus,
    setImportStatus,
    showImportConfirm,
    setShowImportConfirm,
    backupCreated,
    setBackupCreated,
    certifiedClaimIds,
    setCertifiedClaimIds,
    showBackupGuide,
    setShowBackupGuide,
    setHasExternalBackup,
    fileInputRef,
    packetContentRef,
  };
}

function useMyPacketTabsState() {
  const [activeTab, setActiveTab] = useState("claims");
  const [savedForms, setSavedForms] = useState([]);
  const [viewingForm, setViewingForm] = useState(null);
  const [myRatings, setMyRatings] = useState([]);
  const [editingRating, setEditingRating] = useState(null);
  const [showVAGovPaster, setShowVAGovPaster] = useState(false);

  return {
    activeTab,
    setActiveTab,
    savedForms,
    setSavedForms,
    viewingForm,
    setViewingForm,
    myRatings,
    setMyRatings,
    editingRating,
    setEditingRating,
    showVAGovPaster,
    setShowVAGovPaster,
  };
}

function useMyPacketTimelinePainState() {
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [painMaps, setPainMaps] = useState([]);
  const [viewingPainMap, setViewingPainMap] = useState(null);

  return {
    timelineEvents,
    setTimelineEvents,
    painMaps,
    setPainMaps,
    viewingPainMap,
    setViewingPainMap,
  };
}

function useMyPacketServiceHistoryState() {
  const [serviceHistory, setServiceHistory] = useState({
    deployments: [],
    awards: [],
    dd214Data: null,
  });
  const [showDeploymentForm, setShowDeploymentForm] = useState(false);
  const [showAwardForm, setShowAwardForm] = useState(false);
  const [showRibbonRack, setShowRibbonRack] = useState(false);
  const [showDD214Processor, setShowDD214Processor] = useState(false);
  const [newDeployment, setNewDeployment] = useState({
    theater: "",
    location: "",
    startDate: "",
    endDate: "",
    unit: "",
    notes: "",
    hazardous: false,
    combat: false,
  });
  const [newAward, setNewAward] = useState({
    name: "",
    abbreviation: "",
    dateReceived: "",
    notes: "",
    isCombat: false,
  });
  const [dd214Text, setDD214Text] = useState("");
  const [isProcessingDD214, setIsProcessingDD214] = useState(false);
  const [aiStatus, setAIStatus] = useState({ available: false });
  const [isDraggingDD214, setIsDraggingDD214] = useState(false);
  const dd214FileInputRef = useRef(null);

  return {
    serviceHistory,
    setServiceHistory,
    showDeploymentForm,
    setShowDeploymentForm,
    showAwardForm,
    setShowAwardForm,
    showRibbonRack,
    setShowRibbonRack,
    showDD214Processor,
    setShowDD214Processor,
    newDeployment,
    setNewDeployment,
    newAward,
    setNewAward,
    dd214Text,
    setDD214Text,
    isProcessingDD214,
    setIsProcessingDD214,
    aiStatus,
    setAIStatus,
    isDraggingDD214,
    setIsDraggingDD214,
    dd214FileInputRef,
  };
}

function useMyPacketVaState() {
  const [vaRecords, setVaRecords] = useState(null);
  const {
    isAuthenticated: isVaAuthenticated,
    isLoading: _vaAuthLoading,
    userInfo: _vaUserInfo,
    login: _vaLogin,
    logout: vaLogout,
    accessToken: vaAccessToken,
    error: _vaAuthError,
  } = useVaAuth();
  const [vaImportStatus, setVaImportStatus] = useState({
    loading: false,
    success: null,
    message: "",
    counts: {},
  });

  return {
    vaRecords,
    setVaRecords,
    isVaAuthenticated,
    vaLogout,
    vaAccessToken,
    vaImportStatus,
    setVaImportStatus,
  };
}

function _buildPacketLoaders(state) {
  const {
    setVeteranProfile,
    setAIStatus,
    setServiceHistory,
    setTimelineEvents,
    setPainMaps,
    setSavedForms,
    setMyRatings,
    setVaRecords,
    setClaims,
    setStats,
    setDocuments,
    setCfileConditions,
    setVkbTimeline,
    setVkbDisabilityRatings,
    setVkbEnrichmentLoading,
  } = state;

  const loadVeteranProfile = () => _loadVeteranProfile({ setVeteranProfile });
  const checkAIStatus = async () => {
    await _checkAIStatus({ setAIStatus });
  };
  const loadServiceHistory = () => _loadServiceHistory({ setServiceHistory });
  const loadTimelineEvents = () => _loadTimelineEvents({ setTimelineEvents });
  const loadPainMaps = () => _loadPainMaps({ setPainMaps });
  const loadSavedForms = () => _loadSavedForms({ setSavedForms });
  const loadMyRatings = () => _loadMyRatings({ setMyRatings });
  const loadVARecordsData = () => _loadVARecordsData({ setVaRecords });
  const loadClaims = () => _loadClaimsData({ setClaims, setStats });
  const loadDocuments = () => _loadVkbDocuments({ setDocuments });
  const loadVkbEnrichment = () =>
    _loadVkbEnrichment({
      setCfileConditions,
      setVkbTimeline,
      setVkbDisabilityRatings,
      setVkbEnrichmentLoading,
      setPacketSummary,
    });

  return {
    loadVeteranProfile,
    checkAIStatus,
    loadServiceHistory,
    loadTimelineEvents,
    loadPainMaps,
    loadSavedForms,
    loadMyRatings,
    loadVARecordsData,
    loadClaims,
    loadDocuments,
    loadVkbEnrichment,
  };
}

function _buildPacketPainTimelineHandlers(ctx) {
  const { loadPainMaps, loadTimelineEvents } = ctx;
  const handleDeletePainMap = (mapId) =>
    _deletePainMapAndReload(mapId, { loadPainMaps });
  const handleClearTimelineEvents = () =>
    _clearTimelineEventsAndReload({ loadTimelineEvents });
  return { handleDeletePainMap, handleClearTimelineEvents };
}

function _buildPacketFormsRatingsHandlers(ctx) {
  const {
    loadSavedForms,
    loadMyRatings,
    setEditingRating,
    setShowVAGovPaster,
  } = ctx;

  const handleRemoveForm = (formId) =>
    _removeFormAndReload(formId, { loadSavedForms });
  const handleRemoveRating = (ratingId) =>
    _removeRatingAndReload(ratingId, { loadMyRatings });
  const handleUpdateRating = (ratingId, updates) =>
    _updateRatingAndReload(ratingId, updates, {
      loadMyRatings,
      setEditingRating,
    });
  const handleClearAllRatings = () =>
    _clearAllRatingsAndReload({ loadMyRatings });
  const handlePastedRatings = (parsedRatings) =>
    _savePastedRatings(parsedRatings, { loadMyRatings, setShowVAGovPaster });

  return {
    handleRemoveForm,
    handleRemoveRating,
    handleUpdateRating,
    handleClearAllRatings,
    handlePastedRatings,
  };
}

function _buildPacketVaHandlers(ctx) {
  const {
    loadVARecordsData,
    loadClaims,
    loadVkbEnrichment,
    vaAccessToken,
    setVaImportStatus,
    vaLogout,
  } = ctx;

  const _handleClearVARecords = () =>
    _clearVARecordsAndReload({ loadVARecordsData });
  const handleVaDataImport = async () => {
    await _importVaData(vaAccessToken, {
      setVaImportStatus,
      loadVARecordsData,
      loadClaims,
      loadVkbEnrichment,
    });
  };
  const _handleVaDisconnect = () =>
    _disconnectVaSession({ vaLogout, setVaImportStatus });

  return { _handleClearVARecords, handleVaDataImport, _handleVaDisconnect };
}

function _buildPacketServiceHistoryHandlers(ctx) {
  const {
    loadServiceHistory,
    newDeployment,
    setNewDeployment,
    setShowDeploymentForm,
    newAward,
    setNewAward,
    setShowAwardForm,
    dd214Text,
    aiStatus,
    setIsProcessingDD214,
    setDD214Text,
    setShowDD214Processor,
  } = ctx;

  const handleAddDeployment = () =>
    _addDeploymentAndReset(newDeployment, {
      loadServiceHistory,
      setNewDeployment,
      setShowDeploymentForm,
    });
  const handleRemoveDeployment = (depId) =>
    _removeDeploymentAndReload(depId, { loadServiceHistory });
  const handleAddAward = () =>
    _addAwardAndReset(newAward, {
      loadServiceHistory,
      setNewAward,
      setShowAwardForm,
    });
  const handleRemoveAward = (awardId) =>
    _removeAwardAndReload(awardId, { loadServiceHistory });
  const handleProcessDD214 = async () => {
    await _processDD214Text(dd214Text, aiStatus, {
      setIsProcessingDD214,
      loadServiceHistory,
      setDD214Text,
      setShowDD214Processor,
    });
  };
  const handleClearDD214 = () => _clearDD214AndReload({ loadServiceHistory });

  return {
    handleAddDeployment,
    handleRemoveDeployment,
    handleAddAward,
    handleRemoveAward,
    handleProcessDD214,
    handleClearDD214,
  };
}

function _buildPacketDD214DropHandlers(ctx) {
  const { setIsDraggingDD214, onOpenDD214Analyzer, dd214FileInputRef } = ctx;

  const handleDD214DragOver = (e) => _dd214DragOver(e, { setIsDraggingDD214 });
  const handleDD214DragLeave = (e) =>
    _dd214DragLeave(e, { setIsDraggingDD214 });
  const handleDD214Drop = (e) =>
    _dd214DropFile(e, { setIsDraggingDD214, onOpenDD214Analyzer });
  const handleDD214FileSelect = (e) =>
    _dd214FileSelected(e, { onOpenDD214Analyzer, dd214FileInputRef });

  return {
    handleDD214DragOver,
    handleDD214DragLeave,
    handleDD214Drop,
    handleDD214FileSelect,
  };
}

function _buildPacketClaimsHandlers(ctx) {
  const { loadClaims } = ctx;
  const handleRemove = (claimId) =>
    _removeClaimAndReload(claimId, { loadClaims });
  const handleClearAll = () => _clearAllClaimsAndReload({ loadClaims });
  const handleStatusChange = (claimId, newStatus) =>
    _changeClaimStatus(claimId, newStatus, { loadClaims });
  return { handleRemove, handleClearAll, handleStatusChange };
}

function _buildPacketBackupRestoreHandlers(ctx) {
  const {
    setShowBackupGuide,
    claims,
    setImportStatus,
    setBackupCreated,
    setHasExternalBackup,
    fileInputRef,
    setShowImportConfirm,
    showImportConfirm,
    loadSavedForms,
    loadVeteranProfile,
    loadServiceHistory,
    loadMyRatings,
    loadTimelineEvents,
    loadPainMaps,
    loadClaims,
  } = ctx;

  const dismissBackupGuide = (remindLater = true) =>
    _dismissBackupGuide(remindLater, { setShowBackupGuide });
  const handleBackupPacket = () =>
    _createPacketBackup(claims, {
      setImportStatus,
      setBackupCreated,
      setHasExternalBackup,
      setShowBackupGuide,
    });
  const handleRestoreClick = () => _triggerRestoreClick({ fileInputRef });
  const handleFileSelect = (event) =>
    _handleBackupFileSelect(event, { setImportStatus, setShowImportConfirm });
  const handleConfirmImport = (mergeMode) => {
    _confirmDataImport(mergeMode, showImportConfirm.data, {
      loadSavedForms,
      loadVeteranProfile,
      loadServiceHistory,
      loadMyRatings,
      loadTimelineEvents,
      loadPainMaps,
      loadClaims,
      setImportStatus,
      setShowImportConfirm,
    });
  };

  return {
    dismissBackupGuide,
    handleBackupPacket,
    handleRestoreClick,
    handleFileSelect,
    handleConfirmImport,
  };
}

function _buildPacketStatementHandlers(ctx) {
  const {
    setViewingStatement,
    setViewingClaimId,
    setShowDownloadMenu,
    viewingClaimId,
    claims,
    onResume,
  } = ctx;

  const handleViewStatement = (claimId) =>
    _viewStatementForClaim(claimId, { setViewingStatement, setViewingClaimId });
  const handleDownloadStatement = (claim, format = "txt") =>
    _downloadStatementForClaim(claim, format, { setShowDownloadMenu });
  const handleEditStatement = () =>
    _editViewedStatement(viewingClaimId, claims, {
      onResume,
      setViewingStatement,
      setViewingClaimId,
    });

  return { handleViewStatement, handleDownloadStatement, handleEditStatement };
}

function _runPacketInitLoadEffect(setters) {
  const {
    setClaims,
    setStats,
    setSavedForms,
    setMyRatings,
    setServiceHistory,
    setTimelineEvents,
    setPainMaps,
    setVeteranProfile,
    setVaRecords,
    setAIStatus,
    setDocuments,
    setCfileConditions,
    setVkbTimeline,
    setVkbDisabilityRatings,
    setVkbEnrichmentLoading,
    setPacketSummary,
  } = setters;
  _loadClaimsData({ setClaims, setStats });
  _loadSavedForms({ setSavedForms });
  _loadMyRatings({ setMyRatings });
  _loadServiceHistory({ setServiceHistory });
  _loadTimelineEvents({ setTimelineEvents });
  _loadPainMaps({ setPainMaps });
  _loadVeteranProfile({ setVeteranProfile });
  _loadVARecordsData({ setVaRecords });
  _checkAIStatus({ setAIStatus });
  // Read-only VKB document flow (best-effort, never blocks the modal).
  _loadVkbDocuments({ setDocuments });
  _loadVkbEnrichment({
    setCfileConditions,
    setVkbTimeline,
    setVkbDisabilityRatings,
    setVkbEnrichmentLoading,
    setPacketSummary,
  });
}

// Auto-import VA records after fresh OAuth connection
function _runPacketVaAutoImportEffect(ctx) {
  const {
    isVaAuthenticated,
    vaAccessToken,
    vaImportStatus,
    handleVaDataImport,
  } = ctx;
  const justConnected = sessionStorage.getItem("va_auth_just_connected");
  if (
    justConnected &&
    isVaAuthenticated &&
    vaAccessToken &&
    !vaImportStatus.loading
  ) {
    sessionStorage.removeItem("va_auth_just_connected");
    // eslint-disable-next-line no-console
    console.log(
      "[MyPacket] Auto-importing VA records after fresh auth connection",
    );
    // Small delay to ensure UI is ready
    const timer = setTimeout(() => {
      handleVaDataImport();
    }, 500);
    return () => clearTimeout(timer);
  }
}

function _runPacketClickOutsideEffect(showDownloadMenu, setShowDownloadMenu) {
  const handleClickOutside = (event) => {
    if (showDownloadMenu && !event.target.closest(".relative")) {
      setShowDownloadMenu(null);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}

// Check if user needs backup guidance on mount / when claims change
function _runPacketBackupGuideEffect(
  claimsLength,
  setHasExternalBackup,
  setShowBackupGuide,
) {
  const hasBackedUp = localStorage.getItem("vetrate_external_backup_created");
  setHasExternalBackup(!!hasBackedUp);
  // Show guide if they have claims but haven't downloaded a backup
  const hasDismissedGuide = localStorage.getItem(
    "vetrate_backup_guide_dismissed",
  );
  if (claimsLength > 0 && !hasBackedUp && !hasDismissedGuide) {
    setShowBackupGuide(true);
  }
}

function MyPacketExtraModals({ state, handlers }) {
  const {
    viewingStatement,
    viewingClaimId,
    setViewingStatement,
    setViewingClaimId,
    certifiedClaimIds,
    setCertifiedClaimIds,
    showImportConfirm,
    setShowImportConfirm,
    claims,
    backupCreated,
    setBackupCreated,
    showVAGovPaster,
    setShowVAGovPaster,
    t,
  } = state;
  const { handleEditStatement, handleConfirmImport, handlePastedRatings } =
    handlers;

  return (
    <>
      {/* Statement Viewer Modal */}
      {viewingStatement && (
        <StatementViewerModal
          viewingStatement={viewingStatement}
          viewingClaimId={viewingClaimId}
          setViewingStatement={setViewingStatement}
          setViewingClaimId={setViewingClaimId}
          handleEditStatement={handleEditStatement}
          certifiedClaimIds={certifiedClaimIds}
          setCertifiedClaimIds={setCertifiedClaimIds}
          t={t}
        />
      )}

      {/* Import Confirmation Modal */}
      {showImportConfirm && (
        <ImportConfirmationModal
          showImportConfirm={showImportConfirm}
          setShowImportConfirm={setShowImportConfirm}
          handleConfirmImport={handleConfirmImport}
          t={t}
        />
      )}

      {/* Buy Me a Coffee triggers */}
      <PacketBuyMeCoffeeTriggers
        claims={claims}
        backupCreated={backupCreated}
        setBackupCreated={setBackupCreated}
      />

      {/* VA.gov Rating Paster Modal */}
      {showVAGovPaster && (
        <VaGovRatingPasterModal
          handlePastedRatings={handlePastedRatings}
          setShowVAGovPaster={setShowVAGovPaster}
        />
      )}
    </>
  );
}

function MyPacketBackupSection({ state, handlers }) {
  const {
    showBackupGuide,
    claims,
    onOpenGoogleDriveSync,
    onAnalyzeStrategy,
    fileInputRef,
    t,
  } = state;
  const {
    dismissBackupGuide,
    handleBackupPacket,
    handleRestoreClick,
    handleFileSelect,
  } = handlers;

  return (
    <>
      <MyPacketBackupGuideBanner
        showBackupGuide={showBackupGuide}
        claims={claims}
        handleBackupPacket={handleBackupPacket}
        onOpenGoogleDriveSync={onOpenGoogleDriveSync}
        dismissBackupGuide={dismissBackupGuide}
        t={t}
      />

      <MyPacketBackupRestoreControls
        handleBackupPacket={handleBackupPacket}
        claims={claims}
        handleRestoreClick={handleRestoreClick}
        onOpenGoogleDriveSync={onOpenGoogleDriveSync}
        onAnalyzeStrategy={onAnalyzeStrategy}
        fileInputRef={fileInputRef}
        handleFileSelect={handleFileSelect}
        t={t}
      />
    </>
  );
}

function MyPacketView({ state, handlers }) {
  const {
    onClose,
    onReportBug,
    packetContentRef,
    t,
    stats,
    claims,
    importStatus,
    activeTab,
    setActiveTab,
    myRatings,
    serviceHistory,
    timelineEvents,
    vkbTimeline,
    painMaps,
    veteranProfile,
    savedForms,
    vaRecords,
    documents,
    packetSummary,
    vkbEnrichmentLoading,
  } = state;

  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={onClose}
        size="2xl"
        labelledBy="my-packet-title"
        header={
          <MyPacketHeader
            onClose={onClose}
            onReportBug={onReportBug}
            packetContentRef={packetContentRef}
            t={t}
          />
        }
      >
        <div ref={packetContentRef}>
          <PacketTldrPanel
            summary={packetSummary}
            loading={vkbEnrichmentLoading}
          />

          <MyPacketStatsDashboard stats={stats} t={t} />

          <MyPacketBackupSection state={state} handlers={handlers} />

          <MyPacketImportStatusMessage importStatus={importStatus} />

          <MyPacketTabNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            claims={claims}
            myRatings={myRatings}
            serviceHistory={serviceHistory}
            timelineEvents={timelineEvents}
            vkbTimeline={vkbTimeline}
            painMaps={painMaps}
            veteranProfile={veteranProfile}
            savedForms={savedForms}
            vaRecords={vaRecords}
            documents={documents}
            t={t}
          />

          <MyPacketTabContent
            {...state}
            {...handlers}
            getStatusColor={getStatusColor}
          />
        </div>
      </ResponsiveModal>

      <MyPacketExtraModals state={state} handlers={handlers} />
    </>
  );
}

// All MyPacket lifecycle effects, extracted so the component stays legible.
// VADataCenter's embedded "Save Selected" button saves via saveVADataWithConsent
// directly, bypassing _importVaData — without this, Ratings/Service stay stale
// until the modal is closed and reopened. Same window-CustomEvent pattern as
// the existing openMyPacket signal.
function _runPacketVaDataSavedEffect(loaders) {
  const handler = () => {
    loaders.loadVARecordsData();
    loaders.loadClaims();
    loaders.loadVkbEnrichment();
  };
  window.addEventListener("vetrate:va-data-saved", handler);
  return () => window.removeEventListener("vetrate:va-data-saved", handler);
}

function _useInitLoadEffect({
  coreState,
  tabsState,
  serviceHistoryState,
  timelinePainState,
  vaState,
  setVeteranProfile,
}) {
  useEffect(
    () =>
      _runPacketInitLoadEffect({
        setClaims: coreState.setClaims,
        setStats: coreState.setStats,
        setSavedForms: tabsState.setSavedForms,
        setMyRatings: tabsState.setMyRatings,
        setServiceHistory: serviceHistoryState.setServiceHistory,
        setTimelineEvents: timelinePainState.setTimelineEvents,
        setPainMaps: timelinePainState.setPainMaps,
        setVeteranProfile,
        setVaRecords: vaState.setVaRecords,
        setAIStatus: serviceHistoryState.setAIStatus,
        setDocuments: coreState.setDocuments,
        setCfileConditions: coreState.setCfileConditions,
        setVkbTimeline: coreState.setVkbTimeline,
        setVkbDisabilityRatings: coreState.setVkbDisabilityRatings,
        setVkbEnrichmentLoading: coreState.setVkbEnrichmentLoading,
        setPacketSummary: coreState.setPacketSummary,
      }),
    [
      coreState.setClaims,
      coreState.setStats,
      tabsState.setSavedForms,
      tabsState.setMyRatings,
      serviceHistoryState.setServiceHistory,
      timelinePainState.setTimelineEvents,
      timelinePainState.setPainMaps,
      serviceHistoryState.setAIStatus,
      vaState.setVaRecords,
      coreState.setDocuments,
      coreState.setCfileConditions,
      coreState.setVkbTimeline,
      coreState.setVkbDisabilityRatings,
      coreState.setVkbEnrichmentLoading,
      coreState.setPacketSummary,
      setVeteranProfile,
    ],
  );
}

function _useMyPacketEffects({
  coreState,
  tabsState,
  serviceHistoryState,
  timelinePainState,
  vaState,
  setVeteranProfile,
  handleVaDataImport,
  loaders,
}) {
  _useInitLoadEffect({
    coreState,
    tabsState,
    serviceHistoryState,
    timelinePainState,
    vaState,
    setVeteranProfile,
  });

  useEffect(
    () =>
      _runPacketVaAutoImportEffect({
        isVaAuthenticated: vaState.isVaAuthenticated,
        vaAccessToken: vaState.vaAccessToken,
        vaImportStatus: vaState.vaImportStatus,
        handleVaDataImport,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vaState.isVaAuthenticated, vaState.vaAccessToken],
  );

  useEffect(
    () =>
      _runPacketClickOutsideEffect(
        coreState.showDownloadMenu,
        coreState.setShowDownloadMenu,
      ),
    [coreState.showDownloadMenu, coreState.setShowDownloadMenu],
  );

  useEffect(
    () =>
      _runPacketBackupGuideEffect(
        coreState.claims.length,
        coreState.setHasExternalBackup,
        coreState.setShowBackupGuide,
      ),
    [
      coreState.claims.length,
      coreState.setHasExternalBackup,
      coreState.setShowBackupGuide,
    ],
  );

  useEffect(
    () => _runPacketVaDataSavedEffect(loaders),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}

const MyPacket = ({
  onResume,
  onClose,
  onReportBug,
  onAnalyzeStrategy,
  onOpenGoogleDriveSync,
  onOpenAISettings,
  onOpenDD214Analyzer,
}) => {
  const { t } = useLanguage();
  const coreState = useMyPacketCoreState();
  const tabsState = useMyPacketTabsState();
  const [veteranProfile, setVeteranProfile] = useState({});
  const serviceHistoryState = useMyPacketServiceHistoryState();
  const timelinePainState = useMyPacketTimelinePainState();
  const vaState = useMyPacketVaState();

  const state = {
    t,
    onResume,
    onClose,
    onReportBug,
    onAnalyzeStrategy,
    onOpenGoogleDriveSync,
    onOpenAISettings,
    onOpenDD214Analyzer,
    ...coreState,
    veteranProfile,
    setVeteranProfile,
    ...tabsState,
    ...timelinePainState,
    ...serviceHistoryState,
    ...vaState,
  };

  const loaders = _buildPacketLoaders(state);
  const ctx = { ...state, ...loaders };
  const handlers = {
    ...loaders,
    ..._buildPacketPainTimelineHandlers(ctx),
    ..._buildPacketFormsRatingsHandlers(ctx),
    ..._buildPacketVaHandlers(ctx),
    ..._buildPacketServiceHistoryHandlers(ctx),
    ..._buildPacketDD214DropHandlers(ctx),
    ..._buildPacketClaimsHandlers(ctx),
    ..._buildPacketBackupRestoreHandlers(ctx),
    ..._buildPacketStatementHandlers(ctx),
  };

  _useMyPacketEffects({
    coreState,
    tabsState,
    serviceHistoryState,
    timelinePainState,
    vaState,
    setVeteranProfile,
    handleVaDataImport: handlers.handleVaDataImport,
    loaders,
  });

  return <MyPacketView state={state} handlers={handlers} />;
};

export default MyPacket;
