import type { Snapshot } from '../types';
export const emptySnapshot = (): Snapshot => ({ generatedAt: '', source: 'snapshot', works: [] });
export async function loadSnapshot(): Promise<Snapshot> {
  try {
    const response = await fetch('/api/snapshot', { credentials: 'same-origin', signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!response.ok) return emptySnapshot();
    const payload = await response.json();
    return Array.isArray(payload.data?.works) ? payload.data : emptySnapshot();
  } catch { return emptySnapshot(); }
}
