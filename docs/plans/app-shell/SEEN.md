2026-11-14T09:39:24Z turn
2026-11-14T09:43:03Z turn
2026-11-14T09:43:56Z turn
2026-11-14T09:46:55Z turn
2026-11-14T09:48:41Z turn
2026-11-14T09:49:14Z turn
2026-11-14T09:53:22Z turn
2026-11-14T09:54:57Z turn
2026-11-14T09:59:37Z turn
2026-11-14T10:10:04Z new a283 the cutover would delete the commands still needed to verify slice 1 and build slices 2 and 3
2026-11-14T10:10:11Z new 5a40 remote workers had no way to get the code or send results back
2026-11-14T10:10:11Z new dd07 a worker asking a question would have looked finished
2026-11-14T10:10:11Z new d506 a finished signal sent while the machine service was down would be lost
2026-11-14T10:10:11Z new 4763 the browser terminal would add Enter after every keystroke
2026-11-14T10:10:11Z new abcb sessions would stall on permission prompts
2026-11-14T10:10:11Z new 6908 worker and review messages would have shown up as chat
2026-11-14T10:10:11Z new 6f8f no rule for which branch a thread works on or how a small fix ships
2026-11-14T10:10:11Z new 5129 the Features view had no mapping from plan status to stages
2026-11-14T10:10:11Z new 3ad5 agent cards would have been refused by the browser origin check
2026-11-14T10:10:11Z new fb25 no model chosen per role
2026-11-14T10:10:11Z new 7b5e two of your decisions were missing from the log
2026-11-14T10:10:11Z new 14b8 multi-line messages would have split into several turns
2026-11-14T10:10:11Z new 9137 leftover short-lived sessions
2026-11-14T10:10:11Z new 4829 the message card kind was unlisted
2026-11-14T10:10:11Z shown a283
2026-11-14T10:10:11Z turn
2026-11-14T10:25:03Z new e798 a lead serving several features can't write or commit in their worktrees
2026-11-14T10:25:03Z shown e798
2026-11-14T10:25:03Z turn
2026-11-14T10:32:35Z turn
2026-11-14T10:48:47Z new f40e a fix to work still waiting for review needs fragile rebasing and retargeting as its own PR
2026-11-14T10:48:47Z shown f40e
2026-11-14T10:48:47Z turn
2026-11-14T11:08:00Z new 0ae4 joining a fix thread into another thread's open pull request keeps breaking
2026-11-14T11:08:00Z shown 0ae4
2026-11-14T11:08:00Z turn
2026-11-14T11:18:52Z turn
2026-11-14T11:30:01Z new dfa5 round 12 left only small mechanics in the review-fix flow, fixed but not yet re-reviewed
2026-11-14T11:30:01Z shown dfa5
2026-11-14T11:30:01Z turn
2026-11-14T11:44:14Z turn
2026-11-14T11:47:49Z turn
2026-11-14T11:56:56Z turn
2026-11-14T12:13:09Z turn
2026-11-14T12:25:07Z new 9d6e round 16 fixed how chat bubbles are told apart from internal messages, not yet re-reviewed
2026-11-14T12:25:07Z shown 9d6e
2026-11-14T12:25:07Z turn
2026-11-14T12:44:11Z turn
2026-11-14T12:54:38Z new 837a round 19 found Codex could bind to its internal title turn; fixed and added to the live check
2026-11-14T12:54:38Z shown 837a
2026-11-14T12:54:38Z turn
2026-11-15T03:48:17Z turn
2026-11-15T04:06:56Z new e42a a hook event saved while the machine service is down jams delivery for the whole machine when it restarts
2026-11-15T04:06:56Z new ac19 a card the hub refuses is reported to the agent as sent and blocks every card after it
2026-11-15T04:06:56Z new 3d6d the out-of-date check can never fire, because both sides read the clone's current commit
2026-11-15T04:06:56Z new a456 agents' git commands lose every long option, so pull requests and pushes run without their arguments
2026-11-15T04:06:56Z new db94 two updates to one thread at the same moment can lose one of them
2026-11-15T04:06:56Z new 6a71 a failed message send loses the message
2026-11-15T04:06:56Z new ba25 stubs never show in Features even after planning starts
2026-11-15T04:06:56Z new c149 Needs you misses threads without a plan yet
2026-11-15T04:06:56Z new fc33 sessions vanish from the list when a machine is unreachable
2026-11-15T04:06:56Z new be7b a restarted worker can't pick up its predecessor's work
2026-11-15T04:06:56Z new 2146 diagrams inside a thread fail to load
2026-11-15T04:06:56Z new deba archived diagrams show as raw data instead of a picture
2026-11-15T04:06:56Z new 65c6 a semicolon typed in the browser terminal is dropped
2026-11-15T04:07:15Z shown e42a
2026-11-15T04:07:15Z shown ac19
2026-11-15T04:07:15Z shown 3d6d
2026-11-15T04:07:15Z shown a456
2026-11-15T04:07:15Z shown db94
2026-11-15T04:07:15Z shown 6a71
2026-11-15T04:07:15Z shown ba25
2026-11-15T04:07:15Z shown c149
2026-11-15T04:07:15Z shown fc33
2026-11-15T04:07:15Z shown be7b
2026-11-15T04:07:15Z shown 2146
2026-11-15T04:07:15Z shown deba
2026-11-15T04:07:15Z shown 65c6
2026-11-15T04:07:15Z turn
2026-11-15T04:32:31Z new 4827 the codex resume lands in the current directory, not the lane's; recorded in known-issues
2026-11-15T04:32:51Z shown 4827
2026-11-15T04:32:51Z turn
2026-11-15T04:49:50Z new b6e9 my round-1 fix made any refused card crash the viewer; fixed and redeployed
2026-11-15T04:49:50Z new 50be a retried event after a failed send is wrongly treated as already done, so the message never goes
2026-11-15T04:49:50Z new e420 new diagrams in a thread still don't load
2026-11-15T04:49:50Z new b579 the out-of-date check still reads its commit too late
2026-11-15T04:49:50Z new a8d2 archiving again after finishing a rebase leaves the worktree behind
2026-11-15T04:49:50Z new c5d2 opening a child picture in an archived diagram shows the parent again
2026-11-15T04:49:50Z new 6396 whether typing an answer should close a question card is undecided
2026-11-15T04:50:03Z shown b6e9
2026-11-15T04:50:03Z shown 50be
2026-11-15T04:50:03Z shown e420
2026-11-15T04:50:03Z shown b579
2026-11-15T04:50:03Z shown a8d2
2026-11-15T04:50:03Z shown c5d2
2026-11-15T04:50:03Z shown 6396
2026-11-15T04:50:03Z turn
2026-11-15T05:18:46Z turn
2026-11-15T05:27:53Z new 68dd a valid card or a checker's report could be lost or refused when its target session can't take it at that moment
2026-11-15T05:27:53Z new e65d pressing Talk about this on the plan approval disables Start building for good
2026-11-15T05:27:53Z new 717b a checker's worktree with leftover files is never removed
2026-11-15T05:27:53Z new c945 messages the app types in aren't kept for restarts
2026-11-15T05:28:03Z shown 68dd
2026-11-15T05:28:03Z shown e65d
2026-11-15T05:28:03Z shown 717b
2026-11-15T05:28:03Z shown c945
2026-11-15T05:28:03Z turn
2026-11-15T05:57:04Z turn
