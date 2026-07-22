/**
 * Lightweight i18n for static pages.
 *
 * Locale packs: /locales/<lang>/common.json + /locales/<lang>/<page>.json
 * Markup: data-i18n="dot.key" | data-i18n-html | data-i18n-content | data-i18n-attr="attr:key"
 *
 * Locale resolution: ?lang= → localStorage.pm_lang → navigator → en
 *
 * Locale paint: English HTML is always visible first. initI18n loads packs and
 * rewrites [data-i18n*] in place. Never hide body (S3 latency used to black-screen).
 */

const STORAGE_KEY = 'pm_lang';
const DEFAULT_LANG = 'en';
/** Languages shown in the switcher UI */
export const SUPPORTED = ['en', 'es', 'zh', 'ja', 'pt'];
/**
 * Languages with shipped locale packs under /locales/<lang>/.
 * Others appear disabled in the switcher until packs land.
 */
export const AVAILABLE = ['en', 'es', 'zh', 'ja', 'pt'];

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function deepMerge(a, b) {
  if (!b) return a || {};
  if (!a) return { ...b };
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(a[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function normalizeLang(raw) {
  if (!raw) return null;
  const base = String(raw).toLowerCase().split('-')[0];
  return SUPPORTED.includes(base) ? base : null;
}

/** Prefer available packs; fall back to en if the chosen lang has no catalog yet. */
export function resolveLang(preferred) {
  const lang = normalizeLang(preferred) || DEFAULT_LANG;
  return AVAILABLE.includes(lang) ? lang : DEFAULT_LANG;
}

export function detectLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    const fromQ = normalizeLang(q);
    if (fromQ) return resolveLang(fromQ);
  } catch { /* ignore */ }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const fromStore = normalizeLang(stored);
    if (fromStore) return resolveLang(fromStore);
  } catch { /* ignore */ }
  const nav = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
  for (const raw of nav) {
    const base = normalizeLang(raw);
    if (base) return resolveLang(base);
  }
  return DEFAULT_LANG;
}

export function setLang(lang) {
  const next = resolveLang(lang);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch { /* ignore */ }
  try {
    const u = new URL(location.href);
    if (next === DEFAULT_LANG) u.searchParams.delete('lang');
    else u.searchParams.set('lang', next);
    history.replaceState(null, '', u.toString());
  } catch { /* ignore */ }
  return next;
}

function pagePackName() {
  const path = (location.pathname || '').replace(/\/+$/, '') || '/';
  if (path.endsWith('/zk') || path.includes('/zk.') || path.includes('zk.html')) return 'zk';
  if (path.endsWith('/loyalty') || path.includes('loyalty')) return 'loyalty';
  if (path.endsWith('/contact') || path.includes('contact')) return 'contact';
  return 'index';
}

async function loadJson(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loadMessages(lang) {
  const pack = pagePackName();
  const base = '/locales';
  const resolved = resolveLang(lang);
  const [enCommon, enPage, locCommon, locPage] = await Promise.all([
    loadJson(`${base}/en/common.json`),
    loadJson(`${base}/en/${pack}.json`),
    resolved === 'en' ? null : loadJson(`${base}/${resolved}/common.json`),
    resolved === 'en' ? null : loadJson(`${base}/${resolved}/${pack}.json`),
  ]);
  let msgs = deepMerge(enCommon || {}, enPage || {});
  if (resolved !== 'en') {
    msgs = deepMerge(msgs, deepMerge(locCommon || {}, locPage || {}));
  }
  return msgs;
}

export function applyMessages(msgs) {
  if (!msgs) return;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const val = getByPath(msgs, key);
    if (val == null) return;
    el.textContent = String(val);
  });

  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    const val = getByPath(msgs, key);
    if (val == null) return;
    el.innerHTML = String(val);
  });

  document.querySelectorAll('[data-i18n-content]').forEach((el) => {
    const key = el.getAttribute('data-i18n-content');
    const val = getByPath(msgs, key);
    if (val == null) return;
    el.setAttribute('content', String(val));
  });

  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    const spec = el.getAttribute('data-i18n-attr') || '';
    for (const part of spec.split(',')) {
      const [attr, key] = part.split(':').map((s) => s.trim());
      if (!attr || !key) continue;
      const val = getByPath(msgs, key);
      if (val == null) continue;
      el.setAttribute(attr, String(val));
    }
  });

  const title = getByPath(msgs, 'meta.title');
  if (title) document.title = String(title);
}

