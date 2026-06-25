import { describe, it, expect } from 'vitest';
import { analyze } from './analyzeSource.js';

const events = [
  { id: '1', media: 'https://x/a.jpg;', adress: 'A', sub_category: '9d0c194a-1d67-491a-85e6-7f5102d3ebf4' },
  { id: '2', media: '', adress: 'B', sub_category: '9d0c194a-d274-49f8-97e1-b93fd0f42274' },
  { id: '3', media: 'https://x/c.jpg;', adress: '', latitude: 1, longitude: 2, sub_category: '' },
];

describe('analyze', () => {
  it('summarises coverage and exclusions', () => {
    const r = analyze({ events, subCategoryMap: new Map() });
    expect(r.total).toBe(3);
    expect(r.withImage).toBe(2);
    expect(r.withoutImage).toBe(1);
    expect(r.withLocation).toBe(3);
    expect(r.excludedCount).toBe(1);
  });
  it('counts a POI-resolved location for an event with no embedded address', () => {
    const evs = [{ id: '9', poi_id: 'p1', media: '', adress: '', sub_category: '' }];
    const poiMap = new Map([['p1', { id: 'p1', adress: '1 rue X, 81000 Albi', latitude: 43.9, longitude: 2.1 }]]);
    const r = analyze({ events: evs, poiMap, subCategoryMap: new Map() });
    expect(r.withLocation).toBe(1);
  });
  it('reports multi-occurrence merging', () => {
    const evs = [
      { id: 'a', title: 'V', poi_id: 'p', adress: 'A', short_content: 's', description: 'd', start: '2026-07-07T08:00:00Z', media: '', sub_category: '' },
      { id: 'b', title: 'V', poi_id: 'p', adress: 'A', short_content: 's', description: 'd', start: '2026-07-14T08:00:00Z', media: '', sub_category: '' },
      { id: 'c', title: 'Autre', poi_id: 'p', adress: 'A', short_content: 's2', description: 'd2', start: '2026-07-07T08:00:00Z', media: '', sub_category: '' },
    ];
    const r = analyze({ events: evs, poiMap: new Map(), subCategoryMap: new Map() });
    expect(r.mergedCount).toBe(2);
    expect(r.multiOccurrenceGroups).toBe(1);
    expect(r.redundantRecords).toBe(1);
  });
});
