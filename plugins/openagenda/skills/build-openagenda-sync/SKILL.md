---
name: build-openagenda-sync
description: Use when building a new synchronisation from a data source into one or more OpenAgenda agendas. Walks through analysing the source, modelling the target agenda schema, and wiring a stateful sync script. Carries a copyable, battle-tested scaffold.
---

# Building an OpenAgenda synchronisation

A synchronisation pulls events from a source (a CKAN portal, a ticketing API,
a tourism database…), maps them to the OpenAgenda event shape, and upserts them
into one or more OpenAgenda agendas — incrementally and idempotently.

Follow three steps. Each ends at a human-review checkpoint. **After every
checkpoint, write what you learned back into `reference/`** — this skill is a
living document; the first project (albigeois) seeded it, every project sharpens
it.

Start each project by copying `scaffold/` into the new project directory, then
rewrite only the source-specific pieces (`lib/SourceSDK.js`, the transforms).
The generic layer (`utils/oa/*`, `lib/state.js`, `lib/syncCore.js`) usually needs
no changes.

---

## Step 1 — Analyse the source

Goal: know exactly what you're mapping before you write a transform.

1. **Snapshot once.** Pull the source to `fixtures/` (`scripts/downloadFixtures.js`)
   so all later analysis is offline and read-minimal.
2. **Read budget.** Is everything in one payload, or do you need per-record detail
   calls or lookup tables? Resolve lookups by pre-loading whole tables into Maps
   keyed by id — never N per-record calls. (Albi: 4 datasets total — events +
   poi + organisateurs + sous-categories — and zero per-event calls.)
3. **Location sufficiency.** Can every event yield a valid OA location (address +
   city + postcode, or lat/long)? **Check the real coverage, not the first record.**
   Sources often store the address on a *referenced venue*, not on the event
   (Albi: only 66/223 events embed an address; the other 157 carry a `poi_id`
   and the address lives in the POI table). Decide where location comes from.
4. **Field shape gotchas.** Inspect for multi-valued fields, embedded HTML,
   trailing delimiters, mis-typed fields (phone numbers in a "links" field, etc.).
5. **Event merging — always test for it explicitly.** Many sources emit a
   recurring event as **N separate records, identical except the date**. If you
   map 1:1 you get N duplicate OA events instead of one event with N timings.
   Don't assume 1:1 from a few samples — *measure it*: group records by a
   content signature (everything but start/end/id) and count groups with >1
   member. `analyzeSource.js` reports `multiOccurrenceGroups` / `redundantRecords`
   for exactly this; if it's non-zero, merge (see `lib/transform/mergeEvents.js` —
   group by signature, carry every occurrence's date into `occurrences`, and let
   `buildTimings` expand them). Pick a stable `extId` for the merged event (the
   smallest member id, or a content hash).

`scripts/analyzeSource.js` prints a coverage report (counts, with-image,
with-location, excluded, **multi-occurrence groups / redundant records**).
**Checkpoint:** confirm the mapping strategy, the merge decision, and the
`extId` key before writing transforms.

---

## Step 2 — Model the target agenda(s)

Goal: build map functions against the agenda's *real* contract, not a guess.

1. **Read the event form schema.** Use the OpenAgenda v3 client
   (`@openagenda/api-client`, `oa.agendas.events.schema({ path: { agendaUid }})`)
   or the connected OpenAgenda MCP. It returns the merged schema: native fields
   plus the agenda's additional fields, with `optional`/`mandatory` flags and
   option keys. The raw v2 `/agendas/{uid}/schema` route is NOT this (it returns
   limited `info`); `utils/oa/getAgendaSchema.js` is only a thin best-effort helper.
2. **Populate every additional field you can — not just the mandatory ones.**
   For each agenda additional field (a field whose `schemaType` is not `event` —
   e.g. "Type d'événement", "Catégories", "Type de public"), **search the source
   data for a correspondence** that can fill it: a source category/type/tag whose
   values map onto the field's options. Build the mapping table even when the
   field is optional — an empty optional field is a missed-quality gap the client
   will notice. Leave a field empty for a given event only when the source has no
   defensible value (don't force a wrong single-value radio). Where the source has
   no signal at all but a sensible default exists (e.g. a municipal agenda →
   "Tout public"), apply the default.
   - The write value is the option's **numeric `id`** from the schema (e.g.
     `categories: 1`), set at the **top level** of the event payload keyed by the
     field name — NOT the option slug, and NOT nested under `additionalFields`.
     Read the ids from the schema's `options[].id`.
   - Match source labels to option labels by normalised label (deburr, lowercase,
     punctuation → space) so the same config survives per-agenda id differences.
3. **Structural requirements are not in the "mandatory" flags.** An onsite event
   (`attendanceMode: 1`) still *requires* a `locationUid`; an online event
   (`attendanceMode: 2`) requires `onlineAccessLink`. Plan for events that satisfy
   neither — skip them rather than letting OA 400 every run.
4. Build `mapLocation.js` and `mapEvent.js` driven by the schema.

**Checkpoint:** dry-run the transform over the Step-1 snapshot and eyeball a few
OA payloads.

---

## Step 3 — Wire up the sync

Goal: a safe, idempotent sync you can run repeatedly.

1. **Keys & init.** Record in `.env`: the source read key, the OpenAgenda write
   secret (`API_SECRET`, `oa_sk_…`), and a **test agenda UID**. Run against the
   test agenda first; promote to production only after verifying in the OA admin.
2. **Orchestrator flow** (`lib/syncCore.js`): load state → fetch source → filter →
   map → upsert locations (cached per venue) → upsert events by ext-id → reconcile
   deletions *read back from OpenAgenda* (never from the local registry) → save
   state. Flags: `--dry-run`, `--reconcile`, `--limit=N`.
3. **Run order:** `--dry-run` → bounded `--limit=5` real run to the **test**
   agenda → verify images/locations/dates in the admin → full run → run again to
   confirm idempotency (mostly `unchanged`) → promote.

**Checkpoint:** the live run is where the real bugs appear (the source's quirks,
the agenda's real validation). Fix them, and record each one in
`reference/pitfalls.md`.

---

## Reference (read before Step 2/Step 3)

- `reference/openagenda-api.md` — auth, ext-id upsert, **image upload**, the
  events read-back, schema discovery, required-by-structure fields.
- `reference/source-analysis.md` — the Step-1 checklist in full.
- `reference/pitfalls.md` — accumulated gotchas (read this first; it will save you
  a live debugging session).

## Scaffold

`scaffold/` is an adapt-and-copy starting point proven by the albigeois sync.
- Copy verbatim, rarely change: `utils/oa/*`, `lib/state.js`, `lib/syncCore.js`,
  `lib/transform/{text,media,buildTimings}.js`.
- Rewrite per source: `lib/SourceSDK.js`, `lib/transform/{mapEvent,mapLocation,
  constants,filter}.js`, the dataset names in `scripts/*`.
