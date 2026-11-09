import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { request, type User } from '../session';

type Visibility = 'public' | 'members' | 'selected' | 'admins';
interface Publication { published: boolean; visibility: Visibility; userIds: string[]; revision: number; updatedAt: string | null }
interface Work extends Publication { id: string; title: string; genre: string; source: 'live' | 'snapshot' | 'unavailable' }
interface Catalog { sourceKey: string; items: Work[]; warning: string }
const scopes: Record<Visibility, string> = { public: '所有人（含游客）', members: '登录用户', selected: '指定用户', admins: '仅管理员' };
const errorText = (error: unknown) => error instanceof Error ? error.message : '操作失败，请重试';
function PublicationRow({ work, users, sourceKey, onSaved }: { work: Work; users: User[]; sourceKey: string; onSaved: (id: string, value: Publication) => void }) {
  const id = useId();
  const [published, setPublished] = useState(work.published);
  const [visibility, setVisibility] = useState(work.visibility);
  const [userIds, setUserIds] = useState(work.userIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { setPublished(work.published); setVisibility(work.visibility); setUserIds(work.userIds); }, [work]);
  const dirty = published !== work.published || visibility !== work.visibility || [...userIds].sort().join(',') !== [...work.userIds].sort().join(',');
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await request<Publication>('/api/admin/publications/' + encodeURIComponent(work.id), 'PUT', { sourceKey, published, visibility, userIds, revision: work.revision });
      onSaved(work.id, result);
      setMessage(result.published ? '上架状态与可见范围已保存' : '作品已下架，仅管理员可预览');
    } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  const readers = users.filter(user => user.role === 'member');
  return <form className="publication-row manage-form" onSubmit={save} aria-labelledby={id + '-title'}>
    <div className="publication-summary"><h3 id={id + '-title'}>{work.title}</h3><p>{work.genre} · {work.source === 'live' ? '实时来源' : work.source === 'snapshot' ? '离线快照' : '来源暂不可用'} · <span className={work.published ? 'publication-state--on' : ''}>{work.published ? '已上架' : '未上架'}</span></p><Link className="text-link" to={'/novels/' + encodeURIComponent(work.id)} target="_blank" rel="noreferrer">预览作品<span className="sr-only">：{work.title}</span></Link></div>
    <label className="check-field"><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} disabled={busy} />上架</label>
    <label>可见范围<select aria-label="可见范围" value={visibility} onChange={e => { setVisibility(e.target.value as Visibility); setUserIds([]); }} disabled={busy}>{Object.entries(scopes).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
    <div className="publication-save"><button className="button button--solid" disabled={busy || !dirty}>{busy ? '保存中…' : '保存设置'}</button>{dirty && <small>有未保存的修改</small>}</div>
    {visibility === 'selected' && <fieldset className="publication-readers"><legend>指定可读用户</legend><p>管理员始终可以预览。普通用户需要在此明确授权。</p>{readers.length ? <div>{readers.map(user => <label className="check-field" key={user.id}><input type="checkbox" checked={userIds.includes(user.id)} disabled={busy || !user.enabled} onChange={e => setUserIds(current => e.target.checked ? [...current, user.id] : current.filter(value => value !== user.id))} /><span>{user.username}{!user.enabled && '（已停用）'}</span></label>)}</div> : <p>尚无普通用户，请先在“用户管理”中创建。</p>}</fieldset>}
    {error && <p className="form-error publication-feedback" role="alert">{error}</p>}{message && <p className="form-message publication-feedback" role="status">{message}</p>}
  </form>;
}
export function PublicationManager({ users }: { users: User[] }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  async function load() {
    setLoading(true); setError('');
    try { setCatalog(await request<Catalog>('/api/admin/catalog')); }
    catch (error) { setError(errorText(error)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => (catalog?.items || []).filter(work => (status === 'all' || work.published === (status === 'published')) && (work.title + ' ' + work.genre).toLowerCase().includes(query.trim().toLowerCase())), [catalog, status, query]);
  useEffect(() => setPage(1), [query, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);
  function saved(id: string, policy: Publication) { setCatalog(current => current ? { ...current, items: current.items.map(work => work.id === id ? { ...work, ...policy } : work) } : current); }
  return <section className="manage-section publication-manager" aria-busy={loading}><div className="publication-heading"><div><h2>作品上架</h2><p>新作品默认不上架。游客和普通用户只能阅读已上架且符合可见范围的作品；管理员可预览全部作品。</p></div><button className="button button--ghost" onClick={() => void load()} disabled={loading}><RefreshCw size={15} />{loading ? '正在读取…' : '刷新作品'}</button></div>
    <div className="publication-toolbar manage-form"><label>搜索作品<input type="search" placeholder="作品名称或题材" value={query} onChange={e => setQuery(e.target.value)} /></label><label>上架状态<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">全部状态</option><option value="published">已上架</option><option value="unpublished">未上架</option></select></label><p role="status">{loading ? '读取作品列表中…' : `共 ${filtered.length} 部作品`}</p></div>
    {error && <p className="form-error" role="alert">{error}</p>}{catalog?.warning && <p className="form-help" role="status">{catalog.warning}。仍可管理已读取作品及原有上架设置。</p>}
    {catalog && <div className="publication-list">{filtered.slice((currentPage - 1) * 20, currentPage * 20).map(work => <PublicationRow key={catalog.sourceKey + work.id} work={work} users={users} sourceKey={catalog.sourceKey} onSaved={saved} />)}</div>}
    {!loading && !error && !filtered.length && <p className="publication-empty">{catalog?.items.length ? '没有匹配的作品，请调整搜索或筛选。' : '暂无可管理的作品，请检查站点配置或稍后刷新。'}</p>}
    {pages > 1 && <nav className="manage-actions publication-pagination" aria-label="作品分页"><button className="button button--ghost" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>上一页</button><span>{currentPage} / {pages}</span><button className="button button--ghost" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>下一页</button></nav>}
  </section>;
}
