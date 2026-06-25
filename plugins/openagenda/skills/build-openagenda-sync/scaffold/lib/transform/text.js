import TurndownService from 'turndown';
import he from 'he';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

function truncate(s, maxLength) {
  if (!maxLength || s.length <= maxLength) return s;
  const slice = s.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd() + '…';
}

export function htmlToShortText(html, { maxLength } = {}) {
  if (!html) return '';
  const text = he.decode(String(html).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return truncate(text, maxLength);
}

export function htmlToMarkdown(html, { maxLength } = {}) {
  if (!html) return '';
  const md = turndown.turndown(String(html)).trim();
  return truncate(md, maxLength);
}