function markReady(lang) {
  document.documentElement.lang = lang;
  document.documentElement.classList.remove('i18n-pending'); // legacy class if present
  document.documentElement.classList.add('i18n-ready');
  document.documentElement.dataset.lang = lang;
}

function wireSwitcher(sel, onChange) {
  if (!sel || sel.tagName !== 'SELECT') return;

  // Disable options without shipped packs
  Array.from(sel.options).forEach((opt) => {
    const code = normalizeLang(opt.value) || opt.value;
    const ok = AVAILABLE.includes(code);
    opt.disabled = !ok;
    if (!ok && !opt.title) opt.title = 'Translation coming soon';
  });

  // Avoid stacking listeners if initI18n is called twice
  if (sel.dataset.i18nWired === '1') return;
  sel.dataset.i18nWired = '1';
  sel.addEventListener('change', () => {
    onChange(sel.value);
  });
}

/**
 * Apply a language: load packs, walk DOM, notify listeners.
 * Does not full-reload (avoids flicker/flash of English).
 */
export async function applyLang(lang, options = {}) {
  const next = setLang(lang);
  // Never set visibility:hidden — English shell stays painted while packs load (S3-safe).
  document.documentElement.dataset.lang = next;
  try {
    const msgs = await loadMessages(next);
    applyMessages(msgs);
    markReady(next);
    try {
      window.dispatchEvent(new CustomEvent('pm:i18n', { detail: { lang: next, msgs } }));
    } catch { /* ignore */ }
    return { lang: next, msgs };
  } catch (err) {
    markReady(next);
    throw err;
  }
}

export async function initI18n(options = {}) {
  const lang = resolveLang(options.lang || detectLang());
  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;

  // Safety: always mark ready even if fetch hangs (no blank page)
  const safety = setTimeout(() => {
    try { markReady(lang); } catch { /* ignore */ }
  }, 4000);

  let result;
  try {
    result = await applyLang(lang, options);
  } catch {
    markReady(lang);
    result = { lang, msgs: {} };
  } finally {
    clearTimeout(safety);
  }

  const sel = options.selectEl || document.querySelector('[data-i18n-switcher]');
  if (sel && sel.tagName === 'SELECT') {
    sel.value = result.lang;
    wireSwitcher(sel, async (value) => {
      sel.disabled = true;
      try {
        const applied = await applyLang(value);
        sel.value = applied.lang;
      } finally {
        sel.disabled = false;
      }
    });
  }

  return result;
}

/**
 * Tiny head bootstrap string pages can inline to set lang before paint.
 * Prefer copying the snippet in docs/i18n.md into <head>.
 */
export function earlyBootstrapSnippet() {
  return `(function(){try{var q=new URLSearchParams(location.search).get('lang');var s=null;try{s=localStorage.getItem('${STORAGE_KEY}');}catch(e){}var raw=q||s||'';var lang=String(raw||'').toLowerCase().split('-')[0];var avail=${JSON.stringify(AVAILABLE)};if(lang&&avail.indexOf(lang)>=0){document.documentElement.lang=lang;document.documentElement.dataset.lang=lang;}}catch(e){}})();`;
}

if (typeof window !== 'undefined') {
  window.pmI18n = {
    initI18n,
    detectLang,
    setLang,
    resolveLang,
    loadMessages,
    applyMessages,
    applyLang,
    SUPPORTED,
    AVAILABLE,
  };
}
