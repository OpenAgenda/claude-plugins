export function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function firstImageUrl(media) {
  for (const candidate of splitList(media)) {
    if (/^https?:\/\/\S+$/i.test(candidate)) return candidate;
  }
  return null;
}
