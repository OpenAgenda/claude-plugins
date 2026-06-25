export default async function setLocation({ accessToken, agendaUID }, key, value, data) {
  const url = `https://api.openagenda.com/v2/agendas/${agendaUID}/locations/ext/${key}/${encodeURIComponent(value)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'access-token': accessToken },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`setLocation failed ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.location ?? json;
}
