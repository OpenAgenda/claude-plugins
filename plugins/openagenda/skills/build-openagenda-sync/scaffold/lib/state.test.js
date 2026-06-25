import { describe, it, expect, afterEach } from 'vitest';
import { rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadState, getBucket, saveState, contentHash } from './state.js';

const file = join(tmpdir(), `albi-state-${process.pid}.json`);
afterEach(() => { if (existsSync(file)) rmSync(file); });

describe('state', () => {
  it('returns {} for a missing file', () => {
    expect(loadState(join(tmpdir(), 'does-not-exist.json'))).toEqual({});
  });
  it('round-trips through save/load and creates buckets', () => {
    const state = {};
    const bucket = getBucket(state, '42');
    bucket.events['e1'] = 'hash1';
    saveState(file, state);
    expect(loadState(file)).toEqual({ '42': { events: { e1: 'hash1' }, locations: {} } });
  });
  it('contentHash is stable for equal objects', () => {
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ a: 1, b: 2 }));
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });
});
