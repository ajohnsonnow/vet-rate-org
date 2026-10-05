/**
 * EvidenceTimeline - Visual Continuity Tracker
 * "The Continuity Thread" - Shows the nexus timeline and identifies dangerous evidence gaps
 *
 * The Problem: Text is bad at showing time. Veterans don't see gaps until it's too late.
 * The Solution: Visual timeline with automatic gap analysis and risk warnings
 */

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { getTimelineEvents, saveTimelineEvents } from "../utils/veteranProfile";
import { loadVKB } from "../utils/veteranKnowledgeBase";
import {
  timelineEventKey,
  buildImportedTimelineEvent,
  datedVkbEvents,
  dropStaleCFileCopies,
  freshVkbEvents,
  recordRemovedTimelineEvent,
} from "../utils/timelineStoreSync";
import ReportBugLink from "./ReportBugLink";
import ResponsiveModal from "./common/ResponsiveModal";
import HeaderCloseSlot from "./common/HeaderCloseSlot";
import { formatLocalDate } from "../utils/dateUtils";

// Event categories with their visual styles
const EVENT_TYPES = {
  service: {
    label: "Service Event",
    color: "#22c55e",
    icon: "⭐",
    description: "Active duty dates, deployments, injuries in service",
  },
  injury: {
    label: "Injury/Incident",
    color: "#ef4444",
    icon: "💥",
    description: "When the injury or condition first occurred",
  },
  diagnosis: {
    label: "Diagnosis",
    color: "#3b82f6",
    icon: "💊",
    description: "Official medical diagnosis dates",
  },
  treatment: {
    label: "Medical Treatment",
    color: "#8b5cf6",
    icon: "🏥",
    description: "Doctor visits, procedures, prescriptions",
  },
  buddy: {
    label: "Buddy Statement",
    color: "#f59e0b",
    icon: "👥",
    description: "Witness statements or lay evidence",
  },
  records: {
    label: "Medical Records",
    color: "#06b6d4",
    icon: "📋",
    description: "Existing medical documentation",
  },
};

function detectTimelineGaps(timelineEvents) {
  // D-C (final10 QA, 2026-09-25): a National Guard/Reserve enlistment date
  // is not the start of active duty - years between drill weekends with
  // nothing to show is normal for that component, not missing evidence.
  // Excluded from gap-pairing only (still shown on the timeline itself,
  // which renders the full, unfiltered `timelineEvents`).
  const gapAnchors = timelineEvents.filter(
    (e) => e.eventType !== "guard_enlistment",
  );
  if (gapAnchors.length < 2) {
    return [];
  }

  // Sort events by date
  const sorted = [...gapAnchors].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );

  const detectedGaps = [];
  const GAP_THRESHOLD_YEARS = 5;

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentDate = new Date(sorted[i].date);
    const nextDate = new Date(sorted[i + 1].date);

    const yearsDiff = (nextDate - currentDate) / (1000 * 60 * 60 * 24 * 365);

    if (yearsDiff >= GAP_THRESHOLD_YEARS) {
      detectedGaps.push({
        start: sorted[i],
        end: sorted[i + 1],
        years: Math.floor(yearsDiff),
        severity: yearsDiff >= 10 ? "CRITICAL" : "WARNING",
      });
    }
  }

  return detectedGaps;
}

function drawTimelineBaseLine(ctx, { padding, lineY, width }) {
  // Draw base line
  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(padding, lineY);
  ctx.lineTo(width - padding, lineY);
  ctx.stroke();
}

function drawTimelineGapWarnings(
  ctx,
  gaps,
  { firstDate, lastDate, lineY, padding, lineWidth },
) {
  // Draw gap warnings
  gaps.forEach((gap) => {
    const gapStartDate = new Date(gap.start.date);
    const gapEndDate = new Date(gap.end.date);

    const startX =
      padding +
      ((gapStartDate - firstDate) / (lastDate - firstDate)) * lineWidth;
    const endX =
      padding + ((gapEndDate - firstDate) / (lastDate - firstDate)) * lineWidth;

    // Draw red warning section
    ctx.strokeStyle = gap.severity === "CRITICAL" ? "#dc2626" : "#f59e0b";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(startX, lineY);
    ctx.lineTo(endX, lineY);
    ctx.stroke();

    // Draw warning label
    ctx.fillStyle = gap.severity === "CRITICAL" ? "#dc2626" : "#f59e0b";
    ctx.font = "12px monospace";
    ctx.fillText(
      `⚠️ ${gap.years} YEAR GAP`,
      (startX + endX) / 2 - 40,
      lineY - 20,
    );
  });
}

