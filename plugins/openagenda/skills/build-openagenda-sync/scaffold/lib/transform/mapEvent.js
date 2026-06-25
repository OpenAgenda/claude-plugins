import { EXT_KEY, SUBCATEGORY_TO_OA, ADDITIONAL_FIELD_DEFAULTS, SOURCE_PAGE_BASE } from './constants.js';
import { htmlToShortText, htmlToMarkdown } from './text.js';
import { firstImageUrl, splitList } from './media.js';
import buildTimings from './buildTimings.js';
import mapLocation from './mapLocation.js';

const isHttpUrl = (s) => /^https?:\/\/\S+$/i.test(s || '');
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

function slugifyTitle(title) {
  return String(title || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// The source often buries a contact email in free-text (price/description), not the
// email field. Search the likely fields in priority order.
function findEmail(event) {
  for (const f of [event.email, event.price, event.short_content, event.description, event.hours]) {
    const m = String(f || '').match(EMAIL_RE);
    if (m) return m[0];
  }
  return null;
}

function buildRegistration(event) {
  const reg = [];
  const link = isHttpUrl(event.reservation_link)
    ? event.reservation_link
    : (event.links || []).map((l) => l?.href).find(isHttpUrl);
  if (link) reg.push({ type: 'link', value: link });
  const email = findEmail(event);
  if (email) reg.push({ type: 'email', value: email });
  if (event.phones) {
    const digits = String(event.phones).replace(/\s+/g, '');
    if (/^[+0-9]{6,}$/.test(digits)) reg.push({ type: 'phone', value: digits });
  }
  // Fallback: always offer the source page so the event is actionable.
  if (!reg.length) {
    const slug = slugifyTitle(event.title);
    if (slug) reg.push({ type: 'link', value: `${SOURCE_PAGE_BASE}/${slug}` });
  }
  return reg;
}

export default function mapEvent(event, { lang = 'fr', poiMap } = {}) {
  const oa = {};
  oa.title = { [lang]: htmlToShortText(event.title, { maxLength: 140 }) };
  // Source splits the text across two complementary fields: short_content (intro)
  // and description (continuation). The short OA description is a teaser; the full
  // combined text goes to longDescription so nothing is lost.
  oa.description = { [lang]: htmlToShortText(event.short_content || event.description, { maxLength: 200 }) };
  const fullText = [event.short_content, event.description].filter(Boolean).join('');
  oa.longDescription = { [lang]: htmlToMarkdown(fullText, { maxLength: 10000 }) };
  const conditions = htmlToShortText(event.price, { maxLength: 1000 });
  if (conditions) oa.conditions = { [lang]: conditions };

  const { timings, warnings } = buildTimings(event, { defaultDurationS: 7200 });
  oa.timings = timings;
  oa.timezone = 'Europe/Paris';

  const image = firstImageUrl(event.media);
  if (image) oa._imageUrl = image;

  const location = mapLocation(event, { poiMap });
  oa.attendanceMode = 1; // Albi events are always onsite
  if (location) oa._location = location.extId;

  oa.registration = buildRegistration(event);

  // Additional fields: sensible defaults, then the per-sub-category correspondence
  // (first matching sub-category wins for these single-value radio fields).
  Object.assign(oa, ADDITIONAL_FIELD_DEFAULTS);
  for (const sid of splitList(event.sub_category)) {
    if (SUBCATEGORY_TO_OA[sid]) { Object.assign(oa, SUBCATEGORY_TO_OA[sid]); break; }
  }

  return {
    extId: { key: EXT_KEY, value: String(event.id) },
    oa,
    location,
    transform: { warnings, imageMissing: !image },
  };
}
