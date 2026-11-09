import { Fragment, createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
export interface User { id: string; username: string; role: 'admin' | 'member'; enabled: boolean; studioAccess: boolean; createdAt: string }
interface Session { accessKey: string; user: User | null; needsSetup: boolean; studioEnabled: boolean }
export async function request<T>(url: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch(url, { method, credentials: 'same-origin', headers: { Accept: 'application/json', ...(method !== 'GET' ? { 'Content-Type': 'application/json', 'X-Requested-With': 'Xuzhang' } : {}) }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
  const value = await response.json();
  if (!response.ok || value.success === false) throw new Error(value.message || '请求失败，请稍后重试');
  return value.data;
}
const SessionContext = createContext<Session & { loading: boolean; error: string; refresh: () => Promise<void> }>({ accessKey: 'initial', user: null, needsSetup: false, studioEnabled: false, loading: true, error: '', refresh: async () => {} });
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ accessKey: 'initial', user: null, needsSetup: false, studioEnabled: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  async function refresh() {
    const current = ++sequence.current;
    try { const next = await request<Session>('/api/session'); if (current !== sequence.current) return; setSession(next); setError(''); }
    catch { if (current !== sequence.current) return; setSession({ accessKey: 'initial', user: null, needsSetup: false, studioEnabled: false }); setError('无法确认登录状态，请检查服务并重试'); }
    finally { if (current === sequence.current) setLoading(false); }
  }
  useEffect(() => {
    void refresh();
    const focus = () => { void refresh(); };
    const timer = window.setInterval(focus, 60_000);
    window.addEventListener('focus', focus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', focus); };
  }, []);
  return <SessionContext.Provider value={{ ...session, loading, error, refresh }}><Fragment key={session.user ? [session.user.id, session.user.role, session.user.studioAccess].join(':') : 'guest'}>{children}</Fragment></SessionContext.Provider>;
}
export const useSession = () => useContext(SessionContext);
