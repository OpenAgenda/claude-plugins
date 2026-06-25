function indexById(obj) {
  const map = new Map();
  const items = Array.isArray(obj) ? obj : Object.values(obj || {});
  for (const item of items) if (item && item.id) map.set(item.id, item);
  return map;
}

export function createAlbiSDK({ key, base }) {
  if (!key) throw new Error('ALBI_KEY is required');
  if (!base) throw new Error('ALBI_API_BASE is required');
  const headers = { Authorization: key };

  async function getJson(url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Albi fetch failed ${res.status} for ${url}`);
    return res.json();
  }

  async function fetchDataset(name) {
    const meta = await getJson(`${base}/package_show?id=${encodeURIComponent(name)}`);
    const resource = meta?.result?.resources?.[0];
    if (!resource?.url) throw new Error(`No resource URL for dataset ${name}`);
    return getJson(resource.url);
  }

  async function loadAll() {
    const [events, poi, organisateurs, sousCategories] = await Promise.all([
      fetchDataset('evenements'),
      fetchDataset('poi'),
      fetchDataset('organisateurs'),
      fetchDataset('sous-categories'),
    ]);
    return {
      events: Array.isArray(events) ? events : Object.values(events || {}),
      poiMap: indexById(poi),
      organizerMap: indexById(organisateurs),
      subCategoryMap: indexById(sousCategories),
    };
  }

  return { fetchDataset, loadAll };
}
