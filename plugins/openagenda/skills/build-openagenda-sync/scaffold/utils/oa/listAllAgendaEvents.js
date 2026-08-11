// Reads an agenda's PUBLISHED events via the public `key` param (the proven
// reconcile read path) and paginates with the array `after` cursor, returning
// only events bearing the given extKey. Takes the API secret, not an access token.
// `includeEvent` also returns the full detailed event (QC read-back).
export default async function listAllAgendaEvents({ secret, agendaUID }, { extKey, includeEvent = false } = {}) {
  const key = encodeURIComponent(secret);
  const afterQS = (a) => (Array.isArray(a) ? a.map((v) => `after[]=${encodeURIComponent(v)}`).join('&') : '');
  const out = [];
  let after = null;
  let total = null;
  let seen = 0;
  do {
    const url = `https://api.openagenda.com/v2/agendas/${agendaUID}/events?key=${key}&size=100&detailed=1&state[]=2${after ? `&${afterQS(after)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`listAllAgendaEvents failed ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (total === null) total = json.total || 0;
    for (const ev of json.events || []) {
      const ext = (ev.extIds || []).find((x) => !extKey || x.key === extKey);
      if (ext) out.push(includeEvent ? { uid: ev.uid, extId: ext, event: ev } : { uid: ev.uid, extId: ext });
    }
    seen += (json.events || []).length;
    after = json.after;
  } while (after && seen < total);
  return out;
}
