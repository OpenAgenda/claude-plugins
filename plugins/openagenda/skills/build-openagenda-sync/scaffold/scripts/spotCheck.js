// Step-4 quality control: mechanizes the data-gathering half of the
// published-vs-source comparison (see the parent skill's
// reference/quality-control.md). Builds an edge-biased sample from the
// fixtures snapshot, reads the published events back from OpenAgenda, and
// emits a side-by-side QC.md whose verdicts a human fills in. It gathers;
// it does not judge.
//
// Usage: node --env-file=.env scripts/spotCheck.js [--test] [--sample=N] [--out=path]
// Requires fixtures (run "yarn download" first) and a completed sync run.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mapEvent, { slugifyTitle } from '../lib/transform/mapEvent.js';
import { makeSubcategoryFilter } from '../lib/transform/filter.js';
import {
  EXT_KEY, EXCLUDED_SUBCATEGORIES, SUBCATEGORY_TO_OA, ADDITIONAL_FIELD_DEFAULTS, SOURCE_PAGE_BASE,
} from '../lib/transform/constants.js';
import { mergeSourceEvents } from '../lib/transform/mergeEvents.js';
import { splitList } from '../lib/transform/media.js';
import listAllAgendaEvents from '../utils/oa/listAllAgendaEvents.js';

const LANG = 'fr';

// Additional-field names this sync writes (defaults ∪ correspondence targets).
export const ADDITIONAL_FIELD_NAMES = [...new Set([
  ...Object.keys(ADDITIONAL_FIELD_DEFAULTS),
  ...Object.values(SUBCATEGORY_TO_OA).flatMap((m) => Object.keys(m)),
])];

// --- candidates: replay the sync's own path over the snapshot ----------------

// Mirrors syncCore's merge → filter → map → skip decisions so the sample and
// the reconciliation count exactly what the sync would publish.
export function buildCandidates(source) {
  const keep = makeSubcategoryFilter(EXCLUDED_SUBCATEGORIES);
  const merged = mergeSourceEvents(source.events);
  const out = { candidates: [], sourceTotal: source.events.length, mergedCount: merged.length, excluded: 0, skipped: 0 };
  for (const raw of merged) {
    if (!keep(raw, source.poiMap)) { out.excluded += 1; continue; }
    const mapped = mapEvent(raw, { poiMap: source.poiMap });
    if (!mapped.oa.timings?.length || (mapped.oa.attendanceMode === 1 && !mapped.location)) {
      out.skipped += 1;
      continue;
    }
    out.candidates.push({ raw, mapped });
  }
  return out;
}

// --- traits: which risky transform paths did this event exercise? ------------
// Adapt per source — these are the Albi worked example's paths.

export function tagTraits({ raw, mapped }) {
  const { oa, location, transform } = mapped;
  const traits = [];
  if ((raw._occurrenceCount || 1) > 1) traits.push('multi-occurrence');
  if (location) traits.push(raw.poi_id ? 'poi-location' : 'embedded-address');
  traits.push(oa._imageUrl ? 'image' : 'no-image');
  if ((oa.timings?.length || 0) > (raw.occurrences?.length || 1)) traits.push('split-multi-day');
  if ((oa.registration || []).some((r) => r.type === 'link' && String(r.value).startsWith(SOURCE_PAGE_BASE))) {
    traits.push('fallback-registration');
  }
  if (!splitList(raw.sub_category).some((id) => SUBCATEGORY_TO_OA[id])) traits.push('defaulted-fields');
  if (transform?.warnings?.length) traits.push('transform-warnings');
  return traits;
}

const htmlWeight = (raw) => (String(raw.short_content || '') + String(raw.description || '')).match(/<[a-z][^>]*>/gi)?.length || 0;
const descLength = (c) => (c.mapped.oa.longDescription?.[LANG] || '').length;

// Traits that make an event "interesting"; an event with none is the control.
const DISTINGUISHING = ['multi-occurrence', 'split-multi-day', 'fallback-registration', 'defaulted-fields', 'transform-warnings', 'no-image'];
export const TRAIT_PRIORITY = [
  'multi-occurrence', 'poi-location', 'embedded-address', 'split-multi-day',
  'fallback-registration', 'defaulted-fields', 'no-image', 'transform-warnings', 'image',
];

// One event per trait (superlatives first), one control, capped at `size`.
// Deterministic: same snapshot → same sample.
export function buildSample(candidates, { size = 12 } = {}) {
  const tagged = candidates.map((c) => ({ ...c, traits: tagTraits(c) }));
  const heaviest = [...tagged].sort((a, b) => htmlWeight(b.raw) - htmlWeight(a.raw))[0];
  if (heaviest && htmlWeight(heaviest.raw) > 0) heaviest.traits.push('html-heavy-description');
  const longest = [...tagged].sort((a, b) => descLength(b) - descLength(a))[0];
  if (longest && descLength(longest) > 0) longest.traits.push('longest-description');

  const sample = [];
  const pick = (c) => { if (c && !sample.includes(c) && sample.length < size) sample.push(c); };
  for (const trait of ['html-heavy-description', 'longest-description', ...TRAIT_PRIORITY]) {
    pick(tagged.find((c) => c.traits.includes(trait) && !sample.includes(c)));
  }
  const control = tagged
    .filter((c) => !sample.includes(c))
    .sort((a, b) => a.traits.filter((t) => DISTINGUISHING.includes(t)).length - b.traits.filter((t) => DISTINGUISHING.includes(t)).length)[0];
  if (control) { control.traits.push('control'); pick(control); }
  return sample;
}

