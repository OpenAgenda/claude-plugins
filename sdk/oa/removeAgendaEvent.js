export default async function removeAgendaEvent({ accessToken, agendaUID }, key, value) {
  const url = `https://api.openagenda.com/v2/agendas/${agendaUID}/events/ext/${key}/${encodeURIComponent(value)}`;
  const res = await fetch(url, { method: 'DELETE', headers: { 'access-token': accessToken } });
  if (!res.ok && res.status !== 404) throw new Error(`removeAgendaEvent failed ${res.status}: ${await res.text()}`);
}
