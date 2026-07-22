// lib/demo-shell.js — modular demo modal host for permissionless.money
// Minimal chrome: title + ? info + body. Details live behind the info control.

const STYLE_ID = 'pm-demo-shell-styles';
const ROOT_ID = 'pm-demo-shell';

/** @type {Map<string, { id: string, title?: string, kicker?: string, blurb?: string, infoHtml?: string, pills?: object[], footer?: string, mount: Function }>} */
const registry = new Map();

/** @type {{ id: string, unmount?: () => void } | null} */
let active = null;

/** @param {{ id: string, title?: string, kicker?: string, blurb?: string, infoHtml?: string, pills?: object[], footer?: string, mount: Function }} demo */
export function registerDemo(demo) {
  if (!demo?.id) throw new Error('Demo requires id');
  registry.set(demo.id, demo);
}

export function listDemos() {
  return [...registry.values()];
}

export function getDemo(id) {
  return registry.get(id) || null;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    #${ROOT_ID} {
      position: fixed; inset: 0; z-index: 10040;
      display: none; align-items: center; justify-content: center;
      background: rgba(8, 9, 13, 0.88);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 1rem;
    }
    #${ROOT_ID}.open { display: flex; }
    #${ROOT_ID} .pm-demo-panel {
      width: min(460px, 100%);
      max-height: min(92vh, 760px);
      overflow: auto;
      background: linear-gradient(160deg, rgba(33,34,44,0.98), rgba(12,14,22,0.98));
      border: 1px solid rgba(189, 147, 249, 0.28);
      border-radius: 14px;
      box-shadow: 0 0 60px rgba(189, 147, 249, 0.1);
      padding: 1.25rem 1.3rem 1.35rem;
      color: #f8f8f2;
      font-family: 'Satoshi', sans-serif;
      font-size: 1.05rem;
      position: relative;
    }
    #${ROOT_ID} .pm-demo-head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 0.5rem; margin-bottom: 1.1rem;
    }
    #${ROOT_ID} .pm-demo-title-row {
      display: flex; align-items: center; gap: 0.5rem; min-width: 0;
    }
    #${ROOT_ID} .pm-demo-title {
      font-size: 1.35rem; font-weight: 600; color: #b1ebeb; margin: 0;
      line-height: 1.2;
    }
    #${ROOT_ID} .pm-demo-info-btn {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      border: 1px solid rgba(189, 147, 249, 0.4);
      background: rgba(189, 147, 249, 0.1);
      color: #bd93f9; font-size: 0.95rem; font-weight: 600;
      cursor: pointer; line-height: 1; padding: 0;
      font-family: inherit;
    }
    #${ROOT_ID} .pm-demo-info-btn:hover {
      background: rgba(189, 147, 249, 0.2);
      border-color: #bd93f9;
    }
    #${ROOT_ID} .pm-demo-close {
      border: 1px solid rgba(255,255,255,0.12);
      background: transparent; color: #6272a4; border-radius: 6px;
      width: 32px; height: 32px; cursor: pointer; font-size: 1.1rem; flex-shrink: 0;
      line-height: 1;
    }
    #${ROOT_ID} .pm-demo-close:hover { color: #f8f8f2; border-color: #bd93f9; }
    #${ROOT_ID} .pm-demo-body { min-height: 80px; }

    /* Nested info overlay (same pattern as terp no-rick) */
    #${ROOT_ID} .pm-demo-info-overlay {
      display: none; position: absolute; inset: 0; z-index: 5;
      background: rgba(0,0,0,0.55);
      border-radius: 14px;
      align-items: center; justify-content: center;
      padding: 1rem;
    }
    #${ROOT_ID} .pm-demo-info-overlay.open { display: flex; }
    #${ROOT_ID} .pm-demo-info-card {
      width: 100%; max-height: 100%; overflow: auto;
      background: rgba(10, 10, 15, 0.96);
      border: 1px solid rgba(189, 147, 249, 0.25);
      border-radius: 12px;
      padding: 1.2rem 1.25rem;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 0 40px rgba(189, 147, 249, 0.08);
    }
    #${ROOT_ID} .pm-demo-info-card h3 {
      color: #b1ebeb; margin: 0 0 0.7rem; font-size: 1.2rem; font-weight: 600;
    }
    #${ROOT_ID} .pm-demo-info-kicker {
      font-size: 0.8rem; letter-spacing: 0.12em; text-transform: uppercase;
      color: #bd93f9; margin-bottom: 0.4rem;
    }
    #${ROOT_ID} .pm-demo-info-card p {
      margin: 0 0 0.8rem; color: #a0a8c0; font-size: 1rem; line-height: 1.65;
    }
    #${ROOT_ID} .pm-demo-info-card p:last-of-type { margin-bottom: 0.9rem; }
    #${ROOT_ID} .pm-demo-info-pills {
      display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 0.9rem;
    }
    #${ROOT_ID} .pm-demo-info-pills span {
      font-size: 0.78rem; letter-spacing: 0.04em;
      padding: 0.22rem 0.55rem; border-radius: 999px;
      border: 1px solid rgba(189,147,249,0.25);
      color: #bd93f9; background: rgba(189,147,249,0.08);
    }
    #${ROOT_ID} .pm-demo-info-pills span.live {
      color: #50fa7b; border-color: rgba(80,250,123,0.35);
      background: rgba(80,250,123,0.08);
    }
    #${ROOT_ID} .pm-demo-info-pills span.warn {
      color: #ffb86c; border-color: rgba(255,184,108,0.35);
      background: rgba(255,184,108,0.08);
    }
    #${ROOT_ID} .pm-demo-info-foot {
      font-size: 0.88rem; color: #44475a; line-height: 1.5; margin-bottom: 0.9rem;
    }
    #${ROOT_ID} .pm-demo-info-close {
      width: 100%; padding: 0.65rem; border-radius: 6px; cursor: pointer;
      border: 1px solid rgba(189, 147, 249, 0.35);
      background: rgba(189, 147, 249, 0.1);
      color: #bd93f9; font-family: inherit; font-size: 1rem; font-weight: 500;
    }
    #${ROOT_ID} .pm-demo-info-close:hover {
      background: rgba(189, 147, 249, 0.18);
    }
  `;
  document.head.appendChild(s);
}

function ensureRoot() {
  injectStyles();
  let root = document.getElementById(ROOT_ID);
  if (root) return root;
  root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `
    <div class="pm-demo-panel">
      <div class="pm-demo-head">
        <div class="pm-demo-title-row">
          <h2 class="pm-demo-title" id="pm-demo-title"></h2>
          <button type="button" class="pm-demo-info-btn" id="pm-demo-info-btn"
            aria-label="About this demo" title="About this demo">?</button>
        </div>
        <button type="button" class="pm-demo-close" id="pm-demo-close" aria-label="Close demo">×</button>
      </div>
      <div class="pm-demo-body" id="pm-demo-body"></div>
      <div class="pm-demo-info-overlay" id="pm-demo-info-overlay" role="dialog" aria-modal="true" aria-labelledby="pm-demo-info-heading">
        <div class="pm-demo-info-card">
          <div class="pm-demo-info-kicker" id="pm-demo-info-kicker"></div>
          <h3 id="pm-demo-info-heading"></h3>
          <div class="pm-demo-info-pills" id="pm-demo-info-pills"></div>
          <div id="pm-demo-info-body"></div>
          <div class="pm-demo-info-foot" id="pm-demo-info-foot"></div>
          <button type="button" class="pm-demo-info-close" id="pm-demo-info-close">Got it</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  root.querySelector('#pm-demo-close').addEventListener('click', closeDemo);
  root.querySelector('#pm-demo-info-btn').addEventListener('click', () => openInfo());
  root.querySelector('#pm-demo-info-close').addEventListener('click', () => closeInfo());
  root.querySelector('#pm-demo-info-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'pm-demo-info-overlay') closeInfo();
  });
  root.addEventListener('click', (e) => {
    if (e.target === root) closeDemo();
  });
  document.addEventListener('keydown', onKey);
  return root;
}

