import { splitList } from './media.js';

// Returns a predicate `(event, poiMap?) => boolean`; true = KEEP the event.
// Excludes when the event's own sub_category OR its venue POI's sub_category falls
// in the excluded set. Maisons-de-quartier events are usually identified by their
// VENUE (the POI), not tagged on the event itself.
export function makeSubcategoryFilter(excluded = []) {
  const deny = new Set(excluded);
  const hit = (subcat) => splitList(subcat).some((id) => deny.has(id));
  return (event, poiMap) => {
    if (hit(event?.sub_category)) return false;
    const poi = event?.poi_id && poiMap ? poiMap.get(event.poi_id) : null;
    if (poi && hit(poi.sub_category)) return false;
    return true;
  };
}
