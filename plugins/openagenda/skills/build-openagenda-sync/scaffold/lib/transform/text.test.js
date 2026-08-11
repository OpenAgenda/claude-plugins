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

describe('plain-text input (no tags)', () => {
  it('htmlToShortText keeps literal angle brackets and text intact', () => {
    expect(htmlToShortText('REPAS <SENIORS> & Cie')).toBe('REPAS <SENIORS> & Cie');
  });
  it('htmlToMarkdown preserves line structure and markdown characters', () => {
    expect(htmlToMarkdown('ligne 1\r\nligne 2\r\n\r\n\r\ntarif : 5*3 €_TTC'))
      .toBe('ligne 1\nligne 2\n\ntarif : 5*3 €_TTC');
  });
  it('still decodes entities in plain text', () => {
    expect(htmlToMarkdown('d&rsquo;audace')).toBe('d’audace');
  });
  it('drops style blocks with their content when input IS html', () => {
    expect(htmlToShortText('<p><style>a { color: red; }</style>Contenu</p>')).toBe('Contenu');
    expect(htmlToMarkdown('<style>a { color: red; }</style><h3>Titre</h3>')).toBe('### Titre');
  });
});
