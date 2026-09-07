/** Forward this tab's console to POST /__console (dev mint server). */
(function () {
  if (window.__PM_CONSOLE_HOOK__) return;
  window.__PM_CONSOLE_HOOK__ = true;
  const levels = ['log', 'info', 'warn', 'error', 'debug'];
  const orig = {};
  const queue = [];
  let flushTimer = null;
  const MAX = 40;
  const ARG_LEN = 800;

  function clip(v) {
    try {
      if (v instanceof Error) return (v.stack || v.message || String(v)).slice(0, ARG_LEN);
      if (typeof v === 'string') return v.slice(0, ARG_LEN);
      return JSON.stringify(v, function (_k, val) {
        if (typeof val === 'bigint') return String(val);
        if (typeof val === 'function') return '[fn]';
        return val;
      }).slice(0, ARG_LEN);
    } catch {
      try { return String(v).slice(0, ARG_LEN); } catch { return '[unserializable]'; }
    }
  }

  function enqueue(level, args, extra) {
    queue.push({
      t: Date.now(),
      level,
      href: String(location.href || ''),
      args: (args || []).map(clip),
      extra: extra || null,
    });
    while (queue.length > MAX) queue.shift();
    if (!flushTimer) flushTimer = setTimeout(flush, 80);
  }

  function localDesk() {
    try {
      const h = String(location.hostname || '');
      // Only the mint dev server. Never POST /__console on permissionless.money.
      return h === 'localhost' || h === '127.0.0.1';
    } catch {
      return false;
    }
  }

  function flush() {
    flushTimer = null;
    if (!queue.length) return;
    const batch = queue.splice(0, queue.length);
    if (!localDesk()) return;
    try {
      fetch('/__console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch }),
        keepalive: true,
      }).catch(function () {});
    } catch {
      /* ignore */
    }
  }

  levels.forEach(function (level) {
    orig[level] = console[level] ? console[level].bind(console) : function () {};
    console[level] = function () {
      orig[level].apply(console, arguments);
      enqueue(level, Array.prototype.slice.call(arguments));
    };
  });

  window.addEventListener('error', function (ev) {
    enqueue('error', [ev.message || 'window.error'], {
      filename: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
      stack: ev.error && ev.error.stack,
    });
  });
  window.addEventListener('unhandledrejection', function (ev) {
    const r = ev.reason;
    enqueue('error', ['unhandledrejection', clip(r)], {
      stack: r && r.stack,
    });
  });

  enqueue('info', ['console-ingest attached']);
})();
