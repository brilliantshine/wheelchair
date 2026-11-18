# Map: mergeable before done

Checked against: `92c2db2211096a2360b7b93f7bb1623805f6209d` (origin/main). Detailed reusable flow and evidence: `docs/maps/pr-finishing.md`.

```text
verify commit -> push and open PR -> post done -> hub stores card -> poll for merged notice
                        -> proposed: resolve base conflicts and wait for green checks before done
```

- Today the small-fix and feature flows post `done` immediately after pushing and opening the PR; feature step 8 forbids merging the PR, while after-done fixes may post `done` even after a successful merge race (`protocol/app/lead.md:112-122,316-325,333-359`). The sub-lead verifies before handing control back, and a verifier checks a specific detached commit (`protocol/app/sub-lead.md:207-233,250-251`; `protocol/app/verifier.md:13-17,50-53`).
- The existing git wrapper can fetch and merge `origin/main` into the agent worktree and returns Git's conflict output in JSON; a Git failure still arrives in an HTTP 200 response and the CLI prints the result (`viewer/app/wc.js:49-68,169-190`; `machine/service.js:70-75,980-1001,1308`). Re-verification after such a merge is a policy decision; after-done already requires it for a merge of updated PR-branch commits (`protocol/app/lead.md:349-353`).
- The hub can gate before `addCard` after role/schema validation, but the machine may already have acknowledged a spooled card; later 4xx rejections go to rejected storage (`viewer/app/cards.js:51-61,120-122`; `machine/service.js:883-888,911-923,1289-1304`). The existing app polls only merged state after a `done` card; neither that poll nor `wc.js git pr` reads checks or mergeability (`viewer/app/threads.js:359-387`; `machine/service.js:995-1001`). A gate must account for the already-merged after-done case and GitHub unavailability, and establish which PR/head/checks it is evaluating.
- The only repository workflow runs on PRs and takes a recent sampled 1m41s–3m12s from run creation to update; the job timeout is 30 minutes (`.github/workflows/macos.yml:1-12`; sample and commands in `docs/maps/pr-finishing.md`). GitHub credentials are inherited by the hub's and machine's separate `gh` processes, with no explicit token at those call sites (`viewer/app/threads.js:372,400-402`; `machine/service.js:70-71,991-1000`).

Tests and verification commands are listed in `docs/maps/pr-finishing.md`; key seams are wrapper arguments, machine spool/rejections, hub card acceptance, merged polling and protocol rules (`viewer/test/app-machines.test.js:94-109`; `machine/test/service.test.js:260-304`; `viewer/test/app-merged.test.js:44-49`; `viewer/test/protocol-rules.test.js:33-42`).

## What I did not look at

Live GitHub credentials, branch protection and required checks, every test or failure path, actual conflict resolution, and long-term CI timing. See the reusable map for scope and the comparison with older maps.