// --- reconciliation: does N source records → M published events add up? ------

export function reconcile(counts, published) {
  const expectedIds = new Set(counts.candidates.map((c) => c.mapped.extId.value));
  const publishedIds = new Set(published.map((p) => p.extId.value));
  return {
    sourceRecords: counts.sourceTotal,
    mergedEvents: counts.mergedCount,
    excludedByFilter: counts.excluded,
    skippedUnmappable: counts.skipped,
    expectedPublished: expectedIds.size,
    actuallyPublished: publishedIds.size,
    missingOnOA: [...expectedIds].filter((id) => !publishedIds.has(id)),
    unexpectedOnOA: [...publishedIds].filter((id) => !expectedIds.has(id)),
  };
}

// --- side-by-side rows -------------------------------------------------------

const ml = (v) => (v && typeof v === 'object' ? v[LANG] : v) ?? '';
const cell = (v) => String(v ?? '—').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '—';
const excerpt = (s, n = 120) => (String(s || '').length > n ? `${String(s).slice(0, n)}…` : String(s || ''));
const fmtReg = (reg) => (reg || []).map((r) => `${r.type}:${r.value}`).join(' ');

export function buildComparison({ mapped }, published) {
  const { oa, location } = mapped;
  const p = published || {};
  const rows = [
    ['title', ml(oa.title), ml(p.title)],
    ['description', excerpt(ml(oa.description)), excerpt(ml(p.description))],
    ['longDescription (chars)', String(ml(oa.longDescription).length), String(ml(p.longDescription).length)],
    ['timings (count)', String(oa.timings?.length || 0), String(p.timings?.length || 0)],
    ['first timing', oa.timings?.[0]?.begin, p.timings?.[0]?.begin],
    ['last timing', oa.timings?.at(-1)?.end, p.timings?.at(-1)?.end],
    ['location name', location?.oa.name, p.location?.name],
    ['location address', location?.oa.address, [p.location?.address, p.location?.postalCode, p.location?.city].filter(Boolean).join(', ')],
    ['coordinates', location?.oa.latitude != null ? `${location.oa.latitude}, ${location.oa.longitude}` : null,
      p.location?.latitude != null ? `${p.location.latitude}, ${p.location.longitude}` : null],
    ['image', oa._imageUrl, p.image?.filename || (p.image ? 'yes' : null)],
    ['registration', fmtReg(oa.registration), fmtReg(p.registration)],
    ['conditions', excerpt(ml(oa.conditions)), excerpt(ml(p.conditions))],
    ...ADDITIONAL_FIELD_NAMES.map((f) => [f, oa[f], Array.isArray(p[f]) ? p[f].join(',') : p[f]]),
  ];
  return rows.map(([field, local, pub]) => ({ field, local: cell(local), published: cell(pub) }));
}

// --- report ------------------------------------------------------------------

