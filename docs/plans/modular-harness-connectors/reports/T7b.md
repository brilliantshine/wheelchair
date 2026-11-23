# T7b report — connector guide and docs

## Changed
- `connectors/README.md` (new): the S7 guide: folder contents, machine and hub members with signatures and call sites, capabilities, manifest fields grouped as in `contract.js`, turn end (hook vs poller), `registry.json` and `tools.js`, and the add-a-tool checklist.
- `AGENTS.md`: `connectors/` added to the Executable row and the "Where to go" table.
- `machine/AGENTS.md`: stale `adapters/` row replaced by a `connectors/` pointer; new row naming `hook.sh`, `lib/hook-in.js`, `lib/hook-post.js`.
- `viewer/AGENTS.md`: `providers.js` row now says it is built from the manifests; `tools.js` named in the public-assets note.
- `machine/API.md`: "The adapter merges…" now says "The Antigravity connector merges…".
- `viewer/app/API.md`: no change; it holds no adapter paths and its provider lists are API values.

## Validation
```
grep -rn "adapters/\|machine/adapters" <the six files>   -> no hits (grep exit 1)
member check -> all members documented (exit 0)
```

## Choices
- `machine/test/name-guard.test.js` is described as existing, per the brief, though it was not in the tree yet.
- `monoModelNames` and `keyPrompt` are documented as read by no code today (grep showed only manifests and `contract.js`).
- `viewer/app/API.md` left untouched: nothing in it names adapter paths or lists tools as structure.
- Added a second `machine/AGENTS.md` row for the hook files, since the brief asked to name `lib/hook-in.js`.