function openInfo() {
  const root = document.getElementById(ROOT_ID);
  root?.querySelector('#pm-demo-info-overlay')?.classList.add('open');
}

function closeInfo() {
  const root = document.getElementById(ROOT_ID);
  root?.querySelector('#pm-demo-info-overlay')?.classList.remove('open');
}

function onKey(e) {
  if (e.key !== 'Escape' || !active) return;
  const root = document.getElementById(ROOT_ID);
  const info = root?.querySelector('#pm-demo-info-overlay');
  if (info?.classList.contains('open')) {
    closeInfo();
    return;
  }
  closeDemo();
}

/**
 * @param {string} id
 * @param {object} [ctx]
 */
export async function openDemo(id, ctx = {}) {
  const demo = registry.get(id);
  if (!demo) {
    console.error('[demo-shell] unknown demo', id);
    return;
  }

  if (active) closeDemo();

  const root = ensureRoot();
  root.querySelector('#pm-demo-title').textContent = demo.title || id;

  // Info panel content (hidden until ?)
  root.querySelector('#pm-demo-info-kicker').textContent = demo.kicker || 'Interactive demo';
  root.querySelector('#pm-demo-info-heading').textContent =
    demo.infoTitle || `What is ${demo.title || id} demonstrating?`;

  const pillsEl = root.querySelector('#pm-demo-info-pills');
  pillsEl.innerHTML = '';
  for (const pill of demo.pills || []) {
    const span = document.createElement('span');
    span.className = pill.tone || '';
    span.textContent = pill.label;
    pillsEl.appendChild(span);
  }

  const infoBody = root.querySelector('#pm-demo-info-body');
  if (demo.infoHtml) {
    infoBody.innerHTML = demo.infoHtml;
  } else if (demo.blurb) {
    infoBody.innerHTML = `<p>${escapeHtml(demo.blurb)}</p>`;
  } else {
    infoBody.innerHTML = '';
  }

  root.querySelector('#pm-demo-info-foot').textContent = demo.footer || '';

  const body = root.querySelector('#pm-demo-body');
  body.innerHTML = '';
  closeInfo();

  root.classList.add('open');
  document.body.style.overflow = 'hidden';

  let unmount = null;
  try {
    const result = await demo.mount(body, {
      ...ctx,
      close: closeDemo,
      openInfo,
      demoId: id,
    });
    if (typeof result === 'function') unmount = result;
    else if (result?.unmount) unmount = result.unmount;
  } catch (e) {
    body.innerHTML = `<p style="color:#ff5555;font-size:0.85rem;">Failed to load demo: ${escapeHtml(e.message || String(e))}</p>`;
  }

  active = { id, unmount };
}

export function closeDemo() {
  const root = document.getElementById(ROOT_ID);
  if (active?.unmount) {
    try {
      active.unmount();
    } catch (e) {
      console.warn('[demo-shell] unmount', e);
    }
  }
  active = null;
  closeInfo();
  if (root) {
    root.classList.remove('open');
    const body = root.querySelector('#pm-demo-body');
    if (body) body.innerHTML = '';
  }
  document.body.style.overflow = '';
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
