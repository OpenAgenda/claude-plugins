// albigeois/lib/syncCore.test.js
import { describe, it, expect, vi } from 'vitest';
import { runSync } from './syncCore.js';

function fakeOA() {
  return {
    upsertLocation: vi.fn(async () => 'loc-uid'),
    upsertEvent: vi.fn(async () => ({ uid: 1 })),
    removeEvent: vi.fn(async () => {}),
    listSynced: vi.fn(async () => []),
  };
}

const SOURCE = {
  events: [
    { id: 'keep', title: 'Keep', start: '2026-10-16T08:00:00.000Z', end: '2026-10-16T10:00:00.000Z',
      adress: 'A', city: 'Albi', media: 'https://x/a.jpg;', sub_category: 'ok' },
    { id: 'drop', title: 'Maison', start: '2026-10-16T08:00:00.000Z', end: '2026-10-16T10:00:00.000Z',
      adress: 'B', city: 'Albi', sub_category: '9d0c194a-d274-49f8-97e1-b93fd0f42274' },
  ],
  poiMap: new Map(), subCategoryMap: new Map(),
};

describe('runSync', () => {
  it('excludes Maisons de quartier and upserts the rest', async () => {
    const oa = fakeOA();
    const state = {};
    const stats = await runSync({ source: SOURCE, oa, state, agendaUID: '42', options: {} });
    expect(stats.excluded).toBe(1);
    expect(stats.created).toBe(1);
    expect(oa.upsertEvent).toHaveBeenCalledTimes(1);
  });
  it('dry-run performs no writes', async () => {
    const oa = fakeOA();
    const stats = await runSync({ source: SOURCE, oa, state: {}, agendaUID: '42', options: { dryRun: true } });
    expect(oa.upsertEvent).not.toHaveBeenCalled();
    expect(stats.created).toBe(1);
  });
  it('skips unchanged events on a second run (stateful)', async () => {
    const oa = fakeOA();
    const state = {};
    await runSync({ source: SOURCE, oa, state, agendaUID: '42', options: {} });
    const stats2 = await runSync({ source: SOURCE, oa, state, agendaUID: '42', options: {} });
    expect(stats2.unchanged).toBe(1);
    expect(stats2.created).toBe(0);
  });
  it('reconciles deletions read back from OA', async () => {
    const oa = fakeOA();
    oa.listSynced = vi.fn(async () => [{ extId: { key: 'albi', value: 'gone' } }]);
    const stats = await runSync({ source: SOURCE, oa, state: {}, agendaUID: '42', options: {} });
    expect(oa.removeEvent).toHaveBeenCalledWith('gone');
    expect(stats.deleted).toBe(1);
  });

  it('dry-run does not remove events or mutate the registry on the delete path', async () => {
    const oa = fakeOA();
    oa.listSynced = vi.fn(async () => [{ extId: { key: 'albi', value: 'gone' } }]);
    const state = { '42': { events: { gone: 'oldhash' }, locations: {} } };
    const stats = await runSync({ source: SOURCE, oa, state, agendaUID: '42', options: { dryRun: true } });
    expect(oa.removeEvent).not.toHaveBeenCalled();
    expect(state['42'].events.gone).toBe('oldhash');
    expect(stats.deleted).toBe(1);
  });

  it('skips an onsite event with no resolvable location', async () => {
    const oa = fakeOA();
    const src = {
      events: [{ id: 'noloc', title: 'X', start: '2026-10-16T08:00:00.000Z', end: '2026-10-16T10:00:00.000Z', sub_category: 'ok' }],
      poiMap: new Map(), subCategoryMap: new Map(),
    };
    const stats = await runSync({ source: src, oa, state: {}, agendaUID: '42', options: {} });
    expect(stats.skipped).toBe(1);
    expect(oa.upsertEvent).not.toHaveBeenCalled();
  });
});
