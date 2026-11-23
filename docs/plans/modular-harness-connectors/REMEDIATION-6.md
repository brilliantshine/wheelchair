# Remediation 6 — modular-harness-connectors

Verification attempt 6 at 69c299a4: verifier-11 (claude-opus-5-5) **PASS**, no gaps (L1–L4 confirmed, every Spec validation command clean apart from known machine causes); verifier-12 (gpt-6.2-sol) FAIL with two gaps.

## Gap list, verbatim (verifier 12, gpt-6.2-sol)

GAP: S2/S5 model pin round trip — The connector contract accepts a sixth tool whose shipped default is `Model-V2`. Both `init` and an unrelated GPT `set` write that default into the shared pin file, which the reader then marks malformed. In the reproduction, `set` exited 0 and the next read hid the saved GPT override. — `connectors/contract.js:63`, `codex/model.sh:87,132`. [Reproduction](/tmp/wc-verify-12.3SUmwE/default-pin-probe.log)
GAP: S7 connector guide — The guide says every `launchContext` key reaches `command`, but service-owned keys take precedence. It also omits the argument signatures for `bindTranscript`, `spoolWaiting`, and `validTranscript`, which every polling connector must implement. — `connectors/README.md:57,92,97`, `machine/service.js:736,1077,1403`.

## Judgment

| # | Gap | Judgment |
|---|-----|----------|
| M1 | A sixth tool's shipped default pin (e.g. `Model-V2`) is written into the shared pin file and hides other saved pins | silent loss of the user's settings for the next tool: fix. **Second attempt on L1** (the same pin-file round trip, reached through defaults instead of `set`); if it survives, it goes to the user as a plan defect |
| M2 | Guide: `launchContext` precedence wrong; polled-tool member signatures missing | docs that mislead the next implementer: fix |

## Task

### R7 — M1, M2, provider gpt, light tier (every change specified)
