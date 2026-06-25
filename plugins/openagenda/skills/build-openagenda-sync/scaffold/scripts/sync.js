import { fileURLToPath } from 'node:url';
import { createAlbiSDK } from '../lib/AlbiSDK.js';
import { runSync } from '../lib/syncCore.js';
import { loadState, saveState } from '../lib/state.js';
import { EXT_KEY } from '../lib/transform/constants.js';
import createAccessTokenGetter from '../utils/oa/getAccessToken.js';
import fetchImage from '../utils/oa/fetchImage.js';
import setEvent from '../utils/oa/setEvent.js';
import setLocation from '../utils/oa/setLocation.js';
import removeAgendaEvent from '../utils/oa/removeAgendaEvent.js';
import listAllAgendaEvents from '../utils/oa/listAllAgendaEvents.js';

const args = new Set(process.argv.slice(2));
const options = {
  dryRun: args.has('--dry-run'),
  reconcile: args.has('--reconcile'),
  limit: Number([...args].map((a) => a.match(/^--limit=(\d+)$/)).find(Boolean)?.[1]) || null,
};
const useTest = args.has('--test');
const agendaUID = useTest ? process.env.TEST_AGENDA_UID : process.env.AGENDA_UID;
const secret = useTest ? process.env.TEST_API_SECRET : process.env.API_SECRET;

const sdk = createAlbiSDK({ key: process.env.ALBI_KEY, base: process.env.ALBI_API_BASE });
const source = await sdk.loadAll();

const getToken = createAccessTokenGetter(secret);
const accessToken = await getToken();
const ctx = { accessToken, agendaUID };

const oa = {
  upsertLocation: (loc) => setLocation(ctx, loc.extId.key, loc.extId.value, loc.oa).then((l) => l.uid),
  upsertEvent: async (value, payload, imageUrl) => {
    const image = imageUrl ? await fetchImage(imageUrl) : null;
    return setEvent(ctx, EXT_KEY, value, payload, image);
  },
  removeEvent: (value) => removeAgendaEvent(ctx, EXT_KEY, value),
  listSynced: () => listAllAgendaEvents({ secret, agendaUID }, { extKey: EXT_KEY }),
};

const stateFile = process.env.STATE_FILE_PATH || fileURLToPath(new URL('../.sync-state.json', import.meta.url));
const state = loadState(stateFile);
const stats = await runSync({ source, oa, state, agendaUID, options });
if (!options.dryRun) saveState(stateFile, state);
console.log(JSON.stringify({ agendaUID, options, stats }, null, 2));
