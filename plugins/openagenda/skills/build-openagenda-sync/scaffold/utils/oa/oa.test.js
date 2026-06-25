import { describe, it, expect, vi, afterEach } from 'vitest';
import createAccessTokenGetter from './getAccessToken.js';
import setEvent from './setEvent.js';
import removeAgendaEvent from './removeAgendaEvent.js';
import setLocation from './setLocation.js';
import listAllAgendaEvents from './listAllAgendaEvents.js';
import getAgendaSchema from './getAgendaSchema.js';

afterEach(() => vi.restoreAllMocks());

describe('createAccessTokenGetter', () => {
  it('throws without a key', () => {
    expect(() => createAccessTokenGetter()).toThrow();
  });
  it('caches the token across calls', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'T' }) });
    vi.stubGlobal('fetch', fetchFn);
    const get = createAccessTokenGetter('secret');
    expect(await get()).toBe('T');
    expect(await get()).toBe('T');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('POSTs to /v2/requestAccessToken with the code body', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'T', expires_in: 3600 }) });
    vi.stubGlobal('fetch', fetchFn);
    await createAccessTokenGetter('secret')();
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.openagenda.com/v2/requestAccessToken');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ code: 'secret' });
  });
});

describe('setEvent', () => {
  it('PUTs to the ext-id event route with the access-token header', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ event: { uid: 9 } }) });
    vi.stubGlobal('fetch', fetchFn);
    const out = await setEvent({ accessToken: 'T', agendaUID: '42' }, 'albi', 'e1', { title: { fr: 'x' } });
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.openagenda.com/v2/agendas/42/events/ext/albi/e1');
    expect(opts.method).toBe('PUT');
    expect(opts.headers['access-token']).toBe('T');
    expect(out).toEqual({ uid: 9 });
  });
  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad' }));
    await expect(setEvent({ accessToken: 'T', agendaUID: '42' }, 'albi', 'e1', {})).rejects.toThrow(/400/);
  });
  it('sends a multipart body (no JSON content-type) when an image blob is provided', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ event: { uid: 1 } }) });
    vi.stubGlobal('fetch', fetchFn);
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    await setEvent({ accessToken: 'T', agendaUID: '42' }, 'albi', 'e1', { title: { fr: 'x' } }, { blob, filename: 'p.jpg' });
    const [, opts] = fetchFn.mock.calls[0];
    expect(opts.body).toBeInstanceOf(FormData);
    expect(opts.headers['Content-Type']).toBeUndefined();
    expect(opts.headers['access-token']).toBe('T');
  });
});

describe('removeAgendaEvent', () => {
  it('DELETEs the ext-id event route', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchFn);
    await removeAgendaEvent({ accessToken: 'T', agendaUID: '42' }, 'albi', 'e1');
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.openagenda.com/v2/agendas/42/events/ext/albi/e1');
    expect(opts.method).toBe('DELETE');
  });
});

describe('setLocation', () => {
  it('PUTs to the ext-id location route with the access-token header', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ location: { uid: 7 } }) });
    vi.stubGlobal('fetch', fetchFn);
    const out = await setLocation({ accessToken: 'T', agendaUID: '42' }, 'albi', 'p1', { name: 'X' });
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.openagenda.com/v2/agendas/42/locations/ext/albi/p1');
    expect(opts.method).toBe('PUT');
    expect(opts.headers['access-token']).toBe('T');
    expect(out).toEqual({ uid: 7 });
  });
});

describe('removeAgendaEvent error handling', () => {
  it('sends the access-token header and tolerates a 404', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => 'not found' });
    vi.stubGlobal('fetch', fetchFn);
    await expect(removeAgendaEvent({ accessToken: 'T', agendaUID: '42' }, 'albi', 'gone')).resolves.toBeUndefined();
    expect(fetchFn.mock.calls[0][1].headers['access-token']).toBe('T');
  });
  it('throws on a non-404 error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'err' }));
    await expect(removeAgendaEvent({ accessToken: 'T', agendaUID: '42' }, 'albi', 'e1')).rejects.toThrow(/500/);
  });
});

describe('listAllAgendaEvents', () => {
  it('paginates with key + state[]=2 + after[] and returns only events bearing the extKey', async () => {
    const page1 = { ok: true, json: async () => ({ total: 3, events: [
      { uid: 1, extIds: [{ key: 'albi', value: 'a' }] },
      { uid: 2, extIds: [{ key: 'other', value: 'b' }] },
    ], after: ['c1', 'c2'] }) };
    const page2 = { ok: true, json: async () => ({ total: 3, events: [
      { uid: 3, extIds: [{ key: 'albi', value: 'c' }] },
    ], after: ['c3'] }) };
    const fetchFn = vi.fn().mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
    vi.stubGlobal('fetch', fetchFn);
    const out = await listAllAgendaEvents({ secret: 'S', agendaUID: '42' }, { extKey: 'albi' });
    expect(out).toEqual([
      { uid: 1, extId: { key: 'albi', value: 'a' } },
      { uid: 3, extId: { key: 'albi', value: 'c' } },
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(String(fetchFn.mock.calls[0][0])).toContain('key=S');
    expect(String(fetchFn.mock.calls[0][0])).toContain('state[]=2');
    expect(String(fetchFn.mock.calls[1][0])).toContain('after[]=c1');
  });
});

describe('getAgendaSchema', () => {
  it('GETs the agenda schema with the access-token header', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ info: 'x' }) });
    vi.stubGlobal('fetch', fetchFn);
    const out = await getAgendaSchema({ accessToken: 'T', agendaUID: '42' });
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.openagenda.com/v2/agendas/42/schema');
    expect(opts.headers['access-token']).toBe('T');
    expect(out).toEqual({ info: 'x' });
  });
});
