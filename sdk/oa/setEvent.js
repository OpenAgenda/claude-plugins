// Upsert an event by external id. When `image` ({ blob, filename }) is provided,
// the request is multipart (data JSON + image file) so OA stores the bytes directly;
// otherwise it is a plain JSON PUT.
export default async function setEvent({ accessToken, agendaUID }, key, value, data, image) {
  const url = `https://api.openagenda.com/v2/agendas/${agendaUID}/events/ext/${key}/${encodeURIComponent(value)}`;
  let body;
  let headers;
  if (image && image.blob) {
    const fd = new FormData();
    fd.append('data', JSON.stringify(data));
    fd.append('image', image.blob, image.filename || 'image.jpg');
    body = fd;
    headers = { 'access-token': accessToken }; // let FormData set the multipart boundary
  } else {
    body = JSON.stringify(data);
    headers = { 'Content-Type': 'application/json', 'access-token': accessToken };
  }
  const res = await fetch(url, { method: 'PUT', headers, body });
  if (!res.ok) throw new Error(`setEvent failed ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.event ?? json;
}
