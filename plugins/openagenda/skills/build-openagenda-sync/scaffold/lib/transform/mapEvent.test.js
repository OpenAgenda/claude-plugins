import { describe, it, expect } from 'vitest';
import mapEvent from './mapEvent.js';

const EVENT = {
  id: '9d14c836-af45-4df1-9707-95399d0545b9',
  title: "Habitarn : l'immobilier",
  short_content: '<p>Le rendez-vous incontournable.</p>',
  description: '<p>Venez d&eacute;couvrir <strong>160 exposants</strong>.</p>',
  start: '2026-10-16T08:00:00.000Z', end: '2026-10-16T16:00:00.000Z',
  adress: 'Chemin de la Baute, 81990 Le Sequestre, France',
  zipcode: '81990', city: 'Le Sequestre', latitude: 43.9171126, longitude: 2.1150066,
  poi_id: 'p1', media: 'https://opendata.mairie-albi.fr/x/habitarn.jpg;',
  links: [{ href: 'https://www.habitarn.net/', content: "PLUS D'INFOS" }],
  reservation_link: null, email: 'contact@albiexpos.fr', phones: '05 63 49 28 40',
};

describe('mapEvent', () => {
  it('produces an ext-id keyed on the source uuid', () => {
    const { extId } = mapEvent(EVENT);
    expect(extId).toEqual({ key: 'albi', value: EVENT.id });
  });
  it('maps localized title and descriptions', () => {
    const { oa } = mapEvent(EVENT);
    expect(oa.title.fr).toBe("Habitarn : l'immobilier");
    expect(oa.description.fr).toBe('Le rendez-vous incontournable.');
    expect(oa.longDescription.fr).toContain('**160 exposants**');
  });
  it('cleans the image URL (strips trailing ;)', () => {
    const { oa } = mapEvent(EVENT);
    expect(oa._imageUrl).toBe('https://opendata.mairie-albi.fr/x/habitarn.jpg');
  });
  it('builds timings and an onsite attendance mode with a location annotation', () => {
    const { oa, location } = mapEvent(EVENT);
    expect(oa.timings).toHaveLength(1);
    expect(oa.attendanceMode).toBe(1);
    expect(location.extId.key).toBe('albi');
    expect(oa._location).toEqual(location.extId);
  });
  it('adds a registration link from links/reservation', () => {
    const { oa } = mapEvent(EVENT);
    expect(oa.registration.some((r) => r.type === 'link' && r.value === 'https://www.habitarn.net/')).toBe(true);
  });
  it('ignores a non-URL (phone) in links and does not emit it as a registration link', () => {
    const { oa } = mapEvent({ ...EVENT, reservation_link: null, links: [{ href: '06 21 43 04 55' }] });
    expect(oa.registration.some((r) => r.type === 'link')).toBe(false);
  });
  it('maps additional fields (type d\'événement, catégories) from sub_category + tout-public default', () => {
    const { oa } = mapEvent({ ...EVENT, sub_category: '9d0c194a-1d67-491a-85e6-7f5102d3ebf4' }); // Salon / foire
    expect(oa['type-devenement']).toBe(13);
    expect(oa.categories).toBe(4);
    expect(oa['type-de-public']).toBe(10);
  });
  it('applies the tout-public default and no type/category when the sub_category is unmapped', () => {
    const { oa } = mapEvent({ ...EVENT, sub_category: 'unknown-id' });
    expect(oa['type-de-public']).toBe(10);
    expect(oa['type-devenement']).toBeUndefined();
    expect(oa.categories).toBeUndefined();
  });
  it('maps price (decoded) into the multilingual conditions field', () => {
    const { oa } = mapEvent({ ...EVENT, price: '<p>8&euro; et 10&euro;</p>' });
    expect(oa.conditions).toEqual({ fr: '8€ et 10€' });
  });
  it('extracts a contact email buried in the price text', () => {
    const { oa } = mapEvent({ ...EVENT, email: null, phones: null, reservation_link: null, links: [], price: '<p>Réservation : actal.lefrigo@gmail.com</p>' });
    expect(oa.registration).toContainEqual({ type: 'email', value: 'actal.lefrigo@gmail.com' });
  });
  it('falls back to the source page link when no contact info exists', () => {
    const { oa } = mapEvent({ ...EVENT, title: 'Déraisonnable : la bipolarité', email: null, phones: null, reservation_link: null, links: [], price: 'Gratuit' });
    expect(oa.registration).toContainEqual({ type: 'link', value: 'https://albi.fr/que-faire-a-albi/agenda/deraisonnable-la-bipolarite' });
  });
  it('puts the full combined text (short_content + description) in longDescription so nothing is lost', () => {
    const { oa } = mapEvent({ ...EVENT, short_content: '<p>Part one intro.</p>', description: '<p>Part two body.</p>' });
    expect(oa.longDescription.fr).toContain('Part one intro.');
    expect(oa.longDescription.fr).toContain('Part two body.');
  });
  it('uses short_content for longDescription when description is absent', () => {
    const { oa } = mapEvent({ ...EVENT, short_content: '<p>Only intro here.</p>', description: null });
    expect(oa.longDescription.fr).toContain('Only intro here.');
  });
});
