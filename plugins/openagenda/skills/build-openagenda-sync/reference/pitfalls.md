# Pitfalls (living log)

Read this before building. Each entry cost a real debugging session.

## OpenAgenda — token
- The write token endpoint is `POST /v2/requestAccessToken` with `{ code: secret }`,
  NOT `/v2/access-tokens` with a `grant_type` body. A mocked unit test that only
  checks the returned token will NOT catch a wrong endpoint — verify the token
  call against the live API once.

## OpenAgenda — images (the big one)
- OA fetches `image: { url }` server-side. If the source host blocks OA's fetcher,
  you get `400 image url.invalid` even though the URL is a valid image from your
  machine. Confirmed live: `opendata.mairie-albi.fr` images 200 for us, rejected
  by OA; Wikimedia/picsum control URLs attach fine.
- **Fix: fetch the bytes yourself and upload multipart** (`data` JSON + `image`
  file). Do not set `Content-Type` on the multipart request.
- `image` as a bare string is accepted but silently dropped (stays null).

## OpenAgenda — events read / pagination
- Read synced events with `?key=<secret>&state[]=2&detailed=1`, not the
  access-token header. The `after` cursor is an ARRAY → resend as `after[]=`.
  Terminate on `after` falsy OR `seen >= total` (cursor can stay truthy → infinite
  loop otherwise).

## OpenAgenda — additional fields
- Set them at the TOP LEVEL keyed by field name, with the option's NUMERIC `id`
  from the schema (`categories: 1`), not the slug. Sending the slug returns 200
  but silently drops the value. Read an event back to confirm a field populated.
- Populate OPTIONAL additional fields, not just mandatory ones — an agenda's
  "Type d'événement"/"Catégories"/"Type de public" left at "(Sans valeur)" is a
  visible quality gap. Search the source taxonomy for a correspondence; default
  where there is no signal (municipal agenda → "Tout public").

## OpenAgenda — structural validation
- Onsite events (`attendanceMode: 1`) REQUIRE a `locationUid` even though the
  schema lists no field as mandatory → `location.required`. Skip events with no
  resolvable location instead of erroring on every run.
- `registration` link values must be real URLs (`link.invalid` otherwise).
- Timings must be ≤ 24h each → split multi-day spans per day. Mind the DST
  fall-back day: a 00:00–23:59 local window really lasts 24h59 there and gets
  the whole event rejected (`diffExceeded`) — clamp each timing's real duration.
- Ext-id VALUES are capped at 100 chars (`string.toolong`). Derived values
  (e.g. `name|address` location keys) can exceed it — keep a readable prefix
  and append a hash of the full key.
- `setLocation` without coordinates 400s with "geocoder didn't find address"
  when the address doesn't resolve (source typos, venue names as addresses).
  Retry with fallback coordinates (e.g. the town centre) rather than losing
  every event at that venue.

## CKAN sources (Ville d'Albi)
- Private datasets need the JWT in the `Authorization` header. Resources are JSON
  files reached via `package_show` → `resources[0].url`, not the datastore API.
- Multi-value fields are `;`-separated and often carry a trailing `;`
  (`media`, `sub_category`). Split + trim; take the first valid value.
- Location lives on the POI table for most events (event carries only `poi_id`);
  the POI's venue name field is `title`. Resolve location POI-first.

## Source data quality (general)
- Don't trust a field's name — inspect values. Phone numbers appeared in a
  `links[].href`. Validate types before mapping (URL is a URL, email looks like
  an email).
- Check field coverage across the WHOLE snapshot, not the first record — the
  first record embedded an address; 70% of the rest did not.
- **Decode HTML entities with a real decoder** (`he.decode`), not a hand-rolled
  table — French text is full of `&rsquo;` `&eacute;` `&euro;` `&hellip;` etc. A
  partial table silently leaves `d&rsquo;audace` in the published description.
- **Contact info hides in free text.** An event's email/phone may be absent from
  the dedicated field and buried in the price/description HTML (e.g. "Réservation :
  x@y.com" inside `price`). Regex-extract from the likely text fields, and as a
  last resort link to the source's public event page (slugified title — verify the
  slug pattern resolves) so every event is actionable.

## Logging (`@openagenda/logs`)
- `logs.init()` must run BEFORE any `logs('namespace')` call. Namespaced loggers
  snapshot the transport config at creation — a module-level `const log =
  logs('sync')` created pre-init logs nowhere. Fix: a dedicated `lib/logger.js`
  that inits and re-exports; every module imports that, never the lib directly.
- The `enableDebug` init flag is silently broken with `debug` >= 4.4 (the lib
  pushes RegExps into `debug.names`; debug 4.4 matches string templates only).
  Call `debug.enable('<prefix>*')` yourself when `DEBUG` is unset — otherwise a
  local run prints nothing and looks hung.
- The console transport DROPS `meta.error` when the meta object has other keys
  (`{ extId, error }` displays only `{ extId }`). Put `err.message` in the
  message text AND the `Error` in meta: console stays readable, InsightOps gets
  the structured error + stack.
- With `LOGS_TOKEN` set, the InsightOps socket keeps the process alive ~15 s
  after the last line (inactivity close). Harmless under cron; do NOT
  `process.exit()` right after logging — you'd lose the unflushed buffer.

## Tooling
- Yarn 4 defaults to PnP, which trips Vitest's ESM resolution. Add
  `.yarnrc.yml` with `nodeLinker: node-modules` for a self-contained project.
- Pass a filesystem PATH (via `fileURLToPath`) to the state file, not a `URL`
  object — `${urlObject}.tmp` becomes an unopenable `file://…` string.
- `UID` is a reserved shell variable; don't use it as a bash var name.
