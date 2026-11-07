import type { Snapshot } from '../types';
export const snapshot: Snapshot = { generatedAt: '', source: 'snapshot', works: [] };
let pending: Promise<void> | null = null;
export function loadSnapshot(force = false): Promise<void> {
  if (!pending || force) pending = fetch('/api/snapshot', { signal: AbortSignal.timeout(5000), cache: 'no-store' })
    .then(async response => { if (!response.ok) throw new Error('snapshot'); const payload = await response.json(); if (!Array.isArray(payload.data?.works)) throw new Error('snapshot'); Object.assign(snapshot, payload.data); })
    .catch(() => { Object.assign(snapshot, { generatedAt: '', source: 'snapshot', works: [] }); pending = null; });
  return pending;
}
