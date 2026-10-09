/**
 * Vet-Rate.org - Timeline store convergence
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The Evidence Timeline keeps its own copy of the dated events the import
 * filed into the knowledge base (vkb.evidenceTimeline). That copy used to be
 * filled once, on the first open with an empty store, so an import that was
 * interrupted and then repeated left the copy holding only the events that
 * existed at the first open (only some of the events) while the knowledge base held them all.
 *
 * Convergence adds every knowledge-base event the copy is missing. It never
 * removes or edits anything, so a hand-added event is never touched, and it
 * never brings back an imported event the veteran deliberately removed: that
 * removal is remembered as a one-way hash of the event's date and
 * description (no text of the event is stored again).
 */

import {
  eventIdentity,
  isCFileToolSource,
  isVeteranEdited,
} from "./eventIdentity";
import { loadVKB } from "./veteranKnowledgeBase";
import {
  getTimelineEvents,
  sanitizeTimelineDescription,
  saveTimelineEvents,
} from "./veteranProfile";

const REMOVED_KEY = "vet_rate_timeline_removed_imports";

function normalizeTimelineText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// The store saves descriptions sanitised (capped, control characters and
// "on<word>=" runs removed), so a knowledge-base event only matches its stored
// copy, and the removal memory, when both sides are keyed in that same form.
export function timelineEventKey(e) {
  return `${e.date}|${normalizeTimelineText(sanitizeTimelineDescription(e.description))}`;
}

