# Map: card closure and retraction boundaries

Checked against: `4654f16090e18a4b044d6e9f09f771ec976bb26e` (origin/main)
Files covered: `viewer/app/card.js`, `viewer/app/cards.js`, `viewer/app/threads.js`, `viewer/app/state.js`, `viewer/app/chat.js`, `viewer/app/views.js`, `viewer/pages/thread.js`, `viewer/pages/thread.css`, `machine/service.js`, `machine/lib/sudo.js`, `sudo-helper/helper.py`, `protocol/app/cards.md`, `protocol/app/lead.md`

## Flow

```text
lead JSON -> card.js validation -> machine spool -> hub validation -> target marked answered -> thread JSON
Collin button -> hub press -> answer recorded and lead queued -> thread JSON -> page renders
sudo card -> helper registration -> machine polls -> hub state -> page and lead
```

The CLI validates kind and fields without a role, then posts using the session token (`viewer/app/card.js:142-156,185-188,231-249`). The machine authenticates and spools, forwarding to the hub; it does not run the shared resolve target check locally (`machine/service.js:1139-1166`). The hub validates with the session role and checks the target (`viewer/app/cards.js:38-48,57-63`). Resolve permits lead-posted non-system needs and questions in the same thread; missing/replaced, wrong kind, system needs and already answered return the respective 422 reasons from `resolvable` (`viewer/app/card.js:24-39,129-131,191-202`; `viewer/app/cards.js:57-60`).

A stored card starts with id, session, timestamps, `answered: false` and system flag; resolve changes it in place to `answered: true`, `resolved_by`, `resolved_note`, `resolved_at` and is itself not stored (`viewer/app/cards.js:11-20,31-35,57-63`). Thread updates are serialized and atomically persisted (`viewer/app/state.js:113-130`). Presses normally record `answered_action` and `answered_value` and enqueue the lead; needs also gets resolution metadata (`viewer/app/threads.js:311-333`). Already answered questions and offers refuse another press with 422; needs has its own guard (`viewer/app/threads.js:297-305`).

Offer, idea and progress are singleton pins: a new one marks the old record `replaced` and assigns the new pin; chat excludes replaced records (`viewer/app/cards.js:9-27`; `viewer/app/chat.js:268-269`). The offer limit counts all offers, including replaced: a second requires the first value `keep talking first`, and a third is refused (`viewer/app/cards.js:72-76`). Continuing to talk instead of answering is a feature under the lead protocol, but leaves the offer pinned (`protocol/app/lead.md:116-120,125-130`; `protocol/app/cards.md:62-64`).

The page disables question and offer choices on `answered`; questions resolved by a lead show “Answered in chat” and note with opacity 0.6, whereas ordinary answers display the choice or typed words (`viewer/pages/thread.js:454-469,506-525,552-579`; `viewer/pages/thread.css:123-136`). Needs resolution displays the note and dims; its controls disappear (`viewer/pages/thread.js:642-662,796-797`; `viewer/pages/thread.css:135-136`). Approval Start uses the answered flag but objection talk and Re-check use only archive state; approval shows a generic answered tag (`viewer/pages/thread.js:581-606,796-797`). Idea removal uses archive state, not answered; progress has no action controls, and neither has an answered tag (`viewer/pages/thread.js:528-548,623-640,796-797`). Sudo renders from `state`, not answered, and waiting exposes its helper URL and controls (`viewer/pages/thread.js:745-790`). Thus setting `answered` alone would not disable every control or produce a retraction label.

Approval Re-check refreshes Ready on the same card; Start rechecks, saves a changed result without starting, and queues Start only when the unchanged result is ready (`viewer/app/threads.js:281-296,311-333`). The protocol sets and commits PLAN `approved` before posting approval; changing the Spec returns it to review, and the sub-lead changes status on starting (`protocol/app/lead.md:256-280,431-443`). Features reads PLAN status and groups `approved` under review (`viewer/app/views.js:11-17,98-116`). Press handling does not check PLAN status in the cited flow.

The machine registers sudo with the helper before spooling and persists request tracking (`machine/service.js:1143-1156`; `machine/lib/sudo.js:50-55`). Its poll delivers running and terminal outcomes to the hub, which advances monotonically and queues one terminal message (`machine/lib/sudo.js:86-112`; `viewer/app/cards.js:127-161`). Decline calls machine cancellation; the helper closes only a waiting request as declined, returning the actual state if already running or terminal (`viewer/app/threads.js:244-266`; `machine/lib/sudo.js:77-84`; `sudo-helper/helper.py:306-322`). A run checks waiting under the helper lock before becoming running (`sudo-helper/helper.py:175-185`). Retraction would need to address the live helper request and the race with running, not just hide its link.

The Needs you list scans unanswered question, needs, approval and merged cards; offer and sudo are not included (`viewer/app/views.js:122-132`). Protocol describes resolve, its target restrictions and note (`protocol/app/cards.md:145-163`) and the lead's obligation to resolve settled needs and chat-answered questions (`protocol/app/lead.md:38-46`).

## What I did not look at

Other card kinds, helper authentication and expiry internals, or the full session and transport maps.
