const DAY_MS = 24 * 3600 * 1000;

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function buildOneTiming(start, end, defaultDurationS) {
  const warnings = [];
  const begin = new Date(start);
  if (!isValidDate(begin)) {
    return { timings: [], warnings: ['invalid or missing start date'] };
  }

  let endDate = end ? new Date(end) : null;
  if (!endDate || !isValidDate(endDate) || endDate <= begin) {
    if (end) warnings.push('invalid/empty end date; applied default duration');
    endDate = new Date(begin.getTime() + defaultDurationS * 1000);
  }

  // Single timing if it fits in a day.
  if (endDate - begin <= DAY_MS) {
    return { timings: [{ begin: begin.toISOString(), end: endDate.toISOString() }], warnings };
  }

  // Split multi-day spans into per-day chunks (OA rejects >24h timings).
  const timings = [];
  let cursor = begin;
  while (cursor < endDate) {
    const dayEnd = new Date(cursor.getTime() + DAY_MS);
    const chunkEnd = dayEnd < endDate ? dayEnd : endDate;
    timings.push({ begin: cursor.toISOString(), end: chunkEnd.toISOString() });
    cursor = chunkEnd;
  }
  warnings.push(`multi-day span split into ${timings.length} timings`);
  return { timings, warnings };
}

export default function buildTimings(event, { defaultDurationS = 7200 } = {}) {
  const occurrences = Array.isArray(event?.occurrences) && event.occurrences.length
    ? event.occurrences
    : [{ start: event?.start, end: event?.end }];
  const timings = [];
  const warnings = [];
  for (const occ of occurrences) {
    const r = buildOneTiming(occ.start, occ.end, defaultDurationS);
    timings.push(...r.timings);
    warnings.push(...r.warnings);
  }
  return { timings, warnings };
}
