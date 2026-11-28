# R1-A report

- `viewer/test/app-openrouter-settings.test.js`: updated the family hint source assertion.
- `viewer/test/char-hub-dispatch.test.js`: checked default sub-lead placement and scout lookups, plus a configured provider order and tier.

Validation: `node --test viewer/test/app-openrouter-settings.test.js viewer/test/char-hub-dispatch.test.js`

```text
exit 0
TAP version 13
# Subtest: OpenRouter settings defaults, migration and page display
ok 1 - OpenRouter settings defaults, migration and page display
  ---
  duration_ms: 2.973001
  type: 'test'
  ...
# Subtest: OpenRouter model IDs agree in the page and save route
ok 2 - OpenRouter model IDs agree in the page and save route
  ---
  duration_ms: 444.197014
  type: 'test'
  ...
# Subtest: OpenRouter effort pin round-trips through Settings; unknown level is refused
ok 3 - OpenRouter effort pin round-trips through Settings; unknown level is refused
  ---
  duration_ms: 784.903771
  type: 'test'
  ...
# Subtest: idle probes all and only supported tools, including live Kimi
ok 4 - idle probes all and only supported tools, including live Kimi
  ---
  duration_ms: 29.188014
  type: 'test'
  ...
# Subtest: usage displays forecasts, spend, problems and warnings by provider
ok 5 - usage displays forecasts, spend, problems and warnings by provider
  ---
  duration_ms: 11.461399
  type: 'test'
  ...
# Subtest: settings preserve provider plans, scout wording, review fallback and discovery
ok 6 - settings preserve provider plans, scout wording, review fallback and discovery
  ---
  duration_ms: 2.505255
  type: 'test'
  ...
# Subtest: model routes validate each provider, aliases, efforts and review choices
ok 7 - model routes validate each provider, aliases, efforts and review choices
  ---
  duration_ms: 1019.625041
  type: 'test'
  ...
# Subtest: aside fork chooses each supported parent and rejects unsupported providers
ok 8 - aside fork chooses each supported parent and rejects unsupported providers
  ---
  duration_ms: 0.934713
  type: 'test'
  ...
# Subtest: chat selects distinct report and transcript formats for every CLI
ok 9 - chat selects distinct report and transcript formats for every CLI
  ---
  duration_ms: 3.407474
  type: 'test'
  ...
# Subtest: session limit switching and persisted harness ids vary by provider
ok 10 - session limit switching and persisted harness ids vary by provider
  ---
  duration_ms: 55.368751
  type: 'test'
  ...
# Subtest: worker effort ceilings apply to every provider with effort
ok 11 - worker effort ceilings apply to every provider with effort
  ---
  duration_ms: 2226.011306
  type: 'test'
  ...
# Subtest: session model resolution uses provider cells and tier aliases
ok 12 - session model resolution uses provider cells and tier aliases
  ---
  duration_ms: 530.711569
  type: 'test'
  ...
# Subtest: switch placement runs preflight only for GPT
ok 13 - switch placement runs preflight only for GPT
  ---
  duration_ms: 22.330393
  type: 'test'
  ...
1..13
# tests 13
# suites 0
# pass 13
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4016.161119
```

Nothing left undone.

## Choices

- `viewer/test/char-hub-dispatch.test.js`: used a GPT-first custom ladder and standard tier to distinguish configured placement and model from the thread provider and default tier.
