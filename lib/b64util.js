// lib/b64util.js — pad + decode helpers for std / base64url (CosmJS + atob).
// CosmJS fromBase64 (base64-js) throws: Invalid string. Length must be a multiple of 4
// when padding is missing or a leading + was stripped. Always pad before decode.

export function padB64(s) {
  const t = String(s || "").trim().replace(/-/g, "+").replace(/_/g, "/");
  if (!t) return "";
  const mod = t.length % 4;
  return mod ? t + "=".repeat(4 - mod) : t;
}

export function decodeB64(s) {
  const pad = padB64(s);
  if (!pad) throw new Error("empty base64");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(pad)) throw new Error("not base64");
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeB64(u8) {
  let s = "";
  const bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8 || []);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function b64query(obj) {
  return encodeURIComponent(encodeB64(new TextEncoder().encode(JSON.stringify(obj))));
}