// cyrb53: small non-cryptographic 53-bit hash, enough to recognise a key
// without keeping the event's words.
function hashKey(key) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < key.length; i++) {
    const ch = key.codePointAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function readRemovedHashes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REMOVED_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function isImportedTimelineEvent(event) {
  return typeof event?.id === "string" && event.id.startsWith("vkb_");
}

export function recordRemovedTimelineEvent(event) {
  if (!isImportedTimelineEvent(event)) return;
  try {
    const removed = readRemovedHashes();
    removed.add(hashKey(timelineEventKey(event)));
    localStorage.setItem(REMOVED_KEY, JSON.stringify([...removed]));
  } catch (error) {
    console.warn("Could not remember a removed timeline event:", error?.name);
  }
}

// Builds this timeline's own persisted shape for a VKB-sourced event.
export function buildImportedTimelineEvent(e, i) {
  const description = e.description || e.text;
  return {
    id: `vkb_${Date.now()}_${i}`,
    type: "records",
    date: e.date,
    description,
    title: String(description).substring(0, 50),
    category: "Medical Records",
    sourceDocumentId: e.sourceDocumentId || null,
    source: e.source || null,
    // D-C: carried through so detectTimelineGaps can still recognize
    // a Guard/Reserve enlistment event after it's imported into this
    // timeline's own persisted event shape.
    eventType: e.eventType || null,
    // ADR-007: names the projection this copy came from, if any - lets
    // a LATER re-import recognize this exact copy as stale once the
    // projection itself has since changed.
    sourceKey: e.projectionKey || null,
  };
}

export function datedVkbEvents(vkb) {
  return [
    ...(Array.isArray(vkb?.evidenceTimeline) ? vkb.evidenceTimeline : []),
    ...(Array.isArray(vkb?.evidence) ? vkb.evidence : []),
  ].filter((e) => e?.date && (e.description || e.text));
}

const _vkbDescription = (e) => e.description || e.text;

const copyKey = (sourceDocumentId, date, description) =>
  `${sourceDocumentId}|${timelineEventKey({ date, description })}`;

// A copy written before copies carried their source has a document id and a
// type but no source and no projection key. It is taken for a C-File copy only
// when its document is one the C-File Analyzer saved events for, so another
// tool's sourceless copy is never claimed.
const _isUnmarkedCopy = (e, cfileDocumentIds) =>
  !e.source &&
  !e.sourceKey &&
  Boolean(e.eventType) &&
  e.eventType !== "document_import" &&
  cfileDocumentIds.has(e.sourceDocumentId);

const _isCFileCopy = (e, cfileDocumentIds) =>
  isImportedTimelineEvent(e) &&
  Boolean(e.sourceDocumentId) &&
  !isVeteranEdited(e) &&
  (isCFileToolSource(e.source) || _isUnmarkedCopy(e, cfileDocumentIds));

/**
 * Drops the C-File copies in the store that the knowledge base no longer
 * holds, so the next step writes each document's current set instead of
 * merging it with the earlier one. A document's copies the knowledge base
 * still holds word for word stay; a document the knowledge base holds no
 * C-File events for any more loses its copies too. Copies saved by an earlier
 * build, which carry no source, are replaced the same way for every document
 * the knowledge base holds C-File events for and every id in `documentIds`.
 * Hand-added events, events of other tools or documents, and events the
 * veteran edited are never dropped. Only call with a knowledge base that
 * loaded.
 * @param {Array} vkbEvents
 * @param {Array} storeEvents
 * @param {Iterable<string>} [documentIds] documents just saved by the C-File
 *   Analyzer, so a re-analysis that now finds no events still clears the
 *   earlier copies
 * @returns {Array} the store events to keep
 */
export function dropStaleCFileCopies(vkbEvents, storeEvents, documentIds = []) {
  const fromCFile = vkbEvents.filter(
    (e) => isCFileToolSource(e.source) && e.sourceDocumentId,
  );
  const current = new Set(
    fromCFile.map((e) =>
      copyKey(e.sourceDocumentId, e.date, _vkbDescription(e)),
    ),
  );
  const cfileDocumentIds = new Set([
    ...fromCFile.map((e) => e.sourceDocumentId),
    ...documentIds,
  ]);
  return storeEvents.filter(
    (e) =>
      !_isCFileCopy(e, cfileDocumentIds) ||
      current.has(copyKey(e.sourceDocumentId, e.date, _vkbDescription(e))),
  );
}

/**
 * The knowledge-base events the store does not yet hold, as [event, index].
 * An event is held when the store has the same date and wording, or an
 * imported copy of the same document's event on the same day and type: the
 * model words an event differently on each analysis, and the knowledge base
 * updates that event in place, so the store must not gain a second copy.
 * Several same-day, same-type events pair one-to-one with their copies.
 * @param {Array} vkbEvents
 * @param {Array} storeEvents
 * @param {(key: string) => boolean} [isRemoved]
 */
export function freshVkbEvents(
  vkbEvents,
  storeEvents,
  isRemoved = () => false,
) {
  const keyOf = (e) =>
    timelineEventKey({ date: e.date, description: _vkbDescription(e) });
  const present = new Set(storeEvents.map(timelineEventKey));
  const claimed = new Set();
  const copies = new Map();
  for (const e of storeEvents) {
    if (!isImportedTimelineEvent(e) || !e.sourceDocumentId || !e.eventType) {
      continue;
    }
    const id = `${e.sourceDocumentId}|${eventIdentity(e)}`;
    copies.set(id, [...(copies.get(id) || []), e]);
  }
  const wordedAlike = new Set(
    vkbEvents.map(keyOf).filter((k) => present.has(k)),
  );
  for (const list of copies.values()) {
    list.forEach((c) => wordedAlike.has(timelineEventKey(c)) && claimed.add(c));
  }
  const fresh = [];
  vkbEvents.forEach((e, i) => {
    const key = keyOf(e);
    if (present.has(key) || isRemoved(key)) return;
    present.add(key);
    const earlier = e.sourceDocumentId
      ? (copies.get(`${e.sourceDocumentId}|${eventIdentity(e)}`) || []).find(
          (c) => !claimed.has(c),
        )
      : null;
    if (earlier) {
      claimed.add(earlier);
      return;
    }
    fresh.push([e, i]);
  });
  return fresh;
}

/**
 * Adds every dated knowledge-base event the local timeline store lacks.
 * The store is read only after the knowledge base has loaded and written back
 * with no further await, so it cannot overwrite an edit made meanwhile.
 * A knowledge base that cannot be read changes nothing, so a failed read never
 * empties the timeline.
 * @param {{onlyIfStoreHasEvents?: boolean, cfileDocumentIds?: string[]}} [options]
 *   An empty store is left to the timeline's own first-open import, which tells
 *   the veteran what it filled in.
 * @returns {Promise<{added: number}>}
 */
export async function convergeTimelineStoreWithVKB({
  onlyIfStoreHasEvents = false,
  cfileDocumentIds = [],
} = {}) {
  let vkb;
  try {
    vkb = await loadVKB({ strict: true });
  } catch (error) {
    console.warn("Timeline not updated, records unreadable:", error?.name);
    return { added: 0 };
  }
  const vkbEvents = datedVkbEvents(vkb);
  const stored = getTimelineEvents();
  if (onlyIfStoreHasEvents && stored.length === 0) return { added: 0 };
  const current = dropStaleCFileCopies(vkbEvents, stored, cfileDocumentIds);
  const dropped = stored.length - current.length;
  const removed = readRemovedHashes();
  const fresh = freshVkbEvents(vkbEvents, current, (key) =>
    removed.has(hashKey(key)),
  ).map(([e, i]) => buildImportedTimelineEvent(e, i));
  if (fresh.length === 0 && dropped === 0) return { added: 0 };
  if (!saveTimelineEvents([...current, ...fresh])) {
    throw new Error("The timeline could not be saved.");
  }
  return { added: fresh.length };
}
