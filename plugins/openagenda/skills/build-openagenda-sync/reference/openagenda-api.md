# OpenAgenda API reference (for syncs)

## Auth — token exchange (write)
Writes use a short-lived access token obtained from the `oa_sk_…` secret:

```
POST https://api.openagenda.com/v2/requestAccessToken
Content-Type: application/json
{ "code": "<API_SECRET>" }
→ { "access_token": "tk-…", "expires_in": 3600 }
```

- It is **NOT** `/v2/access-tokens` and **NOT** a `grant_type` OAuth body — that
  endpoint returns `{"error":"access token is invalid"}`. (A mocked test will not
  catch this; always verify the token call live once.)
- Send the token on write requests as the **`access-token`** header (not
  `Authorization`). Cache it (~1h).

## Upsert by external id (idempotent)
```
PUT  https://api.openagenda.com/v2/agendas/{agendaUID}/events/ext/{key}/{value}
PUT  https://api.openagenda.com/v2/agendas/{agendaUID}/locations/ext/{key}/{value}
DELETE …/events/ext/{key}/{value}
```
`{key}` is your source constant (e.g. `albi`), `{value}` the source id. Header
`access-token`. Body is the OA event/location JSON. Upsert a location first, then
set the event's `locationUid` to the returned `location.uid`.

## Image — UPLOAD THE BYTES, don't pass a URL
OpenAgenda fetches `image: { url }` server-side. If the source server blocks OA's
fetcher (rate-limit, user-agent, IP), OA returns
`400 { field: "image", code: "url.invalid" }` even for a URL that resolves to a
valid image from your machine. (Confirmed with Albi's opendata server: our fetch
200s, OA rejects; a Wikimedia/picsum control URL attaches fine.)

Robust fix — fetch the bytes yourself and upload them multipart:
```
PUT …/events/ext/{key}/{value}
  headers: { 'access-token': AT }          // NO Content-Type — let FormData set the boundary
  body: FormData { data: JSON.stringify(event), image: <Blob>, filename }
```
On read-back the event then carries `image: { filename, base, size, variants }`
hosted on `cdn.openagenda.com`. See `scaffold/utils/oa/fetchImage.js` +
`setEvent.js`. Passing the image as a bare string is accepted but **silently
dropped** (image stays null) — do not rely on it.

## Events read-back (for deletion reconcile)
Read your synced events with the **public key** param + published-state filter,
not the access-token header:
```
GET …/agendas/{uid}/events?key=<API_SECRET>&size=100&detailed=1&state[]=2&after[]=…
```
- The `after` cursor is an **array**; resend it as repeated `after[]=` params.
- Terminate when `after` is falsy **or** `seen >= total` (the cursor can stay
  truthy past the last page → guard against an infinite loop).
- Collect `extIds` where `key === EXT_KEY`. Reconcile deletions against THIS set
  (live OA), never the local registry — a lost registry must not orphan/mass-delete.

## Schema discovery (Step 2)
The authoritative event form schema comes from the v3 client:
```
oa.agendas.events.schema({ path: { agendaUid } })   // @openagenda/api-client (Bearer auth, v3)
→ { fields: [ { field, fieldType, optional, options, schemaId, … } ] }
```
`optional: false` means required; `schemaId != null` marks an agenda additional
field. The raw v2 `/agendas/{uid}/schema` returns only `{ info }` — not the field
list; `getAgendaSchema.js` is a thin best-effort helper, not the real schema source.

## Additional fields (write)
Agenda additional fields (schema `schemaType` ≠ `event`) are set at the **top
level** of the event payload, keyed by the field name, with the option's
**numeric `id`** — NOT the slug, NOT nested under `additionalFields`:
```js
// schema option: { id: 19, value: 'theatre', label: { fr: 'Théâtre' } }
{ "type-devenement": 19, "categories": 1, "type-de-public": 10 }
```
- For a radio (single-value) field send the scalar id; checkbox fields take an
  array of ids (`categories: [1, 16]`).
- Get the ids from `oa.agendas.events.schema(...).fields[].options[].id`. Sending
  the slug (`'theatre'`) is accepted with `200` but **silently ignored** (field
  stays empty on read-back) — verify a populated field by reading the event back.
- Populate optional additional fields too (see SKILL Step 2): build a
  source-label → option-id map; default sensibly when the source has no signal.

## Structural requirements (not flagged as "mandatory")
- `attendanceMode: 1` (onsite) → requires a `locationUid` (`location.required` else).
- `attendanceMode: 2` (online) → requires `onlineAccessLink`.
- `timings`: each timing must be ≤ 24h; split multi-day spans per day.
- `registration[]`: `{ type: 'link'|'email'|'phone', value }` — a `link` value must
  be a real URL (OA validates `link.invalid`).
