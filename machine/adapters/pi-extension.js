import { spawn } from 'node:child_process';
export default function (pi) {
  const post = payload => {
    try {
      const child = spawn(HOOK_PATH, ['pi', SESSION_NAME], { stdio: ['pipe', 'ignore', 'ignore'] });
      child.on('error', () => {}); child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify(payload));
      const timer = setTimeout(() => child.kill(), 3000); timer.unref(); child.on('exit', () => clearTimeout(timer));
    } catch {}
  };
  pi.on('agent_settled', (event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    let turn = 0, lastUser = -1;
    entries.forEach((entry, i) => { if (entry.type === 'message' && entry.message?.role === 'user') { turn++; lastUser = i; } });
    const reply = entries.slice(lastUser + 1).reverse().find(entry => entry.type === 'message' && entry.message?.role === 'assistant');
    post({ hook_event_name: 'agent_settled', turn, entry_id: reply?.id ?? null, aborted: !!event.aborted, stopReason: reply?.message?.stopReason, errorMessage: reply?.message?.errorMessage });
  });
  pi.on('tool_execution_start', event => post({ hook_event_name: 'tool_execution_start', toolCallId: event.toolCallId, toolName: event.toolName, args: event.args }));
  pi.on('tool_execution_end', event => post({ hook_event_name: 'tool_execution_end', toolCallId: event.toolCallId, toolName: event.toolName, isError: event.isError }));
}
