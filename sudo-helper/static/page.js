'use strict';
const base = location.pathname.replace(/\/$/, '');
const el = id => document.getElementById(id);
let confirmTimer;
let confirming = false;
function reset() {
  confirming = false;
  el('run').textContent = 'Run';
  el('run').classList.remove('confirm');
}
function render(data) {
  for (const name of ['command', 'does', 'why']) el(name).textContent = data[name] || '';
  el('user').textContent = data.user ? 'User: ' + data.user : '';
  el('editable-section').hidden = !data.editable || !data.editable.length;
  el('editable').replaceChildren();
  for (const path of data.editable || []) {
    const item = document.createElement('li');
    item.textContent = path;
    el('editable').appendChild(item);
  }
  const messages = {running: 'Running…', declined: 'Declined', expired: 'No such request', failed: data.reason || 'Failed', ran: 'Exit code: ' + data.exit_code};
  el('status').textContent = data.message ? data.message + ' (' + data.tries_left + ' tries left)' : messages[data.state] || '';
  el('output').textContent = data.output || '';
  el('form').hidden = data.state !== 'waiting';
  if (data.state === 'running') setTimeout(load, 1000);
}
async function load() {
  try { render(await (await fetch(base + '/data', {cache: 'no-store'})).json()); }
  catch (_) { el('status').textContent = 'Could not load the request.'; }
}
el('form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!confirming) {
    confirming = true;
    el('run').textContent = 'Confirm: run as root';
    el('run').classList.add('confirm');
    confirmTimer = setTimeout(reset, 5000);
    return;
  }
  clearTimeout(confirmTimer);
  reset();
  const body = new URLSearchParams({password: el('password').value});
  el('password').value = '';
  el('form').hidden = true;
  el('status').textContent = 'Running…';
  const poll = setInterval(async () => {
    try {
      const data = await (await fetch(base + '/status', {cache: 'no-store'})).json();
      if (data.state === 'running') el('status').textContent = 'Running…';
    } catch (_) {}
  }, 1000);
  try { await fetch(base + '/run', {method: 'POST', body}); await load(); }
  catch (_) { el('status').textContent = 'Lost the connection; checking…'; load(); }
  finally { clearInterval(poll); }
});
load();
