# Sync logging — what to log so issues can be troubleshot later

A sync misbehaves weeks after it shipped, on a schedule, with nobody watching.
The log trail is the only witness: it must let someone answer "what happened to
event X?" **without re-running the sync or reading the code**.

These indications are language-agnostic — a sync written in PHP, Go, Python…
follows the same contract with whatever structured logger is idiomatic there.
The [Node.js section](#nodejs-implementations--openagendalogs) at the end covers
the recommended library for Node implementations.

## The four questions the log trail must answer

Every line below carries the event's **ext-id** — it is the join key between
the source record, the log trail, and the event in the OA admin.

1. **Did the run happen, and how did it go?**
   Log a `run started` line (agenda UID, flags: dry-run/reconcile/limit) and a
   `run completed` line (duration, the full stats: created / updated / unchanged
   / deleted / skipped / excluded / errors). A `started` with no `completed` =
   crashed run; wrap the whole run so a fatal logs a `run failed` line with the
   error **and exits non-zero** (so cron/systemd can alert).

2. **Why is event X not on the agenda?**
   There are two ways off (or never onto) the agenda; both must leave a line
   with the ext-id and the reason, so searching the ext-id tells you which:
   - *It never got in* — dropped during the run: excluded by design
     (publication filter) → `debug` (bulk, intentional noise); structurally
     unpublishable (no timings, onsite event with no resolvable location) →
     `warn` (a data-quality problem someone may want to fix at the source).
   - *It was removed* — deletion reconcile: log each deletion at `info`. When
     the deletion safety floor trips (source empty or sharply shrunken →
     deletions withheld), log a `warn` with the counts (`sourceCount`,
     `syncedCount`, `deletionsSkipped`) — that line is the signal
     distinguishing "source outage" from "mass unpublication".

3. **Why did event X change — or not change?**
   Log each write decision (`created` / `updated`, and the dry-run variants) at
   `info` with the ext-id. `unchanged` events stay **silent** — they are the
   common case, that's what the stats counter is for.

4. **What did OpenAgenda reject, and why?**
   An upsert failure logs at `error` with the ext-id, the **HTTP status and the
   OA response body** — OA puts the field-level validation error in the body
   (`image url.invalid`, `location.required`, `link.invalid`…); a bare "400 Bad
   Request" is useless. One event's failure must not abort the run: catch, count
   in `stats.errors`, continue.

## Conventions

- **Levels.** `error` = a write failed. `warn` = actionable anomaly (structural
  skip, safety floor). `info` = lifecycle decision (run start/end, created,
  updated, deleted). `debug` = by-design noise (filter exclusions). In
  production only `info`+ ships to the log platform — so anything needed to
  troubleshoot prod must be `info` or above.
- **Constant message, structured metadata.** Keep the message text constant and
  put the variables in structured fields (`extId`, `reason`, counts): the
  platform can then group by message and query by field (LEQL:
  `where(extId="…")`). Don't bury the ext-id in interpolated prose.
- **Log decisions, not payloads.** The full OA payload at `info` drowns the
  trail; it is reproducible from the fixtures + transform. On error, the OA
  response body already names the offending field.
- **Never log secrets** — access tokens, API secrets/keys, auth headers.
- **A readable trail is the requirement; a log platform is not.** Wherever the
  sync runs unattended, something must retain those lines — a process manager's
  own log files satisfy it. Shipping to a platform (OpenAgenda's is InsightOps
  EU, queryable with LEQL) buys cross-project search and history beyond local
  rotation; it is an upgrade to reach for when the project warrants it, not a
  precondition for running in production.

## Symptom → what to look for

| Symptom | Where the trail answers it |
|---|---|
| An event is missing from the agenda | Search its ext-id: an `excluded` / `skipped` / `upsert failed` line names the reason. No line at all → it never came out of the source (check `sourceEvents` on the `source loaded` line, then the source itself). |
| A rerun updates everything, `unchanged ≈ 0` | Content-hash instability: something non-deterministic in the payload (timestamps, unsorted lists, random ids). Diff two runs' payloads for one ext-id. |
| Events vanished en masse | `deleted` lines say the sync did it (source really dropped them); a safety-floor `warn` says it *refused* to. No lines → look outside the sync. |
| Agenda is stale but "nothing is wrong" | No `run started` at the expected time → scheduling/host problem, not a sync bug. `run failed` → the error is on the line. |
| Every run has the same `errors` count | The same events fail structurally each time; their `error` lines carry the OA body. Cross-check `reference/pitfalls.md`. |

## Node.js implementations — `@openagenda/logs`

For Node syncs, use **`@openagenda/logs`** (the scaffold wires it already):
namespaced loggers, console output via `debug`-style namespaces, and an
InsightOps (EU) transport that ships `info`+ as structured JSON when a token is
configured.

Patterns that matter with this library (see `scaffold/lib/logger.js`):

- **Init once, in a dedicated module.** `logs.init()` must run before any
  `logs('namespace')` call. Put the init in `lib/logger.js` and have every
  module import *that* — never `@openagenda/logs` directly — so ESM import
  hoisting guarantees the ordering.
- **Console on by default for a CLI.** A sync run must be visible without extra
  env vars. Note: the lib's `enableDebug` init flag is broken with `debug` ≥ 4.4
  (it pushes RegExps into `debug.names`, which now only matches string
  templates) — call `debug.enable('<prefix>*')` yourself when `DEBUG` is unset.
- **Errors: message text + meta, both.**
  ```js
  log.error(`event upsert failed: ${err.message}`, { extId, error: err });
  ```
  The console transport *drops* `meta.error` whenever other meta keys are
  present, so the message text must carry `err.message`; the InsightOps
  transport serializes the `Error` (with stack) as a top-level `error` field and
  keeps `extId` queryable in `meta`.
- **Configuration.** `LOGS_TOKEN` env → InsightOps; unset in dev. `DEBUG=<prefix>*`
  narrows/redirects console output.
- **Process tail.** With a token set, the InsightOps socket keeps the process
  alive ~15 s after the last line (inactivity close). Harmless under cron; don't
  "fix" it with `process.exit()` right after the last log or you'll lose the
  buffer.

For other languages, any structured logger meeting the contract above works —
levels, constant messages with structured fields, and a transport/forwarder
shipping `info`+ to InsightOps (EU).
