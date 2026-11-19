# Map: owner references in instructions and runtime paths

Checked against: `ea9506df5175d5c81a8303229d3c2dd4502fe678` (origin/main and worktree HEAD)
Files covered: `protocol/`, `viewer/app/settings.js`, `viewer/app/sessions.js`, `viewer/app/asides.js`, `machine/service.js`, `machine/API.md`, `machine/lib/aside-turns.js`, `sensitivity/`, `install.sh`.

```text
settings and role files -> machine composes prompt -> provider starts agent
sensitivity template -> substitute checkout root -> global harness instructions
```

Settings produces named escalation and template sentences (`viewer/app/settings.js:144`, `viewer/app/settings.js:145`, `viewer/app/settings.js:158`); session start sends role layers (`viewer/app/sessions.js:377`). Machine reads the role and applicable card files from its own ROOT and appends layers (`machine/service.js:145`); it saves the prompt (`machine/service.js:750`). Provider delivery differs: Claude receives the prompt file and Codex/Antigravity are pointed to it (`machine/API.md:10`). Settings preview uses placeholders for full file text (`viewer/app/settings.js:175`). Aside turns point the agent to the separate role instructions (`machine/lib/aside-turns.js:98`, `protocol/app/aside.md:3`).

The sensitivity block itself uses `{{WHEELCHAIR_ROOT}}` (`protocol/sensitivity.md:33`, `protocol/sensitivity.md:41`); `sensitivity/set.sh:5` derives the checkout root, substitutes it at `sensitivity/set.sh:254`, and writes present harness files under configurable homes (`sensitivity/set.sh:10`). The generated absolute path may therefore contain the current user's name without the template hard-coding it. Tests require the substituted root to be absolute (`sensitivity/test/run.sh:304`). `install.sh:6` derives ROOT, uses `$HOME` (`install.sh:10`), invokes the writer (`install.sh:138`), and supplies a derived sudo-helper command (`install.sh:79`). Machine error text still names the owner (`machine/service.js:1952`).

A literal protocol inventory follows; line references include every case-insensitive match at this commit. The exact phrase in `protocol/app/sub-lead.md:32` is also a matching condition, so changing only prose could break its protocol contract (`protocol/app/sub-lead.md:257`). `protocol/graphs.md:493` contains an encoded home path.

- `protocol/app/AGENTS.md:5`, `protocol/app/AGENTS.md:24`
- `protocol/app/aside.md:3`, `protocol/app/aside.md:10`, `protocol/app/aside.md:13`, `protocol/app/aside.md:19`, `protocol/app/aside.md:23`, `protocol/app/aside.md:47`
- `protocol/app/cards-lead.md:47`, `protocol/app/cards-lead.md:63`, `protocol/app/cards-lead.md:87`, `protocol/app/cards-lead.md:98`, `protocol/app/cards-lead.md:115`, `protocol/app/cards-lead.md:220`, `protocol/app/cards-lead.md:234`, `protocol/app/cards-lead.md:238`, `protocol/app/cards-lead.md:250`, `protocol/app/cards-lead.md:252`, `protocol/app/cards-lead.md:253`, `protocol/app/cards-lead.md:257`, `protocol/app/cards-lead.md:259`, `protocol/app/cards-lead.md:268`, `protocol/app/cards-lead.md:303`
- `protocol/app/cards.md:5`, `protocol/app/cards.md:30`, `protocol/app/cards.md:35`, `protocol/app/cards.md:137`, `protocol/app/cards.md:146`, `protocol/app/cards.md:147`, `protocol/app/cards.md:148`, `protocol/app/cards.md:152`, `protocol/app/cards.md:168`, `protocol/app/cards.md:169`, `protocol/app/cards.md:198`
- `protocol/app/lead.md:4`, `protocol/app/lead.md:17`, `protocol/app/lead.md:56`, `protocol/app/lead.md:105`, `protocol/app/lead.md:108`, `protocol/app/lead.md:117`, `protocol/app/lead.md:119`, `protocol/app/lead.md:167`, `protocol/app/lead.md:216`, `protocol/app/lead.md:239`, `protocol/app/lead.md:307`, `protocol/app/lead.md:310`, `protocol/app/lead.md:311`, `protocol/app/lead.md:314`, `protocol/app/lead.md:338`, `protocol/app/lead.md:390`, `protocol/app/lead.md:398`, `protocol/app/lead.md:409`, `protocol/app/lead.md:411`, `protocol/app/lead.md:434`, `protocol/app/lead.md:443`, `protocol/app/lead.md:456`, `protocol/app/lead.md:475`, `protocol/app/lead.md:487`, `protocol/app/lead.md:491`, `protocol/app/lead.md:506`, `protocol/app/lead.md:507`, `protocol/app/lead.md:516`, `protocol/app/lead.md:521`, `protocol/app/lead.md:544`, `protocol/app/lead.md:603`, `protocol/app/lead.md:634`, `protocol/app/lead.md:641`, `protocol/app/lead.md:660`, `protocol/app/lead.md:680`, `protocol/app/lead.md:682`, `protocol/app/lead.md:686`, `protocol/app/lead.md:688`, `protocol/app/lead.md:690`, `protocol/app/lead.md:703`, `protocol/app/lead.md:706`, `protocol/app/lead.md:736`, `protocol/app/lead.md:781`, `protocol/app/lead.md:786`, `protocol/app/lead.md:805`, `protocol/app/lead.md:828`
- `protocol/app/sub-lead.md:3`, `protocol/app/sub-lead.md:6`, `protocol/app/sub-lead.md:32`, `protocol/app/sub-lead.md:113`, `protocol/app/sub-lead.md:129`, `protocol/app/sub-lead.md:133`, `protocol/app/sub-lead.md:255`, `protocol/app/sub-lead.md:257`, `protocol/app/sub-lead.md:259`, `protocol/app/sub-lead.md:262`, `protocol/app/sub-lead.md:277`
- `protocol/app/verifier.md:6`, `protocol/app/verifier.md:61`, `protocol/app/verifier.md:75`
- `protocol/app/worker.md:25`, `protocol/app/worker.md:41`
- `protocol/diagrams.md:3`
- `protocol/graphs.md:3`, `protocol/graphs.md:124`, `protocol/graphs.md:310`, `protocol/graphs.md:383`, `protocol/graphs.md:485`, `protocol/graphs.md:493`, `protocol/graphs.md:498`, `protocol/graphs.md:549`, `protocol/graphs.md:640`
- `protocol/sensitivity.md:6`

Not checked: the semantic correctness of every instruction, provider implementations beyond their documented delivery, and installed global files or other machines.
