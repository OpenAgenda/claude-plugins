import { describe, it, expect } from 'vitest';
import {
  buildCandidates, tagTraits, buildSample, reconcile, buildComparison, renderReport,
} from './spotCheck.js';
import { EXCLUDED_SUBCATEGORIES } from '../lib/transform/constants.js';

const CONCERT_SUBCAT = '9d0c194a-2460-45a8-b8b0-3762a75fd221';

const poiMap = new Map([
  ['p1', { id: 'p1', title: 'Salle Ronde', adress: '1 rue du Test', city: 'Albi', zipcode: '81000', latitude: 43.92, longitude: 2.14 }],
]);

// Two records of the same recurring event (merge → multi-occurrence, POI location,
// no image, no contact → fallback registration, no known sub_category → defaults).
const recurring = (id, start) => ({
  id,
  title: 'Atelier récurrent',
  short_content: 'Un atelier qui revient.',
  poi_id: 'p1',
  start,
  end: start.replace('T18:00', 'T20:00'),
});

const events = [
  recurring('a1', '2026-09-01T18:00:00.000Z'),
  recurring('a2', '2026-09-08T18:00:00.000Z'),
  { // embedded address + image + mapped sub_category + real reservation link
    id: 'b1', title: 'Grand concert', short_content: '<p>Du <b>son</b> pour tous.</p>',
    adress: '2 avenue Exemple', city: 'Albi', zipcode: '81000', latitude: 43.93, longitude: 2.15,
    media: 'https://example.com/img.jpg;', sub_category: `${CONCERT_SUBCAT};`,
    reservation_link: 'https://tickets.example.com/concert',
    start: '2026-09-05T20:00:00.000Z', end: '2026-09-05T22:00:00.000Z',
  },
  { // excluded by the sub-category filter
    id: 'c1', title: 'Réunion de quartier', sub_category: EXCLUDED_SUBCATEGORIES[0],
    adress: '3 rue Exclue', start: '2026-09-06T10:00:00.000Z',
  },
  { // unlocatable → skipped (onsite with no resolvable location)
    id: 'd1', title: 'Événement fantôme', start: '2026-09-07T10:00:00.000Z',
  },
  { // multi-day span → split + transform warning
    id: 'e1', title: 'Exposition longue', short_content: 'Trois jours durant.',
    adress: '4 place Longue', city: 'Albi', zipcode: '81000',
    start: '2026-09-10T08:00:00.000Z', end: '2026-09-12T18:00:00.000Z',
  },
  { // plain control-ish event
    id: 'f1', title: 'Marché simple', short_content: 'Rien de spécial.',
    adress: '5 rue Banale', city: 'Albi', zipcode: '81000',
    media: 'https://example.com/marche.jpg', sub_category: `${CONCERT_SUBCAT}`,
    reservation_link: 'https://resa.example.com',
    start: '2026-09-11T09:00:00.000Z', end: '2026-09-11T12:00:00.000Z',
  },
];

const source = { events, poiMap };

describe('buildCandidates', () => {
  it('mirrors the sync path: merge, filter, skip unmappable', () => {
    const out = buildCandidates(source);
    expect(out.sourceTotal).toBe(7);
    expect(out.mergedCount).toBe(6); // a1+a2 merged
    expect(out.excluded).toBe(1);    // c1
    expect(out.skipped).toBe(1);     // d1
    expect(out.candidates.map((c) => c.mapped.extId.value).sort()).toEqual(['a1', 'b1', 'e1', 'f1']);
  });
});

describe('tagTraits', () => {
  const byId = Object.fromEntries(buildCandidates(source).candidates.map((c) => [c.mapped.extId.value, c]));

  it('tags the merged recurring event', () => {
    const traits = tagTraits(byId.a1);
    expect(traits).toContain('multi-occurrence');
    expect(traits).toContain('poi-location');
    expect(traits).toContain('no-image');
    expect(traits).toContain('fallback-registration');
    expect(traits).toContain('defaulted-fields');
  });

  it('tags the embedded-address event with image and mapped fields', () => {
    const traits = tagTraits(byId.b1);
    expect(traits).toContain('embedded-address');
    expect(traits).toContain('image');
    expect(traits).not.toContain('fallback-registration');
    expect(traits).not.toContain('defaulted-fields');
  });

  it('tags the multi-day split and its warning', () => {
    const traits = tagTraits(byId.e1);
    expect(traits).toContain('split-multi-day');
    expect(traits).toContain('transform-warnings');
  });
});

