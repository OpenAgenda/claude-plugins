import TurndownService from 'turndown';
import he from 'he';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
turndown.remove(['style', 'script', 'head', 'title']);

// Content pasted from Word/Outlook into municipal CMSes carries <style> (and
// sometimes <script>) blocks whose TEXT would survive naive tag-stripping and
// leak CSS into descriptions. Drop those elements with their content, plus HTML
// comments, before any text extraction. The regex pre-strip also covers input
// too malformed for a parser to place correctly (e.g. <style> nested in <p>).
function dropNonContent(html) {
  return String(html)
    .replace(/<(style|script|head|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function truncate(s, maxLength) {
  if (!maxLength || s.length <= maxLength) return s;
  const slice = s.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd() + '…';
}

export function htmlToShortText(html, { maxLength } = {}) {
  if (!html) return '';
  const text = he.decode(dropNonContent(html).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return truncate(text, maxLength);
}

export function htmlToMarkdown(html, { maxLength } = {}) {
  if (!html) return '';
  const md = turndown.turndown(dropNonContent(html)).trim();
  return truncate(md, maxLength);
}
