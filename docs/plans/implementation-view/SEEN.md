2026-09-26T01:24:29Z turn
2026-09-26T01:32:14Z turn
2026-09-26T01:38:11Z turn
2026-09-26T01:40:22Z turn
2026-09-26T01:43:48Z turn
2026-09-26T01:48:07Z turn
2026-09-26T01:52:20Z turn
2026-09-26T01:53:29Z turn
2026-09-26T01:57:59Z turn
2026-09-26T02:06:58Z new 32c7 review: nothing showed a finished worker's result while the lead was still checking it; in progress now lasts until the lead accepts it
2026-09-26T02:06:58Z new 53ad review: a folded-up group of parts that needed Collin had no text saying what it needed
2026-09-26T02:06:58Z new 5b69 review: a lost picture couldn't be rebuilt from the task table; each worker's choices now also go in the plan's log
2026-09-26T02:06:58Z new 4c25 review: there was no way to check the Claude side was logged in before starting; lanes.md gains a check
2026-09-26T02:06:58Z new 3fa0 review: a worker that forgot to list its choices would have been read as having made none
2026-09-26T02:06:58Z new 5724 review: behaviour of nested pictures at the depth limit or in a loop was undefined
2026-09-26T02:06:58Z new d1d7 review: new fields had no rule for wrong value types
2026-09-26T02:06:58Z new 315b review: the picture's last-updated time went stale when only a nested picture changed
2026-09-26T02:06:58Z new e60f review: the box height rule ignored the label, status and needs text
2026-09-26T02:06:58Z new 9114 review: small wording fix about how the page retries a conflicting write
2026-09-26T02:06:58Z new 3b04 review: a worker's choices could push a picture past 25 boxes mid-run, and which file they belong in was unstated
2026-09-26T02:06:58Z new 9fed review: box faces could show commands and task numbers instead of plain words
2026-09-26T02:06:58Z new bb16 review: the ask-at-start step didn't say what a missing login holds back
2026-09-26T02:06:58Z new 78b3 review: striking a choice sends a follow-up task, which contradicts the idea's not-doing list as written (question for Collin)
2026-09-26T02:06:58Z shown 32c7
2026-09-26T02:06:58Z shown 53ad
2026-09-26T02:06:58Z shown 5b69
2026-09-26T02:06:58Z shown 4c25
2026-09-26T02:06:58Z shown 3fa0
2026-09-26T02:06:58Z shown 5724
2026-09-26T02:06:58Z shown d1d7
2026-09-26T02:06:58Z shown 315b
2026-09-26T02:06:58Z shown e60f
2026-09-26T02:06:58Z shown 9114
2026-09-26T02:06:58Z shown 3b04
2026-09-26T02:06:58Z shown 9fed
2026-09-26T02:06:58Z shown bb16
2026-09-26T02:06:58Z shown 78b3
2026-09-26T02:06:58Z turn
2026-09-26T02:53:48Z turn
2026-09-26T03:00:06Z new a7a3 review 2: a missing Codex login rule in lanes.md read as stopping the whole run
2026-09-26T03:00:06Z new 08c0 review 2: which status wins when a nested picture is missing but another part needs Collin
2026-09-26T03:00:06Z new 6216 review 2: a nested picture's progress never redrew the top-level picture
2026-09-26T03:00:06Z new c2c9 review 2: a choice touching parts in two nested pictures got two boxes and two rulings
2026-09-26T03:00:06Z new d1a8 review 2: nested pictures deeper than five levels could hide a stuck part; now only one level is allowed
2026-09-26T03:00:06Z new 7ab7 review 2: two parts with the same id in different nested pictures could swallow a notification
2026-09-26T03:00:06Z new 6d1e review 2: asking a Claude worker again for its choices had no defined way to do it; the lead now lists them from the diff
2026-09-26T03:00:06Z new f4cb review 2: small wording fix on a container's first label line
2026-09-26T03:00:06Z new dd5e review 2: in progress after a worker came back read as contradicting the idea's wording
2026-09-26T03:00:06Z new 1725 review 2: resuming an interrupted run didn't say whether to redraw the picture
2026-09-26T03:00:06Z new e096 review 2: a choice's arrow type was unstated
2026-09-26T03:00:17Z turn
2026-09-26T03:07:53Z new 18d9 review 3: resuming an interrupted run was placed after workers start, and the entry check didn't allow a resume
2026-09-26T03:07:53Z new fe19 review 3: an ordinary graph could be named run.json and be mistaken for the run picture
2026-09-26T03:07:53Z new ffac review 3: a picture file deleted or corrupted mid-run can't be recovered cleanly (question for Collin)
2026-09-26T03:07:53Z shown 18d9
2026-09-26T03:07:53Z shown fe19
2026-09-26T03:07:53Z shown ffac
2026-09-26T03:07:53Z turn
2026-09-26T03:50:32Z turn
2026-09-26T03:56:27Z new def2 review 4: with a broken picture the lead couldn't collect your strikes at the end; it now collects what it can read and says what it couldn't
2026-09-26T03:56:27Z new fbcd review 4: an open tab never recovered after a fresh picture was drawn
2026-09-26T03:56:27Z new c6dd review 4: resuming re-tagged parts before the new tasks existed
2026-09-26T03:56:27Z new 3de3 review 4: a fresh picture could overwrite nested pictures that still hold your rulings
2026-09-26T03:56:27Z turn
2026-09-26T04:02:15Z new 3726 review 5: on resume the lead read the picture before telling the viewer about it, so a valid picture could be refused and dropped
2026-09-26T04:02:15Z new 7e30 review 5: on resume a viewer that wasn't running was treated as a broken picture
2026-09-26T04:02:15Z new 04a7 review 5: choices from before a resume could get mixed up with new task numbers
2026-09-26T04:02:15Z turn
2026-09-26T04:05:40Z new 0916 review 6: reusing the old picture on resume keeps producing new gaps (question for Collin)
2026-09-26T04:05:40Z shown 0916
2026-09-26T04:05:40Z turn
2026-09-26T04:14:17Z turn
2026-09-26T04:20:17Z new 2136 review 7: a plan sent back and re-approved could reuse its old picture; the old picture is now set aside at every start
2026-09-26T04:20:17Z new 93ec review 7: a crash at the wrong moment could lose your old strikes; they're now found again from the saved copies each start
2026-09-26T04:20:17Z new 67a4 review 7: the list page's run link could be missing when the viewer wasn't already running
2026-09-26T04:20:17Z turn
2026-09-26T04:25:50Z new 2400 review 8: choices were tracked by their wording, so two with the same wording could hide a strike; each now has a permanent id
2026-09-26T04:25:50Z new fe42 review 8: an already-undone choice could come back as live after a restart
2026-09-26T04:25:50Z new cf20 review 8: a choice whose part was removed by replanning couldn't be drawn
2026-09-26T04:25:50Z turn
2026-09-26T04:31:54Z new 0ab8 review 9: carrying old worker choices and strikes across a restart keeps producing gaps (question for Collin)
2026-09-26T04:31:54Z shown 0ab8
2026-09-26T04:31:54Z turn
2026-09-26T05:06:17Z turn
2026-09-26T05:10:30Z new 9e57 review 10: the list of old strikes rode on a message that isn't always sent; the lead now always sends one start message
2026-09-26T05:10:30Z turn
2026-09-26T05:14:12Z turn
2026-09-26T05:18:39Z new 0889 review 12: restart reporting still had contradictions in the text; fixed, and review capped again (question for Collin)
2026-09-26T05:18:39Z shown 0889
2026-09-26T05:18:39Z turn
2026-09-26T05:24:07Z turn
2026-09-26T05:28:10Z turn
2026-09-26T05:43:40Z turn
2026-09-26T05:55:41Z turn
2026-09-26T05:56:09Z turn
2026-09-26T06:37:52Z turn
2026-09-26T08:29:43Z turn
2026-09-26T08:39:51Z new b10c verification 1: columns on the run picture were only 24px apart, so wires overlapped; now 120px
2026-09-26T08:39:51Z new 49e7 verification 1: run boxes showed no kind tag, so a database looked like a file; the kind tag is back
2026-09-26T08:39:51Z new f26f verification 1: an empty needs text and a mixed-case reserved name were accepted by the wrong rules
2026-09-26T08:39:51Z new 5e1c verification 1: some required server tests were missing
2026-09-26T08:39:51Z new 4f61 verification 1: several rules from the plan never made it into the written Stage 3 rules, and some line references went stale
2026-09-26T08:39:51Z shown b10c
2026-09-26T08:39:51Z shown 49e7
2026-09-26T08:39:51Z shown f26f
2026-09-26T08:39:51Z shown 5e1c
2026-09-26T08:39:51Z shown 4f61
2026-09-26T08:39:51Z turn
2026-09-26T09:04:44Z new 4a32 verification 2: long needs text was still cut off in the detail panel
2026-09-26T09:04:44Z new 5028 verification 2: the first server fix deleted two required tests
2026-09-26T09:04:44Z shown 4a32
2026-09-26T09:04:44Z shown 5028
2026-09-26T09:04:44Z turn
2026-09-26T10:05:53Z new 0cc6 verification 3: the detail panel still cuts a needs text that is one very long word (question for Collin)
2026-09-26T10:05:53Z shown 0cc6
2026-09-26T10:05:53Z turn