describe('buildSample', () => {
  const { candidates } = buildCandidates(source);

  it('covers every represented trait and assigns the superlatives', () => {
    const sample = buildSample(candidates, { size: 12 });
    const covered = new Set(sample.flatMap((c) => c.traits));
    for (const t of ['multi-occurrence', 'poi-location', 'embedded-address', 'split-multi-day',
      'fallback-registration', 'defaulted-fields', 'no-image', 'image', 'html-heavy-description', 'longest-description']) {
      expect(covered).toContain(t);
    }
    expect(new Set(sample).size).toBe(sample.length); // no duplicates
  });

  it('respects the size cap', () => {
    expect(buildSample(candidates, { size: 2 })).toHaveLength(2);
  });

  it('tags a leftover plain event as the control', () => {
    const extra = { ...events[6], id: 'g1', title: 'Autre marché simple', adress: '6 rue Calme' };
    const { candidates: more } = buildCandidates({ events: [...events, extra], poiMap });
    const sample = buildSample(more, { size: 12 });
    expect(sample.some((c) => c.traits.includes('control'))).toBe(true);
  });
});

describe('reconcile', () => {
  it('reports counts and both directions of set mismatch', () => {
    const counts = {
      sourceTotal: 7, mergedCount: 6, excluded: 1, skipped: 1,
      candidates: [{ mapped: { extId: { value: 'a1' } } }, { mapped: { extId: { value: 'b1' } } }],
    };
    const published = [{ extId: { value: 'a1' } }, { extId: { value: 'zzz' } }];
    const r = reconcile(counts, published);
    expect(r.expectedPublished).toBe(2);
    expect(r.actuallyPublished).toBe(2);
    expect(r.missingOnOA).toEqual(['b1']);
    expect(r.unexpectedOnOA).toEqual(['zzz']);
  });
});

describe('buildComparison', () => {
  const local = {
    mapped: {
      oa: {
        title: { fr: 'Grand concert' }, description: { fr: 'Du son.' }, longDescription: { fr: 'Du son pour tous.' },
        timings: [{ begin: '2026-09-05T20:00:00.000Z', end: '2026-09-05T22:00:00.000Z' }],
        registration: [{ type: 'link', value: 'https://tickets.example.com/concert' }],
        _imageUrl: 'https://example.com/img.jpg',
        'type-de-public': 10,
      },
      location: { oa: { name: 'Salle Ronde', address: '1 rue du Test', latitude: 43.92, longitude: 2.14 } },
    },
  };

  it('pairs local and published values field by field', () => {
    const published = {
      title: { fr: 'Grand concert' },
      timings: [{ begin: '2026-09-05T20:00:00.000Z', end: '2026-09-05T22:00:00.000Z' }],
      location: { name: 'Salle Ronde', address: '1 rue du Test', postalCode: '81000', city: 'Albi' },
      image: { filename: 'img.jpg' },
      registration: [{ type: 'link', value: 'https://tickets.example.com/concert' }],
      'type-de-public': [10],
    };
    const rows = buildComparison(local, published);
    const get = (f) => rows.find((r) => r.field === f);
    expect(get('title')).toEqual({ field: 'title', local: 'Grand concert', published: 'Grand concert' });
    expect(get('timings (count)').published).toBe('1');
    expect(get('location address').published).toBe('1 rue du Test, 81000, Albi');
    expect(get('type-de-public').published).toBe('10'); // array flattened
    expect(get('image').published).toBe('img.jpg');
  });

  it('renders missing published values as em-dashes', () => {
    const rows = buildComparison(local, undefined);
    expect(rows.find((r) => r.field === 'title').published).toBe('—');
  });
});

describe('renderReport', () => {
  it('emits the reconciliation table, warnings, and per-event verdict blocks', () => {
    const md = renderReport({
      agendaUID: '42',
      baseline: 'test baseline',
      recon: {
        sourceRecords: 7, mergedEvents: 6, excludedByFilter: 1, skippedUnmappable: 1,
        expectedPublished: 4, actuallyPublished: 3, missingOnOA: ['b1'], unexpectedOnOA: [],
      },
      sections: [
        {
          extId: 'a1', uid: 9, title: 'Atelier récurrent', traits: ['multi-occurrence'],
          publishedUrl: 'https://openagenda.com/x/events/y', sourceUrl: 'https://albi.fr/z',
          rows: [{ field: 'title', local: 'Atelier récurrent', published: 'Atelier récurrent' }],
        },
        { extId: 'b1', title: 'Grand concert', traits: ['image'], publishedUrl: null, sourceUrl: null, rows: null },
      ],
      generatedAt: '2026-08-11T00:00:00.000Z',
    });
    expect(md).toContain('## Reconciliation');
    expect(md).toContain('| **expected published** | **4** |');
    expect(md).toContain('expected but missing on OA: `b1`');
    expect(md).toContain('### 1. `a1` — Atelier récurrent');
    expect(md).toContain('| title | Atelier récurrent | Atelier récurrent |');
    expect(md).toContain('Not found in the published read-back');
    expect((md.match(/Verdict: \[ \] OK/g) || []).length).toBe(2);
  });
});
