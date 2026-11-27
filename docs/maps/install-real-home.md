# Map: installer real-home isolation

Checked against: `0b5e05cfaeba93db1884f93737609b861a6a5145` (origin/main)
Files covered: `install/test/run.sh`, `install.sh`, `install/unseen.py`, `codex/model.sh`, `codex/preflight.sh`, `connectors/common.js`, `connectors/claude/machine.js`, `connectors/codex/machine.js`, `connectors/agy/machine.js`, `connectors/kimi/machine.js`, `connectors/pi/machine.js`, `machine/service.js`, `machine/lib/harness-install.js`, `viewer/app/settings.js`, `viewer/app/state.js`, `AGENTS.md`.

```text
real HOME snapshot -> isolated installer cases -> real HOME comparison -> later cases -> result
live sessions and Settings -> account files and live caches --------------------^
```

## Suite flow

`new_case` makes a fixture home and harness homes; `run_case` passes that HOME and explicit Claude/Codex homes to the installer child, leaving the suite shell's HOME real (`install/test/run.sh:68-76,97-98,162-164,182-210`). `tree_state` hashes sorted relative names, symlink targets, file content hashes and directory markers, not modes or timestamps; missing root returns `absent`. Its `1` flag omits entries whose relative path starts `accounts/` and contains `/tmp`, but does not prune walking those directories (`install/test/run.sh:27-49`).

The real snapshot is at line 234. In order: three refusal cases compare whole fixture homes (`install/test/run.sh:244-272`); harness detection, pins, wrapper and cleanup cases follow (`install/test/run.sh:274-460`); two installs compare both entire harness homes (`install/test/run.sh:463-469`); serving and machine-state cases follow, with machine state compared across reruns (`install/test/run.sh:473-698`); five real harness files use `file_state` and the real wheelchair tree uses `tree_state` at lines 700-705. Darwin serve/rerun/disable then runs at 707-748, screen cases including Darwin at 750-793, sudo hint and password checks at 795-799, and result at 801-802. Thus the stated after-suite assertions miss those later cases. Whole-tree hashing cannot distinguish the fixture's leak from concurrent live writes.

`file_state` hashes a single file or records absence (`install/test/run.sh:25-26,51-53,229-233,700-704`). There is no separate `install/test/tree-state*` helper or test in this checkout; the only helper is inline. The install suite is `bash install/test/run.sh` (`AGENTS.md:59`); picker and one full run per pushed commit are specified at `AGENTS.md:78-85`.

## Writers and account homes

- On non-default login, session start and account switch, machine validates and seeds the account (`machine/service.js:110-116,833-842,922-935,1735-1746`). Claude, Codex and Kimi seed a directory, link `CLAUDE.md` or `AGENTS.md` to the usual home only if source exists and destination does not, and rewrite `wheelchair-account.json` in place; Codex also creates `config.toml` exclusively if absent (`connectors/common.js:9-14`; `connectors/claude/machine.js:118`; `connectors/codex/machine.js:199`; `connectors/kimi/machine.js:298`). Pi/OpenRouter seeds metadata only (`connectors/pi/machine.js:127`); agy seed is a no-op and its login environment has no account override (`connectors/agy/machine.js:13,107`). Metadata is wheelchair's; instruction links point to shared tool instructions; Codex can also use and modify its config. Seed rewrites can race a snapshot, including temporary truncation of metadata.
- Claude session settings are generated under machine state, not account `settings.json` (`connectors/claude/machine.js:69-73,86`; `machine/service.js:1061`). Installer cleanup can edit the selected Claude `settings.json` and Codex config/hooks in the supplied harness homes (`install/unseen.py:127`; `install.sh:191`); the CLI may use these same files. No account settings writer was found in the inspected session seeding path.
- Codex preflight creates `.wheelchair-refresh.lock` under `CODEX_HOME` and may atomically replace tool-owned `auth.json` after a refresh (`codex/preflight.sh:21-33,39-41,103-117`; `connectors/codex/machine.js:130`). Account switch copies Claude/Codex transcripts into the destination account at the same relative path (`machine/service.js:922-935`), so even tool transcript directories can have wheelchair writes.
- Claude uses account `projects/`; Codex, Kimi and Pi use account `sessions/` for transcripts; these are examples, not an exhaustive or stable list of tool-owned directories (`connectors/claude/machine.js:6,100`; `connectors/codex/machine.js:6,195`; `connectors/kimi/machine.js:110-120,297`; `connectors/pi/machine.js:87,125,156-158`). Agy uses the ordinary Gemini home: preparation updates the shared `~/.gemini/config/hooks.json`, and the tool supplies a transcript path (`connectors/agy/machine.js:13-32,80-90`). Exact CLI internals and other version-specific folders were not examined.

## Outside accounts

`install.sh` invokes model initialization (`install.sh:168`); default pins are `~/.wheelchair/models`, with `.lock` in that directory's parent for locked writes, and pin commands can update them later (`codex/model.sh:44-48,143-164,399-421,456-459`). Settings reads models; discovery may create or atomically replace `agy-models.json` beside the pins when its hour-old cache expires and `agy models` succeeds (`viewer/app/settings.js:434-437,459`; `codex/model.sh:272,290-324`). These are wheelchair-managed files, although the model list comes from agy.

Settings CLI-install jobs create/truncate `~/.wheelchair/installs/<provider>.log`, remove an old result, write a PID, and later write a result and remove the PID; child output also enters the log (`machine/lib/harness-install.js:10-11,39-49,72-75,128-133`). These can change during a run without any installer fixture leak. Normal machine and hub state defaults to `~/.local/state/wheelchair`, including worktrees, session records and copied transcripts, not `~/.wheelchair` (`machine/service.js:48,283,289-290,681-682,1495`; `viewer/app/state.js:9,70-75`); installer cache and macOS service logs are elsewhere as well (`install.sh:36,42,375,389`). Overrides or symlinks can change actual locations.

Not checked: actual live homes, CLI source or all version-dependent CLI output, all possible third-party writers, every configurable state-root override, or a live reproduction.
