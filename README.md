# OpenAgenda — Claude Code plugins

A [Claude Code](https://docs.claude.com/en/docs/claude-code) plugin marketplace
with tooling for building **OpenAgenda data integrations** — synchronising a data
source (a CKAN portal, a ticketing API, a CSV…) into one or more OpenAgenda
agendas, and (over time) one-shot imports and outward export.

## Install

```
/plugin marketplace add OpenAgenda/claude-plugins
/plugin install openagenda
```

## What you get — the `openagenda` plugin

- **Skill `build-openagenda-sync`** — a 3-step methodology (analyse the source →
  model the target agenda schema → wire up a stateful sync) with human-review
  checkpoints, a living `reference/` of OpenAgenda API gotchas and pitfalls, and a
  battle-tested **scaffold** (the OpenAgenda write client, stateful sync core, and
  transforms) you copy into each new project.
- **Command `/new-oa-sync`** — kick off a new integration from a source.

The scaffold is adapt-and-copy: it carries the generic OpenAgenda SDK
(`utils/oa/*` — token, ext-id upsert, image upload, schema, paginated read),
the stateful `syncCore`, and the generic transforms; you rewrite only the
source-specific client and mapping.

## Repository layout

```
.claude-plugin/marketplace.json     # this marketplace
plugins/openagenda/                 # the plugin
  .claude-plugin/plugin.json
  skills/build-openagenda-sync/     # SKILL.md + reference/ + scaffold/
  commands/new-oa-sync.md
```

## Contributing

New OpenAgenda integration patterns (one-shot CSV/location import, outward export)
are added as additional skills under `plugins/openagenda/skills/`. Update the
skill's `reference/pitfalls.md` whenever a sync teaches you something new.
