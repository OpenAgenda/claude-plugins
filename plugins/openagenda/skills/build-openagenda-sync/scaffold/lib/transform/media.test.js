import { describe, it, expect } from 'vitest';
import { splitList, firstImageUrl } from './media.js';

describe('splitList', () => {
  it('splits, trims and drops empties (trailing ;)', () => {
    expect(splitList('https://x/a.jpg;')).toEqual(['https://x/a.jpg']);
    expect(splitList('a;b ; ;c')).toEqual(['a', 'b', 'c']);
  });
  it('handles null/empty', () => {
    expect(splitList(null)).toEqual([]);
    expect(splitList('')).toEqual([]);
  });
});

describe('firstImageUrl', () => {
  it('strips the trailing semicolon and returns a usable URL', () => {
    expect(firstImageUrl('https://opendata.mairie-albi.fr/x/habitarn.jpg;'))
      .toBe('https://opendata.mairie-albi.fr/x/habitarn.jpg');
  });
  it('returns the first valid http url when several are present', () => {
    expect(firstImageUrl('not-a-url;https://x/b.png;')).toBe('https://x/b.png');
  });
  it('returns null when no usable url', () => {
    expect(firstImageUrl('')).toBeNull();
    expect(firstImageUrl(';')).toBeNull();
    expect(firstImageUrl('garbage')).toBeNull();
  });
});
