// The source-client seam — scripts import from HERE, never from AlbiSDK.js.
// It currently re-exports the Albi (CKAN) implementation so the scaffold runs
// end to end out of the box. To adapt: replace this re-export with your own
// client for your source's API, keeping the contract — a factory whose
// loadAll() resolves to { events: [...], <lookupMaps> }. AlbiSDK.js then
// remains untouched as a complete worked example. See scaffold/README.md.

export { createAlbiSDK as createSourceSDK } from './AlbiSDK.js';