function eventX(eventDate, { firstDate, lastDate, padding, lineWidth }) {
  return (
    padding + ((eventDate - firstDate) / (lastDate - firstDate)) * lineWidth
  );
}

// Year labels alternate between an "above" row (even index) and a "below"
// row (odd index). Events sorted date-ascending give a non-decreasing x per
// row, so several events landing within MIN_YEAR_LABEL_GAP_PX of each other
// on the same row would otherwise paint their year text on top of each
// other (e.g. "2020" over "2020" garbling into unreadable digits). Exported
// for unit testing.
const MIN_YEAR_LABEL_GAP_PX = 36;

export function selectYearLabelIndices(sortedEvents, geometry) {
  const lastX = { above: -Infinity, below: -Infinity };
  return sortedEvents.map((event, index) => {
    const row = index % 2 === 0 ? "above" : "below";
    const x = eventX(new Date(event.date), geometry);
    const gap = x - lastX[row];
    // An invalid event.date produces a NaN gap; Number.isNaN guards it
    // explicitly since every direct comparison against NaN is false,
    // including `< MIN_YEAR_LABEL_GAP_PX` (which would otherwise fall
    // through to the "show it" branch below instead of skipping it).
    if (Number.isNaN(gap) || gap < MIN_YEAR_LABEL_GAP_PX) return false;
    lastX[row] = x;
    return true;
  });
}

