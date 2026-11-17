'use strict';

// Reusable terminal pane. Hosts own the switch placement and status display.
(() => {
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

  const mouseReport = /\x1b\[M[\s\S]{3}|\x1b\[<\d+;\d+;\d+[Mm]|\x1b\[\d+;\d+;\d+M|\x1b\[[IO]/g;
  function stripMouseModes(text) {
    return text.replace(/\x1b\[\?([\d;]+)h/g, (sequence, modes) => {
      const kept = modes.split(';').filter(mode => !['1000', '1002', '1003', '1004', '1005', '1006', '1015'].includes(mode));
      return kept.length ? `\x1b[?${kept.join(';')}h` : '';
    });
  }

  function mount(container, initial) {
    let options = { ...initial }, term, observer, interval, dataSubscription;
    let generation = 0, active = false, enabled = false, previous = null, polling = false, defaultCursor;
    let sending = Promise.resolve();
    const switchEl = document.createElement('button');
    switchEl.type = 'button';
    switchEl.className = 'tv-switch';
    const notice = document.createElement('div');
    notice.className = 'tv-notice';
    const host = document.createElement('div');
    host.className = 'tv-host';
    const keys = document.createElement('div');
    keys.className = 'tv-keys';
    keys.setAttribute('aria-label', 'Keys');
    for (const [key, label] of [['Escape', 'Esc'], ['Tab', 'Tab'], ['C-c', 'Ctrl-C'], ['Left', '←'], ['Up', '↑'], ['Down', '↓'], ['Right', '→'], ['Enter', 'Enter']]) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.key = key; button.textContent = label;
      if (['Left', 'Up', 'Down', 'Right'].includes(key)) button.setAttribute('aria-label', key);
      keys.append(button);
    }
    function setTyping(value) {
      enabled = !!value && active;
      if (!enabled) generation++;
      switchEl.textContent = enabled ? 'Typing' : 'View only';
      switchEl.setAttribute('aria-pressed', String(enabled));
      container.classList.toggle('tv-typing', enabled);
      notice.textContent = enabled ? `Keys and pastes go straight to ${options.label}.` : '';
      notice.hidden = !enabled;
      if (term) {
        if (enabled) {
          const cursor = getComputedStyle(document.documentElement).getPropertyValue('--warn').trim();
          term.options.theme = { ...term.options.theme, cursor };
        } else {
          term.options.theme = { ...term.options.theme, cursor: defaultCursor };
        }
        term.write(enabled ? '\x1b[?25h' : '\x1b[?25l');
        if (enabled) term.focus();
      }
    }
    function sendKey(key) {
      const queuedGeneration = generation;
      const base = options.base;
      sending = sending.then(async () => {
        if (!active || !enabled || queuedGeneration !== generation) return;
        try {
          const response = await fetch(`${base}/keys`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keys: key }) });
          if (!response.ok) throw new Error(`keys ${response.status}`);
        } catch (failure) {
          if (active && queuedGeneration === generation) options.onStatus(`send failed: ${failure.message}`, false);
        }
      });
    }
    function onData(data) {
      if (!enabled) return;
      data = data.replace(mouseReport, '');
      if (!data) return;
      for (const key of keysFor(data)) sendKey(key);
    }
    const onSwitch = () => setTyping(!enabled);
    const onKeys = event => {
      const button = event.target.closest('button[data-key]');
      if (button && enabled) { sendKey(button.dataset.key); term.focus(); }
    };
    switchEl.addEventListener('click', onSwitch);
    keys.addEventListener('click', onKeys);
    function resize() {
      if (!active || !term) return;
      const screen = host.querySelector('.xterm-screen');
      if (!screen) return;
      const cellHeight = screen.getBoundingClientRect().height / term.rows;
      const style = getComputedStyle(host);
      const height = host.clientHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0);
      const rows = cellHeight ? Math.max(1, Math.floor(height / cellHeight)) : 24;
      if (rows !== term.rows) { term.resize(term.cols, rows); previous = null; }
    }
    async function poll() {
      if (polling || !active) return;
      polling = true;
      // Typing changes must not invalidate reads; lifecycle is tracked separately.
      const currentTerm = term;
      try {
        const response = await fetch(`${options.base}/pane${options.history ? `?history=${options.history}` : ''}`);
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || String(response.status));
        }
        const body = await response.json();
        if (!active || currentTerm !== term) return;
        const pane = stripMouseModes(String(body[options.paneField] ?? ''));
        options.onStatus('live', true);
        if (pane !== previous) {
          previous = pane;
          const lines = pane.replace(/\n$/, '').split('\n');
          const visible = line => line.replace(/\x1b\[[0-9;:]*[A-Za-z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');
          const cols = Math.max(80, ...lines.map(line => visible(line).length));
          const buffer = term.buffer.active;
          const distance = buffer.baseY - buffer.viewportY;
          if (cols !== term.cols) term.resize(cols, term.rows);
          // Clear screen and scrollback in one write, preserving the viewport in its callback.
          term.write(`\x1b[0m\x1b[3J\x1b[2J\x1b[H${lines.join('\r\n')}\x1b[0m${enabled ? '\x1b[?25h' : '\x1b[?25l'}`,  () => {
            if (!active || currentTerm !== term) return;
            if (distance > 0) term.scrollToLine(Math.max(0, term.buffer.active.baseY - distance));
            else term.scrollToBottom();
          });
        }
      } catch (failure) {
        if (!active || currentTerm !== term) return;
        const message = `unreachable: ${failure.message}`;
        options.onStatus(message, false);
        if (previous !== message) { previous = message; term.write(`\x1b[3J\x1b[2J\x1b[H${message}${enabled ? '\x1b[?25h' : '\x1b[?25l'}`); }
      } finally { if (currentTerm === term) polling = false; }
    }
    function start() {
      active = true; previous = null; polling = false;
      container.classList.add('tv-view');
      container.append(notice, host, keys);
      term = new window.Terminal({ fontSize: 13, cols: 80, rows: 24, scrollback: 2000, cursorBlink: false, convertEol: false });
      term.open(host);
      defaultCursor = term.options.theme.cursor;
      dataSubscription = term.onData(onData);
      setTyping(false);
      resize();
      observer = new ResizeObserver(resize); observer.observe(host);
      options.onStatus('connecting', false);
      poll(); interval = setInterval(poll, 1000);
    }
    function stop() {
      active = false; enabled = false; generation++;
      clearInterval(interval); observer.disconnect(); dataSubscription.dispose(); term.dispose();
      notice.remove(); host.remove(); keys.remove();
      container.classList.remove('tv-view', 'tv-typing');
    }
    start();
    return {
      switchEl, setTyping, typing: () => enabled,
      retarget(next) { stop(); options = { ...options, ...next }; start(); },
      focus() { if (active) term.focus(); },
      destroy() { if (!active) return; stop(); switchEl.removeEventListener('click', onSwitch); keys.removeEventListener('click', onKeys); switchEl.remove(); },
      _onDataForTest: onData,
    };
  }
  window.TermView = { mount };
})();
