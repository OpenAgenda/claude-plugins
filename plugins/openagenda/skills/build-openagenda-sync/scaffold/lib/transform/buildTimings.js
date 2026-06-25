const DAY_MS = 24 * 3600 * 1000;

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function buildOneTiming(start, end, defaultDurationS, maxSpanDays) {
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

  // Clamp implausibly long spans before splitting.
  if (endDate - begin > maxSpanDays * DAY_MS) {
    warnings.push(`implausible span (> ${maxSpanDays} d) clamped to default duration`);
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

export default function buildTimings(event, { defaultDurationS = 7200, maxSpanDays = 7 } = {}) {
  const occurrences = Array.isArray(event?.occurrences) && event.occurrences.length
    ? event.occurrences
    : [{ start: event?.start, end: event?.end }];
  const allTimings = [];
  const warnings = [];
  for (const occ of occurrences) {
    const r = buildOneTiming(occ.start, occ.end, defaultDurationS, maxSpanDays);
    allTimings.push(...r.timings);
    warnings.push(...r.warnings);
  }

  // Dedupe exact duplicates, then drop overlapping timings (keep earliest).
  allTimings.sort((a, b) => new Date(a.begin) - new Date(b.begin));
  const timings = [];
  let prev = null;
  for (const t of allTimings) {
    if (prev && t.begin === prev.begin && t.end === prev.end) {
      // exact duplicate — skip silently (already warned at source if needed)
      continue;
    }
    if (prev && new Date(t.begin) < new Date(prev.end)) {
      warnings.push('dropped overlapping timing');
      continue;
    }
    timings.push(t);
    prev = t;
  }

  return { timings, warnings };
}
