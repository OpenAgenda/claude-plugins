import { createHash } from 'node:crypto';
import { EXT_KEY } from './constants.js';

const hash = (s) => 'addr-' + createHash('sha1').update(s).digest('hex').slice(0, 16);

export default function mapLocation(event, { poiMap = new Map() } = {}) {
  const poi = event?.poi_id ? poiMap.get(event.poi_id) : null;
  // The POI is the canonical venue (stable id, full address, shared across events).
  // Fall back to the event's own embedded address fields when there is no POI.
  const src = poi || event || {};
  const address = (src.adress || '').trim();
  const hasCoords = Number.isFinite(src.latitude) && Number.isFinite(src.longitude);
  if (!address && !hasCoords) return null;

  // Venue name comes from the POI title; otherwise fall back to city / first address segment.
  const name = (poi?.title || src.city || address.split(',')[0] || 'Albi').trim();
  const extValue = event?.poi_id || hash(address || `${src.latitude},${src.longitude}`);

  const oa = {
    name: name.slice(0, 100),
    address: address || `${src.city || ''} ${src.zipcode || ''}`.trim(),
    city: src.city || undefined,
    postalCode: src.zipcode || undefined,
    countryCode: 'FR',
  };
  if (hasCoords) {
    oa.latitude = src.latitude;
    oa.longitude = src.longitude;
  }

  const addressCandidates = [oa.address, `${src.zipcode || ''} ${src.city || ''}`.trim()]
    .map((s) => s.trim())
    .filter(Boolean);

  return { extId: { key: EXT_KEY, value: String(extValue) }, oa, addressCandidates };
}
