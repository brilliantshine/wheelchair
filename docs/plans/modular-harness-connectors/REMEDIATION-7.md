# Remediation 7 — modular-harness-connectors

Verification attempt 7 at 02dcade6: verifier-13 (claude-opus-5-5) FAIL, verifier-14 (gpt-6.2-sol) FAIL.

## Gap lists, verbatim

### Verifier 13 (claude-opus-5-5)

GAP: S5/S6 model pin round trip (M1, second attempt on L1) — The new check on a connector's shipped default pins tests only the model name. A connector can still pass validation and then, through its defaults, write a pin file that the pin reader rejects as malformed. That hides the user's other saved pins, the same silent loss M1 was meant to fix. The plainest route is a default pin `effort` that is not in the tool's own `models.efforts`. The contract only checks that the effort is a string (`connectors/contract.js:68`), but `parse_pins` rejects any effort outside the list (`codex/model.sh:91-93`). Two more routes: a `models.format` without `^…$` anchors, which JS `.test` accepts as a partial match while `model.sh` uses `fullmatch` (`contract.js:65,69` vs `model.sh:33`); and a `models.pins` missing a slot, which makes every `model.sh init` and `set` crash with a traceback (`cell()` at `model.sh:120`). The guide (`connectors/README.md:255`) states neither rule. — Reproduction (scratchpad `probe2.sh`): with the real registry, `set gpt standard gpt-override`; then, with `WHEELCHAIR_REGISTRY` set to the registry plus a sixth Kimi-like tool with `efforts: ['low','high']` and default `light: {model:'six-a', effort:'turbo'}`, `show --json` printed `before: False gpt-override`. Then `set claude light claude-x` exited 0, the file gained `six.light = six-a @turbo`, and `show --json` printed `after: True gpt-5.6-terra`: the override was hidden and the file marked malformed. `validateManifest` accepts that manifest. The same probe showed the unanchored-format and missing-slot manifests also accepted. After `init`, a GPT `set` printed `model: malformed pins file` (exit 1) for the bad-effort and unanchored cases, and for the missing-slot case both `init` and `set` died with a Python traceback (exit 1).

### Verifier 14 (gpt-6.2-sol)

GAP: S5/S6 (M1) — A sixth provider can pass contract validation with a missing `critical` pin or an undeclared default effort. The missing pin makes `model.sh init` throw `KeyError: 'critical'`. The undeclared effort lets `init` write a file that subsequent writes reject as malformed. [missing-slot probe](/tmp/wc-verifier-14.QqSVS5/missing-slot-init.log), [default-effort probe](/tmp/wc-verifier-14.QqSVS5/bad-default-effort-set.log)
GAP: S5/S6 — `model.sh set` accepted the sixth provider's declared `very-high` effort and exited 0. The next read rejected the shared file and returned the shipped default. A subsequent write for GPT also failed. [Round-trip output](/tmp/wc-verifier-14.QqSVS5/custom-effort-roundtrip.log)
GAP: S4 — The Settings prompt preview still hard-codes which tools receive role instructions through a file. Adding a connector with `typesRoleMessage: true` leaves it out of the caption. (`viewer/pages/settings.js:726`)
GAP: S7 — The guide says `resolveCli` gates session launch. It gates sign-in, while launch checks `versionCheck`. The guide also omits the account directory argument passed to `loginCommand(dir)`. (`connectors/README.md:64`, `machine/service.js:1655,1732`)

## Merged gaps and judgment

| # | Gap | Judgment |
|---|-----|----------|
| N1 | Model-pin round trip: a manifest can pass the contract yet make `model.sh` write a pin file it rejects (default effort outside the list, custom effort word, unanchored format, missing slot), hiding the user's other saved pins | Survived two fix attempts (L1, M1): plan defect, raised to the user. **Collin chose option A** (Decision Log #18): close it structurally with a real `model.sh` round trip per connector in the contract test, plus direct checks |
| N2 | Settings prompt caption hard-codes which tools get role instructions as a file | S4: fix, word-for-word |
| N3 | Guide: `resolveCli` gates sign-in, not launch; `loginCommand(dir)` argument | docs: fix |

## Task

### R8 — N1 (as decided), N2, N3, provider gpt, standard
