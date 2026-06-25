// Best-effort fetch of an agenda's schema. NOTE: the v2 /schema route returns
// limited info; the authoritative additional-fields schema (with `mandatory`
// flags + option keys) is obtained via the @openagenda/api-client v3 client
// (`agendas.events.schema`). See reference/openagenda-api.md.
export default async function getAgendaSchema({ accessToken, agendaUID }) {
  const url = `https://api.openagenda.com/v2/agendas/${agendaUID}/schema`;
  const res = await fetch(url, { headers: { 'access-token': accessToken } });
  if (!res.ok) throw new Error(`getAgendaSchema failed ${res.status}: ${await res.text()}`);
  return res.json();
}
