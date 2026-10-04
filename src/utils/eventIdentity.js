/**
 * Vet-Rate.org - Identity of a dated event written from a document
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * An event is recognised by its document, calendar day and type, never by its
 * wording: a model words the same event differently on each run.
 */

const MONTH_YEAR = /^([A-Za-z]{3,9})\.?,?\s+(\d{4})$/;
const pad = (n) => String(n).padStart(2, "0");

export const eventTypeKey = (type) =>
  String(type || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();

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
  `${eventDayKey(e.date)}|${eventTypeKey(e.eventType)}`;
