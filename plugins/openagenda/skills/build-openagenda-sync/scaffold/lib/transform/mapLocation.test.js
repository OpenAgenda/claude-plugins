import { describe, it, expect } from 'vitest';
import mapLocation from './mapLocation.js';

const POI = {
  id: 'p1', title: 'Parc Castelnau',
  adress: '6 Avenue Maréchal Joffre, 81000 Albi, France',
  zipcode: '81000', city: 'Albi', latitude: 43.9225888, longitude: 2.1410245,
};

describe('mapLocation', () => {
  it('resolves location from the POI (canonical venue) keyed by poi_id', () => {
    const loc = mapLocation({ id: 'e1', poi_id: 'p1' }, { poiMap: new Map([['p1', POI]]) });
    expect(loc.extId).toEqual({ key: 'albi', value: 'p1' });
    expect(loc.oa.name).toBe('Parc Castelnau');
    expect(loc.oa.latitude).toBe(43.9225888);
    expect(loc.oa.postalCode).toBe('81000');
    expect(loc.oa.countryCode).toBe('FR');
  });
  it('falls back to the event embedded address when there is no POI', () => {
    const ev = {
      id: 'e2', adress: 'Chemin de la Baute, 81990 Le Sequestre, France',
      zipcode: '81990', city: 'Le Sequestre', latitude: 43.9171126, longitude: 2.1150066,
    };
    const loc = mapLocation(ev, { poiMap: new Map() });
    expect(loc.oa.name).toBe('Le Sequestre');
    expect(loc.oa.latitude).toBe(43.9171126);
    expect(loc.extId.value).toMatch(/^addr-/);
  });
  it('derives an addr- extId from address when poi_id is missing', () => {
    const loc = mapLocation({ id: 'e3', adress: 'X, 81000 Albi', zipcode: '81000', city: 'Albi' });
    expect(loc.extId.value).toMatch(/^addr-/);
  });
  it('returns null when neither the event nor its POI has a location', () => {
    expect(mapLocation({ id: 'x' })).toBeNull();
    expect(mapLocation({ id: 'x', poi_id: 'missing' }, { poiMap: new Map() })).toBeNull();
  });
});
