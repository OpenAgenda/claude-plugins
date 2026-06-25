import { createHash } from 'node:crypto';

const norm = (s) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

// Two source records are the same recurring event when everything but the date matches.
export function groupKey(event) {
  return createHash('sha1')
    .update([norm(event.title), String(event.poi_id ?? ''), norm(event.adress), norm(event.short_content), norm(event.description)].join('|'))
    .digest('hex')
    .slice(0, 16);
}

// Collapse same-event records into one, carrying every occurrence's date. The merged
// record keeps the smallest source id (stable) as its identity, and exposes all dates
// under `occurrences` for buildTimings.
export function mergeSourceEvents(events) {
  const groups = new Map();
  for (const e of events) {
    const k = groupKey(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const merged = [];
  for (const members of groups.values()) {
    const rep = members.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
    const occurrences = members
      .map((m) => ({ start: m.start, end: m.end }))
      .filter((o) => o.start)
      .sort((a, b) => String(a.start).localeCompare(String(b.start)));
    merged.push({ ...rep, occurrences, _occurrenceCount: members.length });
  }
  return merged;
}
