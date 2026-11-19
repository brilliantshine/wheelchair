# Map: thread sidebar files

```text
thread poll -> sidebar and phone links -> plan document or picture
agent image card -> machine copy -> hub card -> browser file stream
user attachment -> machine upload -> browser file stream
archive -> branch plan documents; uploads removed
```

The current files area already lists MAP, IDEA, PLAN and diagram/aside picture links in the sidebar and under the phone header. The plan links open rendered pages even when a file does not yet exist; they are not download links (`viewer/pages/thread.js:235-275`; `viewer/pages/thread.html:26,58-60`). Its poll signature only includes diagrams and asides (`viewer/pages/thread.js:1115`).

Live plan reads use the hub's registered local worktree path, while archived reads run local Git against the recorded project; neither path forwards to a remote machine (`viewer/pages/doc.js:43-67`; `viewer/server.js:1510-1528,1665-1670`; `viewer/app/threads.js:251-265`). Uploads instead stream through the hub to the thread's machine and back (`viewer/app/routes.js:104-117,501-510`).

The closest agent delivery is the lead-only image card: the machine copies a bounded image into numbered uploads and the hub stores its basename (`protocol/app/cards-lead.md:209-220`; `machine/service.js:351-368,1997`; `viewer/app/cards.js:133-134`). Card kinds, fields and roles are validated in both CLI and hub (`viewer/app/card.js:26-45,175-188,218,275-291`; `viewer/app/cards.js:56-67`). Files use safe basename checks, authenticated machine streaming, `nosniff`, and forced attachment for non-image types (`viewer/app/routes.js:501-510`; `machine/service.js:37-39,1945-1953`). Archive deletes uploads, unlike committed plan docs (`machine/service.js:1181-1189`; `viewer/app/threads.js:251-264`).

See [thread-sidebar-files map](../../maps/thread-sidebar-files.md) for the full flow, size limits and evidence. The older relevant maps changed since their checked commits; their related paths were rechecked in that focused map. Checked worktree `a5f9d5f61e2f23dd13ed996bb41b1b6c60ab9202` against fetched `origin/main` `dbdc97c540f8c9226a3d0762bdd6fe9b548b9ecf`; intervening changes do not alter these flows.

Not checked: handoff/import preservation, detailed diagram export formats, or unrelated portions of historical maps.
