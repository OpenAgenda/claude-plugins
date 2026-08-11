# Scaffold — OpenAgenda sync starting point

This is the **albigeois sync as a complete, working reference** (Ville d'Albi
CKAN → OpenAgenda). Copy this directory into a new project, then adapt the
source-specific pieces. Everything here runs and is tested (`yarn test`).

## Copy verbatim — generic, rarely change
- `utils/oa/*` — token, setEvent (incl. **multipart image upload**), setLocation,
  removeAgendaEvent, listAllAgendaEvents (key-param read + `after[]` pagination),
  getAgendaSchema, fetchImage.
- `lib/state.js` — stateful registry (load/getBucket/save/contentHash).
- `lib/syncCore.js` — orchestrator (filter → map → upsert location → upsert event
  → reconcile deletions from OA → save state; `--dry-run`/`--reconcile`/`--limit`),
  instrumented per `reference/logging.md` (reasoned line for every drop/write/
  deletion/error, keyed by ext-id).
- `lib/logger.js` — `@openagenda/logs` init (console on by default, InsightOps
  when `LOGS_TOKEN` is set). Only the `PREFIX` constant changes per project.
- `lib/transform/{text,media,buildTimings}.js` — html→text/markdown, `;`-list +
  image-url cleanup, multi-day timing split.

## Rewrite per source
- `lib/SourceSDK.js` — **the source-client seam** the scripts import. It ships
  re-exporting `lib/AlbiSDK.js` (the Albi implementation, kept as a worked
  example) so everything runs out of the box. Replace the re-export with your
  own client (auth, fetch, pagination, lookup-table preloading); the exported
  factory's `loadAll()` must return `{ events: [...], <lookupMaps> }`.
- `lib/transform/mapEvent.js` — assemble the OA event from a source record. Keep
  the shape `{ extId, oa, location, transform }`; keep the `_imageUrl` annotation
  (syncCore fetches + uploads it) and the registration URL validation.
- `lib/transform/mapLocation.js` — resolve the OA location (POI-first if your
  source references a venue table).
- `lib/transform/constants.js` — `EXT_KEY`, exclusion lists, category map.
- `lib/transform/filter.js` — publication/exclusion rules.
- `scripts/{downloadFixtures,analyzeSource,sync,spotCheck}.js` — change the
  dataset names and the SDK import; the sync.js adapter wiring is generic. In
  `spotCheck.js` also adapt `tagTraits` (which risky transform paths exist for
  YOUR source) and the compared fields.
- If the Step-1 scraping gap evaluation said yes: the scraper is an enrichment
  step in your `SourceSDK.js`, its pages snapshotted into `fixtures/` like every
  other read, and fetched incrementally at sync time (new/changed events only).

## Wiring the sync.js adapter (the one integration seam)
`syncCore` is pure and takes an injected `oa` adapter:
```js
const oa = {
  upsertLocation: (loc) => setLocation(ctx, loc.extId.key, loc.extId.value, loc.oa).then(l => l.uid),
  upsertEvent: async (value, payload, imageUrl) => {
    const image = imageUrl ? await fetchImage(imageUrl) : null;   // upload bytes, not a URL
    return setEvent(ctx, EXT_KEY, value, payload, image);
  },
  removeEvent: (value) => removeAgendaEvent(ctx, EXT_KEY, value),
  listSynced: () => listAllAgendaEvents({ secret: process.env.API_SECRET, agendaUID }, { extKey: EXT_KEY }),
};
```

## First run
`yarn install` → `yarn download` → `yarn analyze` → `node --env-file=.env scripts/sync.js --dry-run`
→ `… --limit=5` (to a **test** agenda) → verify in the OA admin → full run → run
again (idempotency) → quality control: `yarn qc --test` generates `QC.md` (an
edge-biased sample of published events paired side-by-side with the source —
see the parent skill's `reference/quality-control.md`), review it and fill in
the verdicts → promote to production.

## Logging
All diagnostics go through `lib/logger.js` (`@openagenda/logs`). Console output
is on by default (`DEBUG=albi-sync:*` to narrow it); set `LOGS_TOKEN` in
production to ship `info`+ to InsightOps (EU) as structured, LEQL-queryable
JSON. What to log and why: the parent skill's `reference/logging.md`.

See the parent skill's `reference/pitfalls.md` before you start.
