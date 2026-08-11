// Central logger. Import THIS module (never `@openagenda/logs` directly):
// `logs.init()` must run before any `logs('namespace')` call, and importing
// this file first is what guarantees that ordering.
import debug from 'debug';
import logs from '@openagenda/logs';

// Rewrite per project. Also the console filter: DEBUG=albi-sync:*
const PREFIX = 'albi-sync:';

// Console output on by default; a DEBUG env var takes precedence.
// (logs' own `enableDebug` flag is broken with debug >= 4.4 — it pushes
// RegExps into debug.names, which now only matches string templates —
// so enable the namespace directly.)
if (!process.env.DEBUG && process.env.NODE_ENV !== 'test') debug.enable(`${PREFIX}*`);

logs.init({
  prefix: PREFIX,
  // InsightOps (EU) token — when set, info+ lines ship there as structured JSON.
  token: process.env.LOGS_TOKEN || null,
});

export default logs;
