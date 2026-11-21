import { appendFileSync } from "node:fs";
const OUT = process.env.PI_DRY_LOG;
function log(o) { appendFileSync(OUT, JSON.stringify(o) + "\n"); }
export default function (pi) {
  for (const ev of ["agent_start","agent_end","agent_settled","tool_execution_start","tool_execution_end","turn_end","session_start"]) {
    pi.on(ev, async (event, ctx) => {
      const sm = ctx.sessionManager;
      const entries = sm.getEntries();
      log({ ev, keys: Object.keys(event||{}), aborted: event?.aborted, toolName: event?.toolName, isError: event?.isError,
        file: sm.getSessionFile(), sid: sm.getSessionId(), n: entries.length,
        tail: entries.slice(-3).map(e => ({ type: e.type, id: e.id, role: e.message?.role, stop: e.message?.stopReason, err: e.message?.errorMessage })) });
    });
  }
}
