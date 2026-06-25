import { describe, it, expect } from 'vitest';
import { htmlToMarkdown, htmlToShortText } from './text.js';

describe('htmlToShortText', () => {
  it('strips tags and decodes entities', () => {
    expect(htmlToShortText('<p>Salon Habitarn &amp; co</p>')).toBe('Salon Habitarn & co');
  });
  it('collapses whitespace from \\r\\n blocks', () => {
    expect(htmlToShortText('<p>a</p>\r\n<p>&nbsp;</p>\r\n<p>b</p>')).toBe('a b');
  });
  it('truncates on a word boundary with an ellipsis', () => {
    const out = htmlToShortText('<p>one two three four five</p>', { maxLength: 12 });
    expect(out).toBe('one two…');
    expect(out.length).toBeLessThanOrEqual(12);
  });
  it('returns empty string for falsy input', () => {
    expect(htmlToShortText(null)).toBe('');
  });
  it('decodes named typographic entities (rsquo, euro)', () => {
    expect(htmlToShortText('<p>d&rsquo;audace</p>')).toBe('d’audace');
    expect(htmlToShortText('<p>8&euro; et 10&euro;</p>')).toBe('8€ et 10€');
  });
});

describe('htmlToMarkdown', () => {
  it('converts basic markup', () => {
    expect(htmlToMarkdown('<p>Hello <strong>world</strong></p>')).toBe('Hello **world**');
  });
  it('returns empty string for falsy input', () => {
    expect(htmlToMarkdown('')).toBe('');
  });
});
