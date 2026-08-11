// albigeois/lib/syncCore.js
import mapEvent from './transform/mapEvent.js';
import { makeSubcategoryFilter } from './transform/filter.js';
import { EXCLUDED_SUBCATEGORIES } from './transform/constants.js';
import { getBucket, contentHash } from './state.js';
import { mergeSourceEvents } from './transform/mergeEvents.js';
import logs from './logger.js';

const log = logs('sync');

function stripAnnotations(oa) {
  const clean = {};
  for (const [k, v] of Object.entries(oa)) if (!k.startsWith('_')) clean[k] = v;
  return clean;
}

export async function runSync({ source, oa, state, agendaUID, options = {} }) {
  const { dryRun = false, reconcile = false, limit = null } = options;
  const keep = makeSubcategoryFilter(EXCLUDED_SUBCATEGORIES);
  const bucket = getBucket(state, agendaUID);
  const stats = { created: 0, updated: 0, unchanged: 0, deleted: 0, skipped: 0, excluded: 0, errors: 0, deletionsSkipped: 0 };

  let events = mergeSourceEvents(source.events).filter((e) => {
    if (!keep(e, source.poiMap)) {
      stats.excluded += 1;
      log.debug('event excluded by filter', { sourceId: e.id });
      return false;
    }
    return true;
  });
  if (limit) events = events.slice(0, limit);

  const currentIds = new Set();
  const locationCache = new Map();

  for (const event of events) {
    const { extId, oa: payload, location } = mapEvent(event, { poiMap: source.poiMap });
    if (!payload.timings?.length) {
      stats.skipped += 1;
      log.warn('event skipped: no timings', { extId: extId.value });
      continue;
    }
    if (payload.attendanceMode === 1 && !location) {
      stats.skipped += 1;
      log.warn('event skipped: onsite event with no resolvable location', { extId: extId.value });
      continue;
    }
    currentIds.add(extId.value);

    const imageUrl = payload._imageUrl || null;
    const hash = contentHash({ oa: stripAnnotations(payload), loc: location?.oa, image: imageUrl });
    const known = bucket.events[extId.value];
    if (known === hash && !reconcile) { stats.unchanged += 1; continue; }

    const action = known ? 'updated' : 'created';
    if (dryRun) {
      stats[action] += 1;
      log.info(`event ${action} (dry-run)`, { extId: extId.value });
      continue;
    }

    try {
      if (location) {
        let uid = locationCache.get(location.extId.value);
        if (uid === undefined) {
          uid = await oa.upsertLocation(location);
          locationCache.set(location.extId.value, uid);
        }
        if (uid) payload.locationUid = uid;
      }
      await oa.upsertEvent(extId.value, stripAnnotations(payload), imageUrl);
      bucket.events[extId.value] = hash;
      stats[action] += 1;
      log.info(`event ${action}`, { extId: extId.value });
    } catch (err) {
      stats.errors += 1;
      // err.message in the text (the console transport drops meta.error when
      // other meta keys are present); the Error in meta ships the full stack.
      log.error(`event upsert failed: ${err.message}`, { extId: extId.value, error: err });
    }
  }

  // Deletion reconcile — read the synced set back from OA, never from the registry.
  if (!limit) {
    const synced = await oa.listSynced();
    // Safety floor: an empty or sharply-shrunken source is treated as a fetch
    // failure, not a deletion instruction — a transient source hiccup must never
    // wipe the agenda. `--reconcile` is the explicit override ("I really mean it").
    const tooFewToTrust = currentIds.size === 0 || (synced.length > 0 && currentIds.size < synced.length * 0.5);
    if (tooFewToTrust && !reconcile) {
      stats.deletionsSkipped = synced.filter(({ extId }) => !currentIds.has(extId.value)).length;
      if (stats.deletionsSkipped) {
        log.warn('deletion safety floor tripped: shrunken source treated as a fetch failure, no deletions performed (--reconcile overrides)', {
          sourceCount: currentIds.size,
          syncedCount: synced.length,
          deletionsSkipped: stats.deletionsSkipped,
        });
      }
    } else {
      for (const { extId } of synced) {
        if (!currentIds.has(extId.value)) {
          if (!dryRun) {
            await oa.removeEvent(extId.value);
            delete bucket.events[extId.value];
          }
          stats.deleted += 1;
          log.info(dryRun ? 'event deleted (dry-run)' : 'event deleted: absent from source', { extId: extId.value });
        }
      }
    }
  }

  return stats;
}
