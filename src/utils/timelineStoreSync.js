/**
 * Vet-Rate.org - Timeline store convergence
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The Evidence Timeline keeps its own copy of the dated events the import
 * filed into the knowledge base (vkb.evidenceTimeline). That copy used to be
 * filled once, on the first open with an empty store, so an import that was
 * interrupted and then repeated left the copy holding only the events that
 * existed at the first open (48 of 66) while the knowledge base held them all.
 *
 * Convergence adds every knowledge-base event the copy is missing. It never
 * removes or edits anything, so a hand-added event is never touched, and it
 * never brings back an imported event the veteran deliberately removed: that
 * removal is remembered as a one-way hash of the event's date and
 * description (no text of the event is stored again).
 */

import { loadVKB } from "./veteranKnowledgeBase";
import { getTimelineEvents, saveTimelineEvents } from "./veteranProfile";

const REMOVED_KEY = "vet_rate_timeline_removed_imports";

function normalizeTimelineText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function timelineEventKey(e) {
  return `${e.date}|${normalizeTimelineText(e.description)}`;
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

/**
 * Adds every dated knowledge-base event the local timeline store lacks.
 * The store is read only after the knowledge base has loaded and written back
 * with no further await, so it cannot overwrite an edit made meanwhile.
 * @param {{onlyIfStoreHasEvents?: boolean}} [options] An empty store is left
 *   to the timeline's own first-open import, which tells the veteran what it
 *   filled in.
 * @returns {Promise<{added: number}>}
 */
export async function convergeTimelineStoreWithVKB({
  onlyIfStoreHasEvents = false,
} = {}) {
  const vkbEvents = datedVkbEvents(await loadVKB());
  const current = getTimelineEvents();
  if (onlyIfStoreHasEvents && current.length === 0) return { added: 0 };
  const present = new Set(current.map(timelineEventKey));
  const removed = readRemovedHashes();
  const fresh = [];
  vkbEvents.forEach((e, i) => {
    const key = timelineEventKey({
      date: e.date,
      description: e.description || e.text,
    });
    if (present.has(key) || removed.has(hashKey(key))) return;
    present.add(key);
    fresh.push(buildImportedTimelineEvent(e, i));
  });
  if (fresh.length === 0) return { added: 0 };
  if (!saveTimelineEvents([...current, ...fresh])) {
    throw new Error("The timeline could not be saved.");
  }
  return { added: fresh.length };
}
