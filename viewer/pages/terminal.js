'use strict';

// Terminal page (Spec "Views"): xterm.js over pane reads and raw tmux keys. Every key goes
// through as typed; this page never adds an Enter the user did not type.
(() => {
  const params = new URLSearchParams(location.search);
  // Login mode: ?login=<account id>&machine=<m> drives that sign-in's tmux pane through the
  // account routes; the Sessions page never lists it.
  const login = params.get('login') || '';
  const loginMachine = params.get('machine') || '';
  const name = login ? `sign-in ${login} on ${loginMachine}` : (params.get('name') || '');
  const base = login
    ? `/wheelchair/api/accounts/${encodeURIComponent(login)}/signin/${encodeURIComponent(loginMachine)}`
    : `/wheelchair/api/sessions/${encodeURIComponent(name)}`;
  const status = document.getElementById('term-status');
  document.getElementById('term-name').textContent = name;

  const SEQUENCES = {
    '\r': 'Enter',
    '\n': 'Enter',
    '\x7f': 'BSpace',
    '\b': 'BSpace',
    '\t': 'Tab',
    '\x1b': 'Escape',
    '\x1b[A': 'Up',
    '\x1b[B': 'Down',
    '\x1b[C': 'Right',
    '\x1b[D': 'Left',
    '\x1bOA': 'Up',
    '\x1bOB': 'Down',
    '\x1bOC': 'Right',
    '\x1bOD': 'Left',
    '\x1b[H': 'Home',
    '\x1b[F': 'End',
    '\x1b[3~': 'DC',
    '\x1b[5~': 'PageUp',
    '\x1b[6~': 'PageDown',
    '\x1b[Z': 'BTab',
  };

  // One tmux key name per character. tmux send-keys takes a single key argument here, so
  // a space is `Space` and a semicolon is sent as backslash-semicolon (one argv word), since a bare `;` is tmux's command separator.
  function charKey(char) {
    const code = char.codePointAt(0);
    if (code >= 1 && code <= 26) return `C-${String.fromCharCode(code + 96)}`;
    if (char === ' ') return 'Space';
    if (char === ';') return '\\;';
    return char;
  }

  function keysFor(data) {
    if (SEQUENCES[data]) return [SEQUENCES[data]];
    const keys = [];
    for (const char of data) keys.push(SEQUENCES[char] || charKey(char));
    return keys;
  }

  let sending = Promise.resolve();
  function sendKey(key) {
    sending = sending.then(async () => {
      try {
        const response = await fetch(`${base}/keys`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ keys: key }),
        });
        if (!response.ok) throw new Error(`keys ${response.status}`);
      } catch (failure) {
        setStatus(`send failed: ${failure.message}`, false);
      }
    });
    return sending;
  }

  function setStatus(text, ok) {
    status.textContent = text;
    status.className = `v-badge ${ok ? 'ok' : 'bad'}`;
  }

  const term = new window.Terminal({
    fontSize: 13,
    cols: 80,
    rows: 24,
    scrollback: 0,
    cursorBlink: false,
    convertEol: false,
  });
  term.open(document.getElementById('term'));
  term.onData((data) => { for (const key of keysFor(data)) sendKey(key); });

  for (const button of document.querySelectorAll('#term-keys button')) {
    button.addEventListener('click', () => { sendKey(button.dataset.key); term.focus(); });
  }

  let previous = null;
  let polling = false;
  async function poll() {
    if (polling) return;
    polling = true;
    try {
      const response = await fetch(`${base}/pane`);
      if (!response.ok) throw new Error(`pane ${response.status}`);
      const body = await response.json();
      const pane = login ? body.text : body.pane;
      setStatus('live', true);
      if (pane !== previous) {
        previous = pane;
        const lines = String(pane).replace(/\n$/, '').split('\n');
        const cols = Math.max(80, ...lines.map((line) => line.length));
        const rows = Math.max(24, lines.length);
        if (cols !== term.cols || rows !== term.rows) term.resize(cols, rows);
        term.write(`\x1b[2J\x1b[H${lines.join('\r\n')}`);
      }
    } catch (failure) {
      setStatus(`unreachable: ${failure.message}`, false);
    } finally {
      polling = false;
    }
  }

  poll();
  setInterval(poll, 500);
  term.focus();
})();