function drawTimelineEventMarkers(
  ctx,
  sortedEvents,
  { firstDate, lastDate, lineY, padding, lineWidth },
) {
  const geometry = { firstDate, lastDate, padding, lineWidth };
  const showYearLabel = selectYearLabelIndices(sortedEvents, geometry);

  // Draw events
  sortedEvents.forEach((event, index) => {
    const eventDate = new Date(event.date);
    const x = eventX(eventDate, geometry);

    // Draw event marker
    const eventColor = EVENT_TYPES[event.type]?.color || "#6b7280";
    ctx.fillStyle = eventColor;
    ctx.beginPath();
    ctx.arc(x, lineY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw event border
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw connecting line to label
    const labelY = index % 2 === 0 ? lineY - 60 : lineY + 60;
    ctx.strokeStyle = eventColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(x, lineY + 8);
    ctx.lineTo(x, labelY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw year label (skipped when it would collide with the previous
    // label on the same row - see selectYearLabelIndices)
    if (!showYearLabel[index]) return;
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      eventDate.getFullYear(),
      x,
      labelY + (index % 2 === 0 ? -5 : 15),
    );
  });
}

function drawTimelineStartEndLabels(ctx, { padding, lineY, width }) {
  // Draw start and end labels
  ctx.fillStyle = "#22c55e";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("START", padding - 40, lineY - 20);

  ctx.fillStyle = "#ef4444";
  ctx.textAlign = "right";
  ctx.fillText("NOW", width - padding + 35, lineY - 20);
}

function renderEvidenceTimelineCanvas(
  ctx,
  width,
  height,
  timelineEvents,
  gaps,
) {
  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Sort events by date
  const sorted = [...timelineEvents].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );

  const firstDate = new Date(sorted[0].date);
  const lastDate = new Date(sorted.at(-1).date);

  // Draw main timeline line
  const lineY = height / 2;
  const padding = 50;
  const lineWidth = width - padding * 2;
  const geometry = { firstDate, lastDate, lineY, padding, lineWidth, width };

  drawTimelineBaseLine(ctx, geometry);
  drawTimelineGapWarnings(ctx, gaps, geometry);
  drawTimelineEventMarkers(ctx, sorted, geometry);
  drawTimelineStartEndLabels(ctx, geometry);
}

// Drops duplicate date+description entries, keeping the first occurrence -
// used both to re-dedupe the merged list against whatever the timeline's
// real current state turns out to be (see the functional setTimelineEvents
// call below) and, indirectly, within a single incoming batch.
function dedupeTimelineEvents(events) {
  const seen = new Set();
  return events.filter((e) => {
    const key = timelineEventKey(e);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function _isServiceEntryEventType(eventType) {
  return eventType === "guard_enlistment" || eventType === "service_entry";
}

// ADR-007 R10: a local copy imported from a PROJECTED VKB service-entry
// event goes stale the moment a correction changes that same projection's
// date/description - re-importing must replace it, not leave a second,
// outdated entry sitting alongside the fresh one. A legacy copy (no
// sourceKey, from before this tracking existed) is stale once no current
// VKB service-entry event still matches its own (date, description).
// Veteran-added events (numeric id, never a "vkb_" import) are never
// touched - EvidenceTimeline has no edit path for them, only add/remove.
function _isStaleImportedServiceEntryEvent(local, projectedEvents, knownKeys) {
  if (!_isServiceEntryEventType(local.eventType)) return false;
  if (typeof local.id !== "string" || !local.id.startsWith("vkb_")) {
    return false;
  }
  if (local.sourceKey) {
    const match = projectedEvents.find(
      (p) => p.projectionKey === local.sourceKey,
    );
    if (!match) return true;
    return match.date !== local.date || match.description !== local.description;
  }
  return !knownKeys.has(timelineEventKey(local));
}

// Also tracks WHICH specific projectionKeys the removed copies were stale
// against, so the caller can rebuild only those exact copies - never every
// event currently in the projection. Without this, a copy the veteran
// deliberately removed (performRemoveEvent) or a period that was never
// imported at all comes back silently the next time any OTHER copy goes
// stale, since both are equally "missing from kept". A stale LEGACY copy
// (no sourceKey) only maps to a replacement when exactly one current
// projected event shares its eventType - with two+ candidates there's no
// way to prove which one it was, so (same "never guess a link" rule as
// everywhere else) it's just dropped, not guessed.
function _dropStaleServiceEntryEvents(events, projectedEvents, knownKeys) {
  const staleProjectionKeys = new Set();
  const legacyStaleTypes = new Set();
  const kept = events.filter((local) => {
    const stale = _isStaleImportedServiceEntryEvent(
      local,
      projectedEvents,
      knownKeys,
    );
    if (stale) {
      if (local.sourceKey) staleProjectionKeys.add(local.sourceKey);
      else legacyStaleTypes.add(local.eventType);
    }
    return !stale;
  });
  legacyStaleTypes.forEach((eventType) => {
    const candidates = projectedEvents.filter((p) => p.eventType === eventType);
    if (candidates.length === 1) {
      staleProjectionKeys.add(candidates[0].projectionKey);
    }
  });
  return { kept, removed: events.length - kept.length, staleProjectionKeys };
}

function _importConfirmMessage(addedCount, updatedCount) {
  if (updatedCount === 0) {
    return `Add ${addedCount} event(s) from your analyzed records to the timeline?`;
  }
  return `Update ${updatedCount} event(s) and add ${addedCount} new event(s) from your analyzed records to the timeline?`;
}

// Shared by performImportFromRecords and syncProjectedServiceEntryEvents:
// loads the VKB's dated evidenceTimeline/evidence items, plus the
// ADR-007-projected service-entry/enlistment subset of them and every
// (date, description) key currently claimed by a service-entry event.
async function _loadServiceEntryProjection() {
  const vkb = await loadVKB();
  const loaded = Boolean(vkb);
  const vkbEvents = datedVkbEvents(vkb);
  const projectedEvents = vkbEvents.filter(
    (e) => e.projected && _isServiceEntryEventType(e.eventType),
  );
  const knownServiceEntryKeys = new Set(
    vkbEvents
      .filter((e) => _isServiceEntryEventType(e.eventType))
      .map((e) =>
        timelineEventKey({
          date: e.date,
          description: e.description || e.text,
        }),
      ),
  );
  return { loaded, vkbEvents, projectedEvents, knownServiceEntryKeys };
}

// Pull dated events the C-File analyzer filed into the VKB
// (evidenceTimeline entries + dated evidence items) into this timeline.
// `auto` (first-open auto-import) skips the confirm/alert dialogs a manual
// button click still shows, and reports back how many events were added so
// the caller can show its own inline notice instead.
async function performImportFromRecords({
  timelineEvents,
  setTimelineEvents,
  onEventsUpdate,
  auto = false,
}) {
  try {
    const { loaded, vkbEvents, projectedEvents, knownServiceEntryKeys } =
      await _loadServiceEntryProjection();
    const { kept: serviceKept, removed: serviceRemoved } =
      projectedEvents.length > 0
        ? _dropStaleServiceEntryEvents(
            timelineEvents,
            projectedEvents,
            knownServiceEntryKeys,
          )
        : { kept: timelineEvents, removed: 0 };
    const workingEvents = loaded
      ? dropStaleCFileCopies(vkbEvents, serviceKept)
      : serviceKept;
    const staleRemoved =
      serviceRemoved + (serviceKept.length - workingEvents.length);

    // Dedupe against the (stale-filtered) existing timeline events AND, as
    // items are accepted, against each other - migrateOffSchemaVKB copies
    // legacy evidence[] entries into evidenceTimeline[], so the same item
    // can otherwise show up in both vkbEvents halves and get added twice.
    const fresh = freshVkbEvents(vkbEvents, workingEvents).map(([e, i]) =>
      buildImportedTimelineEvent(e, i),
    );

    if (fresh.length === 0 && staleRemoved === 0) {
      if (!auto) alert("No new dated events found in your records.");
      return [];
    }
    const updatedCount = Math.min(staleRemoved, fresh.length);
    const addedCount = fresh.length - updatedCount;
    if (
      !auto &&
      !window.confirm(_importConfirmMessage(addedCount, updatedCount))
    ) {
      return [];
    }
    const updated = dedupeTimelineEvents([...workingEvents, ...fresh]);
    setTimelineEvents(updated);
    saveTimelineEvents(updated);
    if (onEventsUpdate) {
      onEventsUpdate(updated);
    }
    return fresh;
  } catch (e) {
    console.error("Failed to import events from records:", e);
    if (!auto) alert("Could not read your records. Please try again.");
    return [];
  }
}

// D13-2: keeps already-imported service-entry/enlistment timeline events
// synced to the VKB's ADR-007 projection every time this component mounts
// - not just on the very first, store-empty open - so a correction made
// through any editor (VKB viewer, My Packet, FormsHelper, Muster Call
// review) is reflected here too without the veteran clicking "Import from
// My Records" again. Silent (no confirm/alert, no notice): this only ever
// REPLACES a copy that was itself found stale (sourceKey still present in
// the projection, but date/description changed) or a legacy copy that no
// longer matches any current service-entry event - it never resurrects a
// projected event the veteran deliberately removed, or adds one that was
// never imported at all, just because some OTHER copy went stale. A
// veteran-added event (numeric id, no sourceKey match attempted) is never
// touched - same guarantee as the manual re-import path.
//
// Reads the CURRENT store (not a mount-time snapshot) only after the
// await below resolves, and writes it back with no further await in
// between - performAddEvent/performRemoveEvent persist synchronously, so
// this can never observe, then clobber, a hand-add/remove that happened
// while the projection was loading.
async function syncProjectedServiceEntryEvents({
  setTimelineEvents,
  onEventsUpdate,
}) {
  try {
    const { projectedEvents, knownServiceEntryKeys } =
      await _loadServiceEntryProjection();
    if (projectedEvents.length === 0) return;

    const currentEvents = getTimelineEvents();
    const { kept, removed, staleProjectionKeys } = _dropStaleServiceEntryEvents(
      currentEvents,
      projectedEvents,
      knownServiceEntryKeys,
    );
    if (removed === 0) return;

    const existing = new Set(kept.map(timelineEventKey));
    const replacements = [];
    projectedEvents.forEach((p, i) => {
      if (!staleProjectionKeys.has(p.projectionKey)) return;
      const key = timelineEventKey({
        date: p.date,
        description: p.description || p.text,
      });
      if (existing.has(key)) return;
      existing.add(key);
      replacements.push(buildImportedTimelineEvent(p, i));
    });

    const updated = dedupeTimelineEvents([...kept, ...replacements]);
    setTimelineEvents(updated);
    saveTimelineEvents(updated);
    if (onEventsUpdate) onEventsUpdate(updated);
  } catch (e) {
    console.error("Failed to sync service-entry timeline events:", e);
  }
}

function performAddEvent({
  newEvent,
  timelineEvents,
  setTimelineEvents,
  setNewEvent,
  setIsAddingEvent,
  onEventsUpdate,
}) {
  if (!newEvent.date || !newEvent.description) {
    alert("Please fill in date and description");
    return;
  }

  const event = {
    ...newEvent,
    id: Date.now(),
    title: newEvent.description.substring(0, 50), // For My Packet display
    category: EVENT_TYPES[newEvent.type]?.label || "Event",
  };

  const updated = [...timelineEvents, event];
  setTimelineEvents(updated);

  // Persist to localStorage
  saveTimelineEvents(updated);

  if (onEventsUpdate) {
    onEventsUpdate(updated);
  }

  // Reset form
  setNewEvent({
    type: "service",
    date: "",
    description: "",
    category: "Service Event",
  });
  setIsAddingEvent(false);
}

function performRemoveEvent({
  id,
  timelineEvents,
  setTimelineEvents,
  onEventsUpdate,
}) {
  const removed = timelineEvents.find((e) => e.id === id);
  if (removed) recordRemovedTimelineEvent(removed);
  const updated = timelineEvents.filter((e) => e.id !== id);
  setTimelineEvents(updated);

  // Persist to localStorage
  saveTimelineEvents(updated);

  if (onEventsUpdate) {
    onEventsUpdate(updated);
  }
}

function TimelineModalHeader({ onClose, onReportBug }) {
  return (
    <div className="bg-gradient-to-r from-slate-600 to-gray-700 p-4 shadow-lg">
      <HeaderCloseSlot
        close={
          onClose && (
            <button
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center text-white hover:bg-white/20 rounded-lg transition-colors"
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
          )
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-3xl">🧵</span>
          <div className="min-w-0">
            <h2
              id="evidence-timeline-title"
              className="text-xl font-bold text-white"
            >
              🧵 The Continuity Thread - Evidence Timeline{" "}
              <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
                BETA
              </span>
            </h2>
            <p className="text-sm text-slate-100">
              Visual nexus timeline with gap detection
            </p>
          </div>
        </div>
        {onReportBug && (
          <ReportBugLink
            onClick={onReportBug}
            variant="light"
            moduleName="The Continuity Thread"
          />
        )}
      </HeaderCloseSlot>
    </div>
  );
}

function GapWarningsList({ gaps }) {
  if (gaps.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3">
      <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
        ⚠️ Evidence Gaps Detected: {gaps.length}
      </h3>
      {gaps.map((gap) => (
        <div
          key={`${gap.start.date}-${gap.end.date}`}
          className={`border-l-4 p-4 rounded ${
            gap.severity === "CRITICAL"
              ? "border-red-500 bg-red-900/20"
              : "border-yellow-500 bg-yellow-900/20"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h4
              className={`font-bold ${
                gap.severity === "CRITICAL" ? "text-red-400" : "text-yellow-400"
              }`}
            >
              {gap.years}-Year Evidence Gap
            </h4>
            <span
              className={`px-2 py-1 text-xs font-bold rounded ${
                gap.severity === "CRITICAL"
                  ? "bg-red-500 text-white"
                  : "bg-yellow-500 text-gray-900"
              }`}
            >
              {gap.severity}
            </span>
          </div>
          <p className="text-white text-sm mb-2">
            Gap between{" "}
            <span className="font-semibold">
              {new Date(gap.start.date).getFullYear()}
            </span>{" "}
            and{" "}
            <span className="font-semibold">
              {new Date(gap.end.date).getFullYear()}
            </span>
          </p>
          <p className="text-gray-300 text-xs mb-2">
            <span className="font-semibold">From:</span> {gap.start.description}
          </p>
          <p className="text-gray-300 text-xs mb-3">
            <span className="font-semibold">To:</span> {gap.end.description}
          </p>
          <div className="bg-gray-800 p-2 rounded text-xs text-gray-300">
            <span className="font-semibold text-yellow-400">
              Recommendation:
            </span>{" "}
            Fill this gap with buddy statements, medical records, or lay
            evidence showing continuity of condition.
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineEventList({ events, onRemove }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h3 className="text-xl font-bold text-blue-400 mb-3">
        📋 Timeline Events ({events.length})
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {[...events]
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .map((event) => (
            <div
              key={event.id}
              className="bg-gray-800 p-3 rounded border border-gray-700 flex items-start gap-3"
            >
              <div
                className="text-2xl flex-shrink-0"
                aria-label={EVENT_TYPES[event.type]?.label}
              >
                {EVENT_TYPES[event.type]?.icon || "📌"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="px-2 py-0.5 text-xs font-semibold rounded"
                    style={{
                      backgroundColor:
                        EVENT_TYPES[event.type]?.color || "#6b7280",
                      color: "#fff",
                    }}
                  >
                    {event.category}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {formatLocalDate(event.date).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-white text-sm">{event.description}</p>
              </div>
              <button
                onClick={() => onRemove(event.id)}
                className="text-red-400 hover:text-red-300 text-sm flex-shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

function EventTypeSelector({ newEvent, setNewEvent }) {
  return (
    <div className="mb-4">
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="block text-gray-300 text-sm font-semibold mb-2">
        Event Type:
      </label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {Object.entries(EVENT_TYPES).map(([key, info]) => (
          <button
            key={key}
            onClick={() =>
              setNewEvent({
                ...newEvent,
                type: key,
                category: info.label,
              })
            }
            className={`p-2 rounded border-2 transition text-left ${
              newEvent.type === key
                ? "border-blue-500 bg-blue-900/30"
                : "border-gray-700 bg-gray-700 hover:border-gray-600"
            }`}
            aria-label={info.description}
          >
            <div className="text-lg mb-1">{info.icon}</div>
            <div className="text-xs text-white font-semibold">{info.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AddEventForm({ newEvent, setNewEvent, setIsAddingEvent, onAdd }) {
  return (
    <div className="bg-gray-800 border border-blue-500/50 rounded-lg p-4">
      <h4 className="text-blue-400 font-bold mb-4">Add New Event</h4>

      <EventTypeSelector newEvent={newEvent} setNewEvent={setNewEvent} />

      {/* Date Input */}
      <div className="mb-4">
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="block text-gray-300 text-sm font-semibold mb-2">
          Date:
        </label>
        <input
          type="date"
          value={newEvent.date}
          onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
          className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Description Input */}
      <div className="mb-4">
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="block text-gray-300 text-sm font-semibold mb-2">
          Description:
        </label>
        <textarea
          value={newEvent.description}
          onChange={(e) =>
            setNewEvent({ ...newEvent, description: e.target.value })
          }
          placeholder="e.g., 'Deployed to Iraq - Combat Engineer', 'IED blast - TBI diagnosis', 'Started physical therapy for lower back'"
          className="w-full h-20 bg-gray-700 border border-gray-600 rounded p-2 text-white resize-none focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onAdd}
          className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded transition"
        >
          Add Event
        </button>
        <button
          onClick={() => setIsAddingEvent(false)}
          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddEventSection({
  isAddingEvent,
  newEvent,
  setNewEvent,
  setIsAddingEvent,
  onAdd,
  onImport,
}) {
  if (!isAddingEvent) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => setIsAddingEvent(true)}
          className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded transition"
        >
          ➕ Add Timeline Event
        </button>
        <button
          onClick={onImport}
          className="flex-1 py-3 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded transition"
        >
          📂 Import from My Records
        </button>
      </div>
    );
  }

  return (
    <AddEventForm
      newEvent={newEvent}
      setNewEvent={setNewEvent}
      setIsAddingEvent={setIsAddingEvent}
      onAdd={onAdd}
    />
  );
}

function TimelineHelpSection() {
  return (
    <div className="mt-6 bg-green-900/20 border border-green-500/30 rounded p-4">
      <h4 className="text-green-400 font-bold mb-2">💡 How to Use:</h4>
      <ul className="text-gray-300 text-sm space-y-1">
        <li>• Add key dates from your service and medical history</li>
        <li>
          • The timeline will automatically detect gaps longer than 5 years
        </li>
        <li>
          • <span className="text-red-400 font-semibold">Red sections</span> =
          Critical gaps (10+ years) - High denial risk
        </li>
        <li>
          •{" "}
          <span className="text-yellow-400 font-semibold">Yellow sections</span>{" "}
          = Moderate gaps (5-10 years) - Needs explanation
        </li>
        <li>
          • Fill gaps with buddy statements, medical visits, or lay evidence
        </li>
      </ul>
    </div>
  );
}

function ExportTimelineButton({ events }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <button
      onClick={() => {
        const text = events
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .map(
            (e) =>
              `${formatLocalDate(e.date).toLocaleDateString()} - ${e.category}: ${e.description}`,
          )
          .join("\n");

        navigator.clipboard.writeText(text);
        alert("Timeline copied to clipboard!");
      }}
      className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded transition"
    >
      📋 Copy Timeline to Clipboard
    </button>
  );
}

function AutoImportedNotice({ count }) {
  if (!count) return null;

  return (
    <div className="mb-6 bg-cyan-900/20 border border-cyan-500/30 rounded p-3">
      <p className="text-cyan-200 text-sm">
        📂 We filled in {count} event{count === 1 ? "" : "s"} from your saved
        records — review below and remove anything that&apos;s wrong.
      </p>
    </div>
  );
}

// First open with no events at all (nothing persisted, nothing passed in):
// silently try the same "Import from My Records" the button runs, so the
// veteran isn't staring at a blank timeline the app could have filled in.
// The existing date+description dedupe means a later reopen (events.length
// > 0 by then) never re-runs this or duplicates entries. On every OTHER
// mount (events already persisted), instead run the D13-2 service-entry
// sync so a correction made elsewhere since the last open (or since this
// timeline's very first auto-import) is never left showing a stale
// calculated date. Split out of EvidenceTimeline purely to keep its
// function body under the line-count limit. Same logic, same order of
// operations.
function useEvidenceTimelineAutoImport({
  timelineEvents,
  setTimelineEvents,
  onEventsUpdate,
}) {
  const [autoImportedCount, setAutoImportedCount] = useState(0);
  const autoImportedRef = useRef(false);

  useEffect(() => {
    if (autoImportedRef.current) return;
    autoImportedRef.current = true;
    if (timelineEvents.length === 0) {
      performImportFromRecords({
        timelineEvents: [],
        setTimelineEvents,
        onEventsUpdate,
        auto: true,
      }).then((fresh) => {
        if (fresh.length > 0) setAutoImportedCount(fresh.length);
      });
    } else {
      syncProjectedServiceEntryEvents({
        setTimelineEvents,
        onEventsUpdate,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return autoImportedCount;
}

// The canvas' CSS height (its `width` is fluid - see setupHiDpiCanvas).
// Falls back to the pre-HiDPI 800px width only when real layout isn't
// available (jsdom in unit tests never computes clientWidth/getBoundingClientRect,
// both read 0 there), so tests exercising the render path keep working.
const CANVAS_CSS_HEIGHT = 200;
const FALLBACK_CANVAS_CSS_WIDTH = 800;

// Sizes the canvas' backing pixel buffer to its real CSS width *
// devicePixelRatio (instead of a fixed 800 always squeezed down to fit),
// then scales the drawing context so every coordinate `renderEvidenceTimelineCanvas`
// uses is a real CSS pixel - a "12px" ctx.font comes out 12 CSS px tall on
// screen instead of ~0.4x that once a narrow phone's `w-full` shrinks an
// 800px-wide canvas down to fit (QA S46: year labels ~5px tall at 390px).
function setupHiDpiCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth =
    canvas.clientWidth ||
    canvas.getBoundingClientRect().width ||
    FALLBACK_CANVAS_CSS_WIDTH;

  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(CANVAS_CSS_HEIGHT * dpr));
  canvas.style.height = `${CANVAS_CSS_HEIGHT}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, cssWidth, cssHeight: CANVAS_CSS_HEIGHT };
}

// Owns the gap-detection state and canvas redraw for the timeline. Split
// out of EvidenceTimeline purely to keep its function body under the
// line-count limit. Same logic, same order of operations.
function useEvidenceTimelineGaps({ timelineEvents, canvasRef }) {
  const [gaps, setGaps] = useState([]);

  const drawTimeline = (currentGaps) => {
    const canvas = canvasRef.current;
    if (!canvas || timelineEvents.length === 0) return;
    const { ctx, cssWidth, cssHeight } = setupHiDpiCanvas(canvas);
    renderEvidenceTimelineCanvas(
      ctx,
      cssWidth,
      cssHeight,
      timelineEvents,
      currentGaps,
    );
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || timelineEvents.length === 0) return undefined;

    const currentGaps = detectTimelineGaps(timelineEvents);
    setGaps(currentGaps);
    drawTimeline(currentGaps);

    // Redraws at the new CSS width on container resize (viewport rotation,
    // window resize) so the HiDPI buffer never goes stale/blurry.
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => drawTimeline(currentGaps));
    observer.observe(canvas);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineEvents]);

  return gaps;
}

function TimelineModalBody({
  onClose,
  onReportBug,
  timelineEvents,
  canvasRef,
  gaps,
  isAddingEvent,
  newEvent,
  setNewEvent,
  setIsAddingEvent,
  onAddEvent,
  onRemoveEvent,
  onImportFromRecords,
  autoImportedCount,
}) {
  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="2xl"
      labelledBy="evidence-timeline-title"
      className="bg-gray-900 border border-blue-500/30"
      header={
        <TimelineModalHeader onClose={onClose} onReportBug={onReportBug} />
      }
    >
      {/* Intro */}
      <div className="mb-6">
        <p className="text-gray-300 text-sm">
          Visualize your nexus. Spot evidence gaps that could sink your claim.
        </p>
      </div>

      <AutoImportedNotice count={autoImportedCount} />

      {/* Canvas Timeline */}
      {timelineEvents.length > 0 && (
        <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <canvas
            ref={canvasRef}
            width={800}
            height={200}
            className="w-full"
            style={{ maxWidth: "100%" }}
          />
        </div>
      )}

      <GapWarningsList gaps={gaps} />

      <TimelineEventList events={timelineEvents} onRemove={onRemoveEvent} />

      <AddEventSection
        isAddingEvent={isAddingEvent}
        newEvent={newEvent}
        setNewEvent={setNewEvent}
        setIsAddingEvent={setIsAddingEvent}
        onAdd={onAddEvent}
        onImport={onImportFromRecords}
      />

      <TimelineHelpSection />

      <ExportTimelineButton events={timelineEvents} />
    </ResponsiveModal>
  );
}

const EvidenceTimeline = ({
  events = [],
  onEventsUpdate,
  onClose,
  onReportBug,
}) => {
  useLanguage();
  // Load persisted events on mount, fallback to props
  const [timelineEvents, setTimelineEvents] = useState(() => {
    const persisted = getTimelineEvents();
    return persisted.length > 0 ? persisted : events;
  });
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    type: "service",
    date: "",
    description: "",
    category: "Service Event",
  });
  const canvasRef = useRef(null);
  const gaps = useEvidenceTimelineGaps({ timelineEvents, canvasRef });
  const autoImportedCount = useEvidenceTimelineAutoImport({
    timelineEvents,
    setTimelineEvents,
    onEventsUpdate,
  });

  const importFromRecords = () =>
    performImportFromRecords({
      timelineEvents,
      setTimelineEvents,
      onEventsUpdate,
    });

  const addEvent = () =>
    performAddEvent({
      newEvent,
      timelineEvents,
      setTimelineEvents,
      setNewEvent,
      setIsAddingEvent,
      onEventsUpdate,
    });

  const removeEvent = (id) =>
    performRemoveEvent({
      id,
      timelineEvents,
      setTimelineEvents,
      onEventsUpdate,
    });

  return (
    <TimelineModalBody
      onClose={onClose}
      onReportBug={onReportBug}
      timelineEvents={timelineEvents}
      canvasRef={canvasRef}
      gaps={gaps}
      isAddingEvent={isAddingEvent}
      newEvent={newEvent}
      setNewEvent={setNewEvent}
      setIsAddingEvent={setIsAddingEvent}
      onAddEvent={addEvent}
      onRemoveEvent={removeEvent}
      onImportFromRecords={importFromRecords}
      autoImportedCount={autoImportedCount}
    />
  );
};

export default EvidenceTimeline;
