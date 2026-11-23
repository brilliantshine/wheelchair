# Remediation 4 — modular-harness-connectors

Verification attempt 4 at 02129f90: verifier-7 (claude-opus-5-5) **PASS**, no gaps (J1–J6 confirmed); verifier-8 (gpt-6.2-sol) FAIL with five gaps.

## Gap list, verbatim (verifier 8, gpt-6.2-sol)

GAP: S2 account plan weights — Fresh default accounts ignore the manifest's `unknown` plan weight. A valid weight of `3` produced a fresh account with weight `1`, while account restoration reads the manifest value. — `viewer/app/settings.js:54`, `viewer/app/routes.js:285`. [Probe](/tmp/wc-verify-8.Ik3eXm/settings-weight-probe.log)
GAP: S3 aside redaction — The aside runner passes raw stderr to the result handler and saves its reply or failure without applying the connector's `redact` member. A connector that passed validation returned the synthetic value its redactor would have scrubbed. — `machine/lib/aside-turns.js:112`, `machine/lib/aside-turns.js:118`, `machine/lib/aside-turns.js:124`. [Probe](/tmp/wc-verify-8.Ik3eXm/connector-probes.log)
GAP: S3 version checks — Account eligibility depends on the optional `resolveCli` member even when the connector declares `versionCheck`. A connector that passed validation reported "version too old," yet the hub still marked its account eligible for placement. — `machine/service.js:1717`, `viewer/app/usage.js:78`. [Probe](/tmp/wc-verify-8.Ik3eXm/version-placement-probe.log)
GAP: S4 launch dispatch — The shared launcher retains the Kimi-specific `kimiExecutable` field and discards connector-supplied launch context outside its hard-coded field list. A connector's `launchContext` returned a value that its own `command` received as `undefined`. — `machine/service.js:736`, `machine/service.js:941`. [Probe](/tmp/wc-verify-8.Ik3eXm/connector-probes.log)
GAP: S5 installer version checks — Omitting optional `install.versionArgs` launches the CLI with zero arguments after installation. A valid manifest and successful recipe ended as a failed install when the fixture CLI exited `17` on its normal startup path. — `machine/lib/harness-install.js:124`. [Probe](/tmp/wc-verify-8.Ik3eXm/install-version-args-probe.log)

## Judgment

| # | Gap | Judgment |
|---|-----|----------|
| K1 | Aside output not passed through the tool's `redact` by the service | Spec S3 `aside` row; a possible secret leak for the next tool: always fixed |
| K2 | Version-check account masking keys on `resolveCli`, not `capabilities.versionCheck` | normal use for the next versionCheck tool (T3b's temporary rule never replaced): fix |
| K3 | Launcher hard-codes `kimiExecutable` and drops other `launchContext` keys | S4 (a tool-named field in the service) and normal use for the next tool: fix |
| K4 | Omitted `install.versionArgs` runs the CLI with no arguments | normal use for the next tool (S2 default is `--version`): fix |
| K5 | Fresh default accounts ignore the manifest's `unknown` weight | one-line inconsistency; fix with the rest |

Five gaps to remediation, none a repeat of an earlier gap; no rare paths.

## Task

### R5 — K1–K5, provider gpt, light tier (every change specified)
