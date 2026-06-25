const ONE_HOUR = 3600 * 1000;

export default function createAccessTokenGetter(secret) {
  if (!secret || typeof secret !== 'string') {
    throw new Error('Invalid API key: key must be a non-empty string');
  }
  let token = null;
  let fetchedAt = 0;
  return async function getAccessToken() {
    if (token && Date.now() - fetchedAt < ONE_HOUR) return token;
    const res = await fetch('https://api.openagenda.com/v2/requestAccessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: secret }),
    });
    if (!res.ok) throw new Error(`Access token request failed: ${res.status}`);
    const json = await res.json();
    token = json.access_token;
    fetchedAt = Date.now();
    return token;
  };
}
