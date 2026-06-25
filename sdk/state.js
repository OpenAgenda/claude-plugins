import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function loadState(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

export function getBucket(state, agendaUID) {
  const key = String(agendaUID);
  if (!state[key]) state[key] = { events: {}, locations: {} };
  if (!state[key].events) state[key].events = {};
  if (!state[key].locations) state[key].locations = {};
  return state[key];
}

export function saveState(file, state) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  renameSync(tmp, file);
}

export function contentHash(payload) {
  return createHash('sha1').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}
