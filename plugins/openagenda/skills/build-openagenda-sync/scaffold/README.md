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
  → reconcile deletions from OA → save state; `--dry-run`/`--reconcile`/`--limit`).
- `lib/transform/{text,media,buildTimings}.js` — html→text/markdown, `;`-list +
  image-url cleanup, multi-day timing split.

## Rewrite per source
- `lib/AlbiSDK.js` → **your `SourceSDK.js`**: the source client (auth, fetch,
  pagination, lookup-table preloading). The exported `loadAll()` must return
  `{ events: [...], <lookupMaps> }`.
- `lib/transform/mapEvent.js` — assemble the OA event from a source record. Keep
  the shape `{ extId, oa, location, transform }`; keep the `_imageUrl` annotation
  (syncCore fetches + uploads it) and the registration URL validation.
- `lib/transform/mapLocation.js` — resolve the OA location (POI-first if your
  source references a venue table).
- `lib/transform/constants.js` — `EXT_KEY`, exclusion lists, category map.
- `lib/transform/filter.js` — publication/exclusion rules.
- `scripts/{downloadFixtures,analyzeSource,sync}.js` — change the dataset names
  and the SDK import; the sync.js adapter wiring is generic.

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
again (idempotency) → promote to production.

See the parent skill's `reference/pitfalls.md` before you start.
