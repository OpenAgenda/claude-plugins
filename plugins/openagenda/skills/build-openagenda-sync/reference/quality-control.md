# Step 4 — quality control (published result ↔ source comparison)

A green sync run proves the API accepted the payloads — not that the published
events say what the source says. Before promoting to production, compare a
deliberate sample of published events against the source, field by field.

## Pick the comparison baseline (in priority order)
1. **The source's public event page**, when the source has one (the venue/city
   website, the ticketing page). This is the strongest baseline: it's what the
   client and the public will compare the agenda against, and it catches
   upstream-of-you problems (a stale dataset behind a fresh website).
2. **The raw source record** from the `fixtures/` snapshot, when there is no
   public page. This only validates the transform, not source freshness — say so
   in the report.
3. **The site referenced in the event's registration/keyed data** (a booking
   link, an organiser URL) as a last resort — partial, but better than nothing
   for dates, prices and contact info.

## Build the sample — bias toward the edges, not random
8–12 events is usually enough **if** they are chosen to cover every risky path
through the transform. Include at least one of each that applies:

- [ ] a **merged multi-occurrence event** (the mergeEvents path — right timing
      count, no lost or duplicated dates)
- [ ] an event whose **location was resolved from a referenced venue** (POI-first
      path), and one with an embedded address
- [ ] an event that got a **fallback**: default audience, town-centre
      coordinates, source-page registration link…
- [ ] an event with an **uploaded image** (multipart path)
- [ ] an event with the **longest / most HTML-heavy description**
- [ ] a **multi-day timing** that was split per day (and a DST-adjacent date if
      the data has one)
- [ ] an event carrying every **additional field** the sync populates
- [ ] a plain, boring, nothing-special event (the control)

## Field-by-field checklist
Open the published event (the public agenda page or embed — what a visitor
sees, not the admin form) next to the baseline and check:

- [ ] **Title** — intact, no leftover entities/markup, casing not mangled
- [ ] **Description / longDescription** — entities decoded (`d'audace`, not
      `d&rsquo;audace`), no raw HTML tags, truncation didn't cut mid-sentence,
      markdown renders
- [ ] **Timings** — same number of occurrences as the source, each date AND time
      correct (timezone shifts show up here), no phantom or missing dates
- [ ] **Location** — venue name, address, city; the map pin lands on the venue,
      not the town centre (unless that fallback was intended — then note it)
- [ ] **Image** — displays, and is the *right* image for this event
- [ ] **Registration / links** — resolve (no 404), point at this event's page,
      contact email/phone match the source
- [ ] **Additional fields** — populated with the right option label (a field at
      "(Sans valeur)" or with a wrong category is a visible quality gap)
- [ ] **Price / conditions** — free/paid status and amounts match

For bulk facts (counts, timing totals), the API read-back
(`listAllAgendaEvents`, `detailed=1`) is faster than pages — use it to check
"N source records → M published events" adds up with the merge/skip decisions,
then do the visual pass on the sample.

## Mechanize the gathering: `scripts/spotCheck.js`

The scaffold ships `scripts/spotCheck.js` (`yarn qc`, `--test` for the test
agenda) which does the tedious half of all of the above: it replays the sync's
own merge → filter → map → skip path over the `fixtures/` snapshot, builds the
edge-biased sample automatically (`tagTraits` marks which risky paths each
event exercised — adapt it per source), reads the published events back from
the agenda, runs the bulk reconciliation (with missing/unexpected ext-id
lists), and writes a `QC.md` skeleton: per sampled event, the published and
source URLs plus a synced-vs-published field table, followed by an empty
verdict line. What it deliberately does NOT do is judge — image correctness,
map-pin placement and text fidelity still need a human (or an agent driving a
browser) on the actual pages. Flags: `--sample=N` (default 12), `--out=path`.

## Classify every discrepancy — three verdicts
- **Sync bug** — the transform or upload dropped/garbled something the source
  provides. Fix, re-run, re-check that event, and log the gotcha in
  `pitfalls.md` if it's general.
- **Source data issue** — the source itself is wrong or stale (website says the
  concert moved, dataset didn't). Not yours to patch in the transform; report it
  upstream and record it in the QC report so the client knows why.
- **Accepted transform choice** — a deliberate difference (default audience,
  clamped timing, skipped unlocatable event). Document it in the project README
  so the next agent doesn't "fix" it.

## Output
A short `QC.md` in the project: the baseline used, the sample list (event +
baseline URL), per-event verdict, and every discrepancy with its
classification and resolution. **Checkpoint:** a human reviews it before the
sync is promoted to production.
