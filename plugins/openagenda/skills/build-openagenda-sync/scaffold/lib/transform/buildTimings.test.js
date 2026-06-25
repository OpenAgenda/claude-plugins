import { describe, it, expect } from 'vitest';
import buildTimings from './buildTimings.js';

describe('buildTimings', () => {
  it('keeps a single same-day timing intact', () => {
    const { timings, warnings } = buildTimings({
      start: '2026-10-16T08:00:00.000Z', end: '2026-10-16T16:00:00.000Z',
    });
    expect(timings).toEqual([{ begin: '2026-10-16T08:00:00.000Z', end: '2026-10-16T16:00:00.000Z' }]);
    expect(warnings).toEqual([]);
  });
  it('applies a default duration when end is missing', () => {
    const { timings } = buildTimings({ start: '2026-10-16T08:00:00.000Z' }, { defaultDurationS: 3600 });
    expect(timings).toEqual([{ begin: '2026-10-16T08:00:00.000Z', end: '2026-10-16T09:00:00.000Z' }]);
  });
  it('splits a multi-day span into per-day timings under 24h', () => {
    const { timings } = buildTimings({
      start: '2026-10-16T08:00:00.000Z', end: '2026-10-18T16:00:00.000Z',
    });
    expect(timings.length).toBe(3);
    for (const t of timings) {
      expect(new Date(t.end) - new Date(t.begin)).toBeLessThanOrEqual(24 * 3600 * 1000);
    }
    expect(timings[0].begin).toBe('2026-10-16T08:00:00.000Z');
  });
  it('warns and returns no timings when start is invalid', () => {
    const { timings, warnings } = buildTimings({ start: 'nope' });
    expect(timings).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });
  it('builds one timing per occurrence for a recurring event', () => {
    const { timings } = buildTimings({ occurrences: [
      { start: '2026-07-07T08:00:00.000Z', end: '2026-07-07T10:00:00.000Z' },
      { start: '2026-07-21T08:00:00.000Z', end: '2026-07-21T10:00:00.000Z' },
    ] });
    expect(timings).toHaveLength(2);
    expect(timings[0].begin).toBe('2026-07-07T08:00:00.000Z');
    expect(timings[1].begin).toBe('2026-07-21T08:00:00.000Z');
  });
  it('clamps an implausibly long span instead of exploding into many daily timings', () => {
    const { timings, warnings } = buildTimings({ start: '2026-07-14T08:30:00.000Z', end: '2026-09-14T10:00:00.000Z' });
    expect(timings).toHaveLength(1);
    expect(timings[0].begin).toBe('2026-07-14T08:30:00.000Z');
    expect(new Date(timings[0].end) - new Date(timings[0].begin)).toBeLessThanOrEqual(24 * 3600 * 1000);
    expect(warnings.join(' ')).toMatch(/clamp/i);
  });
  it('drops duplicate and overlapping timings across occurrences', () => {
    const { timings } = buildTimings({ occurrences: [
      { start: '2026-07-18T08:30:00.000Z', end: '2026-07-18T10:00:00.000Z' },
      { start: '2026-07-18T08:30:00.000Z', end: '2026-07-18T10:00:00.000Z' }, // exact dup
      { start: '2026-07-18T09:00:00.000Z', end: '2026-07-18T11:00:00.000Z' }, // overlaps
      { start: '2026-07-25T08:30:00.000Z', end: '2026-07-25T10:00:00.000Z' }, // distinct
    ] });
    expect(timings).toHaveLength(2);
    expect(timings[0].begin).toBe('2026-07-18T08:30:00.000Z');
    expect(timings[1].begin).toBe('2026-07-25T08:30:00.000Z');
  });
});