export function renderReport({ agendaUID, baseline, recon, sections, generatedAt }) {
  const lines = [];
  lines.push('# QC — published vs source spot check');
  lines.push('');
  lines.push(`Agenda \`${agendaUID}\` · generated ${generatedAt} by \`scripts/spotCheck.js\`.`);
  lines.push(`Baseline: ${baseline}. The "synced" column is the local transform's output over the`);
  lines.push('fixtures snapshot — if the source moved since `yarn download`, refresh fixtures first.');
  lines.push('');
  lines.push('Fill in a verdict per event (see `reference/quality-control.md`): **OK** /');
  lines.push('**sync bug** (fix, re-run, re-check) / **source data issue** (report upstream) /');
  lines.push('**accepted transform choice** (document). Open the published and source pages —');
  lines.push('image correctness, map pin placement and text fidelity need eyes, not diffs.');
  lines.push('');
  lines.push('## Reconciliation');
  lines.push('');
  lines.push('| | count |');
  lines.push('|---|---|');
  lines.push(`| source records | ${recon.sourceRecords} |`);
  lines.push(`| merged events | ${recon.mergedEvents} |`);
  lines.push(`| excluded by filter | ${recon.excludedByFilter} |`);
  lines.push(`| skipped (unmappable) | ${recon.skippedUnmappable} |`);
  lines.push(`| **expected published** | **${recon.expectedPublished}** |`);
  lines.push(`| **actually published** | **${recon.actuallyPublished}** |`);
  const list = (ids) => ids.slice(0, 20).map((id) => `\`${id}\``).join(', ') + (ids.length > 20 ? ` … +${ids.length - 20}` : '');
  if (recon.missingOnOA.length) lines.push(`\n⚠ expected but missing on OA: ${list(recon.missingOnOA)}`);
  if (recon.unexpectedOnOA.length) lines.push(`\n⚠ published but not expected from this snapshot: ${list(recon.unexpectedOnOA)}`);
  if (!recon.missingOnOA.length && !recon.unexpectedOnOA.length) lines.push('\n✓ published set matches the snapshot exactly.');
  lines.push('');
  lines.push(`## Sample (${sections.length} events, edge-biased)`);
  lines.push('');
  for (const [i, s] of sections.entries()) {
    lines.push(`### ${i + 1}. \`${s.extId}\` — ${s.title || '(untitled)'}`);
    lines.push('');
    lines.push(`Traits: ${s.traits.join(', ')}`);
    lines.push(`- Published: ${s.publishedUrl || `not found on OA (uid ${s.uid || '?'}) — see reconciliation`}`);
    lines.push(`- Source: ${s.sourceUrl || 'no public page known — compare against the fixtures record'}`);
    lines.push('');
    if (s.rows) {
      lines.push('| field | synced (local transform) | published (read-back) |');
      lines.push('|---|---|---|');
      for (const r of s.rows) lines.push(`| ${r.field} | ${r.local} | ${r.published} |`);
    } else {
      lines.push('_Not found in the published read-back — verdict is almost certainly **sync bug** unless deliberately skipped._');
    }
    lines.push('');
    lines.push('Verdict: [ ] OK · [ ] sync bug · [ ] source data issue · [ ] accepted transform choice');
    lines.push('Notes:');
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

// --- CLI ---------------------------------------------------------------------

function loadFixture(name) {
  const path = new URL(`../fixtures/${name}.json`, import.meta.url);
  if (!existsSync(path)) throw new Error(`Missing fixture ${name}; run "yarn download" first`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function indexById(obj) {
  const map = new Map();
  for (const item of (Array.isArray(obj) ? obj : Object.values(obj || {}))) {
    if (item && item.id) map.set(item.id, item);
  }
  return map;
}

// Best-effort public URL for the agenda's events (openagenda.com/<agenda>/events/<slug>).
async function fetchAgendaSlug({ secret, agendaUID }) {
  try {
    const res = await fetch(`https://api.openagenda.com/v2/agendas/${agendaUID}?key=${encodeURIComponent(secret)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.slug || json?.agenda?.slug || null;
  } catch {
    return null;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = new Set(process.argv.slice(2));
  const useTest = args.has('--test');
  const agendaUID = useTest ? process.env.TEST_AGENDA_UID : process.env.AGENDA_UID;
  const secret = useTest ? process.env.TEST_API_SECRET : process.env.API_SECRET;
  if (!agendaUID || !secret) throw new Error('AGENDA_UID / API_SECRET missing (use --test for the test agenda)');
  const size = Number([...args].map((a) => a.match(/^--sample=(\d+)$/)).find(Boolean)?.[1]) || 12;
  const outFile = [...args].map((a) => a.match(/^--out=(.+)$/)).find(Boolean)?.[1]
    || fileURLToPath(new URL('../QC.md', import.meta.url));

  const evRaw = loadFixture('evenements');
  const source = {
    events: Array.isArray(evRaw) ? evRaw : Object.values(evRaw),
    poiMap: indexById(loadFixture('poi')),
  };

  const counts = buildCandidates(source);
  const sample = buildSample(counts.candidates, { size });
  const published = await listAllAgendaEvents({ secret, agendaUID }, { extKey: EXT_KEY, includeEvent: true });
  const byExtId = new Map(published.map((p) => [p.extId.value, p]));
  const agendaSlug = await fetchAgendaSlug({ secret, agendaUID });

  const sections = sample.map((c) => {
    const pub = byExtId.get(c.mapped.extId.value);
    const slug = slugifyTitle(c.raw.title);
    return {
      extId: c.mapped.extId.value,
      uid: pub?.uid,
      title: c.mapped.oa.title?.[LANG],
      traits: c.traits,
      publishedUrl: pub && agendaSlug && pub.event?.slug
        ? `https://openagenda.com/${agendaSlug}/events/${pub.event.slug}` : null,
      sourceUrl: slug ? `${SOURCE_PAGE_BASE}/${slug}` : null,
      rows: pub ? buildComparison(c, pub.event) : null,
    };
  });

  const recon = reconcile(counts, published);
  const report = renderReport({
    agendaUID,
    baseline: `source public pages under ${SOURCE_PAGE_BASE} (fixtures record as fallback)`,
    recon,
    sections,
    generatedAt: new Date().toISOString(),
  });
  writeFileSync(outFile, report);

  console.log(JSON.stringify({
    reconciliation: { ...recon, missingOnOA: recon.missingOnOA.length, unexpectedOnOA: recon.unexpectedOnOA.length },
    sample: sections.map((s) => ({ extId: s.extId, traits: s.traits, published: Boolean(s.rows) })),
    report: outFile,
  }, null, 2));
  console.log(`\nQC report written to ${outFile} — review each event and fill in the verdicts.`);
}
