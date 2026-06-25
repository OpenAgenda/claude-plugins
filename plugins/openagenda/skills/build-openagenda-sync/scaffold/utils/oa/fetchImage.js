// Fetch an image URL into a Blob for multipart upload to OpenAgenda. Some source
// servers block OA's own image fetcher, so we proxy the bytes. Returns null on any
// failure (missing/oversized/non-image), so the event still syncs without an image.
export default async function fetchImage(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    const filename = ((url.split('/').pop() || 'image').split('?')[0]) || 'image.jpg';
    return { blob, filename, type };
  } catch {
    return null;
  }
}
