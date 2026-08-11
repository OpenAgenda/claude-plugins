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

// Source fields are not always HTML: plain-text titles and descriptions must
// not be tag-stripped (a literal "<3" or "<seniors>" would vanish) nor go
// through turndown (which collapses their newlines and escapes markdown
// characters). Only treat input as HTML when it carries a real-looking tag.
const looksLikeHtml = (s) => /<([a-z][a-z0-9-]*)(\s[^>]*)?\/?>/i.test(s);

function truncate(s, maxLength) {
  if (!maxLength || s.length <= maxLength) return s;
  const slice = s.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd() + '…';
}

export function htmlToShortText(html, { maxLength } = {}) {
  if (!html) return '';
  const s = String(html);
  const stripped = looksLikeHtml(s) ? dropNonContent(s).replace(/<[^>]*>/g, ' ') : s;
  const text = he.decode(stripped)
    .replace(/\s+/g, ' ')
    .trim();
  return truncate(text, maxLength);
}

export function htmlToMarkdown(html, { maxLength } = {}) {
  if (!html) return '';
  const s = String(html);
  // Plain text passes through with entities decoded and newlines normalised —
  // its line structure IS its formatting, which turndown would destroy.
  const md = looksLikeHtml(s)
    ? turndown.turndown(dropNonContent(s)).trim()
    : he.decode(s).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return truncate(md, maxLength);
}
