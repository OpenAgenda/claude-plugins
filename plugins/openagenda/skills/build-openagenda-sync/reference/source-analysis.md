# Step 1 — source analysis checklist

Run `scripts/downloadFixtures.js` then `scripts/analyzeSource.js` and answer:

## Volume & read budget
- [ ] How many records?
- [ ] Is everything in one payload, or are there per-record detail calls?
- [ ] Are there lookup tables (categories, venues, organizers)? Pre-load each
      into a `Map` keyed by id — never fetch per-record.
- [ ] Total reads = (1 events payload) + (N lookup tables). Aim to minimise.

## Location sufficiency — check coverage, not the first record
- [ ] What fraction of events embed a usable address/coords?
- [ ] Where does the rest of the location come from — a referenced venue table
      (a `poi_id` / `venue` reference)? Resolve POI-first when so.
- [ ] What is the venue NAME field on the referenced record? (Albi's POI uses
      `title`, not `name`.)
- [ ] How many events are truly unlocatable? Plan to skip them (an onsite event
      with no location 400s on OA).

## Field shape gotchas
- [ ] Multi-valued fields? (Albi `media` / `sub_category` are `;`-separated.)
- [ ] Trailing delimiters on values? (Albi image URLs end with `;`.)
- [ ] HTML in text fields? (Need html→markdown for longDescription, html→short
      text for description.)
- [ ] Mis-typed fields? (Albi puts phone numbers in `links[].href` — validate that
      a "link" is actually a URL before using it.)
- [ ] Are images on a public host OA can reach, or will you need to upload bytes?

## Additional-field correspondences (feeds Step 2)
- [ ] List the target agenda's additional fields (`schemaType` ≠ `event`) and
      their options.
- [ ] For each, find the source field whose values correspond (category, type,
      tag, audience…). Note the source→option-label matches.
- [ ] Flag fields the source cannot feed (e.g. a sub-agenda routing field) and
      fields that warrant a blanket default (audience → "Tout public").

## Event identity & merging
- [ ] 1 source row = 1 OA event, or do several rows merge into one (multi-session)?
- [ ] Grouping key for merges?
- [ ] `extId` = `{ key: '<source>', value: <stable source id> }`.

## Output
A one-paragraph mapping strategy + the chosen `extId` key, reviewed before any
transform is written.
