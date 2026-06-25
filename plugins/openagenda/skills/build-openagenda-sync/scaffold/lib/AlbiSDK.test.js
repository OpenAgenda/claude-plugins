import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAlbiSDK } from './AlbiSDK.js';

afterEach(() => vi.restoreAllMocks());

// URL-keyed mock: resolves by URL substring, so it is independent of the
// concurrent call ordering produced by loadAll's Promise.all.
function mockFetchByUrl(entries) {
  const fn = vi.fn(async (url) => {
    const u = String(url);
    for (const [needle, body] of entries) {
      if (u.includes(needle)) {
        return { ok: true, json: async () => body, text: async () => JSON.stringify(body) };
      }
    }
    throw new Error(`unexpected url: ${u}`);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('createAlbiSDK.fetchDataset', () => {
  it('resolves the resource URL via package_show then downloads it', async () => {
    const fetchFn = mockFetchByUrl([
      ['package_show?id=evenements', { success: true, result: { resources: [{ id: 'r1', url: 'https://albi/download/evenements.json' }] } }],
      ['https://albi/download/evenements.json', { 'evt-1': { id: 'evt-1', title: 'X' } }],
    ]);
    const sdk = createAlbiSDK({ key: 'tok', base: 'https://albi/api/3/action' });
    const data = await sdk.fetchDataset('evenements');

    expect(data).toEqual({ 'evt-1': { id: 'evt-1', title: 'X' } });
    expect(fetchFn.mock.calls[0][0]).toContain('package_show?id=evenements');
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe('tok');
    expect(fetchFn.mock.calls[1][0]).toBe('https://albi/download/evenements.json');
  });
});

describe('createAlbiSDK.loadAll', () => {
  it('returns events array and lookup maps from 4 datasets (8 fetches)', async () => {
    const fetchFn = mockFetchByUrl([
      ['package_show?id=evenements', { success: true, result: { resources: [{ url: 'https://albi/evenements.json' }] } }],
      ['package_show?id=poi', { success: true, result: { resources: [{ url: 'https://albi/poi.json' }] } }],
      ['package_show?id=organisateurs', { success: true, result: { resources: [{ url: 'https://albi/organisateurs.json' }] } }],
      ['package_show?id=sous-categories', { success: true, result: { resources: [{ url: 'https://albi/sous-categories.json' }] } }],
      ['https://albi/evenements.json', { 'e1': { id: 'e1', title: 'E', sub_category: 's1', poi_id: 'p1', organizer_id: 'o1' } }],
      ['https://albi/poi.json', { 'p1': { id: 'p1', name: 'Hall' } }],
      ['https://albi/organisateurs.json', { 'o1': { id: 'o1', label: 'Ville' } }],
      ['https://albi/sous-categories.json', { 's1': { id: 's1', label: 'Concert' } }],
    ]);
    const sdk = createAlbiSDK({ key: 'tok', base: 'https://albi/api/3/action' });
    const { events, poiMap, organizerMap, subCategoryMap } = await sdk.loadAll();

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('e1');
    expect(poiMap.get('p1').name).toBe('Hall');
    expect(subCategoryMap.get('s1').label).toBe('Concert');
    expect(fetchFn).toHaveBeenCalledTimes(8);
  });
});
