import { describe, it, expect } from 'vitest';
import { mergeSourceEvents, groupKey } from './mergeEvents.js';

const base = { title: 'Visite', poi_id: 'p1', adress: 'A', short_content: '<p>x</p>', description: '<p>y</p>' };

describe('mergeSourceEvents', () => {
  it('merges records identical except the date into one event with all occurrences', () => {
    const events = [
      { ...base, id: 'b', start: '2026-07-21T08:00:00Z', end: '2026-07-21T10:00:00Z' },
      { ...base, id: 'a', start: '2026-07-07T08:00:00Z', end: '2026-07-07T10:00:00Z' },
      { ...base, id: 'c', start: '2026-07-28T08:00:00Z', end: '2026-07-28T10:00:00Z' },
    ];
    const merged = mergeSourceEvents(events);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('a'); // smallest id is the representative
    expect(merged[0].occurrences.map((o) => o.start)).toEqual([
      '2026-07-07T08:00:00Z', '2026-07-21T08:00:00Z', '2026-07-28T08:00:00Z',
    ]);
  });
  it('keeps genuinely different events separate', () => {
    const merged = mergeSourceEvents([
      { ...base, id: '1', start: '2026-07-07T08:00:00Z' },
      { ...base, id: '2', title: 'Autre', start: '2026-07-07T08:00:00Z' },
    ]);
    expect(merged).toHaveLength(2);
  });
  it('groupKey ignores dates', () => {
    expect(groupKey({ ...base, start: 'X' })).toBe(groupKey({ ...base, start: 'Y' }));
  });
});
