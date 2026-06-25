import { mkdirSync, writeFileSync } from 'node:fs';
import { createAlbiSDK } from '../lib/AlbiSDK.js';

const sdk = createAlbiSDK({ key: process.env.ALBI_KEY, base: process.env.ALBI_API_BASE });
const dir = new URL('../fixtures/', import.meta.url);
mkdirSync(dir, { recursive: true });

for (const name of ['evenements', 'poi', 'organisateurs', 'sous-categories']) {
  const data = await sdk.fetchDataset(name);
  writeFileSync(new URL(`${name}.json`, dir), JSON.stringify(data, null, 2));
  console.log(`saved fixtures/${name}.json`);
}
