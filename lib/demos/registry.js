// lib/demos/registry.js — register all interactive demos for the ZK hub.

import { registerDemo } from '../demo-shell.js';
import norickDemo from './norick.js';

let registered = false;

/** Idempotent: register built-in demos. Call before openDemo(). */
export function ensureDemosRegistered() {
  if (registered) return;
  registerDemo(norickDemo);
  // Future: registerDemo(await import('./private-vote.js').then(m => m.default))
  registered = true;
}

export { norickDemo };
