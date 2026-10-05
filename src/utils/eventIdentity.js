/**
 * Vet-Rate.org - Identity of a dated event written from a document
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * An event from the C-File Analyzer is recognised by its source document,
 * calendar day and canonical type, never by its wording: a model words the
 * same event, and names its type, differently on each run.
 */

export const CFILE_EVENT_SOURCE = "C-File Analysis";
export const CFILE_LEGACY_EVENT_SOURCE = "C-File";

export const isCFileToolSource = (source) =>
  source === CFILE_EVENT_SOURCE || source === CFILE_LEGACY_EVENT_SOURCE;

// An event the veteran changed is theirs: a re-analysis never deletes or
// overwrites it.
export const isVeteranEdited = (e) =>
  e?.userEdited === true || e?.edited === true;

const MONTH_YEAR = /^([A-Za-z]{3,9})\.?,?\s+(\d{4})$/;
const pad = (n) => String(n).padStart(2, "0");

export const eventTypeKey = (type) =>
  String(type || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();

// Keyword rules, first match wins. The model's wording never decides; only the
// words in its type label do.
const CANONICAL_TYPE_RULES = [
  [
    "appeal decided",
    /\b(appeal|bva|board)\b.*\b(decid|decision|ruling|remand|grant|den)/,
  ],
  ["appeal decided", /\b(decid|decision|ruling)\w*\b.*\b(appeal|bva|board)\b/],
  ["appeal filed", /\b(appeal|nod|disagreement|form 9|hlr|higher level)/],
  ["exam", /\b(exam|c p|c and p|compensation and pension|dbq|evaluation)/],
  [
    "decision issued",
    /\b(decision|decided|rating|award|grant|denial|denied|determination)/,
  ],
  [
    "claim filed",
    /\b(file|filed|filing|submitted|submission|received)\b.*\bclaim|\bclaim\b.*\b(file|filed|filing|submitted|received)|\boriginal claim|\bintent to file/,
  ],
  [
    "evidence submitted",
    /\b(evidence|statement|nexus|submitted|submission|records? received)/,
  ],
  ["notice sent", /\b(notice|letter|notif|correspond|request|sent)/],
  ["claim filed", /\b(claim|application)\b/],
];

export const CANONICAL_EVENT_TYPES = [
  "claim filed",
  "decision issued",
  "exam",
  "appeal filed",
  "appeal decided",
  "evidence submitted",
  "notice sent",
  "other",
];

export function canonicalEventType(type) {
  const key = eventTypeKey(type);
  if (!key) return "other";
  const rule = CANONICAL_TYPE_RULES.find(([, pattern]) => pattern.test(key));
  return rule ? rule[0] : "other";
}

const isoDayIsReal = (text) => {
  const [y, m, d] = text.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
};

// A date that names a real moment: a calendar day, or a month or year the
// letter gave without a day. Blank text, "unknown" and impossible days such as
// 2019-02-31 are not dates.
export function isRealEventDate(date) {
  const text = String(date || "").trim();
  if (!text) return false;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(text);
  if (iso) return isoDayIsReal(`${iso[1]}-${iso[2]}-${iso[3]}`);
  if (/^\d{4}$/.test(text)) return true;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return true;
  if (!/\d{4}/.test(text)) return false;
  return !Number.isNaN(new Date(text).getTime());
}

// The calendar day an event date names, however the model or the letter wrote
// it ("2019-03-03", "March 3, 2019"). A year or a month alone stays a year or a
// month, so it never collides with a real day; text that is no date compares as
// itself.
export function eventDayKey(date) {
  const text = String(date || "").trim();
  if (!text) return "";
  const isoDay = /^\d{4}-\d{2}-\d{2}/.exec(text);
  if (isoDay) return isoDay[0];
  if (/^\d{4}(-\d{2})?$/.test(text)) return text;
  const monthYear = MONTH_YEAR.exec(text);
  if (monthYear) {
    const parsed = new Date(`${monthYear[1]} 1, ${monthYear[2]}`);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}`;
    }
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text.toLowerCase();
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

export const eventIdentity = (e) =>
  `${eventDayKey(e.date)}|${canonicalEventType(e.eventType)}`;
