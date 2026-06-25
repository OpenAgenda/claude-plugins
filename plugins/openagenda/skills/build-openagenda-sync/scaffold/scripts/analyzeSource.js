import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { firstImageUrl } from '../lib/transform/media.js';
import { makeSubcategoryFilter } from '../lib/transform/filter.js';
import { EXCLUDED_SUBCATEGORIES } from '../lib/transform/constants.js';
import { mergeSourceEvents } from '../lib/transform/mergeEvents.js';

export function analyze({ events, poiMap = new Map(), subCategoryMap = new Map() }) {
  const keep = makeSubcategoryFilter(EXCLUDED_SUBCATEGORIES);
  const bySubCategory = {};
  let withImage = 0, withLocation = 0, excludedCount = 0;
  for (const e of events) {
    if (firstImageUrl(e.media)) withImage += 1;
    const poi = e.poi_id ? poiMap.get(e.poi_id) : null;
    const locSrc = poi || e;
    const hasCoords = Number.isFinite(locSrc.latitude) && Number.isFinite(locSrc.longitude);
    if ((locSrc.adress || '').trim() || hasCoords) withLocation += 1;
    if (!keep(e)) excludedCount += 1;
    const label = subCategoryMap.get((e.sub_category || '').split(';')[0])?.label || e.sub_category || '∅';
    bySubCategory[label] = (bySubCategory[label] || 0) + 1;
  }
  const merged = mergeSourceEvents(events);
  const mergedCount = merged.length;
  const multiOccurrenceGroups = merged.filter((e) => e._occurrenceCount > 1).length;
  const redundantRecords = events.length - mergedCount;

  return {
    total: events.length,
    withImage,
    withoutImage: events.length - withImage,
    withLocation,
    excludedCount,
    bySubCategory,
    mergedCount,
    multiOccurrenceGroups,
    redundantRecords,
  };
}

function loadFixture(name) {
  const path = new URL(`../fixtures/${name}.json`, import.meta.url);
  if (!existsSync(path)) throw new Error(`Missing fixture ${name}; run "yarn download" first`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function indexById(obj) {
  const map = new Map();
  for (const item of (Array.isArray(obj) ? obj : Object.values(obj || {}))) {
    if (item && item.id) map.set(item.id, item);
  }
  return map;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const evRaw = loadFixture('evenements');
  const report = analyze({
    events: Array.isArray(evRaw) ? evRaw : Object.values(evRaw),
    poiMap: indexById(loadFixture('poi')),
    subCategoryMap: indexById(loadFixture('sous-categories')),
  });
  console.log(JSON.stringify(report, null, 2));
}
