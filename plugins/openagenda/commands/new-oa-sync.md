---
description: Start a new OpenAgenda synchronisation from a data source
argument-hint: [source name or short description]
---

Use the `build-openagenda-sync` skill to build a new OpenAgenda integration for: $ARGUMENTS

Work through the three steps and their human-review checkpoints:
1. **Analyse the source** — run the analysis, including the read-budget, location-sufficiency, field-shape, and **multi-occurrence / merge** checks. If key fields (image, image credits, timings, location, title, description, registration information…) are missing from the data, run the **scraping gap evaluation** against the source's public event pages and present the gap table at the checkpoint.
2. **Model the target agenda(s)** — read the event form schema; map source taxonomy onto the additional fields (populate optional ones too, not just mandatory).
3. **Wire up the sync** — copy `scaffold/` as the starting point; keys, test agenda first, then production.

Read `reference/pitfalls.md` before writing any transform.
