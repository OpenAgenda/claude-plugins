import { describe, it, expect } from 'vitest';
import { makeSubcategoryFilter } from './filter.js';
import { EXCLUDED_SUBCATEGORIES } from './constants.js';

const keep = makeSubcategoryFilter(EXCLUDED_SUBCATEGORIES);

describe('makeSubcategoryFilter', () => {
  it('keeps events not in the excluded sub-categories', () => {
    expect(keep({ sub_category: '9d0c194a-1d67-491a-85e6-7f5102d3ebf4' })).toBe(true);
  });
  it('drops events whose multi-valued sub_category contains an excluded id', () => {
    expect(keep({ sub_category: '9d0c194a-d274-49f8-97e1-b93fd0f42274' })).toBe(false);
    expect(keep({ sub_category: 'x;9d0c194a-d274-49f8-97e1-b93fd0f42274;y' })).toBe(false);
  });
  it('keeps events with empty/missing sub_category', () => {
    expect(keep({ sub_category: null })).toBe(true);
    expect(keep({})).toBe(true);
  });
  it('excludes an event whose VENUE (POI) is a maison de quartier, even if the event is untagged', () => {
    const poiMap = new Map([['p-mdq', { id: 'p-mdq', sub_category: '9d0c194a-d274-49f8-97e1-b93fd0f42274' }]]);
    expect(keep({ sub_category: 'something-else', poi_id: 'p-mdq' }, poiMap)).toBe(false);
  });
  it('keeps an event held at a non-maison-de-quartier venue', () => {
    const poiMap = new Map([['p-ok', { id: 'p-ok', sub_category: 'whatever' }]]);
    expect(keep({ sub_category: 'ok', poi_id: 'p-ok' }, poiMap)).toBe(true);
  });
});
