import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LogOut, ArrowLeft, RefreshCw } from 'lucide-react';
import { PublicationManager } from './PublicationManager';
import { request, useSession, type User } from '../session';
import { useDocumentTitle } from '../hooks';

type Settings = { studioOrigin: string; studioPublicUrl: string; snapshotEnabled: boolean; sessionHours: number; timeoutSeconds: number };
const errorText = (error: unknown) => error instanceof Error ? error.message : '操作失败，请重试';
function Frame({ title, copy, children }: { title: string; copy: string; children: ReactNode }) {
  useDocumentTitle(title);
  return <main className="manage-page shell"><Link className="text-link" to="/"><ArrowLeft size={15} />返回作品馆</Link><div className="manage-heading"><h1>{title}</h1><p>{copy}</p></div>{children}</main>;
}
function Notice({ error, message }: { error?: string; message?: string }) {
  return <>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}</>;
}
function PasswordField({ label = '密码', name = 'password', current = false, required = true }: { label?: string; name?: string; current?: boolean; required?: boolean }) {
  return <label>{label}<input name={name} type="password" autoComplete={current ? 'current-password' : 'new-password'} minLength={current ? undefined : 12} maxLength={128} required={required} />{!current && <small>12–128 个字符</small>}</label>;
}
export function LoginPage() {
  const { user, needsSetup, loading, error: sessionError, refresh } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (loading) return <Frame title="正在确认账户" copy="请稍候…">{null}</Frame>;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/account'} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try { await request(needsSetup ? '/api/setup' : '/api/login', 'POST', Object.fromEntries(form)); await refresh(); navigate(needsSetup ? '/admin' : '/account'); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <Frame title={needsSetup ? '启用你的作品馆' : '欢迎回来'} copy={needsSetup ? '创建首位管理员，之后在管理中心配置联动与用户。' : '登录后阅读管理员为你开放的上架作品。'}>
    <form className="manage-form manage-form--narrow" onSubmit={submit}>
      {needsSetup && <label>初始化密钥<input name="token" autoComplete="off" type="password" required /><small>从服务数据目录的 setup-token 文件读取；初始化成功后自动失效。</small></label>}
      <label>用户名<input name="username" autoComplete="username" pattern="[A-Za-z0-9_\-]{3,32}" minLength={3} maxLength={32} required /><small>3–32 位字母、数字、下划线或短横线，不区分大小写</small></label>
      <PasswordField current={!needsSetup} />
      <Notice error={error || sessionError} />
      <button className="button button--solid" disabled={busy || Boolean(sessionError)}>{busy ? '正在处理…' : needsSetup ? '创建管理员' : '登录'}</button>
      {sessionError && <button className="button button--ghost" type="button" onClick={() => void refresh()}>重新连接</button>}
      <Link className="text-link" to="/">以游客身份继续阅读</Link>
    </form>
  </Frame>;
}
export function AccountPage() {
  const { user, loading, refresh } = useSession();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (loading) return <Frame title="账户设置" copy="正在读取账户…">{null}</Frame>;
  if (!user) return <Navigate to="/login" replace />;
  async function logout() { setBusy(true); try { await request('/api/logout', 'POST', {}); navigate('/'); await refresh(); } catch (error) { setError(errorText(error)); } finally { setBusy(false); } }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (form.get('password') !== form.get('confirmPassword')) { setError('两次输入的新密码不一致'); return; }
    setBusy(true); setError('');
    try { await request('/api/account/password', 'PUT', Object.fromEntries(form)); await refresh(); navigate('/login?changed=1'); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <Frame title="账户设置" copy={`${user.username} · ${user.role === 'admin' ? '管理员' : '成员'}`}>
    <div className="manage-actions">{user.role === 'admin' && <Link className="button button--ghost" to="/admin">管理中心</Link>}<button className="button button--ghost" disabled={busy} onClick={logout}><LogOut size={16} />退出登录</button></div>
    <section className="manage-section"><h2>修改密码</h2><p>保存后，所有设备上的当前会话都会失效，请重新登录。</p>
      <form className="manage-form manage-form--narrow" onSubmit={changePassword}><PasswordField label="当前密码" name="currentPassword" current /><PasswordField label="新密码" /><PasswordField label="确认新密码" name="confirmPassword" /><Notice error={error} /><button className="button button--solid" disabled={busy}>{busy ? '正在保存…' : '更新密码并退出'}</button></form>
    </section>
  </Frame>;
}
function UserEditor({ user, self, onSaved }: { user: User; self: boolean; onSaved: () => Promise<void> }) {
  const [role, setRole] = useState(user.role); const [studioAccess, setStudioAccess] = useState(user.studioAccess); const [enabled, setEnabled] = useState(user.enabled);
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { setRole(user.role); setEnabled(user.enabled); setStudioAccess(user.studioAccess); }, [user]);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await request(`/api/admin/users/${user.id}`, 'PATCH', { role, enabled, studioAccess, ...(password ? { password } : {}) }); setPassword(''); await onSaved(); setMessage('用户已更新，原会话已失效'); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`删除用户 ${user.username}？该用户将立即退出登录。`)) return;
    setBusy(true); setError('');
    try { await request(`/api/admin/users/${user.id}`, 'DELETE'); await onSaved(); } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <form className="user-editor" onSubmit={save}><div className="user-identity"><h3>{user.username}{self && '（当前账户）'}</h3><small>{new Date(user.createdAt).toLocaleDateString('zh-CN')}</small>{!self && <label className="check-field user-studio-access"><input type="checkbox" checked={role === 'admin' || studioAccess} onChange={e => setStudioAccess(e.target.checked)} disabled={busy || role === 'admin'} />允许进入创作台</label>}</div>
    <label>角色<select value={role} onChange={e => { setRole(e.target.value as User['role']); setStudioAccess(false); }} disabled={self || busy}><option value="member">成员</option><option value="admin">管理员</option></select></label>
    <label className="check-field"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} disabled={self || busy} />启用</label>
    {!self && <><label>重置密码<input type="password" value={password} minLength={12} maxLength={128} autoComplete="new-password" placeholder="留空保留原密码" onChange={e => setPassword(e.target.value)} disabled={busy} /></label><div className="manage-actions"><button className="button button--ghost" disabled={busy}>保存</button><button type="button" className="button button--ghost danger-action" disabled={busy} onClick={remove}>删除</button></div></>}
    <div className="user-feedback"><Notice error={error} message={message} /></div></form>;
}
export function AdminPage() {
  const { user, loading, refresh } = useSession();
  const [tab, setTab] = useState<'publications' | 'settings' | 'users'>('publications');
  const [settings, setSettings] = useState<Settings | null>(null); const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const loadUsers = async () => { setUsers(await request<User[]>('/api/admin/users')); };
  async function load() { setError(''); try { const [config, list] = await Promise.all([request<Settings>('/api/admin/settings'), request<User[]>('/api/admin/users')]); setSettings(config); setUsers(list); } catch (error) { setError(errorText(error)); } }
  useEffect(() => { if (user?.role === 'admin') void load(); }, [user?.id]);
  if (loading) return <Frame title="管理中心" copy="正在确认权限…">{null}</Frame>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Frame title="没有管理权限" copy="当前账户可以阅读管理员上架并授权的作品。"><Link className="button button--ghost" to="/account">返回账户设置</Link></Frame>;
  async function saveSettings(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { setSettings(await request<Settings>('/api/admin/settings', 'PUT', settings)); await refresh(); setMessage('配置已保存并生效。作品列表刷新后使用新来源。'); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  async function testConnection() {
    setBusy(true); setError(''); setMessage('');
    try { const result = await request<{ online: boolean }>('/api/admin/connection', 'POST', {}); if (result.online) setMessage('已连接到作品来源'); else setError('无法连接，请检查已保存的来源地址和服务器网络'); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true); setError(''); setMessage('');
    try { await request('/api/admin/users', 'POST', { ...Object.fromEntries(new FormData(form)), studioAccess: new FormData(form).get('studioAccess') === 'on' }); form.reset(); await loadUsers(); setMessage('用户已创建'); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <Frame title="管理中心" copy="统一管理作品来源、访问权限与账户。">
    <nav className="manage-tabs" aria-label="管理栏目"><button className={tab === 'publications' ? 'is-active' : ''} onClick={() => { setTab('publications'); setError(''); setMessage(''); }} aria-pressed={tab === 'publications'}>作品上架</button><button className={tab === 'settings' ? 'is-active' : ''} onClick={() => { setTab('settings'); setError(''); setMessage(''); }} aria-pressed={tab === 'settings'}>站点配置</button><button className={tab === 'users' ? 'is-active' : ''} onClick={() => { setTab('users'); setError(''); setMessage(''); }} aria-pressed={tab === 'users'}>用户管理</button><Link to="/account">我的账户</Link></nav>
    <Notice error={error} message={message} />
    {!settings && <button className="button button--ghost" onClick={() => void load()}>重新读取</button>}
    {tab === 'publications' && <PublicationManager users={users} />}
    {tab === 'settings' && settings && <section className="manage-section"><h2>创作台联动</h2><p>服务连接地址供作品馆服务器读取；入口地址供获得创作台权限的账户打开。普通阅读权限不会授予创作台权限。</p>
      <form className="manage-form" onSubmit={saveSettings}>
        <label>服务连接地址<input type="url" value={settings.studioOrigin} placeholder="http://studio:28080" onChange={e => setSettings({ ...settings, studioOrigin: e.target.value })} /><small>填入服务器可访问的 HTTP / HTTPS 源地址。留空时关闭实时联动。</small></label>
        <label>成员访问入口<input type="url" value={settings.studioPublicUrl} placeholder="https://studio.example.com" onChange={e => setSettings({ ...settings, studioPublicUrl: e.target.value })} /><small>填入成员浏览器可访问的地址。留空时隐藏所有创作台入口。创作台自身的登录权限由创作台管理。</small></label>
        <div className="form-columns"><label>会话有效期（小时）<input type="number" min={1} max={168} required value={settings.sessionHours} onChange={e => setSettings({ ...settings, sessionHours: Number(e.target.value) })} /><small>缩短时会同时限制现有会话的剩余时长。</small></label><label>连接超时（秒）<input type="number" min={2} max={30} required value={settings.timeoutSeconds} onChange={e => setSettings({ ...settings, timeoutSeconds: Number(e.target.value) })} /></label></div>
        <label className="check-field"><input type="checkbox" checked={settings.snapshotEnabled} onChange={e => setSettings({ ...settings, snapshotEnabled: e.target.checked })} />启用离线快照阅读</label>
        <p className="form-help">离线快照同样遵循作品上架状态和可见范围。</p>
        <div className="manage-actions"><button className="button button--solid" disabled={busy}>{busy ? '正在处理…' : '保存配置'}</button><button type="button" className="button button--ghost" disabled={busy} onClick={testConnection}><RefreshCw size={15} />检测已保存的连接</button></div>
      </form></section>}
    {tab === 'users' && <><section className="manage-section"><h2>访问权限</h2><p>游客和普通用户按作品可见范围阅读。创作台入口需要单独授权；管理员管理上架、权限与账户。</p><div className="user-list">{users.map(item => <UserEditor key={item.id} user={item} self={item.id === user.id} onSaved={loadUsers} />)}</div></section>
      <section className="manage-section"><h2>创建用户</h2><form className="manage-form manage-form--narrow" onSubmit={addUser}><label>用户名<input name="username" pattern="[A-Za-z0-9_\-]{3,32}" minLength={3} maxLength={32} required autoComplete="off" /></label><PasswordField label="初始密码" /><label>角色<select name="role" defaultValue="member"><option value="member">成员</option><option value="admin">管理员</option></select></label><label className="check-field"><input type="checkbox" name="studioAccess" />允许进入创作台（独立授权）</label><button className="button button--solid" disabled={busy}>{busy ? '正在创建…' : '创建用户'}</button></form></section></>}
  </Frame>;
}
